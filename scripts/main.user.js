// ==UserScript==
// @name        KissKiss Toolkit - Modular Panel (Build)
// @namespace   http://tampermonkey.net/
// @version     1.2
// @description Modular panel with settings, storage, drag and taller view.
// @match       https://getkisskiss.com/*
// @grant       none
// ==/UserScript==

(function(){'use strict';

// ===== CORE: panel.js =====
// panel.js
class ToolkitPanel {
    constructor(utils) {
        this.utils = utils;
        const { panel, header, tabStrip, body } = this.#buildLayout();
        this.panel = panel;
        this.header = header;
        this.tabStrip = tabStrip;
        this.body = body;
        this.tabMap = new Map();
        this.#enableDragging();
    }

    attachModule(module) {
        const tab = this.utils.el('button', {
            text: module.title,
            css: {
                padding: '6px 8px', cursor: 'pointer', border: '1px solid transparent',
                background: 'transparent', color: '#e6ffb3', opacity: '0.6'
            }
        });
        const content = this.utils.el('div', { css: { display: 'none' } });
        const settingsContainer = this.utils.el('div', { css: { marginTop: '12px' } });
        content.appendChild(settingsContainer);

        if (typeof module.renderSettings === 'function') {
            try { module.renderSettings.call(module, settingsContainer, { utils: this.utils }); }
            catch (error) { console.error('Modül yüklenemedi:', module.name, error); }
        }

        tab.addEventListener('click', () => this.showModule(module.name));

        this.tabStrip.appendChild(tab);
        this.body.appendChild(content);
        this.tabMap.set(module.name, { tab, content });
    }

    showModule(name) {
        this.tabMap.forEach(({ tab, content }, moduleName) => {
            const isActive = moduleName === name;
            tab.style.opacity = isActive ? '1' : '0.6';
            content.style.display = isActive ? 'block' : 'none';
        });
    }

    showFirstModule() {
        const first = this.tabMap.keys().next();
        if (!first.done) this.showModule(first.value);
    }

    #buildLayout() {
        const panel = this.utils.el('div', {
            attrs: { id: 'kiss-toolkit-panel' },
            css: {
                position: 'fixed', right: '10px', bottom: '10px', width: '400px', maxHeight: '720px',
                background: '#111', color: '#e6ffb3', border: '2px solid #bada55', borderRadius: '8px',
                zIndex: 999999, fontFamily: 'system-ui, monospace', boxShadow: '0 6px 20px rgba(0,0,0,.6)',
                display: 'flex', flexDirection: 'column'
            }
        });
        const header = this.utils.el('div', { css: { padding: '8px', fontWeight: 'bold', cursor: 'move' }, text: 'KissKiss Toolkit — Modular' });
        panel.appendChild(header);

        const tabContainer = this.utils.el('div', { css: { display: 'flex', alignItems: 'center', gap: '4px', padding: '8px' } });
        const btnLeft = this.utils.el('button', { text: '◀', css: { cursor: 'pointer', padding: '2px 6px' } });
        const btnRight = this.utils.el('button', { text: '▶', css: { cursor: 'pointer', padding: '2px 6px' } });
        const tabStrip = this.utils.el('div', { css: { display: 'flex', gap: '6px', overflowX: 'auto', flexGrow: 1, borderBottom: '1px solid rgba(186,218,85,0.15)' } });
        btnLeft.addEventListener('click', () => { tabStrip.scrollBy({ left: -100, behavior: 'smooth' }); });
        btnRight.addEventListener('click', () => { tabStrip.scrollBy({ left: 100, behavior: 'smooth' }); });
        tabContainer.appendChild(btnLeft);
        tabContainer.appendChild(tabStrip);
        tabContainer.appendChild(btnRight);
        panel.appendChild(tabContainer);

        const body = this.utils.el('div', { css: { padding: '10px', height: '620px', overflowY: 'auto', background: '#222' } });
        panel.appendChild(body);

        document.body.appendChild(panel);

        return { panel, header, tabStrip, body };
    }

    #enableDragging() {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        this.header.addEventListener('mousedown', event => {
            isDragging = true;
            offsetX = event.clientX - this.panel.offsetLeft;
            offsetY = event.clientY - this.panel.offsetTop;
        });
        document.addEventListener('mousemove', event => {
            if (!isDragging) return;
            this.panel.style.left = `${event.clientX - offsetX}px`;
            this.panel.style.top = `${event.clientY - offsetY}px`;
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }
}


// ===== CORE: registry.js =====
// registry.js
class ToolkitModuleRegistry {
    constructor(utils) {
        this.utils = utils;
        this.modules = new Map();
    }

    register(config) {
        const { name, title, renderSettings, defaultSettings = {} } = config;
        if (!name) throw new Error('Module must have name');
        if (this.modules.has(name)) return this.modules.get(name);

        const settings = this.utils.loadSettings(name, defaultSettings);
        const module = { name, title: title || name, renderSettings, defaultSettings, settings };
        this.modules.set(name, module);
        return module;
    }

    allModules() {
        return Array.from(this.modules.values());
    }
}


// ===== CORE: storageUtils.js =====
// storageUtils.js
const StorageUtils = {
    prefix: 'kiss_toolkit_',
    getKey(moduleName) { return this.prefix + moduleName; },
    saveSettings(moduleName, obj) {
        try {
            const key = this.getKey(moduleName);
            const value = JSON.stringify(obj);
            localStorage.setItem(key, value);
            if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === 'function') {
                window.__KISS_ACCOUNT_SAVE_SETTING(key, value);
            }
        }
        catch (error) { console.error(error); }
    },
    loadSettings(moduleName, defaults = {}) {
        try {
            const value = localStorage.getItem(this.getKey(moduleName));
            return value ? JSON.parse(value) : defaults;
        } catch (error) {
            console.error(error);
            return defaults;
        }
    },
    exportAllSettings() {
        const output = {};
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(this.prefix)) continue;
            try { output[key] = JSON.parse(localStorage.getItem(key)); }
            catch { output[key] = localStorage.getItem(key); }
        }
        return output;
    },
    importAllSettings(obj) {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(key => {
            if (!key.startsWith(this.prefix)) return;
            try {
                const value = JSON.stringify(obj[key]);
                localStorage.setItem(key, value);
                if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === 'function') window.__KISS_ACCOUNT_SAVE_SETTING(key, value);
            }
            catch {
                localStorage.setItem(key, obj[key]);
                if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === 'function') window.__KISS_ACCOUNT_SAVE_SETTING(key, obj[key]);
            }
        });
    },
    el(tag, opts = {}, ...children) {
        const element = document.createElement(tag);
        if (opts.css) Object.assign(element.style, opts.css);
        if (opts.html) element.innerHTML = opts.html;
        if (opts.text) element.textContent = opts.text;
        if (opts.attrs) Object.entries(opts.attrs).forEach(([key, value]) => element.setAttribute(key, value));
        children.flat().forEach(child => {
            if (child == null) return;
            element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return element;
    }
};


// ===== MODULE: ModuleManager.js =====
// moduleManager.js
function createModuleManagerModule(utils) {
    const STORAGE_KEY = "moduleManager_enabledModules";

    function loadEnabled() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
            const injected = window.__KISS_MODULE_SETTINGS || null;

            if (!injected || typeof injected !== "object") return stored;

            const fromLauncher = {};
            if (
                injected.generalAuto !== undefined ||
                injected.autoSpinTab1 !== undefined ||
                injected.autoKiss !== undefined ||
                injected.autoClose !== undefined ||
                injected.activeGuard !== undefined
            ) {
                fromLauncher.autoSpinTab1 = !!(
                    injected.generalAuto ||
                    injected.autoSpinTab1 ||
                    injected.autoKiss ||
                    injected.autoClose ||
                    injected.activeGuard
                );
            }
            if (injected.autoCombo !== undefined) fromLauncher.autoCombo = !!injected.autoCombo;
            if (injected.idRoomFollower !== undefined) fromLauncher.idRoomFollower = !!injected.idRoomFollower;
            if (injected.visualCleanerUltimateFixedV9 !== undefined) {
                fromLauncher.visualCleanerUltimateFixedV9 = !!injected.visualCleanerUltimateFixedV9;
            }
            if (injected.messageCleaner !== undefined) fromLauncher.messageCleaner = !!injected.messageCleaner;

            const merged = { ...stored, ...fromLauncher };
            saveEnabled(merged);
            return merged;
        } catch (_) {
            return {};
        }
    }

    function saveEnabled(obj) {
        const value = JSON.stringify(obj);
        localStorage.setItem(STORAGE_KEY, value);
        if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === "function") {
            window.__KISS_ACCOUNT_SAVE_SETTING(STORAGE_KEY, value);
        }
    }

    let allDefs = [];

    return {
        name: "moduleManager",
        title: "Modüller",
        defaultSettings: {},

        setModuleDefinitions(list) {
            allDefs = list || [];
        },

        loadEnabledMap() {
            return loadEnabled();
        },

        renderSettings(container) {
            container.innerHTML = "";
            const enabledMap = loadEnabled();

            allDefs.forEach(def => {
                if (enabledMap[def.name] === undefined) enabledMap[def.name] = true;
            });
            saveEnabled(enabledMap);

            container.appendChild(utils.el("div", {
                text: "Modül seçimi Hesaplarım ekranından yönetiliyor."
            }));
        }
    };
}




// ===== MODULE: GameStateProvider.js =====
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


// ===== MODULE: ApiScheduler.js =====
function createKissApiScheduler() {
    if (window.__KISS_API_SCHEDULER__) return window.__KISS_API_SCHEDULER__;

    const PRIORITY = {
        kiss: 100,
        recovery: 90,
        follow: 80,
        roomLock: 80,
        roomChange: 70,
        spin: 40,
        combo: 30,
        default: 10
    };

    const MAX_CONCURRENT = 2;
    const DEFAULT_MAX_WAIT_MS = {
        kiss: 3000,
        recovery: 5000,
        follow: 8000,
        roomLock: 8000,
        roomChange: 8000,
        spin: 15000,
        combo: 15000,
        default: 15000
    };

    const state = {
        running: 0,
        runningKeys: new Set(),
        queue: [],
        queuedByKey: new Map(),
        drainScheduled: false,
        stats: {},
        lastSummaryAt: 0
    };

    function normalizePriority(value) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        return PRIORITY[value] || PRIORITY.default;
    }

    function maxWaitFor(type, value) {
        const explicit = Number(value || 0);
        if (Number.isFinite(explicit) && explicit > 0) return explicit;
        return DEFAULT_MAX_WAIT_MS[type] || DEFAULT_MAX_WAIT_MS.default;
    }

    function stat(type, field) {
        const key = String(type || "default");
        const item = state.stats[key] || { queued: 0, replaced: 0, started: 0, deduped: 0, ok: 0, failed: 0 };
        item[field] = (item[field] || 0) + 1;
        state.stats[key] = item;
    }

    function summarize(force) {
        const now = Date.now();
        if (!force && now - state.lastSummaryAt < 60000) return;
        state.lastSummaryAt = now;
        try {
            if (window.__KISS_MODULE_SETTINGS && window.__KISS_MODULE_SETTINGS.diagnosticLog) {
                console.log("[API SCHEDULER] summary " + JSON.stringify({
                    running: state.running,
                    queued: state.queue.length,
                    runningKeys: Array.from(state.runningKeys),
                    queuedKeys: Array.from(state.queuedByKey.keys()),
                    stats: state.stats
                }));
            }
        } catch (_) {}
    }

    function resolveEntry(entry, payload) {
        try { entry.resolve(payload); } catch (_) {}
    }

    function rejectEntry(entry, error) {
        try {
            entry.resolve({
                ok: false,
                error: String(error && error.message ? error.message : error).slice(0, 180)
            });
        } catch (_) {}
    }

    function scheduleDrain() {
        if (state.drainScheduled) return;
        state.drainScheduled = true;
        setTimeout(drain, 0);
    }

    function scoreEntry(entry, now) {
        const waited = Math.max(0, now - entry.queuedAt);
        const maxWait = Math.max(1, entry.maxWaitMs);
        const waitRatio = Math.min(1, waited / maxWait);
        const waitBonus = waitRatio * 100;
        return entry.priority + waitBonus;
    }

    function pickNextIndex() {
        const now = Date.now();
        let bestIndex = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < state.queue.length; i += 1) {
            const entry = state.queue[i];
            if (!entry || state.runningKeys.has(entry.key)) continue;
            const score = scoreEntry(entry, now);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    function drain() {
        state.drainScheduled = false;

        while (state.running < MAX_CONCURRENT && state.queue.length) {
            const index = pickNextIndex();
            if (index < 0) break;
            const entry = state.queue.splice(index, 1)[0];
            if (!entry) continue;
            state.queuedByKey.delete(entry.key);
            runEntry(entry);
        }

        summarize(false);
    }

    async function runEntry(entry) {
        state.running += 1;
        state.runningKeys.add(entry.key);
        stat(entry.type, "started");

        try {
            const result = await entry.runner();
            stat(entry.type, "ok");
            resolveEntry(entry, { ok: true, result });
        } catch (error) {
            stat(entry.type, "failed");
            rejectEntry(entry, error);
        } finally {
            state.running = Math.max(0, state.running - 1);
            state.runningKeys.delete(entry.key);
            scheduleDrain();
        }
    }

    function request(options, runner) {
        const opts = options || {};
        const key = String(opts.key || opts.type || "default");
        const type = String(opts.type || key || "default");
        const priority = normalizePriority(opts.priority || type);
        const dedupeKey = opts.dedupeKey !== false;
        const replaceQueued = opts.replaceQueued !== false;
        const maxWaitMs = maxWaitFor(type, opts.maxWaitMs);

        if (dedupeKey && state.runningKeys.has(key)) {
            stat(type, "deduped");
            return Promise.resolve({ skipped: "key-running", key, type });
        }

        const queued = dedupeKey ? state.queuedByKey.get(key) : null;
        if (queued) {
            if (replaceQueued) {
                queued.runner = typeof runner === "function" ? runner : queued.runner;
                queued.priority = priority;
                queued.maxWaitMs = maxWaitMs;
                queued.updatedAt = Date.now();
                stat(type, "replaced");
            } else {
                stat(type, "deduped");
            }
            scheduleDrain();
            return queued.promise;
        }

        let resolve;
        const promise = new Promise(done => { resolve = done; });
        const entry = {
            key,
            type,
            priority,
            maxWaitMs,
            runner,
            resolve,
            promise,
            queuedAt: Date.now(),
            updatedAt: Date.now()
        };

        state.queue.push(entry);
        if (dedupeKey) state.queuedByKey.set(key, entry);
        stat(type, "queued");
        scheduleDrain();
        return promise;
    }

    const api = {
        PRIORITY,
        request,
        getState: () => ({
            running: state.running,
            queued: state.queue.length,
            runningKeys: Array.from(state.runningKeys),
            queuedKeys: Array.from(state.queuedByKey.keys())
        }),
        summarize
    };

    window.__KISS_API_SCHEDULER__ = api;
    return api;
}

createKissApiScheduler();


// ===== MODULE: GeneralAutoContextState.js =====
function createGeneralAutoContextConfig() {
    return {
        spinUrl: "https://getkisskiss.com/ajax/product/wheel_of_fortune/",
        spinBody: "spin=1",
        kissUrl: "https://getkisskiss.com/api/room/roulette_answer/",
        spinHeaders: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        kissHeaders: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01"
        },
        maxParallel: 5,
        minInterval: 400,
        minAllowedInterval: 50,
        maxAllowedInterval: 5000,
        successDecreaseFactor: 0.9,
        errorIncreaseFactor: 1.5,
        jitterPct: 0.2,
        autoCheckInterval: 1000
    };
}

function createGeneralAutoContextState(initialMyUid) {
    return {
        lastKnownRoomId: "",
        myUid: initialMyUid || "",
        lastGameState: null,
        lastGameStateKey: "",
        lastGameStateLogAt: 0
    };
}


// ===== MODULE: GeneralAutoContext.js =====
﻿// GeneralAutoContext.js
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


// ===== MODULE: GeneralAutoSpinState.js =====
function createGeneralAutoSpinState(ctx) {
    return {
        running: false,
        inflight: 0,
        lastSentAt: 0,
        minInterval: ctx.cfg.minInterval,
        loopStarted: false,
        sent: 0,
        ok: 0,
        failed: 0,
        lastSummaryAt: 0,
        lastErrorLogAt: 0
    };
}


// ===== MODULE: GeneralAutoSpin.js =====
﻿// GeneralAutoSpin.js
function createGeneralAutoSpinFeature(ctx, requestRender) {
    const state = createGeneralAutoSpinState(ctx);

    function logJson(label, payload) {
        try {
            console.log(label + " " + JSON.stringify(payload || {}));
        } catch (_) {
            console.log(label);
        }
    }

    function summarize(force) {
        const now = Date.now();
        if (!force && now - state.lastSummaryAt < 30000) return;
        state.lastSummaryAt = now;

        logJson("[AUTO SPIN] Ozet", {
            source: "auto-spin",
            running: state.running,
            inflight: state.inflight,
            minInterval: Math.floor(state.minInterval),
            sent: state.sent,
            ok: state.ok,
            failed: state.failed,
            roomId: ctx.getCurrentRoomId && ctx.getCurrentRoomId(),
            href: String(location.href || "")
        });

        state.sent = 0;
        state.ok = 0;
        state.failed = 0;
    }

    async function sendOneSpin() {
        state.inflight += 1;
        state.lastSentAt = Date.now();
        state.sent += 1;
        try {
            const runFetch = async () => {
                const res = await fetch(ctx.cfg.spinUrl, {
                method: "POST",
                headers: ctx.cfg.spinHeaders,
                body: ctx.cfg.spinBody,
                credentials: "same-origin",
                cache: "no-store"
            });
                const data = await res.json().catch(() => null);
                return { res, data };
            };
            const scheduler = window.__KISS_API_SCHEDULER__;
            const scheduled = scheduler && typeof scheduler.request === "function"
                ? await scheduler.request({ key: "spin", type: "spin", priority: "spin", dedupeKey: true, replaceQueued: true, maxWaitMs: 15000 }, runFetch)
                : { ok: true, result: await runFetch() };
            if (scheduled.skipped) return;
            if (!scheduled.ok) throw new Error(scheduled.error || "scheduler-failed");
            const res = scheduled.result.res;
            const data = scheduled.result.data;
            if (res.ok && data && data.result === 1) {
                state.ok += 1;
                state.minInterval = Math.max(ctx.cfg.minAllowedInterval, state.minInterval * ctx.cfg.successDecreaseFactor);
            } else {
                state.failed += 1;
                state.minInterval = Math.min(ctx.cfg.maxAllowedInterval, state.minInterval * ctx.cfg.errorIncreaseFactor);
                if (Date.now() - state.lastErrorLogAt > 10000) {
                    state.lastErrorLogAt = Date.now();
                    logJson("[AUTO SPIN] Hata veya backoff", {
                        source: "auto-spin",
                        status: res.status,
                        ok: !!res.ok,
                        result: data && data.result,
                        error: data && data.error,
                        minInterval: Math.floor(state.minInterval),
                        roomId: ctx.getCurrentRoomId && ctx.getCurrentRoomId(),
                        href: String(location.href || "")
                    });
                }
            }
        } catch (_) {
            state.failed += 1;
            state.minInterval = Math.min(ctx.cfg.maxAllowedInterval, state.minInterval * ctx.cfg.errorIncreaseFactor);
            if (Date.now() - state.lastErrorLogAt > 10000) {
                state.lastErrorLogAt = Date.now();
                logJson("[AUTO SPIN] Fetch hata", {
                    source: "auto-spin",
                    minInterval: Math.floor(state.minInterval),
                    roomId: ctx.getCurrentRoomId && ctx.getCurrentRoomId(),
                    href: String(location.href || "")
                });
            }
        } finally {
            state.inflight -= 1;
            summarize(false);
        }
    }

    async function loop() {
        if (state.loopStarted) return;
        state.loopStarted = true;
        while (!state.destroyed) {
            const now = Date.now();
            const canSend =
                state.running &&
                state.inflight < ctx.cfg.maxParallel &&
                (now - state.lastSentAt) >= ctx.jitter(state.minInterval);
            if (canSend) sendOneSpin();
            await new Promise(resolve => setTimeout(resolve, 30));
        }
    }

    function start() {
        if (state.running) return;
        state.running = true;
        summarize(true);
        loop().catch(console.error);
        requestRender();
    }

    function stop() {
        state.running = false;
        summarize(true);
        requestRender();
    }

    function destroy() {
        state.running = false;
        state.destroyed = true;
    }

    loop().catch(console.error);

    return {
        key: "autoSpinTab1",
        storageKey: "spin",
        label: "Auto Spin",
        isRunning: () => state.running,
        start,
        stop,
        destroy
    };
}


// ===== MODULE: GeneralAutoKissState.js =====
function createGeneralAutoKissState() {
    return {
        running: false,
        inflight: false,
        timer: null,
        lastDecisionLogAt: 0,
        lastResponseSummaryAt: 0,
        lastSuccessAt: 0,
        lastSentDecisionKey: "",
        lastSentDecisionAt: 0,
        repeatCooldownUntil: 0,
        responseSummary: createGeneralAutoKissResponseSummary()
    };
}

function createGeneralAutoKissResponseSummary(previousRoomId = "") {
    return {
        total: 0,
        answers: {},
        lastRoomId: previousRoomId,
        lastStatus: 0,
        lastResult: null,
        lastError: ""
    };
}


