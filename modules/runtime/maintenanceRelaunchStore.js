const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const FILE_NAME = "maintenance-relaunch.json";

function getStorePath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

function writeMaintenanceRelaunch(payload) {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(Object.assign({
    at: Date.now()
  }, payload || {}), null, 2), "utf8");
}

function readMaintenanceRelaunch() {
  const filePath = getStorePath();
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    try { fs.unlinkSync(filePath); } catch (_) {}
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    return null;
  }
}

module.exports = {
  readMaintenanceRelaunch,
  writeMaintenanceRelaunch
};
