function createGeneralAutoGuardProfileRecovery(ctx) {
    const {
        state,
        config,
        getKnownRoomId,
        hasUndefinedRoomRoute,
        getPlayerUid,
        isInsideOwnPlayer,
        describeElement,
        dispatchMouse,
        logInteraction,
        beginRecoveryAction,
        endRecoveryAction,
        publishActiveGuardState,
        isVisible
    } = ctx;

    const {
        PROFILE_RECOVERY_IDLE_AFTER,
        PROFILE_RECOVERY_COOLDOWN,
        PROFILE_RECOVERY_BAD_COOLDOWN,
        PROFILE_RECOVERY_MONITOR_MS,
        PROFILE_RECOVERY_PENALTY_KEY
    } = config;

    function getRecoveryPenaltyUntil() {
        try {
            const value = Number(localStorage.getItem(PROFILE_RECOVERY_PENALTY_KEY) || 0);
            return Number.isFinite(value) ? value : 0;
        } catch (_) {
            return 0;
        }
    }

    function setRecoveryPenalty(durationMs) {
        try {
            localStorage.setItem(PROFILE_RECOVERY_PENALTY_KEY, String(Date.now() + durationMs));
        } catch (_) {}
    }

    function getLastDiagSocketAt() {
        try {
            const recent = window.__kissDiag && Array.isArray(window.__kissDiag.recent) ? window.__kissDiag.recent : [];
            let lastAt = 0;
            recent.forEach(item => {
                if (!item || String(item.kind || "").indexOf("socket") !== 0) return;
                const at = Number(item.at || 0);
                if (at > lastAt) lastAt = at;
            });
            return lastAt;
        } catch (_) {
            return 0;
        }
    }

    function getObservationStableFor(now = Date.now()) {
        return state.lastObservationChangeAt ? now - state.lastObservationChangeAt : 0;
    }

    function getOwnPresent(player) {
        try {
            return !!(player && document.contains(player) && isVisible(player));
        } catch (_) {
            return false;
        }
    }

    function installProfileRecoveryWatchers() {
        if (state.profileRecoveryWatchersInstalled) return;
        state.profileRecoveryWatchersInstalled = true;

        const reportNavigation = eventName => {
            try {
                if (!state.profileRecoveryInFlight) return;
                const href = String(location.href || "");
                logInteraction("profile-click-caused-navigation", {
                    blockReason: "navigation-during-recovery-click",
                    eventName,
                    beforeRoomId: state.profileRecoveryBeforeRoomId,
                    beforeHref: state.profileRecoveryBeforeHref,
                    afterRoomId: getKnownRoomId(),
                    afterHref: href,
                    elapsedMs: Date.now() - state.profileRecoveryStartedAt
                });
                setRecoveryPenalty(PROFILE_RECOVERY_BAD_COOLDOWN);
            } catch (_) {}
        };

        try {
            window.addEventListener("beforeunload", () => reportNavigation("beforeunload"), true);
            window.addEventListener("pagehide", () => reportNavigation("pagehide"), true);
        } catch (_) {}
    }

    function findSafeProfilePoint(player, hoverTarget) {
        if (!player || !hoverTarget) return null;
        const rect = hoverTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        const points = [
            [0.5, 0.5],
            [0.35, 0.5],
            [0.65, 0.5],
            [0.5, 0.35],
            [0.5, 0.65]
        ];

        for (const point of points) {
            const x = rect.left + rect.width * point[0];
            const y = rect.top + rect.height * point[1];
            if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;

            const hit = document.elementFromPoint(x, y);
            if (isInsideOwnPlayer(player, hit)) {
                return { x, y, hit };
            }
        }

        const x = rect.left + rect.width * 0.5;
        const y = rect.top + rect.height * 0.5;
        return {
            x,
            y,
            hit: document.elementFromPoint(x, y),
            blocked: true
        };
    }

    function buildProfileRecoveryDecision(player, target, ownUid) {
        const now = Date.now();
        const roomId = getKnownRoomId();
        const href = String(location.href || "");
        const observationStableFor = getObservationStableFor(now);
        const penaltyUntil = getRecoveryPenaltyUntil();
        const lastSocketAt = getLastDiagSocketAt();
        const socketSilentFor = lastSocketAt ? now - lastSocketAt : 0;
        const sinceLastClick = state.lastProfileRecoveryClickAt ? now - state.lastProfileRecoveryClickAt : Infinity;

        const decision = {
            eligible: false,
            blockReason: "",
            roomId,
            ownUid,
            href,
            observationStableFor,
            requiredStableFor: PROFILE_RECOVERY_IDLE_AFTER,
            socketSilentFor,
            sinceLastClick: Number.isFinite(sinceLastClick) ? sinceLastClick : null,
            cooldownRemainingMs: 0,
            penaltyRemainingMs: Math.max(0, penaltyUntil - now),
            playerCount: state.playerCount || 0,
            queueSignature: state.queueSignature || "",
            target: describeElement(target)
        };

        if (!roomId) decision.blockReason = "missing-room-id";
        else if (!player || !target || !getOwnPresent(player)) decision.blockReason = "own-player-missing";
        else if (ownUid && getPlayerUid(player) && getPlayerUid(player) !== ownUid) decision.blockReason = "uid-mismatch";
        else if (hasUndefinedRoomRoute(href)) decision.blockReason = "undefined-route";
        else if (penaltyUntil > now) decision.blockReason = "bad-click-penalty";
        else if (state.profileRecoveryInFlight) decision.blockReason = "recovery-in-flight";
        else if (sinceLastClick < PROFILE_RECOVERY_COOLDOWN) {
            decision.blockReason = "recovery-cooldown";
            decision.cooldownRemainingMs = PROFILE_RECOVERY_COOLDOWN - sinceLastClick;
        } else if (observationStableFor < PROFILE_RECOVERY_IDLE_AFTER) {
            decision.blockReason = "not-frozen";
        } else if (lastSocketAt && socketSilentFor < PROFILE_RECOVERY_IDLE_AFTER) {
            decision.blockReason = "socket-recent";
        } else {
            decision.eligible = true;
        }

        return decision;
    }

    function finishProfileRecovery(result, extra = {}) {
        logInteraction(result, Object.assign({
            beforeRoomId: state.profileRecoveryBeforeRoomId,
            beforeHref: state.profileRecoveryBeforeHref,
            afterRoomId: getKnownRoomId(),
            afterHref: String(location.href || ""),
            elapsedMs: Date.now() - state.profileRecoveryStartedAt
        }, extra));

        state.profileRecoveryInFlight = false;
        state.profileRecoveryStartedAt = 0;
        state.profileRecoveryBeforeRoomId = "";
        state.profileRecoveryBeforeHref = "";
        if (typeof endRecoveryAction === "function") endRecoveryAction("profile-recovery", {
            result
        });
    }

    function fireProfileRecoveryClick(player, target, hoverTarget, ownUid, x, y, decision) {
        installProfileRecoveryWatchers();

        if (typeof beginRecoveryAction === "function" && !beginRecoveryAction("profile-recovery", {
            roomId: decision && decision.roomId,
            ownUid,
            target: describeElement(target)
        })) {
            logInteraction("profile-click-recovery-blocked", {
                blockReason: "recovery-lock-busy",
                ownUid,
                target: describeElement(target)
            });
            return false;
        }

        state.profileRecoveryInFlight = true;
        publishActiveGuardState();
        state.profileRecoveryStartedAt = Date.now();
        state.profileRecoveryBeforeRoomId = decision.roomId;
        state.profileRecoveryBeforeHref = decision.href;
        state.lastProfileRecoveryClickAt = Date.now();

        logInteraction("profile-click-recovery-fired", {
            ownUid,
            target: describeElement(target),
            observationStableFor: decision.observationStableFor,
            socketSilentFor: decision.socketSilentFor,
            playerCount: decision.playerCount,
            queueSignature: decision.queueSignature
        });

        dispatchMouse(target, "mousedown", x, y);
        setTimeout(() => {
            try {
                dispatchMouse(target, "mouseup", x, y);
                dispatchMouse(target, "click", x, y);
            } catch (error) {
                finishProfileRecovery("profile-click-recovery-error", {
                    error: String(error && error.message ? error.message : error)
                });
                return;
            }

            setTimeout(() => {
                try {
                    if (!state.profileRecoveryInFlight) return;

                    const href = String(location.href || "");
                    const roomId = getKnownRoomId();
                    const ownPresent = getOwnPresent(player);

                    if (hasUndefinedRoomRoute(href)) {
                        setRecoveryPenalty(PROFILE_RECOVERY_BAD_COOLDOWN);
                        finishProfileRecovery("profile-click-caused-navigation", {
                            blockReason: "undefined-route-after-click",
                            ownPresent
                        });
                    } else if (decision.roomId && roomId && roomId !== decision.roomId) {
                        finishProfileRecovery("profile-click-recovery-room-changed", {
                            ownPresent
                        });
                    } else if (!ownPresent) {
                        finishProfileRecovery("profile-click-recovery-own-missing", {
                            blockReason: "own-player-missing-after-click"
                        });
                    } else {
                        finishProfileRecovery("profile-click-recovery-ok", {
                            ownPresent
                        });
                    }

                    dispatchMouse(hoverTarget, "mouseout", x, y);
                    dispatchMouse(hoverTarget, "mouseleave", x, y);
                } catch (_) {}
            }, PROFILE_RECOVERY_MONITOR_MS);
        }, 45);
    }

    return {
        findSafeProfilePoint,
        buildProfileRecoveryDecision,
        fireProfileRecoveryClick
    };
}