// ===== MODULE: GeneralAutoKissView.js =====
function createGeneralAutoKissView(ctx, requestRender) {
    function renderExtra() {
        const wrap = ctx.utils.el("div", {
            css: {
                display: "grid",
                gap: "6px",
                padding: "8px",
                border: "1px solid rgba(186,218,85,0.18)",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.14)"
            }
        });
        wrap.appendChild(ctx.utils.el("div", { text: "Kişiye Özel RET", css: { fontWeight: "800" } }));

        const lowScoreRow = ctx.utils.el("div", {
            css: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                padding: "4px 0 8px",
                borderBottom: "1px solid rgba(186,218,85,0.12)"
            }
        });
        const lowScoreLabel = ctx.utils.el("span", {
            text: "5K altı otomatik RET",
            css: { flex: "1", fontSize: "12px" }
        });
        const lowScoreButton = ctx.utils.el("button", {
            text: ctx.settings.lowScoreRetEnabled ? "Aktif" : "Pasif",
            css: {
                minWidth: "78px",
                cursor: "pointer",
                padding: "4px 7px",
                background: ctx.settings.lowScoreRetEnabled ? "#8c2430" : "#303030",
                color: "#fff"
            }
        });
        lowScoreButton.addEventListener("click", () => {
            ctx.settings.lowScoreRetEnabled = ctx.settings.lowScoreRetEnabled !== true;
            ctx.settings.lowScoreRetThreshold = 5000;
            ctx.saveSettings();
            requestRender();
        });
        lowScoreRow.append(lowScoreLabel, lowScoreButton);
        wrap.appendChild(lowScoreRow);

        const players = ctx.getRoomPlayers();
        if (!players.length) {
            wrap.appendChild(ctx.utils.el("div", { text: "Odada oyuncu görünmüyor.", css: { opacity: "0.7", fontSize: "12px" } }));
            return wrap;
        }

        players.forEach(player => {
            const isRet = !!ctx.settings.retList[player.userId];
            const row = ctx.utils.el("div", {
                css: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }
            });
            const name = player.name.length > 18 ? player.name.slice(0, 18) + "..." : player.name;
            const label = ctx.utils.el("span", { text: name, css: { flex: "1" } });
            const button = ctx.utils.el("button", {
                text: isRet ? "RET: Açık" : "RET",
                css: {
                    minWidth: "78px",
                    cursor: "pointer",
                    padding: "4px 7px",
                    background: isRet ? "#8c2430" : "#303030",
                    color: "#fff"
                }
            });
            button.addEventListener("click", () => {
                if (ctx.settings.retList[player.userId]) delete ctx.settings.retList[player.userId];
                else ctx.settings.retList[player.userId] = true;
                ctx.saveSettings();
                requestRender();
            });
            row.append(label, button);
            wrap.appendChild(row);
        });

        const clearButton = ctx.utils.el("button", {
            text: "RET listesini temizle",
            css: {
                marginTop: "4px",
                padding: "6px 10px",
                width: "100%",
                background: "#552222",
                color: "#fff",
                border: "1px solid #aa4444",
                cursor: "pointer",
                borderRadius: "6px",
                fontSize: "13px"
            }
        });
        clearButton.addEventListener("click", () => {
            Object.keys(ctx.settings.retList).forEach(key => delete ctx.settings.retList[key]);
            ctx.saveSettings();
            requestRender();
        });
        wrap.appendChild(clearButton);
        return wrap;
    }

    return { renderExtra };
}


// ===== MODULE: GeneralAutoKiss.js =====
﻿// GeneralAutoKiss.js
function createGeneralAutoKissFeature(ctx, requestRender) {
    const state = createGeneralAutoKissState();
    const view = createGeneralAutoKissView(ctx, requestRender);
    const SEND_COOLDOWN_MS = 10000;

    function logJson(label, payload) {
        try {
            console.log(label + " " + JSON.stringify(payload || {}));
        } catch (_) {
            console.log(label);
        }
    }

    function describeButton(selector) {
        try {
            const button = document.querySelector(selector);
            return {
                found: !!button,
                disabled: !!(button && button.disabled),
                visible: !!(button && ctx.isVisible(button))
            };
        } catch (_) {
            return { found: false, disabled: false, visible: false };
        }
    }

    function getButtonState() {
        return {
            no: describeButton('.js-kiss[data-type="1"]'),
            yes: describeButton('.js-kiss[data-type="2"]'),
            vip: describeButton('.js-kiss[data-type="3"]')
        };
    }

    function hasVisibleKissUi(buttonState) {
        try {
            return !!(buttonState && (
                buttonState.no && buttonState.no.visible ||
                buttonState.yes && buttonState.yes.visible ||
                buttonState.vip && buttonState.vip.visible
            ));
        } catch (_) {
            return false;
        }
    }

    function getActionType() {
        try {
            const action = document.querySelector(".actions .action, .action");
            const className = String(action && action.className || "");
            const match = className.match(/action--([a-zA-Z0-9_-]+)/);
            return match ? match[1] : "";
        } catch (_) {
            return "";
        }
    }

    function getLowScoreRetDecision(centerCandidateUids, buttonState) {
        const threshold = Number(ctx.settings.lowScoreRetThreshold || 5000) || 5000;
        const decision = {
            enabled: ctx.settings.lowScoreRetEnabled === true,
            matched: false,
            reason: "",
            threshold,
            targets: []
        };

        if (!decision.enabled) {
            decision.reason = "disabled";
            return decision;
        }

        if (!hasVisibleKissUi(buttonState)) {
            decision.reason = "kiss-ui-not-visible";
            return decision;
        }

        const uidSet = new Set((Array.isArray(centerCandidateUids) ? centerCandidateUids : []).map(uid => String(uid || "")).filter(Boolean));
        if (!uidSet.size) {
            decision.reason = "missing-center-candidate";
            return decision;
        }

        const players = ctx.getRoomPlayers();
        players.forEach(player => {
            const uid = String(player && player.userId || "");
            if (!uidSet.has(uid)) return;
            const score = Number(player.kissScore);
            const known = player.kissScoreKnown === true && Number.isFinite(score);
            decision.targets.push({
                uid,
                name: String(player.name || uid).slice(0, 40),
                pid: String(player.pid || ""),
                kissScore: known ? score : null,
                known
            });
            if (known && score < threshold) decision.matched = true;
        });

        if (!decision.targets.length) decision.reason = "center-target-not-in-roster";
        else decision.reason = decision.matched ? "low-score-ret" : "no-low-score-match";
        return decision;
    }

    function logDecision(payload, options = {}) {
        const now = Date.now();
        if (!options.force && now - state.lastDecisionLogAt < 12000 && payload && payload.reason !== "missing-room-id") return;
        state.lastDecisionLogAt = now;
        logJson("[AUTO KISS] decision", payload);
    }

    function recordResponse(answer, payload, force) {
        const now = Date.now();
        const key = String(answer);
        state.responseSummary.total += 1;
        state.responseSummary.answers[key] = (state.responseSummary.answers[key] || 0) + 1;
        state.responseSummary.lastRoomId = payload && payload.roomId ? String(payload.roomId) : state.responseSummary.lastRoomId;
        state.responseSummary.lastStatus = payload && payload.status || 0;
        state.responseSummary.lastResult = payload && Object.prototype.hasOwnProperty.call(payload, "result") ? payload.result : state.responseSummary.lastResult;
        state.responseSummary.lastError = payload && payload.error ? String(payload.error).slice(0, 160) : "";

        if (!force && now - state.lastResponseSummaryAt < 30000) return;

        state.lastResponseSummaryAt = now;
        logJson("[AUTO KISS] summary", {
            source: "auto-kiss",
            href: String(location.href || ""),
            total: state.responseSummary.total,
            answers: state.responseSummary.answers,
            roomId: state.responseSummary.lastRoomId,
            status: state.responseSummary.lastStatus,
            result: state.responseSummary.lastResult,
            error: state.responseSummary.lastError
        });

        state.responseSummary = createGeneralAutoKissResponseSummary(state.responseSummary.lastRoomId);
    }

    async function sendKissAnswer(answer, roomId) {
        if (!roomId) return false;

        state.inflight = true;
        const body = new URLSearchParams({
            roomId: String(roomId),
            answer: String(answer),
            userLocalTime: String(Math.floor(Date.now() / 1000)),
            sessnew: ""
        });

        try {
            const scheduler = window.__KISS_API_SCHEDULER__;
            const runFetch = async () => {
                const res = await fetch(ctx.cfg.kissUrl, {
                    method: "POST",
                    headers: ctx.cfg.kissHeaders,
                    body: body.toString(),
                    credentials: "same-origin",
                    cache: "no-store"
                });
                const data = await res.json().catch(() => null);
                return { res, data };
            };
            const scheduled = scheduler && typeof scheduler.request === "function"
                ? await scheduler.request({ key: "kiss", type: "kiss", priority: "kiss", dedupeKey: true, replaceQueued: true, maxWaitMs: 3000 }, runFetch)
                : { ok: true, result: await runFetch() };
            if (!scheduled.ok) throw new Error(scheduled.error || scheduled.skipped || "scheduler-failed");
            const res = scheduled.result.res;
            const data = scheduled.result.data;
            ctx.captureRoomFromJson(data);
            try {
                const responseRoomId = data && data.status && (data.status.room_id || data.status.roomId) || data && (data.room_id || data.roomId) || roomId;
                const responseAt = Date.now();
                window.__KISS_AUTO_KISS_LAST_RESPONSE_AT = responseAt;
                window.__KISS_AUTO_KISS_LAST_ROOM_ID = String(responseRoomId || roomId || "");
                window.__KISS_AUTO_KISS_LAST_ROOM_ID_AT = responseAt;
                console.log("__KISS_AUTO_KISS_RESPONSE__" + JSON.stringify({
                    at: responseAt,
                    roomId: window.__KISS_AUTO_KISS_LAST_ROOM_ID,
                    answer: String(answer),
                    ok: !!res.ok,
                    status: res.status,
                    result: data && data.result,
                    error: data && data.error
                }));
            } catch (_) {}
            const responsePayload = {
                answer: String(answer),
                ok: !!res.ok,
                status: res.status,
                result: data && data.result,
                error: data && data.error,
                roomId: data && data.status && (data.status.room_id || data.status.roomId) || data && (data.room_id || data.roomId) || roomId
            };
            if (!res.ok || responsePayload.error) logJson("[AUTO KISS] response", responsePayload);
            recordResponse(answer, responsePayload, false);
            if (res.ok && data && data.result === 1) {
                state.lastSuccessAt = Date.now();
                return true;
            }
            if (responsePayload.error && String(responsePayload.error).includes("kiss__error_repeat_player_answer")) {
                state.repeatCooldownUntil = Date.now() + 5000;
                return false;
            }
            return false;
        } catch (error) {
            const responsePayload = {
                answer: String(answer),
                ok: false,
                error: String(error && error.message ? error.message : error || "fetch-error").slice(0, 220),
                roomId
            };
            logJson("[AUTO KISS] response", responsePayload);
            recordResponse(answer, responsePayload, true);
            return false;
        } finally {
            state.inflight = false;
        }
    }

    async function tick() {
        if (!state.running || state.inflight) return;
        if (state.repeatCooldownUntil && Date.now() < state.repeatCooldownUntil) return;

        const gameState = ctx.refreshGameState("auto-kiss", { silent: true, force: true });
        const confirmedSources = ["network", "auto-kiss", "kiss_hidden_last_room_id"];
        const roomId = gameState && confirmedSources.includes(String(gameState.roomIdSource || ""))
            ? gameState.roomId
            : "";
        const buttonState = getButtonState();
        const hasKissUi = hasVisibleKissUi(buttonState);
        const actionType = getActionType();
        const centerCandidateUids = ctx.getCenterCandidateUids();
        const ownUid = String(gameState && (gameState.authUserId || gameState.ownUid) || "");

        if (!roomId) {
            logDecision({
                source: "auto-kiss",
                reason: "missing-room-id",
                requireConfirmedRoom: true,
                href: String(location.href || ""),
                roomId: "",
                roomIdSource: gameState && gameState.roomIdSource || "",
                actionType,
                hasKissUi,
                centerCandidateUids,
                ownUid,
                buttonState,
                inflight: state.inflight
            });
            return;
        }

        if (actionType !== "kissing") {
            logDecision({
                source: "auto-kiss",
                reason: "not-kissing-phase-skip",
                href: String(location.href || ""),
                roomId,
                actionType,
                hasKissUi,
                centerCandidateUids,
                ownUid,
                buttonState,
                inflight: state.inflight
            });
            return;
        }

        if (!hasKissUi) {
            logDecision({
                source: "auto-kiss",
                reason: "kiss-ui-not-visible-skip",
                href: String(location.href || ""),
                roomId,
                actionType,
                hasKissUi,
                centerCandidateUids,
                ownUid,
                buttonState,
                inflight: state.inflight
            });
            return;
        }

        if (!centerCandidateUids.length) {
            logDecision({
                source: "auto-kiss",
                reason: "missing-center-candidate-skip",
                href: String(location.href || ""),
                roomId,
                actionType,
                hasKissUi,
                centerCandidateUids,
                ownUid,
                buttonState,
                inflight: state.inflight
            });
            return;
        }

        if (ownUid && centerCandidateUids.includes(ownUid)) {
            logDecision({
                source: "auto-kiss",
                reason: "own-player-in-center-skip",
                href: String(location.href || ""),
                roomId,
                actionType,
                hasKissUi,
                centerCandidateUids,
                ownUid,
                buttonState,
                inflight: state.inflight
            });
            return;
        }

        const manualRet = centerCandidateUids.some(uid => !!ctx.settings.retList[uid]);
        const lowScoreRet = getLowScoreRetDecision(centerCandidateUids, buttonState);
        const shouldReject = manualRet || lowScoreRet.matched;
        const answers = shouldReject ? [1] : [3, 2];
        const decisionReason = manualRet ? "ret-list" : lowScoreRet.matched ? "low-score-ret" : "normal-and-vip";
        const decisionKey = [roomId, centerCandidateUids.slice().sort().join(","), answers.join(",")].join("|");
        const now = Date.now();

        if (state.lastSentDecisionKey === decisionKey && now - Number(state.lastSentDecisionAt || 0) < SEND_COOLDOWN_MS) {
            logDecision({
                source: "auto-kiss",
                reason: "decision-cooldown-skip",
                href: String(location.href || ""),
                roomId,
                actionType,
                hasKissUi,
                answers,
                shouldReject,
                manualRet,
                lowScoreRet,
                centerCandidateUids,
                ownUid,
                cooldownRemainingMs: SEND_COOLDOWN_MS - (now - Number(state.lastSentDecisionAt || 0)),
                buttonState,
                inflight: state.inflight
            });
            return;
        }

        state.lastSentDecisionKey = decisionKey;
        state.lastSentDecisionAt = now;

        logDecision({
            source: "auto-kiss",
            reason: decisionReason,
            href: String(location.href || ""),
            roomId,
            actionType,
            hasKissUi,
            answers,
            shouldReject,
            manualRet,
            lowScoreRet,
            centerCandidateUids,
            ownUid,
            buttonState,
            inflight: state.inflight
        }, { force: true });

        for (const answer of answers) {
            if (!state.running) return;
            await sendKissAnswer(answer, roomId);
        }
    }

    function start() {
        if (state.running) return;
        state.running = true;
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(tick, 1800 + Math.random() * 400);
        requestRender();
    }

    function stop() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        requestRender();
    }

    function destroy() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        state.inflight = false;
    }

    return {
        key: "autoKiss",
        storageKey: "kiss",
        label: "Auto Kiss",
        isRunning: () => state.running,
        start,
        stop,
        destroy,
        renderExtra: view.renderExtra
    };
}


// ===== MODULE: GeneralAutoClose.js =====
﻿// GeneralAutoClose.js
function createGeneralAutoCloseFeature(ctx, requestRender) {
    const state = { running: false, timer: null };

    function closePopups() {
        const selectors = [
            ".notify__close", ".popup__close", ".modal__close", ".close", ".btn-close",
            "[data-close]", "[aria-label='close']", "[aria-label='kapat']",
            "button.close", "button[title='Kapat']", "button[title='Close']"
        ];
        document.querySelectorAll(selectors.join(",")).forEach(btn => {
            try { btn.click(); } catch (_) {}
        });
    }

    function start() {
        if (state.running) return;
        state.running = true;
        closePopups();
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(closePopups, Math.max(800, ctx.cfg.autoCheckInterval));
        requestRender();
    }

    function stop() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        requestRender();
    }

    function destroy() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
    }

    return {
        key: "autoClose",
        storageKey: "close",
        label: "Sekmeleri Kapat",
        isRunning: () => state.running,
        start,
        stop,
        destroy
    };
}


// ===== MODULE: GeneralAutoGuardState.js =====
function createGeneralAutoGuardState(ctx) {
    return {
        running: false,
        decisionTimer: null,
        enabled: !!(ctx && ctx.settings && ctx.settings.guardEnabled),
        queueSignature: "",
        queueRoomId: "",
        queueStableSince: 0,
        queueLastObservedAt: 0,
        queueObserveTimer: null,
        playerCount: 0,
        playerCountRoomId: "",
        lowPlayerCount: 0,
        lowPlayerRoomId: "",
        lowPlayerSince: 0,
        changeInFlight: false,
        queueRecoveryInFlight: false,
        queueReloadInFlight: false,
        activeRecoveryAction: "",
        recoveryEvents: [],
        lastQueueRecoveryAt: 0,
        lastQueueReloadAt: 0,
        lastRoomChangeAt: 0,
        lastRoomChangeRejectedAt: 0,
        lastObservationKey: "",
        lastObservationChangeAt: 0,
        lastProfileRecoveryClickAt: 0,
        lastProfilePokeAt: 0,
        lastProfilePokeBlockedLogAt: 0,
        profilePokeInFlight: false,
        profilePokeTimer: null,
        profileRecoveryInFlight: false,
        profileRecoveryStartedAt: 0,
        profileRecoveryBeforeRoomId: "",
        profileRecoveryBeforeHref: "",
        profileRecoveryWatchersInstalled: false
    };
}

function createGeneralAutoGuardConfig() {
    return {
        QUEUE_STUCK_CHANGE_AFTER: 60000,
        LOW_PLAYER_LIMIT: 3,
        LOW_PLAYER_CHANGE_AFTER: 90000,
        ROOM_CHANGE_COOLDOWN: 180000,
        QUEUE_STUCK_RECOVERY_COOLDOWN: 120000,
        QUEUE_STUCK_RECOVERY_ATTEMPTS: 3,
        QUEUE_STUCK_RECOVERY_RETRY_DELAY: 1200,
        QUEUE_STUCK_RECOVERY_ROSTER_MAX_AGE: 180000,
        QUEUE_STUCK_RELOAD_COOLDOWN: 120000,
        QUEUE_STUCK_RELOAD_DELAY: 1500,
        QUEUE_OBSERVE_INTERVAL: 2000,
        QUEUE_DECISION_INTERVAL: 30000,
        PROFILE_RECOVERY_IDLE_AFTER: 120000,
        PROFILE_RECOVERY_COOLDOWN: 300000,
        PROFILE_RECOVERY_BAD_COOLDOWN: 900000,
        PROFILE_RECOVERY_MONITOR_MS: 5000,
        PROFILE_RECOVERY_PENALTY_KEY: "kiss_active_guard_profile_recovery_penalty_until",
        PROFILE_POKE_INTERVAL_MS: 10000,
        TIMER_JITTER_MS: 1500
    };
}


// ===== MODULE: GeneralAutoGuardDom.js =====
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


// ===== MODULE: GeneralAutoGuardRoomIds.js =====
function createGeneralAutoGuardRoomIdHelpers(ctx) {
    function normalizeRoomId(value) {
        const text = String(value || "").trim();
        return /^\d+$/.test(text) && text !== "0" ? text : "";
    }

    function getKnownRoomId() {
        try {
            return normalizeRoomId(ctx.getCurrentRoomId && ctx.getCurrentRoomId());
        } catch (_) {
            return "";
        }
    }

    function extractRoomId(data) {
        try {
            return normalizeRoomId(
                data && data.status && (data.status.room_id || data.status.roomId)
            ) || normalizeRoomId(data && (data.room_id || data.roomId));
        } catch (_) {
            return "";
        }
    }

    function hasUndefinedRoomRoute(url = location.href) {
        const text = String(url || "");
        return /\/game\/room(?:\/search)?\?=undefined/i.test(text) ||
            /\/game\/room\/search\?=undefined/i.test(text);
    }

    return {
        normalizeRoomId,
        getKnownRoomId,
        extractRoomId,
        hasUndefinedRoomRoute
    };
}


// ===== MODULE: GeneralAutoGuardRuntime.js =====
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


// ===== MODULE: GeneralAutoGuardObservation.js =====
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


// ===== MODULE: GeneralAutoGuardProfileRecovery.js =====
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


