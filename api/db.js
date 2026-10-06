"use strict";
// SQLite-хранилище заявок на встроенном модуле node:sqlite (Node 22.5+).
// Никаких нативных сборок и Docker: файл data/leads.db создаётся сам.
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "leads.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,          -- gift-order | chapter-order | subscribe | ai-rating | review
    payload TEXT NOT NULL,       -- весь объект заявки JSON-строкой
    emailed INTEGER NOT NULL DEFAULT 0,  -- 1 = уведомление ушло на почту
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(type);
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,  -- 0 ждёт проверки, 1 виден всем
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Стартовые отзывы — сразу одобрены, чтобы витрина не была пустой.
const seedCount = db.prepare("SELECT COUNT(*) AS n FROM reviews").get().n;
if (seedCount === 0) {
  const seed = db.prepare("INSERT INTO reviews (name, text, approved) VALUES (?, ?, 1)");
  seed.run("Марина", "Прочитала первую главу — и купила книгу целиком в тот же вечер. Так про меня ещё никто не писал.");
  seed.run("Ольга", "Собирала миникнижку маме. Она плакала. Я тоже. Упаковка — как из сказки.");
}

function saveReview(name, text) {
  const info = db.prepare("INSERT INTO reviews (name, text) VALUES (?, ?)").run(name, text);
  return Number(info.lastInsertRowid);
}

function listApprovedReviews() {
  return db.prepare(
    "SELECT id, name, text, created_at FROM reviews WHERE approved = 1 ORDER BY id DESC LIMIT 50"
  ).all();
}

function listAllReviews() {
  return db.prepare("SELECT id, name, text, approved, created_at FROM reviews ORDER BY id DESC LIMIT 100").all();
}

function setReviewApproved(id, approved) {
  db.prepare("UPDATE reviews SET approved = ? WHERE id = ?").run(approved ? 1 : 0, id);
}

function deleteReview(id) {
  db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
}

module.exports = { saveLead, markEmailed, listLeads, saveReview, listApprovedReviews, listAllReviews, setReviewApproved, deleteReview };

function saveLead(type, payload) {
  const info = db.prepare("INSERT INTO leads (type, payload) VALUES (?, ?)").run(type, JSON.stringify(payload));
  return Number(info.lastInsertRowid);
}

function markEmailed(id) {
  db.prepare("UPDATE leads SET emailed = 1 WHERE id = ?").run(id);
}

function listLeads(limit) {
  return db.prepare(
    "SELECT id, type, payload, emailed, created_at FROM leads ORDER BY id DESC LIMIT ?"
  ).all(limit || 200);
}
