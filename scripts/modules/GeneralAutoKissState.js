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
