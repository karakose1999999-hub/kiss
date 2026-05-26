// builder.js
const fs = require("fs");
const path = require("path");

const outFile = path.join(__dirname, "main.user.js");

const header = `// ==UserScript==
// @name        KissKiss Toolkit - Modular Panel (Build)
// @namespace   http://tampermonkey.net/
// @version     1.2
// @description Modular panel with settings, storage, drag and taller view.
// @match       https://getkisskiss.com/*
// @grant       none
// ==/UserScript==

(function(){'use strict';\n`;

const footer = `
})();`;

const MODULE_ORDER = [
    "ModuleManager.js",
    "GameStateProvider.js",
    "ApiScheduler.js",
    "GeneralAutoContextState.js",
    "GeneralAutoContext.js",
    "GeneralAutoSpinState.js",
    "GeneralAutoSpin.js",
    "GeneralAutoKissState.js",
    "GeneralAutoKissView.js",
    "GeneralAutoKiss.js",
    "GeneralAutoClose.js",
    "GeneralAutoGuardState.js",
    "GeneralAutoGuardDom.js",
    "GeneralAutoGuardRoomIds.js",
    "GeneralAutoGuardRuntime.js",
    "GeneralAutoGuardObservation.js",
    "GeneralAutoGuardProfileRecovery.js",
    "GeneralAutoGuardQueueRecovery.js",
    "GeneralAutoGuardRoomChange.js",
    "GeneralAutoGuardProfileOrchestrator.js",
    "GeneralAutoGuardLifecycle.js",
    "GeneralAutoGuard.js",
    "GeneralAutoPerformanceState.js",
    "GeneralAutoPerformance.js",
    "GeneralAutoState.js",
    "GeneralAuto.js",
    "AutoComboState.js",
    "AutoComboApi.js",
    "AutoComboView.js",
    "IdRoomFollowerState.js",
    "IdRoomFollowerApi.js",
    "IdRoomFollowerHelpers.js",
    "IdRoomFollowerRoomLock.js",
    "IdRoomFollowerView.js"
];

function readFile(filePath) {
    return fs.readFileSync(filePath, "utf8") + "\n";
}

function sortModuleFiles(files) {
    return files.sort((a, b) => {
        const ai = MODULE_ORDER.indexOf(a);
        const bi = MODULE_ORDER.indexOf(b);
        if (ai !== -1 || bi !== -1) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        }
        return a.localeCompare(b);
    });
}

function build() {
    let out = header;

    const corePath = path.join(__dirname, "core");
    const coreFiles = fs.existsSync(corePath)
        ? fs.readdirSync(corePath).filter(file => file.endsWith(".js")).sort()
        : [];

    coreFiles.forEach(file => {
        out += `\n// ===== CORE: ${file} =====\n`;
        out += readFile(path.join(corePath, file));
    });

    const modulesPath = path.join(__dirname, "modules");
    const moduleFiles = fs.existsSync(modulesPath)
        ? sortModuleFiles(fs.readdirSync(modulesPath).filter(file => file.endsWith(".js")))
        : [];

    moduleFiles.forEach(file => {
        out += `\n// ===== MODULE: ${file} =====\n`;
        out += readFile(path.join(modulesPath, file));
    });

    const bootstrapFile = path.join(__dirname, "bootstrap.js");
    if (fs.existsSync(bootstrapFile)) {
        out += "\n// ===== BOOTSTRAP =====\n";
        out += readFile(bootstrapFile);
    } else {
        console.warn("bootstrap.js bulunamadı!");
    }

    out += footer;
    fs.writeFileSync(outFile, out, "utf8");
    console.log(`Build tamamlandı -> ${outFile}`);
}

build();
