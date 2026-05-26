function createGeneralAutoGuardQueueRecovery(ctx) {
    const {
        state,
        config,
        appCtx,
        getKnownRoomId,
        getStoredAuthUid,
        normalizeRoomId,
        extractRoomId,
        logJson,
        beginRecoveryAction,
        endRecoveryAction,
        publishActiveGuardState,
        resetQueueObservation,
        resetLowPlayerObservation,
        getQueueStableFor
    } = ctx;

    const {
        QUEUE_STUCK_CHANGE_AFTER,
        QUEUE_STUCK_RECOVERY_COOLDOWN,
        QUEUE_STUCK_RECOVERY_ATTEMPTS,
        QUEUE_STUCK_RECOVERY_RETRY_DELAY,
        QUEUE_STUCK_RECOVERY_ROSTER_MAX_AGE,
        QUEUE_STUCK_RELOAD_COOLDOWN,
        QUEUE_STUCK_RELOAD_DELAY
    } = config;

    function getFreshRosterSnapshot(roomId) {
        try {
            const gameState = appCtx.getGameState && appCtx.getGameState("active-guard-roster");
            if (gameState && gameState.ownPresent && gameState.roomId) {
                if (roomId && normalizeRoomId(gameState.roomId) !== roomId) return null;
                const playerUids = Array.isArray(gameState.tableUids)
                    ? gameState.tableUids.map(uid => String(uid || "").trim()).filter(uid => /^\d+$/.test(uid) && uid !== String(gameState.authUserId || ""))
                    : [];
                if (playerUids.length) {
                    return {
                        roomId: normalizeRoomId(gameState.roomId),
                        ownUid: String(gameState.authUserId || ""),
                        playerUids,
                        at: Number(gameState.at || Date.now()),
                        count: Number(gameState.tablePlayerCount || playerUids.length + 1) || 0
                    };
                }
            }

            const roster = window.__kissDiag && window.__kissDiag.roster && window.__kissDiag.roster.last;
            if (!roster) return null;

            const snapshotRoomId = normalizeRoomId(roster.roomId);
            const snapshotAt = Number(roster.at || 0);
            const ownUid = /^\d+$/.test(String(roster.ownUid || "")) ? String(roster.ownUid) : String(appCtx.state.myUid || getStoredAuthUid() || "");
            const ids = Array.isArray(roster.ids) ? roster.ids : [];
            const playerUids = ids
                .map(uid => String(uid || "").trim())
                .filter(uid => /^\d+$/.test(uid) && uid !== ownUid);

            if (!snapshotRoomId || !snapshotAt) return null;
            if (roomId && snapshotRoomId !== roomId) return null;
            if (Date.now() - snapshotAt > QUEUE_STUCK_RECOVERY_ROSTER_MAX_AGE) return null;
            if (!roster.ownPresent) return null;
            if (!playerUids.length) return null;

            return {
                roomId: snapshotRoomId,
                ownUid,
                playerUids,
                at: snapshotAt,
                count: Number(roster.count || playerUids.length + (ownUid ? 1 : 0)) || 0
            };
        } catch (_) {
            return null;
        }
    }

    function logQueueRecovery(stage, payload = {}) {
        logJson("[ACTIVE GUARD] Queue stuck recovery", Object.assign({
            source: "active-guard-queue-stuck-recovery",
            stage,
            roomId: getKnownRoomId(),
            href: String(location.href || "")
        }, payload));
    }

    function logQueueRefresh(stage, payload = {}) {
        logJson("[ACTIVE GUARD] " + stage, Object.assign({
            source: "active-guard-queue-stuck-refresh",
            roomId: getKnownRoomId(),
            href: String(location.href || "")
        }, payload));
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function sitDownToFriend(anchorUid) {
        const runFetch = async () => {
            const res = await fetch("/api/room/sit_down_to_friend", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/javascript, */*; q=0.01"
                },
                body: new URLSearchParams({
                    friend_id: String(anchorUid),
                    userLocalTime: String(Math.floor(Date.now() / 1000)),
                    sessnew: ""
                })
            });
            const data = await res.json().catch(() => null);
            return { res, data };
        };

        const scheduler = window.__KISS_API_SCHEDULER__;
        const scheduled = scheduler && typeof scheduler.request === "function"
            ? await scheduler.request({ key: "active-guard:sit-down", type: "recovery", priority: "recovery", dedupeKey: true, replaceQueued: true, maxWaitMs: 5000 }, runFetch)
            : { ok: true, result: await runFetch() };
        if (!scheduled.ok) {
            return {
                status: 0,
                ok: false,
                result: null,
                error: scheduled.error || scheduled.skipped || "scheduler-failed",
                responseRoomId: "",
                data: null
            };
        }
        const res = scheduled.result.res;
        const data = scheduled.result.data;
        return {
            status: res.status,
            ok: !!res.ok,
            result: data && data.result,
            error: data && data.error,
            responseRoomId: extractRoomId(data),
            data
        };
    }

    async function recoverQueueStuck(decision) {
        if (!state.enabled) return false;

        const beforeRoomId = decision && decision.roomId;
        const queueSignature = decision && decision.queueSignature;
        const queueStableFor = decision && decision.queueStableFor;
        const now = Date.now();

        if (state.queueRecoveryInFlight) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "recovery-in-flight",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (!beforeRoomId) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "missing-room-id",
                beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (!queueSignature || queueStableFor < QUEUE_STUCK_CHANGE_AFTER || state.queueRoomId !== beforeRoomId) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "queue-not-stable",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (state.lastQueueRecoveryAt && now - state.lastQueueRecoveryAt < QUEUE_STUCK_RECOVERY_COOLDOWN) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "recovery-cooldown",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor,
                cooldownRemainingMs: QUEUE_STUCK_RECOVERY_COOLDOWN - (now - state.lastQueueRecoveryAt)
            });
            return false;
        }

        const roster = getFreshRosterSnapshot(beforeRoomId);
        if (!roster) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "missing-anchor-player",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (typeof beginRecoveryAction === "function" && !beginRecoveryAction("queue-recovery", {
            beforeRoomId,
            queueSignature,
            queueStableFor
        })) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "recovery-lock-busy",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        state.queueRecoveryInFlight = true;
        publishActiveGuardState();
        state.lastQueueRecoveryAt = now;

        logQueueRecovery("queue-stuck-recovery-eligible", {
            beforeRoomId,
            targetRoomId: beforeRoomId,
            queueSignature,
            queueStableFor,
            playerCount: decision.playerCount,
            anchorCount: roster.playerUids.length,
            rosterAgeMs: Date.now() - roster.at
        });

        try {
            const anchors = roster.playerUids.slice(0, QUEUE_STUCK_RECOVERY_ATTEMPTS);
            for (let attempt = 1; attempt <= QUEUE_STUCK_RECOVERY_ATTEMPTS; attempt += 1) {
                const anchorUid = anchors[(attempt - 1) % anchors.length];
                if (!anchorUid) break;

                logQueueRecovery("queue-stuck-recovery-anchor-selected", {
                    beforeRoomId,
                    targetRoomId: beforeRoomId,
                    anchorUid,
                    attempt,
                    queueSignature,
                    queueStableFor
                });

                logQueueRecovery("queue-stuck-recovery-follow-fetch", {
                    beforeRoomId,
                    targetRoomId: beforeRoomId,
                    anchorUid,
                    attempt,
                    queueSignature,
                    queueStableFor
                });

                let response;
                try {
                    response = await sitDownToFriend(anchorUid);
                } catch (error) {
                    response = {
                        status: 0,
                        ok: false,
                        result: false,
                        error: String(error && error.message ? error.message : error),
                        responseRoomId: ""
                    };
                }

                logQueueRecovery("queue-stuck-recovery-follow-response", {
                    beforeRoomId,
                    targetRoomId: beforeRoomId,
                    anchorUid,
                    attempt,
                    status: response.status,
                    ok: response.ok,
                    result: response.result,
                    error: response.error,
                    responseRoomId: response.responseRoomId,
                    queueSignature,
                    queueStableFor
                });

                if (response.ok && response.result && response.responseRoomId) {
                    appCtx.captureRoomFromJson(response.data);
                    resetQueueObservation();
                    resetLowPlayerObservation();
                    logQueueRecovery("queue-stuck-recovery-navigate", {
                        beforeRoomId,
                        targetRoomId: beforeRoomId,
                        anchorUid,
                        attempt,
                        responseRoomId: response.responseRoomId,
                        targetUrl: "/game/room?"
                    });
                    setTimeout(() => {
                        try {
                            location.href = "/game/room?";
                        } catch (_) {}
                    }, 250);
                    return true;
                }

                if (attempt < QUEUE_STUCK_RECOVERY_ATTEMPTS) {
                    logQueueRecovery("queue-stuck-recovery-retry", {
                        beforeRoomId,
                        targetRoomId: beforeRoomId,
                        anchorUid,
                        attempt,
                        nextAttempt: attempt + 1,
                        responseRoomId: response.responseRoomId,
                        blockReason: response.responseRoomId ? "response-not-successful" : "missing-response-room"
                    });
                    await delay(QUEUE_STUCK_RECOVERY_RETRY_DELAY);
                }
            }

            logQueueRecovery("queue-stuck-recovery-failed", {
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor,
                attempts: QUEUE_STUCK_RECOVERY_ATTEMPTS,
                blockReason: "attempts-exhausted"
            });
            return false;
        } finally {
            state.queueRecoveryInFlight = false;
            if (typeof endRecoveryAction === "function") endRecoveryAction("queue-recovery", {
                beforeRoomId,
                queueSignature,
                queueStableFor
            });
            publishActiveGuardState();
        }
    }

    function getQueueRefreshBlockReason(decision) {
        const now = Date.now();
        const roomId = decision && decision.roomId;
        const queueSignature = decision && decision.queueSignature;
        const queueStableFor = decision && decision.queueStableFor;

        if (!state.enabled) return "guard-disabled";
        if (!decision || !decision.reasons || !decision.reasons.includes("queue_stuck")) return "not-queue-stuck";
        if (!roomId) return "missing-room-id";
        if (!queueSignature || queueStableFor < QUEUE_STUCK_CHANGE_AFTER) return "queue-not-stable";
        if (state.queueRoomId !== roomId) return "queue-room-mismatch";
        if (state.queueSignature !== queueSignature) return "queue-signature-changed";
        if (state.queueRecoveryInFlight) return "queue-recovery-in-flight";
        if (state.profileRecoveryInFlight) return "profile-recovery-in-flight";
        if (state.queueReloadInFlight) return "reload-in-flight";
        if (state.lastQueueReloadAt && now - state.lastQueueReloadAt < QUEUE_STUCK_RELOAD_COOLDOWN) {
            return "reload-cooldown";
        }
        return "";
    }

    function scheduleQueueStuckRefresh(decision, recoveryResult) {
        const blockReason = getQueueRefreshBlockReason(decision);
        if (blockReason) {
            logQueueRefresh("queue-stuck-refresh-blocked", {
                blockReason,
                recoveryResult: !!recoveryResult,
                queueSignature: decision && decision.queueSignature,
                queueStableFor: decision && decision.queueStableFor
            });
            return false;
        }

        state.queueReloadInFlight = true;
        if (typeof beginRecoveryAction === "function" && !beginRecoveryAction("queue-reload", {
            roomId: decision.roomId,
            queueSignature: decision.queueSignature,
            queueStableFor: decision.queueStableFor
        })) {
            state.queueReloadInFlight = false;
            publishActiveGuardState();
            return false;
        }
        publishActiveGuardState();
        logQueueRefresh("queue-stuck-refresh-scheduled", {
            recoveryResult: !!recoveryResult,
            queueSignature: decision.queueSignature,
            queueStableFor: decision.queueStableFor,
            delayMs: QUEUE_STUCK_RELOAD_DELAY
        });

        setTimeout(() => {
            try {
                const currentRoomId = getKnownRoomId();
                const stableFor = getQueueStableFor(Date.now(), currentRoomId);
                const stillStable = !!(
                    currentRoomId &&
                    currentRoomId === decision.roomId &&
                    state.queueRoomId === decision.roomId &&
                    state.queueSignature === decision.queueSignature &&
                    stableFor >= QUEUE_STUCK_CHANGE_AFTER
                );

                if (!stillStable || state.queueRecoveryInFlight || state.profileRecoveryInFlight) {
                    logQueueRefresh("queue-stuck-refresh-blocked", {
                        blockReason: "post-delay-state-changed",
                        currentRoomId,
                        expectedRoomId: decision.roomId,
                        queueSignature: state.queueSignature,
                        expectedSignature: decision.queueSignature,
                        queueStableFor: stableFor
                    });
                    return;
                }

                state.lastQueueReloadAt = Date.now();
                logQueueRefresh("queue-stuck-refresh-navigate", {
                    roomId: currentRoomId,
                    queueSignature: state.queueSignature,
                    queueStableFor: stableFor,
                    targetUrl: "/game/room?"
                });
                location.href = "/game/room?";
            } catch (error) {
                logQueueRefresh("queue-stuck-refresh-blocked", {
                    blockReason: "reload-error",
                    error: String(error && error.message ? error.message : error).slice(0, 160)
                });
            } finally {
                state.queueReloadInFlight = false;
                if (typeof endRecoveryAction === "function") endRecoveryAction("queue-reload", {
                    roomId: decision.roomId,
                    queueSignature: decision.queueSignature
                });
                publishActiveGuardState();
            }
        }, QUEUE_STUCK_RELOAD_DELAY);

        return true;
    }

    return {
        recoverQueueStuck,
        scheduleQueueStuckRefresh
    };
}
