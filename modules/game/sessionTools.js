const { session } = require("electron");

const TARGET_URL = "https://getkisskiss.com/";

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function settleLoginSession(partition) {
  const ses = session.fromPartition(partition);

  if (ses.cookies && typeof ses.cookies.flushStore === "function") {
    await ses.cookies.flushStore();
  }

  await delay(700);
  return getCookieNames(partition);
}

async function clearPartition(partition) {
  const ses = session.fromPartition(String(partition || "persist:main"));

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
}

async function getCookieNames(partition) {
  const ses = session.fromPartition(String(partition || "persist:main"));
  const cookies = await ses.cookies.get({ url: TARGET_URL });
  return cookies.map(cookie => cookie.name);
}

module.exports = {
  settleLoginSession,
  clearPartition,
  getCookieNames
};
