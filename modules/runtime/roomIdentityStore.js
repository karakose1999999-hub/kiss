const ROOM_STALE_MS = 3 * 60 * 1000;
const ROOM_UPDATE_LOG_COOLDOWN_MS = 30000;

const CONFIDENCE_RANK = {
  low: 1,
  medium: 2,
  high: 3
};

const SOURCE_CONFIDENCE = {
  "get_status.response": "high",
  "roulette_answer.request": "high",
  "roulette_answer.response": "high",
  "blackList.getProfiles.response": "high",
  "fallback-host.response": "high",
  "global-response": "high",
  "auto-kiss": "high",
  "network-room": "high",
  "room-event": "medium",
  "room-refresh": "medium",
  webview: "medium",
  snapshot: "medium",
  entry: "low",
  localStorage: "low",
  dom: "low",
  href: "low"
};

const SOURCE_PRIORITY = {
  "get_status.response": 500,
  "roulette_answer.response": 420,
  "roulette_answer.request": 400,
  "blackList.getProfiles.response": 300,
  "fallback-host.response": 260,
  "global-response": 250,
  "auto-kiss": 240,
  "network-room": 230,
  "room-event": 180,
  "room-refresh": 170,
  webview: 160,
  snapshot: 120,
  entry: 40,
  localStorage: 30,
  dom: 20,
  href: 10
};

function normalizeRoomId(value) {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) && text !== "0" ? text : "";
}

function normalizeConfidence(value, source) {
  const confidence = String(value || SOURCE_CONFIDENCE[source] || "low");
  return CONFIDENCE_RANK[confidence] ? confidence : "low";
}

function sourcePriority(source, confidence) {
  const key = String(source || "");
  if (Object.prototype.hasOwnProperty.call(SOURCE_PRIORITY, key)) return SOURCE_PRIORITY[key];
  return (CONFIDENCE_RANK[confidence] || 0) * 100;
}

function keyFor(accountId, partition) {
  const id = String(accountId || "");
  const part = String(partition || "");
  return id + "::" + part;
}

