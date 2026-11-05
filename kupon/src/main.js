const STORAGE_KEY = "gift-coupon-100k-v1";
const MAX_TOTAL = 10000000;
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
const TEMPLATES = {
  birthday: { title: "На день рождения", icon: "icon-birthday" },
  "new-year": { title: "Новогодний купон", icon: "icon-snow" },
  "march-8": { title: "К 8 Марта", icon: "icon-flower" },
  valentine: { title: "На День влюблённых", icon: "icon-heart" },
  anniversary: { title: "На нашу годовщину", icon: "icon-star" },
  custom: { title: "Особый праздник", icon: "icon-gift" }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const elements = {
  gift: $("#gift-screen"),
  role: $("#role-screen"),
  app: $("#app-screen"),
  balance: $("#balance"),
  paidTotal: $("#paid-total"),
  pendingTotal: $("#pending-total"),
  availableTotal: $("#available-total"),
  progress: $("#coupon-progress"),
  couponCard: $("#coupon-card"),
  couponTitle: $("#coupon-title"),
  couponDates: $("#coupon-dates"),
  couponDecoration: $("#coupon-decoration"),
  roleBadge: $("#role-badge"),
  wifePanel: $("#wife-panel"),
  husbandPanel: $("#husband-panel"),
  husbandPending: $("#husband-pending"),
  history: $("#history-list"),
  historyCount: $("#history-count"),
  requestForm: $("#request-form"),
  amount: $("#amount"),
  note: $("#request-note"),
  amountError: $("#amount-error"),
  createRequest: $("#create-request"),
  expiryNote: $("#expiry-note"),
  confirmDialog: $("#confirm-dialog"),
  confirmText: $("#confirm-text"),
  shareDialog: $("#share-dialog"),
  shareTitle: $("#share-title"),
  shareText: $("#share-text"),
  shareUrl: $("#share-url"),
  installDialog: $("#install-dialog"),
  nativeInstall: $("#native-install"),
  couponsDialog: $("#coupons-dialog"),
  couponsList: $("#coupons-list"),
  wifeCouponHint: $("#wife-coupon-hint"),
  showAddCoupon: $("#show-add-coupon"),
  addCouponForm: $("#add-coupon-form"),
  newTemplate: $("#new-coupon-template"),
  newTitle: $("#new-coupon-title"),
  newAmount: $("#new-coupon-amount"),
  newStart: $("#new-coupon-start"),
  newEnd: $("#new-coupon-end"),
  newError: $("#new-coupon-error"),
  toast: $("#toast")
};

let state = loadState();
let incoming = readIncoming();
let pendingConfirmation = null;
let deferredInstallPrompt = null;
let toastTimer = null;
let storageWarningShown = false;

function defaultCoupon() {
  return {
    id: "new-year-2027",
    title: "Новогодний купон",
    total: 100000,
    startDate: "2026-11-06",
    endDate: "2026-12-31",
    theme: "new-year",
    requests: []
  };
}

function emptyState() {
  const coupon = defaultCoupon();
  return { role: null, coupons: [coupon], activeCouponId: coupon.id };
}

function sanitizeRequests(requests, total) {
  if (!Array.isArray(requests)) return [];
  return requests.filter((request) =>
    request &&
    typeof request.id === "string" &&
    Number.isInteger(request.amount) &&
    request.amount > 0 &&
    request.amount <= total &&
    (request.status === "pending" || request.status === "paid") &&
    typeof request.createdAt === "string" &&
    !Number.isNaN(Date.parse(request.createdAt))
  ).map((request) => ({
    id: request.id.slice(0, 100),
    amount: request.amount,
    note: typeof request.note === "string" ? request.note.slice(0, 80) : "",
    createdAt: request.createdAt,
    status: request.status,
    paidAt: request.status === "paid" && !Number.isNaN(Date.parse(request.paidAt)) ? request.paidAt : request.createdAt
  }));
}

function sanitizeCoupon(coupon) {
  if (!coupon || typeof coupon.id !== "string" || typeof coupon.title !== "string") return null;
  if (!Number.isInteger(coupon.total) || coupon.total < 1 || coupon.total > MAX_TOTAL) return null;
  if (!isDateString(coupon.startDate) || !isDateString(coupon.endDate) || coupon.endDate < coupon.startDate) return null;
  return {
    id: coupon.id.slice(0, 100),
    title: coupon.title.trim().slice(0, 40) || "Подарочный купон",
    total: coupon.total,
    startDate: coupon.startDate,
    endDate: coupon.endDate,
    theme: TEMPLATES[coupon.theme] ? coupon.theme : "custom",
    requests: sanitizeRequests(coupon.requests, coupon.total)
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed) return emptyState();
    if (Array.isArray(parsed.coupons)) {
      const coupons = parsed.coupons.map(sanitizeCoupon).filter(Boolean);
      if (!coupons.length) return emptyState();
      return {
        role: parsed.role === "wife" || parsed.role === "husband" ? parsed.role : null,
        coupons,
        activeCouponId: coupons.some((coupon) => coupon.id === parsed.activeCouponId) ? parsed.activeCouponId : coupons[0].id
      };
    }
    const coupon = defaultCoupon();
    coupon.requests = sanitizeRequests(parsed.requests, coupon.total);
    return {
      role: parsed.role === "wife" || parsed.role === "husband" ? parsed.role : null,
      coupons: [coupon],
      activeCouponId: coupon.id
    };
  } catch {
    return emptyState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      showToast("Браузер не разрешил сохранить данные. Не очищайте эту вкладку.");
    }
  }
}

