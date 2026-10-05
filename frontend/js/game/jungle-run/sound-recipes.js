import { mulberry32 } from "./rng.js";

/**
 * Procedural sound design (WebAudio only, no audio files). Every sound is built from oscillators and
 * filtered noise, so nothing has to be downloaded and everything stays tiny and offline-friendly.
 */
export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Synth {
  constructor(ctx) { this.ctx = ctx; this.active = 0; this._noise = null; }

  noiseBuffer() {
    if (!this._noise) {
      const c = this.ctx; const n = Math.floor(c.sampleRate * 2);
      const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0); let s = 1234567;
      for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
      this._noise = b;
    }
    return this._noise;
  }
  _track(src) { this.active++; src.onended = () => { this.active--; }; }
  _pan(node, pan, out) {
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(out); } else node.connect(out);
  }

  tone(out, t, freq, dur, { type = "sine", gain = 0.2, attack = 0.004, slideTo = null, slideTime = dur, pan = 0, detune = 0, filter = null } = {}) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + slideTime);
    o.detune.value = detune;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) { const f = c.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7; o.connect(f); f.connect(g); } else o.connect(g);
    this._pan(g, pan, out); o.start(t); o.stop(t + dur + 0.05); this._track(o);
  }

  noiseHit(out, t, dur, { gain = 0.2, type = "bandpass", freq = 2000, freqTo = null, q = 1, attack = 0.003, pan = 0 } = {}) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuffer(); s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    // Band/low-pass filtering removes most of white noise's energy, so compensate to keep requested loudness meaningful.
    gain *= type === "bandpass" ? 12 : type === "lowpass" ? 2.2 : 1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); this._pan(g, pan, out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); this._track(s);
  }
}

/* ------------------------------------------------------------ instruments */
export const marimba = (s, out, t, f, { gain = 0.13, dur = 0.5, pan = 0 } = {}) => {
  s.tone(out, t, f, dur, { gain, pan, attack: 0.003 });
  s.tone(out, t, f * 3.93, dur * 0.35, { gain: gain * 0.28, pan, attack: 0.002 });
};
export const bassPluck = (s, out, t, f, { gain = 0.22, dur = 0.38 } = {}) => {
  s.tone(out, t, f, dur, { type: "triangle", gain, attack: 0.006 });
  s.tone(out, t, f * 2, dur * 0.5, { type: "sine", gain: gain * 0.35 });
};
export const kick = (s, out, t, { gain = 0.38 } = {}) => s.tone(out, t, 150, 0.22, { gain, slideTo: 42, slideTime: 0.14, attack: 0.002 });
export const logDrum = (s, out, t, f = 196, { gain = 0.16 } = {}) => s.tone(out, t, f, 0.18, { gain, slideTo: f * 0.62, slideTime: 0.12, attack: 0.002 });
export const shaker = (s, out, t, { gain = 0.045, pan = 0 } = {}) => s.noiseHit(out, t, 0.06, { gain, type: "highpass", freq: 6500, q: 0.5, pan });
export const chirp = (s, out, t, pan = 0) => {
  const f = 2300 + Math.random() * 900;
  s.tone(out, t, f, 0.07, { gain: 0.03, slideTo: f * 1.35, pan }); s.tone(out, t + 0.09, f * 1.1, 0.06, { gain: 0.025, slideTo: f * 1.5, pan });
};

/* ------------------------------------------------------------------ music */
// C - Am - F - G in C major pentatonic: friendly, never dissonant, loops forever.
const BASS = [36, 33, 41, 43];
const PAD = [[60, 64, 67], [57, 60, 64], [57, 60, 65], [59, 62, 67]];
const MEL = [[72, 76, 79, 84, 74], [69, 72, 76, 81, 79], [72, 69, 76, 81, 74], [74, 79, 76, 72, 81]];

/** Schedule one 4/4 bar starting at time t. mood: "run" (full groove) or "quiz" (calm, sparse, no drums). */
export function scheduleBar(s, out, t, bar, { bpm = 108, mood = "run" } = {}) {
  const beat = 60 / bpm; const eighth = beat / 2; const chord = bar % 4; const rng = mulberry32(bar * 7919 + 13);
  const run = mood === "run";
  // Warm pad, one soft chord per bar.
  for (const n of PAD[chord]) s.tone(out, t, midiToHz(n), beat * 4, { type: "triangle", gain: run ? 0.028 : 0.04, attack: 0.35 });
  // Bass on beats 1 and 3 (+ occasional pick-up).
  bassPluck(s, out, t, midiToHz(BASS[chord]), { gain: run ? 0.2 : 0.12 });
  bassPluck(s, out, t + beat * 2, midiToHz(BASS[chord]) * (rng() > 0.5 ? 1 : 1.5), { gain: run ? 0.16 : 0.1 });
  if (run && rng() > 0.5) bassPluck(s, out, t + beat * 3.5, midiToHz(BASS[chord]) * 2, { gain: 0.1, dur: 0.2 });
  // Percussion only while running.
  if (run) {
    kick(s, out, t); kick(s, out, t + beat * 2, { gain: 0.3 });
    for (let i = 0; i < 8; i++) shaker(s, out, t + i * eighth, { gain: i % 2 ? 0.055 : 0.03, pan: i % 2 ? 0.25 : -0.25 });
    logDrum(s, out, t + beat * 1.5, 220); if (rng() > 0.4) logDrum(s, out, t + beat * 3.5, 175);
  }
  // Marimba melody: random walk over the chord's pentatonic pool, with rests so it breathes.
  const pool = MEL[chord]; let idx = Math.floor(rng() * pool.length); const restBar = bar % 4 === 3 && rng() > 0.5;
  for (let i = 0; i < 8 && !restBar; i++) {
    const p = run ? (i % 2 === 0 ? 0.7 : 0.45) : (i % 2 === 0 ? 0.4 : 0.15);
    if (rng() > p) continue;
    idx = Math.max(0, Math.min(pool.length - 1, idx + Math.floor(rng() * 3) - 1 + (rng() > 0.7 ? 2 : 0)));
    marimba(s, out, t + i * eighth, midiToHz(pool[idx]), { gain: run ? 0.12 : 0.085, dur: run ? 0.42 : 0.7, pan: (rng() - 0.5) * 0.5 });
  }
  // Distant birds.
  if (rng() > 0.72) chirp(s, out, t + rng() * beat * 3, (rng() - 0.5) * 1.4);
}

