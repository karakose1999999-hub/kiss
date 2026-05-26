function buildPreamble({ targetUrl, scriptPayload, entriesPayload, optionsPayload, watcherStepsPayload }) {
  return `const { ipcRenderer } = require("electron");

const TARGET_URL = ${JSON.stringify(targetUrl)};
const scripts = ${scriptPayload};
const entries = ${entriesPayload};
const options = ${optionsPayload};
const watcherSteps = ${watcherStepsPayload};`;
}

module.exports = {
  buildPreamble
};
