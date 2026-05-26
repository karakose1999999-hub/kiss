const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

const files = [
  path.join(root, "main.js"),
  path.join(root, "modules", "diagnosticLogger.js"),
  path.join(root, "modules", "diagnosticLoggerConfig.js"),
  path.join(root, "modules", "windows", "accountsWindow.js"),
  path.join(root, "modules", "windows", "windowConfig.js"),
  path.join(root, "modules", "windows", "windowLogFilters.js"),
  path.join(root, "modules", "runtime", "gameRuntime.js"),
  path.join(root, "modules", "runtime", "gameEntryBuilder.js"),
  path.join(root, "modules", "runtime", "gameRuntimeState.js"),
  path.join(root, "modules", "runtime", "kissFallbackHost.js"),
  path.join(root, "modules", "runtime", "kissFallbackService.js"),
  path.join(root, "modules", "runtime", "maintenanceFullMode.js"),
  path.join(root, "modules", "runtime", "maintenanceRelaunchStore.js"),
  path.join(root, "modules", "runtime", "moduleSettings.js"),
  path.join(root, "modules", "ui", "htmlTemplate.js"),
  ...listJsFiles(path.join(root, "modules", "ui", "gameTemplate")),
  path.join(root, "modules", "store", "scriptSettingsStore.js"),
  path.join(root, "modules", "store", "scriptCatalog.js"),
  ...listJsFiles(path.join(root, "scripts", "core")),
  ...listJsFiles(path.join(root, "scripts", "modules")),
  path.join(root, "scripts", "bootstrap.js"),
  path.join(root, "scripts", "builder.js")
].filter(file => fs.existsSync(file));

files.forEach(file => {
  run(process.execPath, ["--check", file]);
});

run(process.execPath, [path.join(root, "scripts", "builder.js")]);
run(process.execPath, ["--check", path.join(root, "scripts", "main.user.js")]);

console.log("Check tamamlandi.");
