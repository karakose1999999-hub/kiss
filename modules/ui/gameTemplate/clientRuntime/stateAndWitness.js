const source = String.raw`function getSlotStatusText(index) {
  const el = document.getElementById("slotStatus" + index);
  return el ? String(el.textContent || "") : "";
}

function normalizeRoomId(value) {
  const text = String(value || "").trim();
  return /^\\d+$/.test(text) && text !== "0" ? text : "";
}

function rememberSlotRoomId(index, roomId, at) {
  const state = slotState.get(index);
  const id = normalizeRoomId(roomId);
  if (!state || !id) return false;

  const time = Number(at || Date.now());
  const previousRoomId = normalizeRoomId(state.lastRoomId);
  const previousRoomAt = Number(state.lastRoomIdAt || 0);
  const eventAt = Number.isFinite(time) && time > 0 ? time : Date.now();

  state.lastRoomId = id;
  state.lastRoomIdAt = eventAt;

  if (previousRoomId && previousRoomId !== id && previousRoomAt && eventAt - previousRoomAt < WITNESS_ROSTER_MAX_AGE) {
    correlateWitnessDisplacement(index, {
      reason: "room-id-changed",
      oldRoomId: previousRoomId,
      newRoomId: id,
      at: eventAt
    }, true);
  }

  return true;
}

function normalizeUserId(value) {
  const text = String(value || "").trim();
  return /^\\d+$/.test(text) && text !== "0" ? text : "";
}

function rememberSlotRosterSnapshot(index, payload) {
  const state = slotState.get(index);
  if (!state || !payload) return false;

  const roomId = normalizeRoomId(payload.roomId);
  const ownUid = normalizeUserId(payload.ownUid);
  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  const allUids = ids
    .map(normalizeUserId)
    .filter(Boolean)
    .filter((id, position, list) => list.indexOf(id) === position);
  const playerUids = ids
    .map(normalizeUserId)
    .filter(id => id && id !== ownUid)
    .filter((id, position, list) => list.indexOf(id) === position);
  const joined = Array.isArray(payload.joined)
    ? payload.joined.map(normalizeUserId).filter(Boolean)
    : [];
  const left = Array.isArray(payload.left)
    ? payload.left.map(normalizeUserId).filter(Boolean)
    : [];

  if (!roomId || !ownUid) return false;

  const at = Number(payload.at || Date.now());
  const snapshot = {
    roomId,
    ownUid,
    allUids: allUids.slice(0, 16),
    playerUids: playerUids.slice(0, 12),
    joined: joined.slice(0, 12),
    left: left.slice(0, 12),
    count: Number(payload.count || allUids.length || 0) || 0,
    ownPresent: !!payload.ownPresent,
    selectors: payload.selectors || {},
    at: Number.isFinite(at) && at > 0 ? at : Date.now()
  };

  state.lastRosterSnapshot = snapshot;
  rememberSlotUserId(index, ownUid);
  state.rosterHistory = Array.isArray(state.rosterHistory) ? state.rosterHistory : [];
  state.rosterHistory.push(snapshot);
  state.rosterHistory = state.rosterHistory.filter(item => item && snapshot.at - Number(item.at || 0) <= WITNESS_ROSTER_MAX_AGE).slice(-30);

  correlateAllSlotsFromRoster(index, payload, snapshot);

  return true;
}

function snapshotHasUid(snapshot, uid) {
  const id = normalizeUserId(uid);
  if (!snapshot || !id) return false;

  const allUids = Array.isArray(snapshot.allUids) ? snapshot.allUids : [];
  const playerUids = Array.isArray(snapshot.playerUids) ? snapshot.playerUids : [];
  return allUids.includes(id) || playerUids.includes(id) || normalizeUserId(snapshot.ownUid) === id;
}

function findRecentWitnessSnapshot(witnessState, roomId, at) {
  if (!witnessState) return null;

  const targetRoomId = normalizeRoomId(roomId);
  const eventAt = Number(at || Date.now());
  const history = Array.isArray(witnessState.rosterHistory) ? witnessState.rosterHistory : [];
  let best = null;

  history.forEach(snapshot => {
    const snapshotRoomId = normalizeRoomId(snapshot && snapshot.roomId);
    const snapshotAt = Number(snapshot && snapshot.at || 0);
    if (!snapshotRoomId || snapshotRoomId !== targetRoomId || !snapshotAt) return;
    if (Math.abs(eventAt - snapshotAt) > WITNESS_ROSTER_MAX_AGE) return;
    if (!best || snapshotAt > Number(best.at || 0)) best = snapshot;
  });

  return best;
}

function findWitnessEvidence(victimIndex, oldRoomId, at) {
  const victimState = slotState.get(victimIndex);
  const victimUid = normalizeUserId(victimState && (victimState.authUserId || victimState.lastRosterSnapshot && victimState.lastRosterSnapshot.ownUid));
  const targetRoomId = normalizeRoomId(oldRoomId);
  if (!victimUid || !targetRoomId) return null;

  let best = null;
  slotState.forEach((witnessState, witnessIndex) => {
    if (witnessIndex === victimIndex || !witnessState) return;

    const witnessRoomId = normalizeRoomId(witnessState.lastRoomId);
    const witnessRoomAt = Number(witnessState.lastRoomIdAt || 0);
    const witnessStayed = witnessRoomId === targetRoomId && witnessRoomAt && Date.now() - witnessRoomAt <= WITNESS_ROSTER_MAX_AGE;
    const current = findRecentWitnessSnapshot(witnessState, targetRoomId, at);
    const history = Array.isArray(witnessState.rosterHistory) ? witnessState.rosterHistory : [];
    const recentInRoom = history.filter(snapshot => {
      const snapshotAt = Number(snapshot && snapshot.at || 0);
      return normalizeRoomId(snapshot && snapshot.roomId) === targetRoomId &&
        snapshotAt &&
        Math.abs(Number(at || Date.now()) - snapshotAt) <= WITNESS_ROSTER_MAX_AGE;
    });

    const hadVictim = recentInRoom.some(snapshot => snapshotHasUid(snapshot, victimUid));
    const currentHasVictim = current ? snapshotHasUid(current, victimUid) : false;
    const recentJoined = [];
    const recentLeft = [];
    recentInRoom.slice(-6).forEach(snapshot => {
      (Array.isArray(snapshot.joined) ? snapshot.joined : []).forEach(uid => {
        const id = normalizeUserId(uid);
        if (id && !recentJoined.includes(id)) recentJoined.push(id);
      });
      (Array.isArray(snapshot.left) ? snapshot.left : []).forEach(uid => {
        const id = normalizeUserId(uid);
        if (id && !recentLeft.includes(id)) recentLeft.push(id);
      });
    });

    const score = (witnessStayed ? 4 : 0) +
      (hadVictim ? 3 : 0) +
      (current && !currentHasVictim ? 2 : 0) +
      (recentJoined.length ? 1 : 0);

    if (!score) return;
    if (!best || score > best.score) {
      best = {
        score,
        witnessIndex,
        witnessRoomId,
        witnessStayed,
        victimUid,
        hadVictim,
        currentHasVictim,
        recentJoined: recentJoined.slice(0, 10),
        recentLeft: recentLeft.slice(0, 10),
        witnessSnapshot: current ? {
          roomId: current.roomId,
          ownUid: current.ownUid,
          count: current.count,
          ownPresent: current.ownPresent,
          ids: (Array.isArray(current.allUids) ? current.allUids : []).slice(0, 14),
          at: current.at
        } : null
      };
    }
  });

  return best;
}

function buildWitnessMissSummary(victimIndex, oldRoomId, at) {
  const targetRoomId = normalizeRoomId(oldRoomId);
  const eventAt = Number(at || Date.now());
  const witnesses = [];

  slotState.forEach((witnessState, witnessIndex) => {
    if (witnessIndex === victimIndex || !witnessState) return;

    const last = witnessState.lastRosterSnapshot || {};
    const history = Array.isArray(witnessState.rosterHistory) ? witnessState.rosterHistory : [];
    const inRoom = history.filter(snapshot => {
      const snapshotAt = Number(snapshot && snapshot.at || 0);
      return normalizeRoomId(snapshot && snapshot.roomId) === targetRoomId &&
        snapshotAt &&
        Math.abs(eventAt - snapshotAt) <= WITNESS_ROSTER_MAX_AGE;
    });

    witnesses.push({
      slot: witnessIndex + 1,
      lastRoomId: normalizeRoomId(witnessState.lastRoomId),
      lastRoomAgeMs: witnessState.lastRoomIdAt ? Date.now() - Number(witnessState.lastRoomIdAt || 0) : null,
      lastRosterRoomId: normalizeRoomId(last.roomId),
      lastRosterAgeMs: last.at ? Date.now() - Number(last.at || 0) : null,
      lastRosterCount: Number(last.count || 0) || 0,
      lastRosterOwnPresent: !!last.ownPresent,
      lastRosterIds: (Array.isArray(last.allUids) ? last.allUids : []).slice(0, 8),
      matchingHistoryCount: inRoom.length
    });
  });

  return witnesses;
}

function correlateWitnessDisplacement(victimIndex, event, logMiss) {
  const victimState = slotState.get(victimIndex);
  if (!victimState || !event) return;

  const now = Date.now();
  if (victimState.lastWitnessLogAt && now - victimState.lastWitnessLogAt < WITNESS_DISPLACEMENT_LOG_COOLDOWN) return;

  const oldRoomId = normalizeRoomId(event.oldRoomId);
  const evidence = findWitnessEvidence(victimIndex, oldRoomId, event.at || now);
  if (!evidence) {
    if (logMiss) {
      victimState.lastWitnessLogAt = now;
      slotLog(victimIndex, "witness-correlation-miss", {
        reason: event.reason,
        oldRoomId,
        newRoomId: normalizeRoomId(event.newRoomId),
        suspiciousUrl: event.url || "",
        victimUid: normalizeUserId(victimState.authUserId || victimState.lastRosterSnapshot && victimState.lastRosterSnapshot.ownUid),
        witnesses: buildWitnessMissSummary(victimIndex, oldRoomId, event.at || now),
        at: event.at || now
      });
    }
    return;
  }

  victimState.lastWitnessLogAt = now;
  slotLog(victimIndex, "witness-correlation-check", {
    reason: event.reason,
    oldRoomId,
    newRoomId: normalizeRoomId(event.newRoomId),
    suspiciousUrl: event.url || "",
    victimUid: evidence.victimUid,
    witnessSlot: evidence.witnessIndex + 1,
    confidence: evidence.score >= 7 ? "high" : evidence.score >= 4 ? "medium" : "low",
    at: event.at || now
  });
  slotLog(victimIndex, "witnessed-seat-displacement", {
    reason: event.reason,
    oldRoomId,
    newRoomId: normalizeRoomId(event.newRoomId),
    suspiciousUrl: event.url || "",
    victimUid: evidence.victimUid,
    witnessSlot: evidence.witnessIndex + 1,
    witnessRoomId: evidence.witnessRoomId,
    witnessStayed: evidence.witnessStayed,
    hadVictimRecently: evidence.hadVictim,
    witnessStillSeesVictim: evidence.currentHasVictim,
    recentJoined: evidence.recentJoined,
    recentLeft: evidence.recentLeft,
    confidence: evidence.score >= 7 ? "high" : evidence.score >= 4 ? "medium" : "low",
    witnessSnapshot: evidence.witnessSnapshot,
    at: event.at || now
  });
}

function correlateAllSlotsFromRoster(witnessIndex, payload, witnessSnapshot) {
  const roomId = normalizeRoomId(witnessSnapshot && witnessSnapshot.roomId);
  if (!roomId) return;

  slotState.forEach((victimState, victimIndex) => {
    if (victimIndex === witnessIndex || !victimState) return;

    const victimUid = normalizeUserId(victimState.authUserId || victimState.lastRosterSnapshot && victimState.lastRosterSnapshot.ownUid);
    const victimRoomId = normalizeRoomId(victimState.lastRoomId);
    if (!victimUid || !victimRoomId || victimRoomId === roomId) return;

    const witnessHasVictim = snapshotHasUid(witnessSnapshot, victimUid);
    const left = Array.isArray(payload && payload.left) ? payload.left.map(normalizeUserId).filter(Boolean) : [];
    if (!witnessHasVictim && !left.includes(victimUid)) return;

    correlateWitnessDisplacement(victimIndex, {
      reason: left.includes(victimUid) ? "witness-roster-left" : "witness-roster-still-sees-victim",
      oldRoomId: roomId,
      newRoomId: victimRoomId,
      at: Number(witnessSnapshot.at || Date.now())
    });
  });
}

function getFreshSlotRoomId(index) {
  const state = slotState.get(index);
  if (!state) return "";

  const id = normalizeRoomId(state.lastRoomId);
  const at = Number(state.lastRoomIdAt || 0);
  if (!id || !at || Date.now() - at > KISS_ROOM_ID_MAX_AGE) return "";

  return id;
}

function getFreshRosterSnapshot(index, roomId) {
  const state = slotState.get(index);
  if (!state || !state.lastRosterSnapshot) return null;

  const snapshot = state.lastRosterSnapshot;
  const id = normalizeRoomId(snapshot.roomId);
  const at = Number(snapshot.at || 0);
  if (!id || !at || Date.now() - at > KISS_ROOM_ID_MAX_AGE) return null;
  if (roomId && id !== roomId) return null;

  const playerUids = Array.isArray(snapshot.playerUids)
    ? snapshot.playerUids.map(normalizeUserId).filter(Boolean)
    : [];
  if (!playerUids.length) return null;

  return {
    roomId: id,
    ownUid: normalizeUserId(snapshot.ownUid),
    playerUids,
    at
  };
}

function rememberSlotUserId(index, userId) {
  const state = slotState.get(index);
  const id = String(userId || "").trim();
  if (!state || !/^\d+$/.test(id)) return false;

  if (state.authUserId && state.authUserId !== id && userSlotMap.get(state.authUserId) === index) {
    userSlotMap.delete(state.authUserId);
  }

  state.authUserId = id;
  userSlotMap.set(id, index);
  broadcastSlotUserIds();
  return true;
}

function broadcastSlotUserIds() {
  const ids = Array.from(userSlotMap.keys()).filter(Boolean);
  const payload = JSON.stringify(ids);

  entries.forEach((_entry, index) => {
    const webview = getGameWebview(index);
    if (!webview || !isTargetUrl(getWebviewUrl(webview))) return;

    try {
      webview.executeJavaScript(
        "try{window.__KISS_ALL_SLOT_USER_IDS=" + payload + ";}catch(_){}",
        true
      ).catch(() => {});
    } catch (_) {}
  });
}
`;

module.exports = {
  source
};
