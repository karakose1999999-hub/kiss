function buildAccountsRenderer() {
  return `
const { ipcRenderer } = require("electron");

const LOG_PREFIX = "[NewRenderer]";
function log(message, meta) {
  if (typeof meta === "undefined") console.log(LOG_PREFIX, message);
  else console.log(LOG_PREFIX, message, meta);
}

const refs = {
  topStatus: document.getElementById("topStatus"),
  surfaceRoot: document.getElementById("surfaceRoot"),
  sidePanel: document.getElementById("sidePanel"),
  accountCountText: document.getElementById("accountCountText"),
  accountsList: document.getElementById("accountsList"),
  scriptsList: document.getElementById("scriptsList"),
  formTitle: document.getElementById("formTitle"),
  formError: document.getElementById("formError"),
  labelInput: document.getElementById("labelInput"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  eyeBtn: document.getElementById("eyeBtn"),
  saveBtn: document.getElementById("saveBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  formActions: document.getElementById("formActions"),
  addBtn: document.getElementById("addBtn"),
  repeatLastSelectionBtn: document.getElementById("repeatLastSelectionBtn"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  multiBtn: document.getElementById("multiBtn"),
  multiCancelBtn: document.getElementById("multiCancelBtn"),
  confirmOverlay: document.getElementById("confirmOverlay"),
  confirmText: document.getElementById("confirmText"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn")
};

let accounts = [];
let scriptItems = [];
let scriptSettings = {};
let editingAccountId = null;
let formVisible = true;
let formMode = "add";
let isSaving = false;
let launchInProgress = false;
let multiMode = false;
let selectedForMulti = new Set();
let pendingDeleteAccount = null;
let runtimeStatuses = new Map();
let lastSelectionIds = [];

const RUNTIME_LABELS = {
  idle: "Pasif",
  loading: "Hazırlanıyor",
  active: "Aktif",
  error: "Hata",
  stopped: "Durduruldu"
};

function setStatus(text) {
  refs.topStatus.textContent = text;
}

function isUiLocked() {
  return isSaving || launchInProgress;
}

function accountLabel(account) {
  const label = String((account && account.label) || "").trim();
  const username = String((account && account.username) || "").trim();
  return label || username || "Adsız Hesap";
}

function accountIdOf(account) {
  return String(account && account.id ? account.id : "");
}

function readLastSelectionIds() {
  return lastSelectionIds.slice();
}

function writeLastSelection(selectedAccounts) {
  const ids = (Array.isArray(selectedAccounts) ? selectedAccounts : [])
    .map(accountIdOf)
    .filter(Boolean);
  lastSelectionIds = ids;
  ipcRenderer.invoke("accounts:last-selection:set", ids).catch(() => {});
}

function getLastSelectedAccounts() {
  const ids = readLastSelectionIds();
  if (!ids.length || !accounts.length) return [];
  const byId = new Map(accounts.map(account => [accountIdOf(account), account]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

function updateRepeatLastSelectionButton() {
  const selected = getLastSelectedAccounts();
  refs.repeatLastSelectionBtn.disabled = isUiLocked() || !selected.length;
  refs.repeatLastSelectionBtn.textContent = selected.length > 1
    ? "Son Seçilenleri Tekrar Aç (" + selected.length + ")"
    : "Son Seçileni Tekrar Aç";
  refs.repeatLastSelectionBtn.title = selected.length
    ? selected.map(accountLabel).join(", ")
    : "Son seçilen hesap bulunamadı";
}

function applyScriptLockState() {
  const locked = isUiLocked();
  try {
    refs.scriptsList.querySelectorAll("input,button").forEach(element => {
      element.disabled = locked;
    });
  } catch (_) {}
}

function openSelectedAccounts(selectedAccounts, statusText) {
  if (isUiLocked()) return;
  const list = (Array.isArray(selectedAccounts) ? selectedAccounts : []).filter(Boolean);
  if (!list.length) return;
  writeLastSelection(list);
  setLaunchState(true);
  setStatus(statusText || (list.length > 1 ? "Çoklu oyun açılıyor" : "Oyun açılıyor"));
  if (list.length === 1) ipcRenderer.send("account-selected", list[0]);
  else ipcRenderer.send("accounts-multi-selected", list);
}

function runtimeForAccount(account) {
  const id = String(account && account.id ? account.id : "");
  return runtimeStatuses.get(id) || { status: "idle", message: "" };
}

function applyRuntimeSnapshot(snapshot) {
  runtimeStatuses = new Map();
  (Array.isArray(snapshot) ? snapshot : []).forEach(item => {
    if (item && item.accountId) runtimeStatuses.set(String(item.accountId), item);
  });
  renderAccounts();
}

function applyRuntimeUpdate(update) {
  if (!update || !update.accountId) return;
  runtimeStatuses.set(String(update.accountId), update);
  if (launchInProgress && (update.status === "error" || update.status === "stopped")) {
    setLaunchState(false);
  }
  renderAccounts();
}

function showFormError(message) {
  refs.formError.textContent = String(message || "Bir hata oluştu.");
  refs.formError.classList.add("show");
}

function hideFormError() {
  refs.formError.textContent = "";
  refs.formError.classList.remove("show");
}

function resetForm() {
  editingAccountId = null;
  formMode = "add";
  refs.formTitle.textContent = "Yeni Hesap";
  refs.labelInput.value = "";
  refs.usernameInput.value = "";
  refs.passwordInput.value = "";
  refs.passwordInput.type = "password";
  refs.eyeBtn.classList.remove("on");
  refs.saveBtn.textContent = "Hesap Ekle";
  hideFormError();
}

function fillForm(account) {
  editingAccountId = account.id;
  formMode = "edit";
  refs.formTitle.textContent = "Hesap Düzenle";
  refs.labelInput.value = String(account.label || "");
  refs.usernameInput.value = String(account.username || "");
  refs.passwordInput.value = String(account.password || "");
  refs.passwordInput.type = "password";
  refs.eyeBtn.classList.remove("on");
  refs.saveBtn.textContent = "Kaydet";
  hideFormError();
}

function applyLayout() {
  const hasAccounts = accounts.length > 0;
  refs.surfaceRoot.classList.toggle("form-only", !hasAccounts);
  refs.sidePanel.classList.toggle("show-form", formVisible || !hasAccounts);
  refs.sidePanel.classList.toggle("show-scripts", hasAccounts && !formVisible);
  refs.formActions.classList.toggle("single", !hasAccounts);
  refs.cancelBtn.style.display = hasAccounts && formVisible ? "inline-block" : "none";
  refs.accountCountText.textContent = accounts.length + " hesap";
}

function showForm(mode) {
  formMode = mode || "add";
  formVisible = true;
  applyLayout();
}

function hideForm() {
  formVisible = false;
  applyLayout();
}

function applyUiLockState() {
  const locked = isUiLocked();
  refs.saveBtn.disabled = locked;
  refs.cancelBtn.disabled = locked;
  refs.addBtn.disabled = locked;
  refs.repeatLastSelectionBtn.disabled = locked;
  refs.selectAllBtn.disabled = locked;
  refs.multiBtn.disabled = locked;
  refs.multiCancelBtn.disabled = locked;
  refs.eyeBtn.disabled = locked;
  refs.labelInput.readOnly = locked;
  refs.usernameInput.readOnly = locked;
  refs.passwordInput.readOnly = locked;
  updateRepeatLastSelectionButton();
  applyScriptLockState();
}

function setSavingState(value) {
  isSaving = !!value;
  applyUiLockState();
  renderAccounts();
}

function setLaunchState(value) {
  launchInProgress = !!value;
  applyUiLockState();
  renderAccounts();
}

function createEmptyState() {
  refs.accountsList.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "empty";
  const box = document.createElement("div");
  box.className = "empty-card";

  const title = document.createElement("div");
  title.className = "empty-title";
  title.textContent = "Henüz hesap yok";

  const text = document.createElement("div");
  text.className = "empty-text";
  text.textContent = "İlk hesabı ekleyince tekli veya çoklu oyun girişini buradan başlatabilirsin.";

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Hesap Ekle";
  btn.disabled = isUiLocked();
  btn.addEventListener("click", () => {
    if (isUiLocked()) return;
    resetForm();
    showForm("add");
    refs.usernameInput.focus();
  });

  box.append(title, text, btn);
  wrap.appendChild(box);
  refs.accountsList.appendChild(wrap);
}

function updateMultiButton() {
  const hasAccounts = accounts.length > 0;
  const locked = isUiLocked();
  refs.addBtn.style.display = multiMode ? "none" : "inline-flex";
  refs.selectAllBtn.style.display = multiMode ? "inline-flex" : "none";
  refs.multiCancelBtn.style.display = multiMode ? "inline-flex" : "none";
  refs.selectAllBtn.disabled = !multiMode || !hasAccounts || locked;
  refs.multiCancelBtn.disabled = !multiMode || locked;
  refs.multiBtn.disabled = locked || !hasAccounts || (multiMode && selectedForMulti.size === 0);
  refs.selectAllBtn.textContent = selectedForMulti.size === accounts.length && accounts.length > 0 ? "Seçimi Temizle" : "Tümünü Seç";
  refs.multiBtn.textContent = !multiMode ? "Çoklu Oyun" : selectedForMulti.size ? "Seçilenleri Aç (" + selectedForMulti.size + ")" : "Hesap Seç";
  updateRepeatLastSelectionButton();
}

function toggleAccountSelection(accountId) {
  if (!multiMode || isUiLocked()) return;
  if (selectedForMulti.has(accountId)) selectedForMulti.delete(accountId);
  else selectedForMulti.add(accountId);
  renderAccounts();
}

function cancelMultiMode() {
  if (isUiLocked()) return;
  multiMode = false;
  selectedForMulti.clear();
  setStatus("Hazır");
  renderAccounts();
}

function openDeleteConfirm(account) {
  if (isUiLocked()) return;
  pendingDeleteAccount = account;
  refs.confirmText.textContent = "'" + accountLabel(account) + "' hesabı listeden kaldırılacak.";
  refs.confirmOverlay.classList.add("show");
  refs.confirmOverlay.setAttribute("aria-hidden", "false");
  refs.confirmCancelBtn.focus();
}

function closeDeleteConfirm() {
  refs.confirmOverlay.classList.remove("show");
  refs.confirmOverlay.setAttribute("aria-hidden", "true");
  pendingDeleteAccount = null;
}

async function moveAccount(accountId, direction) {
  if (isUiLocked() || multiMode) return;
  setStatus(direction === "up" ? "Hesap yukar\u0131 ta\u015f\u0131n\u0131yor" : "Hesap a\u015fa\u011f\u0131 ta\u015f\u0131n\u0131yor");
  try {
    accounts = await ipcRenderer.invoke("accounts:move", accountId, direction);
    renderAccounts();
    setStatus("S\u0131ra g\u00fcncellendi");
  } catch (error) {
    setStatus(error && error.message ? error.message : "S\u0131ra de\u011fi\u015ftirilemedi");
  }
}

async function confirmDeleteAccount() {
  if (isUiLocked()) return;
  if (!pendingDeleteAccount) return;
  const account = pendingDeleteAccount;
  refs.confirmDeleteBtn.disabled = true;
  refs.confirmCancelBtn.disabled = true;
  try {
    await ipcRenderer.invoke("accounts:delete", account.id);
    selectedForMulti.delete(account.id);
    const remainingLastSelection = getLastSelectedAccounts().filter(item => accountIdOf(item) !== accountIdOf(account));
    writeLastSelection(remainingLastSelection);
    if (editingAccountId === account.id) resetForm();
    closeDeleteConfirm();
    await loadAccounts();
  } finally {
    refs.confirmDeleteBtn.disabled = false;
    refs.confirmCancelBtn.disabled = false;
  }
}

function createAccountRow(account, index) {
  const locked = isUiLocked();
  const row = document.createElement("div");
  row.className = "account-item";
  row.classList.toggle("is-selectable", multiMode && !locked);
  row.classList.toggle("locked", locked);
  row.classList.toggle("selected", selectedForMulti.has(account.id));

  const selectWrap = document.createElement("button");
  selectWrap.type = "button";
  selectWrap.className = "select-box";
  selectWrap.style.display = multiMode ? "flex" : "none";
  selectWrap.setAttribute("aria-label", "Hesabı seç");
  selectWrap.setAttribute("aria-pressed", selectedForMulti.has(account.id) ? "true" : "false");
  selectWrap.disabled = locked;
  const marker = document.createElement("span");
  marker.className = "select-dot";
  selectWrap.addEventListener("click", event => {
    event.stopPropagation();
    toggleAccountSelection(account.id);
  });
  selectWrap.appendChild(marker);

  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "account-name";
  name.textContent = accountLabel(account);
  const user = document.createElement("div");
  user.className = "account-user";
  user.textContent = String(account.username || "");
  info.append(name, user);

  const orderControls = document.createElement("div");
  orderControls.className = "account-order";
  orderControls.style.display = multiMode ? "none" : "flex";

  const moveUpBtn = document.createElement("button");
  moveUpBtn.type = "button";
  moveUpBtn.className = "btn btn-secondary btn-compact order-btn";
  moveUpBtn.textContent = "\u2191";
  moveUpBtn.title = "Yukar\u0131 ta\u015f\u0131";
  moveUpBtn.setAttribute("aria-label", "Hesab\u0131 yukar\u0131 ta\u015f\u0131");
  moveUpBtn.disabled = index <= 0 || locked;
  moveUpBtn.addEventListener("click", event => {
    event.stopPropagation();
    moveAccount(account.id, "up");
  });

  const moveDownBtn = document.createElement("button");
  moveDownBtn.type = "button";
  moveDownBtn.className = "btn btn-secondary btn-compact order-btn";
  moveDownBtn.textContent = "\u2193";
  moveDownBtn.title = "A\u015fa\u011f\u0131 ta\u015f\u0131";
  moveDownBtn.setAttribute("aria-label", "Hesab\u0131 a\u015fa\u011f\u0131 ta\u015f\u0131");
  moveDownBtn.disabled = index >= accounts.length - 1 || locked;
  moveDownBtn.addEventListener("click", event => {
    event.stopPropagation();
    moveAccount(account.id, "down");
  });

  orderControls.append(moveUpBtn, moveDownBtn);

  const actions = document.createElement("div");
  actions.className = "account-actions";
  actions.style.display = multiMode ? "none" : "flex";

  const loginBtn = document.createElement("button");
  loginBtn.className = "btn btn-primary";
  loginBtn.textContent = "Giriş";
  loginBtn.disabled = locked;
  loginBtn.addEventListener("click", () => {
    if (isUiLocked()) return;
    openSelectedAccounts([account], "Oyun açılıyor");
  });

  const editBtn = document.createElement("button");
  editBtn.className = "btn btn-secondary";
  editBtn.textContent = "Düzenle";
  editBtn.disabled = locked;
  editBtn.addEventListener("click", () => {
    if (isUiLocked()) return;
    multiMode = false;
    selectedForMulti.clear();
    fillForm(account);
    showForm("edit");
    renderAccounts();
    refs.usernameInput.focus();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "Sil";
  deleteBtn.disabled = locked;
  deleteBtn.addEventListener("click", () => openDeleteConfirm(account));

  actions.append(loginBtn, editBtn, deleteBtn);

  const runtime = document.createElement("div");
  runtime.className = "runtime-wrap";
  const runtimeState = runtimeForAccount(account);
  const status = document.createElement("span");
  status.className = "status-pill " + String(runtimeState.status || "idle");
  status.textContent = RUNTIME_LABELS[runtimeState.status] || "Pasif";
  runtime.appendChild(status);

  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.className = "btn btn-secondary btn-compact";
  stopBtn.textContent = "Durdur";
  stopBtn.style.display = runtimeState.status === "loading" || runtimeState.status === "active" ? "inline-flex" : "none";
  stopBtn.disabled = locked;
  stopBtn.addEventListener("click", event => {
    event.stopPropagation();
    if (isUiLocked()) return;
    ipcRenderer.send("account-stop", account.id);
  });
  runtime.appendChild(stopBtn);

  row.append(selectWrap, info, orderControls, actions, runtime);
  row.addEventListener("click", event => {
    if (!multiMode || isUiLocked()) return;
    if (event.target.closest("button")) return;
    toggleAccountSelection(account.id);
  });
  return row;
}

function renderAccounts() {
  applyLayout();
  updateMultiButton();

  if (!accounts.length) {
    createEmptyState();
    return;
  }

  refs.accountsList.innerHTML = "";
  refs.accountsList.classList.toggle("multi-mode", multiMode);
  accounts.forEach((account, index) => refs.accountsList.appendChild(createAccountRow(account, index)));
}

function createScriptRow(item) {
  const row = document.createElement("div");
  row.className = "script-row";

  const text = document.createElement("div");
  const title = document.createElement("div");
  title.className = "script-name";
  title.textContent = item.name;
  const desc = document.createElement("div");
  desc.className = "script-desc";
  desc.textContent = item.desc;
  text.append(title, desc);

  const toggle = document.createElement("label");
  toggle.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = scriptSettings[item.key] !== false;
  input.disabled = isUiLocked();
  const slider = document.createElement("span");
  slider.className = "slider";
  toggle.append(input, slider);

  input.addEventListener("change", async () => {
    if (isUiLocked()) {
      input.checked = scriptSettings[item.key] !== false;
      return;
    }
    scriptSettings[item.key] = input.checked;
    scriptSettings = await ipcRenderer.invoke("scripts:set-settings", scriptSettings);
  });

  row.append(text, toggle);
  return row;
}

function renderScripts() {
  refs.scriptsList.innerHTML = "";
  if (!scriptItems.length) {
    const empty = document.createElement("div");
    empty.className = "script-desc";
    empty.textContent = "Script modülü bulunamadı. Önce build çalıştırılmalı.";
    refs.scriptsList.appendChild(empty);
    return;
  }
  scriptItems.forEach(item => refs.scriptsList.appendChild(createScriptRow(item)));
  applyScriptLockState();
}

async function loadAccounts() {
  accounts = await ipcRenderer.invoke("accounts:list");
  if (!accounts.length) {
    formVisible = true;
    resetForm();
  } else if (formMode === "add" && editingAccountId == null) {
    formVisible = false;
  }
  renderAccounts();
  setStatus("Hazır");
}

refs.addBtn.addEventListener("click", () => {
  if (isUiLocked()) return;
  multiMode = false;
  selectedForMulti.clear();
  resetForm();
  showForm("add");
  renderAccounts();
  refs.usernameInput.focus();
});

refs.multiBtn.addEventListener("click", () => {
  if (isUiLocked()) return;
  if (!multiMode) {
    multiMode = true;
    selectedForMulti.clear();
    renderAccounts();
    setStatus("Hesap seç");
    return;
  }

  const selectedAccounts = accounts.filter(account => selectedForMulti.has(account.id));
  if (!selectedAccounts.length) return;
  openSelectedAccounts(selectedAccounts, "Çoklu oyun açılıyor");
  multiMode = false;
  selectedForMulti.clear();
  renderAccounts();
});

refs.repeatLastSelectionBtn.addEventListener("click", () => {
  if (isUiLocked()) return;
  const selectedAccounts = getLastSelectedAccounts();
  if (!selectedAccounts.length) {
    updateRepeatLastSelectionButton();
    setStatus("Son seçim bulunamadı");
    return;
  }
  multiMode = false;
  selectedForMulti.clear();
  renderAccounts();
  openSelectedAccounts(selectedAccounts, selectedAccounts.length > 1 ? "Son seçilenler açılıyor" : "Son seçilen açılıyor");
});

refs.selectAllBtn.addEventListener("click", () => {
  if (!multiMode || isUiLocked()) return;
  if (selectedForMulti.size === accounts.length) selectedForMulti.clear();
  else selectedForMulti = new Set(accounts.map(account => account.id));
  renderAccounts();
});

refs.multiCancelBtn.addEventListener("click", cancelMultiMode);
refs.confirmCancelBtn.addEventListener("click", closeDeleteConfirm);
refs.confirmDeleteBtn.addEventListener("click", confirmDeleteAccount);
refs.confirmOverlay.addEventListener("click", event => {
  if (event.target === refs.confirmOverlay) closeDeleteConfirm();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && refs.confirmOverlay.classList.contains("show")) closeDeleteConfirm();
});

refs.saveBtn.addEventListener("click", async () => {
  if (isUiLocked()) return;
  hideFormError();

  const label = refs.labelInput.value.trim();
  const username = refs.usernameInput.value.trim();
  const password = refs.passwordInput.value;

  if (!username || !password) {
    showFormError("E-posta/telefon ve şifre zorunludur.");
    refs.usernameInput.focus();
    return;
  }

  setSavingState(true);
  try {
    if (editingAccountId) await ipcRenderer.invoke("accounts:update", editingAccountId, { label, username, password });
    else await ipcRenderer.invoke("accounts:add", { label, username, password });

    resetForm();
    await loadAccounts();
    if (accounts.length) hideForm();
    renderAccounts();
  } catch (error) {
    showFormError(error && error.message ? error.message : "İşlem sırasında hata oluştu.");
  } finally {
    setSavingState(false);
    updateMultiButton();
  }
});

refs.cancelBtn.addEventListener("click", () => {
  if (isUiLocked()) return;
  resetForm();
  if (accounts.length) hideForm();
  multiMode = false;
  selectedForMulti.clear();
  renderAccounts();
});

refs.eyeBtn.addEventListener("click", () => {
  if (isUiLocked()) return;
  const visible = refs.passwordInput.type === "password";
  refs.passwordInput.type = visible ? "text" : "password";
  refs.eyeBtn.classList.toggle("on", visible);
});

async function bootstrap() {
  log("bootstrap start");
  scriptItems = await ipcRenderer.invoke("scripts:list");
  scriptSettings = await ipcRenderer.invoke("scripts:get-settings");
  lastSelectionIds = await ipcRenderer.invoke("accounts:last-selection:get");
  if (!Array.isArray(lastSelectionIds)) lastSelectionIds = [];
  applyRuntimeSnapshot(await ipcRenderer.invoke("runtime:snapshot"));
  renderScripts();
  resetForm();
  await loadAccounts();
  log("bootstrap ready");
}

ipcRenderer.on("account-runtime-update", (_event, update) => applyRuntimeUpdate(update));
ipcRenderer.on("account-runtime-snapshot", (_event, snapshot) => applyRuntimeSnapshot(snapshot));
ipcRenderer.on("account-launch-failed", (_event, payload) => {
  setLaunchState(false);
  setStatus(payload && payload.message ? payload.message : "Oyun açılamadı");
});

bootstrap();
`;
}

module.exports = {
  buildAccountsRenderer
};
