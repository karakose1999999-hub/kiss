const source = String.raw`function loadGameUrl(index, webview) {
  const state = slotState.get(index);
  if (!state || state.didStartGameLoad) return;

  state.didStartGameLoad = true;

  const waitMs = 600 + (index * 350);

  setSlotStatus(index, "Açılıyor", "warn");
  setSlotLoginOverlay(index, true, "Oyun açılıyor", "Slot hazırlanıyor ve oturum kontrol ediliyor.");
  notifyRuntimeStatus(index, "loading", "Opening");

  slotLog(index, "initial load scheduled", {
    waitMs
  });

  if (state.initialLoadTimer) clearTimeout(state.initialLoadTimer);
  state.initialLoadTimer = setTimeout(() => {
    state.initialLoadTimer = null;
    try {
      if (state.stopped) return;
      if (typeof webview.loadURL === "function") {
        webview.loadURL(TARGET_URL);
      } else {
        webview.src = TARGET_URL;
      }
    } catch (error) {
      slotLog(index, "initial load failed", error && error.message ? error.message : error);
    }
  }, waitMs);
}

function cleanupSlot(index, reason) {
  const state = slotState.get(index);
  const webview = getGameWebview(index);
  if (!state) return;

  if (state.injectTimer) clearTimeout(state.injectTimer);
  if (state.initialLoadTimer) clearTimeout(state.initialLoadTimer);
  if (state.domReadyTimer) clearTimeout(state.domReadyTimer);
  if (state.loginTimer) clearTimeout(state.loginTimer);
  if (state.loginRetryTimer) clearTimeout(state.loginRetryTimer);
  if (state.watchdogStartTimer) clearTimeout(state.watchdogStartTimer);
  if (state.watchdogTimer) clearInterval(state.watchdogTimer);
  if (state.kissFallbackTimer) clearInterval(state.kissFallbackTimer);
  state.initialLoadTimer = null;
  state.domReadyTimer = null;
  state.loginTimer = null;
  state.loginRetryTimer = null;
  state.watchdogStartTimer = null;
  state.injectTimer = null;
  state.watchdogTimer = null;
  state.kissFallbackTimer = null;
  state.didInjectScripts = false;
  state.injectingScripts = false;
  state.stopped = true;

  setSlotStatus(index, "Durduruldu", "warn");
  setSlotLoginOverlay(index, false);
  notifyRuntimeStatus(index, "stopped", reason || "Stopped", { stopped: true });
  if (focusedSlotIndex === index) clearFocusMode();

  try {
    if (webview && typeof webview.executeJavaScript === "function" && !isBlankUrl(getWebviewUrl(webview))) {
      webview.executeJavaScript("try{window.__KISS_TOOLKIT_STOPPED=true;}catch(_){}", false).catch(() => {});
    }
  } catch (_) {}

  try {
    if (webview && typeof webview.loadURL === "function") webview.loadURL("about:blank");
    else if (webview) webview.src = "about:blank";
  } catch (error) {
    slotLog(index, "slot cleanup blank failed", error && error.message ? error.message : error);
  }
}

function reloadWebviewsOnly(reason) {
  entries.forEach((_entry, index) => {
    const state = slotState.get(index);
    const view = getGameWebview(index);

    if (!state || !view || state.stopped) return;

    setSlotStatus(index, "Yenileniyor", "warn");
    setSlotLoginOverlay(index, true, "Yenileniyor", "Oyun sayfası tekrar yükleniyor.");
    notifyRuntimeStatus(index, "loading", reason || "Reload", {
      reload: true,
      source: "reloadWebviewsOnly"
    });
    slotLog(index, "webview-reload-reason", {
      reason: reason || "Reload",
      source: "reloadWebviewsOnly",
      url: getWebviewUrl(view)
    });

    if (isBlankUrl(getWebviewUrl(view))) {
      state.didStartGameLoad = false;
      loadGameUrl(index, view);
      return;
    }

    try {
      view.reload();
    } catch (error) {
      slotLog(index, "simple reload failed", error && error.message ? error.message : error);
    }
  });
}

function loadGameRoomsOnly(reason) {
  entries.forEach((_entry, index) => {
    const state = slotState.get(index);
    const view = getGameWebview(index);

    if (!state || !view || state.stopped) return;

    setSlotStatus(index, "Oda yenileniyor", "warn");
    setSlotLoginOverlay(index, true, "Oda yenileniyor", "Oyun odası güvenli şekilde yenileniyor.");
    notifyRuntimeStatus(index, "loading", reason || "Room reload", {
      reload: true,
      source: "loadGameRoomsOnly"
    });
    slotLog(index, "webview-reload-reason", {
      reason: reason || "Room reload",
      source: "loadGameRoomsOnly",
      url: getWebviewUrl(view)
    });

    try {
      if (typeof view.loadURL === "function") {
        view.loadURL(TARGET_URL);
      } else {
        view.src = TARGET_URL;
      }
    } catch (error) {
      slotLog(index, "room reload failed", error && error.message ? error.message : error);
    }
  });
}

function refreshWebviewsWithLoginFlow(reason) {
  entries.forEach((_entry, index) => {
    const state = slotState.get(index);
    const view = getGameWebview(index);

    if (!state || !view || state.stopped) return;

    state.didWebviewLogin = false;
    state.loginReloadStarted = false;
    resetInjectState(index);
    setSlotStatus(index, "Hazırlanıyor", "warn");
    setSlotLoginOverlay(index, true, "Hazırlanıyor", "Oturum ve oyun sayfası yeniden hazırlanıyor.");
    notifyRuntimeStatus(index, "loading", reason || "Refresh", {
      reload: true,
      source: "refreshWebviewsWithLoginFlow"
    });
    slotLog(index, "webview-reload-reason", {
      reason: reason || "Refresh",
      source: "refreshWebviewsWithLoginFlow",
      url: getWebviewUrl(view)
    });

    if (isBlankUrl(getWebviewUrl(view))) {
      state.didStartGameLoad = false;
      loadGameUrl(index, view);
    } else {
      view.reload();
    }
  });
}

function setupSlot(index) {
  const state = slotState.get(index);
  const slot = getSlot(index);
  const webview = getGameWebview(index);

  if (!state || !slot || !webview) {
    slotLog(index, "setup failed");
    return;
  }

  slot.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();
    toggleFocus(index);
  });

  webview.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();
    toggleFocus(index);
  });

  const focusBtn = document.getElementById("slotFocusBtn" + index);
  if (focusBtn) {
    focusBtn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleFocus(index);
    });
  }

  webview.addEventListener("did-start-loading", () => {
    if (state.stopped) return;
    markSeenTarget(index, webview);
    resetInjectState(index);
    pauseAutoActiveFocusUntilScriptsReady();
    resetNetworkWatcherState(index, "did-start-loading");
    if (!state.didInjectScripts) {
      setSlotLoginOverlay(index, true, "Yükleniyor", "Oyun ekranı hazırlanıyor.");
    }
    slotLog(index, "did-start-loading", { url: getWebviewUrl(webview) });
  });

  webview.addEventListener("did-start-navigation", event => {
    if (state.stopped) return;
    const meta = {
      url: event.url,
      isMainFrame: event.isMainFrame,
      isSameDocument: event.isSameDocument,
      lastKnownRoomId: getFreshSlotRoomId(index),
      statusText: getSlotStatusText(index)
    };
    slotLog(index, "did-start-navigation", meta);
    if (isSuspiciousGameUrl(event.url)) {
      slotLog(index, "suspicious navigation start", meta);
      logSuspiciousRoutePending(index, webview, "did-start-navigation", meta);
    }
  });

  webview.addEventListener("did-navigate", event => {
    if (state.stopped) return;
    markSeenTarget(index, webview);
    resetInjectState(index);
    resetNetworkWatcherState(index, "did-navigate");
    const url = event.url || getWebviewUrl(webview);
    const meta = {
      url,
      lastKnownRoomId: getFreshSlotRoomId(index),
      statusText: getSlotStatusText(index)
    };
    slotLog(index, "did-navigate", meta);
    if (isSuspiciousGameUrl(url)) {
      slotLog(index, "suspicious navigation landed", meta);
      recoverSuspiciousRoute(index, webview, "did-navigate", meta);
    } else {
      finishSuspiciousRouteRecovery(index, "landed", {
        url,
        currentUrl: getWebviewUrl(webview)
      });
    }
    scheduleInjectScripts(index, webview, "did-navigate", 800);
  });

  webview.addEventListener("did-navigate-in-page", event => {
    if (state.stopped) return;
    markSeenTarget(index, webview);
    const meta = {
      url: event.url || getWebviewUrl(webview),
      isMainFrame: event.isMainFrame,
      lastKnownRoomId: getFreshSlotRoomId(index),
      statusText: getSlotStatusText(index)
    };
    slotLog(index, "did-navigate-in-page", meta);
    if (isSuspiciousGameUrl(meta.url)) {
      slotLog(index, "suspicious in-page navigation", meta);
      recoverSuspiciousRoute(index, webview, "did-navigate-in-page", meta);
    } else {
      finishSuspiciousRouteRecovery(index, "landed", {
        url: meta.url,
        currentUrl: getWebviewUrl(webview)
      });
    }
    checkToolkitHealth(index, webview, "did-navigate-in-page");
    scheduleInjectScripts(index, webview, "did-navigate-in-page", 1200);
  });

  webview.addEventListener("did-redirect-navigation", event => {
    if (state.stopped) return;
    const meta = {
      url: event.url,
      isMainFrame: event.isMainFrame,
      lastKnownRoomId: getFreshSlotRoomId(index),
      statusText: getSlotStatusText(index)
    };
    slotLog(index, "did-redirect-navigation", meta);
    if (isSuspiciousGameUrl(event.url)) {
      slotLog(index, "suspicious redirect navigation", meta);
    }
  });

  webview.addEventListener("dom-ready", () => {
    if (state.stopped) return;
    const url = getWebviewUrl(webview);

    markSeenTarget(index, webview);
    autoFitWebview(index);

    if (isBlankUrl(url)) return;

    if (!isTargetUrl(url)) {
      slotLog(index, "non target url", url);
      return;
    }

    insertBaseCss(webview);
    installFocusBridge(index, webview);
    installAuthUserWatcher(index, webview);
    installKissFallbackRoomWatcher(index, webview);
    if (stateUrlChanged(index, url)) resetNetworkWatcherState(index, "dom-ready-url-changed");
    installKissNetworkWatcher(index, webview);

    handleLoginPageIfNeeded(index, webview, "dom-ready").then(handled => {
      if (state.stopped || handled) return;

      if (runWebviewLoginThenReload(index, webview)) {
        return;
      }

      if (!state.loginActionInFlight) {
        setSlotLoginOverlay(index, false);
      }

      if (state.domReadyTimer) clearTimeout(state.domReadyTimer);
      state.domReadyTimer = setTimeout(() => {
        state.domReadyTimer = null;
        if (state.stopped) return;
        autoFitWebview(index);
        scheduleInjectScripts(index, webview, "dom-ready", 0);
      }, 900);
    }).catch(error => {
      slotLog(index, "login page probe failed", error && error.message ? error.message : error);
    });
  });

  webview.addEventListener("did-finish-load", () => {
    if (state.stopped) return;
    markSeenTarget(index, webview);
    const url = getWebviewUrl(webview);

    if (isTargetUrl(url)) {
      slotLog(index, "loaded", url);
      notifyRuntimeStatus(index, "loaded", "Loaded", {
        loaded: true,
        href: url
      });
    }

    autoFitWebview(index);
    handleLoginPageIfNeeded(index, webview, "did-finish-load").then(handled => {
      if (!handled) scheduleInjectScripts(index, webview, "did-finish-load", 250);
    }).catch(() => {
      scheduleInjectScripts(index, webview, "did-finish-load", 250);
    });
  });

  webview.addEventListener("did-stop-loading", () => {
    if (state.stopped) return;
    markSeenTarget(index, webview);
    autoFitWebview(index);
    handleLoginPageIfNeeded(index, webview, "did-stop-loading").then(handled => {
      if (!handled) scheduleInjectScripts(index, webview, "did-stop-loading", 450);
    }).catch(() => {
      scheduleInjectScripts(index, webview, "did-stop-loading", 450);
    });
  });

  webview.addEventListener("did-fail-load", event => {
    if (state.stopped) return;
    slotLog(index, "did-fail-load", {
      errorCode: event.errorCode,
      errorDescription: event.errorDescription,
      validatedURL: event.validatedURL
    });
    finishSuspiciousRouteRecovery(index, "blocked", {
      blockReason: "did-fail-load",
      errorCode: event.errorCode,
      errorDescription: event.errorDescription,
      validatedURL: event.validatedURL
    });

    setSlotStatus(index, "Hata", "bad");
    notifyRuntimeStatus(index, "error", "Load failed");
  });

  webview.addEventListener("console-message", event => {
    if (state.stopped) return;
    const msg = String(event.message || "");
    handleWebviewConsoleMessage(index, msg);
  });

  webview.addEventListener("render-process-gone", event => {
    slotLog(index, "render-process-gone", {
      reason: event && event.reason,
      exitCode: event && event.exitCode
    });
    notifyRuntimeStatus(index, "crashed", "Render process gone", {
      error: true,
      crashed: true
    });
  });

  startToolkitWatchdog(index, webview);
  startKissFallback(index, webview);
  loadGameUrl(index, webview);
}

function setupAllSlots() {
  entries.forEach((_entry, index) => setupSlot(index));
}

function updateUI() {
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const backBtn = document.getElementById("backBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const activeFocusBtn = document.getElementById("activeFocusBtn");
  const diagnosticLogBtn = document.getElementById("diagnosticLogBtn");
  const maintenanceHostBtn = document.getElementById("maintenanceHostBtn");

  if (activeFocusBtn) activeFocusBtn.textContent = activeFocusCycle ? "Aktiflik: Aktif" : "Aktiflik: Pasif";
  if (diagnosticLogBtn) diagnosticLogBtn.textContent = diagnosticLogEnabled ? "Tanı Logu: Açık" : "Tanı Logu: Kapalı";
  if (maintenanceHostBtn) maintenanceHostBtn.textContent = maintenanceHostEnabled ? "Bakım: Açık" : "Bakım: Kapalı";
  if (fullscreenBtn) fullscreenBtn.style.display = isMiniMode ? "block" : "none";
  if (refreshBtn) refreshBtn.style.display = isMiniMode ? "none" : "block";
  if (backBtn) backBtn.style.display = isMiniMode ? "none" : "block";
  if (clearHistoryBtn) clearHistoryBtn.style.display = isMiniMode ? "none" : "block";
  if (diagnosticLogBtn) diagnosticLogBtn.style.display = isMiniMode ? "none" : "block";
  if (maintenanceHostBtn) maintenanceHostBtn.style.display = isMiniMode ? "none" : "block";
  updateFocusButtons();
}

window.addEventListener("resize", () => {
  setTimeout(autoFitAllWebviews, 100);
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape" && focusedSlotIndex !== null) {
    toggleFocus(focusedSlotIndex);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  log("DOMContentLoaded", {
    slots: entries.length,
    mode: options.mode
  });

  const refreshBtn = document.getElementById("refreshBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const backBtn = document.getElementById("backBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const activeFocusBtn = document.getElementById("activeFocusBtn");
  const diagnosticLogBtn = document.getElementById("diagnosticLogBtn");
  const maintenanceHostBtn = document.getElementById("maintenanceHostBtn");

  setupAllSlots();
  startRoomIdRefreshTimer();
  startMaintenanceHostTimer();
  updateUI();

  if (activeFocusBtn) {
    activeFocusBtn.addEventListener("click", () => {
      if (activeFocusCycle) {
        activeFocusManualOverride = false;
        stopActiveFocusCycle();
      } else {
        activeFocusManualOverride = true;
        startActiveFocusCycle(true);
      }
    });
  }

  if (diagnosticLogBtn) {
    diagnosticLogBtn.addEventListener("click", () => {
      setDiagnosticLogEnabled(!diagnosticLogEnabled, "toolbar");
      if (diagnosticLogEnabled) {
        entries.forEach((_entry, index) => {
          const state = slotState.get(index);
          const view = getGameWebview(index);
          if (!state || !view) return;
          state.networkWatcherInstalled = false;
          state.networkWatcherDocumentKey = "";
          installKissNetworkWatcher(index, view);
        });
      }
    });
  }

  if (maintenanceHostBtn) {
    maintenanceHostBtn.addEventListener("click", () => {
      setMaintenanceHostEnabled(!maintenanceHostEnabled, "toolbar");
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      reloadWebviewsOnly("Reload");
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      ipcRenderer.send("toggle-full");
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      stopActiveFocusCycle();
      ipcRenderer.send("clear-history");
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      refreshWebviewsWithLoginFlow("Refresh");
    });
  }

  setTimeout(autoFitAllWebviews, 500);
});

ipcRenderer.on("show-fullscreen-btn", () => {
  isMiniMode = true;
  updateUI();
  setTimeout(autoFitAllWebviews, 100);
});

ipcRenderer.on("full-mode", () => {
  isMiniMode = false;
  updateUI();
  setTimeout(autoFitAllWebviews, 100);
});

ipcRenderer.on("runtime-stop-slot", (_event, payload) => {
  const accountId = String(payload && payload.accountId || "");
  entries.forEach((entry, index) => {
    if (String(entry && entry.accountId || "") === accountId) cleanupSlot(index, payload && payload.reason || "Stopped");
  });
});

ipcRenderer.on("runtime-stop-all", (_event, payload) => {
  stopActiveFocusCycle();
  stopRoomIdRefreshTimer();
  stopMaintenanceHostTimer();
  entries.forEach((_entry, index) => cleanupSlot(index, payload && payload.reason || "Stopped"));
});
`;

module.exports = {
  source
};
