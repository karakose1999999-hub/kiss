function createGameEntryBuilder({
  accountId,
  accountLabel,
  delay,
  generateHTML,
  loadScripts,
  log,
  loginAccountWithFetch,
  maxMultiAccounts,
  moduleSettingsForWindow,
  partitionForAccount,
  readAccountScriptSettings,
  settleLoginSession,
  getCookieNames,
  setAccountStatus,
  setCurrentEntries
}) {
  function hasReusableLoginCookies(cookieNames) {
    return Array.isArray(cookieNames) && (
      cookieNames.includes("authToken") ||
      cookieNames.includes("authLogin") ||
      cookieNames.includes("sessnew")
    );
  }

  async function prepareGameEntry(account, index, options = {}) {
    const id = accountId(account);
    const label = accountLabel(account);
    const partition = partitionForAccount(account);

    setAccountStatus(id, "loading", "Preflight login");

    let loginResult = {
      ok: false,
      status: 0,
      message: "not-started",
      cookieNames: []
    };

    if (options.preserveSession && typeof getCookieNames === "function") {
      try {
        const existingCookieNames = await getCookieNames(partition);
        if (hasReusableLoginCookies(existingCookieNames)) {
          loginResult = {
            ok: true,
            status: 200,
            message: "preserve-session-ok",
            cookieNames: existingCookieNames,
            preservedSession: true
          };
        }
      } catch (error) {
        log("preserve session check failed", {
          account: label,
          message: error && error.message ? error.message : String(error)
        });
      }
    }

    if (!loginResult.ok) {
      try {
        loginResult = await loginAccountWithFetch(account, partition);
      } catch (error) {
        loginResult = {
          ok: false,
          status: 0,
          message: error && error.message ? error.message : "fetch-login-error",
          cookieNames: []
        };

        log("preflight login failed", {
          account: label,
          message: loginResult.message
        });
      }
    }

    if (loginResult.ok && !loginResult.preservedSession) {
      const cookieNames = await settleLoginSession(partition);
      loginResult.cookieNames = cookieNames;
    }

    const entry = {
      index,
      account,
      accountId: id,
      label,
      username: String(account && account.username ? account.username : ""),
      partition,
      loginOk: !!loginResult.ok,
      loginStatus: loginResult.status,
      loginMode: loginResult.preservedSession ? "preserve-session" : "preflight",
      cookieNames: loginResult.cookieNames || [],
      accountScriptSettings: readAccountScriptSettings(id)
    };

    log("entry ready", {
      slot: index + 1,
      label: entry.label,
      username: entry.username,
      partition,
      preflightOk: entry.loginOk,
      loginMode: entry.loginMode,
      status: entry.loginStatus,
      cookieNames: entry.cookieNames
    });

    return entry;
  }

  async function buildGameHtml(accounts, options = {}) {
    const list = Array.isArray(accounts) ? accounts.filter(Boolean) : [accounts].filter(Boolean);
    const safeList = list.slice(0, maxMultiAccounts);
    const entries = [];

    for (let index = 0; index < safeList.length; index += 1) {
      entries.push(await prepareGameEntry(safeList[index], index, options));

      if (safeList.length > 1) {
        await delay(500);
      }
    }

    setCurrentEntries(entries);

    const scripts = loadScripts();

    log("scripts loaded", {
      count: scripts.length,
      names: scripts.map(script => script.name)
    });

    return {
      entries,
      html: generateHTML(scripts, entries, {
        mode: entries.length > 1 ? "multi" : "single",
        preserveSession: !!options.preserveSession,
        loginRefreshAfterLoad: entries.some(entry => entry.loginOk && entry.loginMode !== "preserve-session"),
        restoreGuardEnabled: !!options.restoreGuardEnabled,
        moduleSettings: moduleSettingsForWindow()
      })
    };
  }

  return {
    buildGameHtml,
    prepareGameEntry
  };
}

module.exports = {
  createGameEntryBuilder
};