function activeCoupon() {
  const coupon = state.coupons.find((item) => item.id === state.activeCouponId) || state.coupons[0];
  state.activeCouponId = coupon.id;
  return coupon;
}

function formatMoney(value) {
  return `${money.format(value)} ₽`;
}

function isDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function localDate(value, addDays = 0) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day + addDays);
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function couponStatus(coupon) {
  const now = Date.now();
  if (now < localDate(coupon.startDate).getTime()) return "not-started";
  if (now >= localDate(coupon.endDate, 1).getTime()) return "expired";
  return "active";
}

function paidSum(coupon = activeCoupon()) {
  return coupon.requests.filter((request) => request.status === "paid").reduce((sum, request) => sum + request.amount, 0);
}

function pendingSum(coupon = activeCoupon()) {
  return coupon.requests.filter((request) => request.status === "pending").reduce((sum, request) => sum + request.amount, 0);
}

function showScreen(name) {
  elements.gift.hidden = name !== "gift";
  elements.role.hidden = name !== "role";
  elements.app.hidden = name !== "app";
  window.scrollTo({ top: 0, behavior: "instant" });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 4200);
}

function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodePayload(value) {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function readIncoming() {
  const match = location.hash.match(/^#(z|p|c)=(.+)$/);
  if (!match) return null;
  const payload = decodePayload(match[2]);
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  const types = { z: "request", p: "paid", c: "coupon" };
  if (!payload || payload.v !== 1 || payload.t !== types[match[1]]) {
    return { error: "Ссылка повреждена или имеет неизвестный формат." };
  }
  return payload;
}

function couponLink(coupon) {
  return `${location.href.split("#")[0]}#c=${encodePayload({
    v: 1,
    t: "coupon",
    id: coupon.id,
    title: coupon.title,
    total: coupon.total,
    startDate: coupon.startDate,
    endDate: coupon.endDate,
    theme: coupon.theme
  })}`;
}

function requestLink(coupon, request) {
  return `${location.href.split("#")[0]}#z=${encodePayload({
    v: 1,
    t: "request",
    couponId: coupon.id,
    id: request.id,
    amount: request.amount,
    note: request.note || "",
    createdAt: request.createdAt
  })}`;
}

function paidLink(coupon, request) {
  return `${location.href.split("#")[0]}#p=${encodePayload({
    v: 1,
    t: "paid",
    couponId: coupon.id,
    id: request.id,
    amount: request.amount,
    paidAt: request.paidAt
  })}`;
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeIcon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

function render() {
  const coupon = activeCoupon();
  const paid = paidSum(coupon);
  const pending = pendingSum(coupon);
  const remaining = coupon.total - paid;
  const available = Math.max(0, remaining - pending);
  const status = couponStatus(coupon);
  const unavailable = status !== "active" || available <= 0;

  elements.couponTitle.textContent = coupon.title.toLocaleUpperCase("ru-RU");
  elements.couponDates.textContent = `С ${shortDate(coupon.startDate)} до ${shortDate(coupon.endDate)}`;
  elements.couponCard.dataset.theme = coupon.theme;
  elements.couponDecoration.replaceChildren();
  const decorationUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
  decorationUse.setAttribute("href", `#${TEMPLATES[coupon.theme].icon}`);
  elements.couponDecoration.append(decorationUse);
  elements.balance.textContent = formatMoney(remaining);
  elements.paidTotal.textContent = `Переведено: ${formatMoney(paid)}`;
  elements.pendingTotal.textContent = formatMoney(pending);
  elements.availableTotal.textContent = formatMoney(available);
  elements.progress.max = coupon.total;
  elements.progress.value = paid;
  elements.progress.setAttribute("aria-label", `Переведено ${formatMoney(paid)} из ${formatMoney(coupon.total)}`);
  elements.roleBadge.textContent = state.role === "wife" ? "ТЕЛЕФОН ЖЕНЫ" : "ТЕЛЕФОН МУЖА";
  elements.wifePanel.hidden = state.role !== "wife";
  elements.husbandPanel.hidden = state.role !== "husband";
  elements.expiryNote.hidden = status === "active";
  elements.expiryNote.textContent = status === "not-started"
    ? `Купон начнёт действовать ${shortDate(coupon.startDate)}.`
    : "Срок купона закончился. Новые заявки недоступны.";
  $("#snow").hidden = coupon.theme !== "new-year";

  elements.amount.disabled = unavailable;
  elements.note.disabled = unavailable;
  elements.createRequest.disabled = unavailable;
  $$("[data-amount]").forEach((button) => { button.disabled = unavailable; });
  if (status === "not-started") {
    elements.createRequest.textContent = `Действует с ${shortDate(coupon.startDate)}`;
  } else if (status === "expired") {
    elements.createRequest.textContent = "Срок купона закончился";
  } else if (available <= 0) {
    elements.createRequest.textContent = "Свободная сумма закончилась";
  } else {
    elements.createRequest.replaceChildren(document.createTextNode("Создать заявку"), makeIcon("icon-share"));
  }

  document.title = `${coupon.title}: ${formatMoney(remaining)}`;
  renderHusbandPending(coupon);
  renderHistory(coupon);
  if (elements.couponsDialog.open) renderCoupons();
}

function renderHusbandPending(coupon) {
  elements.husbandPending.replaceChildren();
  const pending = coupon.requests.filter((request) => request.status === "pending");
  if (!pending.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "Пока всё спокойно";
    const text = document.createElement("p");
    text.textContent = "Откройте ссылку на заявку, которую отправит жена. Она появится здесь.";
    empty.append(title, text);
    elements.husbandPending.append(empty);
    return;
  }

  pending.forEach((request) => {
    const card = document.createElement("article");
    card.className = "pending-card";
    const amount = document.createElement("p");
    amount.className = "pending-card__amount";
    amount.textContent = formatMoney(request.amount);
    const date = document.createElement("p");
    date.className = "pending-card__date";
    date.textContent = `Заявка от ${dateTime.format(new Date(request.createdAt))}`;
    card.append(amount, date);
    if (request.note) {
      const note = document.createElement("p");
      note.className = "pending-card__note";
      note.textContent = request.note;
      card.append(note);
    }
    const button = document.createElement("button");
    button.className = "button button--primary";
    button.type = "button";
    button.dataset.pay = request.id;
    button.append(makeIcon("icon-check"), document.createTextNode("Перевёл"));
    card.append(button);
    elements.husbandPending.append(card);
  });
}

function renderHistory(coupon) {
  elements.history.replaceChildren();
  const count = coupon.requests.length;
  elements.historyCount.textContent = `${count} ${pluralOperations(count)}`;
  if (!count) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Здесь появятся заявки и подтверждённые переводы по этому купону.";
    elements.history.append(empty);
    return;
  }

  coupon.requests.forEach((request) => {
    const item = document.createElement("article");
    item.className = "history-item";
    const main = document.createElement("div");
    main.className = "history-item__main";
    const top = document.createElement("div");
    top.className = "history-item__top";
    const amount = document.createElement("span");
    amount.className = "history-item__amount";
    amount.textContent = formatMoney(request.amount);
    const status = document.createElement("span");
    status.className = `status status--${request.status}`;
    status.textContent = request.status === "paid" ? "Переведено" : "Ожидает";
    top.append(amount, status);
    const date = document.createElement("p");
    date.className = "history-item__date";
    const relevantDate = request.status === "paid" ? request.paidAt : request.createdAt;
    date.textContent = `${request.status === "paid" ? "Переведено" : "Создано"}: ${dateTime.format(new Date(relevantDate))}`;
    main.append(top, date);
    if (request.note) {
      const note = document.createElement("p");
      note.className = "history-item__note";
      note.textContent = request.note;
      main.append(note);
    }
    item.append(main);

    const canShareRequest = state.role === "wife" && request.status === "pending";
    const canSharePaid = state.role === "husband" && request.status === "paid";
    if (canShareRequest || canSharePaid) {
      const action = document.createElement("div");
      action.className = "history-item__action";
      const button = document.createElement("button");
      button.className = "button button--ghost button--small";
      button.type = "button";
      if (canShareRequest) button.dataset.shareRequest = request.id;
      if (canSharePaid) button.dataset.sharePaid = request.id;
      button.append(makeIcon("icon-share"), document.createTextNode(canShareRequest ? "Ссылка" : "Подтверждение"));
      action.append(button);
      item.append(action);
    }
    elements.history.append(item);
  });
}

function renderCoupons() {
  elements.couponsList.replaceChildren();
  state.coupons.forEach((coupon) => {
    const item = document.createElement("article");
    item.className = `coupon-list-item${coupon.id === state.activeCouponId ? " is-active" : ""}`;
    const main = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "coupon-list-item__title";
    title.append(makeIcon(TEMPLATES[coupon.theme].icon), document.createTextNode(coupon.title));
    const meta = document.createElement("p");
    meta.className = "coupon-list-item__meta";
    const status = couponStatus(coupon);
    const statusText = status === "active" ? "Действует" : status === "not-started" ? "Скоро начнётся" : "Завершён";
    meta.textContent = `${formatMoney(coupon.total - paidSum(coupon))} осталось · ${statusText} · до ${shortDate(coupon.endDate)}`;
    main.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "coupon-list-item__actions";
    const select = document.createElement("button");
    select.className = "button button--secondary";
    select.type = "button";
    select.dataset.selectCoupon = coupon.id;
    select.disabled = coupon.id === state.activeCouponId;
    select.textContent = coupon.id === state.activeCouponId ? "Выбран" : "Открыть";
    const share = document.createElement("button");
    share.className = "button button--secondary";
    share.type = "button";
    share.dataset.shareCoupon = coupon.id;
    share.textContent = "Отправить";
    actions.append(select, share);
    item.append(main, actions);
    elements.couponsList.append(item);
  });
  elements.showAddCoupon.hidden = state.role !== "husband" || !elements.addCouponForm.hidden;
  elements.wifeCouponHint.hidden = state.role !== "wife";
}

function pluralOperations(count) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "операций";
  if (mod10 === 1) return "операция";
  if (mod10 >= 2 && mod10 <= 4) return "операции";
  return "операций";
}

function setRole(role) {
  state.role = role;
  saveState();
  showScreen("app");
  render();
  processIncoming();
}

function validCouponPayload(payload) {
  return payload &&
    typeof payload.id === "string" && payload.id.length > 0 && payload.id.length < 100 &&
    typeof payload.title === "string" && payload.title.trim().length > 0 &&
    Number.isInteger(payload.total) && payload.total > 0 && payload.total <= MAX_TOTAL &&
    isDateString(payload.startDate) && isDateString(payload.endDate) && payload.endDate >= payload.startDate &&
    TEMPLATES[payload.theme];
}

function processIncoming() {
  if (!incoming) return;
  const payload = incoming;
  incoming = null;
  if (payload.error) {
    showToast(payload.error);
    return;
  }

  if (payload.t === "coupon") {
    if (!validCouponPayload(payload)) {
      showToast("Не удалось прочитать купон. Попросите отправить ссылку снова.");
      return;
    }
    if (state.coupons.some((coupon) => coupon.id === payload.id)) {
      state.activeCouponId = payload.id;
      saveState();
      render();
      showToast("Этот купон уже есть на телефоне.");
      return;
    }
    const coupon = sanitizeCoupon({ ...payload, requests: [] });
    state.coupons.unshift(coupon);
    state.activeCouponId = coupon.id;
    saveState();
    render();
    showToast(`Купон «${coupon.title}» добавлен.`);
    return;
  }

  const coupon = state.coupons.find((item) => item.id === payload.couponId);
  if (!coupon) {
    showToast("Этот купон ещё не добавлен. Сначала откройте ссылку на сам купон.");
    return;
  }
  state.activeCouponId = coupon.id;

  if (payload.t === "request") {
    if (!payload || typeof payload.id !== "string" || !Number.isInteger(payload.amount) ||
        payload.amount < 1 || payload.amount > coupon.total ||
        typeof payload.createdAt !== "string" || Number.isNaN(Date.parse(payload.createdAt))) {
      showToast("Не удалось прочитать заявку. Попросите отправить ссылку снова.");
      return;
    }
    if (coupon.requests.some((request) => request.id === payload.id)) {
      render();
      showToast("Эта заявка уже есть на телефоне.");
      return;
    }
    if (couponStatus(coupon) !== "active") {
      render();
      showToast("Сейчас этот купон недоступен для новых заявок.");
      return;
    }
    const available = coupon.total - paidSum(coupon) - pendingSum(coupon);
    if (payload.amount > available) {
      render();
      showToast(`Недостаточно свободной суммы. Доступно ${formatMoney(available)}.`);
      return;
    }
    coupon.requests.unshift({
      id: payload.id,
      amount: payload.amount,
      note: typeof payload.note === "string" ? payload.note.slice(0, 80) : "",
      createdAt: payload.createdAt,
      status: "pending",
      paidAt: null
    });
    saveState();
    render();
    showToast(`Заявка на ${formatMoney(payload.amount)} добавлена.`);
    return;
  }

  if (payload.t === "paid") {
    const request = coupon.requests.find((item) => item.id === payload.id);
    if (!request) {
      render();
      showToast("Исходная заявка не найдена. Сначала откройте её ссылку.");
      return;
    }
    if (request.amount !== payload.amount || typeof payload.paidAt !== "string" || Number.isNaN(Date.parse(payload.paidAt))) {
      render();
      showToast("Подтверждение не совпадает с заявкой.");
      return;
    }
    if (request.status === "paid") {
      render();
      showToast("Этот перевод уже подтверждён.");
      return;
    }
    request.status = "paid";
    request.paidAt = payload.paidAt;
    saveState();
    render();
    showToast(`Перевод ${formatMoney(request.amount)} подтверждён.`);
  }
}

function openShare(kind, coupon, request = null) {
  if (kind === "coupon") {
    elements.shareTitle.textContent = "Отправить купон жене";
    elements.shareText.textContent = `«${coupon.title}» на ${formatMoney(coupon.total)}. Жена откроет ссылку, и подарок появится в её приложении.`;
    elements.shareUrl.value = couponLink(coupon);
  } else if (kind === "request") {
    elements.shareTitle.textContent = "Отправить заявку мужу";
    elements.shareText.textContent = `Сумма: ${formatMoney(request.amount)}. Отправьте ссылку в мессенджере и дождитесь подтверждения перевода.`;
    elements.shareUrl.value = requestLink(coupon, request);
  } else {
    elements.shareTitle.textContent = "Отправить подтверждение жене";
    elements.shareText.textContent = `Сумма: ${formatMoney(request.amount)}. Жена откроет ссылку, и перевод появится в её истории.`;
    elements.shareUrl.value = paidLink(coupon, request);
  }
  elements.shareDialog.dataset.kind = kind;
  elements.shareDialog.dataset.couponId = coupon.id;
  elements.shareDialog.dataset.requestId = request ? request.id : "";
  elements.shareDialog.showModal();
}

async function copyCurrentLink() {
  elements.shareUrl.focus();
  elements.shareUrl.select();
  try {
    await navigator.clipboard.writeText(elements.shareUrl.value);
    showToast("Ссылка скопирована.");
  } catch {
    const copied = document.execCommand("copy");
    showToast(copied ? "Ссылка скопирована." : "Выделите ссылку и скопируйте её вручную.");
  }
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

$("#open-gift").addEventListener("click", () => showScreen("role"));
$$("[data-role]").forEach((button) => button.addEventListener("click", () => setRole(button.dataset.role)));
$("#change-role").addEventListener("click", () => showScreen("role"));
$("#install-button").addEventListener("click", () => elements.installDialog.showModal());
$("#coupons-button").addEventListener("click", () => {
  elements.couponsList.hidden = false;
  elements.addCouponForm.hidden = true;
  renderCoupons();
  elements.couponsDialog.showModal();
});

$$("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeDialog($(`#${button.dataset.close}`)));
});
$$("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) closeDialog(dialog);
  });
});

