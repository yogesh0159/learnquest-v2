require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");

const db = require("./db");
const seedDatabase = require("./db/seed");
const logger = require("./utils/logger");
const { apiLimiter } = require("./utils/rate-limit");
const authRoutes = require("./routes/auth");
const childRoutes = require("./routes/child");
const questionRoutes = require("./routes/questions");
const gameRoutes = require("./routes/game");
const rewardRoutes = require("./routes/rewards");
const parentRoutes = require("./routes/parent");
const taskRoutes = require("./routes/tasks");
const missionRoutes = require("./routes/missions");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const isProd = process.env.NODE_ENV === "production";
const frontendDir = path.join(__dirname, "..", "frontend");
// Three.js lives in backend/node_modules (Railway) or the project root node_modules (local portable bundle).
const threeDir = [path.join(__dirname, "node_modules", "three"), path.join(__dirname, "..", "node_modules", "three")].find((d) => require("fs").existsSync(path.join(d, "build", "three.module.js"))) || path.join(__dirname, "node_modules", "three");

// Railway (and most PaaS) sit behind a reverse proxy — trust the first hop so
// req.ip / rate-limiting see the real client IP instead of the proxy's.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Security headers. Several legacy pages still contain inline script/style
// blocks, so unsafe-inline remains temporarily. unsafe-eval is not required by
// LearnQuest/Three.js and is deliberately excluded.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        // 'wasm-unsafe-eval' only allows compiling WebAssembly (not eval()); enabled for the local explorer, production headers stay unchanged.
        scriptSrc: ["'self'", "'unsafe-inline'", ...(process.env.LQ_EXPLORER === "1" ? ["'wasm-unsafe-eval'"] : []), "https://cdn.jsdelivr.net", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        // blob: lets three.js read GLB-embedded textures; enabled for the local explorer only so production headers stay unchanged.
        connectSrc: ["'self'", ...(process.env.LQ_EXPLORER === "1" ? ["blob:"] : []), "https://cdn.jsdelivr.net", "https://unpkg.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
// Only the public character inspector may be embedded by our own reference studio.
// All authenticated/game pages retain the default frame-ancestors 'none' policy.
app.use((req, res, next) => {
  // The local self-check page embeds the game in an iframe (explorer mode only).
  if (req.path === "/character-lab.html" || (process.env.LQ_EXPLORER === "1" && req.path === "/jungle-local-preview.html")) {
    const policy = res.getHeader("Content-Security-Policy");
    if (typeof policy === "string") res.setHeader("Content-Security-Policy", policy.replace("frame-ancestors 'none'", "frame-ancestors 'self'"));
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

// CORS policy:
// - Development: permissive for local tooling.
// - Production + no ALLOWED_ORIGINS: no cross-origin headers (true same-origin default).
// - Production + ALLOWED_ORIGINS: only explicitly listed origins receive CORS access.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// The installed apps load the game from their own origin and call this server over HTTPS:
//   Android (Capacitor) https://localhost | iOS (Capacitor) capacitor://localhost | desktop (Electron) http://127.0.0.1:47655
// APP_ORIGINS=1 adds exactly these to the allow-list (nothing else is opened up).
const APP_ORIGIN_LIST = ["https://localhost", "http://localhost", "capacitor://localhost", "ionic://localhost", "http://127.0.0.1:47655"];
if (process.env.APP_ORIGINS === "1") for (const o of APP_ORIGIN_LIST) if (!allowedOrigins.includes(o)) allowedOrigins.push(o);

let corsOptions;
if (!isProd) {
  corsOptions = { origin: true };
} else if (allowedOrigins.length === 0) {
  corsOptions = { origin: false };
} else {
  // Listed origins, and always this site's own origin (a browser sends Origin on same-origin POSTs too).
  corsOptions = (req, callback) => {
    const origin = req.get("origin");
    const own = `${req.protocol}://${req.get("host")}`;
    if (!origin || origin === own || allowedOrigins.includes(origin)) return callback(null, { origin: true });
    const err = new Error("Not allowed by CORS");
    err.status = 403;
    return callback(err);
  };
}
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: "256kb" }));
app.use("/api", apiLimiter);

// Keep the game engine self-hosted so core gameplay does not depend on a CDN.
app.use(
  "/vendor/three",
  express.static(path.join(threeDir, "build"), { maxAge: "7d", immutable: true })
);
// Three.js official add-ons (GLTFLoader, DRACOLoader, etc.) are exposed locally
// for the RealWorld asset pipeline. Browser import maps resolve their bare
// `three` imports back to the local build above.
app.use(
  "/vendor/three-addons",
  express.static(path.join(threeDir, "examples", "jsm"), { maxAge: "7d", immutable: true })
);

// Local explorer only: serve the untouched source GLBs so the asset gallery can compare them with the runtime copies.
if (process.env.LQ_EXPLORER === "1") app.use("/source-assets", express.static(path.join(__dirname, "..", "source_assets"), { maxAge: 0 }));

// Static frontend: long-lived cache for versioned/library assets, short/no
// cache for HTML so deploys are picked up immediately by returning clients.
app.use(
  express.static(frontendDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else if (/\.(?:js|mjs|css|json)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else if (/\.(glb|gltf|bin|ktx2|webp|png|jpe?g|woff2?)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({ method: req.method, url: req.originalUrl, status: res.statusCode, ms: Date.now() - start }, "request");
  });
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/child", childRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/missions", missionRoutes);
// Game engine on the server: Python worker when it starts and passes its self-test, JavaScript otherwise (same answers).
const { EngineService } = require("./engine/engine-service");
const engine = new EngineService({ logger });
app.use("/api/engine", require("./routes/engine")(engine));
engine.init().catch((e) => logger.error({ err: e.message }, "engine init failed"));
process.on("exit", () => { try { engine.python?.proc?.kill(); } catch { /* already gone */ } });
if (process.env.LQ_EXPLORER === "1") app.use("/api/explorer", require("./routes/explorer"));   // local testing helper, never mounted in production

app.get("/api/health", async (req, res) => {
  const startedAt = Date.now();
  try {
    await db.ping();
    res.json({ ok: true, service: "learnquest-api", database: db.getDialect(), dbLatencyMs: Date.now() - startedAt });
  } catch (err) {
    res.status(503).json({ ok: false, service: "learnquest-api", database: db.getDialect(), error: "Database unavailable" });
  }
});

app.get("/", (req, res) => res.sendFile(path.join(frontendDir, "index.html")));
app.use("/api", (req, res) => res.status(404).json({ error: "API route not found" }));

app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack, path: req.originalUrl }, "Request error");
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Internal server error" });
});

let server;

async function start() {
  await db.init();
  await seedDatabase();

  server = app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
    logger.info(`🌳 LearnQuest running on port ${PORT}`);
    logger.info(`🎮 Frontend: /  |  API health: /api/health`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await db.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  logger.error({ err: err.message, stack: err.stack }, "LearnQuest failed to start");
  process.exit(1);
});
