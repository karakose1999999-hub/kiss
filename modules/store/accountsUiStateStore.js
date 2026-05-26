const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function getStorePath() {
  return path.join(app.getPath("userData"), "accounts-ui-state.json");
}

function ensureStoreFile() {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ lastSelectionIds: [] }, null, 2), "utf8");
  }
  return filePath;
}

function normalizeIds(ids) {
  const seen = new Set();
  const out = [];
  (Array.isArray(ids) ? ids : []).forEach(value => {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function readState() {
  try {
    const filePath = ensureStoreFile();
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      lastSelectionIds: normalizeIds(parsed && parsed.lastSelectionIds)
    };
  } catch (_) {
    return { lastSelectionIds: [] };
  }
}

function writeState(state) {
  const filePath = ensureStoreFile();
  const next = {
    lastSelectionIds: normalizeIds(state && state.lastSelectionIds)
  };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function readLastSelectionIds() {
  return readState().lastSelectionIds;
}

function writeLastSelectionIds(ids) {
  return writeState({ lastSelectionIds: ids }).lastSelectionIds;
}

function removeLastSelectionAccount(accountId) {
  const id = String(accountId || "").trim();
  if (!id) return readLastSelectionIds();
  return writeLastSelectionIds(readLastSelectionIds().filter(item => item !== id));
}

module.exports = {
  readLastSelectionIds,
  writeLastSelectionIds,
  removeLastSelectionAccount
};
