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
