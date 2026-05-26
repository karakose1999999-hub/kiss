function createAutoComboModule(utils) {
    return {
        name: "autoCombo",
        title: "Kick + Save",

        defaultSettings: createAutoComboDefaultSettings(),

        renderSettings(container) {
            try {
                if (typeof window.__KISS_AUTO_COMBO_CLEANUP === "function") {
                    window.__KISS_AUTO_COMBO_CLEANUP();
                }
            } catch (_) {}

            const S = utils.loadSettings(this.name, this.defaultSettings);
            container.innerHTML = "";

            if (!S.kickList || typeof S.kickList !== "object") S.kickList = {};
            if (!Array.isArray(S.saveList)) S.saveList = [];
            if (!Array.isArray(S.hiddenSaveList)) S.hiddenSaveList = [];

            /* HELPERS */
            const shorten = n => n?.length > 8 ? n.slice(0, 8) + "…" : n;
            const saveNow = () => utils.saveSettings(this.name, S);

            function sameUid(a, b) {
                return String(a) === String(b);
            }

            function ensureLists() {
                if (!S.kickList || typeof S.kickList !== "object") S.kickList = {};
                if (!Array.isArray(S.saveList)) S.saveList = [];
                if (!Array.isArray(S.hiddenSaveList)) S.hiddenSaveList = [];
            }

            function safeNumber(value, fallback = 1) {
                const n = Number(value);
                return Number.isFinite(n) && n > 0 ? n : fallback;
            }

            function diagnosticEnabled() {
                try {
                    return !!(window.__KISS_MODULE_SETTINGS && window.__KISS_MODULE_SETTINGS.diagnosticLog);
                } catch {
                    return false;
                }
            }

            function comboLog() {
                if (!diagnosticEnabled()) return;
                try {
                    console.log.apply(console, arguments);
                } catch (_) {}
            }

            /* ========================= PLAYERS ========================= */
            function getPlayers() {
                try {
                    const provider = window.__KISS_GAME_STATE_PROVIDER__;
                    if (provider && typeof provider.refresh === "function") {
                        const snapshot = provider.refresh("auto-combo-players", { force: true, silent: true });
                        const tablePlayers = Array.isArray(snapshot && snapshot.tablePlayers) ? snapshot.tablePlayers : [];
                        const fromProvider = tablePlayers
                            .map(player => ({
                                userId: String(player.uid || player.userId || player.id || ""),
                                name: String(player.name || player.uid || player.userId || player.id || "?")
                            }))
                            .filter(player => /^\d+$/.test(player.userId));
                        if (fromProvider.length) return fromProvider;
                    }

                    const links = document.querySelectorAll(".player__name__link");
                    if (!links?.length) return [];

                    return [...links]
                        .map(el => {
                            const userId =
                                el.getAttribute("data-uid") ||
                                el.closest("[data-uid]")?.getAttribute("data-uid");

                            const name =
                                el.getAttribute("data-name") ||
                                el.textContent?.trim() ||
                                "?";

                            return userId ? { userId: String(userId), name } : null;
                        })
                        .filter(Boolean);
                } catch {
                    return [];
                }
            }

            /* ========================= STORAGE ========================= */
            const runtimeState = window.__KISS_AUTO_COMBO_RUNTIME_STATE || createAutoComboRuntimeState();
            window.__KISS_AUTO_COMBO_RUNTIME_STATE = runtimeState;
            if (!runtimeState.kickIntervals || typeof runtimeState.kickIntervals !== "object") runtimeState.kickIntervals = {};
            if (!runtimeState.saveIntervals || typeof runtimeState.saveIntervals !== "object") runtimeState.saveIntervals = {};
            if (!runtimeState.hiddenSaveIntervals || typeof runtimeState.hiddenSaveIntervals !== "object") runtimeState.hiddenSaveIntervals = {};
            if (!runtimeState.actionTimeouts || typeof runtimeState.actionTimeouts !== "object") runtimeState.actionTimeouts = {};
            if (!runtimeState.actionStats || typeof runtimeState.actionStats !== "object") runtimeState.actionStats = {};
            runtimeState.lastKnownRoomId = String(runtimeState.lastKnownRoomId || "");
            runtimeState.lastRoomWarnAt = Number(runtimeState.lastRoomWarnAt || 0) || 0;
            if (runtimeState.refreshTimer) {
                clearTimeout(runtimeState.refreshTimer);
                runtimeState.refreshTimer = null;
            }
            if (runtimeState.refreshObserver) {
                try { runtimeState.refreshObserver.disconnect(); } catch (_) {}
                runtimeState.refreshObserver = null;
            }
            Object.keys(runtimeState.kickIntervals).forEach(uid => {
                clearInterval(runtimeState.kickIntervals[uid]);
                delete runtimeState.kickIntervals[uid];
            });
            Object.keys(runtimeState.saveIntervals).forEach(uid => {
                clearInterval(runtimeState.saveIntervals[uid]);
                delete runtimeState.saveIntervals[uid];
            });
            Object.keys(runtimeState.hiddenSaveIntervals).forEach(uid => {
                clearInterval(runtimeState.hiddenSaveIntervals[uid]);
                delete runtimeState.hiddenSaveIntervals[uid];
            });
            Object.keys(runtimeState.actionTimeouts).forEach(key => {
                clearTimeout(runtimeState.actionTimeouts[key]);
                delete runtimeState.actionTimeouts[key];
            });
            const kickIntervals = runtimeState.kickIntervals;
            const saveIntervals = runtimeState.saveIntervals;
            const hiddenSaveIntervals = runtimeState.hiddenSaveIntervals;
            const comboApi = createAutoComboApi({ runtimeState, safeNumber });
            comboApi.installRoomWatcher();

            function scheduleAction(uid, kind, delayMs, action) {
                const key = kind + ":" + uid + ":" + Date.now() + ":" + Math.random();
                runtimeState.actionTimeouts[key] = setTimeout(() => {
                    delete runtimeState.actionTimeouts[key];
                    action();
                }, Math.max(0, Number(delayMs) || 0));
            }

            /* ========================= KICK FETCH ========================= */
            async function doKick(uid) {
                return comboApi.doKick(uid);
            }

            function runKickCycle(uid) {
                uid = String(uid);

                const count = Math.max(1, safeNumber(S.kicksPerCycle, 1));
                const gap = Math.max(100, Math.floor(1000 / count));

                for (let i = 0; i < count; i++) {
                    scheduleAction(uid, "kick", i * gap, () => doKick(uid));
                }
            }

            function startKick(uid) {
                uid = String(uid);

                stopKick(uid, true);

                S.kickList[uid] = true;
                saveNow();

                // Basar basmaz anlık çalışır
                runKickCycle(uid);

                // Sonra Kick saniyesine bağlı devam eder
                kickIntervals[uid] = setInterval(() => {
                    runKickCycle(uid);
                }, Math.max(1, safeNumber(S.kickCycleSeconds, 1)) * 1000);

                comboLog("[KICK START]", uid);
            }

            function stopKick(uid, keepSaved = false) {
                uid = String(uid);

                clearInterval(kickIntervals[uid]);
                delete kickIntervals[uid];

                if (!keepSaved) {
                    delete S.kickList[uid];
                    saveNow();
                }

                comboLog("[KICK STOP]", uid, { keepSaved });
            }

            /* ========================= SAVE FETCH ========================= */
            async function doSave(uid) {
                return comboApi.doSave(uid);
            }

            function runSaveCycle(uid) {
                uid = String(uid);

                const count = Math.max(1, safeNumber(S.savesPerCycle, 1));
                const gap = Math.max(100, Math.floor(1000 / count));

                for (let i = 0; i < count; i++) {
                    scheduleAction(uid, "save", i * gap, () => doSave(uid));
                }
            }

            function startSave(uid) {
                uid = String(uid);

                stopSave(uid, true);

                if (!S.saveList.some(x => sameUid(x, uid))) {
                    S.saveList.push(uid);
                }

                saveNow();

                // Basar basmaz anlık çalışır
                runSaveCycle(uid);

                // Sonra Save saniyesine bağlı devam eder
                saveIntervals[uid] = setInterval(() => {
                    runSaveCycle(uid);
                }, Math.max(1, safeNumber(S.saveCycleSeconds, 1)) * 1000);

                comboLog("[SAVE START]", uid);
            }

            function stopSave(uid, keepSaved = false) {
                uid = String(uid);

                clearInterval(saveIntervals[uid]);
                delete saveIntervals[uid];

                if (!keepSaved) {
                    S.saveList = S.saveList.filter(x => !sameUid(x, uid));
                    saveNow();
                }

                comboLog("[SAVE STOP]", uid, { keepSaved });
            }

            /* ========================= GİZLİ SAVE FETCH ========================= */
            async function doHiddenSave(uid) {
                return comboApi.doHiddenSave(uid);
            }

            function startHiddenSave(uid) {
                uid = String(uid);

                stopHiddenSave(uid, true);

                ensureLists();

                if (!S.hiddenSaveList.some(x => sameUid(x, uid))) {
                    S.hiddenSaveList.push(uid);
                }

                saveNow();

                // Basar basmaz anlık çalışır
                doHiddenSave(uid);

                // GİZLİ normal Save timerından bağımsızdır
                hiddenSaveIntervals[uid] = setInterval(() => {
                    doHiddenSave(uid);
                }, 10000);

                comboLog("[GİZLİ SAVE START]", uid);
            }

            function stopHiddenSave(uid, keepSaved = false) {
                uid = String(uid);

                clearInterval(hiddenSaveIntervals[uid]);
                delete hiddenSaveIntervals[uid];

                if (!keepSaved) {
                    ensureLists();
                    S.hiddenSaveList = S.hiddenSaveList.filter(x => !sameUid(x, uid));
                    saveNow();
                }

                comboLog("[GİZLİ SAVE STOP]", uid, { keepSaved });
            }

            function clearSelections() {
                Object.keys(kickIntervals).forEach(uid => {
                    clearInterval(kickIntervals[uid]);
                    delete kickIntervals[uid];
                });

                Object.keys(saveIntervals).forEach(uid => {
                    clearInterval(saveIntervals[uid]);
                    delete saveIntervals[uid];
                });

                Object.keys(hiddenSaveIntervals).forEach(uid => {
                    clearInterval(hiddenSaveIntervals[uid]);
                    delete hiddenSaveIntervals[uid];
                });

                S.kickList = {};
                S.saveList = [];
                S.hiddenSaveList = [];

                comboApi.resetRoomId();

                saveNow();
                refreshList();

                comboLog("[AUTO COMBO] Tüm seçimler temizlendi.");
            }

            const comboView = createAutoComboView({
                utils,
                container,
                settings: S,
                shorten,
                sameUid,
                ensureLists,
                saveNow,
                getPlayers,
                kickIntervals,
                saveIntervals,
                hiddenSaveIntervals,
                startKick,
                stopKick,
                startSave,
                stopSave,
                startHiddenSave,
                stopHiddenSave,
                clearSelections
            });
            const refreshList = () => comboView.refreshList();
            comboView.mount();

            function scheduleRefreshList(delayMs = 80) {
                if (runtimeState.refreshTimer) clearTimeout(runtimeState.refreshTimer);
                runtimeState.refreshTimer = setTimeout(() => {
                    runtimeState.refreshTimer = null;
                    refreshList();
                }, Math.max(40, Number(delayMs) || 80));
            }

            function installLiveRefresh() {
                try {
                    const root = document.querySelector(".game-table, .room, .table, .players, .game, body") || document.body;
                    if (!root || typeof MutationObserver !== "function") return;
                    runtimeState.refreshObserver = new MutationObserver(mutations => {
                        const shouldRefresh = mutations.some(mutation => {
                            const target = mutation.target;
                            if (!target || target === container || container.contains(target)) return false;
                            if (mutation.type === "attributes") {
                                const name = String(mutation.attributeName || "");
                                if (!["data-uid", "data-pid", "class", "style"].includes(name)) return false;
                            }
                            return !!(
                                target.closest && target.closest(".player, .js-player, [data-uid], [data-pid]") ||
                                Array.from(mutation.addedNodes || []).some(node => node && node.nodeType === 1 && (
                                    node.matches && node.matches(".player, .js-player, [data-uid], [data-pid]") ||
                                    node.querySelector && node.querySelector(".player, .js-player, [data-uid], [data-pid]")
                                ))
                            );
                        });
                        if (shouldRefresh) scheduleRefreshList();
                    });
                    runtimeState.refreshObserver.observe(root, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ["data-uid", "data-pid", "class", "style"]
                    });
                } catch (_) {}
            }

            installLiveRefresh();

            /* ========================= AUTO RESUME ========================= */
            function autoResume() {
                ensureLists();

                Object.keys(S.kickList).forEach(uid => startKick(String(uid)));
                S.saveList.forEach(uid => startSave(String(uid)));
                S.hiddenSaveList.forEach(uid => startHiddenSave(String(uid)));
            }

            autoResume();

            /* ========================= AUTO REFRESH ========================= */
            if (window.__KISS_AUTO_COMBO_REFRESH_TIMER) clearInterval(window.__KISS_AUTO_COMBO_REFRESH_TIMER);
            window.__KISS_AUTO_COMBO_REFRESH_TIMER = setInterval(refreshList, 2000);

            window.__KISS_AUTO_COMBO_CLEANUP = () => {
                Object.keys(kickIntervals).forEach(uid => {
                    clearInterval(kickIntervals[uid]);
                    delete kickIntervals[uid];
                });
                Object.keys(saveIntervals).forEach(uid => {
                    clearInterval(saveIntervals[uid]);
                    delete saveIntervals[uid];
                });
                Object.keys(hiddenSaveIntervals).forEach(uid => {
                    clearInterval(hiddenSaveIntervals[uid]);
                    delete hiddenSaveIntervals[uid];
                });
                Object.keys(runtimeState.actionTimeouts).forEach(key => {
                    clearTimeout(runtimeState.actionTimeouts[key]);
                    delete runtimeState.actionTimeouts[key];
                });
                if (runtimeState.refreshTimer) clearTimeout(runtimeState.refreshTimer);
                runtimeState.refreshTimer = null;
                if (runtimeState.refreshObserver) {
                    try { runtimeState.refreshObserver.disconnect(); } catch (_) {}
                    runtimeState.refreshObserver = null;
                }
                if (window.__KISS_AUTO_COMBO_REFRESH_TIMER) clearInterval(window.__KISS_AUTO_COMBO_REFRESH_TIMER);
                window.__KISS_AUTO_COMBO_REFRESH_TIMER = null;
            };
        }
    };
}
