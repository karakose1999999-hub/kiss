const { safeJson } = require("./templateUtils");
const { buildNetworkWatcherSteps } = require("./networkWatcherSteps");
const { buildClientRuntimeSource } = require("./clientRuntime");

function buildClientScript(targetUrl, scripts, entries, options) {
  return buildClientRuntimeSource({
    targetUrl,
    scriptPayload: safeJson(Array.isArray(scripts) ? scripts : []),
    entriesPayload: safeJson(entries),
    optionsPayload: safeJson(options),
    watcherStepsPayload: safeJson(buildNetworkWatcherSteps())
  });
}

module.exports = {
  buildClientScript
};
