const source = String.raw`async function readTargetQueueState(targetUserId) {
  const targetSlotIndex = userSlotMap.get(String(targetUserId || ""));
  if (typeof targetSlotIndex !== "number") return { found: false, disabled: false, reason: "target-not-open" };

  const webview = getGameWebview(targetSlotIndex);
  if (!webview || !canUseToolkitContext(targetSlotIndex, webview)) {
    return { found: true, disabled: false, targetSlotIndex, reason: "target-not-ready" };
  }

  try {
    const result = await webview.executeJavaScript(
      "(function(){try{var btn=document.querySelector('.js-menu-changeroom');return {found:!!btn,disabled:!!(btn&&btn.classList.contains('product-icon--disabled'))};}catch(_){return {found:false,disabled:false,error:true};}})();",
      true
    );

    return {
      found: true,
      targetSlotIndex,
      buttonFound: !!(result && result.found),
      disabled: !!(result && result.disabled)
    };
  } catch (error) {
    return { found: true, disabled: false, targetSlotIndex, reason: "read-error" };
  }
}

function deliverQueueStateToSlot(index, targetUserId, state) {
  const webview = getGameWebview(index);
  if (!webview || !canUseToolkitContext(index, webview)) return;

  const payload = JSON.stringify({
    targetUserId: String(targetUserId || ""),
    state: state || {},
    at: Date.now()
  });

  try {
    webview.executeJavaScript(
      "(function(){try{window.__KISS_FOLLOW_QUEUE_STATE=window.__KISS_FOLLOW_QUEUE_STATE||{};var payload=" + payload + ";window.__KISS_FOLLOW_QUEUE_STATE[payload.targetUserId]={state:payload.state,at:payload.at};}catch(_){}})();",
      false
    );
  } catch (_) {}
}

async function handleFollowEvent(index, payload) {
  const sourceAccountId = String(payload && payload.accountId || "");
  const targetUserId = String(payload && payload.targetUserId || "");
  const status = String(payload && payload.status || "");
  if (!sourceAccountId || !targetUserId) return;

  if (status === "check_target") {
    const targetState = await readTargetQueueState(targetUserId);
    console.log("[FOLLOW HOST] check_target", { sourceSlotIndex: index, sourceAccountId, targetUserId, targetState });
    deliverQueueStateToSlot(index, targetUserId, targetState);
    return;
  }

  if (
    status === "stopped" ||
    status === "success" ||
    status === "same_table" ||
    status === "same_table_confirmed" ||
    status === "target_moved_room" ||
    status === "target_queued"
  ) {
    console.log("[FOLLOW HOST] reset", { sourceSlotIndex: index, sourceAccountId, targetUserId, status });
    return;
  }

  if (status !== "eligible_failed") return;

  console.log("[FOLLOW HOST] eligible_failed ignored", {
    sourceSlotIndex: index,
    sourceAccountId,
    targetUserId
  });
}

function markSeenTarget(index, webview) {
  const state = slotState.get(index);
  if (!state) return;

  if (isTargetUrl(getWebviewUrl(webview))) {
    state.hasSeenTargetUrl = true;
  }
}

function installAuthUserWatcher(index, webview) {
  try {
    webview.executeJavaScript(
      "(function(){" +
      "if(window.__kissAuthUserWatcherInstalled)return;" +
      "window.__kissAuthUserWatcherInstalled=true;" +
      "function rememberAuthUserId(data){try{if(!data||data.type!=='authorization'||!data.userId)return;var id=String(data.userId);window.__KISS_AUTH_USER_ID=id;localStorage.setItem('kiss_auth_user_id',id);try{console.log('__KISS_AUTH_USER_ID__'+JSON.stringify({userId:id,at:Date.now()}));}catch(_){}}catch(_){}}" +
      "function inspectText(text){try{if(!text||typeof text!=='string'||text.indexOf('authorization')===-1)return;rememberAuthUserId(JSON.parse(text));}catch(_){}}" +
      "var originalFetch=window.fetch;" +
      "if(typeof originalFetch==='function'){window.fetch=function(){var promise=originalFetch.apply(this,arguments);try{promise.then(function(res){try{res.clone().text().then(inspectText).catch(function(){});}catch(_){}}).catch(function(){});}catch(_){}return promise;};}" +
      "var OriginalXHR=window.XMLHttpRequest;" +
      "if(typeof OriginalXHR==='function'){var originalOpen=OriginalXHR.prototype.open;var originalSend=OriginalXHR.prototype.send;OriginalXHR.prototype.open=function(){return originalOpen.apply(this,arguments);};OriginalXHR.prototype.send=function(){try{this.addEventListener('load',function(){try{inspectText(this.responseText);}catch(_){}});}catch(_){}return originalSend.apply(this,arguments);};}" +
      "})();",
      false
    );
  } catch (error) {
    slotLog(index, "auth user watcher failed", error && error.message ? error.message : error);
  }
}

function installKissFallbackRoomWatcher(index, webview) {
  try {
    webview.executeJavaScript(
      "(function(){" +
      "if(window.__kissFallbackRoomWatcherInstalled)return;" +
      "window.__kissFallbackRoomWatcherInstalled=true;" +
      "function num(v){var t=String(v||'').trim();return /^\\d+$/.test(t)&&t!=='0'?t:'';}" +
      "function remember(v){try{var id=num(v);if(!id||id==='0')return '';var at=Date.now();window.__KISS_LAST_ROOM_ID=id;window.__KISS_LAST_ROOM_ID_AT=at;localStorage.setItem('kiss_hidden_last_room_id',id);localStorage.setItem('kiss_hidden_last_room_id_at',String(at));try{console.log('__KISS_ROOM_ID__'+JSON.stringify({roomId:id,at:at}));}catch(_){}return id;}catch(_){return '';}}" +
      "function fromJson(data,url){try{if(!data||typeof data!=='object')return '';if(data.error==='disabled'&&String(url||'').indexOf('sit_down_to_friend')!==-1)return '';return remember((data.status&&(data.status.room_id||data.status.roomId))||data.room_id||data.roomId);}catch(_){return '';}}" +
      "function inspectText(text){try{if(!text||typeof text!=='string')return;if(text.indexOf('room_id')===-1&&text.indexOf('roomId')===-1)return;fromJson(JSON.parse(text));}catch(_){}}" +
      "var originalFetch=window.fetch;" +
      "if(typeof originalFetch==='function'){window.fetch=function(input,init){var url=String((input&&input.url)||input||'');var promise=originalFetch.apply(this,arguments);try{promise.then(function(res){try{res.clone().text().then(function(text){try{if(!text||typeof text!=='string')return;if(text.indexOf('room_id')===-1&&text.indexOf('roomId')===-1)return;fromJson(JSON.parse(text),url);}catch(_){}}).catch(function(){});}catch(_){}}).catch(function(){});}catch(_){}return promise;};}" +
      "var OriginalXHR=window.XMLHttpRequest;" +
      "if(typeof OriginalXHR==='function'){var originalOpen=OriginalXHR.prototype.open;var originalSend=OriginalXHR.prototype.send;OriginalXHR.prototype.open=function(method,url){try{this.__kissFallbackWatchUrl=String(url||'');}catch(_){}return originalOpen.apply(this,arguments);};OriginalXHR.prototype.send=function(body){try{this.addEventListener('load',function(){try{var text=this.responseText;if(!text||typeof text!=='string')return;if(text.indexOf('room_id')===-1&&text.indexOf('roomId')===-1)return;fromJson(JSON.parse(text),this.__kissFallbackWatchUrl||'');}catch(_){}});}catch(_){}return originalSend.apply(this,arguments);};}" +
      "})();",
      false
    );
  } catch (error) {
    slotLog(index, "kiss fallback room watcher failed", error && error.message ? error.message : error);
  }
}

function installKissNetworkWatcher(index, webview) {
  const state = slotState.get(index);
  if (!state || !webview) return;

  const documentKey = String(getWebviewUrl(webview) || "");
  if (state.networkWatcherInstalled && state.networkWatcherDocumentKey === documentKey) return;
  state.networkWatcherInstalled = true;
  state.networkWatcherDocumentKey = documentKey;

  const steps = Array.isArray(watcherSteps) ? watcherSteps : [];
  slotLog(index, "network watcher install start", {
    steps: steps.map(step => step && step.name),
    url: documentKey
  });

  let chain = Promise.resolve();
  steps.forEach(step => {
    chain = chain.then(() => {
      const name = String(step && step.name || "unknown");
      const source = String(step && step.source || "");
      const stepName = JSON.stringify(name);
      const payload = [
        "(function(){",
        "var step=" + stepName + ";",
        "var slot=" + JSON.stringify(index + 1) + ";",
        "function clean(url){try{var u=new URL(String(url||''),location.href);return u.pathname+(u.search||'');}catch(_){return String(url||'').slice(0,220);}}",
        "function state(){try{return {slot:slot,url:String(location.href||'').slice(0,500),readyState:document.readyState,roomId:String(window.__KISS_LAST_ROOM_ID||localStorage.getItem('kiss_hidden_last_room_id')||'').slice(0,40),authUserId:String(window.__KISS_AUTH_USER_ID||localStorage.getItem('kiss_auth_user_id')||'').slice(0,40)};}catch(_){return {slot:slot};}}",
        "function emit(kind,payload){try{console.log('__KISS_NET_EVENT__'+JSON.stringify(Object.assign({kind:kind,step:step,href:clean(location.href),at:Date.now()},state(),payload||{})));}catch(_){}}",
        "try{",
        source,
        "emit('watcher-step-ok',{});",
        "return {step:step,ok:true};",
        "}catch(error){",
        "emit('watcher-step-error',{error:String(error&&error.stack?error.stack:error&&error.message?error.message:error).slice(0,1200)});",
        "return {step:step,ok:false,error:String(error&&error.message?error.message:error)};",
        "}",
        "})();"
      ].join("");

      return webview.executeJavaScript(payload, true)
        .then(result => {
          slotLog(index, "network watcher step", {
            step: name,
            result,
            url: getWebviewUrl(webview)
          });
        })
        .catch(error => {
          slotLog(index, "network watcher step failed", {
            step: name,
            error: error && error.message ? error.message : error,
            url: getWebviewUrl(webview)
          });
        });
    });
  });

  chain.then(() => {
    slotLog(index, "network watcher install done", { url: getWebviewUrl(webview) });
  });
}
function shouldInjectScript(script) {
  if (!script || !script.name) return false;

  const moduleSettings = options.moduleSettings || {};
  const name = String(script.name);

  if (name === "main.user.js") return true;

  if (name.includes("AutoSpin")) return moduleSettings.autoSpinTab1 !== false;
  if (name.includes("AutoCombo")) return moduleSettings.autoCombo !== false;
  if (name.includes("VisualCleaner")) return moduleSettings.visualCleanerUltimateFixedV9 !== false;
  if (name.includes("MessageCleaner")) return moduleSettings.messageCleaner !== false;

  return true;
}

function buildInjectedPayload(index, script) {
  const entry = entries[index] || {};
  const codeToEval = JSON.stringify(String(script.code || ""));
  const scriptName = JSON.stringify(String(script.name || "unknown.js"));
  const moduleSettings = JSON.stringify(options.moduleSettings || {});
  const accountId = JSON.stringify(String(entry.accountId || ""));
  const accountScriptSettings = JSON.stringify(entry.accountScriptSettings || {});

  return [
    "(function(){",
    "try {",
    "var ACCOUNT_ID = " + accountId + ";",
    "window.__KISS_ACCOUNT_ID = ACCOUNT_ID;",
    "var ACCOUNT_SCRIPT_SETTINGS = " + accountScriptSettings + ";",
    "function allowedKey(key){ key=String(key||''); return key.indexOf('kiss_toolkit_')===0 || key==='moduleManager_enabledModules' || key==='visualCleanerUltimateFixedV9Settings' || key==='msgCleanSettings'; }",
    "function emitSetting(action,key,value){ try { if(!ACCOUNT_ID || !allowedKey(key)) return; console.log('__KISS_ACCOUNT_STORAGE__' + JSON.stringify({ accountId: ACCOUNT_ID, action: action, key: String(key), value: value == null ? '' : String(value) })); } catch (_) {} }",
    "window.__KISS_ACCOUNT_SAVE_SETTING = function(key,value){ emitSetting('set', key, value); };",
    "window.__KISS_ACCOUNT_REMOVE_SETTING = function(key){ emitSetting('remove', key, ''); };",
    "try { Object.keys(ACCOUNT_SCRIPT_SETTINGS || {}).forEach(function(key){ if(allowedKey(key)) localStorage.setItem(key, String(ACCOUNT_SCRIPT_SETTINGS[key])); }); } catch (_) {}",
    "try { var storedAuthId = String(localStorage.getItem('kiss_auth_user_id') || window.__KISS_AUTH_USER_ID || ''); if(/^\d+$/.test(storedAuthId)){ window.__KISS_AUTH_USER_ID = storedAuthId; console.log('__KISS_AUTH_USER_ID__' + JSON.stringify({ userId: storedAuthId, at: Date.now(), source: 'stored' })); } } catch (_) {}",
    "window.__KISS_MODULE_SETTINGS = " + moduleSettings + ";",
    "try { localStorage.setItem('moduleManager_enabledModules', JSON.stringify(window.__KISS_MODULE_SETTINGS)); } catch (_) {}",
    "try { window.__KISS_ACCOUNT_SAVE_SETTING('moduleManager_enabledModules', localStorage.getItem('moduleManager_enabledModules') || ''); } catch (_) {}",
    "(0, eval)(" + codeToEval + ");",
    "window._injectedScripts = window._injectedScripts || {};",
    "window._injectedScripts[" + scriptName + "] = true;",
    "console.log('[INJECT OK]', " + scriptName + ");",
    "} catch (error) {",
    "console.error('[INJECT ERROR]', " + scriptName + ", error && error.message ? error.message : error);",
    "throw error;",
    "}",
    "})();"
  ].join("");
}

function buildPanelEnsurePayload() {
  return [
    "(function(){",
    "try {",
    "if (document.getElementById('kiss-toolkit-panel')) return true;",
    "if (typeof window.__KISS_FORCE_TOOLKIT_INIT === 'function') { window.__KISS_FORCE_TOOLKIT_INIT(); }",
    "return !!document.getElementById('kiss-toolkit-panel');",
    "} catch (error) {",
    "console.error('[INJECT ERROR]', 'panel', error && error.message ? error.message : error);",
    "return false;",
    "}",
    "})();"
  ].join("");
}

function buildToolkitHealthPayload() {
  return [
    "(function(){",
    "try {",
    "var panel = !!document.getElementById('kiss-toolkit-panel');",
    "var injected = !!(window._injectedScripts && window._injectedScripts['main.user.js']);",
    "var forceInit = typeof window.__KISS_FORCE_TOOLKIT_INIT === 'function';",
    "var hasPanelObject = !!(window.__ToolkitPanel && window.__ToolkitPanel.panel);",
    "return { ok: !!(document.body && panel && injected && forceInit), body: !!document.body, panel: panel, injected: injected, forceInit: forceInit, hasPanelObject: hasPanelObject, readyState: document.readyState, href: String(location.href || '') };",
    "} catch (error) {",
    "return { ok: false, error: String(error && error.message ? error.message : error) };",
    "}",
    "})();"
  ].join("");
}

function resetInjectState(index) {
  const state = slotState.get(index);
  if (!state) return;

  if (state.injectTimer) {
    clearTimeout(state.injectTimer);
    state.injectTimer = null;
  }

  state.didInjectScripts = false;
  state.injectingScripts = false;
  state.injectAttempts = 0;
}

function resetNetworkWatcherState(index, reason) {
  const state = slotState.get(index);
  if (!state) return;

  if (state.networkWatcherInstalled || state.networkWatcherDocumentKey) {
    slotLog(index, "network watcher reset", {
      reason,
      previousDocumentKey: state.networkWatcherDocumentKey || ""
    });
  }

  state.networkWatcherInstalled = false;
  state.networkWatcherDocumentKey = "";
}

function stateUrlChanged(index, url) {
  const state = slotState.get(index);
  if (!state || !state.networkWatcherDocumentKey) return false;
  return String(state.networkWatcherDocumentKey || "") !== String(url || "");
}

function scheduleInjectScripts(index, webview, reason, delayMs) {
  const state = slotState.get(index);
  if (!state || state.stopped || state.didInjectScripts) return;
  if (state.loginPageActive || state.loginActionInFlight) return;

  if (state.injectTimer) {
    clearTimeout(state.injectTimer);
  }

  state.injectTimer = setTimeout(() => {
    state.injectTimer = null;
    injectScripts(index, webview, reason);
  }, Math.max(0, Number(delayMs) || 0));
}

function scheduleRetryInject(index, webview, reason) {
  const state = slotState.get(index);
  if (!state || state.stopped || state.didInjectScripts) return;
  if (options.loginRefreshAfterLoad && !state.loginReloadStarted) return;
  if (state.injectAttempts >= 10) return;

  const waitMs = Math.min(2200, 450 + (state.injectAttempts * 250));
  scheduleInjectScripts(index, webview, reason, waitMs);
}

async function injectScripts(index, webview, reason) {
  const state = slotState.get(index);
  if (!state || state.stopped || state.didInjectScripts || state.injectingScripts) return;
  const entry = entries[index] || {};
  if (!entry.loginOk) {
    setSlotStatus(index, "Login yok", "bad");
    notifyRuntimeStatus(index, "login-lost", "Preflight login failed", {
      error: true
    });
    return;
  }

  const url = getWebviewUrl(webview);
  if (isBlankUrl(url) || !isTargetUrl(url)) {
    state.injectAttempts += 1;
    scheduleRetryInject(index, webview, reason || "waiting-url");
    return;
  }

  if (options.loginRefreshAfterLoad && !state.loginReloadStarted) {
    return;
  }
  if (state.loginPageActive || state.loginActionInFlight) {
    return;
  }

  const selectedScripts = scripts.filter(shouldInjectScript);
  state.injectingScripts = true;
  state.injectAttempts += 1;

  slotLog(index, "inject start", {
    reason: reason || "manual",
    attempt: state.injectAttempts,
    total: scripts.length,
    selected: selectedScripts.map(script => script.name)
  });

  try {
    installKissNetworkWatcher(index, webview);

    for (const script of selectedScripts) {
      await webview.executeJavaScript(buildInjectedPayload(index, script), true);
    }

    const panelReady = await webview.executeJavaScript(buildPanelEnsurePayload(), true);
    if (!panelReady) {
      throw new Error("Toolkit panel not ready");
    }

    state.didInjectScripts = true;
    state.loginPageActive = false;
    state.loginActionInFlight = false;
    state.injectAttempts = 0;
    state.lastToolkitHealthyAt = Date.now();
    if (state.injectTimer) {
      clearTimeout(state.injectTimer);
      state.injectTimer = null;
    }
    setSlotStatus(index, "Aktif", "ok");
    setSlotLoginOverlay(index, false);
    notifyRuntimeStatus(index, "active", "Active");
    maybeStartActiveFocusAfterScripts();
  } catch (error) {
    state.didInjectScripts = false;
    slotLog(index, "inject failed", error && error.message ? error.message : error);
    scheduleRetryInject(index, webview, "retry-after-error");
  } finally {
    state.injectingScripts = false;
  }
}

function canUseToolkitContext(index, webview) {
  const state = slotState.get(index);
  if (!state || !webview) return false;
  if (state.stopped) return false;

  const url = getWebviewUrl(webview);
  if (isBlankUrl(url) || !isTargetUrl(url)) return false;
  if (options.loginRefreshAfterLoad && !state.loginReloadStarted) return false;

  try {
    if (typeof webview.isLoading === "function" && webview.isLoading()) return false;
  } catch (_) {}

  return true;
}

function markToolkitHealthy(index) {
  const state = slotState.get(index);
  if (!state) return;

  state.didInjectScripts = true;
  state.injectAttempts = 0;
  state.lastToolkitHealthyAt = Date.now();
  maybeStartActiveFocusAfterScripts();
}

function recoverToolkit(index, webview, reason) {
  const state = slotState.get(index);
  if (!state || state.stopped) return;

  const now = Date.now();
  if (now - state.lastRecoveryAt < TOOLKIT_RECOVERY_MIN_INTERVAL) return;

  state.lastRecoveryAt = now;
  state.didInjectScripts = false;
  state.injectAttempts = 0;
  slotLog(index, "toolkit recovery", reason || "missing");
  scheduleInjectScripts(index, webview, reason || "watchdog", 0);
}

async function checkToolkitHealth(index, webview, reason) {
  const state = slotState.get(index);
  if (!state || state.stopped || state.injectingScripts) return;
  if (!canUseToolkitContext(index, webview)) return;

  try {
    const health = await webview.executeJavaScript(buildToolkitHealthPayload(), true);

    if (health && health.ok) {
      markToolkitHealthy(index);
      return;
    }

    if (health && health.body && health.forceInit && (health.hasPanelObject || !health.panel)) {
      const panelReady = await webview.executeJavaScript(buildPanelEnsurePayload(), true);
      if (panelReady) {
        markToolkitHealthy(index);
        return;
      }
    }

    recoverToolkit(index, webview, reason || "watchdog-missing");
  } catch (error) {
    recoverToolkit(index, webview, reason || "watchdog-error");
  }
}

function startToolkitWatchdog(index, webview) {
  const state = slotState.get(index);
  if (!state || state.stopped || state.watchdogTimer) return;

  state.watchdogTimer = setInterval(() => {
    checkToolkitHealth(index, webview, "watchdog");
  }, TOOLKIT_WATCHDOG_INTERVAL);

  if (state.watchdogStartTimer) clearTimeout(state.watchdogStartTimer);
  state.watchdogStartTimer = setTimeout(() => {
    state.watchdogStartTimer = null;
    checkToolkitHealth(index, webview, "watchdog-start");
  }, 2500);
}
`;

module.exports = {
  source
};
