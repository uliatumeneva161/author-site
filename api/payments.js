"use strict";
// Интеграция ЮKassa: создание платежа и приём уведомлений.
// Ключи берутся из .env (YOOKASSA_SHOP_ID, YOOKASSA_SECRET).
// Пока ключей нет — модуль сообщает, что оплата недоступна,
// и сайт работает в режиме заявок (ничего не падает).
const crypto = require("crypto");

const SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const SECRET = process.env.YOOKASSA_SECRET || "";
const RETURN_URL = process.env.YOOKASSA_RETURN_URL || "http://localhost:3100/?paid=1";

const configured = Boolean(SHOP_ID && SECRET);

function authHeader() {
  return "Basic " + Buffer.from(`${SHOP_ID}:${SECRET}`).toString("base64");
}

/**
 * Создать платёж. Возвращает { ykId, confirmUrl }.
 * amountKopeks — сумма в копейках (100 ₽ = 10000).
 */
async function createPayment({ amountKopeks, description, email }) {
  const res = await fetch("https://api.yookassa.com/v3/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      // Идемпотентность: повторный запрос с тем же ключом не создаст дубль.
      "Idempotence-Key": crypto.randomUUID()
    },
    body: JSON.stringify({
      amount: { value: (amountKopeks / 100).toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: RETURN_URL },
      description: description.slice(0, 128),
      receipt: {
        customer: { email },
        items: [{
          description: description.slice(0, 128),
          quantity: "1.00",
          amount: { value: (amountKopeks / 100).toFixed(2), currency: "RUB" },
          vat_code: 1, // без НДС (самозанятый)
          payment_mode: "full_payment",
          payment_subject: "commodity"
        }]
      },
      metadata: { email }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`yookassa ${res.status}: ${text}`);
  }
  const data = await res.json();
  return { ykId: data.id, confirmUrl: data.confirmation && data.confirmation.confirmation_url };
}

/**
 * Проверить статус платежа ЗАПРОСОМ К ЮKassa (не верим телу webhook
 * на слово — его может подделать кто угодно).
 */
async function fetchPaymentStatus(ykId) {
  const res = await fetch(`https://api.yookassa.com/v3/payments/${ykId}`, {
    headers: { Authorization: authHeader() }
  });
  if (!res.ok) throw new Error(`yookassa status ${res.status}`);
  const data = await res.json();
  return { status: data.status, paid: data.status === "succeeded", amount: data.amount };
}

module.exports = { configured, createPayment, fetchPaymentStatus };
