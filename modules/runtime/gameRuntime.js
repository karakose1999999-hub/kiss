const { session } = require("electron");
const { loadScripts } = require("../scriptLoader");
const { generateHTML } = require("../ui/htmlTemplate");
const { loginAccountWithFetch } = require("../game/fetchLogin");
const { accountId, accountLabel, partitionForAccount } = require("../game/partition");
const { settleLoginSession, clearPartition, getCookieNames } = require("../game/sessionTools");
const { renderAccountsScreen, renderGameScreen } = require("../windows/accountsWindow");
const { readAccountScriptSettings } = require("../store/accountScriptSettingsStore");
const diagnosticLogger = require("../diagnosticLogger");
const { createGameEntryBuilder } = require("./gameEntryBuilder");
const { createKissFallbackHost } = require("./kissFallbackHost");
const { createKissFallbackService } = require("./kissFallbackService");
const { createRoomIdentityStore } = require("./roomIdentityStore");
const { createDefaultSlotHealth, computeSlotHealth } = require("./slotHealth");
const { moduleSettingsFromEnabled } = require("./moduleSettings");
const {
  KISS_ANSWER_URL,
  MAX_MULTI_ACCOUNTS,
  createGameRuntimeState
} = require("./gameRuntimeState");

const LOG_PREFIX = "[GameRuntime]";

function log(message, meta) {
  const text = String(message || "");
  const routineFallbackSummary = text.includes("[KISS FALLBACK HOST] summary") ||
    text.includes("[KISS FALLBACK GLOBAL] summary");
  if (routineFallbackSummary && !diagnosticLogger.isEnabled()) return;

  const critical = text.includes("failed") ||
    text.includes("error") ||
    text.includes("[KISS FALLBACK HOST]") ||
    text.includes("[KISS FALLBACK GLOBAL]");
  if (!critical && !diagnosticLogger.isEnabled()) return;

  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, meta);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeRoomId(value) {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) ? text : "";
}

