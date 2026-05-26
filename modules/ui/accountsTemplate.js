const { buildAccountsStyles } = require("./accountsStyles");
const { buildAccountsRenderer } = require("./accountsRenderer");

function buildAccountsTemplate() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kiss Auto V.1</title>
  <style>${buildAccountsStyles()}</style>
</head>
<body>
  <main class="app">
    <header class="topbar">
      <div>
        <div class="brand">Kiss Auto V.1</div>
        <div class="brand-sub">Hesap yönetimi</div>
      </div>
      <div class="top-status" id="topStatus">Hazır</div>
    </header>

    <section class="surface" id="surfaceRoot">
      <section class="panel list-panel" id="listPanel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Hesaplarım</div>
            <div class="panel-sub" id="accountCountText">0 hesap</div>
          </div>
          <button id="repeatLastSelectionBtn" class="btn btn-secondary btn-compact repeat-last-btn" type="button" title="Pencere kapanmadan önce açılan son hesaplarla başlat">
            Son Seçilenleri Tekrar Aç
          </button>
        </div>
        <div id="accountsList" class="account-list"></div>
        <div class="list-actions">
          <button id="addBtn" class="btn btn-primary" type="button">Hesap Ekle</button>
          <button id="selectAllBtn" class="btn btn-secondary" type="button">Tümünü Seç</button>
          <button id="multiBtn" class="btn btn-secondary" type="button">Çoklu Oyun</button>
          <button id="multiCancelBtn" class="btn btn-secondary" type="button">İptal</button>
        </div>
      </section>

      <aside class="side-panel" id="sidePanel">
        <section class="panel form-panel" id="formPanel">
          <div class="panel-head">
            <div>
              <div class="panel-title" id="formTitle">Yeni Hesap</div>
              <div class="panel-sub">Bilgiler yalnızca bu cihazda saklanır</div>
            </div>
          </div>
          <div class="form-body">
            <div id="formError" class="form-error"></div>
            <label class="field">
              <span>Hesap Adı</span>
              <input id="labelInput" class="input" placeholder="Örn: Ana Hesap" />
            </label>
            <label class="field">
              <span>E-posta veya Telefon</span>
              <input id="usernameInput" class="input" placeholder="E-posta veya telefon" autocomplete="username" />
            </label>
            <label class="field">
              <span>Şifre</span>
              <div class="password-box">
                <input id="passwordInput" class="input" type="password" placeholder="Şifre" autocomplete="current-password" />
                <button id="eyeBtn" class="icon-btn eye" type="button" title="Şifreyi göster" aria-label="Şifreyi göster"></button>
              </div>
            </label>
          </div>
          <div class="form-actions" id="formActions">
            <button id="saveBtn" class="btn btn-primary" type="button">Hesap Ekle</button>
            <button id="cancelBtn" class="btn btn-secondary" type="button">Vazgeç</button>
          </div>
        </section>

        <section class="panel scripts-panel" id="scriptsPanel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Başlangıç Scriptleri</div>
              <div class="panel-sub">Oyunda açılacak modüller</div>
            </div>
          </div>
          <div id="scriptsList" class="scripts-list"></div>
        </section>
      </aside>
    </section>

    <div id="confirmOverlay" class="modal-overlay" aria-hidden="true">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div class="modal-title" id="confirmTitle">Hesabı sil</div>
        <div class="modal-text" id="confirmText">Bu hesap listeden kaldırılacak.</div>
        <div class="modal-actions">
          <button id="confirmCancelBtn" class="btn btn-secondary" type="button">Vazgeç</button>
          <button id="confirmDeleteBtn" class="btn btn-danger" type="button">Sil</button>
        </div>
      </section>
    </div>
  </main>

  <script>${buildAccountsRenderer()}</script>
</body>
</html>`;
}

module.exports = {
  buildAccountsTemplate
};
