// GeneralAutoKiss.js
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
