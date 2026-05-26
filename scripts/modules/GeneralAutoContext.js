// GeneralAutoContext.js
function createGeneralAutoSharedContext(utils, moduleApi) {
    const launcherSettings = window.__KISS_MODULE_SETTINGS || {};
    const settings = utils.loadSettings(moduleApi.name, moduleApi.defaultSettings);
    settings.manualStopped = settings.manualStopped || { spin: false, kiss: false, close: false };
    settings.retList = settings.retList && typeof settings.retList === "object" ? settings.retList : {};
    settings.lowScoreRetEnabled = settings.lowScoreRetEnabled === true;
    settings.lowScoreRetThreshold = Number(settings.lowScoreRetThreshold || 5000) || 5000;
    settings.performance = settings.performance && typeof settings.performance === "object" ? settings.performance : {};

    const cfg = createGeneralAutoContextConfig();
    const state = createGeneralAutoContextState(getRememberedAuthUserId());

    function featureVisible(key) {
        return launcherSettings[key] !== false;
    }

    function saveSettings() {
        settings.forceRetAll = false;
        utils.saveSettings(moduleApi.name, settings);
    }

    function jitter(ms) {
        const value = (Math.random() * 2 - 1) * cfg.jitterPct * ms;
        return Math.max(0, Math.floor(ms + value));
    }

    function isVisible(el) {
        if (!el) return false;
        if (el.offsetParent === null) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getNumericCandidate(value) {
        const text = String(value || "").trim();
        return /^\d+$/.test(text) && text !== "0" ? text : "";
    }

    function readDataLayerUserId() {
        try {
            const dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
            for (const item of dataLayer) {
                const userId = getNumericCandidate(item && (item.userID || item.userId || item.uid || item.id));
                if (userId) return userId;
            }
        } catch (_) {}
        return "";
    }

    function readTrackJsUserId() {
        try {
            return getNumericCandidate(window._trackJs && window._trackJs.userId);
        } catch (_) {
            return "";
        }
    }

    function readAuthUserId() {
        const sources = [
            ["window", () => getNumericCandidate(window.__KISS_AUTH_USER_ID)],
            ["localStorage", () => getNumericCandidate(localStorage.getItem("kiss_auth_user_id"))],
            ["dataLayer", readDataLayerUserId],
            ["_trackJs", readTrackJsUserId]
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
                const direct = getNumericCandidate(raw);
                if (direct) return direct;
                try {
                    const parsed = JSON.parse(raw);
                    const nested = getNumericCandidate(parsed && parsed.data && parsed.data.value);
                    if (nested) return nested;
                } catch (_) {}
            }
        } catch (_) {}
        return "";
    }

    function readRoomId() {
        function fresh(id, at) {
            const roomId = getNumericCandidate(id);
            if (!roomId) return "";
            const time = Number(at || 0);
            if (time && Date.now() - time > 3 * 60 * 1000) return "";
            return roomId;
        }
        const sources = [
            ["network", () => fresh(state.lastKnownRoomId || window.__KISS_LAST_ROOM_ID, window.__KISS_LAST_ROOM_ID_AT)],
            ["topface_stprev_room_id", readTopfaceRoomId],
            ["kiss_hidden_last_room_id", () => fresh(localStorage.getItem("kiss_hidden_last_room_id"), localStorage.getItem("kiss_hidden_last_room_id_at"))]
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
            return String(nameEl?.dataset?.name || nameEl?.textContent || "").replace(/\s+/g, " ").trim();
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

    function readTableRoster() {
        try {
            const seen = new Set();
            const out = [];
            const candidates = Array.from(document.querySelectorAll([
                ".player:not(.player-graphics)",
                ".js-player",
                ".player__wrap",
                "[data-pid][data-uid]"
            ].join(",")));

            function readAttr(node, attr) {
                try {
                    if (!node) return "";
                    const direct = getNumericCandidate(node.getAttribute(attr));
                    if (direct) return direct;
                    const child = node.querySelector && node.querySelector("[" + attr + "]");
                    const childValue = getNumericCandidate(child && child.getAttribute(attr));
                    if (childValue) return childValue;
                    const parent = node.closest && node.closest("[" + attr + "]");
                    return getNumericCandidate(parent && parent.getAttribute(attr));
                } catch (_) {
                    return "";
                }
            }

            function isUsableVisible(player, root) {
                return isVisible(player) || isVisible(root);
            }

            function pushPlayer(player) {
                const root = player.closest && player.closest(".player:not(.player-graphics), .js-player, .player__wrap, [data-pid][data-uid]") || player;
                if (!root || !isUsableVisible(player, root)) return;
                const uid =
                    readAttr(player, "data-uid") ||
                    readAttr(player, "data-user-id") ||
                    readAttr(player, "data-userid") ||
                    readAttr(root, "data-uid") ||
                    readAttr(root, "data-user-id") ||
                    readAttr(root, "data-userid");
                const pid = readAttr(root, "data-pid") || readAttr(player, "data-pid") || uid;
                if (!uid || !pid || seen.has(uid)) return;
                seen.add(uid);
                const nameEl = root.querySelector && root.querySelector(".player__name__link") || player;
                const leagueEl = root.querySelector && root.querySelector(".js-league-points-count[data-count]");
                const cupEl = root.querySelector && root.querySelector(".player__counter--max-league-cup-count");
                const kissScore = readKissScore(root);
                out.push({
                    uid,
                    userId: uid,
                    pid,
                    name: readPlayerName(root) || String(nameEl && (nameEl.dataset && nameEl.dataset.name || nameEl.textContent) || "").replace(/\s+/g, " ").trim(),
                    kissScore,
                    kissScoreKnown: kissScore !== null,
                    leaguePoints: getNumericCandidate(leagueEl && leagueEl.getAttribute("data-count")),
                    cupCount: getNumericCandidate(cupEl && cupEl.getAttribute("data-count")),
                    className: String(root.className || "").replace(/\s+/g, " ").trim().slice(0, 140)
                });
            }

            candidates.forEach(pushPlayer);
            Array.from(document.querySelectorAll(".player__name__link")).forEach(pushPlayer);

            return out;
        } catch (_) {
            return [];
        }
    }

    function readPlayerActivity(uid = "") {
        const id = getNumericCandidate(uid);
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
                lastRoomId: getNumericCandidate(activity.lastRoomId),
                source: String(activity.source || "").slice(0, 80),
                updatedAt: Number(activity.updatedAt || 0) || 0
            };
        } catch (_) {
            return null;
        }
    }

    function readPlayerActivityMap(tableUids) {
        const out = {};
        try {
            (Array.isArray(tableUids) ? tableUids : []).forEach(uid => {
                const activity = readPlayerActivity(uid);
                if (activity) out[uid] = activity;
            });
        } catch (_) {}
        return out;
    }

    function rememberAuthUserId(value) {
        try {
            const provider = window.__KISS_GAME_STATE_PROVIDER__;
            if (provider && typeof provider.rememberAuthUserId === "function") {
                const userId = provider.rememberAuthUserId(value);
                if (userId) state.myUid = userId;
                return userId;
            }
        } catch (_) {}

        const userId = getNumericCandidate(value);
        if (!userId) return "";
        state.myUid = userId;
        try { window.__KISS_AUTH_USER_ID = userId; } catch (_) {}
        try { localStorage.setItem("kiss_auth_user_id", userId); } catch (_) {}
        return userId;
    }

    function getRememberedAuthUserId() {
        try {
            const auth = readAuthUserId();
            return auth.value;
        }
        catch (_) { return ""; }
    }

    function rememberRoomId(value) {
        try {
            const provider = window.__KISS_GAME_STATE_PROVIDER__;
            if (provider && typeof provider.rememberRoomId === "function") {
                const roomId = provider.rememberRoomId(value);
                if (roomId) state.lastKnownRoomId = roomId;
                return roomId;
            }
        } catch (_) {}

        const roomId = getNumericCandidate(value);
        if (!roomId || roomId === "0") return "";
        state.lastKnownRoomId = roomId;
        const at = Date.now();
        try { localStorage.setItem("kiss_hidden_last_room_id", roomId); } catch (_) {}
        try { localStorage.setItem("kiss_hidden_last_room_id_at", String(at)); } catch (_) {}
        try { console.log("__KISS_ROOM_ID__" + JSON.stringify({ roomId, at })); } catch (_) {}
        return roomId;
    }

    function getRememberedRoomId() {
        try { return readRoomId().value; }
        catch (_) { return ""; }
    }

    function getCurrentRoomId() {
        return refreshGameState("get-current-room", { silent: true }).roomId || "";
    }

    function captureRoomFromJson(data, meta = {}) {
        try {
            const provider = window.__KISS_GAME_STATE_PROVIDER__;
            if (provider && typeof provider.captureRoomFromJson === "function") {
                const roomId = provider.captureRoomFromJson(data, meta);
                if (roomId) state.lastKnownRoomId = roomId;
                if (data && data.type === "authorization" && data.userId) state.myUid = getNumericCandidate(data.userId) || state.myUid;
                return roomId;
            }
        } catch (_) {}

        try {
            if (!data || typeof data !== "object") return "";
            if (data.type === "authorization" && data.userId) {
                rememberAuthUserId(data.userId);
            }
            const url = String(meta.url || "");
            const roomId =
                data.status?.room_id ||
                data.status?.roomId ||
                data.room_id ||
                data.roomId;

            if (data.error === "disabled" && url.includes("sit_down_to_friend")) {
                return "";
            }

            return rememberRoomId(roomId);
        } catch (_) {
            return "";
        }
    }

    function refreshGameState(reason = "manual", options = {}) {
        try {
            const provider = window.__KISS_GAME_STATE_PROVIDER__;
            if (provider && typeof provider.refresh === "function") {
                const snapshot = provider.refresh(reason, options);
                state.lastGameState = snapshot;
                if (snapshot && snapshot.authUserId) state.myUid = snapshot.authUserId;
                if (snapshot && snapshot.roomId) state.lastKnownRoomId = snapshot.roomId;
                return snapshot;
            }
        } catch (_) {}

        const now = Date.now();
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

        state.lastGameState = snapshot;
        try { window.__KISS_GAME_STATE__ = snapshot; } catch (_) {}

        const logKey = [
            snapshot.roomId,
            snapshot.authUserId,
            snapshot.ownPresent ? "1" : "0",
            snapshot.tableUids.join(","),
            snapshot.blockReasons.join(",")
        ].join("|");

        if (!options.silent && window.__KISS_MODULE_SETTINGS && window.__KISS_MODULE_SETTINGS.diagnosticLog && (logKey !== state.lastGameStateKey || now - state.lastGameStateLogAt > 30000)) {
            state.lastGameStateKey = logKey;
            state.lastGameStateLogAt = now;
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

    function getGameState(reason = "manual") {
        return refreshGameState(reason);
    }

    function getRosterSnapshot(reason = "manual") {
        const gameState = refreshGameState(reason, { silent: true });
        return {
            at: gameState.at,
            roomId: gameState.roomId,
            ownUid: gameState.authUserId,
            ownPresent: gameState.ownPresent,
            ownPid: gameState.ownPid,
            playerUids: gameState.tableUids.filter(uid => uid !== gameState.authUserId),
            ids: gameState.tableUids,
            count: gameState.tablePlayerCount,
            players: gameState.tablePlayers
        };
    }

    function installRoomWatcher() {
        if (window.__generalAutoRoomWatcherInstalled) return;
        window.__generalAutoRoomWatcherInstalled = true;

        const originalFetch = window.fetch;
        if (typeof originalFetch === "function") {
            window.fetch = function(input, init = {}) {
                const url = typeof input === "string" ? input : input?.url;
                const promise = originalFetch.apply(this, arguments);
                try {
                    promise.then(res => {
                        try {
                            const contentType = res.headers?.get?.("content-type") || "";
                            const textUrl = String(url || "");
                            if (
                                contentType.includes("application/json") ||
                                textUrl.includes("time") ||
                                textUrl.includes("room") ||
                                textUrl.includes("roulette")
                            ) {
                                res.clone().json().then(data => captureRoomFromJson(data, { url: textUrl })).catch(() => {});
                            }
                        } catch (_) {}
                    }).catch(() => {});
                } catch (_) {}
                return promise;
            };
        }

        const OriginalXHR = window.XMLHttpRequest;
        if (typeof OriginalXHR === "function") {
            const originalOpen = OriginalXHR.prototype.open;
            const originalSend = OriginalXHR.prototype.send;

            OriginalXHR.prototype.open = function(method, url) {
                try { this.__generalAutoWatchUrl = String(url || ""); } catch (_) {}
                return originalOpen.apply(this, arguments);
            };

            OriginalXHR.prototype.send = function(body) {
                try {
                    this.addEventListener("load", function() {
                        try {
                            const text = this.responseText;
                            if (!text || typeof text !== "string") return;
                            if (!text.includes("room_id") && !text.includes("roomId") && !text.includes("authorization")) return;
                            captureRoomFromJson(JSON.parse(text), { url: this.__generalAutoWatchUrl || "" });
                        } catch (_) {}
                    });
                } catch (_) {}
                return originalSend.apply(this, arguments);
            };
        }
    }

    function normalizeName(value) {
        return String(value || "")
            .normalize("NFKC")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function getRoomPlayers() {
        return refreshGameState("get-room-players", { silent: true }).tablePlayers
            .map(player => ({
                userId: player.uid,
                name: player.name || player.uid,
                pid: player.pid,
                kissScore: player.kissScore,
                kissScoreKnown: player.kissScoreKnown === true
            }));
    }

    function getCenterNames() {
        const selectors = [
            ".action-user-name",
            ".duel__player-name",
            ".action__user-name",
            ".middle-player-name",
            ".action-player-name",
            ".action-buttons .player__name__link"
        ];
        const names = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const text = el.textContent?.trim();
                if (text) names.push(text);
            });
        });
        return Array.from(new Set(names));
    }

    function getCenterCandidateUids() {
        const candidates = new Set();
        const playersByName = new Map();
        getRoomPlayers().forEach(player => {
            playersByName.set(normalizeName(player.name), player.userId);
        });

        getCenterNames().forEach(name => {
            const uid = playersByName.get(normalizeName(name));
            if (uid) candidates.add(uid);
        });

        if (candidates.size) return Array.from(candidates);

        const actionArea = document.querySelector(".action-buttons");
        if (!actionArea || !isVisible(actionArea)) return [];

        const areaRect = actionArea.getBoundingClientRect();
        const centerX = areaRect.left + areaRect.width / 2;
        const centerY = areaRect.top + areaRect.height / 2;
        const nearby = [];

        document.querySelectorAll("[data-uid]").forEach(el => {
            if (!isVisible(el)) return;
            const uid = el.getAttribute("data-uid") || el.closest("[data-uid]")?.dataset.uid;
            if (!uid) return;
            const rect = el.getBoundingClientRect();
            const dx = rect.left + rect.width / 2 - centerX;
            const dy = rect.top + rect.height / 2 - centerY;
            nearby.push({ uid: String(uid), distance: dx * dx + dy * dy });
        });

        nearby.sort((a, b) => a.distance - b.distance);
        nearby.slice(0, 2).forEach(item => candidates.add(item.uid));
        return Array.from(candidates);
    }

    return {
        utils,
        cfg,
        state,
        settings,
        featureVisible,
        saveSettings,
        jitter,
        isVisible,
        installRoomWatcher,
        captureRoomFromJson,
        refreshGameState,
        getGameState,
        getRosterSnapshot,
        getPlayerActivity: readPlayerActivity,
        getCurrentRoomId,
        getRoomPlayers,
        getCenterCandidateUids
    };
}
