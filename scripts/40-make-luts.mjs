// Generates the two documented colour transforms as .cube 3D LUTs and self-tests them.
//
//  1. work/luts/srgb_to_hlg_gfx203.cube
//     sRGB graphics (Chrome/Remotion output) -> Rec.2100 HLG R'G'B' (BT.2020 primaries).
//     Display-referred mapping per ITU-R BT.2408: SDR graphics white = 203 cd/m² on a nominal
//     1000 cd/m² HLG display  =>  white lands on 75 % HLG signal (10-bit narrow-range code 721).
//     The LUT input is SHAPED: u = c^(1/2.4). The composite graph applies the same shaper with
//     `lutrgb` before `lut3d`, which removes the infinite slope of the HLG square-root toe at black.
//
//  2. work/luts/hlg_to_sdr709_preview.cube
//     HLG R'G'B' (BT.2020) -> SDR BT.709 R'G'B' viewing transform. Used ONLY for the Studio proxy
//     and for QC stills (the same transform for source and final). Never used in the master.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LUT_GFX, LUT_PREVIEW } from "./lib/paths.mjs";

// ---------- constants (ITU-R BT.2100-2) ----------
const A = 0.17883277, B = 0.28466892, C = 0.55991073;
const GAMMA = 1.2; // HLG system gamma at Lw = 1000 cd/m²
const LW = 1000; // nominal peak of the reference HLG display
export const GFX_WHITE_NITS = 203; // BT.2408 HDR reference white
export const SHAPER_EXP = 1 / 2.4;

const hlgOetf = (e) => (e <= 1 / 12 ? Math.sqrt(3 * e) : A * Math.log(12 * e - B) + C);
const hlgInvOetf = (v) => (v <= 0.5 ? (v * v) / 3 : (Math.exp((v - C) / A) + B) / 12);
const srgbEotf = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum2020 = ([r, g, b]) => 0.2627 * r + 0.678 * g + 0.0593 * b;
const mul = (m, [r, g, b]) => m.map((row) => row[0] * r + row[1] * g + row[2] * b);
const M709_TO_2020 = [
  [0.6274, 0.3293, 0.0433],
  [0.0691, 0.9195, 0.0114],
  [0.0164, 0.088, 0.8956],
];
const M2020_TO_709 = [
  [1.6605, -0.5876, -0.0728],
  [-0.1246, 1.1329, -0.0083],
  [-0.0182, -0.1006, 1.1187],
];
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---------- transform 1: sRGB -> HLG (display-referred, inverse OOTF) ----------
export const srgbToHlg = (rgb) => {
  const lin709 = rgb.map(srgbEotf);
  const display = mul(M709_TO_2020, lin709).map((x) => Math.max(0, x) * (GFX_WHITE_NITS / LW)); // 1.0 = 1000 cd/m²
  const yd = lum2020(display);
  const k = yd > 0 ? yd ** ((1 - GAMMA) / GAMMA) : 0; // inverse OOTF: E = Fd * Yd^((1-γ)/γ)
  return display.map((d) => clamp01(hlgOetf(d * k)));
};
const gfxFromShaped = (u) => srgbToHlg(u.map((x) => x ** (1 / SHAPER_EXP)));

// ---------- transform 2: HLG -> SDR 709 viewing transform ----------
// Tone curve on luminance relative to 203 cd/m²: linear slope S below the knee, exponential
// roll-off above it (C1-continuous, asymptotic to 1.0). 203 cd/m² -> ~0.74 linear (~0.88 signal).
const TM_SLOPE = 0.78, TM_KNEE = 0.75;
const toneCurve = (x) => {
  if (x <= TM_KNEE) return TM_SLOPE * x;
  const yk = TM_SLOPE * TM_KNEE;
  return yk + (1 - yk) * (1 - Math.exp((-(x - TM_KNEE) * TM_SLOPE) / (1 - yk)));
};
export const hlgToSdr = (rgbPrime) => {
  const scene = rgbPrime.map((v) => hlgInvOetf(clamp01(v)));
  const ys = lum2020(scene);
  const display = scene.map((e) => e * (ys > 0 ? ys ** (GAMMA - 1) : 0)); // OOTF, 1.0 = 1000 cd/m²
  const yd = lum2020(display);
  const x = (yd * LW) / GFX_WHITE_NITS;
  const gain = x > 0 ? toneCurve(x) / x : 0;
  const sdr2020 = display.map((d) => ((d * LW) / GFX_WHITE_NITS) * gain);
  return mul(M2020_TO_709, sdr2020).map((v) => clamp01(v) ** (1 / 2.4)); // BT.1886 inverse
};

