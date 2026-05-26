function createGeneralAutoGuardProfileOrchestrator(ctx) {
    const {
        appCtx,
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
    } = ctx;

    function clickStartButton() {
        if (!state.enabled) return false;
        const button = document.querySelector("button.splash--start-button.js-start-kiss");
        if (!button || button.disabled || !appCtx.isVisible(button)) return false;

        try {
            button.click();
            console.log("[ACTIVE GUARD] Oyna butonuna basildi.");
            return true;
        } catch (_) {
            return false;
        }
    }

    function getProfileClickBlockReason() {
        if (!state.enabled) return "guard-disabled";
        if (document.hidden) return "document-hidden";
        if (state.profilePokeInFlight) return "profile-click-in-flight";
        if (state.changeInFlight) return "room-change-in-flight";
        if (state.queueRecoveryInFlight) return "queue-recovery-in-flight";
        if (state.queueReloadInFlight) return "queue-reload-in-flight";
        if (state.profileRecoveryInFlight) return "profile-recovery-in-flight";
        return "";
    }

    function logProfileClickBlocked(blockReason, payload = {}) {
        const now = Date.now();
        if (now - Number(state.lastProfilePokeBlockedLogAt || 0) < 30000) return;
        state.lastProfilePokeBlockedLogAt = now;
        logJson("[ACTIVE GUARD] profile-click-blocked", Object.assign({
            source: "active-guard-profile-click",
            blockReason,
            roomId: getKnownRoomId(),
            href: String(location.href || "")
        }, payload));
    }

    function dispatchEscape() {
        const options = {
            bubbles: true,
            cancelable: true,
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            which: 27
        };
        try { document.dispatchEvent(new KeyboardEvent("keydown", options)); } catch (_) {}
        try { window.dispatchEvent(new KeyboardEvent("keydown", options)); } catch (_) {}
        try { document.dispatchEvent(new KeyboardEvent("keyup", options)); } catch (_) {}
        try { window.dispatchEvent(new KeyboardEvent("keyup", options)); } catch (_) {}
    }

    function cleanupProfileClickUi(player, target, hoverTarget, x, y, delayMs = 900) {
        setTimeout(() => {
            try {
                if (target) {
                    dispatchMouse(target, "mouseout", x, y);
                    dispatchMouse(target, "mouseleave", x, y);
                }
                if (hoverTarget && hoverTarget !== target) {
                    dispatchMouse(hoverTarget, "mouseout", x, y);
                    dispatchMouse(hoverTarget, "mouseleave", x, y);
                }
                dispatchEscape();
            } catch (_) {}
        }, delayMs);

        setTimeout(() => {
            try {
                const ownMenu = player && player.querySelector && player.querySelector(".player__menu, .js-player-menu");
                if (!ownMenu || !appCtx.isVisible || !appCtx.isVisible(ownMenu)) return;
                dispatchEscape();
            } catch (_) {}
        }, delayMs + 350);
    }

    function clickOwnProfileForActivity() {
        const blockReason = getProfileClickBlockReason();
        if (blockReason) {
            logProfileClickBlocked(blockReason);
            return false;
        }

        const player = getMe();
        const hoverTarget = getHoverTarget(player);
        if (!player || !hoverTarget) {
            appCtx.state.myUid = null;
            logProfileClickBlocked("own-player-missing", {
                hadPlayer: !!player,
                hadHoverTarget: !!hoverTarget
            });
            return false;
        }

        const ownUid = getPlayerUid(player) || String(appCtx.state.myUid || "");
        if (!/^\d+$/.test(String(ownUid || "")) || (appCtx.state.myUid && String(appCtx.state.myUid) !== String(ownUid))) {
            logProfileClickBlocked("own-uid-not-certain", { ownUid });
            return false;
        }

        const safePoint = findSafeProfilePoint(player, hoverTarget);
        if (!safePoint) {
            appCtx.state.myUid = null;
            logProfileClickBlocked("safe-point-missing", { ownUid });
            return false;
        }

        if (safePoint.blocked) {
            logProfileClickBlocked("target-covered", {
                ownUid,
                hit: describeElement(safePoint.hit)
            });
            return false;
        }

        const x = safePoint.x;
        const y = safePoint.y;
        const realTarget = document.elementFromPoint(x, y) || safePoint.hit || hoverTarget;
        if (!isInsideOwnPlayer(player, realTarget)) {
            logProfileClickBlocked("uid-mismatch", {
                ownUid,
                hit: describeElement(realTarget)
            });
            return false;
        }

        state.profilePokeInFlight = true;
        state.lastProfilePokeAt = Date.now();
        publishActiveGuardState();

        const finishProfileClick = () => {
            state.profilePokeInFlight = false;
            publishActiveGuardState();
        };

        try {
            dispatchMouse(hoverTarget, "mouseover", x, y);
            dispatchMouse(hoverTarget, "mouseenter", x, y);
            dispatchMouse(hoverTarget, "mousemove", x, y);

            setTimeout(() => {
                try {
                    if (!document.contains(player) || (ownUid && getPlayerUid(player) && getPlayerUid(player) !== ownUid)) {
                        logProfileClickBlocked("stale-player-after-hover", { ownUid });
                        cleanupProfileClickUi(player, realTarget, hoverTarget, x, y, 250);
                        finishProfileClick();
                        return;
                    }

                    const currentTarget = document.elementFromPoint(x, y) || realTarget;
                    if (!isInsideOwnPlayer(player, currentTarget)) {
                        logProfileClickBlocked("uid-mismatch-after-hover", {
                            ownUid,
                            hit: describeElement(currentTarget)
                        });
                        cleanupProfileClickUi(player, currentTarget, hoverTarget, x, y, 250);
                        finishProfileClick();
                        return;
                    }

                    dispatchMouse(currentTarget, "mousedown", x, y);
                    setTimeout(() => {
                        try {
                            dispatchMouse(currentTarget, "mouseup", x, y);
                            dispatchMouse(currentTarget, "click", x, y);
                            logInteraction("profile-real-click", {
                                source: "active-guard-profile-click",
                                ownUid,
                                target: describeElement(currentTarget),
                                mode: "delayed-hover-click"
                            });
                            cleanupProfileClickUi(player, currentTarget, hoverTarget, x, y, 900);
                        } catch (error) {
                            logJson("[ACTIVE GUARD] profile-click-error", {
                                source: "active-guard-profile-click",
                                ownUid,
                                error: String(error && error.message ? error.message : error).slice(0, 160),
                                roomId: getKnownRoomId()
                            });
                        } finally {
                            setTimeout(finishProfileClick, 350);
                        }
                    }, 90);
                } catch (error) {
                    logJson("[ACTIVE GUARD] profile-click-error", {
                        source: "active-guard-profile-click",
                        ownUid,
                        error: String(error && error.message ? error.message : error).slice(0, 160),
                        roomId: getKnownRoomId()
                    });
                    finishProfileClick();
                }
            }, 650);
            return true;
        } catch (error) {
            finishProfileClick();
            logJson("[ACTIVE GUARD] profile-click-error", {
                source: "active-guard-profile-click",
                ownUid,
                error: String(error && error.message ? error.message : error).slice(0, 160),
                roomId: getKnownRoomId()
            });
            return false;
        }
    }

    function tryOpenMyMenu() {
        if (!state.enabled) return false;

        const clickedStart = clickStartButton();
        if (!clickedStart) {
            evaluateRoomChange();
        }

        const player = getMe();
        const hoverTarget = getHoverTarget(player);
        if (!player || !hoverTarget) {
            logInteraction("no-own-player", {
                blockReason: "own-player-missing",
                hadPlayer: !!player,
                hadHoverTarget: !!hoverTarget
            });
            appCtx.state.myUid = null;
            return false;
        }

        const ownUid = getPlayerUid(player) || String(appCtx.state.myUid || "");
        const safePoint = findSafeProfilePoint(player, hoverTarget);
        if (!safePoint) {
            logInteraction("no-safe-point", {
                blockReason: "safe-point-missing",
                ownUid
            });
            appCtx.state.myUid = null;
            return false;
        }

        if (safePoint.blocked) {
            logJson("[ACTIVE GUARD] Profil tiklama iptal", {
                source: "active-guard-profile",
                blockReason: "target-covered",
                roomId: getKnownRoomId(),
                ownUid,
                hit: describeElement(safePoint.hit)
            });
            logInteraction("blocked", {
                blockReason: "target-covered",
                ownUid,
                hit: describeElement(safePoint.hit)
            });
            return false;
        }

        const x = safePoint.x;
        const y = safePoint.y;

        try {
            logInteraction("hover-dispatch", {
                ownUid,
                target: describeElement(hoverTarget),
                hit: describeElement(safePoint.hit)
            });
            dispatchMouse(hoverTarget, "mouseover", x, y);
            dispatchMouse(hoverTarget, "mouseenter", x, y);
            dispatchMouse(hoverTarget, "mousemove", x, y);

            setTimeout(() => {
                try {
                    if (!document.contains(player) || (ownUid && getPlayerUid(player) && getPlayerUid(player) !== ownUid)) {
                        logJson("[ACTIVE GUARD] Profil tiklama iptal", {
                            source: "active-guard-profile",
                            blockReason: "stale-player",
                            roomId: getKnownRoomId(),
                            ownUid
                        });
                        logInteraction("click-blocked", {
                            blockReason: "stale-player",
                            ownUid
                        });
                        return;
                    }

                    const realTarget = document.elementFromPoint(x, y) || safePoint.hit || hoverTarget;
                    if (!isInsideOwnPlayer(player, realTarget)) {
                        logJson("[ACTIVE GUARD] Profil tiklama iptal", {
                            source: "active-guard-profile",
                            blockReason: "uid-mismatch",
                            roomId: getKnownRoomId(),
                            ownUid,
                            hit: describeElement(realTarget)
                        });
                        logInteraction("click-blocked", {
                            blockReason: "uid-mismatch",
                            ownUid,
                            hit: describeElement(realTarget)
                        });
                        dispatchMouse(hoverTarget, "mouseout", x, y);
                        dispatchMouse(hoverTarget, "mouseleave", x, y);
                        return;
                    }

                    const recoveryDecision = buildProfileRecoveryDecision(player, realTarget, ownUid);
                    if (recoveryDecision.eligible) {
                        logInteraction("profile-click-recovery-eligible", recoveryDecision);
                        fireProfileRecoveryClick(player, realTarget, hoverTarget, ownUid, x, y, recoveryDecision);
                        return;
                    }

                    logInteraction("profile-click-recovery-blocked", recoveryDecision);
                    logInteraction("profile-hover-only", {
                        ownUid,
                        target: describeElement(realTarget),
                        blockReason: recoveryDecision.blockReason
                    });
                    setTimeout(() => {
                        try {
                            dispatchMouse(hoverTarget, "mouseout", x, y);
                            dispatchMouse(hoverTarget, "mouseleave", x, y);
                        } catch (_) {}
                    }, 150);
                } catch (_) {}
            }, 550);

            return true;
        } catch (_) {
            logInteraction("error", {
                blockReason: "dispatch-error",
                ownUid
            });
            appCtx.state.myUid = null;
            return false;
        }
    }

    return {
        clickStartButton,
        clickOwnProfileForActivity,
        tryOpenMyMenu
    };
}
