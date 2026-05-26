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