// ===== MODULE: GeneralAutoGuardQueueRecovery.js =====
function createGeneralAutoGuardQueueRecovery(ctx) {
    const {
        state,
        config,
        appCtx,
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
    } = ctx;

    const {
        QUEUE_STUCK_CHANGE_AFTER,
        QUEUE_STUCK_RECOVERY_COOLDOWN,
        QUEUE_STUCK_RECOVERY_ATTEMPTS,
        QUEUE_STUCK_RECOVERY_RETRY_DELAY,
        QUEUE_STUCK_RECOVERY_ROSTER_MAX_AGE,
        QUEUE_STUCK_RELOAD_COOLDOWN,
        QUEUE_STUCK_RELOAD_DELAY
    } = config;

    function getFreshRosterSnapshot(roomId) {
        try {
            const gameState = appCtx.getGameState && appCtx.getGameState("active-guard-roster");
            if (gameState && gameState.ownPresent && gameState.roomId) {
                if (roomId && normalizeRoomId(gameState.roomId) !== roomId) return null;
                const playerUids = Array.isArray(gameState.tableUids)
                    ? gameState.tableUids.map(uid => String(uid || "").trim()).filter(uid => /^\d+$/.test(uid) && uid !== String(gameState.authUserId || ""))
                    : [];
                if (playerUids.length) {
                    return {
                        roomId: normalizeRoomId(gameState.roomId),
                        ownUid: String(gameState.authUserId || ""),
                        playerUids,
                        at: Number(gameState.at || Date.now()),
                        count: Number(gameState.tablePlayerCount || playerUids.length + 1) || 0
                    };
                }
            }

            const roster = window.__kissDiag && window.__kissDiag.roster && window.__kissDiag.roster.last;
            if (!roster) return null;

            const snapshotRoomId = normalizeRoomId(roster.roomId);
            const snapshotAt = Number(roster.at || 0);
            const ownUid = /^\d+$/.test(String(roster.ownUid || "")) ? String(roster.ownUid) : String(appCtx.state.myUid || getStoredAuthUid() || "");
            const ids = Array.isArray(roster.ids) ? roster.ids : [];
            const playerUids = ids
                .map(uid => String(uid || "").trim())
                .filter(uid => /^\d+$/.test(uid) && uid !== ownUid);

            if (!snapshotRoomId || !snapshotAt) return null;
            if (roomId && snapshotRoomId !== roomId) return null;
            if (Date.now() - snapshotAt > QUEUE_STUCK_RECOVERY_ROSTER_MAX_AGE) return null;
            if (!roster.ownPresent) return null;
            if (!playerUids.length) return null;

            return {
                roomId: snapshotRoomId,
                ownUid,
                playerUids,
                at: snapshotAt,
                count: Number(roster.count || playerUids.length + (ownUid ? 1 : 0)) || 0
            };
        } catch (_) {
            return null;
        }
    }

    function logQueueRecovery(stage, payload = {}) {
        logJson("[ACTIVE GUARD] Queue stuck recovery", Object.assign({
            source: "active-guard-queue-stuck-recovery",
            stage,
            roomId: getKnownRoomId(),
            href: String(location.href || "")
        }, payload));
    }

    function logQueueRefresh(stage, payload = {}) {
        logJson("[ACTIVE GUARD] " + stage, Object.assign({
            source: "active-guard-queue-stuck-refresh",
            roomId: getKnownRoomId(),
            href: String(location.href || "")
        }, payload));
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function sitDownToFriend(anchorUid) {
        const runFetch = async () => {
            const res = await fetch("/api/room/sit_down_to_friend", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/javascript, */*; q=0.01"
                },
                body: new URLSearchParams({
                    friend_id: String(anchorUid),
                    userLocalTime: String(Math.floor(Date.now() / 1000)),
                    sessnew: ""
                })
            });
            const data = await res.json().catch(() => null);
            return { res, data };
        };

        const scheduler = window.__KISS_API_SCHEDULER__;
        const scheduled = scheduler && typeof scheduler.request === "function"
            ? await scheduler.request({ key: "active-guard:sit-down", type: "recovery", priority: "recovery", dedupeKey: true, replaceQueued: true, maxWaitMs: 5000 }, runFetch)
            : { ok: true, result: await runFetch() };
        if (!scheduled.ok) {
            return {
                status: 0,
                ok: false,
                result: null,
                error: scheduled.error || scheduled.skipped || "scheduler-failed",
                responseRoomId: "",
                data: null
            };
        }
        const res = scheduled.result.res;
        const data = scheduled.result.data;
        return {
            status: res.status,
            ok: !!res.ok,
            result: data && data.result,
            error: data && data.error,
            responseRoomId: extractRoomId(data),
            data
        };
    }

    async function recoverQueueStuck(decision) {
        if (!state.enabled) return false;

        const beforeRoomId = decision && decision.roomId;
        const queueSignature = decision && decision.queueSignature;
        const queueStableFor = decision && decision.queueStableFor;
        const now = Date.now();

        if (state.queueRecoveryInFlight) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "recovery-in-flight",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (!beforeRoomId) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "missing-room-id",
                beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (!queueSignature || queueStableFor < QUEUE_STUCK_CHANGE_AFTER || state.queueRoomId !== beforeRoomId) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "queue-not-stable",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (state.lastQueueRecoveryAt && now - state.lastQueueRecoveryAt < QUEUE_STUCK_RECOVERY_COOLDOWN) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "recovery-cooldown",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor,
                cooldownRemainingMs: QUEUE_STUCK_RECOVERY_COOLDOWN - (now - state.lastQueueRecoveryAt)
            });
            return false;
        }

        const roster = getFreshRosterSnapshot(beforeRoomId);
        if (!roster) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "missing-anchor-player",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        if (typeof beginRecoveryAction === "function" && !beginRecoveryAction("queue-recovery", {
            beforeRoomId,
            queueSignature,
            queueStableFor
        })) {
            logQueueRecovery("queue-stuck-recovery-blocked", {
                blockReason: "recovery-lock-busy",
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor
            });
            return false;
        }

        state.queueRecoveryInFlight = true;
        publishActiveGuardState();
        state.lastQueueRecoveryAt = now;

        logQueueRecovery("queue-stuck-recovery-eligible", {
            beforeRoomId,
            targetRoomId: beforeRoomId,
            queueSignature,
            queueStableFor,
            playerCount: decision.playerCount,
            anchorCount: roster.playerUids.length,
            rosterAgeMs: Date.now() - roster.at
        });

        try {
            const anchors = roster.playerUids.slice(0, QUEUE_STUCK_RECOVERY_ATTEMPTS);
            for (let attempt = 1; attempt <= QUEUE_STUCK_RECOVERY_ATTEMPTS; attempt += 1) {
                const anchorUid = anchors[(attempt - 1) % anchors.length];
                if (!anchorUid) break;

                logQueueRecovery("queue-stuck-recovery-anchor-selected", {
                    beforeRoomId,
                    targetRoomId: beforeRoomId,
                    anchorUid,
                    attempt,
                    queueSignature,
                    queueStableFor
                });

                logQueueRecovery("queue-stuck-recovery-follow-fetch", {
                    beforeRoomId,
                    targetRoomId: beforeRoomId,
                    anchorUid,
                    attempt,
                    queueSignature,
                    queueStableFor
                });

                let response;
                try {
                    response = await sitDownToFriend(anchorUid);
                } catch (error) {
                    response = {
                        status: 0,
                        ok: false,
                        result: false,
                        error: String(error && error.message ? error.message : error),
                        responseRoomId: ""
                    };
                }

                logQueueRecovery("queue-stuck-recovery-follow-response", {
                    beforeRoomId,
                    targetRoomId: beforeRoomId,
                    anchorUid,
                    attempt,
                    status: response.status,
                    ok: response.ok,
                    result: response.result,
                    error: response.error,
                    responseRoomId: response.responseRoomId,
                    queueSignature,
                    queueStableFor
                });

                if (response.ok && response.result && response.responseRoomId) {
                    appCtx.captureRoomFromJson(response.data);
                    resetQueueObservation();
                    resetLowPlayerObservation();
                    logQueueRecovery("queue-stuck-recovery-navigate", {
                        beforeRoomId,
                        targetRoomId: beforeRoomId,
                        anchorUid,
                        attempt,
                        responseRoomId: response.responseRoomId,
                        targetUrl: "/game/room?"
                    });
                    setTimeout(() => {
                        try {
                            location.href = "/game/room?";
                        } catch (_) {}
                    }, 250);
                    return true;
                }

                if (attempt < QUEUE_STUCK_RECOVERY_ATTEMPTS) {
                    logQueueRecovery("queue-stuck-recovery-retry", {
                        beforeRoomId,
                        targetRoomId: beforeRoomId,
                        anchorUid,
                        attempt,
                        nextAttempt: attempt + 1,
                        responseRoomId: response.responseRoomId,
                        blockReason: response.responseRoomId ? "response-not-successful" : "missing-response-room"
                    });
                    await delay(QUEUE_STUCK_RECOVERY_RETRY_DELAY);
                }
            }

            logQueueRecovery("queue-stuck-recovery-failed", {
                beforeRoomId,
                targetRoomId: beforeRoomId,
                queueSignature,
                queueStableFor,
                attempts: QUEUE_STUCK_RECOVERY_ATTEMPTS,
                blockReason: "attempts-exhausted"
            });
            return false;
        } finally {
            state.queueRecoveryInFlight = false;
            if (typeof endRecoveryAction === "function") endRecoveryAction("queue-recovery", {
                beforeRoomId,
                queueSignature,
                queueStableFor
            });
            publishActiveGuardState();
        }
    }

    function getQueueRefreshBlockReason(decision) {
        const now = Date.now();
        const roomId = decision && decision.roomId;
        const queueSignature = decision && decision.queueSignature;
        const queueStableFor = decision && decision.queueStableFor;

        if (!state.enabled) return "guard-disabled";
        if (!decision || !decision.reasons || !decision.reasons.includes("queue_stuck")) return "not-queue-stuck";
        if (!roomId) return "missing-room-id";
        if (!queueSignature || queueStableFor < QUEUE_STUCK_CHANGE_AFTER) return "queue-not-stable";
        if (state.queueRoomId !== roomId) return "queue-room-mismatch";
        if (state.queueSignature !== queueSignature) return "queue-signature-changed";
        if (state.queueRecoveryInFlight) return "queue-recovery-in-flight";
        if (state.profileRecoveryInFlight) return "profile-recovery-in-flight";
        if (state.queueReloadInFlight) return "reload-in-flight";
        if (state.lastQueueReloadAt && now - state.lastQueueReloadAt < QUEUE_STUCK_RELOAD_COOLDOWN) {
            return "reload-cooldown";
        }
        return "";
    }

    function scheduleQueueStuckRefresh(decision, recoveryResult) {
        const blockReason = getQueueRefreshBlockReason(decision);
        if (blockReason) {
            logQueueRefresh("queue-stuck-refresh-blocked", {
                blockReason,
                recoveryResult: !!recoveryResult,
                queueSignature: decision && decision.queueSignature,
                queueStableFor: decision && decision.queueStableFor
            });
            return false;
        }

        state.queueReloadInFlight = true;
        if (typeof beginRecoveryAction === "function" && !beginRecoveryAction("queue-reload", {
            roomId: decision.roomId,
            queueSignature: decision.queueSignature,
            queueStableFor: decision.queueStableFor
        })) {
            state.queueReloadInFlight = false;
            publishActiveGuardState();
            return false;
        }
        publishActiveGuardState();
        logQueueRefresh("queue-stuck-refresh-scheduled", {
            recoveryResult: !!recoveryResult,
            queueSignature: decision.queueSignature,
            queueStableFor: decision.queueStableFor,
            delayMs: QUEUE_STUCK_RELOAD_DELAY
        });

        setTimeout(() => {
            try {
                const currentRoomId = getKnownRoomId();
                const stableFor = getQueueStableFor(Date.now(), currentRoomId);
                const stillStable = !!(
                    currentRoomId &&
                    currentRoomId === decision.roomId &&
                    state.queueRoomId === decision.roomId &&
                    state.queueSignature === decision.queueSignature &&
                    stableFor >= QUEUE_STUCK_CHANGE_AFTER
                );

                if (!stillStable || state.queueRecoveryInFlight || state.profileRecoveryInFlight) {
                    logQueueRefresh("queue-stuck-refresh-blocked", {
                        blockReason: "post-delay-state-changed",
                        currentRoomId,
                        expectedRoomId: decision.roomId,
                        queueSignature: state.queueSignature,
                        expectedSignature: decision.queueSignature,
                        queueStableFor: stableFor
                    });
                    return;
                }

                state.lastQueueReloadAt = Date.now();
                logQueueRefresh("queue-stuck-refresh-navigate", {
                    roomId: currentRoomId,
                    queueSignature: state.queueSignature,
                    queueStableFor: stableFor,
                    targetUrl: "/game/room?"
                });
                location.href = "/game/room?";
            } catch (error) {
                logQueueRefresh("queue-stuck-refresh-blocked", {
                    blockReason: "reload-error",
                    error: String(error && error.message ? error.message : error).slice(0, 160)
                });
            } finally {
                state.queueReloadInFlight = false;
                if (typeof endRecoveryAction === "function") endRecoveryAction("queue-reload", {
                    roomId: decision.roomId,
                    queueSignature: decision.queueSignature
                });
                publishActiveGuardState();
            }
        }, QUEUE_STUCK_RELOAD_DELAY);

        return true;
    }

    return {
        recoverQueueStuck,
        scheduleQueueStuckRefresh
    };
}


// ===== MODULE: GeneralAutoGuardRoomChange.js =====
function createGeneralAutoGuardRoomChange(ctx) {
    const {
        appCtx,
        state,
        config,
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
    } = ctx;

    const {
        QUEUE_STUCK_CHANGE_AFTER,
        LOW_PLAYER_LIMIT,
        LOW_PLAYER_CHANGE_AFTER,
        ROOM_CHANGE_COOLDOWN
    } = config;

    function buildRoomChangeDecision() {
        const now = Date.now();
        const roomId = getKnownRoomId();
        const queueStableFor = getQueueStableFor(now, roomId);
        const lowPlayerFor = getLowPlayerFor(now, roomId);
        const reasons = [];

        if (queueStableFor >= QUEUE_STUCK_CHANGE_AFTER) reasons.push("queue_stuck");
        if (lowPlayerFor >= LOW_PLAYER_CHANGE_AFTER) reasons.push("low-player-count");

        return {
            roomId,
            reasons,
            reason: reasons.join("+"),
            queueSignature: state.queueSignature || "",
            queueStableFor,
            playerCount: state.playerCount || 0,
            lowPlayerCount: state.lowPlayerCount || 0,
            lowPlayerFor
        };
    }

    function getRoomChangeBlockReason(decision) {
        if (!state.enabled) return "guard-disabled";
        if (state.changeInFlight) return "change-in-flight";
        if (!decision || !decision.roomId) return "missing-room-id";
        if (!decision.reasons || !decision.reasons.length) return "no-stable-reason";
        if (hasUndefinedRoomRoute()) return "undefined-route";

        if (!getMe()) return "guard-not-ready";

        if (decision.reasons.includes("queue_stuck") && state.queueRoomId !== decision.roomId) {
            return "queue-room-mismatch";
        }

        if (
            decision.reasons.includes("low-player-count") &&
            state.playerCountRoomId &&
            state.playerCountRoomId !== decision.roomId
        ) {
            return "player-room-mismatch";
        }

        if (decision.reasons.includes("low-player-count") && (!state.lowPlayerCount || state.lowPlayerCount > LOW_PLAYER_LIMIT)) {
            return "unknown-player-count";
        }

        if (decision.reasons.includes("queue_stuck") && (!state.queueSignature || decision.queueStableFor < QUEUE_STUCK_CHANGE_AFTER)) {
            return "queue-not-stable";
        }

        return "";
    }

    function logRoomChangeCancel(decision, blockReason, extra = {}) {
        logJson("[ACTIVE GUARD] Rastgele masa iptal", Object.assign({
            source: "active-guard-random-room",
            reason: decision && decision.reason,
            blockReason,
            roomId: decision && decision.roomId,
            queueSignature: decision && decision.queueSignature,
            queueStableFor: decision && decision.queueStableFor,
            playerCount: decision && decision.playerCount,
            lowPlayerFor: decision && decision.lowPlayerFor
        }, extra));
    }

    async function changeRandomRoom(decision) {
        if (decision && decision.reasons && decision.reasons.includes("queue_stuck")) {
            logRoomChangeCancel(decision, "queue-stuck-random-change-disabled");
            return false;
        }

        const blockReason = getRoomChangeBlockReason(decision);
        if (blockReason) {
            logRoomChangeCancel(decision, blockReason);
            return false;
        }

        const now = Date.now();
        if (now - state.lastRoomChangeAt < ROOM_CHANGE_COOLDOWN) {
            logJson("[ACTIVE GUARD] Rastgele masa beklemede", {
                source: "active-guard-random-room",
                reason: decision.reason,
                cooldownRemainingMs: ROOM_CHANGE_COOLDOWN - (now - state.lastRoomChangeAt)
            });
            return false;
        }

        if (state.lastRoomChangeRejectedAt && now - state.lastRoomChangeRejectedAt < ROOM_CHANGE_COOLDOWN) {
            logJson("[ACTIVE GUARD] Rastgele masa beklemede", {
                source: "active-guard-random-room",
                reason: decision.reason,
                cooldownRemainingMs: ROOM_CHANGE_COOLDOWN - (now - state.lastRoomChangeRejectedAt),
                lastReject: true
            });
            return false;
        }

        const beforeRoomId = decision.roomId;
        if (typeof beginRecoveryAction === "function" && !beginRecoveryAction("room-change", {
            beforeRoomId,
            reason: decision.reason,
            queueSignature: decision.queueSignature
        })) {
            logRoomChangeCancel(decision, "recovery-lock-busy", { beforeRoomId });
            return false;
        }

        state.changeInFlight = true;
        publishActiveGuardState();

        logJson("[ACTIVE GUARD] Rastgele masa karar", {
            source: "active-guard-random-room",
            reason: decision.reason,
            beforeRoomId,
            queueSignature: decision.queueSignature,
            queueStableFor: decision.queueStableFor,
            playerCount: decision.playerCount,
            lowPlayerFor: decision.lowPlayerFor
        });

        try {
            const runFetch = async () => {
                const res = await fetch("/api/room/change/", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "application/json, text/javascript, */*; q=0.01"
                    },
                    body: new URLSearchParams({
                        userLocalTime: String(Math.floor(Date.now() / 1000)),
                        sessnew: ""
                    })
                });
                const data = await res.json().catch(() => null);
                return { res, data };
            };

            const scheduler = window.__KISS_API_SCHEDULER__;
            const scheduled = scheduler && typeof scheduler.request === "function"
                ? await scheduler.request({ key: "active-guard:room-change", type: "roomChange", priority: "roomChange", dedupeKey: true, replaceQueued: true, maxWaitMs: 8000 }, runFetch)
                : { ok: true, result: await runFetch() };
            if (!scheduled.ok) throw new Error(scheduled.error || scheduled.skipped || "scheduler-failed");
            const res = scheduled.result.res;
            const data = scheduled.result.data;
            const nextRoomId = extractRoomId(data);

            logJson("[ACTIVE GUARD] Rastgele masa cevap", {
                source: "active-guard-random-room",
                reason: decision.reason,
                status: res.status,
                ok: !!res.ok,
                result: data && data.result,
                beforeRoomId,
                nextRoomId,
                data
            });

            if (!res.ok) {
                logRoomChangeCancel(decision, "fetch-failed", { status: res.status, beforeRoomId, nextRoomId });
                return false;
            }

            if (!(data && data.result) || !nextRoomId) {
                const rawRoomId = data && data.status && (data.status.room_id !== undefined ? data.status.room_id : data.status.roomId);
                const rawRoomIdText = rawRoomId === undefined || rawRoomId === null ? "" : String(rawRoomId);
                const serverSideChangeSuspected = !!(data && data.result && rawRoomIdText === "0");
                if (serverSideChangeSuspected) {
                    state.lastRoomChangeRejectedAt = Date.now();
                }
                logRoomChangeCancel(decision, "no-next-room", {
                    status: res.status,
                    beforeRoomId,
                    nextRoomId,
                    serverSideChangeSuspected
                });
                return false;
            }

            if (nextRoomId === beforeRoomId) {
                logRoomChangeCancel(decision, "same-room", { status: res.status, beforeRoomId, nextRoomId });
                return false;
            }

            appCtx.captureRoomFromJson(data);
            state.lastRoomChangeAt = Date.now();
            state.lastRoomChangeRejectedAt = 0;
            resetQueueObservation();
            resetLowPlayerObservation();

            setTimeout(() => {
                try {
                    logJson("[ACTIVE GUARD] navigate", {
                        source: "active-guard-random-room",
                        reason: decision.reason,
                        beforeRoomId,
                        nextRoomId
                    });
                    location.href = "/game/room?";
                } catch (_) {}
            }, 250);

            return true;
        } catch (error) {
            console.error("[ACTIVE GUARD] Rastgele masa hatasi", String(error && error.message ? error.message : error));
            logRoomChangeCancel(decision, "fetch-failed", {
                beforeRoomId,
                error: String(error && error.message ? error.message : error)
            });
            return false;
        } finally {
            state.changeInFlight = false;
            if (typeof endRecoveryAction === "function") endRecoveryAction("room-change", {
                beforeRoomId,
                reason: decision.reason
            });
            publishActiveGuardState();
        }
    }

    function evaluateRoomChange() {
        if (!state.enabled) return;

        const decision = buildRoomChangeDecision();
        if (!decision.reasons.length) {
            logJson("[ACTIVE GUARD] Rastgele masa icin bekleniyor", {
                source: "active-guard-watch",
                roomId: decision.roomId,
                queueSignature: decision.queueSignature,
                queueStableFor: decision.queueStableFor,
                requiredStuck: QUEUE_STUCK_CHANGE_AFTER,
                playerCount: decision.playerCount,
                lowPlayerFor: decision.lowPlayerFor,
                requiredLowPlayerAge: LOW_PLAYER_CHANGE_AFTER
            });
            return;
        }

        if (decision.reasons.includes("queue_stuck")) {
            recoverQueueStuck(decision).then(result => {
                scheduleQueueStuckRefresh(decision, result);
            }).catch(error => {
                logJson("[ACTIVE GUARD] queue-stuck-refresh-blocked", {
                    source: "active-guard-queue-stuck-refresh",
                    roomId: getKnownRoomId(),
                    href: String(location.href || ""),
                    blockReason: "recovery-error",
                    error: String(error && error.message ? error.message : error).slice(0, 160),
                    queueSignature: decision.queueSignature,
                    queueStableFor: decision.queueStableFor
                });
                scheduleQueueStuckRefresh(decision, false);
            });
            return;
        }

        changeRandomRoom(decision);
    }

    return {
        evaluateRoomChange,
        changeRandomRoom,
        buildRoomChangeDecision
    };
}


// ===== MODULE: GeneralAutoGuardProfileOrchestrator.js =====
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


// ===== MODULE: GeneralAutoGuardLifecycle.js =====
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


// ===== MODULE: GeneralAutoGuard.js =====
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


// ===== MODULE: GeneralAutoPerformanceState.js =====
function createGeneralAutoPerformanceDefaults() {
    return {
        enabled: false,
        mode: "aggressive",
        chatMaxMessages: 80,
        cleanupIntervalMs: 10000,
        lastCleanupSummary: null
    };
}

function createGeneralAutoPerformanceState() {
    return {
        running: false,
        timer: null,
        observer: null,
        queuedNodes: [],
        cleanupInFlight: false,
        lastSummaryLogAt: 0,
        lastFullSweepAt: 0,
        lastChatCleanupAt: 0,
        lastStorageCleanupAt: 0,
        lastError: "",
        totals: {
            chatRemoved: 0,
            visualRemoved: 0,
            modalRemoved: 0,
            storageRemoved: 0,
            sweeps: 0
        }
    };
}

