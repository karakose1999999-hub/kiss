function createGeneralAutoGuardObservation(ctx) {
    const {
        appCtx,
        state,
        config,
        getKnownRoomId,
        getStoredAuthUid,
        logJson,
        publishActiveGuardState
    } = ctx;

    const {
        LOW_PLAYER_LIMIT
    } = config;

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function getQueueSignature() {
        try {
            const candidates = Array.from(document.querySelectorAll(".action-text, .action, .action-panel, .kiss-action, [class*='action'], [class*='queue'], [class*='next']"));

            for (const el of candidates) {
                if (!appCtx.isVisible(el)) continue;

                const text = normalizeText(el.textContent);
                if (!text.includes("sonraki") || !text.includes("open olacak")) continue;

                const nextIndex = Math.max(0, text.indexOf("sonraki"));
                const openIndex = text.indexOf("open olacak");
                const start = Math.max(0, Math.min(nextIndex, openIndex) - 60);
                const end = Math.min(text.length, Math.max(nextIndex, openIndex) + 90);
                const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();

                return snippet.length > 180 ? snippet.slice(0, 180) : snippet;
            }

            return "";
        } catch (_) {
            return "";
        }
    }

    function getRoomPlayerCount() {
        try {
            const gameState = appCtx.getGameState && appCtx.getGameState("active-guard-player-count");
            if (gameState && Number.isFinite(Number(gameState.tablePlayerCount))) {
                return Number(gameState.tablePlayerCount) || 0;
            }
            return Array.from(document.querySelectorAll(".player[data-pid][data-uid]:not(.player-graphics)"))
                .filter(player => appCtx.isVisible(player))
                .length;
        } catch (_) {
            return 0;
        }
    }

    function getQueueStableFor(now, roomId) {
        if (!roomId || !state.queueSignature || state.queueRoomId !== roomId || !state.queueStableSince) return 0;
        return now - state.queueStableSince;
    }

    function getLowPlayerFor(now, roomId) {
        if (
            !roomId ||
            state.lowPlayerRoomId !== roomId ||
            !state.lowPlayerSince ||
            !state.lowPlayerCount ||
            state.lowPlayerCount > LOW_PLAYER_LIMIT
        ) {
            return 0;
        }
        return now - state.lowPlayerSince;
    }

    function resetQueueObservation() {
        state.queueSignature = "";
        state.queueRoomId = "";
        state.queueStableSince = 0;
    }

    function resetLowPlayerObservation() {
        state.lowPlayerCount = 0;
        state.lowPlayerRoomId = "";
        state.lowPlayerSince = 0;
    }

    function observeQueueState() {
        if (!state.enabled) return;

        const now = Date.now();
        const roomId = getKnownRoomId();
        const signature = getQueueSignature();
        const playerCount = getRoomPlayerCount();
        const queueStableForBefore = getQueueStableFor(now, roomId);
        const lowPlayerForBefore = getLowPlayerFor(now, roomId);
        const gameState = appCtx.getGameState && appCtx.getGameState("active-guard-observe");
        const ownUid = String((gameState && gameState.authUserId) || appCtx.state.myUid || getStoredAuthUid() || "");
        const ownPresent = !!(gameState && gameState.ownPresent);
        const observationKey = [
            roomId || "",
            String(playerCount || 0),
            signature || "",
            ownPresent ? "own-present" : "own-missing"
        ].join("|");

        if (observationKey !== state.lastObservationKey) {
            state.lastObservationKey = observationKey;
            state.lastObservationChangeAt = now;
        } else if (!state.lastObservationChangeAt) {
            state.lastObservationChangeAt = now;
        }

        if (!roomId || !signature) {
            if (state.queueSignature || state.queueRoomId) {
                logJson("[ACTIVE GUARD] Sira gozlem sifirlandi", {
                    source: "active-guard-observe",
                    roomId,
                    hadSignature: !!state.queueSignature
                });
            }
            resetQueueObservation();
        } else if (signature !== state.queueSignature || roomId !== state.queueRoomId) {
            state.queueSignature = signature;
            state.queueRoomId = roomId;
            state.queueStableSince = now;
            logJson("[ACTIVE GUARD] Sira gozlem degisti", {
                source: "active-guard-observe",
                roomId,
                queueSignature: signature
            });
        }
        state.queueLastObservedAt = now;
        publishActiveGuardState();

        if (playerCount !== state.playerCount || roomId !== state.playerCountRoomId) {
            state.playerCount = playerCount;
            state.playerCountRoomId = roomId;
            logJson("[ACTIVE GUARD] Oyuncu sayisi degisti", {
                source: "active-guard-observe",
                roomId,
                playerCount,
                lowPlayerLimit: LOW_PLAYER_LIMIT
            });
        }

        if (!roomId || !playerCount || playerCount > LOW_PLAYER_LIMIT) {
            resetLowPlayerObservation();
        } else if (roomId !== state.lowPlayerRoomId || playerCount !== state.lowPlayerCount) {
            state.lowPlayerRoomId = roomId;
            state.lowPlayerCount = playerCount;
            state.lowPlayerSince = now;
            logJson("[ACTIVE GUARD] Az oyuncu gozlem degisti", {
                source: "active-guard-observe",
                roomId,
                playerCount
            });
        }

        const queueStableFor = getQueueStableFor(now, roomId);
        const lowPlayerFor = getLowPlayerFor(now, roomId);
        if (
            Math.floor(queueStableFor / 10000) !== Math.floor(queueStableForBefore / 10000) ||
            Math.floor(lowPlayerFor / 10000) !== Math.floor(lowPlayerForBefore / 10000)
        ) {
            logJson("[ACTIVE GUARD] Gozlem", {
                source: "active-guard-observe",
                roomId,
                queueSignature: state.queueSignature,
                queueStableFor,
                playerCount: state.playerCount || 0,
                lowPlayerFor
            });
        }
    }

    return {
        getQueueStableFor,
        getLowPlayerFor,
        resetQueueObservation,
        resetLowPlayerObservation,
        observeQueueState
    };
}
