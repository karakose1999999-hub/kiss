function createGeneralAutoGuardLifecycle(ctx) {
    const {
        appCtx,
        state,
        config,
        requestRender,
        publishActiveGuardState,
        resetQueueObservation,
        resetLowPlayerObservation,
        observeQueueState,
        clickOwnProfileForActivity,
        tryOpenMyMenu
    } = ctx;

    const {
        QUEUE_OBSERVE_INTERVAL,
        QUEUE_DECISION_INTERVAL,
        PROFILE_POKE_INTERVAL_MS,
        TIMER_JITTER_MS
    } = config;

    function jitter(ms) {
        const spread = Number(TIMER_JITTER_MS || 0);
        if (!spread) return ms;
        return Math.max(1000, Math.floor(ms + Math.random() * spread));
    }

    function persist() {
        appCtx.settings.guardEnabled = state.enabled;
        appCtx.saveSettings();
    }

    function exposePulse() {
        try {
            window.__KISS_ACTIVE_GUARD_PULSE = () => tryOpenMyMenu();
        } catch (_) {}
    }

    function clearTimers() {
        if (state.decisionTimer) clearInterval(state.decisionTimer);
        if (state.queueObserveTimer) clearInterval(state.queueObserveTimer);
        if (state.profilePokeTimer) clearInterval(state.profilePokeTimer);
        state.decisionTimer = null;
        state.queueObserveTimer = null;
        state.profilePokeTimer = null;
    }

    function start() {
        if (state.running) return;
        state.running = true;
        state.enabled = true;
        resetQueueObservation();
        resetLowPlayerObservation();
        state.playerCount = 0;
        state.playerCountRoomId = "";
        state.lastObservationKey = "";
        state.lastObservationChangeAt = Date.now();
        state.profileRecoveryInFlight = false;
        publishActiveGuardState();
        persist();
        exposePulse();
        clearTimers();
        state.decisionTimer = setInterval(tryOpenMyMenu, jitter(QUEUE_DECISION_INTERVAL));
        state.queueObserveTimer = setInterval(observeQueueState, jitter(QUEUE_OBSERVE_INTERVAL));
        state.profilePokeTimer = setInterval(clickOwnProfileForActivity, jitter(PROFILE_POKE_INTERVAL_MS));
        observeQueueState();
        clickOwnProfileForActivity();
        tryOpenMyMenu();
        requestRender();
    }

    function stop() {
        state.running = false;
        state.enabled = false;
        publishActiveGuardState();
        persist();
        exposePulse();
        clearTimers();
        requestRender();
    }

    function destroy() {
        state.running = false;
        clearTimers();
        publishActiveGuardState();
    }

    exposePulse();

    return {
        exposePulse,
        start,
        stop,
        destroy
    };
}
