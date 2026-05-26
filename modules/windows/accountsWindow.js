const { BrowserWindow } = require("electron");
const { buildAccountsTemplate } = require("../ui/accountsTemplate");
const diagnosticLogger = require("../diagnosticLogger");
const { accountsWindowOptions } = require("./windowConfig");
const {
  compactMeta,
  compactUrl,
  isCriticalConsoleMessage,
  shortenSource,
  shouldShowRendererMessage,
  shouldShowWebviewMessage
} = require("./windowLogFilters");

const LOG_PREFIX = "[NewWindow]";

function log(message, meta) {
  const text = String(message || "");
  const critical = (
    text.includes("did-fail-load") ||
    text.includes("render-process-gone") ||
    text.includes("unresponsive") ||
    text.includes("failed") ||
    text.includes("error")
  );
  if (!critical && !diagnosticLogger.isEnabled()) return;

  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, compactMeta(meta));
}

function attachWindowLogs(win, label) {
  win.webContents.on("did-finish-load", () => {
    log(`${label} did-finish-load`);
    diagnosticLogger.push("info", "window", `${label} did-finish-load`);
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    const meta = {
      errorCode,
      errorDescription,
      validatedURL: compactUrl(validatedURL)
    };

    log(`${label} did-fail-load`, meta);
    diagnosticLogger.push("warn", "window", `${label} did-fail-load`, meta);
  });

  win.webContents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
    const meta = { url: compactUrl(url), isInPlace, isMainFrame };
    log(`${label} did-start-navigation`, meta);
    diagnosticLogger.push("info", "window", `${label} did-start-navigation`, meta);
  });

  win.webContents.on("did-navigate", (_event, url) => {
    const meta = { url: compactUrl(url) };
    log(`${label} did-navigate`, meta);
    diagnosticLogger.push("info", "window", `${label} did-navigate`, meta);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    const meta = compactMeta(details || {});
    log(`${label} render-process-gone`, meta);
    diagnosticLogger.push("error", "window", `${label} render-process-gone`, meta);
  });

  win.webContents.on("unresponsive", () => {
    log(`${label} unresponsive`);
    diagnosticLogger.push("warn", "window", `${label} unresponsive`);
  });

  win.webContents.on("responsive", () => {
    log(`${label} responsive`);
    diagnosticLogger.push("info", "window", `${label} responsive`);
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const text = String(message || "");
    const critical = isCriticalConsoleMessage(text);
    if (!diagnosticLogger.isEnabled() && !critical) return;
    if (!shouldShowRendererMessage(text)) return;

    const meta = {
      level,
      message: text.length > 3000 ? text.slice(0, 3000) + "...[truncated]" : text,
      line,
      sourceId: shortenSource(sourceId)
    };

    diagnosticLogger.push("info", "renderer-console", text, meta);
    if (diagnosticLogger.isEnabled() || critical) console.log("[RendererConsole]", meta);
  });

  win.webContents.on("did-attach-webview", (_event, webContents) => {
    log(`${label} did-attach-webview`);
    diagnosticLogger.push("info", "webview", `${label} did-attach-webview`);

    webContents.on("did-finish-load", () => {
      const url = webContents.getURL();
      if (url && url !== "about:blank") {
        log(`${label} webview loaded`, compactUrl(url));
        diagnosticLogger.push("info", "webview", `${label} webview loaded`, { url: compactUrl(url) });
      }
    });

    webContents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
      if (!isMainFrame && !String(url || "").includes("=undefined")) return;
      const meta = { url: compactUrl(url), isInPlace, isMainFrame };
      log(`${label} webview did-start-navigation`, meta);
      diagnosticLogger.push("info", "webview", `${label} webview did-start-navigation`, meta);
    });

    webContents.on("did-redirect-navigation", (_event, url, isInPlace, isMainFrame) => {
      if (!isMainFrame && !String(url || "").includes("=undefined")) return;
      const meta = { url: compactUrl(url), isInPlace, isMainFrame };
      log(`${label} webview did-redirect-navigation`, meta);
      diagnosticLogger.push("info", "webview", `${label} webview did-redirect-navigation`, meta);
    });

    webContents.on("did-navigate", (_event, url) => {
      const meta = { url: compactUrl(url) };
      log(`${label} webview did-navigate`, meta);
      diagnosticLogger.push("info", "webview", `${label} webview did-navigate`, meta);
    });

    webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
      if (!isMainFrame && !String(url || "").includes("=undefined")) return;
      const meta = { url: compactUrl(url), isMainFrame };
      log(`${label} webview did-navigate-in-page`, meta);
      diagnosticLogger.push("info", "webview", `${label} webview did-navigate-in-page`, meta);
    });

    webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      const meta = {
        errorCode,
        errorDescription,
        validatedURL: compactUrl(validatedURL)
      };

      log(`${label} webview did-fail-load`, meta);
      diagnosticLogger.push("warn", "webview", `${label} webview did-fail-load`, meta);
    });

    webContents.on("render-process-gone", (_event, details) => {
      const meta = compactMeta(details || {});
      log(`${label} webview render-process-gone`, meta);
      diagnosticLogger.push("error", "webview", `${label} webview render-process-gone`, meta);
    });

    webContents.on("unresponsive", () => {
      log(`${label} webview unresponsive`);
      diagnosticLogger.push("warn", "webview", `${label} webview unresponsive`);
    });

    webContents.on("responsive", () => {
      log(`${label} webview responsive`);
      diagnosticLogger.push("info", "webview", `${label} webview responsive`);
    });

    webContents.on("console-message", (_event, level, message, line, sourceId) => {
      const text = String(message || "");
      const critical = isCriticalConsoleMessage(text);
      if (!diagnosticLogger.isEnabled() && !critical) return;
      if (!shouldShowWebviewMessage(text)) return;

      const meta = {
        level,
        message: text.length > 3000 ? text.slice(0, 3000) + "...[truncated]" : text,
        line,
        sourceId: shortenSource(sourceId)
      };

      diagnosticLogger.push("info", "webview-console", text, meta);
      if (diagnosticLogger.isEnabled() || critical) console.log("[WebviewConsole]", meta);
    });
  });
}

function createAccountsWindow() {
  log("create accounts start");

  const win = new BrowserWindow(accountsWindowOptions());

  win.setMenuBarVisibility(false);
  if (typeof win.removeMenu === "function") win.removeMenu();

  win.once("ready-to-show", () => {
    log("accounts ready-to-show");
    win.show();
  });

  attachWindowLogs(win, "accounts");

  renderAccountsScreen(win);

  log("create accounts done");
  return win;
}

function renderAccountsScreen(win) {
  if (!win || win.isDestroyed()) return;

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(buildAccountsTemplate()));
}

function renderGameScreen(win, html) {
  if (!win || win.isDestroyed()) return;

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(String(html || "")));
}

module.exports = {
  createAccountsWindow,
  renderAccountsScreen,
  renderGameScreen
};
