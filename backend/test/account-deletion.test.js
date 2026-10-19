// Account deletion (Google Play rule) and the production database guard, tested against the REAL server on a temporary SQLite file.
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { DatabaseSync } = require("node:sqlite");

const serverJs = path.join(__dirname, "..", "server.js");
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer(extraEnv = {}) {
  const port = await freePort();
  const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lq-del-")), "test.sqlite");
  const env = { ...process.env, PORT: String(port), HOST: "127.0.0.1", SQLITE_PATH: dbFile, JWT_SECRET: "test_secret_for_deletion", ...extraEnv };
  delete env.NODE_ENV; delete env.MYSQL_URL; delete env.DATABASE_URL; delete env.MYSQLHOST;
  const proc = spawn(process.execPath, [serverJs], { env, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", (d) => (log += d)); proc.stderr.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { const r = await fetch(base + "/api/health"); if (r.ok) return { proc, base, dbFile, log: () => log }; } catch { /* not up yet */ } await sleep(200); }
  proc.kill(); throw new Error("server did not start:\n" + log);
}
const call = async (base, method, url, body, token) => {
  const r = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

test("a parent can delete one child profile, then the whole account; other families are untouched", async () => {
  const { proc, base, dbFile } = await startServer();
  try {
    const A = (await call(base, "POST", "/api/auth/parent/signup", { name: "Parent A", email: "a@example.com", password: "secret1" })).json;
    const B = (await call(base, "POST", "/api/auth/parent/signup", { name: "Parent B", email: "b@example.com", password: "secret2" })).json;
    assert.ok(A.token && B.token);
    const a1 = (await call(base, "POST", "/api/auth/child/create", { name: "Kid A1", age: 7, pin: "1234", language: "en" }, A.token)).json.child;
    const a2 = (await call(base, "POST", "/api/auth/child/create", { name: "Kid A2", age: 8, pin: "2345", language: "hi" }, A.token)).json.child;
    const b1 = (await call(base, "POST", "/api/auth/child/create", { name: "Kid B1", age: 9, pin: "3456", language: "mr" }, B.token)).json.child;
    assert.ok(a1?.id && a2?.id && b1?.id);

    // the children really have data (level 1 progress, a starter reward)
    const db = new DatabaseSync(dbFile);
    const count = (table, ids) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE child_id IN (${ids.map(() => "?").join(",")})`).get(...ids).n;
    assert.ok(count("child_level_progress", [a1.id, a2.id]) >= 2 && count("child_rewards", [a1.id, a2.id]) >= 2);

    // a parent cannot delete somebody else's child; a child login cannot delete anything
    assert.equal((await call(base, "DELETE", `/api/parent/child/${b1.id}`, null, A.token)).status, 403);
    const kidToken = (await call(base, "POST", "/api/auth/child/login", { childId: a1.id, pin: "1234" })).json.token;
    assert.equal((await call(base, "DELETE", `/api/parent/child/${a1.id}`, null, kidToken)).status, 403);
    assert.equal((await call(base, "DELETE", "/api/parent/account", { password: "secret1" }, kidToken)).status, 403);
    assert.equal((await call(base, "DELETE", "/api/parent/account", { password: "secret1" })).status, 401);

    // delete one child: its data is gone, the sibling stays
    assert.equal((await call(base, "DELETE", `/api/parent/child/${a1.id}`, null, A.token)).status, 200);
    assert.equal(count("child_level_progress", [a1.id]), 0); assert.equal(count("child_rewards", [a1.id]), 0);
    assert.equal((await call(base, "POST", "/api/auth/child/login", { childId: a1.id, pin: "1234" })).status, 401);
    assert.equal((await call(base, "GET", "/api/auth/child/list", null, A.token)).json.children.length, 1);

    // wrong / empty password does NOT delete (and answers 403, which does not sign the user out)
    assert.equal((await call(base, "DELETE", "/api/parent/account", { password: "wrong" }, A.token)).status, 403);
    assert.equal((await call(base, "DELETE", "/api/parent/account", {}, A.token)).status, 403);
    assert.equal((await call(base, "POST", "/api/auth/parent/login", { email: "a@example.com", password: "secret1" })).status, 200);

    // right password: everything of family A is gone
    const del = await call(base, "DELETE", "/api/parent/account", { password: "secret1" }, A.token);
    assert.equal(del.status, 200); assert.equal(del.json.deleted, "account");
    assert.equal((await call(base, "POST", "/api/auth/parent/login", { email: "a@example.com", password: "secret1" })).status, 401);
    assert.equal((await call(base, "POST", "/api/auth/child/login", { childId: a2.id, pin: "2345" })).status, 401);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM parents WHERE email = 'a@example.com'").get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM children WHERE id IN (?,?)").get(a1.id, a2.id).n, 0);
    for (const t of ["child_level_progress", "child_rewards", "child_equipped_rewards", "game_runs", "question_log", "daily_activity", "mission_sessions", "mission_attempts", "level_run_stats", "parent_tasks"]) assert.equal(count(t, [a1.id, a2.id]), 0, t);
    // a deleted account cannot be deleted twice
    assert.equal((await call(base, "DELETE", "/api/parent/account", { password: "secret1" }, A.token)).status, 404);

    // family B is untouched
    assert.equal((await call(base, "POST", "/api/auth/parent/login", { email: "b@example.com", password: "secret2" })).status, 200);
    assert.equal((await call(base, "POST", "/api/auth/child/login", { childId: b1.id, pin: "3456" })).status, 200);
    assert.ok(count("child_level_progress", [b1.id]) >= 1);
    db.close();
  } finally { proc.kill(); }
});

test("in production the server refuses to start on a disposable SQLite disk (it must use MySQL or a mounted volume)", async () => {
  const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lq-prod-")), "x.sqlite");
  const env = { ...process.env, NODE_ENV: "production", JWT_SECRET: "x".repeat(40), PORT: String(await freePort()) };
  delete env.SQLITE_PATH; delete env.MYSQL_URL; delete env.DATABASE_URL; delete env.MYSQLHOST; delete env.ALLOW_EPHEMERAL_DB;
  const proc = spawn(process.execPath, [serverJs], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; proc.stdout.on("data", (d) => (out += d)); proc.stderr.on("data", (d) => (out += d));
  const code = await new Promise((res) => { const t = setTimeout(() => { proc.kill(); res("timeout"); }, 20000); proc.on("exit", (c) => { clearTimeout(t); res(c); }); });
  assert.equal(code, 1, out); assert.match(out, /No database configured/);
  assert.equal(fs.existsSync(dbFile), false);
});
