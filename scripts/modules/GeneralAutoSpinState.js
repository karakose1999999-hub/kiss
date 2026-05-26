function createGeneralAutoSpinState(ctx) {
    return {
        running: false,
        inflight: 0,
        lastSentAt: 0,
        minInterval: ctx.cfg.minInterval,
        loopStarted: false,
        sent: 0,
        ok: 0,
        failed: 0,
        lastSummaryAt: 0,
        lastErrorLogAt: 0
    };
}
