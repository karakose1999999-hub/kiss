// GeneralAutoClose.js
function createGeneralAutoCloseFeature(ctx, requestRender) {
    const state = { running: false, timer: null };

    function closePopups() {
        const selectors = [
            ".notify__close", ".popup__close", ".modal__close", ".close", ".btn-close",
            "[data-close]", "[aria-label='close']", "[aria-label='kapat']",
            "button.close", "button[title='Kapat']", "button[title='Close']"
        ];
        document.querySelectorAll(selectors.join(",")).forEach(btn => {
            try { btn.click(); } catch (_) {}
        });
    }

    function start() {
        if (state.running) return;
        state.running = true;
        closePopups();
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(closePopups, Math.max(800, ctx.cfg.autoCheckInterval));
        requestRender();
    }

    function stop() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
        requestRender();
    }

    function destroy() {
        state.running = false;
        if (state.timer) clearInterval(state.timer);
        state.timer = null;
    }

    return {
        key: "autoClose",
        storageKey: "close",
        label: "Sekmeleri Kapat",
        isRunning: () => state.running,
        start,
        stop,
        destroy
    };
}
