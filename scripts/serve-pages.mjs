// Serves a built site the way GitHub Pages does: only under its base path, 404 elsewhere, Pages-like headers (10 minute cache, no custom headers).
//   node scripts/serve-pages.mjs site /LearnQuest/ 8080     then open http://127.0.0.1:8080/LearnQuest/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [dir = "site", baseArg = "/", portArg = "8080"] = process.argv.slice(2); const base = baseArg.endsWith("/") ? baseArg : baseArg + "/"; const root = path.resolve(dir);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".txt": "text/plain" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!p.startsWith(base)) { res.writeHead(404, { "Content-Type": "text/html" }); return res.end("<h1>404</h1> File not found (GitHub Pages style)"); }
  let rel = p.slice(base.length); if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(root, rel)); if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => { if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/html" }); return res.end("<h1>404</h1> File not found (GitHub Pages style)"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "max-age=600", "Access-Control-Allow-Origin": "*" }); fs.createReadStream(file).pipe(res); });
}).listen(Number(portArg), "127.0.0.1", () => console.log(`serving ${root} at http://127.0.0.1:${portArg}${base}`));
