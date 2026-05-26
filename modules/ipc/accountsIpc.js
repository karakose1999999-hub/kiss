const { ipcMain } = require("electron");
const {
  listAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  moveAccount
} = require("../store/accountsStore");
const {
  readScriptSettings,
  writeScriptSettings
} = require("../store/scriptSettingsStore");
const {
  readLastSelectionIds,
  writeLastSelectionIds,
  removeLastSelectionAccount
} = require("../store/accountsUiStateStore");
const { listScriptItems } = require("../store/scriptCatalog");
const {
  setAccountScriptSetting,
  removeAccountScriptSetting,
  deleteAccountScriptSettings
} = require("../store/accountScriptSettingsStore");
const diagnosticLogger = require("../diagnosticLogger");

const LOG_PREFIX = "[NewIPC]";

function log(message, meta) {
  if (!diagnosticLogger.isEnabled()) return;
  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`, meta);
}

function registerAccountsIpc(options = {}) {
  log("register account handlers");

  ipcMain.handle("accounts:list", () => {
    log("accounts:list");
    return listAccounts();
  });

  ipcMain.handle("accounts:add", (_event, account) => {
    log("accounts:add");
    return addAccount(account);
  });

  ipcMain.handle("accounts:update", (_event, id, account) => {
    log("accounts:update", id);
    return updateAccount(id, account);
  });

  ipcMain.handle("accounts:delete", (_event, id) => {
    log("accounts:delete", id);
    const result = deleteAccount(id);
    deleteAccountScriptSettings(id);
    removeLastSelectionAccount(id);
    return result;
  });

  ipcMain.handle("accounts:move", (_event, id, direction) => {
    log("accounts:move", { id, direction });
    return moveAccount(id, direction);
  });

  ipcMain.handle("accounts:last-selection:get", () => {
    log("accounts:last-selection:get");
    return readLastSelectionIds();
  });

  ipcMain.handle("accounts:last-selection:set", (_event, ids) => {
    log("accounts:last-selection:set", Array.isArray(ids) ? ids.length : 0);
    return writeLastSelectionIds(ids);
  });

  ipcMain.handle("scripts:get-settings", () => {
    log("scripts:get-settings");
    return readScriptSettings();
  });

  ipcMain.handle("scripts:list", () => {
    log("scripts:list");
    return listScriptItems();
  });

  ipcMain.handle("scripts:set-settings", (_event, payload) => {
    log("scripts:set-settings");
    const settings = writeScriptSettings(payload);
    diagnosticLogger.setEnabled(!!settings.diagnosticLog, "scripts:set-settings");
    if (typeof options.onScriptSettingsChanged === "function") {
      options.onScriptSettingsChanged(settings);
    }
    return settings;
  });

  ipcMain.on("account-script-setting-changed", (_event, payload) => {
    const accountId = payload && payload.accountId;
    const key = payload && payload.key;
    const action = payload && payload.action;

    if (action === "remove") {
      removeAccountScriptSetting(accountId, key);
      return;
    }

    setAccountScriptSetting(accountId, key, payload && payload.value);
  });

  ipcMain.handle("runtime:snapshot", () => {
    log("runtime:snapshot");
    if (typeof options.getRuntimeSnapshot === "function") {
      return options.getRuntimeSnapshot() || [];
    }
    return [];
  });
}

module.exports = {
  registerAccountsIpc
};

