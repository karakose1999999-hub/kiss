const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { normalizeAccount } = require("../types/accountModel");

const LOG_PREFIX = "[NewStore:Accounts]";

function log(message, meta) {
  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`, meta);
}

function getStorePath() {
  return path.join(app.getPath("userData"), "accounts.json");
}

function legacyStorePaths() {
  const base = path.dirname(app.getPath("userData"));
  return [
    path.join(base, "getkiss-app", "accounts.json"),
    path.join(base, "getkiss-yeni", "accounts.json")
  ];
}

function ensureStoreFile() {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(filePath)) {
    const legacyPath = legacyStorePaths().find((candidate) => fs.existsSync(candidate));
    if (legacyPath) {
      fs.copyFileSync(legacyPath, filePath);
      log("migrated accounts", legacyPath);
    } else {
      fs.writeFileSync(filePath, "[]", "utf8");
      log("created accounts.json");
    }
  }

  return filePath;
}

function readAccounts() {
  try {
    const filePath = ensureStoreFile();
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const list = Array.isArray(parsed) ? parsed : [];
    log("read", list.length);
    return list;
  } catch (error) {
    log("read failed", error && error.message ? error.message : error);
    return [];
  }
}

function writeAccounts(accounts) {
  const filePath = ensureStoreFile();
  const safe = Array.isArray(accounts) ? accounts : [];
  fs.writeFileSync(filePath, JSON.stringify(safe, null, 2), "utf8");
  log("write", safe.length);
  return safe;
}

function listAccounts() {
  return readAccounts();
}

function addAccount(payload) {
  const accounts = readAccounts();
  const normalized = normalizeAccount(payload);
  accounts.push(normalized);
  writeAccounts(accounts);
  log("add", normalized.id);
  return normalized;
}

function updateAccount(id, payload) {
  const accountId = String(id || "");
  if (!accountId) throw new Error("Geçerli bir hesap id gerekli.");

  const accounts = readAccounts();
  const index = accounts.findIndex((account) => String(account.id) === accountId);
  if (index === -1) throw new Error("Hesap bulunamadı.");

  const updated = normalizeAccount(payload, accounts[index]);
  accounts[index] = updated;
  writeAccounts(accounts);
  log("update", accountId);
  return updated;
}

function deleteAccount(id) {
  const accountId = String(id || "");
  const accounts = readAccounts();
  const next = accounts.filter((account) => String(account.id) !== accountId);
  writeAccounts(next);
  log("delete", accountId);
  return { ok: true };
}

function moveAccount(id, direction) {
  const accountId = String(id || "");
  const moveDirection = String(direction || "");
  if (!accountId) throw new Error("Ge?erli bir hesap id gerekli.");

  const accounts = readAccounts();
  const index = accounts.findIndex((account) => String(account.id) === accountId);
  if (index === -1) throw new Error("Hesap bulunamad?.");

  const targetIndex = moveDirection === "up" ? index - 1 : moveDirection === "down" ? index + 1 : index;
  if (targetIndex < 0 || targetIndex >= accounts.length || targetIndex === index) return accounts;

  const next = accounts.slice();
  const current = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = current;
  writeAccounts(next);
  log("move", { id: accountId, direction: moveDirection, index: targetIndex });
  return next;
}

module.exports = {
  listAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  moveAccount
};
