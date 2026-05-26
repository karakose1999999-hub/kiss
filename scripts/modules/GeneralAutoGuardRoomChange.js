function createGeneralAutoGuardRoomChange(ctx) {
    const {
        appCtx,
        state,
        config,
        getKnownRoomId,
        hasUndefinedRoomRoute,
        getMe,
        extractRoomId,
        logJson,
        beginRecoveryAction,
        endRecoveryAction,
        publishActiveGuardState,
        resetQueueObservation,
        resetLowPlayerObservation,
        getQueueStableFor,
        getLowPlayerFor,
        recoverQueueStuck,
        scheduleQueueStuckRefresh
    } = ctx;

    const {
        QUEUE_STUCK_CHANGE_AFTER,
        LOW_PLAYER_LIMIT,
        LOW_PLAYER_CHANGE_AFTER,
        ROOM_CHANGE_COOLDOWN
    } = config;

    function buildRoomChangeDecision() {
        const now = Date.now();
        const roomId = getKnownRoomId();
        const queueStableFor = getQueueStableFor(now, roomId);
        const lowPlayerFor = getLowPlayerFor(now, roomId);
        const reasons = [];

        if (queueStableFor >= QUEUE_STUCK_CHANGE_AFTER) reasons.push("queue_stuck");
        if (lowPlayerFor >= LOW_PLAYER_CHANGE_AFTER) reasons.push("low-player-count");

        return {
            roomId,
            reasons,
            reason: reasons.join("+"),
            queueSignature: state.queueSignature || "",
            queueStableFor,
            playerCount: state.playerCount || 0,
            lowPlayerCount: state.lowPlayerCount || 0,
            lowPlayerFor
        };
    }

    function getRoomChangeBlockReason(decision) {
        if (!state.enabled) return "guard-disabled";
        if (state.changeInFlight) return "change-in-flight";
        if (!decision || !decision.roomId) return "missing-room-id";
        if (!decision.reasons || !decision.reasons.length) return "no-stable-reason";
        if (hasUndefinedRoomRoute()) return "undefined-route";

        if (!getMe()) return "guard-not-ready";

        if (decision.reasons.includes("queue_stuck") && state.queueRoomId !== decision.roomId) {
            return "queue-room-mismatch";
        }

        if (
            decision.reasons.includes("low-player-count") &&
            state.playerCountRoomId &&
            state.playerCountRoomId !== decision.roomId
        ) {
            return "player-room-mismatch";
        }

        if (decision.reasons.includes("low-player-count") && (!state.lowPlayerCount || state.lowPlayerCount > LOW_PLAYER_LIMIT)) {
            return "unknown-player-count";
        }

        if (decision.reasons.includes("queue_stuck") && (!state.queueSignature || decision.queueStableFor < QUEUE_STUCK_CHANGE_AFTER)) {
            return "queue-not-stable";
        }

        return "";
    }

    function logRoomChangeCancel(decision, blockReason, extra = {}) {
        logJson("[ACTIVE GUARD] Rastgele masa iptal", Object.assign({
            source: "active-guard-random-room",
            reason: decision && decision.reason,
            blockReason,
            roomId: decision && decision.roomId,
            queueSignature: decision && decision.queueSignature,
            queueStableFor: decision && decision.queueStableFor,
            playerCount: decision && decision.playerCount,
            lowPlayerFor: decision && decision.lowPlayerFor
        }, extra));
    }

    async function changeRandomRoom(decision) {
        if (decision && decision.reasons && decision.reasons.includes("queue_stuck")) {
            logRoomChangeCancel(decision, "queue-stuck-random-change-disabled");
            return false;
        }

        const blockReason = getRoomChangeBlockReason(decision);
        if (blockReason) {
            logRoomChangeCancel(decision, blockReason);
            return false;
        }

        const now = Date.now();
        if (now - state.lastRoomChangeAt < ROOM_CHANGE_COOLDOWN) {
            logJson("[ACTIVE GUARD] Rastgele masa beklemede", {
                source: "active-guard-random-room",
                reason: decision.reason,
                cooldownRemainingMs: ROOM_CHANGE_COOLDOWN - (now - state.lastRoomChangeAt)
            });
            return false;
        }

        if (state.lastRoomChangeRejectedAt && now - state.lastRoomChangeRejectedAt < ROOM_CHANGE_COOLDOWN) {
            logJson("[ACTIVE GUARD] Rastgele masa beklemede", {
                source: "active-guard-random-room",
                reason: decision.reason,
                cooldownRemainingMs: ROOM_CHANGE_COOLDOWN - (now - state.lastRoomChangeRejectedAt),
                lastReject: true
            });
            return false;
        }

        const beforeRoomId = decision.roomId;
        if (typeof beginRecoveryAction === "function" && !beginRecoveryAction("room-change", {
            beforeRoomId,
            reason: decision.reason,
            queueSignature: decision.queueSignature
        })) {
            logRoomChangeCancel(decision, "recovery-lock-busy", { beforeRoomId });
            return false;
        }

        state.changeInFlight = true;
        publishActiveGuardState();

        logJson("[ACTIVE GUARD] Rastgele masa karar", {
            source: "active-guard-random-room",
            reason: decision.reason,
            beforeRoomId,
            queueSignature: decision.queueSignature,
            queueStableFor: decision.queueStableFor,
            playerCount: decision.playerCount,
            lowPlayerFor: decision.lowPlayerFor
        });

        try {
            const runFetch = async () => {
                const res = await fetch("/api/room/change/", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "application/json, text/javascript, */*; q=0.01"
                    },
                    body: new URLSearchParams({
                        userLocalTime: String(Math.floor(Date.now() / 1000)),
                        sessnew: ""
                    })
                });
                const data = await res.json().catch(() => null);
                return { res, data };
            };

            const scheduler = window.__KISS_API_SCHEDULER__;
            const scheduled = scheduler && typeof scheduler.request === "function"
                ? await scheduler.request({ key: "active-guard:room-change", type: "roomChange", priority: "roomChange", dedupeKey: true, replaceQueued: true, maxWaitMs: 8000 }, runFetch)
                : { ok: true, result: await runFetch() };
            if (!scheduled.ok) throw new Error(scheduled.error || scheduled.skipped || "scheduler-failed");
            const res = scheduled.result.res;
            const data = scheduled.result.data;
            const nextRoomId = extractRoomId(data);

            logJson("[ACTIVE GUARD] Rastgele masa cevap", {
                source: "active-guard-random-room",
                reason: decision.reason,
                status: res.status,
                ok: !!res.ok,
                result: data && data.result,
                beforeRoomId,
                nextRoomId,
                data
            });

            if (!res.ok) {
                logRoomChangeCancel(decision, "fetch-failed", { status: res.status, beforeRoomId, nextRoomId });
                return false;
            }

            if (!(data && data.result) || !nextRoomId) {
                const rawRoomId = data && data.status && (data.status.room_id !== undefined ? data.status.room_id : data.status.roomId);
                const rawRoomIdText = rawRoomId === undefined || rawRoomId === null ? "" : String(rawRoomId);
                const serverSideChangeSuspected = !!(data && data.result && rawRoomIdText === "0");
                if (serverSideChangeSuspected) {
                    state.lastRoomChangeRejectedAt = Date.now();
                }
                logRoomChangeCancel(decision, "no-next-room", {
                    status: res.status,
                    beforeRoomId,
                    nextRoomId,
                    serverSideChangeSuspected
                });
                return false;
            }

            if (nextRoomId === beforeRoomId) {
                logRoomChangeCancel(decision, "same-room", { status: res.status, beforeRoomId, nextRoomId });
                return false;
            }

            appCtx.captureRoomFromJson(data);
            state.lastRoomChangeAt = Date.now();
            state.lastRoomChangeRejectedAt = 0;
            resetQueueObservation();
            resetLowPlayerObservation();

            setTimeout(() => {
                try {
                    logJson("[ACTIVE GUARD] navigate", {
                        source: "active-guard-random-room",
                        reason: decision.reason,
                        beforeRoomId,
                        nextRoomId
                    });
                    location.href = "/game/room?";
                } catch (_) {}
            }, 250);

            return true;
        } catch (error) {
            console.error("[ACTIVE GUARD] Rastgele masa hatasi", String(error && error.message ? error.message : error));
            logRoomChangeCancel(decision, "fetch-failed", {
                beforeRoomId,
                error: String(error && error.message ? error.message : error)
            });
            return false;
        } finally {
            state.changeInFlight = false;
            if (typeof endRecoveryAction === "function") endRecoveryAction("room-change", {
                beforeRoomId,
                reason: decision.reason
            });
            publishActiveGuardState();
        }
    }

    function evaluateRoomChange() {
        if (!state.enabled) return;

        const decision = buildRoomChangeDecision();
        if (!decision.reasons.length) {
            logJson("[ACTIVE GUARD] Rastgele masa icin bekleniyor", {
                source: "active-guard-watch",
                roomId: decision.roomId,
                queueSignature: decision.queueSignature,
                queueStableFor: decision.queueStableFor,
                requiredStuck: QUEUE_STUCK_CHANGE_AFTER,
                playerCount: decision.playerCount,
                lowPlayerFor: decision.lowPlayerFor,
                requiredLowPlayerAge: LOW_PLAYER_CHANGE_AFTER
            });
            return;
        }

        if (decision.reasons.includes("queue_stuck")) {
            recoverQueueStuck(decision).then(result => {
                scheduleQueueStuckRefresh(decision, result);
            }).catch(error => {
                logJson("[ACTIVE GUARD] queue-stuck-refresh-blocked", {
                    source: "active-guard-queue-stuck-refresh",
                    roomId: getKnownRoomId(),
                    href: String(location.href || ""),
                    blockReason: "recovery-error",
                    error: String(error && error.message ? error.message : error).slice(0, 160),
                    queueSignature: decision.queueSignature,
                    queueStableFor: decision.queueStableFor
                });
                scheduleQueueStuckRefresh(decision, false);
            });
            return;
        }

        changeRandomRoom(decision);
    }

    return {
        evaluateRoomChange,
        changeRandomRoom,
        buildRoomChangeDecision
    };
}
