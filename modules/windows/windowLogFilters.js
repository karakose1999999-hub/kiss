function compactUrl(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.startsWith("data:text/html")) return "data:text/html...[truncated]";
  return text.length > 700 ? text.slice(0, 700) + "...[truncated]" : text;
}

function compactMeta(meta) {
  if (!meta || typeof meta !== "object") return meta;
  return Object.fromEntries(Object.entries(meta).map(([key, value]) => {
    if (key.toLowerCase().includes("url")) return [key, compactUrl(value)];
    if (typeof value === "string" && value.length > 700) return [key, value.slice(0, 700) + "...[truncated]"];
    return [key, value];
  }));
}

function shortenSource(sourceId) {
  const text = String(sourceId || "");

  if (!text) return "";
  if (text.startsWith("data:text/html")) return "data:text/html";
  if (text.length > 160) return text.slice(0, 160) + "...";

  return text;
}

function isRoutineDiagnosticMessage(text) {
  const message = String(text || "");

  if (message.includes("[ACTIVE GUARD]")) {
    return (
      message.includes("Interaction probe") ||
      message.includes("profile-hover-only") ||
      message.includes("profile-poke ") ||
      message.includes("profile-poke-blocked") ||
      message.includes("profile-click-recovery-blocked") ||
      message.includes("Rastgele masa icin bekleniyor") ||
      message.includes("Sira gozlem degisti") ||
      message.includes("Sira gozlem sifirlandi")
    );
  }

  if (message.includes("[KISS FALLBACK] decision") && message.includes("missing-room-id")) return true;
  if (message.includes("[KISS FALLBACK HOST]") && !message.includes("issue") && !message.includes("summary")) return true;
  if (message.includes("[KISS FALLBACK GLOBAL] summary")) return true;
  if (message.includes("[AUTO KISS] response") && message.includes('"ok":true')) return true;
  if (message.includes("[AUTO SPIN] Ozet")) return true;
  if (message.includes("[AUTO SPIN] Hata veya backoff") && message.includes('"ok":true')) return true;
  if (message.includes("[GİZLİ SAVE FETCH ERROR]") || message.includes("[GIZLI SAVE FETCH ERROR]")) return true;
  if (message.includes("[ROOM LOCK] anchors-refreshed")) return true;
  if (message.includes("[PERFORMANCE] summary")) return true;
  if (message.includes("[MAINTENANCE HOST]") && (
    message.includes("soft-reload-blocked") ||
    message.includes("relaunch-blocked") ||
    message.includes("enabled") ||
    message.includes("disabled")
  )) return true;

  if (message.includes("__KISS_NET_EVENT__")) {
    return (
      message.includes('"kind":"fetch-start"') ||
      message.includes('"kind":"fetch-end"') ||
      message.includes('"url":"/api/room/roulette_answer/"') ||
      message.includes('"url":"https://getkisskiss.com/api/room/roulette_answer/"')
    ) && !(
      message.includes('"kind":"network-summary"') ||
      message.includes("/api/room/sit_down_to_friend") ||
      message.includes("/api/room/change") ||
      message.includes("fetch-error") ||
      message.includes("xhr-error") ||
      message.includes("socket-error") ||
      message.includes("socket-close")
    );
  }

  if (message.includes("__KISS_ROSTER_EVENT__")) {
    return (
      message.includes('"kind":"roster-health"') ||
      message.includes('"kind":"roster-diff"') ||
      message.includes('"kind":"roster-pulse"')
    ) && !(
      message.includes('"joined":[') && !message.includes('"joined":[]') ||
      message.includes('"left":[') && !message.includes('"left":[]')
    );
  }

  if (message.includes("__KISS_ACTIVITY_EVENT__")) {
    return message.includes('"kind":"activity-pulse"');
  }

  if (message.includes("__KISS_NAV_EVENT__")) {
    return message.includes('"kind":"undefined-route-heartbeat"');
  }

  return false;
}

function isCriticalConsoleMessage(text) {
  const message = String(text || "");
  return (
    message.includes("ERROR") ||
    message.includes("Error") ||
    message.includes("error") ||
    message.includes("failed") ||
    message.includes("did-fail-load") ||
    message.includes("render-process-gone") ||
    message.includes("unresponsive") ||
    message.includes("suspicious route recovery") ||
    message.includes("suspicious navigation") ||
    message.includes("undefined-route") && !message.includes("undefined-route-heartbeat") ||
    message.includes("own-seat-lost") ||
    message.includes("possible-vip-displacement") ||
    message.includes("own-seat-lost") ||
    message.includes("queue-stuck-recovery") ||
    (message.includes("[ROOM LOCK]") && (
      message.includes("retry") ||
      message.includes("success") ||
      message.includes("failed") ||
      message.includes("stopped") ||
      message.includes("expired") ||
      message.includes("blocked")
    )) ||
    (message.includes("[PERFORMANCE]") && !message.includes("[PERFORMANCE] summary")) ||
    message.includes("[MAINTENANCE HOST] soft-reload-run") ||
    message.includes("[MAINTENANCE HOST] relaunch-run") ||
    message.includes("[MAINTENANCE HOST] error") ||
    message.includes("[INJECT ERROR]") ||
    message.includes("[KISS FALLBACK HOST] issue")
    || message.includes("[KISS FALLBACK GLOBAL] skipped")
    || message.includes("[KISS FALLBACK GLOBAL] started")
    || message.includes("[KISS FALLBACK GLOBAL] stopped")
  );
}

function shouldShowRendererMessage(message) {
  const text = String(message || "");

  if (!text) return false;
  if (text.includes("Electron Security Warning")) return false;
  if (isRoutineDiagnosticMessage(text)) return false;
  if (isCriticalConsoleMessage(text)) return true;

  return (
    text.includes("[NewRenderer] bootstrap") ||
    text.includes("[NewRenderer] accounts loaded") ||
    text.includes("[GameTemplate] DOMContentLoaded")
  );
}

function shouldShowWebviewMessage(message) {
  const text = String(message || "");

  if (!text) return false;
  if (text.includes("Electron Security Warning")) return false;
  if (isRoutineDiagnosticMessage(text)) return false;
  if (isCriticalConsoleMessage(text)) return true;

  return (
    text.includes("[Toolkit] READY")
  );
}

module.exports = {
  compactMeta,
  compactUrl,
  isCriticalConsoleMessage,
  shortenSource,
  shouldShowRendererMessage,
  shouldShowWebviewMessage
};
