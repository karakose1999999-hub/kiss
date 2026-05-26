function createGeneralAutoGuardDomHelpers(ctx) {
    function selectorEscape(value) {
        return String(value || "").replace(/"/g, "");
    }

    function getStoredAuthUid() {
        try {
            const gameState = ctx.getGameState && ctx.getGameState("active-guard-auth");
            if (gameState && /^\d+$/.test(String(gameState.authUserId || ""))) return String(gameState.authUserId);
            const stored = window.__KISS_AUTH_USER_ID || localStorage.getItem("kiss_auth_user_id") || "";
            if (/^\d+$/.test(String(stored))) return String(stored);
            const dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
            for (const item of dataLayer) {
                const id = item && (item.userID || item.userId || item.uid || item.id);
                if (/^\d+$/.test(String(id || ""))) return String(id);
            }
            const trackId = window._trackJs && window._trackJs.userId;
            return /^\d+$/.test(String(trackId || "")) ? String(trackId) : "";
        } catch (_) {
            return "";
        }
    }

    function getPlayerUid(player) {
        if (!player) return "";
        try {
            const ownUid = player.getAttribute("data-uid") ||
                player.querySelector(".player__wrap.js-player[data-uid]")?.getAttribute("data-uid") ||
                player.querySelector(".js-player[data-uid]")?.getAttribute("data-uid") ||
                "";
            return /^\d+$/.test(String(ownUid)) ? String(ownUid) : "";
        } catch (_) {
            return "";
        }
    }

    function detectMyUid() {
        try {
            const stored = getStoredAuthUid();
            if (stored) {
                const storedPlayer = document.querySelector('.player[data-uid="' + selectorEscape(stored) + '"][data-pid]:not(.player-graphics)');
                const storedWrap = document.querySelector('.player[data-pid]:not(.player-graphics) .player__wrap.js-player[data-uid="' + selectorEscape(stored) + '"]');
                if (storedPlayer || storedWrap) return stored;
            }

            for (const player of document.querySelectorAll(".player[data-uid]")) {
                if (player.classList.contains("player-graphics")) continue;

                const menu = player.querySelector(".player__menu, .js-player-menu");
                if (!menu) continue;

                const hasKick = menu.querySelector(".js-player-kick");
                const hasGift = menu.querySelector(".js-player-send-gift");
                const hasRob = menu.querySelector(".js-player-send-robber");
                if (!hasKick && !hasGift && !hasRob) return player.dataset.uid;
            }

            if (stored) return stored;
        } catch (_) {}
        return "";
    }

    function getMe() {
        const gameState = ctx.getGameState && ctx.getGameState("active-guard-get-me");
        if (gameState && gameState.authUserId) ctx.state.myUid = String(gameState.authUserId);
        if (!ctx.state.myUid) ctx.state.myUid = detectMyUid();
        if (!ctx.state.myUid) return null;

        const uid = selectorEscape(ctx.state.myUid);
        const player = document.querySelector('.player[data-uid="' + uid + '"][data-pid]:not(.player-graphics)');
        if (player) return player;

        const ownWrap = document.querySelector('.player[data-pid]:not(.player-graphics) .player__wrap.js-player[data-uid="' + uid + '"]');
        if (ownWrap) return ownWrap.closest(".player[data-pid]:not(.player-graphics)");

        ctx.state.myUid = null;
        return null;
    }

    function getHoverTarget(player) {
        if (!player) return null;
        return player.querySelector(".player__wrap.js-player") ||
            player.querySelector(".player__container") ||
            player;
    }

    function getElementUid(el) {
        try {
            const holder = el && (el.closest("[data-uid]") || el);
            const uid = holder && holder.getAttribute && holder.getAttribute("data-uid");
            return /^\d+$/.test(String(uid || "")) ? String(uid) : "";
        } catch (_) {
            return "";
        }
    }

    function isInsideOwnPlayer(player, el) {
        if (!player || !el) return false;
        if (player === el || player.contains(el)) return true;

        const playerUid = getPlayerUid(player) || String(ctx.state.myUid || "");
        const elementUid = getElementUid(el);
        return !!playerUid && elementUid === playerUid;
    }

    function describeElement(el) {
        if (!el) return null;
        try {
            const className = typeof el.className === "string" ? el.className : "";
            return {
                tag: String(el.tagName || "").toLowerCase(),
                className: className.replace(/\s+/g, " ").trim().slice(0, 120),
                uid: getElementUid(el)
            };
        } catch (_) {
            return null;
        }
    }

    return {
        selectorEscape,
        getStoredAuthUid,
        getPlayerUid,
        detectMyUid,
        getMe,
        getHoverTarget,
        getElementUid,
        isInsideOwnPlayer,
        describeElement
    };
}
