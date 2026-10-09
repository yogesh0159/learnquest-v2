/** Optional read-aloud (browser speechSynthesis). Silent no-op when unsupported or switched off. */
export class Speaker {
  constructor() { this.enabled = false; this.last = ""; this.lang = "en-US"; }
  get supported() { return typeof globalThis.speechSynthesis !== "undefined" && typeof globalThis.SpeechSynthesisUtterance !== "undefined"; }
  speak(text, force = false) {
    if ((!this.enabled && !force) || !this.supported || !text) return false;
    try {
      globalThis.speechSynthesis.cancel();
      const u = new globalThis.SpeechSynthesisUtterance(text); u.rate = 0.9; u.pitch = 1.1; u.lang = this.lang;
      this.last = text; globalThis.speechSynthesis.speak(u); return true;
    } catch { return false; }
  }
  cancel() { try { globalThis.speechSynthesis?.cancel(); } catch { /* ignore */ } }
}
