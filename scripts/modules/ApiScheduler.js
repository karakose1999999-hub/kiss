function createKissApiScheduler() {
    if (window.__KISS_API_SCHEDULER__) return window.__KISS_API_SCHEDULER__;

    const PRIORITY = {
        kiss: 100,
        recovery: 90,
        follow: 80,
        roomLock: 80,
        roomChange: 70,
        spin: 40,
        combo: 30,
        default: 10
    };

    const MAX_CONCURRENT = 2;
    const DEFAULT_MAX_WAIT_MS = {
        kiss: 3000,
        recovery: 5000,
        follow: 8000,
        roomLock: 8000,
        roomChange: 8000,
        spin: 15000,
        combo: 15000,
        default: 15000
    };

    const state = {
        running: 0,
        runningKeys: new Set(),
        queue: [],
        queuedByKey: new Map(),
        drainScheduled: false,
        stats: {},
        lastSummaryAt: 0
    };

    function normalizePriority(value) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        return PRIORITY[value] || PRIORITY.default;
    }

    function maxWaitFor(type, value) {
        const explicit = Number(value || 0);
        if (Number.isFinite(explicit) && explicit > 0) return explicit;
        return DEFAULT_MAX_WAIT_MS[type] || DEFAULT_MAX_WAIT_MS.default;
    }

    function stat(type, field) {
        const key = String(type || "default");
        const item = state.stats[key] || { queued: 0, replaced: 0, started: 0, deduped: 0, ok: 0, failed: 0 };
        item[field] = (item[field] || 0) + 1;
        state.stats[key] = item;
    }

    function summarize(force) {
        const now = Date.now();
        if (!force && now - state.lastSummaryAt < 60000) return;
        state.lastSummaryAt = now;
        try {
            if (window.__KISS_MODULE_SETTINGS && window.__KISS_MODULE_SETTINGS.diagnosticLog) {
                console.log("[API SCHEDULER] summary " + JSON.stringify({
                    running: state.running,
                    queued: state.queue.length,
                    runningKeys: Array.from(state.runningKeys),
                    queuedKeys: Array.from(state.queuedByKey.keys()),
                    stats: state.stats
                }));
            }
        } catch (_) {}
    }

    function resolveEntry(entry, payload) {
        try { entry.resolve(payload); } catch (_) {}
    }

    function rejectEntry(entry, error) {
        try {
            entry.resolve({
                ok: false,
                error: String(error && error.message ? error.message : error).slice(0, 180)
            });
        } catch (_) {}
    }

    function scheduleDrain() {
        if (state.drainScheduled) return;
        state.drainScheduled = true;
        setTimeout(drain, 0);
    }

    function scoreEntry(entry, now) {
        const waited = Math.max(0, now - entry.queuedAt);
        const maxWait = Math.max(1, entry.maxWaitMs);
        const waitRatio = Math.min(1, waited / maxWait);
        const waitBonus = waitRatio * 100;
        return entry.priority + waitBonus;
    }

    function pickNextIndex() {
        const now = Date.now();
        let bestIndex = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < state.queue.length; i += 1) {
            const entry = state.queue[i];
            if (!entry || state.runningKeys.has(entry.key)) continue;
            const score = scoreEntry(entry, now);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    function drain() {
        state.drainScheduled = false;

        while (state.running < MAX_CONCURRENT && state.queue.length) {
            const index = pickNextIndex();
            if (index < 0) break;
            const entry = state.queue.splice(index, 1)[0];
            if (!entry) continue;
            state.queuedByKey.delete(entry.key);
            runEntry(entry);
        }

        summarize(false);
    }

    async function runEntry(entry) {
        state.running += 1;
        state.runningKeys.add(entry.key);
        stat(entry.type, "started");

        try {
            const result = await entry.runner();
            stat(entry.type, "ok");
            resolveEntry(entry, { ok: true, result });
        } catch (error) {
            stat(entry.type, "failed");
            rejectEntry(entry, error);
        } finally {
            state.running = Math.max(0, state.running - 1);
            state.runningKeys.delete(entry.key);
            scheduleDrain();
        }
    }

    function request(options, runner) {
        const opts = options || {};
        const key = String(opts.key || opts.type || "default");
        const type = String(opts.type || key || "default");
        const priority = normalizePriority(opts.priority || type);
        const dedupeKey = opts.dedupeKey !== false;
        const replaceQueued = opts.replaceQueued !== false;
        const maxWaitMs = maxWaitFor(type, opts.maxWaitMs);

        if (dedupeKey && state.runningKeys.has(key)) {
            stat(type, "deduped");
            return Promise.resolve({ skipped: "key-running", key, type });
        }

        const queued = dedupeKey ? state.queuedByKey.get(key) : null;
        if (queued) {
            if (replaceQueued) {
                queued.runner = typeof runner === "function" ? runner : queued.runner;
                queued.priority = priority;
                queued.maxWaitMs = maxWaitMs;
                queued.updatedAt = Date.now();
                stat(type, "replaced");
            } else {
                stat(type, "deduped");
            }
            scheduleDrain();
            return queued.promise;
        }

        let resolve;
        const promise = new Promise(done => { resolve = done; });
        const entry = {
            key,
            type,
            priority,
            maxWaitMs,
            runner,
            resolve,
            promise,
            queuedAt: Date.now(),
            updatedAt: Date.now()
        };

        state.queue.push(entry);
        if (dedupeKey) state.queuedByKey.set(key, entry);
        stat(type, "queued");
        scheduleDrain();
        return promise;
    }

    const api = {
        PRIORITY,
        request,
        getState: () => ({
            running: state.running,
            queued: state.queue.length,
            runningKeys: Array.from(state.runningKeys),
            queuedKeys: Array.from(state.queuedByKey.keys())
        }),
        summarize
    };

    window.__KISS_API_SCHEDULER__ = api;
    return api;
}

createKissApiScheduler();
