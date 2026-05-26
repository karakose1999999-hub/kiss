const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { listScriptItems } = require("./scriptCatalog");
const diagnosticLogger = require("../diagnosticLogger");

const DEFAULT_SETTINGS = {
  activeGuard: true,
  autoSpinTab1: true,
  autoKiss: true,
  autoClose: true,
  autoCombo: true,
  idRoomFollower: true,
  diagnosticLog: false,
  maintenanceHost: false,
  visualCleanerUltimateFixedV9: false,
  messageCleaner: false
};

const LEGACY_KEY_MAP = {
  visualCleaner: "visualCleanerUltimateFixedV9"
};

const LOG_PREFIX = "[NewStore:Scripts]";

function log(message, meta) {
  if (!diagnosticLogger.isEnabled()) return;
  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`, meta);
}

function getStorePath() {
  return path.join(app.getPath("userData"), "script-settings.json");
}

function legacyStorePaths() {
  const base = path.dirname(app.getPath("userData"));
  return [
    path.join(base, "getkiss-app", "script-settings.json"),
    path.join(base, "getkiss-yeni", "script-settings.json")
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
      log("migrated script settings", legacyPath);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
      log("created script-settings.json");
    }
  }

  return filePath;
}

function normalizeScriptSettings(payload) {
  const source = payload || {};
  const normalized = { ...DEFAULT_SETTINGS };

  Object.keys(LEGACY_KEY_MAP).forEach((legacyKey) => {
    const nextKey = LEGACY_KEY_MAP[legacyKey];
    if (source[legacyKey] !== undefined && source[nextKey] === undefined) {
      normalized[nextKey] = !!source[legacyKey];
    }
  });

  listScriptItems().forEach((item) => {
    if (!item || !item.key) return;
    if (source[item.key] !== undefined) normalized[item.key] = !!source[item.key];
  });

  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    if (source[key] !== undefined) normalized[key] = !!source[key];
  });

  return normalized;
}

function readScriptSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ensureStoreFile(), "utf8"));
    const normalized = normalizeScriptSettings(parsed);
    log("read");
    return normalized;
  } catch (error) {
    log("read failed, using defaults", error && error.message ? error.message : error);
    return { ...DEFAULT_SETTINGS };
  }
}

function writeScriptSettings(payload) {
  const normalized = normalizeScriptSettings(payload);
  fs.writeFileSync(ensureStoreFile(), JSON.stringify(normalized, null, 2), "utf8");
  log("write", normalized);
  return normalized;
}

module.exports = {
  readScriptSettings,
  writeScriptSettings,
  normalizeScriptSettings
};