function createGeneralAutoPerformanceConfig() {
    const CHEAP_VISUAL_SELECTORS = [
        ".gift",
        ".gift--small",
        ".gift-animation",
        ".gift-animation-container",
        ".gift__container",
        ".animation_gift",
        ".flying-gift",
        ".fly-gift",
        ".animation-frame",
        ".hat-animation-frame",
        ".frame-glow",
        ".frame-glow-wrap",
        ".player__frame",
        ".player__border",
        ".player__collection[data-link=\"collection\"]",
        "[data-gift]",
        "[data-type=\"gift\"]",
        "canvas[data-type=\"gift\"]",
        "canvas[data-type=\"hat\"]",
        "canvas[data-type=\"frame\"]",
        "canvas[data-type=\"frame-glow\"]"
    ];

    return {
        STYLE_ID: "kiss-performance-aggressive-css",
        MAX_QUEUE: 120,
        FULL_SWEEP_INTERVAL_MS: 60000,
        CHAT_CLEANUP_INTERVAL_MS: 15000,
        STORAGE_CLEANUP_INTERVAL_MS: 120000,
        SAFE_STORAGE_PREFIXES: [
            "kiss_toolkit_",
            "kiss_auth_user_id",
            "kiss_hidden_last_room_id",
            "kiss_hidden_last_room_id_at",
            "topface_stprev_room_id"
        ],
        REMOVABLE_STORAGE_PATTERNS: [
            /^kiss_debug_/,
            /^kiss_diag_/,
            /^kiss_performance_temp_/,
            /^__kiss_debug_/,
            /^__kiss_diag_/,
            /diagnostic/i,
            /debug/i
        ],
        CHEAP_VISUAL_SELECTORS,
        QUEUED_VISUAL_SELECTORS: CHEAP_VISUAL_SELECTORS.concat([
            "[class*=\"gift\"]",
            "[class*=\"confetti\"]",
            "[class*=\"sparkle\"]",
            "[class*=\"firework\"]"
        ]),
        MODAL_SELECTORS: [
            ".toast",
            ".toast-message",
            ".notification",
            ".notifications__item",
            ".popup:not(.is-open):not(.active)",
            ".modal:not(.is-open):not(.active)",
            ".modal-backdrop:not(.show)",
            ".overlay:not(.is-open):not(.active)",
            ".tooltip",
            ".tippy-box"
        ]
    };
}


// ===== MODULE: GeneralAutoPerformance.js =====
// GeneralAutoPerformance.js
function createGeneralAutoPerformanceFeature(ctx, requestRender) {
    const DEFAULTS = createGeneralAutoPerformanceDefaults();

    ctx.settings.performance = Object.assign({}, DEFAULTS, ctx.settings.performance || {});

    const state = createGeneralAutoPerformanceState();
    const {
        STYLE_ID,
        MAX_QUEUE,
        FULL_SWEEP_INTERVAL_MS,
        CHAT_CLEANUP_INTERVAL_MS,
        STORAGE_CLEANUP_INTERVAL_MS,
        SAFE_STORAGE_PREFIXES,
        REMOVABLE_STORAGE_PATTERNS,
        CHEAP_VISUAL_SELECTORS,
        QUEUED_VISUAL_SELECTORS,
        MODAL_SELECTORS
    } = createGeneralAutoPerformanceConfig();

    function logJson(label, payload) {
        try {
            console.log(label + " " + JSON.stringify(payload || {}));
        } catch (_) {
            console.log(label);
        }
    }

    function savePerformanceSettings() {
        ctx.settings.performance.enabled = !!state.running;
        ctx.saveSettings();
    }

    function isProtectedNode(node) {
        try {
            if (!node || node.nodeType !== 1) return true;
            if (node.id === "kiss-toolkit-panel") return true;
            if (node.closest && node.closest("#kiss-toolkit-panel")) return true;
            if (node.matches && node.matches(".player[data-pid][data-uid]:not(.player-graphics)")) return true;
            if (node.closest && node.closest(".player[data-pid][data-uid]:not(.player-graphics)")) return true;
            if (node.matches && node.matches("script,style,link,meta,html,body")) return true;
        } catch (_) {
            return true;
        }
        return false;
    }

    function removeNode(node) {
        try {
            if (!node || !node.parentNode || isProtectedNode(node)) return false;
            node.remove();
            return true;
        } catch (_) {
            return false;
        }
    }

    function ensureCss() {
        let style = document.getElementById(STYLE_ID);
        if (style) return;
        style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = [
            ".gift,.gift--small,.gift-animation,.gift-animation-container,.gift__container,.animation_gift,[data-gift],[data-type=\"gift\"],canvas[data-type=\"gift\"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}",
            ".hat-animation-frame,.animation-frame,canvas[data-type=\"hat\"],canvas[data-type=\"frame\"],canvas[data-type=\"frame-glow\"],.frame-glow,.frame-glow-wrap,.player__collection[data-link=\"collection\"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}",
            "[class*=\"confetti\"],[class*=\"sparkle\"],[class*=\"firework\"],[class*=\"flying-gift\"],[class*=\"fly-gift\"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}"
        ].join("\n");
        document.head.appendChild(style);
    }

    function removeCss() {
        try { document.getElementById(STYLE_ID)?.remove(); } catch (_) {}
    }

    function selectorSweep(root, selectors) {
        let removed = 0;
        try {
            const base = root && root.querySelectorAll ? root : document;
            base.querySelectorAll(selectors.join(",")).forEach(node => {
                if (removeNode(node)) removed += 1;
            });
        } catch (_) {}
        return removed;
    }

    function trimChat() {
        let removed = 0;
        const max = Math.max(20, Number(ctx.settings.performance.chatMaxMessages || DEFAULTS.chatMaxMessages) || DEFAULTS.chatMaxMessages);
        try {
            const containers = Array.from(document.querySelectorAll(".chat__messages,.messages,.chat-messages,.js-chat-messages"));
            containers.forEach(container => {
                const messages = Array.from(container.querySelectorAll(".chat__message,.message,.message-row,.js-message"));
                const extraCount = Math.max(0, messages.length - max);
                messages.slice(0, extraCount).forEach(message => {
                    if (removeNode(message)) removed += 1;
                });
            });
        } catch (_) {}
        return removed;
    }

    function removeSystemChatNoise() {
        let removed = 0;
        try {
            document.querySelectorAll(".chat__message,.message,.message-row,.js-message").forEach(message => {
                if (isProtectedNode(message)) return;
                const text = String(message.textContent || "");
                const hasGift = !!message.querySelector(".gift__inline,.gift,[data-gift]");
                const noisy = hasGift ||
                    text.includes("Çarkıfelek") ||
                    text.includes("Carkifelek") ||
                    text.includes("öpüşme şansını artırdı") ||
                    text.includes("opusme sansini artirdi") ||
                    text.toLowerCase().includes("wheel of fortune");
                if (noisy && removeNode(message)) removed += 1;
            });
        } catch (_) {}
        return removed;
    }

    function cleanupStorage() {
        let removed = 0;
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = String(localStorage.key(i) || "");
                if (!key) continue;
                if (SAFE_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
                if (!REMOVABLE_STORAGE_PATTERNS.some(pattern => pattern.test(key))) continue;
                keys.push(key);
            }
            keys.slice(0, 30).forEach(key => {
                try {
                    localStorage.removeItem(key);
                    removed += 1;
                } catch (_) {}
            });
        } catch (_) {}
        return removed;
    }

    function cleanupQueuedNodes() {
        let visualRemoved = 0;
        let modalRemoved = 0;
        const nodes = state.queuedNodes.splice(0, state.queuedNodes.length);
        nodes.forEach(node => {
            if (!node || node.nodeType !== 1 || isProtectedNode(node)) return;
            try {
                if (node.matches && node.matches(QUEUED_VISUAL_SELECTORS.join(","))) {
                    if (removeNode(node)) visualRemoved += 1;
                    return;
                }
                if (node.matches && node.matches(MODAL_SELECTORS.join(","))) {
                    if (removeNode(node)) modalRemoved += 1;
                    return;
                }
                visualRemoved += selectorSweep(node, QUEUED_VISUAL_SELECTORS);
                modalRemoved += selectorSweep(node, MODAL_SELECTORS);
            } catch (_) {}
        });
        return { visualRemoved, modalRemoved };
    }

    function recordSummary(summary) {
        state.totals.chatRemoved += summary.chatRemoved;
        state.totals.visualRemoved += summary.visualRemoved;
        state.totals.modalRemoved += summary.modalRemoved;
        state.totals.storageRemoved += summary.storageRemoved;
        state.totals.sweeps += 1;

        const compact = {
            at: Date.now(),
            chatRemoved: summary.chatRemoved,
            visualRemoved: summary.visualRemoved,
            modalRemoved: summary.modalRemoved,
            storageRemoved: summary.storageRemoved,
            totals: Object.assign({}, state.totals),
            error: state.lastError
        };
        ctx.settings.performance.lastCleanupSummary = compact;
        ctx.saveSettings();

        const now = Date.now();
        if (now - state.lastSummaryLogAt >= 60000 && (
            summary.chatRemoved ||
            summary.visualRemoved ||
            summary.modalRemoved ||
            summary.storageRemoved
        )) {
            state.lastSummaryLogAt = now;
            logJson("[PERFORMANCE] summary", compact);
        }
    }

    function cleanupSweep(reason = "interval") {
        if (!state.running || state.cleanupInFlight) return;
        state.cleanupInFlight = true;
        try {
            const now = Date.now();
            ensureCss();
            const queued = cleanupQueuedNodes();
            const shouldChatCleanup = reason === "start" || now - state.lastChatCleanupAt >= CHAT_CLEANUP_INTERVAL_MS;
            const shouldFullSweep = reason === "start" || now - state.lastFullSweepAt >= FULL_SWEEP_INTERVAL_MS;
            const shouldStorageCleanup = reason === "start" || now - state.lastStorageCleanupAt >= STORAGE_CLEANUP_INTERVAL_MS;
            if (shouldChatCleanup) state.lastChatCleanupAt = now;
            if (shouldFullSweep) state.lastFullSweepAt = now;
            if (shouldStorageCleanup) state.lastStorageCleanupAt = now;
            const summary = {
                reason,
                chatRemoved: shouldChatCleanup ? trimChat() + removeSystemChatNoise() : 0,
                visualRemoved: queued.visualRemoved + (shouldFullSweep ? selectorSweep(document, CHEAP_VISUAL_SELECTORS) : 0),
                modalRemoved: queued.modalRemoved + (shouldFullSweep ? selectorSweep(document, MODAL_SELECTORS) : 0),
                storageRemoved: shouldStorageCleanup ? cleanupStorage() : 0
            };
            state.lastError = "";
            recordSummary(summary);
        } catch (error) {
            state.lastError = String(error && error.message ? error.message : error).slice(0, 180);
            logJson("[PERFORMANCE] error", { error: state.lastError, reason });
        } finally {
            state.cleanupInFlight = false;
            requestRender();
        }
    }

    function installObserver() {
        if (state.observer || !document.body) return;
        state.observer = new MutationObserver(mutations => {
            if (!state.running) return;
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (!node || node.nodeType !== 1) return;
                    if (state.queuedNodes.length < MAX_QUEUE) state.queuedNodes.push(node);
                });
            }
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
    }

    function start() {
        if (state.running) return;
        state.running = true;
        ctx.settings.performance.enabled = true;
        ctx.settings.performance.mode = "aggressive";
        ctx.settings.performance.cleanupIntervalMs = Math.max(5000, Number(ctx.settings.performance.cleanupIntervalMs || DEFAULTS.cleanupIntervalMs) || DEFAULTS.cleanupIntervalMs);
        savePerformanceSettings();
        ensureCss();
        installObserver();
        cleanupSweep("start");
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(() => cleanupSweep("interval"), ctx.settings.performance.cleanupIntervalMs);
        logJson("[PERFORMANCE] started", {
            mode: ctx.settings.performance.mode,
            chatMaxMessages: ctx.settings.performance.chatMaxMessages,
            cleanupIntervalMs: ctx.settings.performance.cleanupIntervalMs
        });
        requestRender();
    }

    function stop() {
        if (!state.running && !ctx.settings.performance.enabled) return;
        state.running = false;
        ctx.settings.performance.enabled = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        if (state.observer) state.observer.disconnect();
        state.observer = null;
        state.queuedNodes = [];
        removeCss();
        savePerformanceSettings();
        logJson("[PERFORMANCE] stopped", { totals: state.totals });
        requestRender();
    }

    function destroy() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        if (state.observer) state.observer.disconnect();
        state.observer = null;
        state.queuedNodes = [];
    }

    function autoStart() {
        if (ctx.settings.performance && ctx.settings.performance.enabled && !state.running) {
            start();
        }
    }

    function renderExtra() {
        const summary = ctx.settings.performance.lastCleanupSummary || {};
        const wrap = ctx.utils.el("div", {
            css: {
                display: "grid",
                gap: "6px",
                padding: "8px",
                border: "1px solid rgba(186,218,85,0.18)",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.14)",
                fontSize: "12px"
            }
        });
        wrap.appendChild(ctx.utils.el("div", {
            text: "Performans modu agresif temizlik yapar. Sorun olursa Durdur yeterli.",
            css: { opacity: "0.78" }
        }));
        wrap.appendChild(ctx.utils.el("div", {
            text: "Son: chat " + (summary.chatRemoved || 0) +
                " / efekt " + (summary.visualRemoved || 0) +
                " / panel " + (summary.modalRemoved || 0) +
                " / storage " + (summary.storageRemoved || 0)
        }));
        wrap.appendChild(ctx.utils.el("div", {
            text: "Toplam: chat " + state.totals.chatRemoved +
                " / efekt " + state.totals.visualRemoved +
                " / panel " + state.totals.modalRemoved +
                " / storage " + state.totals.storageRemoved
        }));
        if (state.lastError) {
            wrap.appendChild(ctx.utils.el("div", {
                text: "Hata: " + state.lastError,
                css: { color: "#ffb3b3" }
            }));
        }
        return wrap;
    }

    if (ctx.settings.performance.enabled) {
        setTimeout(autoStart, 500);
    }

    return {
        key: "performance",
        storageKey: null,
        label: "Performans İyileştirici",
        isRunning: () => state.running,
        start,
        stop,
        destroy,
        autoStart,
        renderExtra
    };
}


// ===== MODULE: GeneralAutoState.js =====
function createGeneralAutoDefaultSettings() {
    return {
        manualStopped: { spin: false, kiss: false, close: false },
        retList: {},
        lowScoreRetEnabled: false,
        lowScoreRetThreshold: 5000,
        forceRetAll: false,
        guardEnabled: false,
        performance: createGeneralAutoPerformanceDefaults()
    };
}

function createGeneralAutoFeatures(ctx, requestRender) {
    return [
        createGeneralAutoSpinFeature(ctx, requestRender),
        createGeneralAutoKissFeature(ctx, requestRender),
        createGeneralAutoCloseFeature(ctx, requestRender),
        createGeneralAutoGuardFeature(ctx, requestRender),
        createGeneralAutoPerformanceFeature(ctx, requestRender)
    ].filter(feature => ctx.featureVisible(feature.key));
}


// ===== MODULE: GeneralAuto.js =====
﻿function createAutoSpinModule(utils) {
    return {
        name: "autoSpinTab1",
        title: "Genel Auto",

        defaultSettings: createGeneralAutoDefaultSettings(),

        renderSettings(container) {
            try {
                if (typeof window.__KISS_GENERAL_AUTO_CLEANUP === "function") {
                    window.__KISS_GENERAL_AUTO_CLEANUP();
                }
            } catch (_) {}

            const ctx = createGeneralAutoSharedContext(utils, this);
            ctx.installRoomWatcher();

            const panel = utils.el("div", {
                css: {
                    display: "grid",
                    gap: "8px",
                    background: "#222",
                    color: "#bada55",
                    padding: "12px 18px",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    border: "2px solid #bada55",
                    boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                    whiteSpace: "pre-line"
                }
            });
            container.appendChild(panel);

            let features = [];
            let renderScheduled = false;

            function requestRender() {
                if (renderScheduled) return;
                renderScheduled = true;
                setTimeout(() => {
                    renderScheduled = false;
                    renderPanel();
                }, 0);
            }

            features = createGeneralAutoFeatures(ctx, requestRender);

            function featureRow(feature) {
                const running = feature.isRunning();
                const row = utils.el("div", {
                    css: {
                        marginBottom: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px"
                    }
                });
                const label = utils.el("span", {
                    html: `<strong>${feature.label}</strong>: ${running ? "Aktif" : "Pasif"}`
                });
                const button = utils.el("button", {
                    text: running ? "Durdur" : "Başlat",
                    css: { cursor: "pointer", marginLeft: "6px" }
                });
                button.addEventListener("click", () => {
                    if (running) {
                        feature.stop();
                        if (feature.storageKey) ctx.settings.manualStopped[feature.storageKey] = true;
                    } else {
                        if (feature.storageKey) ctx.settings.manualStopped[feature.storageKey] = false;
                        feature.start();
                    }
                    ctx.saveSettings();
                    requestRender();
                });
                row.append(label, button);
                return row;
            }

            function renderPanel() {
                panel.innerHTML = "";

                if (!features.length) {
                    panel.appendChild(utils.el("div", { text: "Açık otomasyon yok." }));
                    return;
                }

                const extras = [];
                features.forEach(feature => {
                    panel.appendChild(featureRow(feature));
                    if (typeof feature.renderExtra === "function") {
                        const extra = feature.renderExtra();
                        if (extra) extras.push(extra);
                    }
                });
                extras.forEach(extra => panel.appendChild(extra));
            }

            const autoStartTimer = setInterval(() => {
                features.forEach(feature => {
                    if (typeof feature.autoStart === "function") feature.autoStart();
                });
                requestRender();
            }, ctx.cfg.autoCheckInterval);

            try {
                window.__KISS_GENERAL_AUTO_CLEANUP = () => {
                    try { clearInterval(autoStartTimer); } catch (_) {}
                    try {
                        features.forEach(feature => {
                            if (feature && typeof feature.destroy === "function") feature.destroy();
                        });
                    } catch (_) {}
                };
            } catch (_) {}

            features.forEach(feature => {
                if (feature.storageKey && !ctx.settings.manualStopped[feature.storageKey]) feature.start();
                if (typeof feature.autoStart === "function") feature.autoStart();
            });
            renderPanel();
        }
    };
}


// ===== MODULE: AutoComboState.js =====
function createAutoComboDefaultSettings() {
    return {
        kicksPerCycle: 1,
        kickCycleSeconds: 1,
        savesPerCycle: 1,
        saveCycleSeconds: 1,
        kickList: {},
        saveList: [],
        hiddenSaveList: []
    };
}

function createAutoComboRuntimeState() {
    return {
        kickIntervals: {},
        saveIntervals: {},
        hiddenSaveIntervals: {},
        actionTimeouts: {},
        lastKnownRoomId: "",
        lastRoomWarnAt: 0,
        refreshTimer: null,
        refreshObserver: null,
        actionStats: {}
    };
}


