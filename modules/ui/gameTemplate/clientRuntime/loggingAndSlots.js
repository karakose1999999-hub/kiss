const source = String.raw`const LOG_PREFIX = "[GameTemplate]";

let focusedSlotIndex = null;
let isMiniMode = false;
let activeFocusCycle = false;
let activeFocusTimer = null;
let activeFocusIndex = -1;
let diagnosticLogEnabled = !!(options.moduleSettings && options.moduleSettings.diagnosticLog);
const ACTIVE_FOCUS_INTERVAL = 30000;
const TOOLKIT_WATCHDOG_INTERVAL = 5000;
const TOOLKIT_RECOVERY_MIN_INTERVAL = 4500;
const KISS_FALLBACK_INTERVAL = 1000;
const KISS_FALLBACK_MIN_ACTION_INTERVAL = 2500;
const KISS_ROOM_ID_MAX_AGE = 3 * 60 * 1000;
const KISS_AUTO_RESPONSE_MAX_AGE = 5000;
const WITNESS_ROSTER_MAX_AGE = 90000;
const WITNESS_DISPLACEMENT_LOG_COOLDOWN = 20000;
const SUSPICIOUS_ROUTE_RECOVERY_COOLDOWN = 30000;
const CLEAN_GAME_ROOM_URL = "https://getkisskiss.com/game/room?";

const slotState = new Map();
const userSlotMap = new Map();

function setDiagnosticLogEnabled(value, reason) {
  diagnosticLogEnabled = !!value;
  options.moduleSettings = options.moduleSettings || {};
  options.moduleSettings.diagnosticLog = diagnosticLogEnabled;
  try {
    ipcRenderer.invoke("scripts:set-settings", Object.assign({}, options.moduleSettings, {
      diagnosticLog: diagnosticLogEnabled
    })).catch(() => {});
  } catch (_) {}
  log("diagnostic log " + (diagnosticLogEnabled ? "enabled" : "disabled"), { reason: reason || "toggle" });
  updateUI();
}

function isDiagnosticLogEnabled() {
  return !!diagnosticLogEnabled;
}

entries.forEach((entry, index) => {
  slotState.set(index, {
    didStartGameLoad: false,
    didWebviewLogin: false,
    didInjectScripts: false,
    loginReloadStarted: false,
    loginPageActive: false,
    loginActionInFlight: false,
    lastLoginAttemptAt: 0,
    loginAttemptCount: 0,
    injectingScripts: false,
    injectAttempts: 0,
    initialLoadTimer: null,
    domReadyTimer: null,
    loginTimer: null,
    loginRetryTimer: null,
    watchdogStartTimer: null,
    injectTimer: null,
    watchdogTimer: null,
    kissFallbackTimer: null,
    kissFallbackInflight: false,
    lastKissFallbackAt: 0,
    hasSeenTargetUrl: false,
    lastRoomId: "",
    lastRoomIdAt: 0,
    lastRosterSnapshot: {
      roomId: "",
      ownUid: "",
      allUids: [],
      playerUids: [],
      joined: [],
      left: [],
      count: 0,
      at: 0
    },
    rosterHistory: [],
    lastWitnessLogAt: 0,
    lastRecoveryAt: 0,
    suspiciousRouteRecovery: {
      lastRecoveryAt: 0,
      inFlight: false,
      attemptCount: 0,
      beforeUrl: "",
      targetRoomId: ""
    },
    lastToolkitHealthyAt: 0,
    authUserId: "",
    networkWatcherInstalled: false,
    networkWatcherDocumentKey: "",
    stopped: false
  });
});

function log(message, meta) {
  const text = String(message || "");
  const critical = (
    text.includes("failed") ||
    text.includes("error") ||
    text.includes("did-fail-load") ||
    text.includes("suspicious") ||
    text.includes("recovery") ||
    text.includes("login")
  );
  if (!critical && !isDiagnosticLogEnabled()) return;

  if (typeof meta === "undefined") {
    console.log(LOG_PREFIX + " " + message);
    return;
  }

  try {
    console.log(LOG_PREFIX + " " + message + " " + JSON.stringify(meta));
  } catch (_) {
    console.log(LOG_PREFIX + " " + message, meta);
  }
}

function slotLog(index, message, meta) {
  const text = String(message || "");
  const critical = (
    text.includes("failed") ||
    text.includes("error") ||
    text.includes("did-fail-load") ||
    text.includes("suspicious") ||
    text.includes("recovery") ||
    text.includes("login") ||
    text.includes("[KISS FALLBACK HOST] issue")
  );
  if (!critical && !isDiagnosticLogEnabled()) return;

  const entry = entries[index] || {};
  const prefix = "[Slot " + (index + 1) + " / " + (entry.username || entry.label || "account") + "]";

  if (typeof meta === "undefined") {
    console.log(LOG_PREFIX + " " + prefix + " " + message);
    return;
  }

  try {
    console.log(LOG_PREFIX + " " + prefix + " " + message + " " + JSON.stringify(meta));
  } catch (_) {
    console.log(LOG_PREFIX + " " + prefix + " " + message, meta);
  }
}

function getSlot(index) {
  return document.getElementById("slot" + index);
}

function getGameWebview(index) {
  return document.getElementById("gameView" + index);
}

function setSlotStatus(index, text, kind) {
  const el = document.getElementById("slotStatus" + index);
  if (!el) return;

  el.textContent = text;
  el.className = "slot-status" + (kind ? " " + kind : "");
}

function setSlotLoginOverlay(index, visible, title, text) {
  const overlay = document.getElementById("slotLoginOverlay" + index);
  if (!overlay) return;

  const titleEl = document.getElementById("slotLoginTitle" + index);
  const textEl = document.getElementById("slotLoginText" + index);
  if (titleEl && title) titleEl.textContent = String(title);
  if (textEl && text) textEl.textContent = String(text);

  if (visible) {
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
  } else {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  }
}

function notifyRuntimeStatus(index, status, message, extra) {
  const entry = entries[index] || {};
  if (!entry.accountId) return;

  try {
    ipcRenderer.send("runtime-slot-status", Object.assign({
      accountId: entry.accountId,
      partition: entry.partition || "",
      status,
      message: message || "",
      updatedAt: Date.now()
    }, extra || {}));
  } catch (_) {}
}

function getWebviewUrl(webview) {
  try {
    if (webview && typeof webview.getURL === "function") {
      return webview.getURL();
    }
  } catch (_) {}

  return String(webview && webview.src ? webview.src : "");
}

function isBlankUrl(url) {
  const text = String(url || "");
  return !text || text === "about:blank" || text.startsWith("about:blank");
}

function isTargetUrl(url) {
  return String(url || "").includes("getkisskiss.com");
}

function isSuspiciousGameUrl(url) {
  const text = String(url || "");
  return text.includes("/game/room?=undefined") ||
    text.includes("/game/room/search?=undefined") ||
    text.includes("=undefined");
}
`;

module.exports = {
  source
};
