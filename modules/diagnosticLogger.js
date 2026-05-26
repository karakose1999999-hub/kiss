const fs = require("fs");
const path = require("path");
const util = require("util");

const {
  CRITICAL_FLUSH_DEBOUNCE_MS,
  CRITICAL_PATTERNS,
  HEARTBEAT_INTERVAL_MS,
  IMPORTANT_PATTERNS,
  LIVE_FLUSH_INTERVAL_MS,
  LIVE_LOG_FILE_NAME,
  LOGGER_VERSION,
  LOG_FILE_NAME,
  MAX_FIELD_LENGTH,
  THROTTLE_MS,
  THROTTLE_PATTERNS
} = require("./diagnosticLoggerConfig");

let installed = false;
let enabled = false;
let flushing = false;
let liveFlushTimer = null;
let heartbeatTimer = null;
let criticalFlushTimer = null;
let fallbackDirectory = "";
const entries = [];
const throttleMap = new Map();
let lastEntryAt = 0;

function truncateText(value, limit = MAX_FIELD_LENGTH) {
  const text = String(value == null ? "" : value)
    .replace(/data:text\/html[^'"\s}]*/g, "data:text/html...[truncated]");
  return text.length > limit ? text.slice(0, limit) + "...[truncated]" : text;
}

function sanitizeMeta(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return "[max-depth]";
  if (typeof value === "string") return truncateText(value);
  if (typeof value !== "object") return value;
  if (value instanceof Error) return truncateText(value.stack || value.message);
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitizeMeta(item, depth + 1));

  const out = {};
  Object.keys(value).slice(0, 80).forEach(key => {
    out[key] = sanitizeMeta(value[key], depth + 1);
  });
  return out;
}

function inspect(value) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack || value.message;

  return util.inspect(value, {
    depth: 5,
    breakLength: 160,
    maxArrayLength: 80,
    maxStringLength: MAX_FIELD_LENGTH
  });
}

function messageFromArgs(args) {
  return args.map(inspect).join(" ");
}

function shouldCapture(message) {
  const text = String(message || "");
  if (isRoutineNoise(text)) return false;
  return IMPORTANT_PATTERNS.some(pattern => text.includes(pattern));
}

function isRoutineNoise(text) {
  const value = String(text || "");

  if (value.includes("[RendererConsole]") || value.includes("[WebviewConsole]")) {
    if (value.includes("[ROOM LOCK] anchors-refreshed")) return true;
    if (value.includes("[PERFORMANCE] summary")) return true;
    if (value.includes("[AUTO SPIN] Ozet")) return true;
    if (value.includes("[AUTO SPIN] Hata veya backoff") && value.includes('"ok":true')) return true;
    if (value.includes("[GİZLİ SAVE FETCH ERROR]") || value.includes("[GIZLI SAVE FETCH ERROR]")) return true;
    return !(
      value.includes("did-fail-load") ||
      value.includes("render-process-gone") ||
      value.includes("own-seat-lost") ||
      value.includes("suspicious route recovery") ||
      value.includes("queue-stuck-recovery") ||
      (value.includes("[ROOM LOCK]") && (
        value.includes("retry") ||
        value.includes("success") ||
        value.includes("failed") ||
        value.includes("stopped") ||
        value.includes("expired") ||
        value.includes("blocked")
      )) ||
      value.includes("[INJECT ERROR]") ||
      value.includes("ERROR") ||
      value.includes("failed")
    );
  }

  if (value.includes("[ACTIVE GUARD]")) {
    return (
      value.includes("Interaction probe") ||
      value.includes("profile-hover-only") ||
      value.includes("profile-poke ") ||
      value.includes("profile-poke-blocked") ||
      value.includes("profile-click-recovery-blocked") ||
      value.includes("Rastgele masa icin bekleniyor") ||
      value.includes("Sira gozlem degisti") ||
      value.includes("Sira gozlem sifirlandi")
    );
  }

  if (value.includes("[KISS FALLBACK] decision") && value.includes("missing-room-id")) return true;
  if (value.includes("[KISS FALLBACK HOST]") && !value.includes("issue") && !value.includes("summary")) return true;
  if (value.includes("[AUTO KISS] response") && value.includes('"ok":true')) return true;
  if (value.includes("[AUTO SPIN] Ozet")) return true;
  if (value.includes("[AUTO SPIN] Hata veya backoff") && value.includes('"ok":true')) return true;
  if (value.includes("[GİZLİ SAVE FETCH ERROR]") || value.includes("[GIZLI SAVE FETCH ERROR]")) return true;
  if (value.includes("[ROOM LOCK] anchors-refreshed")) return true;
  if (value.includes("[PERFORMANCE] summary")) return true;
  if (value.includes("__KISS_ACTIVITY_EVENT__") && value.includes('"kind":"activity-pulse"')) return true;
  if (value.includes("__KISS_NAV_EVENT__") && value.includes("undefined-route-heartbeat")) return true;
  if (value.includes("__KISS_ROSTER_EVENT__") && (
    value.includes('"kind":"roster-health"') ||
    value.includes('"kind":"roster-diff"')
  ) && value.includes('"joined":[]') && value.includes('"left":[]')) return true;

  return false;
}

