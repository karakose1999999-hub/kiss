const DEFAULT_NETWORK_SILENT_MS = 3 * 60 * 1000;
const DEFAULT_HEARTBEAT_SILENT_MS = 5 * 60 * 1000;
const DEFAULT_ROOM_STALE_MS = 3 * 60 * 1000;

function createDefaultSlotHealth(accountId, now = Date.now()) {
  return {
    accountId: String(accountId || ""),
    partition: "",
    status: "idle",
    message: "",
    createdAt: now,
    updatedAt: now,
    lastLoadedAt: 0,
    lastInjectedAt: 0,
    lastHeartbeatAt: 0,
    lastRoomIdAt: 0,
    lastRoomId: "",
    lastNetworkAt: 0,
    lastErrorAt: 0,
    reloadCount: 0,
    recoveryCount: 0,
    errorCount: 0,
    stopped: false,
    destroyed: false,
    health: "idle"
  };
}

function age(now, value) {
  const at = Number(value || 0);
  return at > 0 ? now - at : Infinity;
}

function computeSlotHealth(slot, status, now = Date.now(), limits = {}) {
  const currentStatus = String(status || slot && slot.status || "");
  if (slot && slot.stopped || currentStatus === "stopped") return "stopped";
  if (slot && slot.destroyed) return "stopped";
  if (currentStatus === "crashed") return "crashed";
  if (currentStatus === "login-lost") return "login-lost";
  if (currentStatus === "error") return "degraded";

  const networkSilentMs = Number(limits.networkSilentMs || DEFAULT_NETWORK_SILENT_MS);
  const heartbeatSilentMs = Number(limits.heartbeatSilentMs || DEFAULT_HEARTBEAT_SILENT_MS);
  const roomStaleMs = Number(limits.roomStaleMs || DEFAULT_ROOM_STALE_MS);
  const lastHeartbeatAge = age(now, slot && slot.lastHeartbeatAt);
  const lastNetworkAge = age(now, slot && slot.lastNetworkAt);
  const lastRoomAge = age(now, slot && slot.lastRoomIdAt);

  if (currentStatus === "active" && lastHeartbeatAge > heartbeatSilentMs && lastNetworkAge > networkSilentMs) {
    return "network-silent";
  }

  if ((currentStatus === "active" || currentStatus === "loaded") && slot && slot.lastRoomId && lastRoomAge > roomStaleMs) {
    return "stale-room";
  }

  if (currentStatus === "active") return "healthy";
  if (currentStatus === "loaded" || currentStatus === "loading") return "degraded";
  return currentStatus || "degraded";
}

module.exports = {
  createDefaultSlotHealth,
  computeSlotHealth
};
