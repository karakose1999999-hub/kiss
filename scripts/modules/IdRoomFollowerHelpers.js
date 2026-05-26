function createIdRoomFollowerHelpers(ctx) {
    const {
        RECENT_EXIT_WINDOW_MS,
        getGameState,
        getNumericCandidate,
        normalizeRoomId,
        readAuthUserId
    } = ctx;

    function normalizeUser(user) {
        const id = getNumericCandidate(user && (user.id || user.userId || user.uid));
        if (!id) return null;
        const name = String(user.name || user.username || user.nick || id).trim() || id;
        return { id, name };
    }

    function uniqueUsers(users) {
        const seen = new Set();
        return users
            .map(normalizeUser)
            .filter(Boolean)
            .filter(user => {
                if (seen.has(user.id)) return false;
                seen.add(user.id);
                return true;
            });
    }

    function readTableUsers() {
        try {
            return uniqueUsers(Array.from(document.querySelectorAll(".player[data-pid][data-uid]:not(.player-graphics)"))
                .map(player => {
                    const id = player.getAttribute("data-uid");
                    const nameEl = player.querySelector(".player__name__link");
                    const name = nameEl?.dataset?.name || nameEl?.textContent?.trim() || "?";
                    return id ? { id: String(id), name: String(name) } : null;
                })
                .filter(Boolean));
        } catch (_) {
            return [];
        }
    }

    function getAllSlotUserIds() {
        try {
            const ids = Array.isArray(window.__KISS_ALL_SLOT_USER_IDS) ? window.__KISS_ALL_SLOT_USER_IDS : [];
            return new Set(ids.map(getNumericCandidate).filter(Boolean));
        } catch (_) {
            return new Set();
        }
    }

    function getProtectedRoomLockUids(stateNow = null) {
        const protectedIds = getAllSlotUserIds();
        const state = stateNow || getGameState("room-lock-protected-uids");
        const ownUid = getNumericCandidate(state.authUserId || state.ownUid || readAuthUserId());
        if (ownUid) protectedIds.add(ownUid);
        try {
            const ownPlayer = document.querySelector(".js-player--me,[data-is-me=\"true\"],[data-own=\"true\"],.is-me,.player--me,.me");
            const ownFromDom = getNumericCandidate(
                ownPlayer && (
                    ownPlayer.getAttribute("data-uid") ||
                    ownPlayer.closest(".player[data-uid]")?.getAttribute("data-uid") ||
                    ownPlayer.querySelector("[data-uid]")?.getAttribute("data-uid")
                )
            );
            if (ownFromDom) protectedIds.add(ownFromDom);
        } catch (_) {}
        return protectedIds;
    }

    function parseQualityScore(player) {
        try {
            const text = String(player.textContent || "").replace(/\s+/g, " ").toLowerCase();
            const cls = String(player.className || "").toLowerCase();
            let score = 0;
            if (text.includes("vip") || cls.includes("vip")) score += 1000;
            const league = (text + " " + cls).match(/(?:lig|league|level|lvl|rank)\s*[:#-]?\s*(\d{1,3})/i);
            if (league) score += Number(league[1]) * 80;
            const numbers = Array.from(text.matchAll(/\b\d{2,8}\b/g)).map(match => Number(match[0])).filter(Number.isFinite);
            if (numbers.length) score += Math.min(Math.max(...numbers), 100000) / 100;
            return Math.round(score);
        } catch (_) {
            return 0;
        }
    }

    function readRoomLockAnchors(roomId) {
        const stateNow = getGameState("room-lock-anchor");
        const protectedUids = getProtectedRoomLockUids(stateNow);

        try {
            const candidates = Array.from(document.querySelectorAll(".player[data-pid][data-uid]:not(.player-graphics)"))
                .map(player => {
                    const uid = getNumericCandidate(player.getAttribute("data-uid"));
                    if (!uid || protectedUids.has(uid)) return null;
                    const rect = player.getBoundingClientRect ? player.getBoundingClientRect() : null;
                    const visible = !rect || (rect.width > 0 && rect.height > 0);
                    if (!visible) return null;
                    const nameEl = player.querySelector(".player__name__link");
                    const name = nameEl?.dataset?.name || nameEl?.textContent?.trim() || uid;
                    return {
                        uid,
                        name: String(name || uid).slice(0, 40),
                        score: parseQualityScore(player)
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.score - a.score);

            return candidates.slice(0, 5).map(item => ({
                uid: item.uid,
                name: item.name,
                score: item.score,
                roomId
            }));
        } catch (_) {
            return [];
        }
    }

    function sameAnchorUids(left, right) {
        const leftIds = (Array.isArray(left) ? left : []).map(item => getNumericCandidate(item && item.uid)).filter(Boolean).join(",");
        const rightIds = (Array.isArray(right) ? right : []).map(item => getNumericCandidate(item && item.uid)).filter(Boolean).join(",");
        return leftIds === rightIds;
    }

    function readPlayerActivity(id) {
        const uid = getNumericCandidate(id);
        if (!uid) return null;
        try {
            const provider = window.__KISS_GAME_STATE_PROVIDER__;
            if (provider && typeof provider.getPlayerActivity === "function") {
                const activity = provider.getPlayerActivity(uid);
                if (activity) return activity;
            }
        } catch (_) {}
        try {
            const fromShared = window.__KISS_GAME_STATE &&
                window.__KISS_GAME_STATE.playerActivityByUid &&
                window.__KISS_GAME_STATE.playerActivityByUid[uid];
            const fromDiag = window.__kissDiag &&
                window.__kissDiag.playerActivityByUid &&
                window.__kissDiag.playerActivityByUid[uid];
            const activity = fromShared || fromDiag;
            if (!activity || typeof activity !== "object") return null;
            return {
                uid,
                lastSeenAt: Number(activity.lastSeenAt || 0) || 0,
                lastJoinAt: Number(activity.lastJoinAt || 0) || 0,
                lastLeftAt: Number(activity.lastLeftAt || 0) || 0,
                lastExitAt: Number(activity.lastExitAt || 0) || 0,
                lastRoomId: normalizeRoomId(activity.lastRoomId),
                source: String(activity.source || "").slice(0, 80),
                updatedAt: Number(activity.updatedAt || 0) || 0
            };
        } catch (_) {
            return null;
        }
    }

    function readPlayerActivityMap(ids) {
        const out = {};
        try {
            (Array.isArray(ids) ? ids : []).forEach(id => {
                const activity = readPlayerActivity(id);
                if (activity) out[String(id)] = activity;
            });
        } catch (_) {}
        return out;
    }

    function hasRecentTargetExit(id, gameState) {
        const targetId = getNumericCandidate(id);
        if (!targetId) return { recent: false };

        const activity = (gameState &&
            gameState.playerActivityByUid &&
            gameState.playerActivityByUid[targetId]) || readPlayerActivity(targetId);
        if (!activity) return { recent: false };

        const now = Date.now();
        const lastExitAt = Math.max(Number(activity.lastExitAt || 0), Number(activity.lastLeftAt || 0));
        const lastJoinAt = Number(activity.lastJoinAt || 0);
        const exitAgeMs = lastExitAt ? now - lastExitAt : null;
        const recent = !!(lastExitAt && exitAgeMs >= 0 && exitAgeMs <= RECENT_EXIT_WINDOW_MS && lastExitAt > lastJoinAt);

        return {
            recent,
            uid: targetId,
            lastExitAt,
            lastLeftAt: Number(activity.lastLeftAt || 0) || 0,
            lastJoinAt,
            lastSeenAt: Number(activity.lastSeenAt || 0) || 0,
            lastRoomId: normalizeRoomId(activity.lastRoomId),
            source: activity.source || "",
            exitAgeMs
        };
    }

    return {
        normalizeUser,
        uniqueUsers,
        readTableUsers,
        readRoomLockAnchors,
        sameAnchorUids,
        readPlayerActivity,
        readPlayerActivityMap,
        hasRecentTargetExit
    };
}
