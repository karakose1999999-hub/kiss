// GeneralAutoPerformance.js
function createGeneralAutoPerformanceFeature(ctx, requestRender) {
    const DEFAULTS = createGeneralAutoPerformanceDefaults();

    ctx.settings.performance = Object.assign({}, DEFAULTS, ctx.settings.performance || {});

    const state = createGeneralAutoPerformanceState();
    const {
        STYLE_ID,
        MAX_QUEUE,
        FULL_SWEEP_INTERVAL_MS,
        CHAT_CLEANUP_INTERVAL_MS,
        STORAGE_CLEANUP_INTERVAL_MS,
        SAFE_STORAGE_PREFIXES,
        REMOVABLE_STORAGE_PATTERNS,
        CHEAP_VISUAL_SELECTORS,
        QUEUED_VISUAL_SELECTORS,
        MODAL_SELECTORS
    } = createGeneralAutoPerformanceConfig();

    function logJson(label, payload) {
        try {
            console.log(label + " " + JSON.stringify(payload || {}));
        } catch (_) {
            console.log(label);
        }
    }

    function savePerformanceSettings() {
        ctx.settings.performance.enabled = !!state.running;
        ctx.saveSettings();
    }

    function isProtectedNode(node) {
        try {
            if (!node || node.nodeType !== 1) return true;
            if (node.id === "kiss-toolkit-panel") return true;
            if (node.closest && node.closest("#kiss-toolkit-panel")) return true;
            if (node.matches && node.matches(".player[data-pid][data-uid]:not(.player-graphics)")) return true;
            if (node.closest && node.closest(".player[data-pid][data-uid]:not(.player-graphics)")) return true;
            if (node.matches && node.matches("script,style,link,meta,html,body")) return true;
        } catch (_) {
            return true;
        }
        return false;
    }

    function removeNode(node) {
        try {
            if (!node || !node.parentNode || isProtectedNode(node)) return false;
            node.remove();
            return true;
        } catch (_) {
            return false;
        }
    }

    function ensureCss() {
        let style = document.getElementById(STYLE_ID);
        if (style) return;
        style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = [
            ".gift,.gift--small,.gift-animation,.gift-animation-container,.gift__container,.animation_gift,[data-gift],[data-type=\"gift\"],canvas[data-type=\"gift\"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}",
            ".hat-animation-frame,.animation-frame,canvas[data-type=\"hat\"],canvas[data-type=\"frame\"],canvas[data-type=\"frame-glow\"],.frame-glow,.frame-glow-wrap,.player__collection[data-link=\"collection\"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}",
            "[class*=\"confetti\"],[class*=\"sparkle\"],[class*=\"firework\"],[class*=\"flying-gift\"],[class*=\"fly-gift\"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}"
        ].join("\n");
        document.head.appendChild(style);
    }

    function removeCss() {
        try { document.getElementById(STYLE_ID)?.remove(); } catch (_) {}
    }

    function selectorSweep(root, selectors) {
        let removed = 0;
        try {
            const base = root && root.querySelectorAll ? root : document;
            base.querySelectorAll(selectors.join(",")).forEach(node => {
                if (removeNode(node)) removed += 1;
            });
        } catch (_) {}
        return removed;
    }

    function trimChat() {
        let removed = 0;
        const max = Math.max(20, Number(ctx.settings.performance.chatMaxMessages || DEFAULTS.chatMaxMessages) || DEFAULTS.chatMaxMessages);
        try {
            const containers = Array.from(document.querySelectorAll(".chat__messages,.messages,.chat-messages,.js-chat-messages"));
            containers.forEach(container => {
                const messages = Array.from(container.querySelectorAll(".chat__message,.message,.message-row,.js-message"));
                const extraCount = Math.max(0, messages.length - max);
                messages.slice(0, extraCount).forEach(message => {
                    if (removeNode(message)) removed += 1;
                });
            });
        } catch (_) {}
        return removed;
    }

    function removeSystemChatNoise() {
        let removed = 0;
        try {
            document.querySelectorAll(".chat__message,.message,.message-row,.js-message").forEach(message => {
                if (isProtectedNode(message)) return;
                const text = String(message.textContent || "");
                const hasGift = !!message.querySelector(".gift__inline,.gift,[data-gift]");
                const noisy = hasGift ||
                    text.includes("Çarkıfelek") ||
                    text.includes("Carkifelek") ||
                    text.includes("öpüşme şansını artırdı") ||
                    text.includes("opusme sansini artirdi") ||
                    text.toLowerCase().includes("wheel of fortune");
                if (noisy && removeNode(message)) removed += 1;
            });
        } catch (_) {}
        return removed;
    }

    function cleanupStorage() {
        let removed = 0;
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = String(localStorage.key(i) || "");
                if (!key) continue;
                if (SAFE_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
                if (!REMOVABLE_STORAGE_PATTERNS.some(pattern => pattern.test(key))) continue;
                keys.push(key);
            }
            keys.slice(0, 30).forEach(key => {
                try {
                    localStorage.removeItem(key);
                    removed += 1;
                } catch (_) {}
            });
        } catch (_) {}
        return removed;
    }

    function cleanupQueuedNodes() {
        let visualRemoved = 0;
        let modalRemoved = 0;
        const nodes = state.queuedNodes.splice(0, state.queuedNodes.length);
        nodes.forEach(node => {
            if (!node || node.nodeType !== 1 || isProtectedNode(node)) return;
            try {
                if (node.matches && node.matches(QUEUED_VISUAL_SELECTORS.join(","))) {
                    if (removeNode(node)) visualRemoved += 1;
                    return;
                }
                if (node.matches && node.matches(MODAL_SELECTORS.join(","))) {
                    if (removeNode(node)) modalRemoved += 1;
                    return;
                }
                visualRemoved += selectorSweep(node, QUEUED_VISUAL_SELECTORS);
                modalRemoved += selectorSweep(node, MODAL_SELECTORS);
            } catch (_) {}
        });
        return { visualRemoved, modalRemoved };
    }

    function recordSummary(summary) {
        state.totals.chatRemoved += summary.chatRemoved;
        state.totals.visualRemoved += summary.visualRemoved;
        state.totals.modalRemoved += summary.modalRemoved;
        state.totals.storageRemoved += summary.storageRemoved;
        state.totals.sweeps += 1;

        const compact = {
            at: Date.now(),
            chatRemoved: summary.chatRemoved,
            visualRemoved: summary.visualRemoved,
            modalRemoved: summary.modalRemoved,
            storageRemoved: summary.storageRemoved,
            totals: Object.assign({}, state.totals),
            error: state.lastError
        };
        ctx.settings.performance.lastCleanupSummary = compact;
        ctx.saveSettings();

        const now = Date.now();
        if (now - state.lastSummaryLogAt >= 60000 && (
            summary.chatRemoved ||
            summary.visualRemoved ||
            summary.modalRemoved ||
            summary.storageRemoved
        )) {
            state.lastSummaryLogAt = now;
            logJson("[PERFORMANCE] summary", compact);
        }
    }

    function cleanupSweep(reason = "interval") {
        if (!state.running || state.cleanupInFlight) return;
        state.cleanupInFlight = true;
        try {
            const now = Date.now();
            ensureCss();
            const queued = cleanupQueuedNodes();
            const shouldChatCleanup = reason === "start" || now - state.lastChatCleanupAt >= CHAT_CLEANUP_INTERVAL_MS;
            const shouldFullSweep = reason === "start" || now - state.lastFullSweepAt >= FULL_SWEEP_INTERVAL_MS;
            const shouldStorageCleanup = reason === "start" || now - state.lastStorageCleanupAt >= STORAGE_CLEANUP_INTERVAL_MS;
            if (shouldChatCleanup) state.lastChatCleanupAt = now;
            if (shouldFullSweep) state.lastFullSweepAt = now;
            if (shouldStorageCleanup) state.lastStorageCleanupAt = now;
            const summary = {
                reason,
                chatRemoved: shouldChatCleanup ? trimChat() + removeSystemChatNoise() : 0,
                visualRemoved: queued.visualRemoved + (shouldFullSweep ? selectorSweep(document, CHEAP_VISUAL_SELECTORS) : 0),
                modalRemoved: queued.modalRemoved + (shouldFullSweep ? selectorSweep(document, MODAL_SELECTORS) : 0),
                storageRemoved: shouldStorageCleanup ? cleanupStorage() : 0
            };
            state.lastError = "";
            recordSummary(summary);
        } catch (error) {
            state.lastError = String(error && error.message ? error.message : error).slice(0, 180);
            logJson("[PERFORMANCE] error", { error: state.lastError, reason });
        } finally {
            state.cleanupInFlight = false;
            requestRender();
        }
    }

    function installObserver() {
        if (state.observer || !document.body) return;
        state.observer = new MutationObserver(mutations => {
            if (!state.running) return;
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (!node || node.nodeType !== 1) return;
                    if (state.queuedNodes.length < MAX_QUEUE) state.queuedNodes.push(node);
                });
            }
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
    }

    function start() {
        if (state.running) return;
        state.running = true;
        ctx.settings.performance.enabled = true;
        ctx.settings.performance.mode = "aggressive";
        ctx.settings.performance.cleanupIntervalMs = Math.max(5000, Number(ctx.settings.performance.cleanupIntervalMs || DEFAULTS.cleanupIntervalMs) || DEFAULTS.cleanupIntervalMs);
        savePerformanceSettings();
        ensureCss();
        installObserver();
        cleanupSweep("start");
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(() => cleanupSweep("interval"), ctx.settings.performance.cleanupIntervalMs);
        logJson("[PERFORMANCE] started", {
            mode: ctx.settings.performance.mode,
            chatMaxMessages: ctx.settings.performance.chatMaxMessages,
            cleanupIntervalMs: ctx.settings.performance.cleanupIntervalMs
        });
        requestRender();
    }

    function stop() {
        if (!state.running && !ctx.settings.performance.enabled) return;
        state.running = false;
        ctx.settings.performance.enabled = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        if (state.observer) state.observer.disconnect();
        state.observer = null;
        state.queuedNodes = [];
        removeCss();
        savePerformanceSettings();
        logJson("[PERFORMANCE] stopped", { totals: state.totals });
        requestRender();
    }

    function destroy() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        if (state.observer) state.observer.disconnect();
        state.observer = null;
        state.queuedNodes = [];
    }

    function autoStart() {
        if (ctx.settings.performance && ctx.settings.performance.enabled && !state.running) {
            start();
        }
    }

    function renderExtra() {
        const summary = ctx.settings.performance.lastCleanupSummary || {};
        const wrap = ctx.utils.el("div", {
            css: {
                display: "grid",
                gap: "6px",
                padding: "8px",
                border: "1px solid rgba(186,218,85,0.18)",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.14)",
                fontSize: "12px"
            }
        });
        wrap.appendChild(ctx.utils.el("div", {
            text: "Performans modu agresif temizlik yapar. Sorun olursa Durdur yeterli.",
            css: { opacity: "0.78" }
        }));
        wrap.appendChild(ctx.utils.el("div", {
            text: "Son: chat " + (summary.chatRemoved || 0) +
                " / efekt " + (summary.visualRemoved || 0) +
                " / panel " + (summary.modalRemoved || 0) +
                " / storage " + (summary.storageRemoved || 0)
        }));
        wrap.appendChild(ctx.utils.el("div", {
            text: "Toplam: chat " + state.totals.chatRemoved +
                " / efekt " + state.totals.visualRemoved +
                " / panel " + state.totals.modalRemoved +
                " / storage " + state.totals.storageRemoved
        }));
        if (state.lastError) {
            wrap.appendChild(ctx.utils.el("div", {
                text: "Hata: " + state.lastError,
                css: { color: "#ffb3b3" }
            }));
        }
        return wrap;
    }

    if (ctx.settings.performance.enabled) {
        setTimeout(autoStart, 500);
    }

    return {
        key: "performance",
        storageKey: null,
        label: "Performans İyileştirici",
        isRunning: () => state.running,
        start,
        stop,
        destroy,
        autoStart,
        renderExtra
    };
}
