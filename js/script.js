"use strict";

/* ============================================================
 * Конфигурация отправки заявок.
 * Сейчас endpoint пустой: формы работают в демо-режиме
 * (успех + запись в консоль). Когда появится почта/CRM —
 * вставить сюда URL (FormSubmit, Formspree или свой API),
 * и все формы начнут слать туда БЕЗ переделки кода.
 * ============================================================ */
var LEAD_ENDPOINT = "";

/**
 * Единая точка отправки заявок: {form, ...payload}.
 * Возвращает Promise<boolean> — true, если заявка ушла/принята.
 */
function sendLead(type, payload) {
  var body = { form: type, page: location.href, at: new Date().toISOString() };
  for (var k in payload) body[k] = payload[k];

  if (!LEAD_ENDPOINT) {
    console.log("[DEMO lead]", body);
    // Демо-журнал: заявки складываем в localStorage, чтобы пережить
    // перезагрузку. Посмотреть: showLeads() в консоли. Очистить: clearLeads().
    try {
      var journal = JSON.parse(localStorage.getItem("leadsJournal.v1") || "[]");
      journal.push(body);
      localStorage.setItem("leadsJournal.v1", JSON.stringify(journal));
    } catch (e) { /* приватный режим */ }
    return Promise.resolve(true);
  }
  return fetch(LEAD_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  }).then(function (r) { return r.ok; }).catch(function () { return false; });
}

/** Показать все демо-заявки из журнала (вызвать в консоли: showLeads()). */
function showLeads() {
  var journal = [];
  try { journal = JSON.parse(localStorage.getItem("leadsJournal.v1") || "[]"); } catch (e) { /* noop */ }
  console.table(journal);
  return journal.length;
}

/** Очистить демо-журнал (вызвать в консоли: clearLeads()). */
function clearLeads() {
  try { localStorage.removeItem("leadsJournal.v1"); } catch (e) { /* noop */ }
}

/** Маленький помощник: показать статус под формой. */
function formStatus(form, ok) {  var el = form.querySelector(".form-status");
  if (!el) {
    el = document.createElement("p");
    el.className = "form-status small mt-2 mb-0";
    form.appendChild(el);
  }
  el.textContent = ok
    ? "Готово! Заявка принята, автор свяжется с вами."
    : "Не получилось отправить. Попробуйте позже.";
}

/* ============================================================
 * Конструктор подарка: калькулятор + счётчики + черновик
 * ============================================================ */
var BASE_PRICE = 490;   // основа миникнижки
var POEM_PRICE = 50;    // каждое выбранное стихотворение
var DRAFT_KEY = "giftDraft.v1";

function giftCalc() {
  var poems = document.querySelectorAll(".gift-poem:checked").length;
  var pack = document.querySelector(".gift-pack:checked");
  var packPrice = pack ? Number(pack.value) : 0;
  var total = BASE_PRICE + poems * POEM_PRICE + packPrice;
  document.getElementById("giftTotal").textContent = String(total);
  document.getElementById("giftPoemCount").textContent = String(poems);
}

function giftCounters() {
  var cover = document.getElementById("giftCover");
  var sign = document.getElementById("giftSign");
  if (cover) document.getElementById("coverCount").textContent = String(cover.value.length);
  if (sign) document.getElementById("signCount").textContent = String(sign.value.length);
}

/** Собрать текущее состояние конструктора в объект. */
function giftDraft() {
  var poems = [];
  document.querySelectorAll(".gift-poem:checked").forEach(function (c) { poems.push(c.value); });
  var pack = document.querySelector(".gift-pack:checked");
  return {
    poems: poems,
    cover: document.getElementById("giftCover").value,
    sign: document.getElementById("giftSign").value,
    pack: pack ? pack.value : "0"
  };
}

/** Сохранить черновик, чтобы не потерять при перезагрузке. */
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(giftDraft())); } catch (e) { /* приватный режим */ }
}

/** Восстановить черновик при открытии страницы. */
function loadDraft() {
  var raw = null;
  try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { return; }
  if (!raw) return;
  try {
    var d = JSON.parse(raw);
    document.querySelectorAll(".gift-poem").forEach(function (c) {
      c.checked = d.poems && d.poems.indexOf(c.value) !== -1;
    });
    if (d.cover) document.getElementById("giftCover").value = d.cover;
    if (d.sign) document.getElementById("giftSign").value = d.sign;
    if (d.pack) {
      var p = document.querySelector('.gift-pack[value="' + d.pack + '"]');
      if (p) p.checked = true;
    }
  } catch (e) { /* битый черновик — игнорируем */ }
}

/* ============================================================
 * Отзывы: базовые + пользовательские (localStorage), рендер
 * ============================================================ */
var BASE_REVIEWS = [
  { text: "Прочитала первую главу — и купила книгу целиком в тот же вечер. Так про меня ещё никто не писал.", name: "Марина" },
  { text: "Собирала миникнижку маме. Она плакала. Я тоже. Упаковка — как из сказки.", name: "Ольга" }
];
var USER_REVIEWS_KEY = "userReviews.v1";

