// Copies the game into desktop/app: the website files and exactly the three.js files the game imports (listed in precache-manifest.json).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(here, "..");
const out = path.join(here, "app"); fs.rmSync(out, { recursive: true, force: true });
import { isExcludedFromApps } from "../scripts/app-files.mjs";
const fe = path.join(root, "frontend");
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name); if (isExcludedFromApps(path.relative(fe, a).split(path.sep).join("/"))) continue; e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); } };
copyDir(fe, path.join(out, "frontend"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "frontend", "precache-manifest.json"), "utf8"));
const three = path.join(root, "node_modules", "three"); let n = 0;
for (const { url } of manifest.shell.filter((e) => e.url.startsWith("/vendor/"))) {
  const src = url.startsWith("/vendor/three-addons/") ? path.join(three, "examples", "jsm", url.slice("/vendor/three-addons/".length)) : path.join(three, "build", url.slice("/vendor/three/".length));
  const dst = path.join(out, url.slice(1)); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); n++;
}
const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`desktop/app ready: website files + ${n} three.js files, ${(size(out) / 1e6).toFixed(0)} MB`);
