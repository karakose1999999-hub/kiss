const source = String.raw`function forwardWebviewConsole(index, msg) {
  console.log("[WEBVIEW slot " + (index + 1) + "]", msg);
}

function parsePrefixedConsoleJson(msg, prefix) {
  try {
    return JSON.parse(String(msg || "").slice(prefix.length));
  } catch (_) {
    return null;
  }
}

function handleRoomConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_ROOM_ID__");
  if (!payload) return;
  rememberSlotRoomId(index, payload && payload.roomId, payload && payload.at);
  sendGlobalKissRoom(index, payload && payload.roomId, payload && payload.at, payload && payload.source || "room-event", payload && payload.confidence);
}

function handleAutoKissConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_AUTO_KISS_RESPONSE__") || {};
  sendGlobalAutoKiss(index, payload);
  if (payload.roomId) sendGlobalKissRoom(index, payload.roomId, payload.at, "auto-kiss");
}

function handleNetConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_NET_EVENT__");
  const kind = String(payload && payload.kind || "");
  const url = String(payload && payload.url || "");
  const roomId = payload && (payload.roomId || payload.room && payload.room.roomId || payload.response && payload.response.roomId || payload.body && (payload.body.roomId || payload.body.room_id));
  if (roomId) {
    rememberSlotRoomId(index, roomId, payload && payload.at);
    sendGlobalKissRoom(index, roomId, payload && payload.at, payload && payload.source || kind || "network-room", payload && payload.confidence || "high");
    notifyRuntimeStatus(index, "active", "Network room", {
      roomId,
      source: payload && payload.source || kind || "network-room",
      confidence: payload && payload.confidence || "high",
      network: true,
      href: payload && payload.href
    });
  } else if (kind) {
    notifyRuntimeStatus(index, "active", "Network", {
      network: true,
      source: kind,
      href: payload && payload.href
    });
  }
  const critical = (
    kind.includes("error") ||
    kind.includes("abort") ||
    kind === "network-room-detected" ||
    url.includes("/api/room/change") ||
    url.includes("/api/room/sit_down_to_friend") ||
    url.includes("/api/user/login")
  );
  if (critical || isDiagnosticLogEnabled()) forwardWebviewConsole(index, msg);
}

function handleNavConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_NAV_EVENT__");
  const kind = String(payload && payload.kind || "");
  if ((kind.includes("undefined-route") && kind !== "undefined-route-heartbeat") || isDiagnosticLogEnabled()) {
    forwardWebviewConsole(index, msg);
  }
}

function handleActivityConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_ACTIVITY_EVENT__");
  const kind = String(payload && payload.kind || "");
  if (kind.includes("error") || kind.includes("stalled") || kind.includes("recovery") || isDiagnosticLogEnabled()) {
    forwardWebviewConsole(index, msg);
  }
}

function handleRosterConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_ROSTER_EVENT__");
  if (payload) rememberSlotRosterSnapshot(index, payload);
  const kind = String((payload && payload.kind) || "");
  if (
    kind === "own-seat-lost" ||
    kind === "possible-vip-displacement" ||
    kind === "own-player-missing" ||
    kind === "roster-error" ||
    (isDiagnosticLogEnabled() && (kind === "players-joined" || kind === "players-left"))
  ) {
    forwardWebviewConsole(index, msg);
  }
}

function handleMaintenanceConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_MAINTENANCE_EVENT__");
  if (!payload) return;
  const kind = String(payload && payload.kind || "");
  if (kind === "soft-reload-request") {
    loadGameRoomsOnly("Performance reload");
  } else if (kind === "electron-relaunch-request") {
    ipcRenderer.send("maintenance-relaunch", {
      sourceSlot: index,
      reason: payload && payload.reason || "performance-maintenance",
      mode: entries.length > 1 ? "multi" : "single",
      accountIds: entries.map(entry => String(entry.accountId || "")).filter(Boolean),
      at: Date.now()
    });
  }
}

function handleAccountStorageConsoleEvent(index, msg) {
  const payload = parsePrefixedConsoleJson(msg, "__KISS_ACCOUNT_STORAGE__");
  if (!payload) return;
  const entry = entries[index] || {};
  if (payload && String(payload.accountId || "") === String(entry.accountId || "") && payload.key) {
    entry.accountScriptSettings = entry.accountScriptSettings || {};
    if (payload.action === "remove") delete entry.accountScriptSettings[payload.key];
    else entry.accountScriptSettings[payload.key] = String(payload.value == null ? "" : payload.value);
  }
  ipcRenderer.send("account-script-setting-changed", payload);
}

function shouldForwardPlainWebviewMessage(msg) {
  return (
    msg.includes("[WEBVIEW LOGIN]") ||
    msg.includes("[INJECT ERROR]") ||
    (msg.includes("[ROOM LOCK]") && (
      isDiagnosticLogEnabled() ||
      msg.includes("retry") ||
      msg.includes("success") ||
      msg.includes("failed") ||
      msg.includes("stopped") ||
      msg.includes("expired") ||
      msg.includes("blocked")
    )) ||
    msg.includes("[PERFORMANCE]") ||
    msg.includes("[Toolkit] READY") ||
    msg.includes("[Toolkit] Haz?r")
  );
}

function handleWebviewConsoleMessage(index, msg) {
  if (msg.includes("__KISS_SLOT_DBLCLICK__")) {
    toggleFocus(index);
    return;
  }

  if (msg.startsWith("__KISS_ROOM_ID__")) return handleRoomConsoleEvent(index, msg);
  if (msg.startsWith("__KISS_AUTO_KISS_RESPONSE__")) return handleAutoKissConsoleEvent(index, msg);
  if (msg.startsWith("__KISS_AUTH_USER_ID__")) {
    const payload = parsePrefixedConsoleJson(msg, "__KISS_AUTH_USER_ID__");
    rememberSlotUserId(index, payload && payload.userId);
    notifyRuntimeStatus(index, "active", "Auth identity", {
      authUserId: payload && payload.userId,
      source: payload && payload.source || "auth-user-id"
    });
    return;
  }
  if (msg.startsWith("__KISS_NET_EVENT__")) return handleNetConsoleEvent(index, msg);
  if (msg.startsWith("__KISS_NAV_EVENT__")) return handleNavConsoleEvent(index, msg);
  if (msg.startsWith("__KISS_ACTIVITY_EVENT__")) return handleActivityConsoleEvent(index, msg);
  if (msg.startsWith("__KISS_ROSTER_EVENT__")) return handleRosterConsoleEvent(index, msg);
  if (msg.startsWith("__KISS_MAINTENANCE_EVENT__")) return handleMaintenanceConsoleEvent(index, msg);
  if (msg.startsWith("__KISS_FOLLOW_EVENT__")) {
    const payload = parsePrefixedConsoleJson(msg, "__KISS_FOLLOW_EVENT__");
    if (payload) handleFollowEvent(index, payload);
    return;
  }
  if (msg.startsWith("__KISS_ACCOUNT_STORAGE__")) return handleAccountStorageConsoleEvent(index, msg);

  if (shouldForwardPlainWebviewMessage(msg)) forwardWebviewConsole(index, msg);
}
`;

module.exports = {
  source
};
