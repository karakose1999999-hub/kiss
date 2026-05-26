const chokidar = require("chokidar");
const { exec } = require("child_process");
const path = require("path");

const builder = path.join(__dirname, "builder.js");

// İzlenecek klasörler
const watchPaths = [
    path.join(__dirname, "core"),
    path.join(__dirname, "modules"),
    path.join(__dirname, "bootstrap.js"),
];

console.log("👀 Watching for changes...");

let timeout = null;

function rebuild() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        console.log("\n⚙️  Rebuilding...");
        exec(`node "${builder}"`, (err, stdout, stderr) => {
            if (err) console.error("❌ ERROR:", err);
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
        });
    }, 200);
}

watchPaths.forEach((p) => {
    chokidar.watch(p, { ignoreInitial: true }).on("all", rebuild);
});
