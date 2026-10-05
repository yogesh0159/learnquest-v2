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
  ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

function safeResolve(base, rel) {
  const candidate = path.resolve(base, "." + rel);
  if (candidate !== path.resolve(base) && !candidate.startsWith(path.resolve(base) + path.sep)) return null;
  return candidate;
}

// Files are revalidated (ETag/Last-Modified) so edits show up immediately, but unchanged 20+ MB GLBs
// are answered with a tiny 304 instead of being re-read from disk on every reload.
function sendFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Not found: " + req.url); return; }
    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache", "ETag": etag, "Last-Modified": stat.mtime.toUTCString(),
      "Cross-Origin-Resource-Policy": "same-origin", "X-Content-Type-Options": "nosniff",
    };
    if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); res.end(); return; }
    headers["Content-Length"] = stat.size;
    res.writeHead(200, headers);
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(filePath).on("error", () => res.destroy()).pipe(res);
  });
}

if (!fs.existsSync(path.join(threeRoot, "build", "three.module.js"))) {
  console.error("\nThree.js is not installed yet. Run `npm install --ignore-scripts` once from the learnquest folder, then retry `npm run jungle:local`.\n");
  process.exit(1);
}

const handler = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end("Bad request"); }
  if (pathname === "/__health") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, app: "learnquest-jungle", node: process.versions.node })); }
  if (pathname === "/") pathname = "/jungle-local-preview.html";

  if (pathname.startsWith("/source-assets/")) {          // untouched original GLBs, for the asset gallery
    const fp = safeResolve(path.join(root, "source_assets"), pathname.slice("/source-assets".length));
    return fp ? sendFile(req, res, fp) : (res.writeHead(403), res.end("Forbidden"));
  }
  if (pathname.startsWith("/vendor/three-addons/")) {
    const fp = safeResolve(path.join(threeRoot, "examples", "jsm"), pathname.slice("/vendor/three-addons".length));
    return fp ? sendFile(req, res, fp) : (res.writeHead(403), res.end("Forbidden"));
  }
  if (pathname.startsWith("/vendor/three/")) {
    const fp = safeResolve(path.join(threeRoot, "build"), pathname.slice("/vendor/three".length));
    return fp ? sendFile(req, res, fp) : (res.writeHead(403), res.end("Forbidden"));
  }
  const fp = safeResolve(frontend, pathname);
  return fp ? sendFile(req, res, fp) : (res.writeHead(403), res.end("Forbidden"));
};

const server = http.createServer(handler);
// Node's default 5 s keep-alive races with browsers re-using an idle connection (random 'Failed to fetch' on reload).
server.keepAliveTimeout = 65000; server.headersTimeout = 66000;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${port} is already in use. Probably the Jungle server is already running in another window.`);
    console.error(`Open http://127.0.0.1:${port}/jungle-local-preview.html, or set a different port:  set JUNGLE_PORT=5178\n`);
  } else console.error("\nServer error:", err.message, "\n");
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`\n LearnQuest Jungle Run - local 3D build (Node ${process.versions.node})`);
  console.log(`   http://127.0.0.1:${port}/jungle-local-preview.html`);
  console.log(`   Local-only server: no database, login, API, Railway or GitHub required.`);
  console.log(`   Keep this window open while playing. Press Ctrl+C to stop.\n`);
  // Also answer http://localhost:PORT when Windows resolves "localhost" to IPv6 (::1). Loopback only, never the LAN.
  const v6 = http.createServer(handler); v6.keepAliveTimeout = 65000; v6.headersTimeout = 66000;
  v6.on("error", () => { /* IPv6 loopback unavailable: IPv4 still works */ });
  v6.listen(port, "::1");
});
