function applyMaintenanceFullMode({ marker, getWindow, log, diagnosticLogger }) {
  if (!marker || marker.startFullMode !== true) return;

  setTimeout(() => {
    const win = typeof getWindow === "function" ? getWindow() : null;
    if (!win || win.isDestroyed()) return;

    try {
      win.setFullScreen(false);
      win.maximize();
      win.focus();
      win.webContents.send("full-mode");

      if (typeof log === "function") log("maintenance restore full mode applied");
      if (diagnosticLogger && typeof diagnosticLogger.push === "function") {
        diagnosticLogger.push("info", "maintenance", "maintenance restore full mode applied", {
          accountIds: Array.isArray(marker.accountIds) ? marker.accountIds : []
        }, { force: true });
        diagnosticLogger.flushLive("maintenance-full-mode-applied");
      }
    } catch (error) {
      const message = error && error.message ? error.message : String(error || "");
      if (typeof log === "function") log("maintenance restore full mode failed", message);
      if (diagnosticLogger && typeof diagnosticLogger.push === "function") {
        diagnosticLogger.push("error", "maintenance", "maintenance restore full mode failed", {
          error: message
        }, { force: true });
        diagnosticLogger.flushLive("maintenance-full-mode-failed");
      }
    }
  }, 2500);
}

module.exports = {
  applyMaintenanceFullMode
};
