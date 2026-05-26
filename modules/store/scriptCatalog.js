const fs = require("fs");
const path = require("path");

const MODULES_DIR = path.join(__dirname, "../../scripts/modules");

const EXTRA_ITEMS = [
  {
    key: "autoSpinTab1",
    moduleName: "autoSpinTab1",
    fileName: "GeneralAuto.js",
    name: "Auto Spin",
    desc: "Genel Auto icindeki otomatik spin akisi."
  },
  {
    key: "autoKiss",
    moduleName: "autoKiss",
    fileName: "GeneralAuto.js",
    name: "Auto Kiss",
    desc: "Genel Auto icindeki kiss otomasyonu."
  },
  {
    key: "activeGuard",
    moduleName: "activeGuard",
    fileName: "GeneralAuto.js",
    name: "Aktiflik Koruma",
    desc: "Genel Auto icindeki oturum korumasi."
  },
  {
    key: "autoClose",
    moduleName: "autoClose",
    fileName: "GeneralAuto.js",
    name: "Sekmeleri Kapat",
    desc: "Genel Auto icindeki popup ve sekme kapatma akisi."
  }
];

const HIDDEN_FILES = new Set([
  "ModuleManager.js",
  "GameStateProvider.js",
  "ApiScheduler.js",
  "GeneralAuto.js",
  "GeneralAutoContextState.js",
  "GeneralAutoContext.js",
  "GeneralAutoSpinState.js",
  "GeneralAutoSpin.js",
  "GeneralAutoKissState.js",
  "GeneralAutoKiss.js",
  "GeneralAutoClose.js",
  "GeneralAutoGuardState.js",
  "GeneralAutoGuard.js",
  "GeneralAutoPerformanceState.js",
  "GeneralAutoState.js",
  "AutoComboState.js",
  "IdRoomFollowerState.js"
]);

const KNOWN_DESCRIPTIONS = {
  autoCombo: "Kick, save ve gizli save otomasyonu.",
  idRoomFollower: "ID ile kullanici kaydetme ve oda musait olunca takip etme.",
  visualCleanerUltimateFixedV9: "Oyun ekranindaki gorsel kalabaligi sadelestirir.",
  messageCleaner: "Sohbet ve etkinlik mesajlarini temizler."
};

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return "";
  }
}

function pickStringLiteral(source, key) {
  const pattern = new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`);
  const match = source.match(pattern);
  return match ? match[1] : "";
}

function titleFromName(name) {
  return String(name || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Tab\d+/g, "")
    .trim() || "Script";
}

function itemFromModuleFile(fileName) {
  if (HIDDEN_FILES.has(fileName)) return null;

  const filePath = path.join(MODULES_DIR, fileName);
  const source = readFileSafe(filePath);
  const moduleName = pickStringLiteral(source, "name");

  if (!moduleName) return null;

  return {
    key: moduleName,
    moduleName,
    fileName,
    name: pickStringLiteral(source, "title") || titleFromName(moduleName),
    desc: KNOWN_DESCRIPTIONS[moduleName] || `${fileName} modulu.`
  };
}

function listScriptItems() {
  const files = fs.existsSync(MODULES_DIR)
    ? fs.readdirSync(MODULES_DIR).filter(file => file.endsWith(".js")).sort()
    : [];

  return EXTRA_ITEMS.concat(files.map(itemFromModuleFile).filter(Boolean));
}

module.exports = {
  listScriptItems
};


