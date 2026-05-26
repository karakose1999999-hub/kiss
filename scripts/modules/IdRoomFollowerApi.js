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
