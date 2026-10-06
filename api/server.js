"use strict";
// Мини-бэкенд витрины: отдаёт статику (index.html и др.) и API заявок.
// Запуск: cd api && npm install && npm start  →  http://localhost:3100
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const path = require("path");
const fastify = require("fastify")({ logger: true });
const { saveLead, markEmailed, listLeads, saveReview, listApprovedReviews, listAllReviews, setReviewApproved, deleteReview } = require("./db");
const { notifyLead, mailConfigured } = require("./mailer");

const PORT = Number(process.env.PORT || 3100);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const LEAD_TYPES = ["gift-order", "chapter-order", "subscribe", "ai-rating", "review"];

// Антиспам своими руками (без зависимостей): скользящее окно на IP.
// Не больше 10 записей в минуту с одного адреса — скрипт-спамер
// упрётся в 429, живые люди лимита не заметят.
const buckets = new Map(); // ip -> { count, resetAt }
const WRITE_WINDOW_MS = 60 * 1000;
const WRITE_MAX = 10;

function limitWrite(request, reply, done) {
  const now = Date.now();
  let b = buckets.get(request.ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WRITE_WINDOW_MS };
    buckets.set(request.ip, b);
  }
  b.count += 1;
  if (b.count > WRITE_MAX) {
    reply.code(429).send({ ok: false, error: "too many requests, slow down" });
    return;
  }
  done();
}

// Чистим протухшие корзины, чтобы память не росла бесконечно.
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) {
    if (now > b.resetAt) buckets.delete(ip);
  }
}, WRITE_WINDOW_MS).unref();

const WRITE_LIMIT = { preHandler: limitWrite };

// Статика: корень проекта (index.html, css/, js/, admin.html)
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, ".."),
  prefix: "/"
});

// POST /api/leads  {form, ...данные} -> {ok:true, id}
fastify.post("/api/leads", WRITE_LIMIT, async (request, reply) => {
  const body = request.body || {};
  const type = body.form;
  if (!LEAD_TYPES.includes(type)) {
    return reply.code(400).send({ ok: false, error: "unknown form type" });
  }
  const payload = { ...body };
  delete payload.form;

  const id = saveLead(type, payload);

  // Уведомление на почту — best effort: заявка уже сохранена,
  // даже если почта упадёт, ничего не потеряется.
  try {
    const sent = await notifyLead(id, type, payload);
    if (sent) markEmailed(id);
    else fastify.log.warn(`lead #${id} saved, mail skipped (no SMTP)`);
  } catch (err) {
    fastify.log.error(`lead #${id} saved, mail failed: ${err.message}`);
  }

  return { ok: true, id };
});

// GET /api/admin/leads  (заголовок x-admin-key: пароль) -> {leads:[...]}
fastify.get("/api/admin/leads", async (request, reply) => {
  if (request.headers["x-admin-key"] !== ADMIN_PASSWORD) {
    return reply.code(401).send({ ok: false, error: "unauthorized" });
  }
  const rows = listLeads(200).map((r) => ({
    id: r.id,
    type: r.type,
    payload: JSON.parse(r.payload),
    emailed: Boolean(r.emailed),
    created_at: r.created_at
  }));
  return { ok: true, mailConfigured, leads: rows };
});

// GET /api/reviews -> только одобренные (публичная витрина)
fastify.get("/api/reviews", async () => {
  return { ok: true, reviews: listApprovedReviews() };
});

// POST /api/reviews {name, text} -> отзыв уходит на модерацию
fastify.post("/api/reviews", WRITE_LIMIT, async (request, reply) => {
  const body = request.body || {};
  const text = String(body.text || "").trim();
  const name = String(body.name || "").trim().slice(0, 50) || "Гость";
  if (text.length < 2 || text.length > 500) {
    return reply.code(400).send({ ok: false, error: "text must be 2..500 chars" });
  }
  const id = saveReview(name, text);
  // Партнёру — письмо о новом отзыве (как обычная заявка типа review)
  const leadId = saveLead("review", { name, text });
  try {
    if (await notifyLead(leadId, "review", { name, text })) markEmailed(leadId);
  } catch (err) {
    fastify.log.error(`review #${id}: mail failed: ${err.message}`);
  }
  return { ok: true, id };
});

function checkAdmin(request, reply) {
  if (request.headers["x-admin-key"] !== ADMIN_PASSWORD) {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return false;
  }
  return true;
}

// GET /api/admin/reviews -> все отзывы для модерации
fastify.get("/api/admin/reviews", async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  return { ok: true, reviews: listAllReviews() };
});

// POST /api/admin/reviews/:id/approve {approved:true|false}
fastify.post("/api/admin/reviews/:id/approve", async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  setReviewApproved(Number(request.params.id), request.body && request.body.approved !== false);
  return { ok: true };
});

// DELETE /api/admin/reviews/:id
fastify.delete("/api/admin/reviews/:id", async (request, reply) => {
  if (!checkAdmin(request, reply)) return;
  deleteReview(Number(request.params.id));
  return { ok: true };
});

fastify.listen({ port: PORT, host: "0.0.0.0" });
