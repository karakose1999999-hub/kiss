const { app, ipcMain, powerSaveBlocker } = require("electron");
const { createAccountsWindow } = require("./modules/windows/accountsWindow");
const { registerAccountsIpc } = require("./modules/ipc/accountsIpc");
const { registerMainWindowIpcEvents } = require("./modules/events/mainWindowEvents");
const { accountId } = require("./modules/game/partition");
const { applyMaintenanceFullMode } = require("./modules/runtime/maintenanceFullMode");
const { readMaintenanceRelaunch, writeMaintenanceRelaunch } = require("./modules/runtime/maintenanceRelaunchStore");
const { readScriptSettings } = require("./modules/store/scriptSettingsStore");
const { listAccounts } = require("./modules/store/accountsStore");
const { createGameRuntime } = require("./modules/runtime/gameRuntime");
const diagnosticLogger = require("./modules/diagnosticLogger");

const LOG_PREFIX = "[NewMain]";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
diagnosticLogger.installConsoleCapture();
diagnosticLogger.attachApp(app);

let accountsWindow = null;
let gameRuntime = null;
let powerSaveBlockerId = null;
let maintenanceRelaunchInFlight = false;

function log(message, meta) {
  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, meta);
}

function createAppWindow() {
  log("creating accounts window");

  accountsWindow = createAccountsWindow();

  accountsWindow.on("closed", () => {
    log("accounts window closed");
    accountsWindow = null;
  });
}

function restoreMaintenanceSession(runtime) {
  const marker = readMaintenanceRelaunch();
  if (!marker || !runtime) return;

  const wantedIds = Array.from(new Set(
    (Array.isArray(marker.accountIds) ? marker.accountIds : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  ));

  if (!wantedIds.length) {
    log("maintenance restore skipped: missing account ids", marker);
    return;
  }

  const allAccounts = listAccounts();
  const selected = wantedIds
    .map(id => allAccounts.find(account => accountId(account) === id))
    .filter(Boolean);

  if (!selected.length) {
    log("maintenance restore skipped: accounts not found", { wantedIds });
    return;
  }

  log("maintenance restore scheduled", {
    mode: marker.mode,
    count: selected.length,
    accountIds: selected.map(accountId)
  });

  diagnosticLogger.push("info", "maintenance", "maintenance restore scheduled", {
    mode: marker.mode,
    accountIds: selected.map(accountId),
    requestedAt: marker.requestedAt,
    restoredAt: Date.now()
  }, { force: true });
  diagnosticLogger.flushLive("maintenance-restore-scheduled");

  setTimeout(() => {
    const flow = marker.mode === "single" && selected.length === 1
      ? runtime.openSingle(selected[0], { preserveSession: true })
      : runtime.openBulk(selected);

    flow
      .then(() => applyMaintenanceFullMode({
        marker,
        getWindow: () => accountsWindow,
        log,
        diagnosticLogger
      }))
      .catch(error => {
        log("maintenance restore failed", error && error.message ? error.message : error);
        diagnosticLogger.push("error", "maintenance", "maintenance restore failed", {
          error: error && error.message ? error.message : String(error || "")
        }, { force: true });
        diagnosticLogger.flushLive("maintenance-restore-failed");
      });
  }, 1200);
}

function registerRuntimeIpc(runtime) {
  function notifyLaunchFailed(event, error) {
    const message = error && error.message ? error.message : String(error || "Oyun açılamadı");
    try {
      if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send("account-launch-failed", { message });
      }
    } catch (_) {}
  }

  ipcMain.on("account-selected", (event, account) => {
    log("single selected", account && account.username);

    runtime.openSingle(account).catch(error => {
      log("single flow error", error && error.message ? error.message : error);
      notifyLaunchFailed(event, error);
    });
  });

  ipcMain.on("accounts-multi-selected", (event, accounts) => {
    log("multi selected", Array.isArray(accounts) ? accounts.length : 0);

    runtime.openBulk(accounts).catch(error => {
      log("multi flow error", error && error.message ? error.message : error);
      notifyLaunchFailed(event, error);
    });
  });

  ipcMain.on("accounts-selected-bulk", (event, accounts) => {
    log("bulk selected", Array.isArray(accounts) ? accounts.length : 0);

    runtime.openBulk(accounts).catch(error => {
      log("bulk flow error", error && error.message ? error.message : error);
      notifyLaunchFailed(event, error);
    });
  });

  ipcMain.on("account-stop", (_event, accountId) => {
    log("account-stop", accountId);
    runtime.stopAccount(accountId);
  });

  ipcMain.on("runtime-slot-status", (_event, payload) => {
    diagnosticLogger.push("info", "runtime-slot-status", "runtime-slot-status", payload);
    runtime.handleSlotStatus(payload);
  });

  ipcMain.handle("kiss-fallback-answer", (_event, payload) => {
    return runtime.sendKissFallbackAnswer(payload);
  });

  ipcMain.on("kiss-fallback-global-room", (_event, payload) => {
    if (typeof runtime.rememberGlobalKissRoom === "function") {
      runtime.rememberGlobalKissRoom(payload);
    }
  });

  ipcMain.on("kiss-fallback-global-auto", (_event, payload) => {
    if (typeof runtime.rememberGlobalAutoKiss === "function") {
      runtime.rememberGlobalAutoKiss(payload);
    }
  });

  ipcMain.on("maintenance-host-toggle", (_event, payload) => {
    if (typeof runtime.setGlobalKissFallbackEnabled === "function") {
      runtime.setGlobalKissFallbackEnabled(!!(payload && payload.enabled));
    }
  });

  ipcMain.on("maintenance-relaunch", (_event, payload) => {
    if (maintenanceRelaunchInFlight) return;

    const session = typeof runtime.getCurrentSession === "function"
      ? runtime.getCurrentSession()
      : { mode: "multi", accountIds: [] };
    const payloadIds = payload && Array.isArray(payload.accountIds) ? payload.accountIds : [];
    const accountIds = Array.from(new Set(
      (payloadIds.length ? payloadIds : session.accountIds || [])
        .map(value => String(value || "").trim())
        .filter(Boolean)
    ));

    if (!accountIds.length) {
      log("maintenance relaunch skipped: missing account ids");
      diagnosticLogger.push("warn", "maintenance", "maintenance relaunch skipped", {
        reason: "missing-account-ids",
        payload
      }, { force: true });
      diagnosticLogger.flushLive("maintenance-relaunch-skipped");
      return;
    }

    maintenanceRelaunchInFlight = true;

    const marker = {
      reason: payload && payload.reason ? String(payload.reason) : "performance-maintenance",
      mode: payload && payload.mode ? String(payload.mode) : session.mode,
      accountIds,
      partitions: session.partitions || [],
      startFullMode: true,
      requestedAt: Date.now()
    };

    log("maintenance relaunch", marker);
    diagnosticLogger.push("warn", "maintenance", "maintenance relaunch", marker, { force: true });
    try {
      writeMaintenanceRelaunch(marker);
      diagnosticLogger.flush("maintenance-relaunch");
    } catch (error) {
      log("maintenance relaunch marker failed", error && error.message ? error.message : error);
      diagnosticLogger.push("error", "maintenance", "maintenance relaunch marker failed", {
        error: error && error.message ? error.message : String(error || "")
      }, { force: true });
      diagnosticLogger.flush("maintenance-relaunch-marker-failed");
      maintenanceRelaunchInFlight = false;
      return;
    }

    app.relaunch();
    app.exit(0);
  });

  ipcMain.on("return-to-accounts", () => {
    runtime.returnToAccounts();
  });

  ipcMain.on("switch-account", (_event, account) => {
    log("switch-account", account && account.username);

    runtime.openSingle(account, { preserveSession: false }).catch(error => {
      log("switch-account flow error", error && error.message ? error.message : error);
    });
  });
}

