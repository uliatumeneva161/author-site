"use strict";
// Email-уведомления о заявках. Если SMTP не настроен (нет .env) —
// письма НЕ теряются: заявка уже в SQLite, а текст падает в консоль.
// Так сайт работает «из коробки», а почта подключается позже.
const nodemailer = require("nodemailer");

const configured = Boolean(process.env.SMTP_HOST && process.env.NOTIFY_TO);

let transport = null;
if (configured) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE || "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function leadSubject(type) {
  const names = {
    "gift-order": "Новый заказ миникнижки",
    "chapter-order": "Покупка главы",
    "free-chapter": "Запрос бесплатной главы",
    "subscribe": "Новая подписка",
    "ai-rating": "Оценка AI-раздела",
    "review": "Новый отзыв"
  };
  return "[Витрина] " + (names[type] || type);
}

async function notifyLead(id, type, payload) {
  const text = `Заявка #${id}\nТип: ${type}\n\n${JSON.stringify(payload, null, 2)}`;
  if (!transport) {
    console.log("[MAIL demo — SMTP не настроен]\n" + text);
    return false;
  }
  await Promise.race([
    transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFY_TO,
      subject: leadSubject(type),
      text
    }),
    // Почта никогда не должна подвешивать ответ дольше 10 секунд.
    new Promise((_, reject) => setTimeout(() => reject(new Error("smtp timeout 10s")), 10000))
  ]);
  return true;
}

module.exports = { notifyLead, mailConfigured: configured };