function shouldCriticalFlush(message) {
  const text = String(message || "");
  return CRITICAL_PATTERNS.some(pattern => text.includes(pattern));
}

function throttleKey(message) {
  const text = String(message || "");
  const pattern = THROTTLE_PATTERNS.find(item => text.includes(item));
  if (!pattern) return "";

  const slotMatch = text.match(/\[Slot\s+\d+\s*\/[^\]]+\]/);
  return `${pattern}:${slotMatch ? slotMatch[0] : "global"}`;
}

function isThrottled(message) {
  const key = throttleKey(message);
  if (!key) return false;

  const now = Date.now();
  const last = throttleMap.get(key) || 0;
  if (now - last < THROTTLE_MS) return true;

  throttleMap.set(key, now);
  return false;
}

function addEntry(level, source, message, meta) {
  lastEntryAt = Date.now();

  entries.push({
    time: new Date().toISOString(),
    level: String(level || "info"),
    source: String(source || "main"),
    message: truncateText(message),
    meta: meta == null ? undefined : sanitizeMeta(meta)
  });
}

function push(level, source, message, meta, options) {
  if (!enabled) return;
  const force = !!(options && options.force);
  if (!message) return;
  if (!force && (!shouldCapture(message) || isThrottled(message))) return;

  addEntry(level, source, message, meta);
  if (shouldCriticalFlush(message)) scheduleCriticalLiveFlush();
}

function wrapConsoleMethod(level) {
  const original = console[level] ? console[level].bind(console) : console.log.bind(console);

  console[level] = (...args) => {
    try {
      push(level, "console", messageFromArgs(args));
    } catch (_) {}

    original(...args);
  };
}

function installConsoleCapture() {
  if (installed) return;
  installed = true;

  wrapConsoleMethod("log");
  wrapConsoleMethod("warn");
  wrapConsoleMethod("error");
}

function getLogFilePath() {
  return path.join(process.cwd(), LOG_FILE_NAME);
}

function getLiveLogFilePath() {
  return path.join(process.cwd(), LIVE_LOG_FILE_NAME);
}

function getFallbackFilePath(fileName) {
  return fallbackDirectory ? path.join(fallbackDirectory, fileName) : "";
}

function getStartupMeta() {
  return {
    loggerVersion: LOGGER_VERSION,
    pid: process.pid,
    cwd: process.cwd(),
    argv: process.argv,
    execPath: process.execPath,
    logFile: getLogFilePath(),
    liveLogFile: getLiveLogFilePath()
  };
}

function writeLogFile(filePath, reason) {
  const lines = entries.map(entry => JSON.stringify(entry));
  const body = lines.join("\n") + (lines.length ? "\n" : "");
  fs.writeFileSync(filePath, body, "utf8");

  const fallbackPath = getFallbackFilePath(path.basename(filePath));
  if (fallbackPath && fallbackPath !== filePath) {
    try {
      fs.writeFileSync(fallbackPath, body, "utf8");
    } catch (error) {
      reportFlushError(error, { reason, fallbackPath });
    }
  }
}

