// Python engine: one long-lived worker process (native/python/engine_server.py) that speaks JSON lines on stdin/stdout.
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const SCRIPT = path.resolve(__dirname, "../../native/python/engine_server.py");

function candidates() {
  if (process.env.ENGINE_PYTHON) return [{ cmd: process.env.ENGINE_PYTHON, args: [] }];
  return process.platform === "win32" ? [{ cmd: "python", args: [] }, { cmd: "py", args: ["-3"] }, { cmd: "python3", args: [] }] : [{ cmd: "python3", args: [] }, { cmd: "python", args: [] }];
}

class PythonProvider {
  constructor({ timeoutMs = Number(process.env.ENGINE_TIMEOUT_MS) || 2000, logger = console } = {}) {
    this.name = "python"; this.timeoutMs = timeoutMs; this.logger = logger; this.proc = null; this.pending = new Map(); this.nextId = 1; this.buffer = ""; this.info = null; this.exe = null;
  }

  async start() {
    if (!fs.existsSync(SCRIPT)) throw new Error(`engine script not found: ${SCRIPT}`);
    let lastError = "no Python found";
    for (const c of candidates()) {
      try { await this._spawn(c); this.info = await this.call("ping"); this.exe = [c.cmd, ...c.args].join(" "); return { ok: true, python: this.info.python, exe: this.exe }; }
      catch (e) { lastError = `${c.cmd}: ${e.message}`; await this.stop(); }
    }
    throw new Error(lastError);
  }

  _spawn({ cmd, args }) {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, [...args, "-u", SCRIPT], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
      let settled = false;
      proc.once("error", (e) => { if (!settled) { settled = true; reject(e); } });
      proc.once("spawn", () => { if (!settled) { settled = true; this.proc = proc; resolve(); } });
      proc.stdout.setEncoding("utf8"); proc.stdout.on("data", (d) => this._onData(d));
      proc.stderr.setEncoding("utf8"); proc.stderr.on("data", (d) => this.logger.warn?.(`[engine:python] ${String(d).trim().slice(0, 300)}`));
      proc.once("exit", () => { this._failAll(new Error("python worker exited")); if (this.proc === proc) this.proc = null; });
    });
  }

  _onData(chunk) {
    this.buffer += chunk; let i;
    while ((i = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, i); this.buffer = this.buffer.slice(i + 1); if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      const p = this.pending.get(msg.id); if (!p) continue; this.pending.delete(msg.id); clearTimeout(p.timer);
      msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result);
    }
  }

  _failAll(err) { for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(err); } this.pending.clear(); }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.proc) return reject(new Error("python worker is not running"));
      const id = this.nextId++; const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`python worker timed out (${method})`)); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify({ id, method, params }) + "\n", (e) => { if (e) { this.pending.delete(id); clearTimeout(timer); reject(e); } });
    });
  }

  async stop() { const p = this.proc; this.proc = null; if (p) { try { p.stdin.end(); } catch { /* closed */ } setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 300).unref?.(); } this._failAll(new Error("stopped")); }
}

module.exports = { PythonProvider };
