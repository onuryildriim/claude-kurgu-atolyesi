// Finds the quietest moment (lowest 20 ms RMS) near proposed cut times, so splices land in the gap
// between words instead of on a syllable. Reads a mono 16 kHz WAV (s16le) made by ffmpeg.
//   node scripts/lib/quiet-point.mjs <file.wav> <t1> [t2 …]      (each t searched within ±0.30 s)
//   t may be "a~b" to search an explicit window.
import { readFileSync } from "node:fs";
const [wav, ...ts] = process.argv.slice(2);
const buf = readFileSync(wav);
const dataAt = buf.indexOf("data") + 8, SR = 16000;
const pcm = new Int16Array(buf.buffer, buf.byteOffset + dataAt, (buf.length - dataAt) >> 1);
const win = 320; // 20 ms
const rmsDb = (c) => { let s = 0; const a = Math.max(0, c - win / 2); for (let i = a; i < a + win && i < pcm.length; i++) s += pcm[i] * pcm[i]; return 10 * Math.log10(s / win / 32768 / 32768 + 1e-12); };
for (const t of ts) {
  const [a, b] = t.includes("~") ? t.split("~").map(Number) : [Number(t) - 0.3, Number(t) + 0.3];
  let best = { db: 0, t: a };
  for (let x = a; x <= b; x += 0.005) { const db = rmsDb(Math.round(x * SR)); if (db < best.db) best = { db, t: x }; }
  // width of the quiet valley (within 6 dB of the minimum)
  let l = best.t, r = best.t;
  while (l > a - 0.5 && rmsDb(Math.round((l - 0.005) * SR)) < best.db + 6) l -= 0.005;
  while (r < b + 0.5 && rmsDb(Math.round((r + 0.005) * SR)) < best.db + 6) r += 0.005;
  console.log(`${t} → ${best.t.toFixed(3)} s  (${best.db.toFixed(1)} dBFS, sessiz aralık ${l.toFixed(3)}–${r.toFixed(3)})`);
}
