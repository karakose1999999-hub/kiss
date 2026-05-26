function safeJson(value) {
  return JSON.stringify(value == null ? null : value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function normalizeOptions(options) {
  const source = options || {};

  return {
    mode: String(source.mode || "single"),
    preserveSession: !!source.preserveSession,
    loginRefreshAfterLoad: !!source.loginRefreshAfterLoad,
    restoreGuardEnabled: !!source.restoreGuardEnabled,
    moduleSettings: source.moduleSettings || {}
  };
}

function normalizeEntries(accountOrEntries) {
  if (Array.isArray(accountOrEntries)) {
    return accountOrEntries.map((entry, index) => ({
      index,
      account: entry.account || entry,
      accountId: String(entry.accountId || (entry.account && entry.account.id) || (entry.account && entry.account.username) || index),
      label: String(entry.label || (entry.account && entry.account.label) || (entry.account && entry.account.username) || `Hesap ${index + 1}`),
      username: String(entry.username || (entry.account && entry.account.username) || ""),
      partition: String(entry.partition || `persist:account-${index + 1}`),
      loginOk: !!entry.loginOk,
      loginStatus: entry.loginStatus || 0,
      loginMode: String(entry.loginMode || ""),
      cookieNames: Array.isArray(entry.cookieNames) ? entry.cookieNames : [],
      accountScriptSettings: entry.accountScriptSettings && typeof entry.accountScriptSettings === "object" ? entry.accountScriptSettings : {}
    }));
  }

  const account = accountOrEntries || {};

  return [{
    index: 0,
    account,
    accountId: String(account.id || account.username || "single"),
    label: String(account.label || account.username || "Hesap 1"),
    username: String(account.username || ""),
    partition: "persist:main",
    loginOk: false,
    loginStatus: 0,
    loginMode: "",
    cookieNames: [],
    accountScriptSettings: {}
  }];
}

function gridClassForCount(count) {
  if (count <= 1) return "grid-one";
  if (count === 2) return "grid-two";
  return "grid-four";
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

module.exports = {
  escapeAttr,
  escapeHtml,
  gridClassForCount,
  normalizeEntries,
  normalizeOptions,
  safeJson
};
