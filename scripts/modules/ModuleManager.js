// moduleManager.js
function createModuleManagerModule(utils) {
    const STORAGE_KEY = "moduleManager_enabledModules";

    function loadEnabled() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
            const injected = window.__KISS_MODULE_SETTINGS || null;

            if (!injected || typeof injected !== "object") return stored;

            const fromLauncher = {};
            if (
                injected.generalAuto !== undefined ||
                injected.autoSpinTab1 !== undefined ||
                injected.autoKiss !== undefined ||
                injected.autoClose !== undefined ||
                injected.activeGuard !== undefined
            ) {
                fromLauncher.autoSpinTab1 = !!(
                    injected.generalAuto ||
                    injected.autoSpinTab1 ||
                    injected.autoKiss ||
                    injected.autoClose ||
                    injected.activeGuard
                );
            }
            if (injected.autoCombo !== undefined) fromLauncher.autoCombo = !!injected.autoCombo;
            if (injected.idRoomFollower !== undefined) fromLauncher.idRoomFollower = !!injected.idRoomFollower;
            if (injected.visualCleanerUltimateFixedV9 !== undefined) {
                fromLauncher.visualCleanerUltimateFixedV9 = !!injected.visualCleanerUltimateFixedV9;
            }
            if (injected.messageCleaner !== undefined) fromLauncher.messageCleaner = !!injected.messageCleaner;

            const merged = { ...stored, ...fromLauncher };
            saveEnabled(merged);
            return merged;
        } catch (_) {
            return {};
        }
    }

    function saveEnabled(obj) {
        const value = JSON.stringify(obj);
        localStorage.setItem(STORAGE_KEY, value);
        if (typeof window.__KISS_ACCOUNT_SAVE_SETTING === "function") {
            window.__KISS_ACCOUNT_SAVE_SETTING(STORAGE_KEY, value);
        }
    }

    let allDefs = [];

    return {
        name: "moduleManager",
        title: "Modüller",
        defaultSettings: {},

        setModuleDefinitions(list) {
            allDefs = list || [];
        },

        loadEnabledMap() {
            return loadEnabled();
        },

        renderSettings(container) {
            container.innerHTML = "";
            const enabledMap = loadEnabled();

            allDefs.forEach(def => {
                if (enabledMap[def.name] === undefined) enabledMap[def.name] = true;
            });
            saveEnabled(enabledMap);

            container.appendChild(utils.el("div", {
                text: "Modül seçimi Hesaplarım ekranından yönetiliyor."
            }));
        }
    };
}


