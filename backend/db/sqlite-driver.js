/**
 * Native-module-free SQLite driver for local use.
 *
 * `better-sqlite3` needs node-gyp / a compiler on Windows. Node 22.5+/24 ships SQLite built in (`node:sqlite`),
 * so this thin adapter gives the rest of LearnQuest the same tiny surface it already uses from better-sqlite3:
 *   new Database(path), .pragma(str), .exec(sql), .prepare(sql).all/get/run(...params), .close()
 * db/index.js uses better-sqlite3 when it is installed and falls back to this driver otherwise (production on
 * Railway uses MySQL and is not affected).
 */
const { DatabaseSync } = require("node:sqlite");

const plain = (row) => (row ? { ...row } : row);        // node:sqlite rows have a null prototype; give callers ordinary objects

class Statement {
  constructor(stmt) { this.stmt = stmt; }
  all(...params) { return this.stmt.all(...params).map(plain); }
  get(...params) { return plain(this.stmt.get(...params)); }
  run(...params) { const r = this.stmt.run(...params); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; }
}

class Database {
  constructor(file) { this.db = new DatabaseSync(file); }
  pragma(text) { return this.db.prepare(`PRAGMA ${text}`).all().map(plain); }
  exec(sql) { this.db.exec(sql); return this; }
  prepare(sql) { return new Statement(this.db.prepare(sql)); }
  close() { this.db.close(); }
  get driver() { return "node:sqlite"; }
}

module.exports = Database;
