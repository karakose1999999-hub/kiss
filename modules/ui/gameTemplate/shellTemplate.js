function buildGameShellHtml({ gridClass, slotMarkup, clientScript }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Kiss Auto - Game</title>
<style>
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

.game-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

.grid {
  position: absolute;
  inset: 10px;
  display: grid;
  gap: 10px;
}

.grid-one {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.grid-two {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: 1fr;
}

.grid-four {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.slot {
  position: relative;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: #111;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.55);
  transition: all 0.22s ease;
}

.slot.focus {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 5000 !important;
  border: 3px solid #ffd700 !important;
  border-radius: 0 !important;
  background: #000;
}

body.has-focus .slot:not(.focus) {
  opacity: 0;
  pointer-events: none;
}

.slot-head {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  width: max-content;
  max-width: min(320px, calc(100% - 16px));
  pointer-events: none;
}

.slot-title,
.slot-status {
  width: auto;
  min-width: 96px;
  max-width: min(300px, calc(100vw - 32px));
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.68);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}

.slot-status {
  color: #d8e8ff;
}

.slot-focus-btn {
  pointer-events: auto;
  width: auto;
  min-width: 72px;
  max-width: min(220px, calc(100vw - 32px));
  padding: 4px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.slot-status.ok {
  color: #adffd0;
}

.slot-status.warn {
  color: #ffe6a3;
}

.slot-status.bad {
  color: #ffb2c1;
}

webview {
  width: 100%;
  height: 100%;
  border: none;
  background: #000;
}

.slot-login-overlay {
  position: absolute;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background:
    radial-gradient(circle at 50% 36%, rgba(85, 221, 255, 0.16), transparent 42%),
    rgba(3, 10, 17, 0.94);
  color: #edf8ff;
  pointer-events: auto;
}

.slot-login-overlay[hidden] {
  display: none !important;
}

.slot-login-card {
  width: min(360px, 86%);
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 18px 16px;
  border: 1px solid rgba(141, 226, 255, 0.22);
  border-radius: 8px;
  background: rgba(10, 24, 38, 0.88);
  box-shadow: 0 22px 52px rgba(0, 0, 0, 0.44);
  text-align: center;
}

.slot-login-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(141, 226, 255, 0.22);
  border-top-color: #55ddff;
  border-radius: 50%;
  animation: slot-login-spin 0.85s linear infinite;
}

.slot-login-title {
  max-width: 100%;
  color: #f4fbff;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slot-login-text {
  max-width: 100%;
  color: #9fb9ca;
  font-size: 12px;
  line-height: 1.45;
}

@keyframes slot-login-spin {
  to { transform: rotate(360deg); }
}

.toolbar {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 7000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.toolbar button {
  width: 118px;
  text-align: left;
}

button {
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  cursor: pointer;
  user-select: none;
}

button:hover {
  background: rgba(20, 20, 20, 0.9);
}

#backBtn {
  background: rgba(120, 20, 20, 0.78);
}

#fullscreenBtn {
  display: none;
  position: fixed;
  right: 10px;
  bottom: 10px;
  z-index: 7000;
}
</style>
</head>
<body>
  <div class="game-root">
    <div class="grid ${gridClass}">
      ${slotMarkup}
    </div>

    <div class="toolbar">
      <button id="activeFocusBtn" type="button">Aktiflik: Aktif</button>
      <button id="diagnosticLogBtn" type="button">Tanı Logu: Kapalı</button>
      <button id="maintenanceHostBtn" type="button">Bakım: Kapalı</button>
      <button id="refreshBtn" type="button">Yenile</button>
      <button id="clearHistoryBtn" type="button">Ge&ccedil;mi&#351;i Temizle</button>
      <button id="backBtn" type="button">Hesaplara D&ouml;n</button>
    </div>

    <button id="fullscreenBtn" type="button">Tam Ekran</button>
  </div>

  <script>
${clientScript}
  </script>
</body>
</html>`;
}

module.exports = {
  buildGameShellHtml
};
