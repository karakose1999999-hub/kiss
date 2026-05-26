function createKissGameStateProvider() {
    if (window.__KISS_GAME_STATE_PROVIDER__) return window.__KISS_GAME_STATE_PROVIDER__;

    const state = {
        lastKnownRoomId: "",
        lastKnownRoomAt: 0,
        lastKnownRoomSource: "",
        lastKnownRoomSourceRank: 0,
        lastSnapshot: null,
        lastLogKey: "",
        lastLogAt: 0
    };

    const CACHE_MS = 250;
    const ROOM_MAX_AGE_MS = 3 * 60 * 1000;

    function numeric(value) {
        const text = String(value || "").trim();
        return /^\d+$/.test(text) && text !== "0" ? text : "";
    }

    function roomSourceRank(source, confidence) {
        const ranks = {
            "get_status.response": 500,
            "sit_down_to_friend.response": 450,
            "roulette_answer.response": 420,
            "roulette_answer.request": 400,
            "blackList.getProfiles.response": 300,
            "auto-kiss": 240,
            "network-room": 230,
            "room-event": 180,
            "room-refresh": 170,
            webview: 160,
            snapshot: 120,
            localStorage: 30,
            dom: 20,
            href: 10
        };
        if (Object.prototype.hasOwnProperty.call(ranks, source)) return ranks[source];
        return confidence === "high" ? 200 : confidence === "medium" ? 100 : 0;
    }

    function sourceFromUrl(url) {
        const text = String(url || "");
        if (text.includes("/api/room/get_status")) return "get_status.response";
        if (text.includes("/api/room/sit_down_to_friend")) return "sit_down_to_friend.response";
        if (text.includes("/api/room/roulette_answer")) return "roulette_answer.response";
        if (text.includes("/api/blackList/getProfiles")) return "blackList.getProfiles.response";
        return "";
    }

    function readDataLayerUserId() {
        try {
            const dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
            for (const item of dataLayer) {
                const id = numeric(item && (item.userID || item.userId || item.uid || item.id));
                if (id) return id;
            }
        } catch (_) {}
        return "";
    }

    function readAuthUserId() {
        const sources = [
            ["window", () => numeric(window.__KISS_AUTH_USER_ID)],
            ["localStorage", () => numeric(localStorage.getItem("kiss_auth_user_id"))],
            ["dataLayer", readDataLayerUserId],
            ["_trackJs", () => numeric(window._trackJs && window._trackJs.userId)]
        ];

        for (const [source, getter] of sources) {
            try {
                const value = getter();
                if (value) return { value, source };
            } catch (_) {}
        }

        return { value: "", source: "" };
    }

    function readTopfaceRoomId() {
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = String(localStorage.key(i) || "");
                if (!key.startsWith("topface_stprev_room_id")) continue;
                const raw = localStorage.getItem(key);
                const direct = numeric(raw);
                if (direct) return direct;
                try {
                    const parsed = JSON.parse(raw);
                    const nested = numeric(parsed && parsed.data && parsed.data.value);
                    if (nested) return nested;
                } catch (_) {}
            }
        } catch (_) {}
        return "";
    }

    function readRoomId() {
        function fresh(id, at) {
            const roomId = numeric(id);
            if (!roomId) return "";
            const time = Number(at || 0);
            if (time && Date.now() - time > ROOM_MAX_AGE_MS) return "";
            return roomId;
        }
        const sources = [
            ["network", () => fresh(state.lastKnownRoomId || window.__KISS_LAST_ROOM_ID, window.__KISS_LAST_ROOM_ID_AT)],
            ["auto-kiss", () => fresh(window.__KISS_AUTO_KISS_LAST_ROOM_ID, window.__KISS_AUTO_KISS_LAST_ROOM_ID_AT || window.__KISS_AUTO_KISS_LAST_RESPONSE_AT)],
            ["kiss_hidden_last_room_id", () => fresh(localStorage.getItem("kiss_hidden_last_room_id"), localStorage.getItem("kiss_hidden_last_room_id_at"))],
            ["topface_stprev_room_id", readTopfaceRoomId]
        ];

        for (const [source, getter] of sources) {
            try {
                const value = getter();
                if (value) return { value, source };
            } catch (_) {}
        }

        return { value: "", source: "" };
    }

    function readPlayerName(player) {
        try {
            const nameEl = player.querySelector(".player__name__link");
            return String(nameEl && (nameEl.dataset.name || nameEl.textContent) || "").replace(/\s+/g, " ").trim();
        } catch (_) {
            return "";
        }
    }

    function parseCompactNumber(value) {
        const raw = String(value || "").replace(/\s+/g, "").toLowerCase();
        const match = raw.match(/(\d+(?:[.,]\d+)?)(k|m|b)?/);
        if (!match) return null;
        const base = Number(match[1].replace(",", "."));
        if (!Number.isFinite(base)) return null;
        const suffix = match[2] || "";
        const multiplier = suffix === "b" ? 1000000000 : suffix === "m" ? 1000000 : suffix === "k" ? 1000 : 1;
        return Math.round(base * multiplier);
    }

    function readKissScore(player) {
        try {
            const selectors = [
                ".player__counter--kiss",
                ".player__counter.player__counter--kiss",
                "[class*='counter--kiss']",
                "[class*='kiss-count']",
                "[class*='kiss_count']"
            ];
            for (const selector of selectors) {
                const el = player.querySelector && player.querySelector(selector);
                const value = parseCompactNumber(
                    el && (
                        el.getAttribute("data-count") ||
                        el.getAttribute("data-value") ||
                        el.textContent
                    )
                );
                if (value !== null) return value;
            }
        } catch (_) {}
        return null;
    }

    function readNumericAttr(node, attr) {
        try {
            if (!node) return "";
            const direct = numeric(node.getAttribute && node.getAttribute(attr));
            if (direct) return direct;
            const child = node.querySelector && node.querySelector("[" + attr + "]");
            const childValue = numeric(child && child.getAttribute(attr));
            if (childValue) return childValue;
            const parent = node.closest && node.closest("[" + attr + "]");
            return numeric(parent && parent.getAttribute(attr));
        } catch (_) {
            return "";
        }
    }

    function isVisibleNode(node) {
        try {
            if (!node) return false;
            const rect = node.getBoundingClientRect && node.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) return false;
            const style = window.getComputedStyle ? window.getComputedStyle(node) : null;
            return !style || (style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0);
        } catch (_) {
            return false;
        }
    }

    function readTableRoster() {
        try {
            const seen = new Set();
            const out = [];

            function pushPlayer(sourceEl) {
                const root = sourceEl && sourceEl.closest && sourceEl.closest(".player:not(.player-graphics), .js-player, .player__wrap, [data-pid][data-uid]") || sourceEl;
                if (!root) return;
                if (!isVisibleNode(sourceEl) && !isVisibleNode(root)) return;

                const uid =
                    readNumericAttr(sourceEl, "data-uid") ||
                    readNumericAttr(sourceEl, "data-user-id") ||
                    readNumericAttr(sourceEl, "data-userid") ||
                    readNumericAttr(root, "data-uid") ||
                    readNumericAttr(root, "data-user-id") ||
                    readNumericAttr(root, "data-userid");
                const pid = readNumericAttr(root, "data-pid") || readNumericAttr(sourceEl, "data-pid") || uid;
                if (!uid || !pid || seen.has(uid)) return;

                seen.add(uid);
                const nameEl = root.querySelector && root.querySelector(".player__name__link") || sourceEl;
                const leagueEl = root.querySelector && root.querySelector(".js-league-points-count[data-count]");
                const cupEl = root.querySelector && root.querySelector(".player__counter--max-league-cup-count");
                const kissScore = readKissScore(root);
                out.push({
                    uid,
                    userId: uid,
                    id: uid,
                    pid,
                    name: readPlayerName(root) || String(nameEl && (nameEl.dataset && nameEl.dataset.name || nameEl.textContent) || "").replace(/\s+/g, " ").trim() || uid,
                    kissScore,
                    kissScoreKnown: kissScore !== null,
                    leaguePoints: numeric(leagueEl && leagueEl.getAttribute("data-count")),
                    cupCount: numeric(cupEl && cupEl.getAttribute("data-count")),
                    className: String(root.className || "").replace(/\s+/g, " ").trim().slice(0, 140)
                });
            }

            Array.from(document.querySelectorAll(".player[data-pid][data-uid]:not(.player-graphics)")).forEach(pushPlayer);
            Array.from(document.querySelectorAll(".player__name__link")).forEach(pushPlayer);

            return out;
        } catch (_) {
            return [];
        }
    }

    function readPlayerActivity(uid = "") {
        const id = numeric(uid);
        if (!id) return null;
        try {
            const activity = window.__kissDiag &&
                window.__kissDiag.playerActivityByUid &&
                window.__kissDiag.playerActivityByUid[id];
            if (!activity || typeof activity !== "object") return null;
            return {
                uid: id,
                lastSeenAt: Number(activity.lastSeenAt || 0) || 0,
                lastJoinAt: Number(activity.lastJoinAt || 0) || 0,
                lastLeftAt: Number(activity.lastLeftAt || 0) || 0,
                lastExitAt: Number(activity.lastExitAt || 0) || 0,
                lastRoomId: numeric(activity.lastRoomId),
                source: String(activity.source || "").slice(0, 80),
                updatedAt: Number(activity.updatedAt || 0) || 0
            };
        } catch (_) {
            return null;
        }
    }

    function readPlayerActivityMap(uids) {
        const out = {};
        (Array.isArray(uids) ? uids : []).forEach(uid => {
            const activity = readPlayerActivity(uid);
            if (activity) out[String(uid)] = activity;
        });
        return out;
    }

    function rememberAuthUserId(value) {
        const id = numeric(value);
        if (!id) return "";
        try { window.__KISS_AUTH_USER_ID = id; } catch (_) {}
        try { localStorage.setItem("kiss_auth_user_id", id); } catch (_) {}
        return id;
    }

    function rememberRoomId(value, meta = {}) {
        const id = numeric(value);
        if (!id) return "";
        const source = String(meta.source || sourceFromUrl(meta.url) || "room-event");
        const confidence = String(meta.confidence || "high");
        const rank = roomSourceRank(source, confidence);
        const now = Date.now();
        if (
            state.lastKnownRoomId &&
            state.lastKnownRoomAt &&
            now - Number(state.lastKnownRoomAt || 0) <= ROOM_MAX_AGE_MS &&
            rank < Number(state.lastKnownRoomSourceRank || 0)
        ) {
            return "";
        }
        state.lastKnownRoomId = id;
        state.lastKnownRoomAt = now;
        state.lastKnownRoomSource = source;
        state.lastKnownRoomSourceRank = rank;
        try {
            window.__KISS_LAST_ROOM_ID = id;
            window.__KISS_LAST_ROOM_ID_AT = now;
            window.__KISS_LAST_ROOM_SOURCE = source;
            window.__KISS_LAST_ROOM_SOURCE_RANK = rank;
        } catch (_) {}
        try { localStorage.setItem("kiss_hidden_last_room_id", id); } catch (_) {}
        try { localStorage.setItem("kiss_hidden_last_room_id_at", String(now)); } catch (_) {}
        try { localStorage.setItem("kiss_hidden_last_room_source", source); } catch (_) {}
        try { localStorage.setItem("kiss_hidden_last_room_source_rank", String(rank)); } catch (_) {}
        try { console.log("__KISS_ROOM_ID__" + JSON.stringify({ roomId: id, at: now, source, confidence })); } catch (_) {}
        return id;
    }

    function captureRoomFromJson(data, meta = {}) {
        try {
            if (!data || typeof data !== "object") return "";
            if (data.type === "authorization" && data.userId) rememberAuthUserId(data.userId);
            const url = String(meta.url || "");
            if (data.error === "disabled" && url.includes("sit_down_to_friend")) return "";
            return rememberRoomId(
                data.status && (data.status.room_id || data.status.roomId) ||
                data.room_id ||
                data.roomId,
                { source: meta.source || sourceFromUrl(url), url, confidence: meta.confidence || "high" }
            );
        } catch (_) {
            return "";
        }
    }

    function shouldUseCache(options, now) {
        if (options && options.force) return false;
        if (!state.lastSnapshot) return false;
        return now - Number(state.lastSnapshot.at || 0) <= CACHE_MS;
    }

    function refresh(reason = "manual", options = {}) {
        const now = Date.now();
        if (shouldUseCache(options, now)) {
            return Object.assign({}, state.lastSnapshot, { reason: String(reason || "manual") });
        }

        const auth = readAuthUserId();
        const room = readRoomId();
        const tablePlayers = readTableRoster();
        const tableUids = tablePlayers.map(player => player.uid);
        const playerActivityByUid = readPlayerActivityMap(tableUids);
        const ownPlayer = auth.value ? tablePlayers.find(player => player.uid === auth.value) : null;
        const blockReasons = [];

        if (!auth.value) blockReasons.push("missing-auth-user-id");
        if (!room.value) blockReasons.push("missing-room-id");
        if (!tablePlayers.length) blockReasons.push("roster-empty");
        if (auth.value && tablePlayers.length && !ownPlayer) blockReasons.push("own-not-in-roster");

        if (auth.value) rememberAuthUserId(auth.value);
        if (room.value) state.lastKnownRoomId = room.value;

        const snapshot = {
            at: now,
            reason: String(reason || "manual"),
            roomId: room.value,
            roomIdSource: room.source,
            authUserId: auth.value,
            authUserIdSource: auth.source,
            ownUid: auth.value,
            ownPresent: !!ownPlayer,
            ownPid: ownPlayer ? ownPlayer.pid : "",
            tablePlayerCount: tablePlayers.length,
            tableUids,
            tablePlayers,
            playerActivityByUid,
            blockReasons
        };

        state.lastSnapshot = snapshot;
        try { window.__KISS_GAME_STATE__ = snapshot; } catch (_) {}

        const logKey = [
            snapshot.roomId,
            snapshot.authUserId,
            snapshot.ownPresent ? "1" : "0",
            snapshot.tableUids.join(","),
            snapshot.blockReasons.join(",")
        ].join("|");

        if (!options.silent && window.__KISS_MODULE_SETTINGS && window.__KISS_MODULE_SETTINGS.diagnosticLog && (logKey !== state.lastLogKey || now - state.lastLogAt > 30000)) {
            state.lastLogKey = logKey;
            state.lastLogAt = now;
            try {
                console.log("[GAME STATE] " + JSON.stringify({
                    source: "game-state",
                    reason: snapshot.reason,
                    roomId: snapshot.roomId,
                    roomIdSource: snapshot.roomIdSource,
                    authUserId: snapshot.authUserId,
                    authUserIdSource: snapshot.authUserIdSource,
                    ownPresent: snapshot.ownPresent,
                    ownPid: snapshot.ownPid,
                    tablePlayerCount: snapshot.tablePlayerCount,
                    tableUids: snapshot.tableUids,
                    blockReasons: snapshot.blockReasons
                }));
            } catch (_) {}
        }

        return snapshot;
    }

    const api = {
        refresh,
        getState: refresh,
        getCurrentRoomId: () => refresh("current-room", { silent: true }).roomId || "",
        getPlayerActivity: readPlayerActivity,
        rememberRoomId,
        rememberAuthUserId,
        captureRoomFromJson
    };

    window.__KISS_GAME_STATE_PROVIDER__ = api;
    return api;
}

createKissGameStateProvider();
