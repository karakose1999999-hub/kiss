const source = String.raw`function autoFitWebview(index) {
  const webview = getGameWebview(index);
  if (!webview) return;

  const rect = webview.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const zoom = Math.min(rect.width / 1920, rect.height / 1080);

  try {
    webview.setZoomFactor(zoom);
  } catch (error) {}
}

function autoFitAllWebviews() {
  entries.forEach((_entry, index) => autoFitWebview(index));
}

function insertBaseCss(webview) {
  try {
    webview.insertCSS(
      "::-webkit-scrollbar{display:none!important;} html,body{overflow:hidden!important;margin:0!important;padding:0!important;}"
    );
  } catch (error) {}
}

function installFocusBridge(index, webview) {
  try {
    webview.executeJavaScript(
      "(function(){" +
      "if(window.__kissFocusBridgeInstalled)return;" +
      "window.__kissFocusBridgeInstalled=true;" +
      "document.addEventListener('dblclick',function(){console.log('__KISS_SLOT_DBLCLICK__');},true);" +
      "})();",
      false
    );
  } catch (error) {
    slotLog(index, "focus bridge failed", error && error.message ? error.message : error);
  }
}
`;

module.exports = {
  source
};