/* -------------------------------------------------------------------- sfx */
const arp = (s, out, t, notes, step, o = {}) => notes.forEach((n, i) => marimba(s, out, t + i * step, midiToHz(n), o));

export const SFX = {
  /** combo 0..7 raises the pitch up a pentatonic ladder for chained coins. */
  coin(s, out, t, { combo = 0 } = {}) {
    const ladder = [84, 86, 88, 91, 93, 96, 98, 100]; const n = ladder[Math.min(combo, ladder.length - 1)];
    s.tone(out, t, midiToHz(n), 0.22, { type: "triangle", gain: 0.16, attack: 0.002 });
    s.tone(out, t + 0.06, midiToHz(n + 7), 0.28, { type: "sine", gain: 0.13, attack: 0.002 });
  },
  enigma(s, out, t) {
    arp(s, out, t, [72, 76, 79, 84, 88, 91], 0.07, { gain: 0.16, dur: 0.7 });
    s.tone(out, t, midiToHz(60), 0.9, { type: "triangle", gain: 0.1, attack: 0.02 }); s.noiseHit(out, t + 0.1, 0.6, { gain: 0.05, type: "highpass", freq: 7000 });
  },
  jump(s, out, t) {
    s.tone(out, t, 260, 0.2, { gain: 0.16, slideTo: 640, slideTime: 0.16, attack: 0.005 });
    s.noiseHit(out, t, 0.18, { gain: 0.03, type: "bandpass", freq: 900, freqTo: 2400, q: 0.8 });
  },
  slide(s, out, t) { s.noiseHit(out, t, 0.55, { gain: 0.17, type: "lowpass", freq: 2600, freqTo: 260, q: 0.6, attack: 0.02 }); },
  lane(s, out, t) { s.noiseHit(out, t, 0.09, { gain: 0.07, type: "bandpass", freq: 1300, freqTo: 700, q: 1.2 }); },
  hit(s, out, t) {
    s.tone(out, t, 190, 0.3, { gain: 0.34, slideTo: 48, slideTime: 0.22, attack: 0.002 });
    s.noiseHit(out, t, 0.14, { gain: 0.07, type: "lowpass", freq: 1800, freqTo: 300 });
    s.tone(out, t + 0.05, 520, 0.25, { type: "square", gain: 0.05, slideTo: 180, slideTime: 0.22, filter: { type: "lowpass", freq: 1200 } });
  },
  correct(s, out, t) { arp(s, out, t, [72, 76, 79, 84], 0.085, { gain: 0.19, dur: 0.6 }); s.tone(out, t + 0.34, midiToHz(88), 0.6, { type: "sine", gain: 0.1 }); },
  wrong(s, out, t) {
    s.tone(out, t, midiToHz(55), 0.32, { type: "sawtooth", gain: 0.12, filter: { type: "lowpass", freq: 700 } });
    s.tone(out, t + 0.2, midiToHz(50), 0.5, { type: "sawtooth", gain: 0.12, slideTo: midiToHz(48), slideTime: 0.4, filter: { type: "lowpass", freq: 600 } });
  },
  lifeUp(s, out, t) { arp(s, out, t, [67, 72, 76, 79, 84], 0.06, { gain: 0.14, dur: 0.5 }); },
  question(s, out, t) { s.tone(out, t, midiToHz(91), 0.7, { gain: 0.1 }); s.tone(out, t + 0.16, midiToHz(98), 0.9, { gain: 0.09 }); },
  powerup(s, out, t) { arp(s, out, t, [67, 71, 74, 79, 83, 86], 0.055, { gain: 0.15, dur: 0.6 }); s.noiseHit(out, t, 0.5, { gain: 0.04, type: "highpass", freq: 6000 }); },
  shield(s, out, t) { s.tone(out, t, midiToHz(96), 0.4, { type: "triangle", gain: 0.2, slideTo: midiToHz(84), slideTime: 0.3 }); s.noiseHit(out, t, 0.12, { gain: 0.05, type: "highpass", freq: 4000 }); },
  click(s, out, t) { s.tone(out, t, 1040, 0.11, { type: "triangle", gain: 0.34, attack: 0.003 }); },
  gameover(s, out, t) { arp(s, out, t, [64, 62, 60, 57], 0.22, { gain: 0.17, dur: 1.1 }); s.tone(out, t + 0.8, midiToHz(45), 1.4, { type: "triangle", gain: 0.12, attack: 0.05 }); },
  victory(s, out, t) {
    arp(s, out, t, [72, 72, 72, 76, 79, 84], 0.11, { gain: 0.19, dur: 0.7 });
    s.tone(out, t + 0.7, midiToHz(60), 1.4, { type: "triangle", gain: 0.12, attack: 0.03 }); s.tone(out, t + 0.7, midiToHz(67), 1.4, { type: "triangle", gain: 0.1, attack: 0.03 });
  },
};
