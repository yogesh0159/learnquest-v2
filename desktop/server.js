// A tiny static web server that only listens on this computer (127.0.0.1). The game is served from here so that it behaves exactly like the website
// (ES modules, WebAssembly, 3D model files) without needing Node on the player's machine.
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };

function createServer(appRoot) {
  const frontend = path.join(appRoot, "frontend"); const vendor = path.join(appRoot, "vendor");
  return http.createServer((req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/index.html";
      const base = p.startsWith("/vendor/") ? appRoot : frontend; const file = path.normalize(path.join(base, p));
      if (!file.startsWith(base + path.sep) && file !== base) { res.writeHead(403); return res.end("Forbidden"); }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found: " + p); }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": /\.(glb|png|webp|wasm)$/.test(file) ? "public, max-age=86400" : "no-cache", "X-Content-Type-Options": "nosniff" });
        if (req.method === "HEAD") return res.end(); fs.createReadStream(file).pipe(res);
      });
    } catch { res.writeHead(400); res.end("Bad request"); }
  });
}

function listen(server, preferred) {
  return new Promise((resolve) => {
    server.once("error", () => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));      // preferred port busy: any free port
    server.listen(preferred, "127.0.0.1", () => resolve(server.address().port));
  });
}

module.exports = { createServer, listen, PREFERRED_PORT: 47655 };
