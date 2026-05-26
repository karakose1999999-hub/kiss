function createGeneralAutoGuardRuntime(ctx) {
    const {
        state,
        logJson
    } = ctx;

    function getRecoveryBusyReason(action) {
        if (state.activeRecoveryAction && state.activeRecoveryAction !== action) return state.activeRecoveryAction + "-in-flight";
        if (state.queueRecoveryInFlight && action !== "queue-recovery") return "queue-recovery-in-flight";
        if (state.queueReloadInFlight && action !== "queue-reload") return "queue-reload-in-flight";
        if (state.profileRecoveryInFlight && action !== "profile-recovery") return "profile-recovery-in-flight";
        if (state.changeInFlight && action !== "room-change") return "room-change-in-flight";
        return "";
    }

    function emitRecoveryPressure(action) {
        try {
            const now = Date.now();
            state.recoveryEvents = (Array.isArray(state.recoveryEvents) ? state.recoveryEvents : [])
                .filter(item => item && now - Number(item.at || 0) <= 5 * 60 * 1000);
            if (state.recoveryEvents.length < 5) return;
            console.log("__KISS_MAINTENANCE_EVENT__" + JSON.stringify({
                kind: "soft-reload-request",
                reason: "active-guard-recovery-pressure",
                action,
                count: state.recoveryEvents.length,
                at: now
            }));
        } catch (_) {}
    }

    function beginRecoveryAction(action, payload = {}) {
        const blockReason = getRecoveryBusyReason(action);
        if (blockReason) {
            if (typeof logJson === "function") {
                logJson("[ACTIVE GUARD] recovery-action-blocked", Object.assign({
                    source: "active-guard-recovery-lock",
                    action,
                    blockReason
                }, payload));
            }
            return false;
        }

        state.activeRecoveryAction = action;
        state.recoveryEvents = Array.isArray(state.recoveryEvents) ? state.recoveryEvents : [];
        state.recoveryEvents.push({ action, at: Date.now() });
        if (typeof logJson === "function") {
            logJson("[ACTIVE GUARD] recovery-action-start", Object.assign({
                source: "active-guard-recovery-lock",
                action
            }, payload));
        }
        publishActiveGuardState();
        emitRecoveryPressure(action);
        return true;
    }

    function endRecoveryAction(action, payload = {}) {
        if (state.activeRecoveryAction === action) state.activeRecoveryAction = "";
        if (typeof logJson === "function") {
            logJson("[ACTIVE GUARD] recovery-action-end", Object.assign({
                source: "active-guard-recovery-lock",
                action
            }, payload));
        }
        publishActiveGuardState();
    }

    function publishActiveGuardState() {
        try {
            window.__KISS_ACTIVE_GUARD_STATE = {
                enabled: !!state.enabled,
                running: !!state.running,
                changeInFlight: !!state.changeInFlight,
                queueRecoveryInFlight: !!state.queueRecoveryInFlight,
                queueReloadInFlight: !!state.queueReloadInFlight,
                profileRecoveryInFlight: !!state.profileRecoveryInFlight,
                profilePokeInFlight: !!state.profilePokeInFlight,
                activeRecoveryAction: state.activeRecoveryAction || "",
                lastProfilePokeAt: state.lastProfilePokeAt || 0,
                queueSignature: state.queueSignature || "",
                queueRoomId: state.queueRoomId || "",
                playerCount: state.playerCount || 0,
                at: Date.now()
            };
        } catch (_) {}
    }

    return {
        publishActiveGuardState,
        beginRecoveryAction,
        endRecoveryAction
    };
}
