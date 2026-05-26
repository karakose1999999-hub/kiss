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
