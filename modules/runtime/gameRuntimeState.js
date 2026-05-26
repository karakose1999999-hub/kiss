const MAX_MULTI_ACCOUNTS = 4;
const KISS_ANSWER_URL = "https://getkisskiss.com/api/room/roulette_answer/";

function createGameRuntimeState() {
  return {
    currentAccount: null,
    currentEntries: [],
    currentPartitions: [],
    runtimeStatuses: new Map(),
    slotHealth: new Map(),
    kissFallbackHostStats: new Map()
  };
}

module.exports = {
  KISS_ANSWER_URL,
  MAX_MULTI_ACCOUNTS,
  createGameRuntimeState
};
