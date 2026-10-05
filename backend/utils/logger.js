const pino = require("pino");

// Structured JSON logs in production (easy to ship to Railway log drains / any
// aggregator). In development, pretty-print if pino-pretty is available;
// otherwise fall back to plain pino output so a missing devDependency never
// breaks startup.
const isProd = process.env.NODE_ENV === "production";

let transport;
if (!isProd) {
  try {
    require.resolve("pino-pretty");
    transport = { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } };
  } catch {
    transport = undefined;
  }
}

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  transport,
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.password_hash", "*.pin", "*.token"],
    remove: true,
  },
});

module.exports = logger;
