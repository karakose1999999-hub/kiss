function commonWebPreferences() {
  return {
    nodeIntegration: true,
    contextIsolation: false,
    webviewTag: true,
    backgroundThrottling: false
  };
}

function accountsWindowOptions() {
  return {
    width: 1140,
    height: 740,
    minWidth: 980,
    minHeight: 640,
    title: "Kiss Auto V.1",
    show: false,
    frame: true,
    transparent: false,
    backgroundColor: "#08111d",
    webPreferences: commonWebPreferences()
  };
}

module.exports = {
  accountsWindowOptions,
  commonWebPreferences
};
