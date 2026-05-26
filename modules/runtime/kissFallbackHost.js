function createKissFallbackHost({
  findCurrentEntry,
  kissAnswerUrl,
  log,
  getConfirmedRoomId,
  normalizeRoomId,
  rememberRoomIdentity,
  session,
  stats
}) {
  function recordKissFallbackHost(accountIdValue, item, roomId) {
    const key = String(accountIdValue || "");
    if (!key) return;

    const now = Date.now();
    const stat = stats.get(key) || {
      total: 0,
      answers: {},
      lastAt: 0,
      lastRoomId: "",
      lastStatus: 0,
      lastResult: null
    };

    stat.total += 1;
    stat.answers[item.answer] = (stat.answers[item.answer] || 0) + 1;
    stat.lastRoomId = item.roomId || roomId || stat.lastRoomId;
    stat.lastStatus = item.status || 0;
    stat.lastResult = Object.prototype.hasOwnProperty.call(item, "result") ? item.result : stat.lastResult;

    const shouldLogNow = !item.ok || item.error || item.status !== 200 || now - stat.lastAt >= 60000;
    if (shouldLogNow) {
      stat.lastAt = now;
      log("[KISS FALLBACK HOST] summary", {
        accountId: key,
        roomId: stat.lastRoomId,
        total: stat.total,
        answers: stat.answers,
        lastStatus: stat.lastStatus,
        lastResult: stat.lastResult,
        error: item.error || undefined
      });
      stat.total = 0;
      stat.answers = {};
    }

    stats.set(key, stat);
  }

  async function sendKissFallbackAnswer(payload = {}) {
    const accountIdValue = String(payload.accountId || "");
    const partition = String(payload.partition || "");
    const roomId = normalizeRoomId(payload.roomId) ||
      (typeof getConfirmedRoomId === "function" ? normalizeRoomId(getConfirmedRoomId(accountIdValue, partition)) : "");
    const answers = Array.isArray(payload.answers)
      ? payload.answers.map(answer => String(answer || "").trim()).filter(answer => /^(1|2|3)$/.test(answer))
      : [String(payload.answer || "2").trim()].filter(answer => /^(1|2|3)$/.test(answer));
    const safeAnswers = answers.length ? answers : ["2"];

    if (!accountIdValue || !partition || !roomId) {
      const skipped = !accountIdValue ? "missing-accountId" : !partition ? "missing-partition" : "missing-roomId";
      log("[KISS FALLBACK HOST] invalid", { skipped, accountId: accountIdValue, partition, roomId });
      return { ok: false, skipped };
    }

    const entry = findCurrentEntry(accountIdValue, partition);
    if (!entry) {
      log("[KISS FALLBACK HOST] invalid", { skipped: "not-current", accountId: accountIdValue, partition, roomId });
      return { ok: false, skipped: "not-current" };
    }

    try {
      const ses = session.fromPartition(partition);
      const responses = [];
      let nextRoomId = roomId;

      for (const answer of safeAnswers) {
        const body = new URLSearchParams({
          roomId: nextRoomId || roomId,
          answer,
          userLocalTime: String(Math.floor(Date.now() / 1000)),
          sessnew: ""
        }).toString();

        const res = await ses.fetch(kissAnswerUrl, {
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
        if (typeof rememberRoomIdentity === "function" && nextRoomId) {
          rememberRoomIdentity({
            accountId: accountIdValue,
            partition,
            roomId: nextRoomId,
            at: Date.now(),
            source: "fallback-host.response",
            confidence: "high",
            answerPayload: {
              answer,
              status: res.status,
              result: data && data.result,
              error: data && data.error
            }
          });
        }

        const item = {
          answer,
          ok: !!res.ok,
          status: res.status,
          result: data && data.result,
          error: data && data.error,
          roomId: nextRoomId
        };
        responses.push(item);
        log("[KISS FALLBACK HOST] fallback-answer-result", {
          accountId: accountIdValue,
          partition,
          answer,
          ok: item.ok,
          status: item.status,
          result: item.result,
          error: item.error,
          roomId: item.roomId
        });
        recordKissFallbackHost(accountIdValue, item, roomId);
      }

      return {
        ok: responses.some(item => item && item.ok),
        responses,
        roomId: nextRoomId
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: String(error && error.message ? error.message : error)
      };
    }
  }

  return {
    sendKissFallbackAnswer
  };
}

module.exports = {
  createKissFallbackHost
};
