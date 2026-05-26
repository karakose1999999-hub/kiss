const source = String.raw`function accountAllowsKissFallback(index) {
  const moduleSettings = options.moduleSettings || {};
  if (moduleSettings.autoKiss !== true) return false;

  const entry = entries[index] || {};
  const raw = entry.accountScriptSettings && entry.accountScriptSettings.kiss_toolkit_autoSpinTab1;
  if (!raw) return true;

  try {
    const parsed = JSON.parse(raw);
    return !(parsed && parsed.manualStopped && parsed.manualStopped.kiss === true);
  } catch (_) {
    return true;
  }
}

function canUseKissFallbackContext(index, webview) {
  const state = slotState.get(index);
  if (!state || !webview) return false;
  if (state.stopped) return false;
  if (!accountAllowsKissFallback(index)) return false;

  const url = getWebviewUrl(webview);
  if (isTargetUrl(url)) state.hasSeenTargetUrl = true;

  return state.hasSeenTargetUrl || isTargetUrl(url);
}

function buildKissFallbackPayload() {
  return [
    "(async function(){",
    "var MAX_ROOM_AGE = " + KISS_ROOM_ID_MAX_AGE + ";",
    "var AUTO_RESPONSE_MAX_AGE = " + KISS_AUTO_RESPONSE_MAX_AGE + ";",
    "var ANSWERS = ['3','2'];",
    "function now(){return Date.now ? Date.now() : new Date().getTime();}",
    "function num(v){var t=String(v||'').trim();return /^\\d+$/.test(t)&&t!=='0'?t:'';}",
    "function rememberRoom(v){try{var id=num(v);if(!id||id==='0')return '';var at=now();window.__KISS_LAST_ROOM_ID=id;window.__KISS_LAST_ROOM_ID_AT=at;localStorage.setItem('kiss_hidden_last_room_id',id);localStorage.setItem('kiss_hidden_last_room_id_at',String(at));try{console.log('__KISS_ROOM_ID__'+JSON.stringify({roomId:id,at:at}));}catch(_){}return id;}catch(_){return '';}}",
    "function capture(data){try{if(!data||typeof data!=='object')return '';return rememberRoom((data.status&&(data.status.room_id||data.status.roomId))||data.room_id||data.roomId);}catch(_){return '';}}",
    "function toolkitHealthy(){try{return !!(document.getElementById('kiss-toolkit-panel') && window._injectedScripts && window._injectedScripts['main.user.js'] && typeof window.__KISS_FORCE_TOOLKIT_INIT === 'function');}catch(_){return false;}}",
    "function autoKissRecent(){try{var at=Number(window.__KISS_AUTO_KISS_LAST_RESPONSE_AT||0);return !!(at&&now()-at<=AUTO_RESPONSE_MAX_AGE);}catch(_){return false;}}",
    "function suspiciousRoute(){try{return String(location.href||'').indexOf('=undefined')!==-1;}catch(_){return false;}}",
    "function logFallback(label,payload){try{console.log('[KISS FALLBACK] '+label+' '+JSON.stringify(payload||{}));}catch(_){try{console.log('[KISS FALLBACK] '+label);}catch(__){}}}",
    "function logMissingRoom(payload){try{var at=now();if(window.__KISS_FALLBACK_LAST_MISSING_LOG_AT&&at-Number(window.__KISS_FALLBACK_LAST_MISSING_LOG_AT)<60000)return;window.__KISS_FALLBACK_LAST_MISSING_LOG_AT=at;logFallback('decision',payload);}catch(_){}}",
    "function freshRoom(id,at){id=num(id);at=Number(at||0);return !!(id&&at&&now()-at<=MAX_ROOM_AGE);}",
    "function topfaceRoomId(){try{for(var i=0;i<localStorage.length;i++){var key=String(localStorage.key(i)||'');if(key.indexOf('topface_stprev_room_id')!==0)continue;var raw=localStorage.getItem(key);var direct=num(raw);if(direct)return direct;try{var parsed=JSON.parse(raw);var nested=num(parsed&&parsed.data&&parsed.data.value);if(nested)return nested;}catch(_){}}}catch(_){}return '';}",
    "function readRoom(){var id=num(window.__KISS_LAST_ROOM_ID);var at=Number(window.__KISS_LAST_ROOM_ID_AT||0);if(freshRoom(id,at))return id;id=num(window.__KISS_AUTO_KISS_LAST_ROOM_ID);at=Number(window.__KISS_AUTO_KISS_LAST_ROOM_ID_AT||window.__KISS_AUTO_KISS_LAST_RESPONSE_AT||0);if(freshRoom(id,at))return id;try{id=num(localStorage.getItem('kiss_hidden_last_room_id'));at=Number(localStorage.getItem('kiss_hidden_last_room_id_at')||0);if(freshRoom(id,at))return id;}catch(_){}id=topfaceRoomId();if(id)return rememberRoom(id);var roomEl=document.querySelector('[data-room-id],[data-roomid]');if(roomEl){id=rememberRoom(roomEl.getAttribute('data-room-id')||roomEl.getAttribute('data-roomid'));if(id)return id;}return '';}",
    "try {",
    "var healthy = toolkitHealthy();",
    "var recent = autoKissRecent();",
    "var suspicious = suspiciousRoute();",
    "if (healthy && recent) return { skipped: 'auto-kiss-recent', toolkitHealthy: healthy, autoKissRecent: recent, suspiciousRoute: suspicious };",
    "var roomId = readRoom();",
    "if (!roomId) { logMissingRoom({source:'webview',reason:'missing-room-id',href:String(location.href||''),toolkitHealthy:healthy,autoKissRecent:recent,suspiciousRoute:suspicious,answers:ANSWERS}); return { skipped: 'no-room', toolkitHealthy: healthy, autoKissRecent: recent }; }",
    "if (window.__KISS_FALLBACK_KISS_INFLIGHT) return { skipped: 'inflight' };",
    "window.__KISS_FALLBACK_KISS_INFLIGHT = true;",
    "try {",
    "logFallback('decision',{source:'webview',reason:suspicious?'suspicious-route':'auto-kiss-stale',href:String(location.href||''),roomId:roomId,toolkitHealthy:healthy,autoKissRecent:recent,answers:ANSWERS});",
    "var responses = [];",
    "var nextRoomId = roomId;",
    "for (var i=0;i<ANSWERS.length;i++){var answer=ANSWERS[i];var body = new URLSearchParams({ roomId: String(nextRoomId || roomId), answer: String(answer), userLocalTime: String(Math.floor(now() / 1000)), sessnew: '' }).toString();var res = await fetch('https://getkisskiss.com/api/room/roulette_answer/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01' }, body: body, credentials: 'same-origin', cache: 'no-store' });var data = await res.json().catch(function(){ return null; });nextRoomId = capture(data) || nextRoomId || roomId;var at=now();window.__KISS_FALLBACK_LAST_RESPONSE_AT=at;window.__KISS_FALLBACK_LAST_ROOM_ID=String(nextRoomId||roomId||'');var item={answer:String(answer),ok:!!res.ok,status:res.status,result:data&&data.result,error:data&&data.error,roomId:nextRoomId};responses.push(item);logFallback('response',Object.assign({source:'webview'},item));}",
    "return { sent: true, ok: responses.some(function(item){return item && item.ok;}), responses: responses, roomId: nextRoomId, toolkitHealthy: healthy, autoKissRecent: recent };",
    "} finally { window.__KISS_FALLBACK_KISS_INFLIGHT = false; }",
    "} catch (error) { try { window.__KISS_FALLBACK_KISS_INFLIGHT = false; } catch (_) {} return { error: String(error && error.message ? error.message : error) }; }",
    "})();"
  ].join("");
}

async function runHostKissFallback(index, options = {}) {
  const state = slotState.get(index);
  const entry = entries[index] || {};
  const roomId = normalizeRoomId(options.roomId || "") || getFreshSlotRoomId(index);
  const webview = getGameWebview(index);
  if (!state || state.stopped || !roomId || !entry.accountId || !entry.partition) return null;

  try {
    const result = await ipcRenderer.invoke("kiss-fallback-answer", {
      accountId: String(entry.accountId),
      partition: String(entry.partition),
      roomId,
      answers: ["3", "2"]
    });

    if (result && result.roomId) {
      rememberSlotRoomId(index, result.roomId, Date.now());
      try {
        const payload = JSON.stringify(String(result.roomId || roomId || ""));
        webview.executeJavaScript(
          "(function(){try{var at=Date.now();window.__KISS_FALLBACK_LAST_RESPONSE_AT=at;window.__KISS_FALLBACK_LAST_ROOM_ID=" + payload + ";}catch(_){}})();",
          false
        );
      } catch (_) {}
    }

    if (result && options.force) {
      slotLog(index, "[KISS FALLBACK HOST] force", {
        source: "host",
        reason: options.reason || "force",
        roomId: result && result.roomId || roomId,
        ok: !!(result && result.ok),
        skipped: result && result.skipped,
        error: result && result.error
      });
    } else if (result && (!result.ok || result.skipped || result.error)) {
      slotLog(index, "[KISS FALLBACK HOST] issue", {
        source: "host",
        roomId: result && result.roomId || roomId,
        ok: !!(result && result.ok),
        skipped: result && result.skipped,
        error: result && result.error
      });
    }

    return result || null;
  } catch (_) {
    return null;
  }
}

async function runHostKissFallbackBurst(reason, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 1) || 1);
  const spacingMs = Math.max(0, Number(options.spacingMs || 0) || 0);
  const force = options.force !== false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await Promise.all(entries.map((_entry, index) => {
      const state = slotState.get(index);
      const roomId = getFreshSlotRoomId(index);
      if (!state || !roomId) return Promise.resolve(null);
      return runHostKissFallback(index, {
        force,
        reason,
        roomId
      });
    }));
    if (attempt < attempts - 1 && spacingMs > 0) {
      await new Promise(resolve => setTimeout(resolve, spacingMs));
    }
  }
}

function scheduleHostKissFallbackBurst(reason, options = {}) {
  runHostKissFallbackBurst(reason, options).catch(error => {
    try {
      console.log("[KISS FALLBACK HOST] burst-error " + JSON.stringify({
        reason,
        error: String(error && error.message ? error.message : error || "")
      }));
    } catch (_) {}
  });
}

async function runKissFallback(index, webview, reason) {
  const state = slotState.get(index);
  if (!state || state.stopped || state.kissFallbackInflight) return;
  if (!canUseKissFallbackContext(index, webview)) return;

  const now = Date.now();
  if (now - state.lastKissFallbackAt < KISS_FALLBACK_MIN_ACTION_INTERVAL) return;
  state.lastKissFallbackAt = now;
  state.kissFallbackInflight = true;

  try {
    let result = null;

    try {
      result = await webview.executeJavaScript(buildKissFallbackPayload(), true);
      if (result && result.roomId) {
        rememberSlotRoomId(index, result.roomId, Date.now());
      }
    } catch (_) {
      result = { error: "webview-context" };
    }

    if (result && result.sent) {
      return;
    }

    if (result && result.skipped === "auto-kiss-recent") {
      state.lastToolkitHealthyAt = Date.now();
      return;
    }

    if (result && result.skipped === "inflight") {
      return;
    }

    await runHostKissFallback(index);
  } finally {
    state.kissFallbackInflight = false;
  }
}

function startKissFallback(index, webview) {
  const state = slotState.get(index);
  if (!state || state.stopped || state.kissFallbackTimer) return;

  state.kissFallbackTimer = setInterval(() => {
    runKissFallback(index, webview, "fallback-interval");
  }, KISS_FALLBACK_INTERVAL);
}

function buildWebviewLoginPayload(index) {
  const entry = entries[index] || {};
  const account = entry.account || {};
  const username = String(account.username || entry.username || "");
  const password = String(account.password || "");

  return [
    "(async function(){",
    "try {",
    "var username = " + JSON.stringify(username) + ";",
    "var password = " + JSON.stringify(password) + ";",
    "var body = new URLSearchParams({ socialId: username, password: password }).toString();",
    "var res = await fetch('/api/session/auth', {",
    "method: 'POST',",
    "headers: {",
    "'accept': '*/*',",
    "'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',",
    "'x-requested-with': 'XMLHttpRequest'",
    "},",
    "body: body,",
    "credentials: 'same-origin',",
    "cache: 'no-store'",
    "});",
    "var text = await res.text();",
    "var authUserId = '';",
    "try {",
    "var data = JSON.parse(text);",
    "if (data && data.type === 'authorization' && data.userId) {",
    "authUserId = String(data.userId);",
    "window.__KISS_AUTH_USER_ID = authUserId;",
    "try { localStorage.setItem('kiss_auth_user_id', authUserId); } catch (_) {}",
    "try { console.log('__KISS_AUTH_USER_ID__' + JSON.stringify({ userId: authUserId, at: Date.now(), source: 'webview-login' })); } catch (_) {}",
    "}",
    "} catch (_) {}",
    "return { ok: res.ok, status: res.status, userId: authUserId };",
    "} catch (error) {",
    "return { ok: false, status: 0, error: String(error && error.message ? error.message : error) };",
    "}",
    "})();"
  ].join("");
}

function buildLoginPageProbePayload() {
  return [
    "(function(){",
    "try {",
    "function visible(el){try{if(!el)return false;var s=getComputedStyle(el);var r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1;}catch(_){return !!el;}}",
    "var href=String(location.href||'');",
    "var password=Array.prototype.slice.call(document.querySelectorAll('input[type=password]')).some(visible);",
    "var loginInput=Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){try{if(!visible(el))return false;var t=String((el.getAttribute('name')||'')+' '+(el.getAttribute('type')||'')+' '+(el.getAttribute('placeholder')||'')+' '+(el.getAttribute('autocomplete')||'')).toLowerCase();return /login|email|mail|phone|tel|social|password|şifre|sifre/.test(t);}catch(_){return false;}});",
    "var submit=Array.prototype.slice.call(document.querySelectorAll('button,input[type=submit],a')).some(function(el){try{if(!visible(el))return false;var t=String(el.textContent||el.value||'').replace(/\\s+/g,' ').trim();return /giriş|giris|login|sign in|devam|continue/i.test(t);}catch(_){return false;}});",
    "var roomLike=!!document.querySelector('.player[data-uid][data-pid],button.splash--start-button.js-start-kiss,#kiss-toolkit-panel');",
    "var loginPage=!!((password||loginInput||submit)&&!roomLike);",
    "return {loginPage:loginPage,password:password,loginInput:loginInput,submit:submit,roomLike:roomLike,href:href,title:String(document.title||'')};",
    "} catch (error) {",
    "return {loginPage:false,error:String(error&&error.message?error.message:error),href:String(location.href||'')};",
    "}",
    "})();"
  ].join("");
}

function withTimeout(promise, ms, label) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, status: 0, error: String(label || "timeout") });
    }, Math.max(1000, Number(ms || 0) || 1000));

    promise.then(result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    }).catch(error => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, status: 0, error: String(error && error.message ? error.message : error) });
    });
  });
}

function scheduleLoginPageRetry(index, webview, reason) {
  const state = slotState.get(index);
  if (!state || state.stopped || !state.loginPageActive) return;
  if (state.loginRetryTimer) clearTimeout(state.loginRetryTimer);

  state.loginRetryTimer = setTimeout(() => {
    state.loginRetryTimer = null;
    if (!state || state.stopped || !state.loginPageActive || state.loginActionInFlight) return;
    handleLoginPageIfNeeded(index, webview, reason || "login-page-retry").catch(error => {
      slotLog(index, "login page retry failed", error && error.message ? error.message : error);
    });
  }, 12000);
}

function runWebviewLoginThenReload(index, webview, loginOptions = {}) {
  const state = slotState.get(index);
  const entry = entries[index] || {};
  const forced = !!loginOptions.force;
  if (!forced && !options.loginRefreshAfterLoad) return false;
  if (!state || state.stopped || state.loginActionInFlight) return false;
  if (!forced && state.didWebviewLogin) return false;
  if (!forced && !entry.loginOk) return false;
  if (!forced && entry.loginMode === "preserve-session") {
    state.loginReloadStarted = true;
    return false;
  }

  const now = Date.now();
  if (forced && state.lastLoginAttemptAt && now - Number(state.lastLoginAttemptAt || 0) < 12000) {
    setSlotLoginOverlay(index, true, "Giriş bekleniyor", "Son deneme tamamlanıyor. Kısa süre sonra tekrar kontrol edilecek.");
    return true;
  }

  state.loginActionInFlight = true;
  state.lastLoginAttemptAt = now;
  state.loginAttemptCount = Number(state.loginAttemptCount || 0) + 1;
  state.didWebviewLogin = true;

  setSlotStatus(index, "Giriş", "warn");
  setSlotLoginOverlay(index, true, forced ? "Giriş sayfası algılandı" : "Oturum yenileniyor", "Hesaba otomatik giriş deneniyor. Lütfen bekle.");
  notifyRuntimeStatus(index, "loading", forced ? "Login page detected" : "Webview login");
  slotLog(index, forced ? "login page login scheduled" : "webview login scheduled", {
    reason: loginOptions.reason || ""
  });

  const loginTimer = setTimeout(async () => {
    try {
      if (state.stopped) return;
      setSlotLoginOverlay(index, true, "Giriş yapılıyor", "Oturum bilgileri güvenli istekle yenileniyor.");
      const result = await withTimeout(
        webview.executeJavaScript(buildWebviewLoginPayload(index), true),
        7000,
        "webview-login-timeout"
      );

      slotLog(index, "webview login result", {
        ok: !!(result && result.ok),
        status: result && result.status,
        userId: result && result.userId,
        error: result && result.error
      });

      if (!result || !result.ok) {
        state.didWebviewLogin = !forced;
        setSlotStatus(index, "Giriş hata", "bad");
        setSlotLoginOverlay(index, true, "Giriş başarısız", "Login sayfası gizli tutuluyor. Bir sonraki kontrolde yeniden denenecek.");
        notifyRuntimeStatus(index, "login-lost", forced ? "Login page auto login failed" : "Webview login failed", {
          error: true,
          loginStatus: result && result.status || 0
        });
        if (forced) scheduleLoginPageRetry(index, webview, "login-page-failed");
        return;
      }

      if (state.stopped) return;
      setSlotStatus(index, "Yenileniyor", "warn");
      setSlotLoginOverlay(index, true, "Oturum yenilendi", "Oyun odası yeniden yükleniyor.");
      state.loginPageActive = false;
      if (state.loginRetryTimer) {
        clearTimeout(state.loginRetryTimer);
        state.loginRetryTimer = null;
      }
      state.loginReloadStarted = true;
      resetInjectState(index);
      notifyRuntimeStatus(index, "loading", "Login reload", {
        authUserId: result.userId || "",
        source: "webview-login",
        reload: true
      });

      try {
        webview.reload();
      } catch (error) {
        slotLog(index, "login reload failed", error && error.message ? error.message : error);
      }
      scheduleInjectScripts(index, webview, "login-reload", 900);
    } catch (error) {
      slotLog(index, "webview login failed", error && error.message ? error.message : error);
      if (forced) state.didWebviewLogin = false;
      setSlotStatus(index, "Giriş hata", "bad");
      setSlotLoginOverlay(index, true, "Giriş hatası", "Login ekranı kapalı tutuluyor. Sistem tekrar deneyecek.");
      notifyRuntimeStatus(index, "login-lost", "Webview login error", {
        error: true
      });
      if (forced) scheduleLoginPageRetry(index, webview, "login-page-error");
    } finally {
      state.loginActionInFlight = false;
      if (state.loginTimer === loginTimer) state.loginTimer = null;
    }
  }, 250);

  if (state.loginTimer) clearTimeout(state.loginTimer);
  state.loginTimer = loginTimer;
  return true;
}

async function handleLoginPageIfNeeded(index, webview, reason) {
  const state = slotState.get(index);
  if (!state || state.stopped || !webview || isBlankUrl(getWebviewUrl(webview)) || !isTargetUrl(getWebviewUrl(webview))) return false;

  let probe = null;
  try {
    probe = await withTimeout(
      webview.executeJavaScript(buildLoginPageProbePayload(), true),
      2500,
      "login-page-probe-timeout"
    );
  } catch (error) {
    probe = { loginPage: false, error: String(error && error.message ? error.message : error) };
  }

  if (!(probe && probe.loginPage)) {
    state.loginPageActive = false;
    if (state.loginRetryTimer) {
      clearTimeout(state.loginRetryTimer);
      state.loginRetryTimer = null;
    }
    if (!state.loginActionInFlight) {
      setSlotLoginOverlay(index, false);
    }
    return false;
  }

  state.loginPageActive = true;
  setSlotStatus(index, "Giriş gerekiyor", "warn");
  setSlotLoginOverlay(index, true, "Giriş sayfası algılandı", "Bu slot için kayıtlı hesapla giriş deneniyor.");
  notifyRuntimeStatus(index, "loading", "Login page detected", {
    href: probe.href || getWebviewUrl(webview),
    source: reason || "login-page-probe"
  });
  slotLog(index, "login page detected", {
    reason,
    href: probe.href || "",
    password: !!probe.password,
    submit: !!probe.submit,
    attemptCount: state.loginAttemptCount || 0
  });

  runWebviewLoginThenReload(index, webview, {
    force: true,
    reason: reason || "login-page-detected"
  });
  return true;
}
`;

module.exports = {
  source
};
