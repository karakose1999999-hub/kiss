function createIdRoomFollowerModule(utils) {
    return {
        name: "idRoomFollower",
        title: "ID Takip",

        defaultSettings: createIdRoomFollowerDefaultSettings(),

        renderSettings(container) {
            try {
                if (typeof window.__KISS_ID_ROOM_FOLLOWER_CLEANUP === "function") {
                    window.__KISS_ID_ROOM_FOLLOWER_CLEANUP();
                }
            } catch (_) {}

            const settings = utils.loadSettings(this.name, this.defaultSettings);
            if (!Array.isArray(settings.savedUsers)) settings.savedUsers = [];
            settings.intervalSeconds = Number(settings.intervalSeconds) || 10;

            settings.activeFollowId = getNumericCandidate(settings.activeFollowId);

            let loadedUsers = [];
            let followTimer = null;
            let resumeTimer = null;
            let activeFollowId = settings.activeFollowId;
            let isChecking = false;
            const {
                RECENT_EXIT_WINDOW_MS,
                ROOM_LOCK_INTERVAL_MS,
                ROOM_LOCK_ANCHOR_REFRESH_MS,
                ROOM_LOCK_MAX_MS
            } = createIdRoomFollowerConfig();

            const saveNow = () => utils.saveSettings(this.name, settings);
            const sameId = (a, b) => String(a) === String(b);
            const nowSeconds = () => String(Math.floor(Date.now() / 1000));
            const accountId = String(window.__KISS_ACCOUNT_ID || "");
            let view = null;
            const setStatus = text => { if (view) view.setStatus(text); };
            const setRoomLockLine = text => { if (view) view.setRoomLockLine(text); };
            const renderLoadedUsers = () => { if (view) view.renderLoadedUsers(); };
            const renderSavedUsers = () => { if (view) view.renderSavedUsers(); };
            const renderRoomLock = () => { if (view) view.renderRoomLock(); };
            const renderAll = () => { if (view) view.renderAll(); };
            const normalizeRoomId = value => {
                const text = String(value || "").trim();
                return /^\d+$/.test(text) ? text : "";
            };
            const getKnownRoomId = () => getGameState("known-room").roomId || normalizeRoomId(window.__KISS_LAST_ROOM_ID || localStorage.getItem("kiss_hidden_last_room_id"));

            if (!settings.roomLock || typeof settings.roomLock !== "object") {
                settings.roomLock = createIdRoomFollowerRoomLockState();
            }

            function getNumericCandidate(value) {
                const text = String(value || "").trim();
                return /^\d+$/.test(text) ? text : "";
            }

            function readDataLayerUserId() {
                try {
                    const dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
                    for (const item of dataLayer) {
                        const id = getNumericCandidate(item && (item.userID || item.userId || item.uid || item.id));
                        if (id) return id;
                    }
                } catch (_) {}
                return "";
            }

            function readTopfaceRoomId() {
                try {
                    for (let i = 0; i < localStorage.length; i += 1) {
                        const key = String(localStorage.key(i) || "");
                        if (!key.startsWith("topface_stprev_room_id")) continue;
                        const raw = localStorage.getItem(key);
                        const direct = normalizeRoomId(raw);
                        if (direct) return direct;
                        try {
                            const parsed = JSON.parse(raw);
                            const nested = normalizeRoomId(parsed && parsed.data && parsed.data.value);
                            if (nested) return nested;
                        } catch (_) {}
                    }
                } catch (_) {}
                return "";
            }

            function readAuthUserId() {
                try {
                    return getNumericCandidate(window.__KISS_AUTH_USER_ID) ||
                        getNumericCandidate(localStorage.getItem("kiss_auth_user_id")) ||
                        readDataLayerUserId() ||
                        getNumericCandidate(window._trackJs && window._trackJs.userId);
                } catch (_) {
                    return "";
                }
            }

            function getGameState(reason = "id-follow") {
                try {
                    const provider = window.__KISS_GAME_STATE_PROVIDER__;
                    if (provider && typeof provider.refresh === "function") {
                        return provider.refresh(reason, { silent: true });
                    }
                } catch (_) {}

                try {
                    const shared = window.__KISS_GAME_STATE__;
                    if (shared && Date.now() - Number(shared.at || 0) < 3000 && Array.isArray(shared.tablePlayers)) {
                        return shared;
                    }
                } catch (_) {}

                const authUserId = readAuthUserId();
                const roomId = normalizeRoomId(window.__KISS_LAST_ROOM_ID) ||
                    normalizeRoomId(localStorage.getItem("kiss_hidden_last_room_id")) ||
                    readTopfaceRoomId();
                const tableUsers = readTableUsers();
                const tableUids = tableUsers.map(user => user.id);
                const ownPresent = !!(authUserId && tableUids.includes(authUserId));
                const gameState = {
                    at: Date.now(),
                    reason,
                    roomId,
                    authUserId,
                    ownUid: authUserId,
                    ownPresent,
                    tablePlayerCount: tableUsers.length,
                    tableUids,
                    tablePlayers: tableUsers.map(user => ({ uid: user.id, userId: user.id, name: user.name })),
                    playerActivityByUid: readPlayerActivityMap(tableUids)
                };
                try { window.__KISS_GAME_STATE__ = gameState; } catch (_) {}
                return gameState;
            }

            const {
                normalizeUser,
                uniqueUsers,
                readTableUsers,
                readRoomLockAnchors,
                sameAnchorUids,
                readPlayerActivity,
                readPlayerActivityMap,
                hasRecentTargetExit
            } = createIdRoomFollowerHelpers({
                RECENT_EXIT_WINDOW_MS,
                getGameState,
                getNumericCandidate,
                normalizeRoomId,
                readAuthUserId
            });

            function getRoomUsers(gameState = null) {
                const stateNow = gameState || getGameState("room-users");
                if (Array.isArray(stateNow.tablePlayers)) {
                    return uniqueUsers(stateNow.tablePlayers.map(player => ({
                        id: player.uid || player.userId || player.id,
                        name: player.name || player.uid || player.userId || player.id
                    })));
                }
                return readTableUsers();
            }

            function logJson(label, payload) {
                try {
                    console.log(label + " " + JSON.stringify(payload || {}));
                } catch (_) {
                    console.log(label);
                }
            }

            const {
                emitFollowEvent,
                readTargetQueueState,
                tryGoById
            } = createIdRoomFollowerApi({
                accountId,
                nowSeconds
            });

            function addSavedUser(user) {
                const normalized = normalizeUser(user);
                if (!normalized) return false;

                settings.savedUsers = settings.savedUsers.filter(item => !sameId(item.id, normalized.id));
                settings.savedUsers.push({
                    id: normalized.id,
                    name: normalized.name,
                    savedAt: Date.now()
                });
                saveNow();
                return true;
            }

            function removeSavedUser(id) {
                settings.savedUsers = settings.savedUsers.filter(item => !sameId(item.id, id));
                if (sameId(activeFollowId, id)) stopFollow();
                saveNow();
                renderAll();
            }

            function stopFollow(keepSaved = false) {
                const stoppedId = activeFollowId || settings.activeFollowId;
                if (followTimer) clearInterval(followTimer);
                followTimer = null;
                activeFollowId = "";
                isChecking = false;
                if (!keepSaved) {
                    settings.activeFollowId = "";
                    saveNow();
                    if (stoppedId) emitFollowEvent(stoppedId, "stopped");
                }
                setStatus("Takip durdu.");
                renderSavedUsers();
            }

            const roomLock = createIdRoomFollowerRoomLock({
                settings,
                config: {
                    ROOM_LOCK_INTERVAL_MS,
                    ROOM_LOCK_ANCHOR_REFRESH_MS,
                    ROOM_LOCK_MAX_MS
                },
                saveNow,
                normalizeRoomId,
                getKnownRoomId,
                getGameState,
                getNumericCandidate,
                readRoomLockAnchors,
                sameAnchorUids,
                tryGoById,
                logJson,
                setStatus,
                setRoomLockLine,
                renderRoomLock,
                getActiveFollowId: () => activeFollowId,
                getSettingsActiveFollowId: () => settings.activeFollowId
            });
            const startRoomLock = roomLock.startRoomLock;
            const stopRoomLock = roomLock.stopRoomLock;
            const destroyRoomLock = roomLock.destroyRoomLock;

            try {
                window.__KISS_ID_ROOM_FOLLOWER_CLEANUP = () => {
                    if (followTimer) clearInterval(followTimer);
                    followTimer = null;
                    if (resumeTimer) clearTimeout(resumeTimer);
                    resumeTimer = null;
                    isChecking = false;
                    if (typeof destroyRoomLock === "function") destroyRoomLock();
                };
            } catch (_) {}

            function pauseFollowForNavigation(reason, meta = {}) {
                if (followTimer) clearInterval(followTimer);
                followTimer = null;
                isChecking = false;
                activeFollowId = settings.activeFollowId;
                saveNow();
                logJson("[ID TAKIP NAVIGATE]", Object.assign({ reason }, meta));
            }
            async function checkFollow(id) {
                if (isChecking) return;
                isChecking = true;

                try {
                    const gameState = getGameState("follow-check");
                    const tableUsers = getRoomUsers(gameState);
                    const targetVisible = tableUsers.some(user => sameId(user.id, id));
                    const stateReady = !!(gameState.authUserId && gameState.roomId && gameState.ownPresent);
                    const targetExit = hasRecentTargetExit(id, gameState);
                    const isAlreadyAtTable = targetVisible && stateReady && !targetExit.recent;
                    const currentConfirmedRoomId = normalizeRoomId(gameState.roomId) || getKnownRoomId();

                    if (isAlreadyAtTable) {
                        emitFollowEvent(id, "target_visible_probe", {
                            currentRoomId: currentConfirmedRoomId
                        });
                        setStatus("Oyuncu masada gorunuyor. Aktif oda fetch ile dogrulaniyor...");
                        logJson("[ID TAKIP STATE]", {
                            id,
                            reason: "target_visible_probe",
                            authUserId: gameState.authUserId,
                            ownPresent: gameState.ownPresent,
                            tableUserCount: tableUsers.length,
                            knownRoomId: currentConfirmedRoomId
                        });
                    }

                    if (targetVisible && stateReady && targetExit.recent) {
                        logJson("[ID TAKIP STATE]", {
                            id,
                            targetUserId: String(id),
                            reason: "target-visible-but-recent-exit",
                            authUserId: gameState.authUserId,
                            ownPresent: gameState.ownPresent,
                            tableUserCount: tableUsers.length,
                            knownRoomId: gameState.roomId,
                            lastExitAt: targetExit.lastExitAt,
                            lastLeftAt: targetExit.lastLeftAt,
                            lastJoinAt: targetExit.lastJoinAt,
                            lastSeenAt: targetExit.lastSeenAt,
                            exitAgeMs: targetExit.exitAgeMs,
                            activitySource: targetExit.source
                        });
                    }

                    if (targetVisible && !stateReady) {
                        logJson("[ID TAKIP STATE]", {
                            id,
                            reason: "target-visible-but-local-state-not-ready",
                            blockReason: !gameState.authUserId ? "missing-auth-user-id" : (!gameState.roomId ? "missing-room-id" : "own-not-in-roster"),
                            authUserId: gameState.authUserId,
                            ownPresent: gameState.ownPresent,
                            tableUserCount: tableUsers.length,
                            knownRoomId: gameState.roomId
                        });
                    }

                    const targetQueueState = await readTargetQueueState(id);
                    if (targetQueueState.found && targetQueueState.disabled && !targetVisible) {
                        setStatus("Hedef sirada. Fetch atilmadi, durum tekrar kontrol edilecek.");
                        emitFollowEvent(id, "target_queued");
                        logJson("[ID TAKIP SKIP]", { id, reason: "target_queued" });
                        return;
                    }
                    if (targetQueueState.found && targetQueueState.disabled && targetVisible) {
                        logJson("[ID TAKIP STATE]", {
                            id,
                            reason: "target-visible-queue-disabled-probe",
                            knownRoomId: currentConfirmedRoomId
                        });
                    }

                    const data = await tryGoById(id);
                    const roomId = normalizeRoomId(
                        data && data.status && (data.status.room_id || data.status.roomId) ||
                        data && (data.room_id || data.roomId)
                    );

                    logJson("[ID TAKIP]", {
                        id,
                        result: data && data.result,
                        error: data && data.error,
                        returnedRoomId: roomId,
                        currentRoomId: currentConfirmedRoomId,
                        targetVisibleLocal: targetVisible,
                        tableUserCount: tableUsers.length
                    });

                    if (data && data.error) {
                        if (targetVisible) {
                            emitFollowEvent(id, "visible_but_unconfirmed", {
                                error: data.error,
                                currentRoomId: currentConfirmedRoomId
                            });
                            setStatus("Oyuncu masada gorunuyor ama aktif oda dogrulanamadi. Takip devam ediyor.");
                            logJson("[ID TAKIP STATE]", {
                                id,
                                reason: "visible_but_unconfirmed",
                                error: data.error,
                                knownRoomId: currentConfirmedRoomId
                            });
                            return;
                        }
                        emitFollowEvent(id, targetQueueState.found ? "eligible_failed" : "target_missing");
                        setStatus("Masada degil, su an gidilemiyor. 10 sn sonra tekrar denenecek.");
                        return;
                    }

                    if (data && data.result && roomId) {
                        if (currentConfirmedRoomId && roomId === currentConfirmedRoomId) {
                            emitFollowEvent(id, "same_table_confirmed", {
                                currentRoomId: currentConfirmedRoomId,
                                returnedRoomId: roomId,
                                targetVisibleLocal: targetVisible
                            });
                            setStatus("Oyuncu ayni odada dogrulandi. Takip kontrolu devam ediyor.");
                            logJson("[ID TAKIP STATE]", {
                                id,
                                reason: "same_table_confirmed",
                                returnedRoomId: roomId,
                                currentRoomId: currentConfirmedRoomId,
                                targetVisibleLocal: targetVisible
                            });
                            return;
                        }

                        emitFollowEvent(id, "target_moved_room", {
                            currentRoomId: currentConfirmedRoomId,
                            returnedRoomId: roomId,
                            targetVisibleLocal: targetVisible
                        });
                        setStatus("Hedefin aktif odasi farkli. Gidiliyor...");
                        pauseFollowForNavigation("id-follow-success", { id, returnedRoomId: roomId, knownRoomId: currentConfirmedRoomId });
                        location.href = "/game/room?";
                        return;
                    }

                    if (targetVisible) {
                        emitFollowEvent(id, "visible_but_unconfirmed", {
                            currentRoomId: currentConfirmedRoomId,
                            returnedRoomId: roomId
                        });
                        setStatus("Oyuncu masada gorunuyor ama aktif oda dogrulanamadi. Takip devam ediyor.");
                        return;
                    }

                    emitFollowEvent(id, targetQueueState.found ? "eligible_failed" : "target_missing");
                    setStatus("Gecerli oda bulunamadi. Takip devam ediyor.");
                } catch (error) {
                    console.error("[ID TAKIP ERROR]", error);
                    setStatus("Kontrol hatasi. Takip devam ediyor.");
                } finally {
                    isChecking = false;
                    renderSavedUsers();
                }
            }

            async function startFollow(id) {
                if (settings.roomLock && settings.roomLock.active) {
                    setStatus("Once oda kilidini kapatin.");
                    return;
                }
                stopFollow(true);
                activeFollowId = String(id);
                settings.activeFollowId = activeFollowId;
                saveNow();
                setStatus("Takip baslatiliyor...");
                renderSavedUsers();

                setStatus("Takip basladi. Her 10 saniyede masa kontrol edilecek.");
                await checkFollow(activeFollowId);
                if (activeFollowId) {
                    followTimer = setInterval(() => checkFollow(activeFollowId), 10000);
                }
                renderSavedUsers();
            }
            view = createIdRoomFollowerView({
                utils,
                container,
                settings,
                getLoadedUsers: () => loadedUsers,
                setLoadedUsers: users => { loadedUsers = Array.isArray(users) ? users : []; },
                uniqueUsers,
                sameId,
                getActiveFollowId: () => activeFollowId,
                getRoomUsers,
                addSavedUser,
                removeSavedUser,
                startFollow,
                stopFollow,
                startRoomLock,
                stopRoomLock,
                saveNow
            });
            view.mount();

            if (settings.activeFollowId) {
                const hasSavedTarget = settings.savedUsers.some(user => sameId(user.id, settings.activeFollowId));
                if (hasSavedTarget) {
                    resumeTimer = setTimeout(() => {
                        resumeTimer = null;
                        startFollow(settings.activeFollowId);
                    }, 500);
                } else {
                    settings.activeFollowId = "";
                    saveNow();
                }
            }

            roomLock.resumeRoomLock();
        }
    };
}