function reportFlushError(error, meta) {
  const payload = {
    time: new Date().toISOString(),
    level: "error",
    source: "diagnostic",
    message: "diagnostic flush failed",
    meta: {
      loggerVersion: LOGGER_VERSION,
      error: String(error && error.message ? error.message : error),
      detail: sanitizeMeta(meta || {})
    }
  };

  try {
    process.stderr.write(`${JSON.stringify(payload)}\n`);
  } catch (_) {}
}

function flushTo(filePath, reason, options) {
  if (!enabled) return;
  if (flushing) return;
  flushing = true;

  try {
    if (!(options && options.skipMarker)) {
      push("info", "diagnostic", String(reason || "flush"), undefined, { force: true });
    }

    writeLogFile(filePath, reason);
  } catch (error) {
    reportFlushError(error, { reason, filePath });
  } finally {
    flushing = false;
  }
}

function flushLive(reason, options) {
  flushTo(getLiveLogFilePath(), `live:${reason || "flush"}`, options);
}

function flush(reason) {
  flushTo(getLogFilePath(), reason || "flush");
  flushLive(`final:${reason || "flush"}`, { skipMarker: true });
}

function scheduleCriticalLiveFlush() {
  if (!enabled) return;
  if (criticalFlushTimer) return;

  criticalFlushTimer = setTimeout(() => {
    criticalFlushTimer = null;
    flushLive("critical");
  }, CRITICAL_FLUSH_DEBOUNCE_MS);

  if (typeof criticalFlushTimer.unref === "function") criticalFlushTimer.unref();
}

function heartbeat() {
  push("info", "diagnostic", "diagnostic heartbeat", {
    loggerVersion: LOGGER_VERSION,
    pid: process.pid,
    entryCount: entries.length,
    lastEntryAt: lastEntryAt ? new Date(lastEntryAt).toISOString() : null,
    cwd: process.cwd()
  }, { force: true });
}

function startLiveFlush() {
  if (!enabled) return;
  if (!liveFlushTimer) {
    liveFlushTimer = setInterval(() => {
      flushLive("interval");
    }, LIVE_FLUSH_INTERVAL_MS);

    if (typeof liveFlushTimer.unref === "function") liveFlushTimer.unref();
  }

  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      heartbeat();
      flushLive("heartbeat", { skipMarker: true });
    }, HEARTBEAT_INTERVAL_MS);

    if (typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();
  }

  flushLive("startup", { skipMarker: true });
}

function stopLiveFlush() {
  if (liveFlushTimer) clearInterval(liveFlushTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (criticalFlushTimer) clearTimeout(criticalFlushTimer);
  liveFlushTimer = null;
  heartbeatTimer = null;
  criticalFlushTimer = null;
  flushing = false;
}

function setEnabled(value, reason) {
  const next = !!value;
  if (enabled === next) return enabled;

  enabled = next;
  if (!enabled) {
    stopLiveFlush();
    entries.length = 0;
    throttleMap.clear();
    lastEntryAt = 0;
    return enabled;
  }

  addEntry("info", "diagnostic", "diagnostic logger enabled", Object.assign(getStartupMeta(), {
    reason: String(reason || "set-enabled")
  }));
  startLiveFlush();
  return enabled;
}

function isEnabled() {
  return !!enabled;
}

function setFallbackDirectory(directory) {
  fallbackDirectory = directory ? String(directory) : "";
  push("info", "diagnostic", "diagnostic fallback directory", { fallbackDirectory }, { force: true });
  flushLive("fallback-directory", { skipMarker: true });
}

function attachApp(app) {
  if (!app || typeof app.on !== "function") return;

  app.on("ready", () => {
    try {
      setFallbackDirectory(app.getPath("userData"));
    } catch (error) {
      reportFlushError(error, { reason: "set-fallback-directory" });
    }
  });

  app.on("before-quit", () => {
    push("info", "app", "before-quit", undefined, { force: true });
    flush("before-quit");
  });

  app.on("will-quit", () => {
    push("info", "app", "will-quit", undefined, { force: true });
    flush("will-quit");
  });

  app.on("quit", (_event, exitCode) => {
    push("info", "app", "quit", { exitCode }, { force: true });
    flush("quit");
  });
}

module.exports = {
  attachApp,
  flush,
  flushLive,
  installConsoleCapture,
  isEnabled,
  push,
  setEnabled,
  setFallbackDirectory
};
