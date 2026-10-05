// Starts the FULL LearnQuest app (frontend + API + database) on this computer for testing everything.
// No native modules and no MySQL needed: SQLite comes from Node itself (node:sqlite).
const path = require("path");
const root = path.join(__dirname, "..");
const set = (k, v) => { if (!process.env[k]) process.env[k] = v; };
set("PORT", process.env.EXPLORER_PORT || "4000");
set("HOST", "127.0.0.1");                        // this computer only: nothing is exposed to the network
set("NODE_ENV", "development");
set("JWT_SECRET", "learnquest-local-explorer-secret");
set("SQLITE_PATH", path.join(root, "backend", "learnquest-explorer.sqlite"));
set("LQ_EXPLORER", "1");
set("LOG_LEVEL", "warn");
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) { console.error(`Node ${process.versions.node} is too old: the built-in SQLite needs Node 22.13+ (Node 24 recommended).`); process.exit(1); }
console.log(`\n LearnQuest FULL local app - Node ${process.versions.node}`);
console.log(`   Explorer hub:  http://127.0.0.1:${process.env.PORT}/explorer.html`);
console.log(`   Database file: ${process.env.SQLITE_PATH}\n   (delete that file any time to start with a clean database)\n`);
require("../backend/server.js");