elements.showAddCoupon.addEventListener("click", () => {
  elements.couponsList.hidden = true;
  elements.addCouponForm.hidden = false;
  elements.showAddCoupon.hidden = true;
  elements.wifeCouponHint.hidden = true;
  elements.newTemplate.focus();
});
$("#cancel-add-coupon").addEventListener("click", () => {
  elements.couponsList.hidden = false;
  elements.addCouponForm.hidden = true;
  elements.newError.textContent = "";
  renderCoupons();
});
elements.newTemplate.addEventListener("change", () => {
  elements.newTitle.value = TEMPLATES[elements.newTemplate.value].title;
});
elements.newAmount.addEventListener("input", () => {
  const digits = elements.newAmount.value.replace(/\D/g, "").slice(0, 8);
  elements.newAmount.value = digits ? money.format(Number(digits)) : "";
  elements.newError.textContent = "";
});

elements.addCouponForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.newTitle.value.trim();
  const total = Number(elements.newAmount.value.replace(/\D/g, ""));
  const startDate = elements.newStart.value;
  const endDate = elements.newEnd.value;
  let error = "";
  if (!title) error = "Введите название купона.";
  else if (!Number.isInteger(total) || total < 1 || total > MAX_TOTAL) error = `Введите сумму от 1 до ${formatMoney(MAX_TOTAL)}.`;
  else if (!isDateString(startDate) || !isDateString(endDate)) error = "Выберите даты начала и окончания.";
  else if (endDate < startDate) error = "Последний день не может быть раньше начала.";
  if (error) {
    elements.newError.textContent = error;
    return;
  }

  const coupon = {
    id: makeId(),
    title,
    total,
    startDate,
    endDate,
    theme: elements.newTemplate.value,
    requests: []
  };
  state.coupons.unshift(coupon);
  state.activeCouponId = coupon.id;
  saveState();
  elements.addCouponForm.reset();
  elements.addCouponForm.hidden = true;
  elements.newTitle.value = TEMPLATES.birthday.title;
  setDefaultCouponDates();
  closeDialog(elements.couponsDialog);
  render();
  openShare("coupon", coupon);
});

