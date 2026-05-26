const { session } = require("electron");

const TARGET_URL = "https://getkisskiss.com/";
const AUTH_URL = "https://getkisskiss.com/api/session/auth";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

const LOG_PREFIX = "[NewFetchLogin]";

function log(message, meta) {
  if (typeof meta === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${LOG_PREFIX} ${message}`, meta);
}

async function warmSession(partition) {
  const ses = session.fromPartition(partition);

  const response = await ses.fetch(TARGET_URL, {
    method: "GET",
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": USER_AGENT
    }
  });

  await response.text();
  return response;
}

function hasValidAccessToken(data) {
  return !!(
    data &&
    data.response &&
    typeof data.response.accessToken === "string" &&
    data.response.accessToken.length > 20
  );
}

function hasLoginCookies(cookieNames) {
  return (
    cookieNames.includes("authToken") ||
    cookieNames.includes("authLogin") ||
    cookieNames.includes("sessnew")
  );
}

async function loginAccountWithFetch(account, partition) {
  const username = String(account && account.username ? account.username : "").trim();
  const password = String(account && account.password ? account.password : "");

  if (!username || !password) {
    return {
      ok: false,
      status: 0,
      message: "missing-credentials",
      cookieNames: []
    };
  }

  const ses = session.fromPartition(partition);

  await ses.clearStorageData({
    storages: [
      "cookies",
      "localstorage",
      "indexdb",
      "cachestorage",
      "serviceworkers",
      "appcache"
    ]
  });

  await ses.clearCache();

  log("preflight login start", {
    username
  });

  await warmSession(partition);

  const body = new URLSearchParams({
    socialId: username,
    password
  }).toString();

  const response = await ses.fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "accept": "*/*",
      "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://getkisskiss.com",
      "referer": "https://getkisskiss.com/",
      "user-agent": USER_AGENT,
      "x-requested-with": "XMLHttpRequest"
    },
    body
  });

  const text = await response.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = null;
  }

  const cookies = await ses.cookies.get({ url: TARGET_URL });
  const cookieNames = cookies.map((item) => item.name);

  const hasAccessToken = hasValidAccessToken(data);
  const hasAuthCookies = hasLoginCookies(cookieNames);
  const ok = response.ok && (hasAccessToken || hasAuthCookies);

  const result = {
    ok,
    status: response.status,
    statusText: response.statusText,
    message: ok ? "fetch-login-ok" : "fetch-login-not-confirmed",
    cookieNames,
    hasAccessToken,
    hasAuthCookies
  };

  log("preflight login result", {
    username,
    ok,
    status: response.status,
    cookieNames
  });

  return result;
}

module.exports = {
  loginAccountWithFetch
};