function getUserReviews() {
  try { return JSON.parse(localStorage.getItem(USER_REVIEWS_KEY) || "[]"); }
  catch (e) { return []; }
}

function renderReviews() {
  var box = document.getElementById("reviewsList");
  if (!box) return;
  var all = BASE_REVIEWS.concat(getUserReviews());
  box.innerHTML = "";
  all.forEach(function (r) {
    var col = document.createElement("div");
    col.className = "col-md-6";
    var card = document.createElement("div");
    card.className = "card card-soft h-100";
    var body = document.createElement("div");
    body.className = "card-body";
    var p = document.createElement("p");
    p.textContent = "«" + r.text + "»";
    var who = document.createElement("p");
    who.className = "text-muted mb-0";
    who.textContent = "— " + r.name;
    body.appendChild(p);
    body.appendChild(who);
    card.appendChild(body);
    col.appendChild(card);
    box.appendChild(col);
  });
}

/* ============================================================
 * Покупка глав: модалка оформления
 * ============================================================ */
function openBuyModal(title) {
  document.getElementById("buyTitle").textContent = title;
  document.getElementById("buyEmail").value = "";
  var form = document.getElementById("buyForm");
  var old = form.querySelector(".form-status");
  if (old) old.remove();
  new bootstrap.Modal(document.getElementById("buyModal")).show();
}

/* ============================================================
 * Инициализация
 * ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  // --- Конструктор ---
  loadDraft();
  document.querySelectorAll(".gift-poem, .gift-pack").forEach(function (el) {
    el.addEventListener("change", function () { giftCalc(); saveDraft(); });
  });
  ["giftCover", "giftSign"].forEach(function (id) {
    var input = document.getElementById(id);
    if (input) input.addEventListener("input", function () { giftCounters(); saveDraft(); });
  });

  var giftForm = document.getElementById("giftForm");
  if (giftForm) {
    giftForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var inputs = giftForm.querySelectorAll("input[required]");
      var data = {
        name: inputs[0].value, phone: inputs[1].value, address: inputs[2].value,
        gift: giftDraft(), total: document.getElementById("giftTotal").textContent + " ₽"
      };
      sendLead("gift-order", data).then(function (ok) {
        formStatus(giftForm, ok);
        if (ok) {
          giftForm.reset();
          try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* noop */ }
          giftCalc();
          giftCounters();
        }
      });
    });
  }

  // --- Покупка глав ---
  document.querySelectorAll("[data-pay]").forEach(function (btn) {
    btn.addEventListener("click", function () { openBuyModal(btn.getAttribute("data-pay")); });
  });

  var buyForm = document.getElementById("buyForm");
  if (buyForm) {
    buyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("buyEmail").value;
      sendLead("chapter-order", {
        item: document.getElementById("buyTitle").textContent, email: email
      }).then(function (ok) {
        formStatus(buyForm, ok);
        if (ok) {
          setTimeout(function () {
            var m = bootstrap.Modal.getInstance(document.getElementById("buyModal"));
            if (m) m.hide();
          }, 1200);
        }
      });
    });
  }

  // --- AI-блок ---
  var aiStart = document.getElementById("aiStart");
  if (aiStart) {
    aiStart.addEventListener("click", function () {
      if (!document.getElementById("aiConsent").checked) {
        alert("Поставьте галочку согласия на обработку данных.");
        return;
      }
      document.getElementById("aiApp").classList.remove("d-none");
      aiStart.disabled = true;
    });
  }

  var aiRate = document.getElementById("aiRate");
  if (aiRate) {
    aiRate.addEventListener("submit", function (e) {
      e.preventDefault();
      var sel = aiRate.querySelector("select").value;
      var txt = aiRate.querySelector('input[type="text"]').value;
      sendLead("ai-rating", { stars: sel, text: txt }).then(function (ok) {
        formStatus(aiRate, ok);
        if (ok) aiRate.reset();
      });
    });
  }

  // --- Подписка ---
  var subForm = document.getElementById("subForm");
  if (subForm) {
    subForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = subForm.querySelector('input[type="email"]').value;
      sendLead("subscribe", { email: email }).then(function (ok) {
        formStatus(subForm, ok);
        if (ok) subForm.reset();
      });
    });
  }

  // --- Отзывы: рендер + добавление ---
  renderReviews();
  var revForm = document.getElementById("reviewForm");
  if (revForm) {
    revForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = document.getElementById("revText").value.trim();
      var name = document.getElementById("revName").value.trim() || "Гость";
      if (!text) return;
      var mine = getUserReviews();
      mine.push({ text: text, name: name });
      try { localStorage.setItem(USER_REVIEWS_KEY, JSON.stringify(mine)); } catch (err) { /* noop */ }
      sendLead("review", { text: text, name: name });
      renderReviews();
      revForm.reset();
      formStatus(revForm, true);
    });
  }

  // --- Год в футере ---
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  giftCalc();
  giftCounters();
});
