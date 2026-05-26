// GeneralAutoSpin.js
function createGeneralAutoSpinFeature(ctx, requestRender) {
    const state = createGeneralAutoSpinState(ctx);

    function logJson(label, payload) {
        try {
            console.log(label + " " + JSON.stringify(payload || {}));
        } catch (_) {
            console.log(label);
        }
    }

    function summarize(force) {
        const now = Date.now();
        if (!force && now - state.lastSummaryAt < 30000) return;
        state.lastSummaryAt = now;

        logJson("[AUTO SPIN] Ozet", {
            source: "auto-spin",
            running: state.running,
            inflight: state.inflight,
            minInterval: Math.floor(state.minInterval),
            sent: state.sent,
            ok: state.ok,
            failed: state.failed,
            roomId: ctx.getCurrentRoomId && ctx.getCurrentRoomId(),
            href: String(location.href || "")
        });

        state.sent = 0;
        state.ok = 0;
        state.failed = 0;
    }

    async function sendOneSpin() {
        state.inflight += 1;
        state.lastSentAt = Date.now();
        state.sent += 1;
        try {
            const runFetch = async () => {
                const res = await fetch(ctx.cfg.spinUrl, {
                method: "POST",
                headers: ctx.cfg.spinHeaders,
                body: ctx.cfg.spinBody,
                credentials: "same-origin",
                cache: "no-store"
            });
                const data = await res.json().catch(() => null);
                return { res, data };
            };
            const scheduler = window.__KISS_API_SCHEDULER__;
            const scheduled = scheduler && typeof scheduler.request === "function"
                ? await scheduler.request({ key: "spin", type: "spin", priority: "spin", dedupeKey: true, replaceQueued: true, maxWaitMs: 15000 }, runFetch)
                : { ok: true, result: await runFetch() };
            if (scheduled.skipped) return;
            if (!scheduled.ok) throw new Error(scheduled.error || "scheduler-failed");
            const res = scheduled.result.res;
            const data = scheduled.result.data;
            if (res.ok && data && data.result === 1) {
                state.ok += 1;
                state.minInterval = Math.max(ctx.cfg.minAllowedInterval, state.minInterval * ctx.cfg.successDecreaseFactor);
            } else {
                state.failed += 1;
                state.minInterval = Math.min(ctx.cfg.maxAllowedInterval, state.minInterval * ctx.cfg.errorIncreaseFactor);
                if (Date.now() - state.lastErrorLogAt > 10000) {
                    state.lastErrorLogAt = Date.now();
                    logJson("[AUTO SPIN] Hata veya backoff", {
                        source: "auto-spin",
                        status: res.status,
                        ok: !!res.ok,
                        result: data && data.result,
                        error: data && data.error,
                        minInterval: Math.floor(state.minInterval),
                        roomId: ctx.getCurrentRoomId && ctx.getCurrentRoomId(),
                        href: String(location.href || "")
                    });
                }
            }
        } catch (_) {
            state.failed += 1;
            state.minInterval = Math.min(ctx.cfg.maxAllowedInterval, state.minInterval * ctx.cfg.errorIncreaseFactor);
            if (Date.now() - state.lastErrorLogAt > 10000) {
                state.lastErrorLogAt = Date.now();
                logJson("[AUTO SPIN] Fetch hata", {
                    source: "auto-spin",
                    minInterval: Math.floor(state.minInterval),
                    roomId: ctx.getCurrentRoomId && ctx.getCurrentRoomId(),
                    href: String(location.href || "")
                });
            }
        } finally {
            state.inflight -= 1;
            summarize(false);
        }
    }

    async function loop() {
        if (state.loopStarted) return;
        state.loopStarted = true;
        while (!state.destroyed) {
            const now = Date.now();
            const canSend =
                state.running &&
                state.inflight < ctx.cfg.maxParallel &&
                (now - state.lastSentAt) >= ctx.jitter(state.minInterval);
            if (canSend) sendOneSpin();
            await new Promise(resolve => setTimeout(resolve, 30));
        }
    }

    function start() {
        if (state.running) return;
        state.running = true;
        summarize(true);
        loop().catch(console.error);
        requestRender();
    }

    function stop() {
        state.running = false;
        summarize(true);
        requestRender();
    }

    function destroy() {
        state.running = false;
        state.destroyed = true;
    }

    loop().catch(console.error);

    return {
        key: "autoSpinTab1",
        storageKey: "spin",
        label: "Auto Spin",
        isRunning: () => state.running,
        start,
        stop,
        destroy
    };
}
