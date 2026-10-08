// Builds the pipeline's base timeline public/derived/base.mov from work/assemble.json when the
// video is more than the single original: clips with their OWN narration spliced into main.mov
// (e.g. voice-over screen recordings) and camera punch-ins/zoom-outs on the presenter.
//   node scripts/08-assemble.mjs [--force] [--draft]      (--draft: first 20 s only, for a look)
// Afterwards work/project.json → "source" = "work/composite/base.mov" (all scripts read SOURCE).
//
// work/assemble.json:
//   output: "hlg" (default) | "sdr" — "sdr" when EVERY source is BT.709 (e.g. an iPhone SDR camera + screen
//           recordings): the base stays BT.709, nothing is lifted or tone-mapped.
//   pieces: [{ src, from, to, kind: "hlg" | "sdr", gainDb?, crop?: [w, h, x, y] }]   (seconds in that file)
//     hlg = the user's HLG camera footage (decoded 10-bit, never tone-mapped)
//     sdr = a BT.709 screen recording: centre-cropped to 16:9, scaled to 4K and lifted into HLG with the
//           documented graphics LUT (SDR white → 203 cd/m², like every graphic in the master)
//     gainDb: level-matches a piece recorded at another level (a −2 dBFS limiter guards the peaks)
//   zooms:  [{ from, to, z, cx, cy, in, out }]   OUTPUT-timeline seconds; z = scale (1.12 = punch-in),
//           cx/cy = point kept in view (0–1 of the frame), in/out = ramp seconds (0 = hard punch on a cut)
// Output: ProRes 422 HQ 10-bit, Rec.2100 HLG tags, PCM audio (the narration is only cut, never processed,
// except the gain of spliced pieces).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { p, LUT_GFX } from "./lib/paths.mjs";
import { stripDovi } from "./lib/filters.mjs";

const force = process.argv.includes("--force");
const draft = process.argv.includes("--draft");
const spec = JSON.parse(readFileSync(p("work/assemble.json"), "utf8"));
// the base lives OUTSIDE public/: Remotion's bundle() copies the whole public dir into a temp folder
const OUT = p(draft ? "work/composite/base.draft.mov" : "work/composite/base.mov");
if (existsSync(OUT) && !force) { console.log(`Zaten var: ${path.relative(p(), OUT)} (--force ile yeniden)`); process.exit(0); }

