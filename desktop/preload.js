// Runs before the page. Tells the web code it is inside the desktop app and which LearnQuest server to talk to (for accounts / progress).
const { contextBridge } = require("electron");
const arg = (process.argv.find((a) => a.startsWith("--lq-api-base=")) || "").slice("--lq-api-base=".length);
contextBridge.exposeInMainWorld("LQ_NATIVE_CONFIG", { apiBase: arg });
contextBridge.exposeInMainWorld("LQ_ELECTRON", true);
