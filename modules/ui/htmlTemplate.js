const TARGET_URL = "https://getkisskiss.com/";

const {
  gridClassForCount,
  normalizeEntries,
  normalizeOptions
} = require("./gameTemplate/templateUtils");
const { buildSlotMarkup } = require("./gameTemplate/slotMarkup");

const { buildGameShellHtml } = require("./gameTemplate/shellTemplate");
const { buildClientScript } = require("./gameTemplate/clientScript");

function generateHTML(scripts, accountOrEntries, maybeOptions) {
  const entries = normalizeEntries(accountOrEntries);
  const options = normalizeOptions(maybeOptions || {});
  const clientScript = buildClientScript(TARGET_URL, scripts, entries, options);
  const gridClass = gridClassForCount(entries.length);

  return buildGameShellHtml({
    gridClass,
    slotMarkup: buildSlotMarkup(entries),
    clientScript
  });
}

module.exports = {
  generateHTML
};

