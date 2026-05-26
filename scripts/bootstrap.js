// bootstrap.js
function initializeToolkit() {
    const existingPanel = document.getElementById("kiss-toolkit-panel");
    if (existingPanel) return true;

    if (!document.body) {
        setTimeout(initializeToolkit, 300);
        return false;
    }

    if (window.__ToolkitPanel && window.__ToolkitPanel.panel) {
        try {
            document.body.appendChild(window.__ToolkitPanel.panel);
            return true;
        } catch (_) {}
    }

    if (window.__KISS_TOOLKIT_INITIALIZING) return false;
    window.__KISS_TOOLKIT_INITIALIZING = true;

    try {
        console.log("[Toolkit] starting");

        const registry = new ToolkitModuleRegistry(StorageUtils);
        const panel = new ToolkitPanel(StorageUtils);

        const moduleManager = createModuleManagerModule(StorageUtils);
        registry.register(moduleManager);
        const enabledMap = moduleManager.loadEnabledMap();

        const allDefinitions = [
            createAutoSpinModule(StorageUtils),
            createAutoComboModule(StorageUtils),
            createIdRoomFollowerModule(StorageUtils),
            createVisualCleanerModule(StorageUtils),
            createMessageCleanerModule()
        ];

        moduleManager.setModuleDefinitions(allDefinitions);

        const launcherSettings = window.__KISS_MODULE_SETTINGS || {};
        if (launcherSettings && typeof launcherSettings === "object") {
            let hasStoredAutoSettings = false;
            try {
                hasStoredAutoSettings = localStorage.getItem(StorageUtils.getKey("autoSpinTab1")) !== null;
            } catch (_) {}

            if (!hasStoredAutoSettings) {
                const autoSpinDefaults = createAutoSpinModule(StorageUtils).defaultSettings || {};
                const autoSpinSettings = StorageUtils.loadSettings("autoSpinTab1", autoSpinDefaults);
                autoSpinSettings.manualStopped = autoSpinSettings.manualStopped || { spin: false, kiss: false, close: false };

                if (launcherSettings.autoSpinTab1 !== undefined) {
                    autoSpinSettings.manualStopped.spin = !launcherSettings.autoSpinTab1;
                }
                if (launcherSettings.autoKiss !== undefined) {
                    autoSpinSettings.manualStopped.kiss = !launcherSettings.autoKiss;
                }
                if (launcherSettings.autoClose !== undefined) {
                    autoSpinSettings.manualStopped.close = !launcherSettings.autoClose;
                }
                if (launcherSettings.activeGuard !== undefined) {
                    autoSpinSettings.guardEnabled = !!launcherSettings.activeGuard;
                }
                autoSpinSettings.forceRetAll = false;
                StorageUtils.saveSettings("autoSpinTab1", autoSpinSettings);
            }
        }

        const activeModules = [];
        allDefinitions.forEach(def => {
            const enabled = enabledMap[def.name] !== false;
            if (enabled) activeModules.push(registry.register(def));
        });

        activeModules.forEach(module => panel.attachModule(module));
        panel.showFirstModule();

        window.__ToolkitPanel = panel;
        window.__KISS_TOOLKIT_READY_AT = Date.now();
        window.__KISS_TOOLKIT_INITIALIZING = false;
        console.log("[Toolkit] ready");
        return true;
    } catch (error) {
        window.__KISS_TOOLKIT_INITIALIZING = false;
        console.error("[Toolkit] init failed", error && error.message ? error.message : error);
        setTimeout(initializeToolkit, 1000);
        return false;
    }
}

function ensureToolkitAttached() {
    try {
        if (!document.body) return;
        if (document.getElementById("kiss-toolkit-panel")) return;

        if (window.__ToolkitPanel && window.__ToolkitPanel.panel) {
            document.body.appendChild(window.__ToolkitPanel.panel);
            return;
        }

        initializeToolkit();
    } catch (_) {}
}

function installToolkitSelfWatchdog() {
    if (window.__KISS_TOOLKIT_SELF_WATCHDOG) return;
    window.__KISS_TOOLKIT_SELF_WATCHDOG = true;

    setInterval(ensureToolkitAttached, 3000);

    try {
        const root = document.documentElement || document;
        const observer = new MutationObserver(() => {
            if (!document.getElementById("kiss-toolkit-panel")) {
                setTimeout(ensureToolkitAttached, 250);
            }
        });
        observer.observe(root, { childList: true, subtree: true });
        window.__KISS_TOOLKIT_OBSERVER = observer;
    } catch (_) {}
}

window.__KISS_FORCE_TOOLKIT_INIT = initializeToolkit;
window.__KISS_ENSURE_TOOLKIT_ATTACHED = ensureToolkitAttached;

installToolkitSelfWatchdog();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeToolkit);
} else {
    initializeToolkit();
}

setTimeout(initializeToolkit, 500);
setTimeout(initializeToolkit, 1500);