const W = 3840, H = 2160, SR = 44100;
const SDR_OUT = spec.output === "sdr";
if (SDR_OUT && spec.pieces.some((pc) => pc.kind !== "sdr")) throw new Error("output: sdr yalnızca sdr parçalarla çalışır (HLG kaynağı SDR'a indirilmez).");
const TAGS = SDR_OUT ? "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv" : "setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv";
const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,r_frame_rate", "-of", "json", f], { encoding: "utf8" })).streams;
const [num, den] = probe(p(spec.pieces[0].src)).find((s) => s.codec_type === "video").r_frame_rate.split("/").map(Number);
const FPS = num / den;
const SWS = "flags=accurate_rnd+full_chroma_int";
const esc = (f) => f.replace(/\\/g, "/").replace(/([:'])/g, "\\$1");

// SDR (BT.709, tv) → HLG, same transform as the graphics (scripts/lib/filters.mjs → gfxToHlg, without alpha)
const sdrToHlg = [
  `scale=in_color_matrix=bt709:in_range=tv:out_range=pc:${SWS}`, "format=gbrp16le",
  "lutrgb=r='pow(val/maxval,1/2.4)*maxval':g='pow(val/maxval,1/2.4)*maxval':b='pow(val/maxval,1/2.4)*maxval'",
  `lut3d=file='${esc(LUT_GFX)}':interp=tetrahedral`,
  `scale=out_color_matrix=bt2020:out_range=tv:${SWS}`,
].join(",");

const inputs = [], lines = [], labels = [];
let outFrames = 0;
spec.pieces.forEach((pc, i) => {
  const frames = Math.round((pc.to - pc.from) * FPS);
  const samples = Math.round((frames / FPS) * SR);
  inputs.push("-ss", pc.from.toFixed(6), "-t", ((frames + 2) / FPS).toFixed(6), "-i", p(pc.src));
  const v = pc.kind === "sdr"
    ? `crop=${pc.crop ? pc.crop.join(":") : "iw-mod(iw\\,16):ih"},scale=${W}:${H}:flags=lanczos${SDR_OUT ? `:in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv:${SWS}` : `,${sdrToHlg}`}`
    : stripDovi;
  lines.push(`[${i}:v]${v},format=yuv422p10le,${TAGS},setsar=1,trim=end_frame=${frames},setpts=PTS-STARTPTS,fps=${num}/${den}[v${i}]`);
  const gain = pc.gainDb ? `,volume=${pc.gainDb}dB,alimiter=limit=0.794:attack=2:release=60:level=disabled` : "";
  // 12 ms fades at every splice: no click where two recordings meet
  lines.push(`[${i}:a]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo${gain},apad,atrim=end_sample=${samples},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${(samples / SR - 0.012).toFixed(4)}:d=0.012[a${i}]`);
  labels.push(`[v${i}][a${i}]`);
  console.log(`parça ${i + 1}: ${path.basename(pc.src)} ${pc.from}–${pc.to} sn → çıkış ${(outFrames / FPS).toFixed(3)} sn (${frames} kare)${pc.gainDb ? `, ${pc.gainDb} dB` : ""}`);
  outFrames += frames;
});
lines.push(`${labels.join("")}concat=n=${spec.pieces.length}:v=1:a=1[cv][ca]`);

// ── camera moves: one per-frame scale + crop driven by a piecewise envelope ──────────────────────
const zooms = spec.zooms ?? [];
if (zooms.length) {
  const ss = (u) => `(${u})*(${u})*(3-2*(${u}))`; // smoothstep
  const env = (z) => {
    const up = z.in > 0 ? ss(`clip((t-${z.from})/${z.in},0,1)`) : `gte(t,${z.from})`;
    const down = z.out > 0 ? ss(`clip((${z.to}-t)/${z.out},0,1)`) : `lt(t,${z.to})`;
    return `(${up})*(${down})*between(t,${z.from},${z.to})`;
  };
  const sum = (f) => zooms.map((z) => `${f(z)}*${env(z)}`).join("+");
  const Z = `(1+${sum((z) => (z.z - 1).toFixed(4))})`;
  const CX = `(0.5+${sum((z) => (z.cx - 0.5).toFixed(4))})`;
  const CY = `(0.5+${sum((z) => (z.cy - 0.5).toFixed(4))})`;
  lines.push(`[cv]scale=w='2*trunc(${W}*${Z}/2)':h='2*trunc(${H}*${Z}/2)':eval=frame:flags=lanczos,` +
    `crop=${W}:${H}:x='clip(iw*${CX}-${W / 2},0,iw-${W})':y='clip(ih*${CY}-${H / 2},0,ih-${H})',` +
    `${TAGS}[vz]`);
}
mkdirSync(path.dirname(OUT), { recursive: true });
const graph = p("work/composite/assemble.graph.txt");
mkdirSync(path.dirname(graph), { recursive: true });
writeFileSync(graph, lines.join(";\n") + "\n");

const tmp = OUT.replace(/\.mov$/, ".partial.mov");
const args = [
  "-hide_banner", "-v", "warning", "-stats", "-y", ...inputs, "-/filter_complex", graph,
  "-map", zooms.length ? "[vz]" : "[cv]", "-map", "[ca]",
  "-c:v", "prores_ks", "-profile:v", SDR_OUT ? "1" : "3", // SDR 8-bit phone/screen sources: ProRes LT is transparent and ~1/2 the size (4K60 HQ ≈ 13 GB/min) "-pix_fmt", "yuv422p10le", "-vendor", "apl0",
  ...(SDR_OUT ? ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"] : ["-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc"]),
  "-color_range", "tv", "-chroma_sample_location", "left",
  "-c:a", "pcm_s16le", "-ar", String(SR), "-fps_mode", "cfr", "-r", `${num}/${den}`,
  ...(draft ? ["-t", "20"] : []), "-movflags", "+write_colr", "-f", "mov", tmp,
];
const t0 = Date.now();
const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
if (r.status !== 0) { console.error(`ffmpeg çıkış kodu ${r.status}`); process.exit(r.status ?? 1); }
renameSync(tmp, OUT);
const got = Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", OUT], { encoding: "utf8" }).trim());
console.log(`Yazıldı: ${path.relative(p(), OUT)}  ${got} kare (beklenen ${draft ? Math.round(20 * FPS) : outFrames})  ${((Date.now() - t0) / 60000).toFixed(1)} dk`);
if (!draft && got !== outFrames) { console.error("KARE SAYISI UYUŞMUYOR"); process.exit(1); }
