const fs = require("fs");
const path = require("path");
const { schoolFeatureEnabled } = require("../utils/features");

let dialect = null;
let mysqlPool = null;
let sqliteDb = null;
let initialized = false;

function mysqlConfigFromEnv() {
  const rawUrl = process.env.MYSQL_URL || (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("mysql") ? process.env.DATABASE_URL : null);
  if (rawUrl) {
    const u = new URL(rawUrl);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    };
  }

  if (process.env.MYSQLHOST && process.env.MYSQLUSER && process.env.MYSQLDATABASE) {
    return {
      host: process.env.MYSQLHOST,
      port: Number(process.env.MYSQLPORT || 3306),
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD || "",
      database: process.env.MYSQLDATABASE,
    };
  }

  return null;
}

function normalizeParams(params) {
  return Array.isArray(params) ? params : [];
}

const mysqlGameRunCompatibilityColumns = {
  integrity_token_hash: "CHAR(64) NULL",
  event_sequence: "INT NOT NULL DEFAULT 0",
  verified_coins: "INT NOT NULL DEFAULT 0",
  verified_keys: "INT NOT NULL DEFAULT 0",
  verified_obstacles: "INT NOT NULL DEFAULT 0",
  last_event_elapsed_ms: "INT NULL",
  last_event_type: "VARCHAR(16) NULL",
};

async function ensureMysqlGameRunColumns(executor) {
  const [rows] = await executor.execute(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    ["game_runs"]
  );
  const existingColumns = new Set(rows.map((row) => row.COLUMN_NAME));

  for (const [name, definition] of Object.entries(mysqlGameRunCompatibilityColumns)) {
    if (!existingColumns.has(name)) {
      await executor.query(`ALTER TABLE game_runs ADD COLUMN \`${name}\` ${definition}`);
    }
  }
}

async function init() {
  if (initialized) return;

  const mysqlConfig = mysqlConfigFromEnv();
  if (mysqlConfig) {
    const mysql = require("mysql2/promise");
    mysqlPool = mysql.createPool({
      ...mysqlConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      dateStrings: true,
      multipleStatements: true,
      enableKeepAlive: true,
    });

    let connected = false;
    let lastError = null;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await mysqlPool.query("SELECT 1");
        connected = true;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`⏳ MySQL not ready (attempt ${attempt}/10). Retrying in 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    if (!connected) throw lastError || new Error("Could not connect to MySQL");

    const schema = fs.readFileSync(path.join(__dirname, "schema.mysql.sql"), "utf8");
    await mysqlPool.query(schema);
    if (schoolFeatureEnabled()) await mysqlPool.query(fs.readFileSync(path.join(__dirname, "school-schema.mysql.sql"), "utf8"));

    // CREATE TABLE IF NOT EXISTS does not alter columns on an existing Railway
    // database. Older LearnQuest releases used VARCHAR(16) for children.pin,
    // while current releases store bcrypt hashes (~60 chars). Widen it
    // automatically on every startup (idempotent) so new child creation and
    // legacy PIN upgrades never fail with "Data too long for column 'pin'".
    await mysqlPool.query("ALTER TABLE children MODIFY COLUMN pin VARCHAR(255) NOT NULL");
    await ensureMysqlGameRunColumns(mysqlPool);

    dialect = "mysql";
    console.log("🗄️ LearnQuest database: MySQL");
    console.log("✅ Database schema compatibility upgrades applied");
  } else {
    const Database = require("better-sqlite3");
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, "learnquest.sqlite");
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sqlite.sql"), "utf8");
    sqliteDb.exec(schema);
    if (schoolFeatureEnabled()) sqliteDb.exec(fs.readFileSync(path.join(__dirname, "school-schema.sqlite.sql"), "utf8"));
    const runColumns = new Set(sqliteDb.prepare("PRAGMA table_info(game_runs)").all().map((column) => column.name));
    const compatibilityColumns = {
      integrity_token_hash: "TEXT",
      event_sequence: "INTEGER NOT NULL DEFAULT 0",
      verified_coins: "INTEGER NOT NULL DEFAULT 0",
      verified_keys: "INTEGER NOT NULL DEFAULT 0",
      verified_obstacles: "INTEGER NOT NULL DEFAULT 0",
      last_event_elapsed_ms: "INTEGER",
      last_event_type: "TEXT",
    };
    for (const [name, definition] of Object.entries(compatibilityColumns)) {
      if (!runColumns.has(name)) sqliteDb.exec(`ALTER TABLE game_runs ADD COLUMN ${name} ${definition}`);
    }
    dialect = "sqlite";
    console.log(`🗄️ LearnQuest database: SQLite (${dbPath})`);
    console.warn("⚠️ MySQL variables were not found. SQLite fallback is active. For Railway production, add MYSQL_URL or MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE to the app service.");
  }

  initialized = true;
}

function ensureReady() {
  if (!initialized) throw new Error("Database has not been initialized. Call db.init() before serving requests.");
}

function makeApi(executorType, executor) {
  return {
    async one(sql, params = []) {
      const rows = await this.all(sql, params);
      return rows[0] || null;
    },

    async all(sql, params = []) {
      const values = normalizeParams(params);
      if (executorType === "mysql") {
        const [rows] = await executor.execute(sql, values);
        return rows;
      }
      return executor.prepare(sql).all(...values);
    },

    async run(sql, params = []) {
      const values = normalizeParams(params);
      if (executorType === "mysql") {
        const [result] = await executor.execute(sql, values);
        return {
          changes: result.affectedRows || 0,
          affectedRows: result.affectedRows || 0,
          insertId: result.insertId || null,
        };
      }
      const result = executor.prepare(sql).run(...values);
      return {
        changes: result.changes || 0,
        affectedRows: result.changes || 0,
        insertId: result.lastInsertRowid || null,
      };
    },
  };
}

async function all(sql, params = []) {
  ensureReady();
  if (dialect === "mysql") return makeApi("mysql", mysqlPool).all(sql, params);
  return makeApi("sqlite", sqliteDb).all(sql, params);
}

async function one(sql, params = []) {
  ensureReady();
  if (dialect === "mysql") return makeApi("mysql", mysqlPool).one(sql, params);
  return makeApi("sqlite", sqliteDb).one(sql, params);
}

async function run(sql, params = []) {
  ensureReady();
  if (dialect === "mysql") return makeApi("mysql", mysqlPool).run(sql, params);
  return makeApi("sqlite", sqliteDb).run(sql, params);
}

async function transaction(fn) {
  ensureReady();

  if (dialect === "mysql") {
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const tx = makeApi("mysql", connection);
      const result = await fn(tx);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  sqliteDb.exec("BEGIN IMMEDIATE");
  try {
    const tx = makeApi("sqlite", sqliteDb);
    const result = await fn(tx);
    sqliteDb.exec("COMMIT");
    return result;
  } catch (err) {
    sqliteDb.exec("ROLLBACK");
    throw err;
  }
}

async function ping() {
  ensureReady();
  if (dialect === "mysql") await mysqlPool.query("SELECT 1");
  else sqliteDb.prepare("SELECT 1").get();
  return true;
}

async function close() {
  if (!initialized) return;
  if (dialect === "mysql" && mysqlPool) await mysqlPool.end();
  if (dialect === "sqlite" && sqliteDb) sqliteDb.close();
  initialized = false;
}

function getDialect() {
  return dialect || "uninitialized";
}

module.exports = { init, one, all, run, transaction, ping, close, getDialect, ensureMysqlGameRunColumns };
