const { buildPreamble } = require("./preamble");
const loggingAndSlots = require("./loggingAndSlots").source;
const routeRecovery = require("./routeRecovery").source;
const stateAndWitness = require("./stateAndWitness").source;
const viewHelpers = require("./viewHelpers").source;
const followAndInjection = require("./followAndInjection").source;
const kissFallbackAndLogin = require("./kissFallbackAndLogin").source;
const kissRoomState = require("./kissRoomState").source;
const maintenanceHost = require("./maintenanceHost").source;
const focusCycle = require("./focusCycle").source;
const consoleHandlers = require("./consoleHandlers").source;
const focusAndSetup = require("./focusAndSetup").source;

function buildClientRuntimeSource(payloads) {
  return [
    buildPreamble(payloads),
    loggingAndSlots,
    routeRecovery,
    stateAndWitness,
    viewHelpers,
    followAndInjection,
    kissFallbackAndLogin,
    kissRoomState,
    maintenanceHost,
    focusCycle,
    consoleHandlers,
    focusAndSetup
  ].join("\n");
}

module.exports = {
  buildClientRuntimeSource
};