// ===== MODULE: AutoComboApi.js =====
function createAutoComboApi(ctx) {
    const {
        runtimeState,
        safeNumber
    } = ctx;

    function getNumericCandidate(value) {
        const text = String(value || "").trim();
        return /^\d+$/.test(text) ? text : "";
    }

    function diagnosticEnabled() {
        try {
            return !!(window.__KISS_MODULE_SETTINGS && window.__KISS_MODULE_SETTINGS.diagnosticLog);
        } catch {
            return false;
        }
    }

    function rememberRoomId(value, source = "UNKNOWN") {
        const roomId = getNumericCandidate(value);

        if (roomId) {
            const changed = runtimeState.lastKnownRoomId !== roomId;
            runtimeState.lastKnownRoomId = roomId;
            const at = Date.now();

            try {
                window.__KISS_LAST_ROOM_ID = roomId;
                window.__KISS_LAST_ROOM_ID_AT = at;
            } catch {}
            try {
                localStorage.setItem("kiss_hidden_last_room_id", roomId);
                localStorage.setItem("kiss_hidden_last_room_id_at", String(at));
            } catch {}
            try {
                const provider = window.__KISS_GAME_STATE_PROVIDER__;
                if (provider && typeof provider.rememberRoomId === "function") provider.rememberRoomId(roomId);
            } catch {}

            if (changed && diagnosticEnabled()) console.log(`[AUTO COMBO ROOM UPDATED from ${source}]`, roomId);
        }

        return roomId;
    }

    function getRememberedRoomId() {
        try {
            const roomId = getNumericCandidate(localStorage.getItem("kiss_hidden_last_room_id"));
            const at = Number(localStorage.getItem("kiss_hidden_last_room_id_at") || 0);
            if (roomId && (!at || Date.now() - at <= 3 * 60 * 1000)) return roomId;
        } catch {
        }
        return "";
    }

    function readTopfaceRoomId() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = String(localStorage.key(i) || "");
                if (!key.startsWith("topface_stprev_room_id")) continue;
                const raw = localStorage.getItem(key);
                const direct = getNumericCandidate(raw);
                if (direct) return direct;
                try {
                    const parsed = JSON.parse(raw);
                    const nested = getNumericCandidate(parsed && parsed.data && parsed.data.value);
                    if (nested) return nested;
                } catch {}
            }
        } catch {}
        return "";
    }

    function readProviderRoomId() {
        try {
            const provider = window.__KISS_GAME_STATE_PROVIDER__;
            if (provider && typeof provider.getCurrentRoomId === "function") {
                return getNumericCandidate(provider.getCurrentRoomId());
            }
            if (provider && typeof provider.refresh === "function") {
                const snapshot = provider.refresh("auto-combo-room", { silent: true });
                return getNumericCandidate(snapshot && snapshot.roomId);
            }
        } catch {}
        return "";
    }

    function readDomRoomId() {
        try {
            const node = document.querySelector("[data-room-id],[data-roomid]");
            return getNumericCandidate(node && (node.getAttribute("data-room-id") || node.getAttribute("data-roomid")));
        } catch {}
        return "";
    }

    function getCurrentRoomId() {
        const roomId =
            getNumericCandidate(runtimeState.lastKnownRoomId) ||
            readProviderRoomId() ||
            getNumericCandidate(window.__KISS_LAST_ROOM_ID) ||
            getRememberedRoomId() ||
            readTopfaceRoomId() ||
            readDomRoomId();
        return roomId ? rememberRoomId(roomId, "CURRENT_ROOM") : "";
    }

    function resetRoomId() {
        try {
            localStorage.removeItem("kiss_hidden_last_room_id");
            localStorage.removeItem("kiss_hidden_last_room_id_at");
        } catch {}
        runtimeState.lastKnownRoomId = "";
    }

    function tryCaptureRoomFromJson(data, source = "JSON") {
        try {
            if (!data || typeof data !== "object") return "";

            const roomId =
                data.status?.room_id ||
                data.status?.roomId ||
                data.room_id ||
                data.roomId;

            if (roomId) {
                return rememberRoomId(roomId, source);
            }
        } catch {}

        return "";
    }

    async function refreshRoomIdFromStatus() {
        const runFetch = async () => {
            const res = await fetch("/api/room/get_status/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/javascript, */*; q=0.01"
                },
                body: new URLSearchParams({
                    userLocalTime: String(Math.floor(Date.now() / 1000)),
                    sessnew: ""
                }).toString(),
                cache: "no-store"
            });
            const data = await res.json().catch(() => null);
            return { res, data };
        };

        try {
            const scheduler = window.__KISS_API_SCHEDULER__;
            const scheduled = scheduler && typeof scheduler.request === "function"
                ? await scheduler.request({ key: "combo:get-status", type: "combo", priority: "follow", dedupeKey: true, replaceQueued: true, maxWaitMs: 3000 }, runFetch)
                : { ok: true, result: await runFetch() };
            if (!scheduled.ok || !scheduled.result) return "";
            return tryCaptureRoomFromJson(scheduled.result.data, "GET_STATUS") || getCurrentRoomId();
        } catch (error) {
            if (diagnosticEnabled()) {
                console.warn("[AUTO COMBO] get_status room refresh failed", String(error && error.message ? error.message : error).slice(0, 160));
            }
            return "";
        }
    }

    async function ensureRoomId() {
        return getCurrentRoomId() || await refreshRoomIdFromStatus();
    }

    function captureRoomIdFromBody(body, source = "BODY") {
        try {
            if (!body) return "";

            const text = typeof body === "string" ? body : body.toString?.();
            if (!text) return "";

            const params = new URLSearchParams(text);
            return rememberRoomId(params.get("roomId"), source);
        } catch {
            return "";
        }
    }

    function recordAction(label, result) {
        const now = Date.now();
        const key = String(label || "ACTION");
        const actionStats = runtimeState.actionStats;
        const stat = actionStats[key] || {
            sent: 0,
            ok: 0,
            failed: 0,
            lastStatus: 0,
            lastError: "",
            lastLogAt: 0
        };

        stat.sent += 1;
        if (result && result.ok) stat.ok += 1;
        else stat.failed += 1;
        stat.lastStatus = result && result.status || 0;
        stat.lastError = result && result.error || "";

        const hasProblem = !!(stat.lastError || !result || !result.ok);
        const shouldLog = now - stat.lastLogAt >= (hasProblem ? 30000 : 60000);
        if (shouldLog && (hasProblem || diagnosticEnabled())) {
            stat.lastLogAt = now;
            console.log("[AUTO COMBO] summary", {
                label: key,
                sent: stat.sent,
                ok: stat.ok,
                failed: stat.failed,
                roomId: getCurrentRoomId(),
                lastStatus: stat.lastStatus,
                error: stat.lastError || undefined
            });
            stat.sent = 0;
            stat.ok = 0;
            stat.failed = 0;
        }

        actionStats[key] = stat;
    }

    function installRoomWatcher() {
        if (window.__autoComboRoomWatcherInstalledFinal) return;
        window.__autoComboRoomWatcherInstalledFinal = true;

        const originalFetch = window.fetch;

        if (typeof originalFetch === "function") {
            window.fetch = function(input, init = {}) {
                const url = typeof input === "string" ? input : input?.url;

                try {
                    const urlText = String(url || "");

                    if (
                        urlText.includes("/ajax/product/kick/") ||
                        urlText.includes("/ajax/product/kicksave/")
                    ) {
                        captureRoomIdFromBody(init?.body, "REQUEST_BODY");
                    }
                } catch {}

                const promise = originalFetch.apply(this, arguments);

                try {
                    promise
                        .then(res => {
                            try {
                                const contentType = res.headers?.get?.("content-type") || "";
                                const urlText = String(url || "");

                                if (
                                    contentType.includes("application/json") ||
                                    urlText.includes("time") ||
                                    urlText.includes("room") ||
                                    urlText.includes("kick") ||
                                    urlText.includes("kicksave")
                                ) {
                                    res.clone().json()
                                        .then(data => {
                                            tryCaptureRoomFromJson(data, "FETCH_RESPONSE");
                                        })
                                        .catch(() => {});
                                }
                            } catch {}
                        })
                        .catch(() => {});
                } catch {}

                return promise;
            };
        }

        const OriginalXHR = window.XMLHttpRequest;

        if (typeof OriginalXHR === "function") {
            const originalOpen = OriginalXHR.prototype.open;
            const originalSend = OriginalXHR.prototype.send;

            OriginalXHR.prototype.open = function(method, url) {
                try {
                    this.__autoComboWatchUrl = String(url || "");
                } catch {}

                return originalOpen.apply(this, arguments);
            };

            OriginalXHR.prototype.send = function(body) {
                try {
                    const urlText = String(this.__autoComboWatchUrl || "");

                    if (
                        urlText.includes("/ajax/product/kick/") ||
                        urlText.includes("/ajax/product/kicksave/")
                    ) {
                        captureRoomIdFromBody(body, "XHR_BODY");
                    }

                    this.addEventListener("load", function() {
                        try {
                            const text = this.responseText;
                            if (!text || typeof text !== "string") return;

                            if (
                                text.includes("room_id") ||
                                text.includes("roomId")
                            ) {
                                const data = JSON.parse(text);
                                tryCaptureRoomFromJson(data, "XHR_RESPONSE");
                            }
                        } catch {}
                    });
                } catch {}

                return originalSend.apply(this, arguments);
            };
        }

        if (diagnosticEnabled()) console.log("[AUTO COMBO ROOM WATCHER] aktif.");
    }

    async function buildCommonBody(uid) {
        const roomId = await ensureRoomId();

        if (!roomId) {
            const now = Date.now();
            if (diagnosticEnabled() && now - runtimeState.lastRoomWarnAt > 60000) {
                runtimeState.lastRoomWarnAt = now;
                console.warn("[AUTO COMBO] roomId bulunamadı. time/ response henüz yakalanmamış olabilir.");
            }
            return null;
        }

        return new URLSearchParams({
            roomId: String(roomId),
            receiverId: String(uid),
            userLocalTime: String(Math.floor(Date.now() / 1000)),
            sessnew: ""
        });
    }

    async function postAction(url, uid, label) {
        uid = String(uid);

        const body = await buildCommonBody(uid);
        if (!body) return null;

        try {
            const runFetch = async () => {
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "application/json, text/javascript, */*; q=0.01"
                    },
                    body: body.toString(),
                    credentials: "same-origin",
                    cache: "no-store"
                });

                const data = await res.json().catch(() => null);
                return { res, data };
            };
            const scheduler = window.__KISS_API_SCHEDULER__;
            const scheduled = scheduler && typeof scheduler.request === "function"
                ? await scheduler.request({ key: "combo:" + label + ":" + uid, type: "combo", priority: "combo", dedupeKey: true, replaceQueued: true, maxWaitMs: 15000 }, runFetch)
                : { ok: true, result: await runFetch() };
            if (scheduled.skipped) {
                recordAction(label, { ok: true, status: 0, error: "" });
                return null;
            }
            if (!scheduled.ok) throw new Error(scheduled.error || "scheduler-failed");
            const res = scheduled.result.res;
            const data = scheduled.result.data;

            tryCaptureRoomFromJson(data, label);

            recordAction(label, {
                ok: !!res.ok,
                status: res.status,
                error: data && data.error ? String(data.error) : ""
            });

            return data;
        } catch (err) {
            recordAction(label, {
                ok: false,
                status: 0,
                error: String(err && err.message ? err.message : err).slice(0, 120)
            });
            return null;
        }
    }

    async function doKick(uid) {
        return postAction(
            "https://getkisskiss.com/ajax/product/kick/",
            uid,
            "KICK FETCH"
        );
    }

    async function doSave(uid) {
        return postAction(
            "https://getkisskiss.com/ajax/product/kicksave/",
            uid,
            "SAVE FETCH"
        );
    }

    async function doHiddenSave(uid) {
        return postAction(
            "https://getkisskiss.com/ajax/product/kicksave/",
            uid,
            "GİZLİ SAVE FETCH"
        );
    }

    return {
        installRoomWatcher,
        getCurrentRoomId,
        refreshRoomIdFromStatus,
        resetRoomId,
        doKick,
        doSave,
        doHiddenSave,
        safeNumber
    };
}


// ===== MODULE: AutoComboView.js =====
function createAutoComboView(ctx) {
    const {
        utils,
        container,
        settings: S,
        shorten,
        sameUid,
        ensureLists,
        saveNow,
        getPlayers,
        kickIntervals,
        saveIntervals,
        hiddenSaveIntervals,
        startKick,
        stopKick,
        startSave,
        stopSave,
        startHiddenSave,
        stopHiddenSave,
        clearSelections
    } = ctx;

    let listRoot = null;

    function addRow(opt, title, v1, cb1, v2, cb2) {
        const row = utils.el("div", {
            css: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6px",
                marginBottom: "6px"
            }
        });

        const input1 = utils.el("input", {
            attrs: { type: "number", min: "1", value: v1 },
            css: { width: "46px", textAlign: "center" }
        });

        input1.addEventListener("input", e => cb1(+e.target.value || 1));

        const input2 = utils.el("input", {
            attrs: { type: "number", min: "1", value: v2 },
            css: { width: "46px", textAlign: "center" }
        });

        input2.addEventListener("input", e => cb2(+e.target.value || 1));

        row.append(
            utils.el("label", {
                text: title,
                css: { width: "48px", opacity: 0.85 }
            }),

            utils.el("label", {
                text: "adet",
                css: { fontSize: "11px", opacity: 0.7 }
            }),

            input1,

            utils.el("label", {
                text: "sn",
                css: { fontSize: "11px", opacity: 0.7 }
            }),

            input2,
        );

        opt.append(row);
    }

    function refreshList() {
        ensureLists();
        if (!listRoot) return;

        const players = getPlayers();
        listRoot.innerHTML = "";

        if (!players.length) {
            listRoot.append(
                utils.el("div", {
                    text: "Oda boş…",
                    css: { opacity: 0.5, textAlign: "center", padding: "10px" }
                })
            );
            return;
        }

        players.forEach(p => {
            const uid = String(p.userId);

            const row = utils.el("div", {
                css: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                    gap: "6px",
                }
            });

            row.append(
                utils.el("span", {
                    text: shorten(p.name),
                    css: { flex: "1" }
                })
            );

            const isKickSaved = !!S.kickList[uid];
            const isKickRunning = !!kickIntervals[uid];

            if (isKickSaved && !isKickRunning) {
                startKick(uid);
            }

            const btnKick = utils.el("button", {
                text: kickIntervals[uid] ? "K.DUR" : "KICK",
                css: { minWidth: "60px", fontSize: "11px" }
            });

            btnKick.style.backgroundColor = kickIntervals[uid] ? "#d32f2f" : "#388e3c";

            btnKick.onclick = () => {
                kickIntervals[uid] ? stopKick(uid) : startKick(uid);
                refreshList();
            };

            row.append(btnKick);

            const isSaveSaved = S.saveList.some(x => sameUid(x, uid));
            const isSaveRunning = !!saveIntervals[uid];

            if (isSaveSaved && !isSaveRunning) {
                startSave(uid);
            }

            const btnSave = utils.el("button", {
                text: saveIntervals[uid] ? "S.DUR" : "SAVE",
                css: { minWidth: "60px", fontSize: "11px" }
            });

            btnSave.style.backgroundColor = saveIntervals[uid] ? "#d32f2f" : "#1976d2";

            btnSave.onclick = () => {
                saveIntervals[uid] ? stopSave(uid) : startSave(uid);
                refreshList();
            };

            row.append(btnSave);

            const isHiddenSaved = S.hiddenSaveList.some(x => sameUid(x, uid));
            const isHiddenRunning = !!hiddenSaveIntervals[uid];

            if (isHiddenSaved && !isHiddenRunning) {
                startHiddenSave(uid);
            }

            const btnHiddenSave = utils.el("button", {
                text: hiddenSaveIntervals[uid] ? "G.DUR" : "GİZLİ",
                css: { minWidth: "60px", fontSize: "11px" }
            });

            btnHiddenSave.style.backgroundColor = hiddenSaveIntervals[uid] ? "#d32f2f" : "#6a1b9a";

            btnHiddenSave.onclick = () => {
                hiddenSaveIntervals[uid] ? stopHiddenSave(uid) : startHiddenSave(uid);
                refreshList();
            };

            row.append(btnHiddenSave);

            listRoot.append(row);
        });
    }

    function mount() {
        const opt = utils.el("div", {
            css: {
                marginBottom: "12px",
                padding: "6px",
                border: "1px solid #444",
                borderRadius: "6px",
                background: "#1115"
            }
        });
        container.append(opt);

        addRow(
            opt,
            "Kick",
            S.kicksPerCycle,
            v => { S.kicksPerCycle = v; saveNow(); },
            S.kickCycleSeconds,
            v => { S.kickCycleSeconds = v; saveNow(); },
        );

        addRow(
            opt,
            "Save",
            S.savesPerCycle,
            v => { S.savesPerCycle = v; saveNow(); },
            S.saveCycleSeconds,
            v => { S.saveCycleSeconds = v; saveNow(); },
        );

        listRoot = utils.el("div", {
            css: {
                maxHeight: "540px",
                overflowY: "auto",
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "4px"
            }
        });
        container.append(listRoot);

        const clearBtn = utils.el("button", {
            text: "Seçimleri temizle",
            css: {
                background: "#b11",
                color: "#fff",
                width: "100%",
                marginTop: "6px",
                padding: "6px",
                borderRadius: "4px",
            }
        });

        clearBtn.onclick = () => {
            clearSelections();
            refreshList();
        };

        container.append(clearBtn);
        refreshList();
    }

    return {
        mount,
        refreshList
    };
}


// ===== MODULE: IdRoomFollowerState.js =====
function createIdRoomFollowerDefaultSettings() {
    return {
        savedUsers: [],
        intervalSeconds: 10,
        activeFollowId: "",
        roomLock: createIdRoomFollowerRoomLockState()
    };
}

function createIdRoomFollowerRoomLockState() {
    return {
        active: false,
        roomId: "",
        anchors: [],
        startedAt: 0,
        lockedAt: 0,
        missingSince: 0,
        lastInRoomAt: 0,
        attempts: 0,
        anchorRefreshedAt: 0,
        lastAnchorLogAt: 0
    };
}

function createIdRoomFollowerConfig() {
    return {
        RECENT_EXIT_WINDOW_MS: 30000,
        ROOM_LOCK_INTERVAL_MS: 10000,
        ROOM_LOCK_ANCHOR_REFRESH_MS: 30000,
        ROOM_LOCK_MAX_MS: 10 * 60 * 1000
    };
}