app.setName("getkiss-new");

app.whenReady().then(() => {
  const initialScriptSettings = readScriptSettings();
  diagnosticLogger.setEnabled(!!initialScriptSettings.diagnosticLog, "app-ready-settings");
  log("ready");
  try {
    powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    log("powerSaveBlocker started", { id: powerSaveBlockerId });
  } catch (error) {
    log("powerSaveBlocker failed", error && error.message ? error.message : error);
  }
  diagnosticLogger.push("info", "app", "diagnostic app ready", {
    appPath: app.getAppPath(),
    appName: app.getName(),
    appVersion: app.getVersion(),
    userData: app.getPath("userData"),
    cwd: process.cwd(),
    pid: process.pid
  }, { force: true });
  diagnosticLogger.flushLive("app-ready");

  gameRuntime = createGameRuntime({
    getAccountsWindow: () => accountsWindow,
    readScriptSettings
  });

  registerAccountsIpc({
    getRuntimeSnapshot: () => gameRuntime.getRuntimeSnapshot(),
    onScriptSettingsChanged: settings => {
      if (gameRuntime && typeof gameRuntime.setGlobalKissFallbackEnabled === "function") {
        gameRuntime.setGlobalKissFallbackEnabled(!!(settings && settings.maintenanceHost));
      }
    }
  });

  registerMainWindowIpcEvents(ipcMain, {
    getCurrentPartition: () => gameRuntime.getCurrentPartition(),
    clearHistory: () => gameRuntime.clearHistory()
  });

  registerRuntimeIpc(gameRuntime);
  createAppWindow();
  restoreMaintenanceSession(gameRuntime);

  app.on("activate", () => {
    if (!accountsWindow) createAppWindow();
  });
});

app.on("window-all-closed", () => {
  log("window-all-closed");
  diagnosticLogger.flush("window-all-closed");

  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    try {
      powerSaveBlocker.stop(powerSaveBlockerId);
      log("powerSaveBlocker stopped", { id: powerSaveBlockerId });
    } catch (_) {}
  }
  powerSaveBlockerId = null;
});