elements.couponsList.addEventListener("click", (event) => {
  const selectButton = event.target.closest("[data-select-coupon]");
  const shareButton = event.target.closest("[data-share-coupon]");
  if (selectButton) {
    state.activeCouponId = selectButton.dataset.selectCoupon;
    saveState();
    closeDialog(elements.couponsDialog);
    render();
    showToast(`Открыт купон «${activeCoupon().title}».`);
  }
  if (shareButton) {
    const coupon = state.coupons.find((item) => item.id === shareButton.dataset.shareCoupon);
    if (coupon) {
      closeDialog(elements.couponsDialog);
      openShare("coupon", coupon);
    }
  }
});

$$("[data-amount]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.amount.value = money.format(Number(button.dataset.amount));
    elements.amountError.textContent = "";
    elements.amount.setAttribute("aria-invalid", "false");
    elements.amount.focus();
  });
});

elements.amount.addEventListener("input", () => {
  const digits = elements.amount.value.replace(/\D/g, "").slice(0, 8);
  elements.amount.value = digits ? money.format(Number(digits)) : "";
  elements.amountError.textContent = "";
  elements.amount.setAttribute("aria-invalid", "false");
});

elements.requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const coupon = activeCoupon();
  const amount = Number(elements.amount.value.replace(/\D/g, ""));
  const available = coupon.total - paidSum(coupon) - pendingSum(coupon);
  let error = "";
  if (couponStatus(coupon) === "not-started") error = `Купон начнёт действовать ${shortDate(coupon.startDate)}.`;
  else if (couponStatus(coupon) === "expired") error = "Срок купона закончился.";
  else if (!amount) error = "Введите сумму заявки.";
  else if (amount > available) error = `Доступно для новой заявки: ${formatMoney(available)}.`;
  if (error) {
    elements.amountError.textContent = error;
    elements.amount.setAttribute("aria-invalid", "true");
    elements.amount.focus();
    return;
  }

  const request = {
    id: makeId(),
    amount,
    note: elements.note.value.trim(),
    createdAt: new Date().toISOString(),
    status: "pending",
    paidAt: null
  };
  coupon.requests.unshift(request);
  saveState();
  elements.requestForm.reset();
  render();
  openShare("request", coupon, request);
});