// ===== MODULE: IdRoomFollowerApi.js =====
function createIdRoomFollowerApi(ctx) {
    const {
        accountId,
        nowSeconds
    } = ctx;

    function emitFollowEvent(targetUserId, status, extra = {}) {
        try {
            console.log("__KISS_FOLLOW_EVENT__" + JSON.stringify(Object.assign({
                accountId,
                targetUserId: String(targetUserId || ""),
                status,
                at: Date.now()
            }, extra)));
        } catch (_) {}
    }

    async function readTargetQueueState(id) {
        const targetId = String(id || "");
        try {
            window.__KISS_FOLLOW_QUEUE_STATE = window.__KISS_FOLLOW_QUEUE_STATE || {};
            delete window.__KISS_FOLLOW_QUEUE_STATE[targetId];
            emitFollowEvent(targetId, "check_target");

            const start = Date.now();
            while (Date.now() - start < 900) {
                const cached = window.__KISS_FOLLOW_QUEUE_STATE && window.__KISS_FOLLOW_QUEUE_STATE[targetId];
                if (cached && cached.state && Date.now() - Number(cached.at || 0) < 3000) {
                    return cached.state;
                }
                await new Promise(resolve => setTimeout(resolve, 75));
            }

            return { found: false, disabled: false, reason: "bridge-timeout" };
        } catch (_) {
            return { found: false, disabled: false, reason: "bridge-error" };
        }
    }

    async function tryGoById(id) {
        function rememberRoomId(value) {
            const roomId = String(value || "").trim();
            if (!/^\d+$/.test(roomId) || roomId === "0") return "";
            const at = Date.now();
            try {
                const provider = window.__KISS_GAME_STATE_PROVIDER__;
                if (provider && typeof provider.rememberRoomId === "function") provider.rememberRoomId(roomId, {
                    source: "sit_down_to_friend.response",
                    confidence: "high"
                });
            } catch (_) {}
            try {
                window.__KISS_LAST_ROOM_ID = roomId;
                window.__KISS_LAST_ROOM_ID_AT = at;
                window.__KISS_LAST_ROOM_SOURCE = "sit_down_to_friend.response";
                window.__KISS_LAST_ROOM_SOURCE_RANK = 450;
            } catch (_) {}
            try {
                localStorage.setItem("kiss_hidden_last_room_id", roomId);
                localStorage.setItem("kiss_hidden_last_room_id_at", String(at));
                localStorage.setItem("kiss_hidden_last_room_source", "sit_down_to_friend.response");
                localStorage.setItem("kiss_hidden_last_room_source_rank", "450");
            } catch (_) {}
            return roomId;
        }

        function captureRoomFromJson(data) {
            try {
                if (!data || typeof data !== "object") return "";
                const roomId = data.status && (data.status.room_id || data.status.roomId) || data.room_id || data.roomId;
                return rememberRoomId(roomId);
            } catch (_) {
                return "";
            }
        }

        const runFetch = async () => {
            const res = await fetch("/api/room/sit_down_to_friend", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/javascript, */*; q=0.01"
                },
                body: new URLSearchParams({
                    friend_id: String(id),
                    userLocalTime: nowSeconds(),
                    sessnew: ""
                })
            });
            const data = await res.json().catch(() => null);
            captureRoomFromJson(data);
            return data;
        };

        const scheduler = window.__KISS_API_SCHEDULER__;
        const scheduled = scheduler && typeof scheduler.request === "function"
            ? await scheduler.request({ key: "id-follow:sit-down", type: "follow", priority: "follow", dedupeKey: true, replaceQueued: true, maxWaitMs: 8000 }, runFetch)
            : { ok: true, result: await runFetch() };
        if (!scheduled.ok) {
            return { result: false, error: scheduled.error || scheduled.skipped || "scheduler-failed" };
        }
        return scheduled.result;
    }

    return {
        emitFollowEvent,
        readTargetQueueState,
        tryGoById
    };
}


// ===== MODULE: IdRoomFollowerHelpers.js =====
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


// ===== MODULE: IdRoomFollowerRoomLock.js =====
function createIdRoomFollowerRoomLock(ctx) {
    const {
        settings,
        config,
        saveNow,
        normalizeRoomId,
        getKnownRoomId,
        getGameState,
        getNumericCandidate,
        readRoomLockAnchors,
        sameAnchorUids,
        tryGoById,
        logJson,
        setStatus,
        setRoomLockLine,
        renderRoomLock,
        getActiveFollowId,
        getSettingsActiveFollowId
    } = ctx;

    const {
        ROOM_LOCK_INTERVAL_MS,
        ROOM_LOCK_ANCHOR_REFRESH_MS,
        ROOM_LOCK_MAX_MS
    } = config;

    let roomLockTimer = null;
    let roomLockResumeTimer = null;
    let roomLockChecking = false;

    function logRoomLock(kind, payload = {}) {
        const lock = settings.roomLock || {};
        const now = Date.now();
        logJson("[ROOM LOCK] " + kind, Object.assign({
            lockedRoomId: lock.roomId || "",
            missingMs: lock.missingSince ? now - Number(lock.missingSince || 0) : 0,
            lockedMs: lock.lockedAt ? now - Number(lock.lockedAt || 0) : 0
        }, payload));
    }

    function normalizeRoomLockState() {
        if (!settings.roomLock || typeof settings.roomLock !== "object") {
            settings.roomLock = createIdRoomFollowerRoomLockState();
        }
        settings.roomLock.roomId = normalizeRoomId(settings.roomLock.roomId);
        settings.roomLock.anchors = Array.isArray(settings.roomLock.anchors) ? settings.roomLock.anchors : [];
        settings.roomLock.startedAt = Number(settings.roomLock.startedAt || 0) || 0;
        settings.roomLock.lockedAt = Number(settings.roomLock.lockedAt || settings.roomLock.startedAt || 0) || 0;
        settings.roomLock.missingSince = Number(settings.roomLock.missingSince || 0) || 0;
        settings.roomLock.lastInRoomAt = Number(settings.roomLock.lastInRoomAt || 0) || 0;
        settings.roomLock.attempts = Number(settings.roomLock.attempts || 0) || 0;
        settings.roomLock.anchorRefreshedAt = Number(settings.roomLock.anchorRefreshedAt || 0) || 0;
        settings.roomLock.lastAnchorLogAt = Number(settings.roomLock.lastAnchorLogAt || 0) || 0;
    }

    function refreshRoomLockAnchors(lock, reason = "interval") {
        if (!lock || !lock.active) return false;
        const now = Date.now();
        if (now - Number(lock.anchorRefreshedAt || 0) < ROOM_LOCK_ANCHOR_REFRESH_MS) return false;

        const stateNow = getGameState("room-lock-refresh");
        const currentRoomId = normalizeRoomId(stateNow.roomId) || getKnownRoomId();
        const href = String(location.href || "");
        if (!currentRoomId || currentRoomId !== lock.roomId || href.includes("=undefined")) return false;
        if (!stateNow.authUserId || !stateNow.ownPresent) return false;

        const anchors = readRoomLockAnchors(lock.roomId);
        lock.anchorRefreshedAt = now;
        if (!anchors.length) {
            saveNow();
            if (!Array.isArray(lock.anchors) || !lock.anchors.length) {
                logRoomLock("anchor-refresh-empty", { reason, currentRoomId });
            }
            return false;
        }

        const changed = !sameAnchorUids(lock.anchors, anchors);
        lock.anchors = anchors;
        saveNow();
        if (changed) {
            const lastLogAt = Number(lock.lastAnchorLogAt || 0);
            if (now - lastLogAt < 60000) return true;
            lock.lastAnchorLogAt = now;
            saveNow();
            logRoomLock("anchors-refreshed", {
                reason,
                anchorCount: anchors.length,
                anchors: anchors.map(anchor => ({ uid: anchor.uid, score: anchor.score }))
            });
        }
        return true;
    }

    function stopRoomLock(reason = "stopped") {
        if (roomLockTimer) clearInterval(roomLockTimer);
        roomLockTimer = null;
        roomLockChecking = false;
        if (settings.roomLock.active) {
            logRoomLock(reason === "expired" ? "expired" : "stopped", { reason });
        }
        settings.roomLock = createIdRoomFollowerRoomLockState();
        saveNow();
        setStatus(reason === "expired" ? "Odaya 10 dakika donulemedigi icin oda kilidi iptal edildi." : "Oda kilidi kapatildi.");
        renderRoomLock();
    }

    async function checkRoomLock() {
        const lock = settings.roomLock;
        if (!lock || !lock.active || roomLockChecking) return;
        roomLockChecking = true;

        try {
            const now = Date.now();
            const knownRoomId = getKnownRoomId();
            const href = String(location.href || "");
            const isUndefinedRoute = href.includes("=undefined");
            if (knownRoomId && knownRoomId === lock.roomId && !isUndefinedRoute) {
                lock.missingSince = 0;
                lock.lastInRoomAt = now;
                lock.attempts = 0;
                saveNow();
                refreshRoomLockAnchors(lock, "still-in-room");
                setRoomLockLine("Oda kilidi aktif: " + lock.roomId + " / odadasin.");
                return;
            }

            if (!lock.missingSince) {
                lock.missingSince = now;
                saveNow();
                logRoomLock("missing-started", { currentRoomId: knownRoomId, href: href.slice(0, 120) });
            } else if (now - Number(lock.missingSince || 0) > ROOM_LOCK_MAX_MS) {
                stopRoomLock("expired");
                return;
            }

            const anchors = Array.isArray(lock.anchors) ? lock.anchors : [];
            if (!anchors.length) {
                logRoomLock("blocked", { reason: "missing-anchor" });
                return;
            }

            lock.attempts = Number(lock.attempts || 0) + 1;
            saveNow();

            for (const anchor of anchors) {
                const anchorUid = getNumericCandidate(anchor && anchor.uid);
                if (!anchorUid) continue;
                logRoomLock("retry", {
                    anchorUid,
                    attempt: lock.attempts,
                    currentRoomId: knownRoomId,
                    href: href.slice(0, 120)
                });
                const data = await tryGoById(anchorUid);
                const responseRoomId = normalizeRoomId(data?.status?.room_id || data?.status?.roomId || data?.room_id || data?.roomId);
                const ok = !!(data && data.result && responseRoomId === lock.roomId);

                if (ok) {
                    logRoomLock("success", { anchorUid, attempt: lock.attempts, responseRoomId });
                    setRoomLockLine("Kilitli oda yakalandi: " + lock.roomId);
                    lock.missingSince = 0;
                    lock.lastInRoomAt = Date.now();
                    lock.attempts = 0;
                    lock.anchorRefreshedAt = 0;
                    saveNow();
                    location.href = "/game/room?";
                    return;
                }
            }

            setRoomLockLine("Oda kilidi aktif: " + lock.roomId + " / deneme " + lock.attempts);
        } catch (error) {
            logRoomLock("blocked", {
                reason: "error",
                error: String(error && error.message ? error.message : error).slice(0, 160)
            });
        } finally {
            roomLockChecking = false;
            renderRoomLock();
        }
    }

    async function startRoomLock() {
        if (getActiveFollowId() || getSettingsActiveFollowId()) {
            setStatus("Once oyuncu takibini birakin.");
            return;
        }

        const roomId = getKnownRoomId();
        if (!roomId) {
            setStatus("Oda kilidi icin gecerli room id bulunamadi.");
            return;
        }

        const anchors = readRoomLockAnchors(roomId);
        if (!anchors.length) {
            setStatus("Oda kilidi icin uygun dis oyuncu bulunamadi.");
            logRoomLock("blocked", { reason: "missing-anchor", lockedRoomId: roomId });
            return;
        }

        settings.roomLock = {
            active: true,
            roomId,
            anchors,
            startedAt: Date.now(),
            lockedAt: Date.now(),
            missingSince: 0,
            lastInRoomAt: Date.now(),
            attempts: 0,
            anchorRefreshedAt: Date.now(),
            lastAnchorLogAt: 0
        };
        saveNow();
        logRoomLock("started", {
            anchorCount: anchors.length,
            anchors: anchors.map(anchor => ({ uid: anchor.uid, score: anchor.score }))
        });
        setStatus("Oda kilitlendi: " + roomId);
        renderRoomLock();
        if (roomLockTimer) clearInterval(roomLockTimer);
        roomLockTimer = setInterval(checkRoomLock, ROOM_LOCK_INTERVAL_MS);
    }

    function resumeRoomLock() {
        if (settings.roomLock && settings.roomLock.active) {
            if (roomLockTimer) clearInterval(roomLockTimer);
            roomLockTimer = setInterval(checkRoomLock, ROOM_LOCK_INTERVAL_MS);
            if (roomLockResumeTimer) clearTimeout(roomLockResumeTimer);
            roomLockResumeTimer = setTimeout(() => {
                roomLockResumeTimer = null;
                checkRoomLock();
            }, 800);
        }
    }

    function destroyRoomLock() {
        if (roomLockTimer) clearInterval(roomLockTimer);
        if (roomLockResumeTimer) clearTimeout(roomLockResumeTimer);
        roomLockTimer = null;
        roomLockResumeTimer = null;
        roomLockChecking = false;
    }

    normalizeRoomLockState();

    return {
        startRoomLock,
        stopRoomLock,
        checkRoomLock,
        resumeRoomLock,
        destroyRoomLock,
        logRoomLock,
        normalizeRoomLockState
    };
}


// ===== MODULE: IdRoomFollowerView.js =====
function createIdRoomFollowerView(ctx) {
    const {
        utils,
        container,
        settings,
        getLoadedUsers,
        setLoadedUsers,
        uniqueUsers,
        sameId,
        getActiveFollowId,
        getRoomUsers,
        addSavedUser,
        removeSavedUser,
        startFollow,
        stopFollow,
        startRoomLock,
        stopRoomLock,
        saveNow
    } = ctx;

    let statusLine = null;
    let loadedList = null;
    let savedList = null;
    let roomLockBox = null;
    let roomLockLine = null;

    function button(text, onClick, extraCss = {}) {
        const btn = utils.el("button", {
            text,
            css: Object.assign({
                cursor: "pointer",
                padding: "5px 7px",
                border: "1px solid #444",
                borderRadius: "4px",
                background: "#333",
                color: "#e6ffb3",
                fontSize: "11px",
                whiteSpace: "nowrap"
            }, extraCss)
        });
        btn.addEventListener("click", onClick);
        return btn;
    }

    function setStatus(text) {
        if (statusLine) statusLine.textContent = String(text || "");
    }

    function setRoomLockLine(text) {
        if (roomLockLine) roomLockLine.textContent = String(text || "");
    }

    function userRow(user, mode) {
        const row = utils.el("div", {
            css: {
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: "6px",
                padding: "6px",
                marginBottom: "4px",
                border: "1px solid #333",
                borderRadius: "6px",
                background: "#161616"
            }
        });

        const info = utils.el("div", { css: { minWidth: "0" } });
        info.append(
            utils.el("div", {
                text: user.name,
                css: {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#fff"
                }
            })
        );

        const actions = utils.el("div", {
            css: { display: "flex", gap: "4px", alignItems: "center" }
        });

        if (mode === "loaded") {
            actions.append(button("Kaydet", () => {
                addSavedUser(user);
                renderSavedUsers();
                setStatus("Kaydedildi: " + user.name);
            }, { background: "#28502d" }));
        } else {
            const isActive = sameId(getActiveFollowId(), user.id);
            actions.append(
                button(isActive ? "Dur" : "Takip", () => {
                    if (isActive) stopFollow();
                    else startFollow(user.id);
                }, { background: isActive ? "#8a2020" : "#244d82" }),
                button("Sil", () => removeSavedUser(user.id), { background: "#5a2222" })
            );
        }

        row.append(info, actions);
        return row;
    }

    function renderLoadedUsers() {
        if (!loadedList) return;
        const loadedUsers = getLoadedUsers();
        loadedList.innerHTML = "";
        if (!loadedUsers.length) {
            loadedList.appendChild(utils.el("div", {
                text: "Henuz oyuncu yuklenmedi.",
                css: { opacity: "0.65", textAlign: "center", padding: "8px" }
            }));
            return;
        }

        loadedUsers.forEach(user => loadedList.appendChild(userRow(user, "loaded")));
    }

    function renderSavedUsers() {
        if (!savedList) return;
        savedList.innerHTML = "";
        const saved = uniqueUsers(settings.savedUsers);
        settings.savedUsers = saved;

        if (!saved.length) {
            savedList.appendChild(utils.el("div", {
                text: "Kaydedilen oyuncu yok.",
                css: { opacity: "0.65", textAlign: "center", padding: "8px" }
            }));
            return;
        }

        saved.forEach(user => savedList.appendChild(userRow(user, "saved")));
    }

    function renderRoomLock() {
        if (!roomLockBox || !roomLockLine) return;
        roomLockBox.innerHTML = "";
        const lock = settings.roomLock || {};
        const active = !!lock.active;
        const anchors = Array.isArray(lock.anchors) ? lock.anchors : [];

        roomLockBox.append(
            utils.el("div", {
                text: active
                    ? "Kilitli oda: " + (lock.roomId || "-") + " / anchor: " + anchors.length
                    : "Oda kilidi kapali.",
                css: { fontSize: "12px", opacity: "0.85" }
            }),
            button(active ? "Oda Kilidini Kapat" : "Odayi Kilitle", () => {
                if (active) stopRoomLock("manual");
                else startRoomLock();
            }, {
                width: "100%",
                marginTop: "5px",
                background: active ? "#7a2a2a" : "#2c4e77"
            })
        );

        roomLockLine.textContent = active
            ? (lock.missingSince ? "Odaya donus deneniyor." : "Odadaysa sure islemez; dusunce 10 dk denenir.")
            : "Bulundugun oda ve guvenilir dis oyuncular saklanir.";
    }

    function renderAll() {
        renderLoadedUsers();
        renderSavedUsers();
        renderRoomLock();
    }

    function mount() {
        container.innerHTML = "";

        const root = utils.el("div", {
            css: {
                display: "grid",
                gap: "8px",
                color: "#e6ffb3",
                fontFamily: "monospace"
            }
        });

        const loadBtn = button("Oyunculari Yukle", () => {
            const users = getRoomUsers();
            setLoadedUsers(users);
            renderLoadedUsers();
            setStatus(users.length ? users.length + " oyuncu yuklendi." : "Masada oyuncu bulunamadi.");
        }, { width: "100%", background: "#333" });

        statusLine = utils.el("div", {
            text: "Hazir.",
            css: {
                minHeight: "18px",
                fontSize: "12px",
                opacity: "0.85"
            }
        });

        const loadedTitle = utils.el("div", { text: "Masadaki oyuncular", css: { fontWeight: "bold" } });
        loadedList = utils.el("div", {
            css: {
                maxHeight: "210px",
                overflowY: "auto",
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "4px",
                background: "#111"
            }
        });

        const savedHeader = utils.el("div", {
            css: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "6px"
            }
        });
        savedHeader.append(
            utils.el("div", { text: "Kaydedilenler", css: { fontWeight: "bold" } }),
            button("Tumu Sil", () => {
                stopFollow();
                settings.savedUsers = [];
                saveNow();
                renderSavedUsers();
                setStatus("Kaydedilenler temizlendi.");
            }, { background: "#5a2222" })
        );

        savedList = utils.el("div", {
            css: {
                maxHeight: "260px",
                overflowY: "auto",
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "4px",
                background: "#111"
            }
        });

        const roomLockTitle = utils.el("div", {
            text: "Oda Kilidi",
            css: { fontWeight: "bold" }
        });
        roomLockBox = utils.el("div", {
            css: {
                border: "1px solid #333",
                borderRadius: "6px",
                padding: "6px",
                background: "#111",
                display: "grid",
                gap: "4px"
            }
        });
        roomLockLine = utils.el("div", {
            css: {
                minHeight: "16px",
                fontSize: "11px",
                opacity: "0.75"
            }
        });

        root.append(statusLine, loadedTitle, loadedList, loadBtn, savedHeader, savedList, roomLockTitle, roomLockBox, roomLockLine);
        container.appendChild(root);

        renderAll();
    }

    return {
        mount,
        setStatus,
        setRoomLockLine,
        renderLoadedUsers,
        renderSavedUsers,
        renderRoomLock,
        renderAll
    };
}


// ===== MODULE: AutoCombo.js =====
function createAutoComboModule(utils) {
    return {
        name: "autoCombo",
        title: "Kick + Save",

        defaultSettings: createAutoComboDefaultSettings(),

        renderSettings(container) {
            try {
                if (typeof window.__KISS_AUTO_COMBO_CLEANUP === "function") {
                    window.__KISS_AUTO_COMBO_CLEANUP();
                }
            } catch (_) {}

            const S = utils.loadSettings(this.name, this.defaultSettings);
            container.innerHTML = "";

            if (!S.kickList || typeof S.kickList !== "object") S.kickList = {};
            if (!Array.isArray(S.saveList)) S.saveList = [];
            if (!Array.isArray(S.hiddenSaveList)) S.hiddenSaveList = [];

            /* HELPERS */
            const shorten = n => n?.length > 8 ? n.slice(0, 8) + "…" : n;
            const saveNow = () => utils.saveSettings(this.name, S);

            function sameUid(a, b) {
                return String(a) === String(b);
            }

            function ensureLists() {
                if (!S.kickList || typeof S.kickList !== "object") S.kickList = {};
                if (!Array.isArray(S.saveList)) S.saveList = [];
                if (!Array.isArray(S.hiddenSaveList)) S.hiddenSaveList = [];
            }

            function safeNumber(value, fallback = 1) {
                const n = Number(value);
                return Number.isFinite(n) && n > 0 ? n : fallback;
            }

            function diagnosticEnabled() {
                try {
                    return !!(window.__KISS_MODULE_SETTINGS && window.__KISS_MODULE_SETTINGS.diagnosticLog);
                } catch {
                    return false;
                }
            }

            function comboLog() {
                if (!diagnosticEnabled()) return;
                try {
                    console.log.apply(console, arguments);
                } catch (_) {}
            }

            /* ========================= PLAYERS ========================= */
            function getPlayers() {
                try {
                    const provider = window.__KISS_GAME_STATE_PROVIDER__;
                    if (provider && typeof provider.refresh === "function") {
                        const snapshot = provider.refresh("auto-combo-players", { force: true, silent: true });
                        const tablePlayers = Array.isArray(snapshot && snapshot.tablePlayers) ? snapshot.tablePlayers : [];
                        const fromProvider = tablePlayers
                            .map(player => ({
                                userId: String(player.uid || player.userId || player.id || ""),
                                name: String(player.name || player.uid || player.userId || player.id || "?")
                            }))
                            .filter(player => /^\d+$/.test(player.userId));
                        if (fromProvider.length) return fromProvider;
                    }

                    const links = document.querySelectorAll(".player__name__link");
                    if (!links?.length) return [];

                    return [...links]
                        .map(el => {
                            const userId =
                                el.getAttribute("data-uid") ||
                                el.closest("[data-uid]")?.getAttribute("data-uid");

                            const name =
                                el.getAttribute("data-name") ||
                                el.textContent?.trim() ||
                                "?";

                            return userId ? { userId: String(userId), name } : null;
                        })
                        .filter(Boolean);
                } catch {
                    return [];
                }
            }

            /* ========================= STORAGE ========================= */
            const runtimeState = window.__KISS_AUTO_COMBO_RUNTIME_STATE || createAutoComboRuntimeState();
            window.__KISS_AUTO_COMBO_RUNTIME_STATE = runtimeState;
            if (!runtimeState.kickIntervals || typeof runtimeState.kickIntervals !== "object") runtimeState.kickIntervals = {};
            if (!runtimeState.saveIntervals || typeof runtimeState.saveIntervals !== "object") runtimeState.saveIntervals = {};
            if (!runtimeState.hiddenSaveIntervals || typeof runtimeState.hiddenSaveIntervals !== "object") runtimeState.hiddenSaveIntervals = {};
            if (!runtimeState.actionTimeouts || typeof runtimeState.actionTimeouts !== "object") runtimeState.actionTimeouts = {};
            if (!runtimeState.actionStats || typeof runtimeState.actionStats !== "object") runtimeState.actionStats = {};
            runtimeState.lastKnownRoomId = String(runtimeState.lastKnownRoomId || "");
            runtimeState.lastRoomWarnAt = Number(runtimeState.lastRoomWarnAt || 0) || 0;
            if (runtimeState.refreshTimer) {
                clearTimeout(runtimeState.refreshTimer);
                runtimeState.refreshTimer = null;
            }
            if (runtimeState.refreshObserver) {
                try { runtimeState.refreshObserver.disconnect(); } catch (_) {}
                runtimeState.refreshObserver = null;
            }
            Object.keys(runtimeState.kickIntervals).forEach(uid => {
                clearInterval(runtimeState.kickIntervals[uid]);
                delete runtimeState.kickIntervals[uid];
            });
            Object.keys(runtimeState.saveIntervals).forEach(uid => {
                clearInterval(runtimeState.saveIntervals[uid]);
                delete runtimeState.saveIntervals[uid];
            });
            Object.keys(runtimeState.hiddenSaveIntervals).forEach(uid => {
                clearInterval(runtimeState.hiddenSaveIntervals[uid]);
                delete runtimeState.hiddenSaveIntervals[uid];
            });
            Object.keys(runtimeState.actionTimeouts).forEach(key => {
                clearTimeout(runtimeState.actionTimeouts[key]);
                delete runtimeState.actionTimeouts[key];
            });
            const kickIntervals = runtimeState.kickIntervals;
            const saveIntervals = runtimeState.saveIntervals;
            const hiddenSaveIntervals = runtimeState.hiddenSaveIntervals;
            const comboApi = createAutoComboApi({ runtimeState, safeNumber });
            comboApi.installRoomWatcher();

            function scheduleAction(uid, kind, delayMs, action) {
                const key = kind + ":" + uid + ":" + Date.now() + ":" + Math.random();
                runtimeState.actionTimeouts[key] = setTimeout(() => {
                    delete runtimeState.actionTimeouts[key];
                    action();
                }, Math.max(0, Number(delayMs) || 0));
            }

            /* ========================= KICK FETCH ========================= */
            async function doKick(uid) {
                return comboApi.doKick(uid);
            }

            function runKickCycle(uid) {
                uid = String(uid);

                const count = Math.max(1, safeNumber(S.kicksPerCycle, 1));
                const gap = Math.max(100, Math.floor(1000 / count));

                for (let i = 0; i < count; i++) {
                    scheduleAction(uid, "kick", i * gap, () => doKick(uid));
                }
            }

            function startKick(uid) {
                uid = String(uid);

                stopKick(uid, true);

                S.kickList[uid] = true;
                saveNow();

                // Basar basmaz anlık çalışır
                runKickCycle(uid);

                // Sonra Kick saniyesine bağlı devam eder
                kickIntervals[uid] = setInterval(() => {
                    runKickCycle(uid);
                }, Math.max(1, safeNumber(S.kickCycleSeconds, 1)) * 1000);

                comboLog("[KICK START]", uid);
            }

            function stopKick(uid, keepSaved = false) {
                uid = String(uid);

                clearInterval(kickIntervals[uid]);
                delete kickIntervals[uid];

                if (!keepSaved) {
                    delete S.kickList[uid];
                    saveNow();
                }

                comboLog("[KICK STOP]", uid, { keepSaved });
            }

            /* ========================= SAVE FETCH ========================= */
            async function doSave(uid) {
                return comboApi.doSave(uid);
            }

            function runSaveCycle(uid) {
                uid = String(uid);

                const count = Math.max(1, safeNumber(S.savesPerCycle, 1));
                const gap = Math.max(100, Math.floor(1000 / count));

                for (let i = 0; i < count; i++) {
                    scheduleAction(uid, "save", i * gap, () => doSave(uid));
                }
            }

            function startSave(uid) {
                uid = String(uid);

                stopSave(uid, true);

                if (!S.saveList.some(x => sameUid(x, uid))) {
                    S.saveList.push(uid);
                }

                saveNow();

                // Basar basmaz anlık çalışır
                runSaveCycle(uid);

                // Sonra Save saniyesine bağlı devam eder
                saveIntervals[uid] = setInterval(() => {
                    runSaveCycle(uid);
                }, Math.max(1, safeNumber(S.saveCycleSeconds, 1)) * 1000);

                comboLog("[SAVE START]", uid);
            }

            function stopSave(uid, keepSaved = false) {
                uid = String(uid);

                clearInterval(saveIntervals[uid]);
                delete saveIntervals[uid];

                if (!keepSaved) {
                    S.saveList = S.saveList.filter(x => !sameUid(x, uid));
                    saveNow();
                }

                comboLog("[SAVE STOP]", uid, { keepSaved });
            }

            /* ========================= GİZLİ SAVE FETCH ========================= */
            async function doHiddenSave(uid) {
                return comboApi.doHiddenSave(uid);
            }

            function startHiddenSave(uid) {
                uid = String(uid);

                stopHiddenSave(uid, true);

                ensureLists();

                if (!S.hiddenSaveList.some(x => sameUid(x, uid))) {
                    S.hiddenSaveList.push(uid);
                }

                saveNow();

                // Basar basmaz anlık çalışır
                doHiddenSave(uid);

                // GİZLİ normal Save timerından bağımsızdır
                hiddenSaveIntervals[uid] = setInterval(() => {
                    doHiddenSave(uid);
                }, 10000);

                comboLog("[GİZLİ SAVE START]", uid);
            }

            function stopHiddenSave(uid, keepSaved = false) {
                uid = String(uid);

                clearInterval(hiddenSaveIntervals[uid]);
                delete hiddenSaveIntervals[uid];

                if (!keepSaved) {
                    ensureLists();
                    S.hiddenSaveList = S.hiddenSaveList.filter(x => !sameUid(x, uid));
                    saveNow();
                }

                comboLog("[GİZLİ SAVE STOP]", uid, { keepSaved });
            }

            function clearSelections() {
                Object.keys(kickIntervals).forEach(uid => {
                    clearInterval(kickIntervals[uid]);
                    delete kickIntervals[uid];
                });

                Object.keys(saveIntervals).forEach(uid => {
                    clearInterval(saveIntervals[uid]);
                    delete saveIntervals[uid];
                });

                Object.keys(hiddenSaveIntervals).forEach(uid => {
                    clearInterval(hiddenSaveIntervals[uid]);
                    delete hiddenSaveIntervals[uid];
                });

                S.kickList = {};
                S.saveList = [];
                S.hiddenSaveList = [];

                comboApi.resetRoomId();

                saveNow();
                refreshList();

                comboLog("[AUTO COMBO] Tüm seçimler temizlendi.");
            }

            const comboView = createAutoComboView({
                utils,
                container,
                settings: S,
                shorten,
                sameUid,
                ensureLists,
                saveNow,
                getPlayers,
                kickIntervals,
                saveIntervals,
                hiddenSaveIntervals,
                startKick,
                stopKick,
                startSave,
                stopSave,
                startHiddenSave,
                stopHiddenSave,
                clearSelections
            });
            const refreshList = () => comboView.refreshList();
            comboView.mount();

            function scheduleRefreshList(delayMs = 80) {
                if (runtimeState.refreshTimer) clearTimeout(runtimeState.refreshTimer);
                runtimeState.refreshTimer = setTimeout(() => {
                    runtimeState.refreshTimer = null;
                    refreshList();
                }, Math.max(40, Number(delayMs) || 80));
            }

            function installLiveRefresh() {
                try {
                    const root = document.querySelector(".game-table, .room, .table, .players, .game, body") || document.body;
                    if (!root || typeof MutationObserver !== "function") return;
                    runtimeState.refreshObserver = new MutationObserver(mutations => {
                        const shouldRefresh = mutations.some(mutation => {
                            const target = mutation.target;
                            if (!target || target === container || container.contains(target)) return false;
                            if (mutation.type === "attributes") {
                                const name = String(mutation.attributeName || "");
                                if (!["data-uid", "data-pid", "class", "style"].includes(name)) return false;
                            }
                            return !!(
                                target.closest && target.closest(".player, .js-player, [data-uid], [data-pid]") ||
                                Array.from(mutation.addedNodes || []).some(node => node && node.nodeType === 1 && (
                                    node.matches && node.matches(".player, .js-player, [data-uid], [data-pid]") ||
                                    node.querySelector && node.querySelector(".player, .js-player, [data-uid], [data-pid]")
                                ))
                            );
                        });
                        if (shouldRefresh) scheduleRefreshList();
                    });
                    runtimeState.refreshObserver.observe(root, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ["data-uid", "data-pid", "class", "style"]
                    });
                } catch (_) {}
            }

            installLiveRefresh();

            /* ========================= AUTO RESUME ========================= */
            function autoResume() {
                ensureLists();

                Object.keys(S.kickList).forEach(uid => startKick(String(uid)));
                S.saveList.forEach(uid => startSave(String(uid)));
                S.hiddenSaveList.forEach(uid => startHiddenSave(String(uid)));
            }

            autoResume();

            /* ========================= AUTO REFRESH ========================= */
            if (window.__KISS_AUTO_COMBO_REFRESH_TIMER) clearInterval(window.__KISS_AUTO_COMBO_REFRESH_TIMER);
            window.__KISS_AUTO_COMBO_REFRESH_TIMER = setInterval(refreshList, 2000);

            window.__KISS_AUTO_COMBO_CLEANUP = () => {
                Object.keys(kickIntervals).forEach(uid => {
                    clearInterval(kickIntervals[uid]);
                    delete kickIntervals[uid];
                });
                Object.keys(saveIntervals).forEach(uid => {
                    clearInterval(saveIntervals[uid]);
                    delete saveIntervals[uid];
                });
                Object.keys(hiddenSaveIntervals).forEach(uid => {
                    clearInterval(hiddenSaveIntervals[uid]);
                    delete hiddenSaveIntervals[uid];
                });
                Object.keys(runtimeState.actionTimeouts).forEach(key => {
                    clearTimeout(runtimeState.actionTimeouts[key]);
                    delete runtimeState.actionTimeouts[key];
                });
                if (runtimeState.refreshTimer) clearTimeout(runtimeState.refreshTimer);
                runtimeState.refreshTimer = null;
                if (runtimeState.refreshObserver) {
                    try { runtimeState.refreshObserver.disconnect(); } catch (_) {}
                    runtimeState.refreshObserver = null;
                }
                if (window.__KISS_AUTO_COMBO_REFRESH_TIMER) clearInterval(window.__KISS_AUTO_COMBO_REFRESH_TIMER);
                window.__KISS_AUTO_COMBO_REFRESH_TIMER = null;
            };
        }
    };
}


