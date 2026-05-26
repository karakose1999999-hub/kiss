const fs = require("fs");
const path = require("path");

function loadScripts() {
  const mainUserFile = path.join(__dirname, "../scripts/main.user.js");

  try {
    if (!fs.existsSync(mainUserFile)) {
      console.warn("[NewScriptLoader] main.user.js yok, builder çalışmamış:", mainUserFile);
      return [];
    }

    return [{
      name: "main.user.js",
      code: fs.readFileSync(mainUserFile, "utf8")
    }];
  } catch (error) {
    console.warn("[NewScriptLoader] main.user.js okunamadı:", error.message);
    return [];
  }
}

module.exports = {
  loadScripts
};