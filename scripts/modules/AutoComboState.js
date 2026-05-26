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