elements.husbandPending.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pay]");
  if (!button) return;
  const coupon = activeCoupon();
  const request = coupon.requests.find((item) => item.id === button.dataset.pay && item.status === "pending");
  if (!request) return;
  elements.confirmText.textContent = `Подтвердите, что вы уже перевели ${formatMoney(request.amount)}. После этого остаток уменьшится.`;
  pendingConfirmation = () => {
    request.status = "paid";
    request.paidAt = new Date().toISOString();
    saveState();
    render();
    closeDialog(elements.confirmDialog);
    openShare("paid", coupon, request);
  };
  elements.confirmDialog.showModal();
});

$("#confirm-cancel").addEventListener("click", () => {
  pendingConfirmation = null;
  closeDialog(elements.confirmDialog);
});
$("#confirm-action").addEventListener("click", () => {
  if (pendingConfirmation) pendingConfirmation();
  pendingConfirmation = null;
});

elements.history.addEventListener("click", (event) => {
  const requestButton = event.target.closest("[data-share-request]");
  const paidButton = event.target.closest("[data-share-paid]");
  const coupon = activeCoupon();
  if (requestButton) {
    const request = coupon.requests.find((item) => item.id === requestButton.dataset.shareRequest);
    if (request) openShare("request", coupon, request);
  }
  if (paidButton) {
    const request = coupon.requests.find((item) => item.id === paidButton.dataset.sharePaid);
    if (request) openShare("paid", coupon, request);
  }
});