// ---------- .cube writer + tetrahedral evaluator (mirrors ffmpeg lut3d interp=tetrahedral) ----------
const buildLut = (n, fn) => {
  const data = new Float64Array(n * n * n * 3);
  let i = 0;
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    const o = fn([r / (n - 1), g / (n - 1), b / (n - 1)]);
    data[i++] = o[0]; data[i++] = o[1]; data[i++] = o[2];
  }
  return { n, data };
};
const writeCube = (file, title, { n, data }) => {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${n}`, "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"];
  for (let i = 0; i < data.length; i += 3) lines.push(`${data[i].toFixed(7)} ${data[i + 1].toFixed(7)} ${data[i + 2].toFixed(7)}`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, lines.join("\n") + "\n");
};
const at = ({ n, data }, r, g, b) => { const i = ((b * n + g) * n + r) * 3; return [data[i], data[i + 1], data[i + 2]]; };
const tetra = (lut, [x, y, z]) => {
  const s = lut.n - 1, fx = x * s, fy = y * s, fz = z * s;
  const r0 = Math.min(s - 1, Math.floor(fx)), g0 = Math.min(s - 1, Math.floor(fy)), b0 = Math.min(s - 1, Math.floor(fz));
  const dr = fx - r0, dg = fy - g0, db = fz - b0;
  const c000 = at(lut, r0, g0, b0), c111 = at(lut, r0 + 1, g0 + 1, b0 + 1);
  let w, p1, p2;
  if (dr > dg) {
    if (dg > db) { p1 = at(lut, r0 + 1, g0, b0); p2 = at(lut, r0 + 1, g0 + 1, b0); w = [1 - dr, dr - dg, dg - db, db]; }
    else if (dr > db) { p1 = at(lut, r0 + 1, g0, b0); p2 = at(lut, r0 + 1, g0, b0 + 1); w = [1 - dr, dr - db, db - dg, dg]; }
    else { p1 = at(lut, r0, g0, b0 + 1); p2 = at(lut, r0 + 1, g0, b0 + 1); w = [1 - db, db - dr, dr - dg, dg]; }
  } else if (db > dg) { p1 = at(lut, r0, g0, b0 + 1); p2 = at(lut, r0, g0 + 1, b0 + 1); w = [1 - db, db - dg, dg - dr, dr]; }
  else if (db > dr) { p1 = at(lut, r0, g0 + 1, b0); p2 = at(lut, r0, g0 + 1, b0 + 1); w = [1 - dg, dg - db, db - dr, dr]; }
  else { p1 = at(lut, r0, g0 + 1, b0); p2 = at(lut, r0 + 1, g0 + 1, b0); w = [1 - dg, dg - dr, dr - db, db]; }
  return [0, 1, 2].map((i) => w[0] * c000[i] + w[1] * p1[i] + w[2] * p2[i] + w[3] * c111[i]);
};

// ---------- self-test ----------
const CODES = 876; // narrow-range 10-bit span of R'G'B'/Y
const maxErr = (lut, exact, toLutInput, samples) => {
  let worst = 0, where = null;
  for (const s of samples) {
    const e = exact(s), a = tetra(lut, toLutInput(s));
    for (let i = 0; i < 3; i++) { const d = Math.abs(e[i] - a[i]) * CODES; if (d > worst) { worst = d; where = s; } }
  }
  return { worst, where };
};
const rnd = (() => { let s = 0x2f6e2b1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); })(); // seeded LCG
const samples = [];
for (let v = 0; v <= 255; v++) samples.push([v / 255, v / 255, v / 255], [v / 255, 0, 0], [0, v / 255, 0], [0, 0, v / 255]);
for (let i = 0; i < 40000; i++) samples.push([Math.floor(rnd() * 256) / 255, Math.floor(rnd() * 256) / 255, Math.floor(rnd() * 256) / 255]);
for (let i = 0; i < 4000; i++) samples.push([rnd() * 0.06, rnd() * 0.06, rnd() * 0.06]); // near-black stress

const assert = (cond, msg) => { if (!cond) { console.error(`SELF-TEST FAILED: ${msg}`); process.exit(1); } };

let size = 65, gfx, err;
for (;;) {
  gfx = buildLut(size, gfxFromShaped);
  err = maxErr(gfx, srgbToHlg, (s) => s.map((c) => c ** SHAPER_EXP), samples);
  if (err.worst <= 2 || size >= 129) break;
  size = 129;
}
const white = srgbToHlg([1, 1, 1]), black = srgbToHlg([0, 0, 0]);
assert(Math.abs(white[0] - 0.75) < 0.001 && Math.abs(white[1] - 0.75) < 0.001 && Math.abs(white[2] - 0.75) < 0.001, `white = ${white}`);
assert(black.every((v) => v === 0), `black = ${black}`);
let prev = -1;
for (let v = 0; v <= 255; v++) { const y = srgbToHlg([v / 255, v / 255, v / 255])[1]; assert(y > prev, `grey ramp not monotonic at ${v}`); prev = y; }
assert(err.worst <= 2, `gfx LUT interpolation error ${err.worst.toFixed(2)} codes at ${err.where}`);
writeCube(LUT_GFX, `sRGB(shaped ^1/2.4) to Rec.2100 HLG, graphics white ${GFX_WHITE_NITS} nits, BT.2408 display-referred`, gfx);

const PREVIEW_SIZE = 129;
const prevLut = buildLut(PREVIEW_SIZE, hlgToSdr);
// Error statistics over the HLG signal cube. The worst cases are saturated BT.2020 colours whose
// BT.709 channel clips to ~0 (infinite slope of the 1/2.4 encode) — irrelevant for natural footage,
// and the transform is a viewing aid applied identically to source and final.
const perrs = samples.map((s) => { const e = hlgToSdr(s), a = tetra(prevLut, s); return Math.max(...[0, 1, 2].map((i) => Math.abs(e[i] - a[i]))) * 255; }).sort((x, y) => x - y);
const greyErr = Math.max(...Array.from({ length: 1024 }, (_, i) => { const v = i / 1023, e = hlgToSdr([v, v, v]), a = tetra(prevLut, [v, v, v]); return Math.abs(e[0] - a[0]) * 255; }));
const gfxWhiteInPreview = hlgToSdr(white);
writeCube(LUT_PREVIEW, "Rec.2100 HLG to SDR BT.709 viewing transform (preview/QC only)", prevLut);

const code = (v) => Math.round(64 + v * CODES);
console.log(`gfx LUT      : ${size}^3, shaper exp 1/2.4, max interp error ${err.worst.toFixed(3)} codes (10-bit) at sRGB [${err.where.map((x) => (x * 255).toFixed(1))}]`);
console.log(`  white      : HLG ${white[0].toFixed(5)} -> 10-bit code ${code(white[0])}  (${GFX_WHITE_NITS} cd/m² nominal)`);
console.log(`  mid grey   : sRGB 128 -> HLG ${srgbToHlg([128 / 255, 128 / 255, 128 / 255])[0].toFixed(4)}`);
console.log(`preview LUT  : ${PREVIEW_SIZE}^3, interp error in 8-bit SDR codes: median ${perrs[perrs.length >> 1].toFixed(3)}, p99 ${perrs[Math.floor(perrs.length * 0.99)].toFixed(3)}, max ${perrs[perrs.length - 1].toFixed(2)} (saturated/clipped colours), grey ramp max ${greyErr.toFixed(3)}`);
console.log(`  graphics white (HLG 0.75) shows as SDR ${gfxWhiteInPreview[0].toFixed(3)}`);
console.log(`  HLG 0.50 / 0.75 / 1.00 grey -> SDR ${[0.5, 0.75, 1].map((v) => hlgToSdr([v, v, v])[0].toFixed(3)).join(" / ")}`);
