// Designed sound cues synthesised in code (v2 "Sound design v2", .claude/skills/video-kurgula/references/audio.md).
// No dependencies, deterministic (seeded noise): the same cue sounds identical on every rebuild.
//   node scripts/lib/synth.mjs [--only riser,impact]   → work/audio/cues/<kind>.wav (48 kHz, 32-bit float stereo)
// Each cue is short, soft and dry-ish; levels are set later by scripts/75-audio.mjs (relative to the narration).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "work/audio/cues");

// ── primitives ──────────────────────────────────────────────────────────────────────────────────
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const buf = (sec) => new Float32Array(Math.round(sec * SR));
const TAU = Math.PI * 2;

/** RBJ biquad with a per-sample cutoff function f(i) (coefficients refreshed every 16 samples). */
const biquad = (x, kind, f, q = 0.707) => {
  const y = new Float32Array(x.length);
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (fc) => {
    const w = (TAU * Math.min(fc, SR * 0.45)) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
    let n0, n1, n2; const d0 = 1 + al;
    if (kind === "lp") { n0 = (1 - c) / 2; n1 = 1 - c; n2 = (1 - c) / 2; }
    else if (kind === "hp") { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = (1 + c) / 2; }
    else { n0 = al; n1 = 0; n2 = -al; } // band-pass, 0 dB peak
    b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = (-2 * c) / d0; a2 = (1 - al) / d0;
  };
  for (let i = 0; i < x.length; i++) {
    if (i % 16 === 0) set(typeof f === "function" ? f(i) : f);
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
};
const noise = (n, seed) => { const r = rng(seed), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1; return x; };
const env = (n, a, d, curve = 4) => { // attack (s) then exponential-ish decay to the end
  const e = new Float32Array(n), A = Math.max(1, Math.round(a * SR));
  for (let i = 0; i < n; i++) e[i] = i < A ? i / A : Math.exp((-curve * (i - A)) / Math.max(1, n - A)) * (1 - (i - A) / (n - A)) ** 0.5;
  return e;
};
const mul = (x, e) => x.map((v, i) => v * e[i]);
const add = (...xs) => { const n = Math.max(...xs.map((x) => x.length)), y = new Float32Array(n); for (const x of xs) for (let i = 0; i < x.length; i++) y[i] += x[i]; return y; };
const gain = (x, g) => x.map((v) => v * g);
const delay = (x, sec, len) => { const d = Math.round(sec * SR), y = new Float32Array(len ?? x.length + d); for (let i = 0; i < x.length && i + d < y.length; i++) y[i + d] = x[i]; return y; };
const sine = (n, f, phase = 0) => { const y = new Float32Array(n); let ph = phase; for (let i = 0; i < n; i++) { const fr = typeof f === "function" ? f(i) : f; ph += (TAU * fr) / SR; y[i] = Math.sin(ph); } return y; };
/** small room: a few feedback combs + one all-pass (Schroeder), mixed low */
const room = (x, mix = 0.12, size = 1) => {
  const tail = Math.round(0.35 * SR), n = x.length + tail, y = new Float32Array(n);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => Math.round(s * size * SR));
  for (const D of combs) { const b = new Float32Array(n); for (let i = 0; i < n; i++) { b[i] = (x[i] ?? 0) + (i >= D ? b[i - D] * 0.72 : 0); y[i] += b[i] * 0.25; } }
  const D = Math.round(0.005 * SR), out = new Float32Array(n); let prev = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = y[i] + (i >= D ? -0.6 * y[i - D] + 0.6 * prev[i - D] : 0); prev[i] = v; out[i] = (x[i] ?? 0) + v * mix; }
  return out;
};
const fadeOut = (x, sec = 0.01) => { const n = Math.round(sec * SR); for (let i = 0; i < n && i < x.length; i++) x[x.length - 1 - i] *= i / n; return x; };
const normalize = (x, peakDb = -1) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); const g = 10 ** (peakDb / 20) / (p || 1); return x.map((v) => v * g); };
/** stereo from mono with a little width (Haas) */
const stereo = (m, width = 0.0) => { const d = Math.round(width * 0.012 * SR); const L = m, R = new Float32Array(m.length); for (let i = 0; i < m.length; i++) R[i] = m[Math.max(0, i - d)]; return [L, R]; };

const writeWav = (file, [L, R]) => {
  const n = L.length, data = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { data[2 * i] = L[i]; data[2 * i + 1] = R[i]; }
  const h = Buffer.alloc(44), bytes = data.length * 4;
  h.write("RIFF", 0); h.writeUInt32LE(36 + bytes, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write("data", 36); h.writeUInt32LE(bytes, 40);
  writeFileSync(file, Buffer.concat([h, Buffer.from(data.buffer)]));
};

// ── the cue vocabulary ──────────────────────────────────────────────────────────────────────────
const fm = (n, fc, ratio, index, decay) => { const y = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR, I = index * Math.exp(-t * decay * 1.6); y[i] = Math.sin(TAU * fc * t + I * Math.sin(TAU * fc * ratio * t)) * Math.exp(-t * decay); } return y; };

