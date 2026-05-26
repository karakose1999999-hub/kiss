// GeneralAutoGuard.js
function createGeneralAutoGuardFeature(ctx, requestRender) {
    const state = createGeneralAutoGuardState(ctx);
    const guardConfig = createGeneralAutoGuardConfig();

    const {
        getStoredAuthUid,
        getPlayerUid,
        getMe,
        getHoverTarget,
        isInsideOwnPlayer,
        describeElement
    } = createGeneralAutoGuardDomHelpers(ctx);

    const {
        normalizeRoomId,
        getKnownRoomId,
        extractRoomId,
        hasUndefinedRoomRoute
    } = createGeneralAutoGuardRoomIdHelpers(ctx);

    function logJson(label, payload) {
        try {
            console.log(label + " " + JSON.stringify(payload || {}));
        } catch (_) {
            console.log(label);
        }
    }

    function logInteraction(stage, payload = {}) {
        logJson("[ACTIVE GUARD] Interaction probe", Object.assign({
            source: "active-guard-interaction",
            stage,
            roomId: getKnownRoomId(),
            ownUid: String(ctx.state.myUid || ""),
            href: String(location.href || ""),
            visible: document.visibilityState,
            hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null
        }, payload));
    }

    function dispatchMouse(target, type, x, y) {
        target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: type === "mousedown" ? 1 : 0
        }));
    }

    const {
        publishActiveGuardState,
        beginRecoveryAction,
        endRecoveryAction
    } = createGeneralAutoGuardRuntime({
        state,
        logJson
    });

    const observation = createGeneralAutoGuardObservation({
        appCtx: ctx,
        state,
        config: guardConfig,
        getKnownRoomId,
        getStoredAuthUid,
        logJson,
        publishActiveGuardState
    });

    const {
        getQueueStableFor,
        getLowPlayerFor,
        resetQueueObservation,
        resetLowPlayerObservation,
        observeQueueState
    } = observation;

    const {
        findSafeProfilePoint,
        buildProfileRecoveryDecision,
        fireProfileRecoveryClick
    } = createGeneralAutoGuardProfileRecovery({
        state,
        config: guardConfig,
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
        isVisible: ctx.isVisible
    });

    const {
        recoverQueueStuck,
        scheduleQueueStuckRefresh
    } = createGeneralAutoGuardQueueRecovery({
        state,
        config: guardConfig,
        appCtx: ctx,
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
    });

    const {
        evaluateRoomChange
    } = createGeneralAutoGuardRoomChange({
        appCtx: ctx,
        state,
        config: guardConfig,
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
    });

    const {
        clickOwnProfileForActivity,
        tryOpenMyMenu
    } = createGeneralAutoGuardProfileOrchestrator({
        appCtx: ctx,
        state,
        getKnownRoomId,
        getPlayerUid,
        getMe,
        getHoverTarget,
        isInsideOwnPlayer,
        describeElement,
        dispatchMouse,
        evaluateRoomChange,
        findSafeProfilePoint,
        buildProfileRecoveryDecision,
        fireProfileRecoveryClick,
        publishActiveGuardState,
        logJson,
        logInteraction
    });

    const {
        exposePulse,
        start,
        stop,
        destroy
    } = createGeneralAutoGuardLifecycle({
        appCtx: ctx,
        state,
        config: guardConfig,
        requestRender,
        publishActiveGuardState,
        resetQueueObservation,
        resetLowPlayerObservation,
        observeQueueState,
        clickOwnProfileForActivity,
        tryOpenMyMenu
    });

    return {
        key: "activeGuard",
        storageKey: null,
        label: "Aktiflik Koruma",
        isRunning: () => state.running || state.enabled,
        start,
        stop,
        destroy,
        autoStart: () => {
            exposePulse();
            if (state.enabled && !state.running) start();
        }
    };
}
