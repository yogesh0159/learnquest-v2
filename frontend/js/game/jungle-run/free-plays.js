/**
 * Three free runs without an account.
 *  - every run started from the menu (Play, Play again, Enter) counts, on this device;
 *  - a signed-in parent or child (token saved by js/api.js) plays without a limit;
 *  - the 4th run is stopped: the player is sent to create a parent account (and then a child profile);
 *  - if no LearnQuest server can be reached (a plain web page without a backend), nobody is locked out: the player may continue as a guest.
 * ?freeplays=off turns the limit off (tests, demos); ?freeplays=reset starts counting again.
 */
export const FREE_PLAYS = 3;
const KEY = "lq_free_plays";

export class FreePlays {
  constructor({ storage = globalThis.localStorage, limit = FREE_PLAYS, search = globalThis.location?.search || "" } = {}) {
    this.storage = storage; this.limit = limit; const q = new URLSearchParams(search);
    this.off = q.get("freeplays") === "off"; if (q.get("freeplays") === "reset") this.reset();
  }
  _get(k) { try { return this.storage.getItem(k); } catch { return null; } }
  get used() { const n = Number(this._get(KEY)); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }
  get loggedIn() { return !!this._get("lq_token") && ["parent", "child"].includes(this._get("lq_role")); }
  get limited() { return !this.off && !this.loggedIn; }
  get left() { return this.limited ? Math.max(0, this.limit - this.used) : Infinity; }
  canPlay() { return !this.limited || this.used < this.limit; }
  record() { if (!this.limited) return this.used; try { this.storage.setItem(KEY, String(this.used + 1)); } catch { /* storage blocked: the limit cannot be remembered */ } return this.used; }
  reset() { try { this.storage.removeItem(KEY); } catch { /* ignore */ } }
}

/** Is there a LearnQuest server (accounts) behind this page?  apiBase "" = the same site. */
export async function backendReachable(apiBase = "", timeoutMs = 2500, fetchFn = globalThis.fetch) {
  try { const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs); const r = await fetchFn(`${apiBase}/api/health`, { signal: ctl.signal, cache: "no-store" }); clearTimeout(timer); if (!r.ok) return false; const j = await r.json().catch(() => null); return !!(j && j.ok); }
  catch { return false; }
}

export const accountUrl = (apiBase = "") => `${apiBase}${apiBase ? "/" : ""}parent.html?signup=1&from=game`.replace(/^\//, "");
