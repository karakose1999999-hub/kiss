function registerMainWindowIpcEvents(ipcMain, options = {}) {
  ipcMain.on("toggle-full", event => {
    const win = event.sender && event.sender.getOwnerBrowserWindow
      ? event.sender.getOwnerBrowserWindow()
      : null;

    if (!win || win.isDestroyed()) return;

    try {
      win.setFullScreen(false);
      win.maximize();
      win.focus();
      win.webContents.send("full-mode");
    } catch (error) {
      console.error("[NewMainWindowEvents] toggle-full failed:", error);
    }
  });

  ipcMain.on("clear-history", () => {
    const clearHistory = typeof options.clearHistory === "function"
      ? options.clearHistory
      : null;

    if (!clearHistory) return;

    clearHistory().catch(error => {
      console.error("[NewMainWindowEvents] clear-history failed:", error);
    });
  });
}

module.exports = {
  registerMainWindowIpcEvents
};
