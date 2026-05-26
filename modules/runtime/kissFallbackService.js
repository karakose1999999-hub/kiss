const fs = require("fs");
const path = require("path");
const { app, session } = require("electron");

const SNAPSHOT_FILE = "kiss-fallback-global.json";
const INTERVAL_MS = 2500;
const ROOM_MAX_AGE_MS = 3 * 60 * 1000;
const AUTO_KISS_RECENT_MS = 5000;
const SUMMARY_MS = 60000;
const KISS_ANSWER_URL = "https://getkisskiss.com/api/room/roulette_answer/";

function normalizeRoomId(value) {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) && text !== "0" ? text : "";
}

function getSnapshotPath() {
  return path.join(app.getPath("userData"), SNAPSHOT_FILE);
}

function parseJson(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function accountAllowsKiss(entry) {
  if (!entry) return false;
  const raw = entry.accountScriptSettings && entry.accountScriptSettings.kiss_toolkit_autoSpinTab1;
  const parsed = parseJson(raw);
  return !(parsed && parsed.manualStopped && parsed.manualStopped.kiss === true);
}

function createKissFallbackService({ log, rememberRoomIdentity } = {}) {
  const accounts = new Map();
  const stats = new Map();
  let enabled = false;
  let timer = null;
  let inFlight = false;
  let lastSkippedLogAt = 0;

  function writeSnapshot() {
    try {
      const payload = {
        at: Date.now(),
        accounts: Array.from(accounts.values()).map(entry => ({
          accountId: entry.accountId,
          partition: entry.partition,
          roomId: entry.roomId,
          roomIdAt: entry.roomIdAt,
          autoKissAllowed: entry.autoKissAllowed
        }))
      };
      fs.mkdirSync(path.dirname(getSnapshotPath()), { recursive: true });
      fs.writeFileSync(getSnapshotPath(), JSON.stringify(payload, null, 2), "utf8");
    } catch (_) {}
  }

  function readSnapshot() {
    try {
      const filePath = getSnapshotPath();
      if (!fs.existsSync(filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const list = Array.isArray(parsed && parsed.accounts) ? parsed.accounts : [];
      list.forEach(item => {
        const accountId = String(item.accountId || "");
        const partition = String(item.partition || "");
        if (!accountId || !partition) return;
        accounts.set(accountId, {
          accountId,
          partition,
          roomId: normalizeRoomId(item.roomId),
          roomIdAt: Number(item.roomIdAt || 0),
          autoKissAllowed: item.autoKissAllowed !== false,
          lastAutoKissAt: 0,
          source: "snapshot"
        });
      });
    } catch (_) {}
  }

  function serviceLog(message, meta, force) {
    if (!force && message !== "summary") return;
    if (typeof log === "function") {
      log("[KISS FALLBACK GLOBAL] " + message, meta);
      return;
    }
    if (typeof meta === "undefined") console.log("[KISS FALLBACK GLOBAL] " + message);
    else console.log("[KISS FALLBACK GLOBAL] " + message, meta);
  }

  function registerEntries(entries = []) {
    entries.forEach(entry => {
      const accountId = String(entry && entry.accountId || "");
      const partition = String(entry && entry.partition || "");
      if (!accountId || !partition) return;
      const previous = accounts.get(accountId) || {};
      accounts.set(accountId, {
        accountId,
        partition,
        roomId: previous.roomId || "",
        roomIdAt: previous.roomIdAt || 0,
        autoKissAllowed: accountAllowsKiss(entry),
        lastAutoKissAt: previous.lastAutoKissAt || 0,
        source: "entry"
      });
    });
    writeSnapshot();
  }

  function rememberRoom(payload = {}) {
    const accountId = String(payload.accountId || "");
    const partition = String(payload.partition || "");
    const roomId = normalizeRoomId(payload.roomId);
    if (!accountId || !roomId) return false;
    const previous = accounts.get(accountId) || {};
    accounts.set(accountId, {
      accountId,
      partition: partition || previous.partition || "",
      roomId,
      roomIdAt: Number(payload.at || Date.now()),
      autoKissAllowed: previous.autoKissAllowed !== false,
      lastAutoKissAt: Number(payload.lastAutoKissAt || previous.lastAutoKissAt || 0),
      source: payload.source || "room"
    });
    writeSnapshot();
    return true;
  }

  function rememberAutoKiss(payload = {}) {
    const accountId = String(payload.accountId || "");
    if (!accountId) return;
    const entry = accounts.get(accountId);
    if (!entry) return;
    entry.lastAutoKissAt = Number(payload.at || Date.now());
    if (payload.roomId) {
      entry.roomId = normalizeRoomId(payload.roomId) || entry.roomId;
      entry.roomIdAt = Date.now();
    }
    accounts.set(accountId, entry);
    writeSnapshot();
  }

  function removePartitions(partitions = []) {
    const set = new Set((Array.isArray(partitions) ? partitions : []).map(value => String(value || "")));
    if (!set.size) return;
    Array.from(accounts.entries()).forEach(([accountId, entry]) => {
      if (set.has(String(entry.partition || ""))) accounts.delete(accountId);
    });
    writeSnapshot();
  }

  function record(accountId, item, roomId) {
    const now = Date.now();
    const stat = stats.get(accountId) || {
      total: 0,
      answers: {},
      lastAt: 0,
      lastRoomId: ""
    };
    stat.total += 1;
    stat.answers[item.answer] = (stat.answers[item.answer] || 0) + 1;
    stat.lastRoomId = item.roomId || roomId || stat.lastRoomId;
    const shouldLog = !item.ok || item.error || item.status !== 200 || now - stat.lastAt >= SUMMARY_MS;
    if (shouldLog) {
      stat.lastAt = now;
      serviceLog("summary", {
        accountId,
        roomId: stat.lastRoomId,
        total: stat.total,
        answers: stat.answers,
        status: item.status,
        result: item.result,
        error: item.error || undefined
      }, true);
      stat.total = 0;
      stat.answers = {};
    }
    stats.set(accountId, stat);
  }

  async function sendForEntry(entry) {
    const now = Date.now();
    const roomId = normalizeRoomId(entry.roomId);
    const roomAge = entry.roomIdAt ? now - Number(entry.roomIdAt || 0) : Infinity;
    if (!entry.autoKissAllowed) return { skipped: "auto-kiss-disabled" };
    if (!roomId || roomAge > ROOM_MAX_AGE_MS) return { skipped: "missing-room-id" };
    if (entry.lastAutoKissAt && now - entry.lastAutoKissAt < AUTO_KISS_RECENT_MS) return { skipped: "auto-kiss-recent" };
    if (!entry.partition) return { skipped: "missing-partition" };

    const ses = session.fromPartition(entry.partition);
    const responses = [];
    let nextRoomId = roomId;
    for (const answer of ["3", "2"]) {
      const body = new URLSearchParams({
        roomId: nextRoomId || roomId,
        answer,
        userLocalTime: String(Math.floor(Date.now() / 1000)),
        sessnew: ""
      }).toString();
      const res = await ses.fetch(KISS_ANSWER_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Origin": "https://getkisskiss.com",
          "Referer": "https://getkisskiss.com/"
        },
        body,
        cache: "no-store"
      });
      const data = await res.json().catch(() => null);
      nextRoomId = normalizeRoomId(
        data && data.status && (data.status.room_id || data.status.roomId)
      ) || normalizeRoomId(data && (data.room_id || data.roomId)) || nextRoomId || roomId;
      const item = {
        answer,
        ok: !!res.ok,
        status: res.status,
        result: data && data.result,
        error: data && data.error,
        roomId: nextRoomId
      };
      responses.push(item);
      record(entry.accountId, item, roomId);
    }
    rememberRoom({
      accountId: entry.accountId,
      partition: entry.partition,
      roomId: nextRoomId,
      at: Date.now(),
      source: "global-response"
    });
    if (typeof rememberRoomIdentity === "function") {
      rememberRoomIdentity({
        accountId: entry.accountId,
        partition: entry.partition,
        roomId: nextRoomId,
        at: Date.now(),
        source: "global-response",
        confidence: "high"
      });
    }
    return { ok: responses.some(item => item.ok), responses, roomId: nextRoomId };
  }

  async function tick() {
    if (!enabled || inFlight) return;
    inFlight = true;
    try {
      const list = Array.from(accounts.values());
      if (!list.length) return;
      const results = await Promise.all(list.map(entry => sendForEntry(entry).catch(error => ({
        skipped: "fetch-error",
        error: String(error && error.message ? error.message : error || "")
      }))));
      const skipped = results.filter(result => result && result.skipped);
      if (skipped.length && Date.now() - lastSkippedLogAt >= SUMMARY_MS) {
        lastSkippedLogAt = Date.now();
        serviceLog("skipped", {
          count: skipped.length,
          reasons: skipped.reduce((acc, item) => {
            acc[item.skipped] = (acc[item.skipped] || 0) + 1;
            return acc;
          }, {})
        }, true);
      }
    } finally {
      inFlight = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => tick().catch(() => {}), INTERVAL_MS);
    tick().catch(() => {});
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function setEnabled(value) {
    const next = !!value;
    if (enabled === next) return;
    enabled = next;
    if (enabled) {
      readSnapshot();
      start();
      serviceLog("started", { accounts: accounts.size }, true);
    } else {
      stop();
      serviceLog("stopped", { accounts: accounts.size }, true);
    }
  }

  readSnapshot();

  return {
    registerEntries,
    rememberRoom,
    rememberAutoKiss,
    removePartitions,
    setEnabled,
    tick
  };
}

module.exports = {
  createKissFallbackService
};
