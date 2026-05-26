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
