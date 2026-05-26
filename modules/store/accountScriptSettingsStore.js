const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const LOG_PREFIX = "[NewStore:AccountScripts]";

function log(message, meta) {
  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`, meta);
}

function getStorePath() {
  return path.join(app.getPath("userData"), "account-script-settings.json");
}

function ensureStoreFile() {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "{}", "utf8");
  return filePath;
}

function isAllowedScriptSettingKey(key) {
  const text = String(key || "");
  return (
    text.startsWith("kiss_toolkit_") ||
    text === "moduleManager_enabledModules" ||
    text === "visualCleanerUltimateFixedV9Settings" ||
    text === "msgCleanSettings"
  );
}

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ensureStoreFile(), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    log("read failed", error && error.message ? error.message : error);
    return {};
  }
}

function writeAll(payload) {
  const safe = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  fs.writeFileSync(ensureStoreFile(), JSON.stringify(safe, null, 2), "utf8");
  return safe;
}

function readAccountScriptSettings(accountId) {
  const id = String(accountId || "");
  if (!id) return {};

  const all = readAll();
  const accountSettings = all[id];
  return accountSettings && typeof accountSettings === "object" && !Array.isArray(accountSettings)
    ? accountSettings
    : {};
}

function setAccountScriptSetting(accountId, key, value) {
  const id = String(accountId || "");
  const storageKey = String(key || "");
  if (!id || !isAllowedScriptSettingKey(storageKey)) return false;

  const all = readAll();
  const accountSettings = all[id] && typeof all[id] === "object" && !Array.isArray(all[id])
    ? all[id]
    : {};

  accountSettings[storageKey] = String(value == null ? "" : value);
  all[id] = accountSettings;
  writeAll(all);
  log("set", { accountId: id, key: storageKey });
  return true;
}

function removeAccountScriptSetting(accountId, key) {
  const id = String(accountId || "");
  const storageKey = String(key || "");
  if (!id || !isAllowedScriptSettingKey(storageKey)) return false;

  const all = readAll();
  const accountSettings = all[id];
  if (!accountSettings || typeof accountSettings !== "object" || Array.isArray(accountSettings)) return false;

  delete accountSettings[storageKey];
  if (Object.keys(accountSettings).length) all[id] = accountSettings;
  else delete all[id];
  writeAll(all);
  log("remove", { accountId: id, key: storageKey });
  return true;
}

function deleteAccountScriptSettings(accountId) {
  const id = String(accountId || "");
  if (!id) return false;

  const all = readAll();
  if (!Object.prototype.hasOwnProperty.call(all, id)) return false;

  delete all[id];
  writeAll(all);
  log("delete account", id);
  return true;
}

module.exports = {
  isAllowedScriptSettingKey,
  readAccountScriptSettings,
  setAccountScriptSetting,
  removeAccountScriptSetting,
  deleteAccountScriptSettings
};