// ===== MODULE: GameStateProviderScorePatch.js =====
// GameStateProviderScorePatch.js
// Completes table-player kiss scores from visible .player-graphics blocks.
(function installGameStateProviderScorePatch() {
    if (window.__KISS_SCORE_PROVIDER_PATCH_INSTALLED__) return;
    window.__KISS_SCORE_PROVIDER_PATCH_INSTALLED__ = true;

    function numeric(value) {
        const text = String(value || "").trim();
        return /^\d+$/.test(text) && text !== "0" ? text : "";
    }

    function selectorEscape(value) {
        try {
            if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value || ""));
        } catch (_) {}
        return String(value || "").replace(/"/g, "");
    }

    function isVisible(node) {
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

    function parseCompactNumber(value) {
        const raw = String(value || "")
            .replace(/\s+/g, "")
            .replace(",", ".")
            .toLowerCase();
        const match = raw.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/) || raw.match(/(\d+(?:\.\d+)?)(k|m|b)?/);
        if (!match) return null;
        const base = Number(match[1]);
        if (!Number.isFinite(base)) return null;
        const suffix = match[2] || "";
        const multiplier = suffix === "b" ? 1000000000 : suffix === "m" ? 1000000 : suffix === "k" ? 1000 : 1;
        return Math.round(base * multiplier);
    }

    function readScoreFromNode(node) {
        try {
            if (!node) return null;
            const selectors = [
                ".player__counter--kiss",
                ".player__counter.player__counter--kiss",
                ".js-player-kiss-count",
                ".player-kisses",
                "[class*='counter--kiss']",
                "[class*='kiss-count']",
                "[class*='kiss_count']",
                "[class*='kisses']"
            ];
            for (const selector of selectors) {
                const el = node.querySelector && node.querySelector(selector);
                const value = parseCompactNumber(
                    el && (
                        el.getAttribute("data-count") ||
                        el.getAttribute("data-value") ||
                        el.textContent
                    )
                );
                if (value !== null) return value;
            }

            // player-graphics often exposes counters as plain text like "141k 1967k".
            const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
            const parts = text.match(/(\d+(?:[.,]\d+)?[kmb]?)(?:\s+\d+(?:[.,]\d+)?[kmb]?)/i);
            if (parts) return parseCompactNumber(parts[1]);
        } catch (_) {}
        return null;
    }

    function readGraphicsScore(uid) {
        const id = numeric(uid);
        if (!id) return null;
        try {
            const escaped = selectorEscape(id);
            const nodes = Array.from(document.querySelectorAll(
                '.player-graphics[data-uid="' + escaped + '"], .player[data-uid="' + escaped + '"].player-graphics'
            ));
            for (const node of nodes) {
                if (!isVisible(node)) continue;
                const score = readScoreFromNode(node);
                if (score !== null) return score;
            }
        } catch (_) {}
        return null;
    }

    function augmentSnapshot(snapshot) {
        try {
            if (!snapshot || !Array.isArray(snapshot.tablePlayers)) return snapshot;
            snapshot.tablePlayers.forEach(player => {
                const uid = numeric(player && (player.uid || player.userId || player.id));
                if (!uid) return;
                const current = Number(player.kissScore);
                if (player.kissScoreKnown === true && Number.isFinite(current) && current > 0) return;
                const score = readGraphicsScore(uid);
                if (score !== null) {
                    player.kissScore = score;
                    player.kissScoreKnown = true;
                }
            });
            try { window.__KISS_GAME_STATE__ = snapshot; } catch (_) {}
        } catch (_) {}
        return snapshot;
    }

    function patchProvider() {
        const provider = window.__KISS_GAME_STATE_PROVIDER__;
        if (!provider || provider.__scorePatchApplied) return !!provider;
        provider.__scorePatchApplied = true;

        const originalRefresh = provider.refresh;
        if (typeof originalRefresh === "function") {
            provider.refresh = function patchedRefresh() {
                return augmentSnapshot(originalRefresh.apply(this, arguments));
            };
            provider.getState = provider.refresh;
        }

        provider.augmentKissScores = augmentSnapshot;
        provider.readGraphicsKissScore = readGraphicsScore;
        try { augmentSnapshot(provider.refresh && provider.refresh("score-patch-init", { silent: true, force: true })); } catch (_) {}
        return true;
    }

    if (!patchProvider()) {
        const timer = setInterval(() => {
            if (patchProvider()) clearInterval(timer);
        }, 500);
        setTimeout(() => clearInterval(timer), 10000);
    }
})();


// ===== MODULE: IdRoomFollower.js =====
﻿function createIdRoomFollowerModule(utils) {
    return {
        name: "idRoomFollower",
        title: "ID Takip",

        defaultSettings: createIdRoomFollowerDefaultSettings(),

        renderSettings(container) {
            try {
                if (typeof window.__KISS_ID_ROOM_FOLLOWER_CLEANUP === "function") {
                    window.__KISS_ID_ROOM_FOLLOWER_CLEANUP();
                }
            } catch (_) {}

            const settings = utils.loadSettings(this.name, this.defaultSettings);
            if (!Array.isArray(settings.savedUsers)) settings.savedUsers = [];
            settings.intervalSeconds = Number(settings.intervalSeconds) || 10;

            settings.activeFollowId = getNumericCandidate(settings.activeFollowId);

            let loadedUsers = [];
            let followTimer = null;
            let resumeTimer = null;
            let activeFollowId = settings.activeFollowId;
            let isChecking = false;
            const {
                RECENT_EXIT_WINDOW_MS,
                ROOM_LOCK_INTERVAL_MS,
                ROOM_LOCK_ANCHOR_REFRESH_MS,
                ROOM_LOCK_MAX_MS
            } = createIdRoomFollowerConfig();

            const saveNow = () => utils.saveSettings(this.name, settings);
            const sameId = (a, b) => String(a) === String(b);
            const nowSeconds = () => String(Math.floor(Date.now() / 1000));
            const accountId = String(window.__KISS_ACCOUNT_ID || "");
            let view = null;
            const setStatus = text => { if (view) view.setStatus(text); };
            const setRoomLockLine = text => { if (view) view.setRoomLockLine(text); };
            const renderLoadedUsers = () => { if (view) view.renderLoadedUsers(); };
            const renderSavedUsers = () => { if (view) view.renderSavedUsers(); };
            const renderRoomLock = () => { if (view) view.renderRoomLock(); };
            const renderAll = () => { if (view) view.renderAll(); };
            const normalizeRoomId = value => {
                const text = String(value || "").trim();
                return /^\d+$/.test(text) ? text : "";
            };
            const getKnownRoomId = () => getGameState("known-room").roomId || normalizeRoomId(window.__KISS_LAST_ROOM_ID || localStorage.getItem("kiss_hidden_last_room_id"));

            if (!settings.roomLock || typeof settings.roomLock !== "object") {
                settings.roomLock = createIdRoomFollowerRoomLockState();
            }

            function getNumericCandidate(value) {
                const text = String(value || "").trim();
                return /^\d+$/.test(text) ? text : "";
            }

            function readDataLayerUserId() {
                try {
                    const dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
                    for (const item of dataLayer) {
                        const id = getNumericCandidate(item && (item.userID || item.userId || item.uid || item.id));
                        if (id) return id;
                    }
                } catch (_) {}
                return "";
            }

            function readTopfaceRoomId() {
                try {
                    for (let i = 0; i < localStorage.length; i += 1) {
                        const key = String(localStorage.key(i) || "");
                        if (!key.startsWith("topface_stprev_room_id")) continue;
                        const raw = localStorage.getItem(key);
                        const direct = normalizeRoomId(raw);
                        if (direct) return direct;
                        try {
                            const parsed = JSON.parse(raw);
                            const nested = normalizeRoomId(parsed && parsed.data && parsed.data.value);
                            if (nested) return nested;
                        } catch (_) {}
                    }
                } catch (_) {}
                return "";
            }

            function readAuthUserId() {
                try {
                    return getNumericCandidate(window.__KISS_AUTH_USER_ID) ||
                        getNumericCandidate(localStorage.getItem("kiss_auth_user_id")) ||
                        readDataLayerUserId() ||
                        getNumericCandidate(window._trackJs && window._trackJs.userId);
                } catch (_) {
                    return "";
                }
            }

            function getGameState(reason = "id-follow") {
                try {
                    const provider = window.__KISS_GAME_STATE_PROVIDER__;
                    if (provider && typeof provider.refresh === "function") {
                        return provider.refresh(reason, { silent: true });
                    }
                } catch (_) {}

                try {
                    const shared = window.__KISS_GAME_STATE__;
                    if (shared && Date.now() - Number(shared.at || 0) < 3000 && Array.isArray(shared.tablePlayers)) {
                        return shared;
                    }
                } catch (_) {}

                const authUserId = readAuthUserId();
                const roomId = normalizeRoomId(window.__KISS_LAST_ROOM_ID) ||
                    normalizeRoomId(localStorage.getItem("kiss_hidden_last_room_id")) ||
                    readTopfaceRoomId();
                const tableUsers = readTableUsers();
                const tableUids = tableUsers.map(user => user.id);
                const ownPresent = !!(authUserId && tableUids.includes(authUserId));
                const gameState = {
                    at: Date.now(),
                    reason,
                    roomId,
                    authUserId,
                    ownUid: authUserId,
                    ownPresent,
                    tablePlayerCount: tableUsers.length,
                    tableUids,
                    tablePlayers: tableUsers.map(user => ({ uid: user.id, userId: user.id, name: user.name })),
                    playerActivityByUid: readPlayerActivityMap(tableUids)
                };
                try { window.__KISS_GAME_STATE__ = gameState; } catch (_) {}
                return gameState;
            }

            const {
                normalizeUser,
                uniqueUsers,
                readTableUsers,
                readRoomLockAnchors,
                sameAnchorUids,
                readPlayerActivity,
                readPlayerActivityMap,
                hasRecentTargetExit
            } = createIdRoomFollowerHelpers({
                RECENT_EXIT_WINDOW_MS,
                getGameState,
                getNumericCandidate,
                normalizeRoomId,
                readAuthUserId
            });

            function getRoomUsers(gameState = null) {
                const stateNow = gameState || getGameState("room-users");
                if (Array.isArray(stateNow.tablePlayers)) {
                    return uniqueUsers(stateNow.tablePlayers.map(player => ({
                        id: player.uid || player.userId || player.id,
                        name: player.name || player.uid || player.userId || player.id
                    })));
                }
                return readTableUsers();
            }

            function logJson(label, payload) {
                try {
                    console.log(label + " " + JSON.stringify(payload || {}));
                } catch (_) {
                    console.log(label);
                }
            }

            const {
                emitFollowEvent,
                readTargetQueueState,
                tryGoById
            } = createIdRoomFollowerApi({
                accountId,
                nowSeconds
            });

            function addSavedUser(user) {
                const normalized = normalizeUser(user);
                if (!normalized) return false;

                settings.savedUsers = settings.savedUsers.filter(item => !sameId(item.id, normalized.id));
                settings.savedUsers.push({
                    id: normalized.id,
                    name: normalized.name,
                    savedAt: Date.now()
                });
                saveNow();
                return true;
            }

            function removeSavedUser(id) {
                settings.savedUsers = settings.savedUsers.filter(item => !sameId(item.id, id));
                if (sameId(activeFollowId, id)) stopFollow();
                saveNow();
                renderAll();
            }

            function stopFollow(keepSaved = false) {
                const stoppedId = activeFollowId || settings.activeFollowId;
                if (followTimer) clearInterval(followTimer);
                followTimer = null;
                activeFollowId = "";
                isChecking = false;
                if (!keepSaved) {
                    settings.activeFollowId = "";
                    saveNow();
                    if (stoppedId) emitFollowEvent(stoppedId, "stopped");
                }
                setStatus("Takip durdu.");
                renderSavedUsers();
            }

            const roomLock = createIdRoomFollowerRoomLock({
                settings,
                config: {
                    ROOM_LOCK_INTERVAL_MS,
                    ROOM_LOCK_ANCHOR_REFRESH_MS,
                    ROOM_LOCK_MAX_MS
                },
                saveNow,
                normalizeRoomId,
                getKnownRoomId,
                getGameState,
                getNumericCandidate,
                readRoomLockAnchors,
                sameAnchorUids,
                tryGoById,
                logJson,
                setStatus,
                setRoomLockLine,
                renderRoomLock,
                getActiveFollowId: () => activeFollowId,
                getSettingsActiveFollowId: () => settings.activeFollowId
            });
            const startRoomLock = roomLock.startRoomLock;
            const stopRoomLock = roomLock.stopRoomLock;
            const destroyRoomLock = roomLock.destroyRoomLock;

            try {
                window.__KISS_ID_ROOM_FOLLOWER_CLEANUP = () => {
                    if (followTimer) clearInterval(followTimer);
                    followTimer = null;
                    if (resumeTimer) clearTimeout(resumeTimer);
                    resumeTimer = null;
                    isChecking = false;
                    if (typeof destroyRoomLock === "function") destroyRoomLock();
                };
            } catch (_) {}

            function pauseFollowForNavigation(reason, meta = {}) {
                if (followTimer) clearInterval(followTimer);
                followTimer = null;
                isChecking = false;
                activeFollowId = settings.activeFollowId;
                saveNow();
                logJson("[ID TAKIP NAVIGATE]", Object.assign({ reason }, meta));
            }
            async function checkFollow(id) {
                if (isChecking) return;
                isChecking = true;

                try {
                    const gameState = getGameState("follow-check");
                    const tableUsers = getRoomUsers(gameState);
                    const targetVisible = tableUsers.some(user => sameId(user.id, id));
                    const stateReady = !!(gameState.authUserId && gameState.roomId && gameState.ownPresent);
                    const targetExit = hasRecentTargetExit(id, gameState);
                    const isAlreadyAtTable = targetVisible && stateReady && !targetExit.recent;
                    const currentConfirmedRoomId = normalizeRoomId(gameState.roomId) || getKnownRoomId();

                    if (isAlreadyAtTable) {
                        emitFollowEvent(id, "target_visible_probe", {
                            currentRoomId: currentConfirmedRoomId
                        });
                        setStatus("Oyuncu masada gorunuyor. Aktif oda fetch ile dogrulaniyor...");
                        logJson("[ID TAKIP STATE]", {
                            id,
                            reason: "target_visible_probe",
                            authUserId: gameState.authUserId,
                            ownPresent: gameState.ownPresent,
                            tableUserCount: tableUsers.length,
                            knownRoomId: currentConfirmedRoomId
                        });
                    }

                    if (targetVisible && stateReady && targetExit.recent) {
                        logJson("[ID TAKIP STATE]", {
                            id,
                            targetUserId: String(id),
                            reason: "target-visible-but-recent-exit",
                            authUserId: gameState.authUserId,
                            ownPresent: gameState.ownPresent,
                            tableUserCount: tableUsers.length,
                            knownRoomId: gameState.roomId,
                            lastExitAt: targetExit.lastExitAt,
                            lastLeftAt: targetExit.lastLeftAt,
                            lastJoinAt: targetExit.lastJoinAt,
                            lastSeenAt: targetExit.lastSeenAt,
                            exitAgeMs: targetExit.exitAgeMs,
                            activitySource: targetExit.source
                        });
                    }

                    if (targetVisible && !stateReady) {
                        logJson("[ID TAKIP STATE]", {
                            id,
                            reason: "target-visible-but-local-state-not-ready",
                            blockReason: !gameState.authUserId ? "missing-auth-user-id" : (!gameState.roomId ? "missing-room-id" : "own-not-in-roster"),
                            authUserId: gameState.authUserId,
                            ownPresent: gameState.ownPresent,
                            tableUserCount: tableUsers.length,
                            knownRoomId: gameState.roomId
                        });
                    }

                    const targetQueueState = await readTargetQueueState(id);
                    if (targetQueueState.found && targetQueueState.disabled && !targetVisible) {
                        setStatus("Hedef sirada. Fetch atilmadi, durum tekrar kontrol edilecek.");
                        emitFollowEvent(id, "target_queued");
                        logJson("[ID TAKIP SKIP]", { id, reason: "target_queued" });
                        return;
                    }
                    if (targetQueueState.found && targetQueueState.disabled && targetVisible) {
                        logJson("[ID TAKIP STATE]", {
                            id,
                            reason: "target-visible-queue-disabled-probe",
                            knownRoomId: currentConfirmedRoomId
                        });
                    }

                    const data = await tryGoById(id);
                    const roomId = normalizeRoomId(
                        data && data.status && (data.status.room_id || data.status.roomId) ||
                        data && (data.room_id || data.roomId)
                    );

                    logJson("[ID TAKIP]", {
                        id,
                        result: data && data.result,
                        error: data && data.error,
                        returnedRoomId: roomId,
                        currentRoomId: currentConfirmedRoomId,
                        targetVisibleLocal: targetVisible,
                        tableUserCount: tableUsers.length
                    });

                    if (data && data.error) {
                        if (targetVisible) {
                            emitFollowEvent(id, "visible_but_unconfirmed", {
                                error: data.error,
                                currentRoomId: currentConfirmedRoomId
                            });
                            setStatus("Oyuncu masada gorunuyor ama aktif oda dogrulanamadi. Takip devam ediyor.");
                            logJson("[ID TAKIP STATE]", {
                                id,
                                reason: "visible_but_unconfirmed",
                                error: data.error,
                                knownRoomId: currentConfirmedRoomId
                            });
                            return;
                        }
                        emitFollowEvent(id, targetQueueState.found ? "eligible_failed" : "target_missing");
                        setStatus("Masada degil, su an gidilemiyor. 10 sn sonra tekrar denenecek.");
                        return;
                    }

                    if (data && data.result && roomId) {
                        if (currentConfirmedRoomId && roomId === currentConfirmedRoomId) {
                            emitFollowEvent(id, "same_table_confirmed", {
                                currentRoomId: currentConfirmedRoomId,
                                returnedRoomId: roomId,
                                targetVisibleLocal: targetVisible
                            });
                            setStatus("Oyuncu ayni odada dogrulandi. Takip kontrolu devam ediyor.");
                            logJson("[ID TAKIP STATE]", {
                                id,
                                reason: "same_table_confirmed",
                                returnedRoomId: roomId,
                                currentRoomId: currentConfirmedRoomId,
                                targetVisibleLocal: targetVisible
                            });
                            return;
                        }

                        emitFollowEvent(id, "target_moved_room", {
                            currentRoomId: currentConfirmedRoomId,
                            returnedRoomId: roomId,
                            targetVisibleLocal: targetVisible
                        });
                        setStatus("Hedefin aktif odasi farkli. Gidiliyor...");
                        pauseFollowForNavigation("id-follow-success", { id, returnedRoomId: roomId, knownRoomId: currentConfirmedRoomId });
                        location.href = "/game/room?";
                        return;
                    }

                    if (targetVisible) {
                        emitFollowEvent(id, "visible_but_unconfirmed", {
                            currentRoomId: currentConfirmedRoomId,
                            returnedRoomId: roomId
                        });
                        setStatus("Oyuncu masada gorunuyor ama aktif oda dogrulanamadi. Takip devam ediyor.");
                        return;
                    }

                    emitFollowEvent(id, targetQueueState.found ? "eligible_failed" : "target_missing");
                    setStatus("Gecerli oda bulunamadi. Takip devam ediyor.");
                } catch (error) {
                    console.error("[ID TAKIP ERROR]", error);
                    setStatus("Kontrol hatasi. Takip devam ediyor.");
                } finally {
                    isChecking = false;
                    renderSavedUsers();
                }
            }

            async function startFollow(id) {
                if (settings.roomLock && settings.roomLock.active) {
                    setStatus("Once oda kilidini kapatin.");
                    return;
                }
                stopFollow(true);
                activeFollowId = String(id);
                settings.activeFollowId = activeFollowId;
                saveNow();
                setStatus("Takip baslatiliyor...");
                renderSavedUsers();

                setStatus("Takip basladi. Her 10 saniyede masa kontrol edilecek.");
                await checkFollow(activeFollowId);
                if (activeFollowId) {
                    followTimer = setInterval(() => checkFollow(activeFollowId), 10000);
                }
                renderSavedUsers();
            }
            view = createIdRoomFollowerView({
                utils,
                container,
                settings,
                getLoadedUsers: () => loadedUsers,
                setLoadedUsers: users => { loadedUsers = Array.isArray(users) ? users : []; },
                uniqueUsers,
                sameId,
                getActiveFollowId: () => activeFollowId,
                getRoomUsers,
                addSavedUser,
                removeSavedUser,
                startFollow,
                stopFollow,
                startRoomLock,
                stopRoomLock,
                saveNow
            });
            view.mount();

            if (settings.activeFollowId) {
                const hasSavedTarget = settings.savedUsers.some(user => sameId(user.id, settings.activeFollowId));
                if (hasSavedTarget) {
                    resumeTimer = setTimeout(() => {
                        resumeTimer = null;
                        startFollow(settings.activeFollowId);
                    }, 500);
                } else {
                    settings.activeFollowId = "";
                    saveNow();
                }
            }

            roomLock.resumeRoomLock();
        }
    };
}