function createGameRuntime({ getAccountsWindow, readScriptSettings }) {
  const state = createGameRuntimeState();
  let currentAccount = state.currentAccount;
  let currentEntries = state.currentEntries;
  let currentPartitions = state.currentPartitions;
  const runtimeStatuses = state.runtimeStatuses;
  const slotHealth = state.slotHealth;
  const kissFallbackHostStats = state.kissFallbackHostStats;
  const roomIdentityStore = createRoomIdentityStore({ log, diagnosticLogger });
  const globalKissFallback = createKissFallbackService({
    log,
    rememberRoomIdentity: roomIdentityStore.remember
  });
  let lastHealthSnapshotAt = 0;
  const healthTimer = setInterval(() => {
    try {
      let changed = false;
      currentEntries.forEach(entry => {
        const id = String(entry && entry.accountId || "");
        if (!id) return;
        const previous = slotHealth.get(id);
        if (!previous || previous.stopped || previous.destroyed) return;
        const before = previous.health;
        const next = updateSlotHealth(id, {
          status: previous.status || "active",
          message: previous.message || ""
        });
        if (next && before !== next.health) changed = true;
      });
      const now = Date.now();
      if (changed || now - lastHealthSnapshotAt >= 2 * 60 * 1000) {
        lastHealthSnapshotAt = now;
        sendRuntimeSnapshot();
      }
    } catch (_) {}
  }, 30000);
  if (healthTimer && typeof healthTimer.unref === "function") healthTimer.unref();

  function getWindow() {
    return typeof getAccountsWindow === "function" ? getAccountsWindow() : null;
  }

  function send(channel, payload) {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  }

  function updateSlotHealth(accountIdValue, patch = {}) {
    const id = String(accountIdValue || "");
    if (!id) return null;

    const now = Date.now();
    const previous = slotHealth.get(id) || createDefaultSlotHealth(id, now);

    const next = Object.assign({}, previous, patch, {
      accountId: id,
      updatedAt: now
    });
    next.health = computeSlotHealth(next, next.status, now);
    slotHealth.set(id, next);

    if (previous.health && previous.health !== next.health) {
      diagnosticLogger.push("info", "slot-health", "slot-health-change", {
        accountId: id,
        from: previous.health,
        to: next.health,
        status: next.status,
        message: next.message,
        roomId: next.lastRoomId
      }, { force: true });
    }

    return next;
  }

  function setAccountStatus(accountIdValue, status, message, extra = {}) {
    const id = String(accountIdValue || "");
    if (!id) return null;
    const health = updateSlotHealth(id, Object.assign({}, extra, {
      status,
      message: String(message || "")
    }));

    const payload = {
      accountId: id,
      status,
      message: String(message || ""),
      health: health && health.health,
      roomId: health && health.lastRoomId || "",
      lastRoomIdAt: health && health.lastRoomIdAt || 0,
      updatedAt: Date.now()
    };

    runtimeStatuses.set(id, payload);
    send("account-runtime-update", payload);

    log("status", {
      accountId: id,
      status,
      message: payload.message
    });

    return payload;
  }

  function sendRuntimeSnapshot() {
    send("account-runtime-snapshot", getRuntimeSnapshot());
  }

  function getRuntimeSnapshot() {
    return Array.from(runtimeStatuses.values()).map(item => {
      const health = slotHealth.get(String(item.accountId || ""));
      return health ? Object.assign({}, item, {
        health: health.health,
        slotHealth: health,
        roomId: health.lastRoomId || item.roomId || ""
      }) : item;
    });
  }

  function getCurrentSession() {
    return {
      mode: currentEntries.length > 1 ? "multi" : "single",
      accountIds: currentEntries.map(entry => String(entry.accountId || "")).filter(Boolean),
      partitions: currentPartitions.slice(),
      at: Date.now()
    };
  }

  function moduleSettingsForWindow() {
    const enabled = typeof readScriptSettings === "function"
      ? readScriptSettings()
      : {};

    return moduleSettingsFromEnabled(enabled);
  }

  function setCurrentEntries(entries) {
    currentEntries = entries;
    currentPartitions = entries.map(entry => entry.partition);
    entries.forEach(entry => {
      updateSlotHealth(entry.accountId, {
        partition: entry.partition,
        status: entry.loginOk ? "loading" : "login-lost",
        message: entry.loginOk ? "Entry ready" : "Preflight login failed",
        createdAt: Date.now(),
        stopped: false,
        destroyed: false
      });
    });
    globalKissFallback.registerEntries(entries);
  }

  const {
    buildGameHtml,
    prepareGameEntry
  } = createGameEntryBuilder({
    accountId,
    accountLabel,
    delay,
    generateHTML,
    loadScripts,
    log,
    loginAccountWithFetch,
    maxMultiAccounts: MAX_MULTI_ACCOUNTS,
    moduleSettingsForWindow,
    partitionForAccount,
    readAccountScriptSettings,
    settleLoginSession,
    getCookieNames,
    setAccountStatus,
    setCurrentEntries
  });

  async function openSingle(account, options = {}) {
    const win = getWindow();
    if (!win || win.isDestroyed() || !account) return;

    const previousAccountId = currentAccount ? accountId(currentAccount) : "";
    const nextAccountId = accountId(account);
    const accountChanged = !!(previousAccountId && nextAccountId && previousAccountId !== nextAccountId);
    const preserveSession = Object.prototype.hasOwnProperty.call(options, "preserveSession")
      ? !!options.preserveSession
      : !accountChanged;

    currentAccount = account;

    const result = await buildGameHtml([account], {
      ...options,
      preserveSession
    });

    log("open single", {
      account: accountLabel(account),
      preserveSession,
      accountChanged,
      slots: result.entries.length
    });

    renderGameScreen(win, result.html);
  }

  async function openBulk(accounts) {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;

    const list = Array.isArray(accounts) ? accounts.filter(Boolean) : [];

    if (!list.length) {
      log("open bulk skipped: empty");
      return;
    }

    currentAccount = list[0];

    log("open bulk", {
      count: list.length,
      accounts: list.map(accountLabel)
    });

    const result = await buildGameHtml(list, { preserveSession: false });

    renderGameScreen(win, result.html);
  }

  function returnToAccounts() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;

    currentAccount = null;
    currentEntries = [];
    currentPartitions = [];
    slotHealth.clear();
    roomIdentityStore.clear();

    log("return to accounts");
    renderAccountsScreen(win);
    setTimeout(sendRuntimeSnapshot, 250);
  }

  function stopAccount(accountIdValue) {
    const id = String(accountIdValue || "");
    const entry = currentEntries.find(item => String(item.accountId) === id);
    const isCurrent = !!entry;

    diagnosticLogger.push("info", "slot-cleanup", "stop-account-cleanup", {
      accountId: id,
      partition: entry && entry.partition,
      isCurrent,
      at: Date.now()
    }, { force: true });

    if (entry) {
      send("runtime-stop-slot", {
        accountId: id,
        partition: entry.partition,
        reason: "stop-account",
        at: Date.now()
      });
      currentEntries = currentEntries.filter(item => String(item.accountId) !== id);
      currentPartitions = currentEntries.map(item => item.partition);
      globalKissFallback.removePartitions([entry.partition]);
      roomIdentityStore.removeAccount(id);
    }

    updateSlotHealth(id, {
      stopped: true,
      destroyed: !!entry,
      partition: entry && entry.partition || "",
      status: "stopped",
      message: isCurrent ? "Slot stopped" : "Stopped"
    });
    setAccountStatus(id, "stopped", isCurrent ? "Slot stopped" : "Stopped");
    sendRuntimeSnapshot();
  }

  async function clearHistory() {
    const partitions = currentPartitions.length ? currentPartitions.slice() : ["persist:main"];

    log("clear history", {
      partitions
    });
    diagnosticLogger.push("info", "slot-cleanup", "slot-cleanup-start", {
      reason: "clear-history",
      partitions,
      entries: currentEntries.map(entry => entry.accountId)
    }, { force: true });

    send("runtime-stop-all", {
      reason: "clear-history",
      at: Date.now()
    });
    await delay(500);

    const results = await Promise.allSettled(partitions.map(partition => clearPartition(partition)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        log("clear history partition failed", {
          partition: partitions[index],
          error: result.reason && result.reason.message ? result.reason.message : String(result.reason || "")
        });
      }
    });
    globalKissFallback.removePartitions(partitions);
    roomIdentityStore.removePartitions(partitions);
    currentEntries.forEach(entry => {
      setAccountStatus(entry.accountId, "stopped", "History cleared");
    });
    currentEntries = [];
    currentPartitions = [];
    slotHealth.clear();
    diagnosticLogger.push("info", "slot-cleanup", "slot-cleanup-end", {
      reason: "clear-history",
      partitions,
      results: results.map((result, index) => ({
        partition: partitions[index],
        status: result.status,
        error: result.status === "rejected" ? String(result.reason && result.reason.message ? result.reason.message : result.reason || "") : ""
      }))
    }, { force: true });
    returnToAccounts();
  }

  function handleSlotStatus(payload) {
    const id = payload && payload.accountId;
    const status = payload && payload.status;
    const message = payload && payload.message;

    if (!id || !status) return;

    const now = Number(payload.updatedAt || payload.at || Date.now()) || Date.now();
    const patch = {
      status,
      message: String(message || ""),
      partition: payload.partition || (currentEntries.find(entry => String(entry.accountId) === String(id)) || {}).partition || "",
      lastHeartbeatAt: payload.heartbeat ? now : undefined,
      lastNetworkAt: payload.network ? now : undefined,
      lastErrorAt: status === "error" ? now : undefined,
      lastLoadedAt: status === "loaded" ? now : undefined,
      lastInjectedAt: status === "active" || payload.injected ? now : undefined
    };
    const previousHealth = slotHealth.get(String(id)) || {};
    if (payload.reload) patch.reloadCount = Number(previousHealth.reloadCount || 0) + 1;
    if (payload.recovery) patch.recoveryCount = Number(previousHealth.recoveryCount || 0) + 1;
    if (payload.error || status === "error" || status === "crashed") patch.errorCount = Number(previousHealth.errorCount || 0) + 1;
    Object.keys(patch).forEach(key => {
      if (typeof patch[key] === "undefined") delete patch[key];
    });

    if (payload.roomId) {
      const room = roomIdentityStore.remember({
        accountId: id,
        partition: patch.partition,
        roomId: payload.roomId,
        at: now,
        source: payload.source || "slot-status",
        confidence: payload.confidence || "medium",
        href: payload.href
      });
      patch.lastRoomId = room && (room.lastConfirmedRoomId || room.currentRoomId) || String(payload.roomId || "");
      patch.lastRoomIdAt = now;
    }

    if (payload.authUserId) {
      const expected = String(id || "").trim();
      const actual = String(payload.authUserId || "").trim();
      const bothNumeric = /^\d+$/.test(expected) && /^\d+$/.test(actual);
      const mismatch = bothNumeric && expected !== actual;
      diagnosticLogger.push(mismatch ? "warn" : "info", "login-identity", mismatch ? "login-identity-mismatch" : "login-identity-confirmed", {
        accountId: id,
        partition: patch.partition,
        authUserId: actual,
        expectedAccountId: expected,
        source: payload.source || "auth-user-id"
      }, { force: mismatch });
      if (mismatch) {
        patch.lastErrorAt = now;
        patch.errorCount = (slotHealth.get(String(id)) && Number(slotHealth.get(String(id)).errorCount || 0) || 0) + 1;
        patch.status = "login-lost";
        patch.message = "Login identity mismatch";
      }
    }

    if (payload.reload && Number(patch.reloadCount || 0) >= 3) {
      diagnosticLogger.push("warn", "maintenance", "maintenance-relaunch-suggested", {
        accountId: id,
        partition: patch.partition,
        reloadCount: patch.reloadCount,
        reason: "slot-reload-pressure"
      }, { force: true });
    }

    setAccountStatus(id, patch.status || status, patch.message || message, patch);
  }

  function getCurrentPartition() {
    return (
      currentPartitions[0] ||
      (currentAccount ? partitionForAccount(currentAccount) : "persist:main")
    );
  }

  function findCurrentEntry(accountIdValue, partitionValue) {
    const id = String(accountIdValue || "");
    const partition = String(partitionValue || "");
    if (!id || !partition) return null;

    return currentEntries.find(entry => (
      String(entry.accountId || "") === id &&
      String(entry.partition || "") === partition
    )) || null;
  }

  const { sendKissFallbackAnswer } = createKissFallbackHost({
    findCurrentEntry,
    getConfirmedRoomId: roomIdentityStore.getConfirmedRoomId,
    kissAnswerUrl: KISS_ANSWER_URL,
    log,
    normalizeRoomId,
    rememberRoomIdentity: roomIdentityStore.remember,
    session,
    stats: kissFallbackHostStats
  });

  const initialSettings = typeof readScriptSettings === "function"
    ? readScriptSettings()
    : {};
  globalKissFallback.setEnabled(!!initialSettings.maintenanceHost);

  function setGlobalKissFallbackEnabled(value) {
    globalKissFallback.setEnabled(!!value);
  }

  function rememberGlobalKissRoom(payload) {
    const room = roomIdentityStore.remember(Object.assign({}, payload, {
      confidence: payload && payload.confidence || undefined
    }));
    if (room) {
      updateSlotHealth(room.accountId, {
        partition: room.partition,
        lastRoomId: room.lastConfirmedRoomId || room.currentRoomId,
        lastRoomIdAt: room.confirmedAt || room.updatedAt,
        lastNetworkAt: room.updatedAt,
        status: (slotHealth.get(room.accountId) || {}).status || "active"
      });
    }
    return globalKissFallback.rememberRoom(Object.assign({}, payload, {
      roomId: room && (room.lastConfirmedRoomId || room.currentRoomId) || payload && payload.roomId
    }));
  }

  function rememberGlobalAutoKiss(payload) {
    if (payload && payload.roomId) {
      roomIdentityStore.remember(Object.assign({}, payload, {
        source: payload.source || "auto-kiss",
        confidence: "high"
      }));
    }
    return globalKissFallback.rememberAutoKiss(payload);
  }

  return {
    openSingle,
    openBulk,
    returnToAccounts,
    stopAccount,
    prepareGameEntry,
    buildGameHtml,
    clearHistory,
    handleSlotStatus,
    getCurrentPartition,
    sendKissFallbackAnswer,
    setGlobalKissFallbackEnabled,
    rememberGlobalKissRoom,
    rememberGlobalAutoKiss,
    sendRuntimeSnapshot,
    getRuntimeSnapshot,
    getCurrentSession
  };
}

module.exports = {
  createGameRuntime
};




