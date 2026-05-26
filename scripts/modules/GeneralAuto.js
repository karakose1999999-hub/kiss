function createAutoSpinModule(utils) {
    return {
        name: "autoSpinTab1",
        title: "Genel Auto",

        defaultSettings: createGeneralAutoDefaultSettings(),

        renderSettings(container) {
            try {
                if (typeof window.__KISS_GENERAL_AUTO_CLEANUP === "function") {
                    window.__KISS_GENERAL_AUTO_CLEANUP();
                }
            } catch (_) {}

            const ctx = createGeneralAutoSharedContext(utils, this);
            ctx.installRoomWatcher();

            const panel = utils.el("div", {
                css: {
                    display: "grid",
                    gap: "8px",
                    background: "#222",
                    color: "#bada55",
                    padding: "12px 18px",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    border: "2px solid #bada55",
                    boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                    whiteSpace: "pre-line"
                }
            });
            container.appendChild(panel);

            let features = [];
            let renderScheduled = false;

            function requestRender() {
                if (renderScheduled) return;
                renderScheduled = true;
                setTimeout(() => {
                    renderScheduled = false;
                    renderPanel();
                }, 0);
            }

            features = createGeneralAutoFeatures(ctx, requestRender);

            function featureRow(feature) {
                const running = feature.isRunning();
                const row = utils.el("div", {
                    css: {
                        marginBottom: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px"
                    }
                });
                const label = utils.el("span", {
                    html: `<strong>${feature.label}</strong>: ${running ? "Aktif" : "Pasif"}`
                });
                const button = utils.el("button", {
                    text: running ? "Durdur" : "Başlat",
                    css: { cursor: "pointer", marginLeft: "6px" }
                });
                button.addEventListener("click", () => {
                    if (running) {
                        feature.stop();
                        if (feature.storageKey) ctx.settings.manualStopped[feature.storageKey] = true;
                    } else {
                        if (feature.storageKey) ctx.settings.manualStopped[feature.storageKey] = false;
                        feature.start();
                    }
                    ctx.saveSettings();
                    requestRender();
                });
                row.append(label, button);
                return row;
            }

            function renderPanel() {
                panel.innerHTML = "";

                if (!features.length) {
                    panel.appendChild(utils.el("div", { text: "Açık otomasyon yok." }));
                    return;
                }

                const extras = [];
                features.forEach(feature => {
                    panel.appendChild(featureRow(feature));
                    if (typeof feature.renderExtra === "function") {
                        const extra = feature.renderExtra();
                        if (extra) extras.push(extra);
                    }
                });
                extras.forEach(extra => panel.appendChild(extra));
            }

            const autoStartTimer = setInterval(() => {
                features.forEach(feature => {
                    if (typeof feature.autoStart === "function") feature.autoStart();
                });
                requestRender();
            }, ctx.cfg.autoCheckInterval);

            try {
                window.__KISS_GENERAL_AUTO_CLEANUP = () => {
                    try { clearInterval(autoStartTimer); } catch (_) {}
                    try {
                        features.forEach(feature => {
                            if (feature && typeof feature.destroy === "function") feature.destroy();
                        });
                    } catch (_) {}
                };
            } catch (_) {}

            features.forEach(feature => {
                if (feature.storageKey && !ctx.settings.manualStopped[feature.storageKey]) feature.start();
                if (typeof feature.autoStart === "function") feature.autoStart();
            });
            renderPanel();
        }
    };
}
