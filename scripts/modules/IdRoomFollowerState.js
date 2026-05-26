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
