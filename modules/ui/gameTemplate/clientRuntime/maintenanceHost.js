const source = String.raw`const MAINTENANCE_HOST_CHECK_INTERVAL = 10000;
const MAINTENANCE_HOST_SOFT_RELOAD_INTERVAL = 3 * 60 * 1000;
const MAINTENANCE_HOST_RELAUNCH_INTERVAL = 10 * 60 * 1000;
const MAINTENANCE_HOST_BUSY_RESPONSE_AGE = 5000;
const MAINTENANCE_HOST_SAFE_STATE_TIMEOUT = 1800;

let maintenanceHostTimer = null;
let maintenanceHostInFlight = false;
let maintenanceHostWasEnabled = false;
let maintenanceHostLastSoftReloadAt = 0;
let maintenanceHostSoftReloadPendingSince = 0;
let maintenanceHostLastRelaunchAt = 0;
let maintenanceHostRelaunchPendingSince = 0;
let maintenanceHostLastBlockedLogAt = 0;
let maintenanceHostEnabled = !!(options.moduleSettings && options.moduleSettings.maintenanceHost);

function isMaintenanceHostEnabled() {
  return !!maintenanceHostEnabled;
}

function setMaintenanceHostEnabled(value, reason) {
  maintenanceHostEnabled = !!value;
  options.moduleSettings = options.moduleSettings || {};
  options.moduleSettings.maintenanceHost = maintenanceHostEnabled;
  try {
    ipcRenderer.invoke("scripts:set-settings", Object.assign({}, options.moduleSettings, {
      maintenanceHost: maintenanceHostEnabled
    })).catch(() => {});
  } catch (_) {}
  try {
    ipcRenderer.send("maintenance-host-toggle", {
      enabled: maintenanceHostEnabled,
      reason: reason || "toolbar",
      at: Date.now()
    });
  } catch (_) {}
  if (!maintenanceHostEnabled) markMaintenanceHostDisabled();
  else markMaintenanceHostEnabled(Date.now());
  maintenanceHostLog("toggle", {
    enabled: maintenanceHostEnabled,
    reason: reason || "toolbar"
  }, true);
  updateUI();
}

function maintenanceHostLog(kind, payload, force) {
  if (!force && !isDiagnosticLogEnabled()) return;
  try {
    console.log("[MAINTENANCE HOST] " + kind + " " + JSON.stringify(Object.assign({
      at: Date.now()
    }, payload || {})));
  } catch (_) {
    console.log("[MAINTENANCE HOST] " + kind);
  }
}

function buildMaintenanceSafeStateScript() {
  return [
    "(function(){",
    "function visible(node){try{if(!node)return false;var style=window.getComputedStyle(node);if(!style||style.display==='none'||style.visibility==='hidden'||Number(style.opacity||1)===0)return false;var rect=node.getBoundingClientRect();return rect&&rect.width>2&&rect.height>2;}catch(_){return false;}}",
    "function timerVisible(){try{var nodes=Array.prototype.slice.call(document.querySelectorAll('.timer,.countdown,.clock,.js-timer,.action-timer,[class*=\"timer\"],[class*=\"countdown\"],[class*=\"clock\"]'),0,20);return nodes.some(function(node){if(!visible(node))return false;var text=String(node.textContent||'').trim();return /^\\d{1,3}$/.test(text)||/^\\d{1,2}:\\d{2}$/.test(text);});}catch(_){return false;}}",
    "try{",
    "var now=Date.now();",
    "var reasons=[];",
    "var lastAuto=Number(window.__KISS_AUTO_KISS_LAST_RESPONSE_AT||0);",
    "var lastFallback=Number(window.__KISS_FALLBACK_LAST_RESPONSE_AT||0);",
    "if(lastAuto&&now-lastAuto<" + MAINTENANCE_HOST_BUSY_RESPONSE_AGE + ")reasons.push('auto-kiss-recent');",
    "if(lastFallback&&now-lastFallback<" + MAINTENANCE_HOST_BUSY_RESPONSE_AGE + ")reasons.push('kiss-fallback-recent');",
    "var scheduler=window.__KISS_API_SCHEDULER__;",
    "var schedulerState=scheduler&&typeof scheduler.getState==='function'?scheduler.getState():null;",
    "var keys=schedulerState?[].concat(schedulerState.runningKeys||[],schedulerState.queuedKeys||[]):[];",
    "if(keys.some(function(key){return /kiss|follow|recovery|roomLock|room-lock|roomChange|room-change/i.test(String(key||''));}))reasons.push('api-scheduler-busy');",
    "var guard=window.__KISS_ACTIVE_GUARD_STATE||{};",
    "if(guard.queueRecoveryInFlight||guard.queueReloadInFlight||guard.profileRecoveryInFlight||guard.changeInFlight)reasons.push('active-guard-busy');",
    "var kissButton=Array.prototype.slice.call(document.querySelectorAll('.js-kiss:not([disabled])'),0,8).some(visible);",
    "if(kissButton)reasons.push('kiss-button-visible');",
    "var actionArea=document.querySelector('.action-buttons,.action-user-name,.duel__player-name,.action__user-name,.middle-player-name,.action-player-name');",
    "var actionVisible=visible(actionArea);",
    "var hasTimer=!!(actionVisible&&timerVisible());",
    "if(hasTimer)reasons.push('action-timer-visible');",
    "return {ok:true,blocked:reasons.length>0,reasons:reasons,href:String(location.href||''),roomId:String(window.__KISS_LAST_ROOM_ID||window.__KISS_AUTO_KISS_LAST_ROOM_ID||window.__KISS_FALLBACK_LAST_ROOM_ID||''),lastAutoKissAgeMs:lastAuto?now-lastAuto:null,lastFallbackAgeMs:lastFallback?now-lastFallback:null,actionVisible:!!actionVisible,timerVisible:hasTimer};",
    "}catch(error){return {ok:false,blocked:false,reasons:['safe-state-error'],error:String(error&&error.message||error||'')};}",
    "})();"
  ].join("\\n");
}

function queryMaintenanceSafeState(index) {
  const webview = getGameWebview(index);
  if (!webview || isBlankUrl(getWebviewUrl(webview))) {
    return Promise.resolve({
      index,
      ok: false,
      blocked: false,
      reasons: ["webview-not-ready"],
      href: getWebviewUrl(webview)
    });
  }

  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({
        index,
        ok: false,
        blocked: false,
        reasons: ["safe-state-timeout"],
        href: getWebviewUrl(webview)
      });
    }, MAINTENANCE_HOST_SAFE_STATE_TIMEOUT);

    try {
      webview.executeJavaScript(buildMaintenanceSafeStateScript(), false)
        .then(result => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(Object.assign({ index }, result || {
            ok: false,
            blocked: false,
            reasons: ["empty-safe-state"]
          }));
        })
        .catch(error => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({
            index,
            ok: false,
            blocked: false,
            reasons: ["safe-state-failed"],
            error: String(error && error.message ? error.message : error || ""),
            href: getWebviewUrl(webview)
          });
        });
    } catch (error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({
        index,
        ok: false,
        blocked: false,
        reasons: ["safe-state-exception"],
        error: String(error && error.message ? error.message : error || ""),
        href: getWebviewUrl(webview)
      });
    }
  });
}

async function getMaintenanceBlockReason() {
  const states = await Promise.all(entries.map((_entry, index) => queryMaintenanceSafeState(index)));
  const blocked = states.find(state => state && state.blocked);
  if (!blocked) return { blockReason: "", states };
  return {
    blockReason: (blocked.reasons && blocked.reasons[0]) || "slot-busy",
    states
  };
}

function markMaintenanceHostEnabled(now) {
  if (maintenanceHostWasEnabled) return;
  maintenanceHostWasEnabled = true;
  maintenanceHostLastSoftReloadAt = now;
  maintenanceHostLastRelaunchAt = now;
  maintenanceHostSoftReloadPendingSince = 0;
  maintenanceHostRelaunchPendingSince = 0;
  maintenanceHostLog("enabled", {
    slots: entries.length
  }, false);
}

function markMaintenanceHostDisabled() {
  if (!maintenanceHostWasEnabled) return;
  maintenanceHostWasEnabled = false;
  maintenanceHostSoftReloadPendingSince = 0;
  maintenanceHostRelaunchPendingSince = 0;
  maintenanceHostLog("disabled", {}, false);
}

async function runMaintenanceSoftReload(now) {
  maintenanceHostLastSoftReloadAt = now;
  maintenanceHostSoftReloadPendingSince = 0;
  maintenanceHostLog("soft-reload-run", {
    reason: "performance-soft-reload",
    slots: entries.length
  }, true);
  await runHostKissFallbackBurst("maintenance-before-soft-reload", {
    attempts: 1,
    force: true
  });
  loadGameRoomsOnly("Performance reload");
  [2500, 6000, 10000, 15000, 22000].forEach(delayMs => {
    setTimeout(() => {
      scheduleHostKissFallbackBurst("maintenance-after-soft-reload", {
        attempts: 1,
        force: true
      });
    }, delayMs);
  });
}

async function runMaintenanceRelaunch(now) {
  maintenanceHostLastRelaunchAt = now;
  maintenanceHostRelaunchPendingSince = 0;
  maintenanceHostLog("relaunch-run", {
    reason: "performance-relaunch",
    slots: entries.length
  }, true);
  await runHostKissFallbackBurst("maintenance-before-relaunch", {
    attempts: 2,
    spacingMs: 900,
    force: true
  });
  ipcRenderer.send("maintenance-relaunch", {
    reason: "performance-relaunch",
    mode: entries.length > 1 ? "multi" : "single",
    accountIds: entries.map(entry => String(entry.accountId || "")).filter(Boolean),
    at: now
  });
}

async function evaluateMaintenanceHost(now) {
  if (maintenanceHostInFlight) return;
  if (!isMaintenanceHostEnabled()) {
    markMaintenanceHostDisabled();
    return;
  }

  markMaintenanceHostEnabled(now);

  const relaunchDue = maintenanceHostRelaunchPendingSince || now - maintenanceHostLastRelaunchAt >= MAINTENANCE_HOST_RELAUNCH_INTERVAL;
  const softReloadDue = maintenanceHostSoftReloadPendingSince || now - maintenanceHostLastSoftReloadAt >= MAINTENANCE_HOST_SOFT_RELOAD_INTERVAL;
  if (!relaunchDue && !softReloadDue) return;

  if (relaunchDue && !maintenanceHostRelaunchPendingSince) {
    maintenanceHostRelaunchPendingSince = now;
    maintenanceHostLog("relaunch-pending", {}, false);
  }
  if (softReloadDue && !maintenanceHostSoftReloadPendingSince) {
    maintenanceHostSoftReloadPendingSince = now;
    maintenanceHostLog("soft-reload-pending", {}, false);
  }

  maintenanceHostInFlight = true;
  try {
    const safety = await getMaintenanceBlockReason();
    if (safety.blockReason) {
      if (isDiagnosticLogEnabled() || now - maintenanceHostLastBlockedLogAt >= 60000) {
        maintenanceHostLastBlockedLogAt = now;
        maintenanceHostLog(relaunchDue ? "relaunch-blocked" : "soft-reload-blocked", {
          blockReason: safety.blockReason,
          softPendingMs: maintenanceHostSoftReloadPendingSince ? now - maintenanceHostSoftReloadPendingSince : 0,
          relaunchPendingMs: maintenanceHostRelaunchPendingSince ? now - maintenanceHostRelaunchPendingSince : 0,
          states: isDiagnosticLogEnabled() ? safety.states : undefined
        }, false);
      }
      return;
    }

    if (relaunchDue) {
      await runMaintenanceRelaunch(now);
      return;
    }
    if (softReloadDue) {
      await runMaintenanceSoftReload(now);
    }
  } finally {
    maintenanceHostInFlight = false;
  }
}

function startMaintenanceHostTimer() {
  if (maintenanceHostTimer) return;
  const now = Date.now();
  maintenanceHostLastSoftReloadAt = now;
  maintenanceHostLastRelaunchAt = now;
  maintenanceHostTimer = setInterval(() => {
    evaluateMaintenanceHost(Date.now()).catch(error => {
      maintenanceHostLog("error", {
        error: String(error && error.message ? error.message : error || "")
      }, true);
    });
  }, MAINTENANCE_HOST_CHECK_INTERVAL);
  evaluateMaintenanceHost(now).catch(() => {});
}

function stopMaintenanceHostTimer() {
  if (maintenanceHostTimer) clearInterval(maintenanceHostTimer);
  maintenanceHostTimer = null;
  maintenanceHostInFlight = false;
}
`;

module.exports = {
  source
};
