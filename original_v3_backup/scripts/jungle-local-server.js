const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const rootThree = path.join(root, "node_modules", "three");
const backendThree = path.join(root, "backend", "node_modules", "three");
const threeRoot = fs.existsSync(path.join(rootThree, "build", "three.module.js")) ? rootThree : backendThree;
const port = Number(process.env.JUNGLE_PORT || 5177);

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

function safeResolve(base, rel) {
  const candidate = path.resolve(base, "." + rel);
  if (!candidate.startsWith(path.resolve(base))) return null;
  return candidate;
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

if (!fs.existsSync(path.join(threeRoot, "build", "three.module.js"))) {
  console.error("\nThree.js is not installed yet. Run `npm install --ignore-scripts` once from the learnquest folder, then retry `npm run jungle:local`.\n");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/jungle-local-preview.html";

  if (pathname.startsWith("/vendor/three-addons/")) {
    const rel = pathname.slice("/vendor/three-addons".length);
    const filePath = safeResolve(path.join(threeRoot, "examples", "jsm"), rel);
    return filePath ? sendFile(res, filePath) : (res.writeHead(403), res.end("Forbidden"));
  }
  if (pathname.startsWith("/vendor/three/")) {
    const rel = pathname.slice("/vendor/three".length);
    const filePath = safeResolve(path.join(threeRoot, "build"), rel);
    return filePath ? sendFile(res, filePath) : (res.writeHead(403), res.end("Forbidden"));
  }

  const filePath = safeResolve(frontend, pathname);
  return filePath ? sendFile(res, filePath) : (res.writeHead(403), res.end("Forbidden"));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`\n🌿 LearnQuest Jungle Local Lab`);
  console.log(`   http://127.0.0.1:${port}/jungle-local-preview.html`);
  console.log(`   (localhost also works on most Windows setups)`);
  console.log(`   Local-only server: no database, login, API, Railway or GitHub required.\n`);
});