function createRoomIdentityStore({ log, diagnosticLogger } = {}) {
  const rooms = new Map();
  const lastLogByKey = new Map();

  function emit(level, event, payload, force) {
    if (typeof diagnosticLogger === "object" && diagnosticLogger && typeof diagnosticLogger.push === "function") {
      diagnosticLogger.push(level || "info", "room-identity", event, payload, { force: !!force });
    }
    if (typeof log === "function") {
      log(event, payload);
    }
  }

  function get(accountId, partition) {
    const direct = rooms.get(keyFor(accountId, partition));
    if (direct) return direct;

    const id = String(accountId || "");
    if (!id) return null;
    let best = null;
    rooms.forEach(value => {
      if (String(value.accountId || "") !== id) return;
      if (!best || Number(value.updatedAt || 0) > Number(best.updatedAt || 0)) best = value;
    });
    return best;
  }

  function shouldAccept(previous, nextConfidence, nextSource) {
    if (!previous || !previous.currentRoomId) return true;

    const previousRank = CONFIDENCE_RANK[previous.confidence] || 0;
    const nextRank = CONFIDENCE_RANK[nextConfidence] || 0;
    const previousFresh = previous.confirmedAt && Date.now() - Number(previous.confirmedAt || 0) <= ROOM_STALE_MS;
    if (previousFresh && nextRank < previousRank) return false;
    if (previousFresh && nextRank === previousRank) {
      const previousSourceRank = sourcePriority(previous.source, previous.confidence);
      const nextSourceRank = sourcePriority(nextSource, nextConfidence);
      if (nextSourceRank < previousSourceRank) return false;
    }
    return true;
  }

  function markStaleIfNeeded(entry, now = Date.now()) {
    if (!entry) return null;
    const confirmedAt = Number(entry.confirmedAt || 0);
    const stale = !confirmedAt || now - confirmedAt > ROOM_STALE_MS;
    const staleReason = stale ? "room-id-stale" : "";
    if (entry.staleReason !== staleReason) {
      entry.staleReason = staleReason;
      entry.health = stale ? "stale-room" : "healthy";
      if (stale) {
        emit("warn", "room-id-stale", {
          accountId: entry.accountId,
          partition: entry.partition,
          roomId: entry.lastConfirmedRoomId || entry.currentRoomId || "",
          ageMs: confirmedAt ? now - confirmedAt : null,
          source: entry.source
        }, true);
      }
    }
    return entry;
  }

  function remember(payload = {}) {
    const accountId = String(payload.accountId || "");
    const partition = String(payload.partition || "");
    const roomId = normalizeRoomId(payload.roomId);
    if (!accountId || !roomId) return null;

    const now = Number(payload.at || Date.now()) || Date.now();
    const source = String(payload.source || "unknown");
    const confidence = normalizeConfidence(payload.confidence, source);
    const key = keyFor(accountId, partition);
    const previous = rooms.get(key) || {
      accountId,
      partition,
      currentRoomId: "",
      lastConfirmedRoomId: "",
      previousRoomId: "",
      source: "",
      confidence: "low",
      confirmedAt: 0,
      updatedAt: 0,
      lastStatusPayload: null,
      lastAnswerPayload: null,
      lastKnownHref: "",
      staleReason: "",
      health: "unknown"
    };

    if (!shouldAccept(previous, confidence, source)) {
      return previous;
    }

    const oldRoomId = previous.currentRoomId || "";
    const changed = oldRoomId && oldRoomId !== roomId;
    const next = Object.assign({}, previous, {
      accountId,
      partition: partition || previous.partition || "",
      currentRoomId: roomId,
      lastConfirmedRoomId: CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK.medium ? roomId : previous.lastConfirmedRoomId || roomId,
      previousRoomId: changed ? oldRoomId : previous.previousRoomId || "",
      source,
      confidence,
      confirmedAt: CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK.medium ? now : previous.confirmedAt || now,
      updatedAt: now,
      lastKnownHref: payload.href || previous.lastKnownHref || "",
      staleReason: "",
      health: "healthy"
    });

    if (payload.statusPayload) next.lastStatusPayload = payload.statusPayload;
    if (payload.answerPayload) next.lastAnswerPayload = payload.answerPayload;

    rooms.set(key, next);

    const lastLogAt = Number(lastLogByKey.get(key) || 0);
    if (changed || !oldRoomId || now - lastLogAt >= ROOM_UPDATE_LOG_COOLDOWN_MS) {
      lastLogByKey.set(key, now);
      emit("info", "room-id-updated", {
        accountId,
        partition: next.partition,
        oldRoomId,
        newRoomId: roomId,
        source,
        confidence,
        ageMs: previous.confirmedAt ? now - Number(previous.confirmedAt || 0) : null
      }, changed);
    }

    return next;
  }

  function getConfirmedRoomId(accountId, partition) {
    const entry = markStaleIfNeeded(get(accountId, partition));
    if (!entry) return "";
    return normalizeRoomId(entry.lastConfirmedRoomId) || normalizeRoomId(entry.currentRoomId);
  }

  function removePartitions(partitions = []) {
    const set = new Set((Array.isArray(partitions) ? partitions : []).map(value => String(value || "")));
    if (!set.size) return;
    Array.from(rooms.entries()).forEach(([key, entry]) => {
      if (set.has(String(entry.partition || ""))) rooms.delete(key);
    });
  }

  function removeAccount(accountId) {
    const id = String(accountId || "");
    if (!id) return;
    Array.from(rooms.entries()).forEach(([key, entry]) => {
      if (String(entry.accountId || "") === id) rooms.delete(key);
    });
  }

  function clear() {
    rooms.clear();
    lastLogByKey.clear();
  }

  function snapshot() {
    const now = Date.now();
    return Array.from(rooms.values()).map(entry => Object.assign({}, markStaleIfNeeded(entry, now)));
  }

  return {
    remember,
    get,
    getConfirmedRoomId,
    removePartitions,
    removeAccount,
    clear,
    snapshot,
    normalizeRoomId
  };
}

module.exports = {
  ROOM_STALE_MS,
  createRoomIdentityStore,
  normalizeRoomId
};