const CUES = {
  // a key press: short noise burst through a band-pass + a tiny body thump
  type: () => { const n = buf(0.06).length; const click = mul(biquad(noise(n, 11), "bp", 3200, 1.4), env(n, 0.001, 1, 9)); const body = mul(sine(n, 180), env(n, 0.001, 1, 14)); return stereo(normalize(add(click, gain(body, 0.35)), -3)); },
  // mouse click: two micro transients (press + release)
  click: () => { const n = buf(0.09).length; const a = mul(biquad(noise(n, 21), "bp", 2600, 2), env(n, 0.0005, 1, 18)); const b = delay(gain(mul(biquad(noise(n, 22), "bp", 3400, 2), env(n, 0.0005, 1, 22)), 0.6), 0.045, n); return stereo(normalize(add(a, b), -3)); },
  // "✓": a soft two-note FM bell (E6 → B6)
  "tick-ok": () => { const n = buf(0.5).length; const a = fm(n, 1318.5, 2, 1.2, 9), b = delay(fm(n, 1975.5, 2, 1.0, 9), 0.075, n); return stereo(normalize(room(fadeOut(add(gain(a, 0.8), b)), 0.1), -3), 0.3); },
  // list row / board element arrives: rounded sine ping with a soft fifth
  ping: () => { const n = buf(0.42).length; const f = sine(n, 880), h = sine(n, 1320); return stereo(normalize(room(fadeOut(mul(add(f, gain(h, 0.25)), env(n, 0.003, 1, 7))), 0.12), -3), 0.2); },
  // camera / layout move: band-passed noise whose centre sweeps up then down, ~0.6 s
  "swoosh-cam": () => { const n = buf(0.65).length; const sw = biquad(noise(n, 31), "bp", (i) => 500 + 2600 * Math.sin((Math.PI * i) / n) ** 1.6, 0.9); const e = sine(n, 0).map((_, i) => Math.sin((Math.PI * i) / n) ** 2); return stereo(normalize(biquad(mul(sw, e), "lp", 7000), -3), 0.6); },
  // before a thesis: rising noise + sine sweep, ends at the reveal (length 1.2 s; place its END on the cue)
  riser: () => { const n = buf(1.2).length; const nz = biquad(noise(n, 41), "bp", (i) => 300 + 5200 * (i / n) ** 2, 1.2); const tone = sine(n, (i) => 220 + 660 * (i / n) ** 2); const e = new Float32Array(n).map((_, i) => (i / n) ** 2.2); return stereo(normalize(biquad(mul(add(nz, gain(tone, 0.25)), e), "lp", 6500), -3), 0.5); },
  // the thesis lands: sub thump 58→40 Hz + a short noise transient
  impact: () => { const n = buf(0.7).length; const sub = mul(sine(n, (i) => 58 - 18 * Math.min(1, i / (0.25 * SR))), env(n, 0.002, 1, 6)); const hit = mul(biquad(noise(n, 51), "lp", 2200), env(n, 0.001, 1, 30)); return stereo(normalize(room(add(sub, gain(hit, 0.5)), 0.08, 1.4), -2), 0.2); },
  // struck claim / ✕: short scratch + low tick
  strike: () => { const n = buf(0.22).length; const s = mul(biquad(noise(n, 61), "bp", (i) => 1800 + 1400 * (i / n), 3), env(n, 0.002, 1, 5)); const t = mul(sine(n, 140), env(n, 0.001, 1, 20)); return stereo(normalize(add(s, gain(t, 0.5)), -3)); },
  // subscribe bell: bright two-partial bell with a little shimmer
  bell: () => { const n = buf(1.1).length; const a = fm(n, 2093, 1.41, 2.2, 4.2), b = gain(fm(n, 3136, 1.41, 1.6, 5), 0.5); return stereo(normalize(room(fadeOut(add(a, b)), 0.18), -3), 0.4); },
  // like: soft upward bubble pop
  pop: () => { const n = buf(0.16).length; const s = mul(sine(n, (i) => 380 + 900 * (i / n)), env(n, 0.002, 1, 10)); return stereo(normalize(fadeOut(s), -3)); },
  // chapter / full-screen entrance: deeper, longer swoosh with a sub swell
  "swoosh-deep": () => { const n = buf(1.0).length; const sw = biquad(noise(n, 71), "bp", (i) => 250 + 1600 * Math.sin((Math.PI * i) / n) ** 1.4, 0.8); const sub = sine(n, (i) => 70 + 30 * (i / n)); const e = new Float32Array(n).map((_, i) => Math.sin((Math.PI * i) / n) ** 2); return stereo(normalize(biquad(mul(add(sw, gain(sub, 0.18)), e), "lp", 6000), -3), 0.6); },
  // time skip: fast-forward whirr (motor whine rising + filtered noise), 0.9 s
  "fast-forward": () => { const n = buf(0.9).length; const whine = sine(n, (i) => 300 + 1500 * (i / n)); const nz = biquad(noise(n, 81), "bp", (i) => 800 + 3000 * (i / n), 2); const e = new Float32Array(n).map((_, i) => Math.min(1, i / (0.08 * SR)) * Math.min(1, (n - i) / (0.15 * SR))); return stereo(normalize(biquad(mul(add(gain(whine, 0.35), nz), e), "lp", 5500), -3), 0.4); },
  // a word of a kinetic line lands: very soft low "thock"
  thock: () => { const n = buf(0.12).length; const s = mul(sine(n, (i) => 210 - 80 * (i / n)), env(n, 0.001, 1, 12)); const c = mul(biquad(noise(n, 91), "bp", 1400, 1.5), env(n, 0.0005, 1, 30)); return stereo(normalize(add(s, gain(c, 0.25)), -3)); },
};

const only = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1].split(",") : null; })();
mkdirSync(OUT, { recursive: true });
for (const [kind, make] of Object.entries(CUES)) {
  if (only && !only.includes(kind)) continue;
  const st = make();
  writeWav(path.join(OUT, `${kind}.wav`), st);
  console.log(`cue  ${kind.padEnd(13)} ${(st[0].length / SR).toFixed(2)} sn → work/audio/cues/${kind}.wav`);
}