// ===== MODULE: MessageCleaner.js =====
    function createMessageCleanerModule() {
        return {
            name: 'messageCleaner',
            title: 'Mesaj Temizleme',
            defaultSettings: {},
            renderSettings(container) {
                const defaults = {
                    hideGifts: false,
                    hideWheel: false,
                    hideKissBoost: false,
                    hideGiftInline: false
            };
            let settings = JSON.parse(localStorage.getItem('msgCleanSettings') || JSON.stringify(defaults));

            try {
                if (window.__KISS_MESSAGE_CLEANER_TIMER) clearTimeout(window.__KISS_MESSAGE_CLEANER_TIMER);
                window.__KISS_MESSAGE_CLEANER_TIMER = null;
                if (window.__KISS_MESSAGE_CLEANER_OBSERVER) window.__KISS_MESSAGE_CLEANER_OBSERVER.disconnect();
                window.__KISS_MESSAGE_CLEANER_OBSERVER = null;
            } catch (_) {}

            function saveSettings() {
                const value = JSON.stringify(settings);
                    localStorage.setItem('msgCleanSettings', value);
                    if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === "function") {
                        window.__KISS_ACCOUNT_SAVE_SETTING('msgCleanSettings', value);
                    }
                }

                function hideGiftMessages() {
                    if (!hasActiveFilters()) return;
                    const messages = document.querySelectorAll('.chat__message');
                    messages.forEach(message => {
                        const text = message.querySelector('.message__text')?.textContent?.trim() || '';
                        if (settings.hideGiftInline && message.querySelector('.gift__inline')) {
                            message.style.display = 'none';
                            return;
                        }
                        if (settings.hideWheel && text.includes("Çarkıfelek'te inanılmaz bir hediye kazandı")) {
                            message.style.display = 'none';
                            return;
                        }
                        if (settings.hideKissBoost && text.includes('ile öpüşme şansını artırdı')) {
                            message.style.display = 'none';
                            return;
                        }
                        if (settings.hideGifts && message.querySelector('.gift__inline')) {
                            message.style.display = 'none';
                        }
                    });
                }

                function hasActiveFilters() {
                    return !!(settings.hideGifts || settings.hideWheel || settings.hideKissBoost || settings.hideGiftInline);
                }

                container.innerHTML = `
                    <div style="padding:8px">
                        <label><input type="checkbox" id="hideGiftInline" ${settings.hideGiftInline ? 'checked' : ''}> 🎁 Hediye mesajlarını gizle</label><br>
                        <label><input type="checkbox" id="hideWheel" ${settings.hideWheel ? 'checked' : ''}> 🎰 Çarkıfelek mesajlarını gizle</label><br>
                        <label><input type="checkbox" id="hideKissBoost" ${settings.hideKissBoost ? 'checked' : ''}> 💋 Şans mesajlarını gizle</label><br>
                        <label><input type="checkbox" id="hideGifts" ${settings.hideGifts ? 'checked' : ''}> 🎀 Diğer hediye içeriklerini gizle</label>
                    </div>
                `;

                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.addEventListener('change', event => {
                        settings[event.target.id] = event.target.checked;
                        saveSettings();
                        hideGiftMessages();
                        syncObserver();
                    });
                });

                hideGiftMessages();
                let cleanTimer = null;
                let observer = null;
                function scheduleHideGiftMessages() {
                    if (cleanTimer) return;
                    cleanTimer = setTimeout(() => {
                        cleanTimer = null;
                        try { window.__KISS_MESSAGE_CLEANER_TIMER = null; } catch (_) {}
                        hideGiftMessages();
                    }, 500);
                    try { window.__KISS_MESSAGE_CLEANER_TIMER = cleanTimer; } catch (_) {}
                }

                function syncObserver() {
                    if (!hasActiveFilters()) {
                        if (observer) observer.disconnect();
                        observer = null;
                        return;
                    }

                    if (observer) return;
                    observer = new MutationObserver(() => scheduleHideGiftMessages());
                    const chatContainer = document.querySelector('.chat__messages') || document.body;
                    observer.observe(chatContainer, { childList: true, subtree: true });
                    try { window.__KISS_MESSAGE_CLEANER_OBSERVER = observer; } catch (_) {}
                }

                syncObserver();
            }
        };
    }


// ===== MODULE: VisualCleaner.js =====
function createVisualCleanerModule(utils) {
    return {
        name: 'visualCleanerUltimateFixedV9',
        title: 'Görsel Temizleme',
        defaultSettings: {},
        renderSettings(container) {

            const defaults = {
                hideHatsFrames: false,
                hideNames: false,
                hidePP: false,
                hideGifts: false,
                hideCups: false,
                hideAltInfo: false,
                hideAll: false
            };

            let settings = JSON.parse(localStorage.getItem('visualCleanerUltimateFixedV9Settings') || JSON.stringify(defaults));
            try {
                if (window.__KISS_VISUAL_CLEANER_SWEEP_TIMER) clearInterval(window.__KISS_VISUAL_CLEANER_SWEEP_TIMER);
                window.__KISS_VISUAL_CLEANER_SWEEP_TIMER = null;
                if (window.__KISS_VISUAL_CLEANER_GIFT_OBSERVER) window.__KISS_VISUAL_CLEANER_GIFT_OBSERVER.disconnect();
                window.__KISS_VISUAL_CLEANER_GIFT_OBSERVER = null;
            } catch (_) {}

            function saveSettings() {
                const value = JSON.stringify(settings);
                localStorage.setItem('visualCleanerUltimateFixedV9Settings', value);
                if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === "function") {
                    window.__KISS_ACCOUNT_SAVE_SETTING('visualCleanerUltimateFixedV9Settings', value);
                }
            }

            /* ---------------------------------------------------
               ✅ Hediyeleri CSS ile ANINDA yok eden layer
            ---------------------------------------------------*/
            function applyGiftCSS() {
                let style = document.getElementById("vcleaner-hide-gifts-css");
                if (settings.hideGifts) {
                    if (!style) {
                        style = document.createElement("style");
                        style.id = "vcleaner-hide-gifts-css";
                        style.textContent = `
                            .gift,
                            .gift--small,
                            .gift--small--317,
                            .gift-animation,
                            .gift-animation-container,
                            .gift__container,
                            .animation_gift,
                            [data-gift],
                            [data-type="gift"],
                            canvas[data-type="gift"],
                            div[class*="gift"],
                            img[class*="gift"],
                            [class*="gift"] {
                                display:none !important;
                                visibility:hidden !important;
                                opacity:0 !important;
                                width:0!important;
                                height:0!important;
                                pointer-events:none!important;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                } else {
                    style?.remove();
                }
            }

            /* ---------------------------------------------------
               ✅ DOM kill
            ---------------------------------------------------*/
            function killGiftsHard(root = document) {
                if (!settings.hideGifts) return;
                const selectors = [
                    '.gift', '.gift--small', '.gift--small--317',
                    '.gift-animation', '.gift-animation-container',
                    '.gift__container', '.animation_gift',
                    '[data-gift]', '[data-type="gift"]',
                    'canvas[data-type="gift"]',
                    'div[class*="gift"]', 'img[class*="gift"]',
                    '[class*="gift"]'
                ];

                try {
                    if (root.nodeType === 1 && root.matches && root.matches(selectors.join(','))) {
                        try { root.remove(); return; }
                        catch { root.style.display = 'none'; return; }
                    }
                } catch {}

                root.querySelectorAll(selectors.join(',')).forEach(el => {
                    try { el.remove(); }
                    catch { el.style.display = 'none'; }
                });
            }

            /* ---------------------------------------------------
               ✅ SHADOW ROOT SCAN
            ---------------------------------------------------*/
            function deepScan(node) {
                try { killGiftsHard(node); } catch {}

                if (node.shadowRoot) {
                    killGiftsHard(node.shadowRoot);
                }
                node.childNodes?.forEach(n => {
                    if (n.nodeType === 1) deepScan(n);
                });
            }

            /* ---------------------------------------------------
               ✅ FULL SWEEP
            ---------------------------------------------------*/
            function fullGiftSweep() {
                if (!settings.hideGifts) return;
                killGiftsHard(document.body);
            }

            let giftObserver = null;

            function syncGiftObserver() {
                if (!settings.hideGifts) {
                    if (giftObserver) giftObserver.disconnect();
                    giftObserver = null;
                    return;
                }

                if (giftObserver || !document.body) return;
                giftObserver = new MutationObserver(mutations => {
                    if (!settings.hideGifts) return;
                    for (const mutation of mutations) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType !== 1) return;
                            try { killGiftsHard(node); } catch {}
                        });
                    }
                });
                giftObserver.observe(document.body, { childList: true, subtree: true });
                try { window.__KISS_VISUAL_CLEANER_GIFT_OBSERVER = giftObserver; } catch (_) {}
            }

            /* ---------------------------------------------------
               ✅ Normal eski görsel işleme (senin kodun)
            ---------------------------------------------------*/
            const originalDisplay = new WeakMap();
            function toggleElement(el, hide) {
                if (!originalDisplay.has(el)) originalDisplay.set(el, el.style.display || '');
                el.style.display = hide ? 'none' : originalDisplay.get(el);
            }

            function hideGifts(root = document.body) {
                if (!settings.hideGifts) return;
                killGiftsHard(root);
            }

            function hideAltInfo() {
                document.querySelectorAll('.player__counter.player__counter--gift, .player__counter.player__counter--kiss')
                    .forEach(el => toggleElement(el, settings.hideAltInfo));
            }

            function hideAllPlayers(hide) {
                document.querySelectorAll('.js-player, .player, .player-container')
                    .forEach(el => toggleElement(el, hide));
            }

            function scanVisuals(root = document.body) {
                const hatsFramesSelector = [
                    'canvas.hat-animation-frame',
                    'canvas.animation-frame',
                    'canvas[data-type="hat"]',
                    'canvas[data-type="frame"]',
                    'canvas[data-type="frame-glow"]',
                    '.player__collection[data-link="collection"]',
                    '.frame-glow',
                    '.frame-glow-wrap',
                    '.player__frame',
                    '.player__border'
                ].join(',');

                const namesSelector =
                    '.player__name__link, a.js-player-mention, [class*="span_"], .player__badge, .player__club, .player__badge-icon';

                const ppSelector =
                    '.player__photo, .player__avatar, img.player__photo, .player__pic';

                const cupsSelector = '.icon-small-cup';

                if (settings.hideAll) {
                    hideAllPlayers(true);
                    return;
                }
                hideAllPlayers(false);

                root.querySelectorAll(hatsFramesSelector)
                    .forEach(el => toggleElement(el, settings.hideHatsFrames));

                root.querySelectorAll(namesSelector)
                    .forEach(el => toggleElement(el, settings.hideNames));

                root.querySelectorAll(ppSelector)
                    .forEach(el => {
                        if (settings.hidePP) {
                            if (!el.dataset._originalVisibility) el.dataset._originalVisibility = el.style.visibility || '';
                            if (!el.dataset._originalOpacity) el.dataset._originalOpacity = el.style.opacity || '';
                            el.style.visibility = 'hidden';
                            el.style.opacity = '0';
                        } else {
                            el.style.visibility = el.dataset._originalVisibility || 'visible';
                            el.style.opacity = el.dataset._originalOpacity || '1';
                        }
                    });

                root.querySelectorAll(cupsSelector)
                    .forEach(el => toggleElement(el, settings.hideCups));

                hideAltInfo();
                hideGifts(root);
            }


            /* ---------------------------------------------------
                ✅ UI
            ---------------------------------------------------*/
            container.innerHTML = `
                <div style="padding:8px">
                    <label><input type="checkbox" id="hideHatsFrames" ${settings.hideHatsFrames ? 'checked' : ''}> 🎩🖼️ Koleksiyonları gizle</label><br>
                    <label><input type="checkbox" id="hideNames" ${settings.hideNames ? 'checked' : ''}> ✏️ Kullanıcı isimlerini gizle</label><br>
                    <label><input type="checkbox" id="hidePP" ${settings.hidePP ? 'checked' : ''}> 🖼️ Profil fotoğrafını gizle</label><br>
                    <label><input type="checkbox" id="hideGifts" ${settings.hideGifts ? 'checked' : ''}> 🎁 Hediyeleri gizle</label><br>
                    <label><input type="checkbox" id="hideCups" ${settings.hideCups ? 'checked' : ''}> 🏆 Kupalari gizle</label><br>
                    <label><input type="checkbox" id="hideAltInfo" ${settings.hideAltInfo ? 'checked' : ''}> ℹ️ Alt bilgiyi gizle</label><br>
                    <label><input type="checkbox" id="hideAll" ${settings.hideAll ? 'checked' : ''}> 🧨 Hepsini Kaldır</label>
                </div>
            `;

            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', ev => {
                    settings[ev.target.id] = ev.target.checked;
                    saveSettings();

                    if (ev.target.id === "hideGifts") {
                        applyGiftCSS();
                        fullGiftSweep();
                        syncGiftObserver();
                    }

                    scanVisuals();
                });
            });

            /* Tarama + CSS ekleme */
            window.__KISS_VISUAL_CLEANER_SWEEP_TIMER = setInterval(fullGiftSweep, 5000);
            scanVisuals();
            applyGiftCSS();
            fullGiftSweep();
            syncGiftObserver();
        }
    };
}


// ===== BOOTSTRAP =====
// bootstrap.js
function initializeToolkit() {
    const existingPanel = document.getElementById("kiss-toolkit-panel");
    if (existingPanel) return true;

    if (!document.body) {
        setTimeout(initializeToolkit, 300);
        return false;
    }

    if (window.__ToolkitPanel && window.__ToolkitPanel.panel) {
        try {
            document.body.appendChild(window.__ToolkitPanel.panel);
            return true;
        } catch (_) {}
    }

    if (window.__KISS_TOOLKIT_INITIALIZING) return false;
    window.__KISS_TOOLKIT_INITIALIZING = true;

    try {
        console.log("[Toolkit] starting");

        const registry = new ToolkitModuleRegistry(StorageUtils);
        const panel = new ToolkitPanel(StorageUtils);

        const moduleManager = createModuleManagerModule(StorageUtils);
        registry.register(moduleManager);
        const enabledMap = moduleManager.loadEnabledMap();

        const allDefinitions = [
            createAutoSpinModule(StorageUtils),
            createAutoComboModule(StorageUtils),
            createIdRoomFollowerModule(StorageUtils),
            createVisualCleanerModule(StorageUtils),
            createMessageCleanerModule()
        ];

        moduleManager.setModuleDefinitions(allDefinitions);

        const launcherSettings = window.__KISS_MODULE_SETTINGS || {};
        if (launcherSettings && typeof launcherSettings === "object") {
            let hasStoredAutoSettings = false;
            try {
                hasStoredAutoSettings = localStorage.getItem(StorageUtils.getKey("autoSpinTab1")) !== null;
            } catch (_) {}

            if (!hasStoredAutoSettings) {
                const autoSpinDefaults = createAutoSpinModule(StorageUtils).defaultSettings || {};
                const autoSpinSettings = StorageUtils.loadSettings("autoSpinTab1", autoSpinDefaults);
                autoSpinSettings.manualStopped = autoSpinSettings.manualStopped || { spin: false, kiss: false, close: false };

                if (launcherSettings.autoSpinTab1 !== undefined) {
                    autoSpinSettings.manualStopped.spin = !launcherSettings.autoSpinTab1;
                }
                if (launcherSettings.autoKiss !== undefined) {
                    autoSpinSettings.manualStopped.kiss = !launcherSettings.autoKiss;
                }
                if (launcherSettings.autoClose !== undefined) {
                    autoSpinSettings.manualStopped.close = !launcherSettings.autoClose;
                }
                if (launcherSettings.activeGuard !== undefined) {
                    autoSpinSettings.guardEnabled = !!launcherSettings.activeGuard;
                }
                autoSpinSettings.forceRetAll = false;
                StorageUtils.saveSettings("autoSpinTab1", autoSpinSettings);
            }
        }

        const activeModules = [];
        allDefinitions.forEach(def => {
            const enabled = enabledMap[def.name] !== false;
            if (enabled) activeModules.push(registry.register(def));
        });

        activeModules.forEach(module => panel.attachModule(module));
        panel.showFirstModule();

        window.__ToolkitPanel = panel;
        window.__KISS_TOOLKIT_READY_AT = Date.now();
        window.__KISS_TOOLKIT_INITIALIZING = false;
        console.log("[Toolkit] ready");
        return true;
    } catch (error) {
        window.__KISS_TOOLKIT_INITIALIZING = false;
        console.error("[Toolkit] init failed", error && error.message ? error.message : error);
        setTimeout(initializeToolkit, 1000);
        return false;
    }
}

function ensureToolkitAttached() {
    try {
        if (!document.body) return;
        if (document.getElementById("kiss-toolkit-panel")) return;

        if (window.__ToolkitPanel && window.__ToolkitPanel.panel) {
            document.body.appendChild(window.__ToolkitPanel.panel);
            return;
        }

        initializeToolkit();
    } catch (_) {}
}

function installToolkitSelfWatchdog() {
    if (window.__KISS_TOOLKIT_SELF_WATCHDOG) return;
    window.__KISS_TOOLKIT_SELF_WATCHDOG = true;

    setInterval(ensureToolkitAttached, 3000);

    try {
        const root = document.documentElement || document;
        const observer = new MutationObserver(() => {
            if (!document.getElementById("kiss-toolkit-panel")) {
                setTimeout(ensureToolkitAttached, 250);
            }
        });
        observer.observe(root, { childList: true, subtree: true });
        window.__KISS_TOOLKIT_OBSERVER = observer;
    } catch (_) {}
}

window.__KISS_FORCE_TOOLKIT_INIT = initializeToolkit;
window.__KISS_ENSURE_TOOLKIT_ATTACHED = ensureToolkitAttached;

installToolkitSelfWatchdog();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeToolkit);
} else {
    initializeToolkit();
}

setTimeout(initializeToolkit, 500);
setTimeout(initializeToolkit, 1500);




})();