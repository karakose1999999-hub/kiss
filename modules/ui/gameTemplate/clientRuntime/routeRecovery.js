const source = String.raw`function finishSuspiciousRouteRecovery(index, reason, meta) {
  const state = slotState.get(index);
  if (!state || !state.suspiciousRouteRecovery) return;

  const recovery = state.suspiciousRouteRecovery;
  if (!recovery.inFlight) return;

  recovery.inFlight = false;
  slotLog(index, "suspicious route recovery " + reason, Object.assign({
    beforeUrl: recovery.beforeUrl,
    targetRoomId: recovery.targetRoomId,
    attemptCount: recovery.attemptCount,
    lastKnownRoomId: getFreshSlotRoomId(index),
    statusText: getSlotStatusText(index)
  }, meta || {}));
}

function readWebviewRoomId(index, webview) {
  if (!webview) return Promise.resolve("");

  try {
    return webview.executeJavaScript(
      "(function(){try{function n(v){var t=String(v||'').trim();return /^\\d+$/.test(t)&&t!=='0'?t:'';}return n(window.__KISS_LAST_ROOM_ID)||n(localStorage.getItem('kiss_hidden_last_room_id'));}catch(_){return '';}})();",
      true
    ).then(roomId => {
      const id = normalizeRoomId(roomId);
      if (id) rememberSlotRoomId(index, id, Date.now());
      return id;
    }).catch(() => "");
  } catch (_) {
    return Promise.resolve("");
  }
}

function runRecoveryFollowFetch(webview, anchorUid) {
  const uid = normalizeUserId(anchorUid);
  if (!webview || !uid) return Promise.resolve({ ok: false, skipped: "invalid-anchor" });

  const payload = JSON.stringify(uid);
  const script = [
    "(async function(){",
    "try {",
    "var friendId = " + payload + ";",
    "function n(v){var t=String(v||'').trim();return /^\\d+$/.test(t)&&t!=='0'?t:'';}",
    "var body = new URLSearchParams({ friend_id: String(friendId), userLocalTime: String(Math.floor(Date.now()/1000)), sessnew: '' });",
    "var res = await fetch('/api/room/sit_down_to_friend', {",
    "method: 'POST',",
    "credentials: 'include',",
    "headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01' },",
    "body: body",
    "});",
    "var data = await res.json().catch(function(){ return null; });",
    "var returnedRoomId = n(data && data.status && (data.status.room_id !== undefined ? data.status.room_id : data.status.roomId)) || n(data && (data.room_id || data.roomId));",
    "return { ok: !!res.ok, status: res.status, result: data && data.result, error: data && data.error, returnedRoomId: returnedRoomId, data: data };",
    "} catch (error) {",
    "return { ok: false, error: String(error && error.message ? error.message : error) };",
    "}",
    "})();"
  ].join("");

  try {
    return webview.executeJavaScript(script, true).catch(error => ({
      ok: false,
      error: String(error && error.message ? error.message : error)
    }));
  } catch (error) {
    return Promise.resolve({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function logSuspiciousRoutePending(index, webview, reason, eventMeta) {
  const state = slotState.get(index);
  if (!state || !webview) return false;

  const url = String(eventMeta && eventMeta.url || getWebviewUrl(webview) || "");
  if (!isSuspiciousGameUrl(url)) return false;
  const lastKnownRoomId = getFreshSlotRoomId(index);

  if (lastKnownRoomId) {
    correlateWitnessDisplacement(index, {
      reason: "suspicious-route-pending",
      oldRoomId: lastKnownRoomId,
      newRoomId: "",
      url,
      at: Date.now()
    }, true);
  }

  slotLog(index, "suspicious route recovery pending", {
    reason,
    url,
    currentUrl: getWebviewUrl(webview),
    isMainFrame: eventMeta && Object.prototype.hasOwnProperty.call(eventMeta, "isMainFrame") ? eventMeta.isMainFrame : true,
    lastKnownRoomId,
    statusText: getSlotStatusText(index)
  });

  return true;
}

async function recoverSuspiciousRoute(index, webview, reason, eventMeta) {
  const state = slotState.get(index);
  if (!state || !webview) return false;

  const recovery = state.suspiciousRouteRecovery;
  const url = String(eventMeta && eventMeta.url || getWebviewUrl(webview) || "");
  if (!isSuspiciousGameUrl(url)) return false;

  const now = Date.now();
  const isMainFrame = eventMeta && Object.prototype.hasOwnProperty.call(eventMeta, "isMainFrame")
    ? eventMeta.isMainFrame
    : true;
  const baseMeta = {
    reason,
    url,
    currentUrl: getWebviewUrl(webview),
    isMainFrame,
    lastKnownRoomId: getFreshSlotRoomId(index),
    statusText: getSlotStatusText(index)
  };

  if (baseMeta.lastKnownRoomId) {
    correlateWitnessDisplacement(index, {
      reason: "suspicious-route-landed",
      oldRoomId: baseMeta.lastKnownRoomId,
      newRoomId: "",
      url,
      at: now
    }, true);
  }

  let blockReason = "";
  if (isMainFrame === false) blockReason = "not-main-frame";
  else if (!state.hasSeenTargetUrl && !isTargetUrl(baseMeta.currentUrl) && !isTargetUrl(url)) blockReason = "target-not-seen";
  else if (recovery && recovery.inFlight) blockReason = "in-flight";
  else if (recovery && recovery.lastRecoveryAt && now - recovery.lastRecoveryAt < SUSPICIOUS_ROUTE_RECOVERY_COOLDOWN) {
    blockReason = "cooldown";
  }

  if (blockReason) {
    slotLog(index, "suspicious route recovery blocked", Object.assign({}, baseMeta, {
      blockReason,
      cooldownRemainingMs: blockReason === "cooldown"
        ? SUSPICIOUS_ROUTE_RECOVERY_COOLDOWN - (now - recovery.lastRecoveryAt)
        : 0
    }));
    return false;
  }

  let lastKnownRoomId = getFreshSlotRoomId(index);
  let roomIdSource = "parent";
  if (!lastKnownRoomId) {
    lastKnownRoomId = await readWebviewRoomId(index, webview);
    roomIdSource = lastKnownRoomId ? "webview" : "";
  }

  if (!lastKnownRoomId) {
    slotLog(index, "suspicious route recovery blocked", Object.assign({}, baseMeta, {
      blockReason: "missing-fresh-room",
      cooldownRemainingMs: 0
    }));
    return false;
  }

  const rosterSnapshot = getFreshRosterSnapshot(index, lastKnownRoomId);
  if (!rosterSnapshot) {
    slotLog(index, "suspicious route recovery blocked", Object.assign({}, baseMeta, {
      blockReason: "missing-anchor-player",
      targetRoomId: lastKnownRoomId,
      roomIdSource,
      cooldownRemainingMs: 0
    }));
    return false;
  }

  const anchorUid = rosterSnapshot.playerUids[0];
  if (!anchorUid) {
    slotLog(index, "suspicious route recovery blocked", Object.assign({}, baseMeta, {
      blockReason: "missing-anchor-player",
      targetRoomId: lastKnownRoomId,
      roomIdSource,
      cooldownRemainingMs: 0
    }));
    return false;
  }

  recovery.inFlight = true;
  recovery.lastRecoveryAt = Date.now();
  recovery.attemptCount += 1;
  recovery.beforeUrl = baseMeta.currentUrl || url;
  recovery.targetRoomId = lastKnownRoomId;

  slotLog(index, "suspicious route recovery anchor-selected", Object.assign({}, baseMeta, {
    targetRoomId: lastKnownRoomId,
    roomIdSource,
    anchorUid,
    anchorCount: rosterSnapshot.playerUids.length,
    rosterAgeMs: Date.now() - rosterSnapshot.at,
    attemptCount: recovery.attemptCount
  }));

  slotLog(index, "suspicious route recovery follow-fetch", Object.assign({}, baseMeta, {
    targetRoomId: lastKnownRoomId,
    anchorUid,
    attemptCount: recovery.attemptCount
  }));

  const response = await runRecoveryFollowFetch(webview, anchorUid);
  const returnedRoomId = normalizeRoomId(response && response.returnedRoomId);
  const followOk = !!(response && response.ok && response.result && !response.error && returnedRoomId);

  slotLog(index, "suspicious route recovery follow-response", Object.assign({}, baseMeta, {
    targetRoomId: lastKnownRoomId,
    anchorUid,
    status: response && response.status,
    ok: response && response.ok,
    result: response && response.result,
    error: response && response.error,
    returnedRoomId,
    roomMatches: !!(returnedRoomId && returnedRoomId === lastKnownRoomId),
    attemptCount: recovery.attemptCount
  }));

  if (!followOk) {
    finishSuspiciousRouteRecovery(index, "blocked", {
      blockReason: "follow-failed",
      targetRoomId: lastKnownRoomId,
      anchorUid,
      returnedRoomId,
      error: response && response.error
    });
    return false;
  }

  rememberSlotRoomId(index, returnedRoomId, Date.now());

  try {
    slotLog(index, "suspicious route recovery navigate", Object.assign({}, baseMeta, {
      targetUrl: CLEAN_GAME_ROOM_URL,
      targetRoomId: lastKnownRoomId,
      returnedRoomId,
      anchorUid,
      roomMatches: returnedRoomId === lastKnownRoomId,
      attemptCount: recovery.attemptCount
    }));
    setSlotStatus(index, "Kurtariliyor", "warn");
    resetInjectState(index);
    if (typeof webview.loadURL === "function") {
      webview.loadURL(CLEAN_GAME_ROOM_URL);
    } else {
      webview.src = CLEAN_GAME_ROOM_URL;
    }
  } catch (error) {
    finishSuspiciousRouteRecovery(index, "blocked", {
      blockReason: "navigate-error",
      error: error && error.message ? error.message : error
    });
    return false;
  }

  return true;
}
`;

module.exports = {
  source
};