$("#copy-link").addEventListener("click", copyCurrentLink);
$("#share-link").addEventListener("click", async () => {
  const coupon = state.coupons.find((item) => item.id === elements.shareDialog.dataset.couponId);
  if (!coupon) return;
  const kind = elements.shareDialog.dataset.kind;
  const request = coupon.requests.find((item) => item.id === elements.shareDialog.dataset.requestId);
  let text = `Подарок: «${coupon.title}» на ${formatMoney(coupon.total)}.`;
  if (kind === "request" && request) text = `Заявка на ${formatMoney(request.amount)} по купону «${coupon.title}».`;
  if (kind === "paid" && request) text = `Перевод ${formatMoney(request.amount)} по купону «${coupon.title}» подтверждён.`;
  if (!navigator.share) {
    await copyCurrentLink();
    return;
  }
  try {
    await navigator.share({ title: "Подарочный купон", text, url: elements.shareUrl.value });
  } catch (error) {
    if (error.name !== "AbortError") showToast("Не удалось открыть меню отправки. Скопируйте ссылку.");
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.nativeInstall.hidden = false;
});
elements.nativeInstall.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === "accepted") closeDialog(elements.installDialog);
  deferredInstallPrompt = null;
  elements.nativeInstall.hidden = true;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  elements.nativeInstall.hidden = true;
  showToast("Приложение установлено на телефон.");
});

function setDefaultCouponDates() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  elements.newStart.value = toDateInput(tomorrow);
  elements.newEnd.value = `${tomorrow.getFullYear()}-12-31`;
  if (elements.newEnd.value < elements.newStart.value) elements.newEnd.value = elements.newStart.value;
}

function createSnow() {
  const container = $("#snow");
  for (let index = 0; index < 22; index += 1) {
    const flake = document.createElement("span");
    flake.className = "snowflake";
    flake.style.setProperty("--left", `${(index * 47) % 101}%`);
    flake.style.setProperty("--size", `${2 + index % 4}px`);
    flake.style.setProperty("--duration", `${11 + index % 9}s`);
    flake.style.setProperty("--delay", `${-index * 0.8}s`);
    flake.style.setProperty("--drift", `${(index % 2 ? 1 : -1) * (18 + index % 5 * 9)}px`);
    flake.style.setProperty("--opacity", `${0.18 + index % 5 * 0.09}`);
    container.append(flake);
  }
}

setDefaultCouponDates();
createSnow();
if (state.role) {
  showScreen("app");
  render();
  processIncoming();
} else {
  showScreen("gift");
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Приложение продолжает работать онлайн даже без автономного кэша.
    });
  });
}
