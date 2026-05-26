const { escapeAttr, escapeHtml } = require("./templateUtils");

function buildSlotMarkup(entries) {
  return entries.map((entry, index) => {
    const slotId = `slot${index}`;
    const viewId = `gameView${index}`;

    return `
      <div class="slot" id="${slotId}" data-slot-index="${index}" title="Çift tıkla: Öne al / geri bırak">
        <div class="slot-head">
          <span class="slot-status" id="slotStatus${index}">Haz&#305;rlan&#305;yor</span>
          <span class="slot-title">${escapeHtml(entry.label)}</span>
          <button class="slot-focus-btn" id="slotFocusBtn${index}" type="button">&Ouml;ne Al</button>
        </div>
        <webview
          id="${viewId}"
          src="about:blank"
          partition="${escapeAttr(entry.partition)}"
          allowpopups
        ></webview>
        <div class="slot-login-overlay" id="slotLoginOverlay${index}" hidden>
          <div class="slot-login-card">
            <div class="slot-login-spinner" aria-hidden="true"></div>
            <div class="slot-login-title" id="slotLoginTitle${index}">Giriş hazırlanıyor</div>
            <div class="slot-login-text" id="slotLoginText${index}">Oturum güvenli şekilde kontrol ediliyor.</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

module.exports = {
  buildSlotMarkup
};
