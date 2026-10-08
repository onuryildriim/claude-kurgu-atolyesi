// Composites the transparent graphics segments onto the ORIGINAL HLG base in one FFmpeg pass:
// the base is decoded once (10-bit, never converted), graphics are brought into HLG Y'CbCr by
// lib/filters.mjs, overlaid with straight alpha, and encoded once. Audio is stream-copied.
//   node scripts/70-composite.mjs                 → x265 master candidate (work/composite/final-hlg.candidate.mov)
//   node scripts/70-composite.mjs --draft         → fast VideoToolbox draft  (work/composite/draft-hlg.mov)
//   node scripts/70-composite.mjs --draft --until 20   → first 20 s only (diagnostics)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { p, SOURCE, SEGMENTS_DIR, sourceTiming } from "./lib/paths.mjs";
import { gfxToHlg, stripDovi, OVERLAY, sourceIsHlg } from "./lib/filters.mjs";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const draft = process.argv.includes("--draft");
// --youtube: upload-safe variant (YouTube dropped frames in near-static, low-bitrate stretches of the
// open-GOP/B-frame master). Closed GOP, an IDR every second, no B-frames (→ no edit list), quality floor via CRF 12.
const youtube = process.argv.includes("--youtube");
const CRF = "14"; // chosen after the measured bake-off in work/color-pipeline.md §7
const until = arg("until");
const allowPartial = process.argv.includes("--allow-partial"); // diagnostics before all segments exist

const manifest = JSON.parse(readFileSync(`${SEGMENTS_DIR}/manifest.json`, "utf8"));
const { fpsNum, fpsDen, frames } = sourceTiming();
if (manifest.frames !== frames) throw new Error("Segment manifesti kaynakla uyuşmuyor; grafiklerin yeniden render edilmesi gerekir.");
let segs = manifest.segments.filter((s) => existsSync(p(s.file)));
if (segs.length !== manifest.segments.length && !allowPartial) throw new Error("Eksik segment var: önce `npm run render:gfx`.");
if (until) segs = segs.filter((s) => s.start / (fpsNum / fpsDen) < Number(until));

const fps = fpsDen === 1 ? String(fpsNum) : `${fpsNum}/${fpsDen}`;
// untagged SDR bases (e.g. dubbing tools) must be tagged BT.709 on the frames, else the container colr atom stays "unknown"
const lines = [`[0:v]${stripDovi}${sourceIsHlg() ? "" : ",setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"}[b0]`];
segs.forEach((s, i) => {
  lines.push(`[${i + 1}:v]${gfxToHlg(s.start, fps)}[g${i + 1}]`);
  lines.push(`[b${i}][g${i + 1}]${OVERLAY}[b${i + 1}]`);
});
mkdirSync(p("work/composite"), { recursive: true });
const graphFile = p("work/composite", draft ? "graph.draft.txt" : "graph.txt");
writeFileSync(graphFile, lines.join(";\n") + "\n");

// --out <name> writes a differently named file (encoder tests); a partial (--until) run can never be the candidate
const out = p("work/composite", arg("out") ?? (youtube ? "final-hlg.youtube.candidate.mov" : draft ? (until ? `draft-hlg.until${until}.mov` : "draft-hlg.mov") : until ? `test-x265.until${until}.mov` : "final-hlg.candidate.mov"));
const HLG = sourceIsHlg();
const hlgTags = HLG ? ["-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc", "-color_range", "tv", "-chroma_sample_location", "left"]
  : ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", "-chroma_sample_location", "left"];
const vui = HLG ? "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc" : "colorprim=bt709:transfer=bt709:colormatrix=bt709";
const encoder = draft
  ? ["-c:v", "hevc_videotoolbox", "-profile:v", "main10", "-pix_fmt", "p010le", "-q:v", "65", "-g", "120"]
  : ["-c:v", "libx265", "-preset", "medium", "-crf", arg("crf") ?? CRF, "-profile:v", "main10", "-pix_fmt", "yuv420p10le", "-dolbyvision", "0",
     "-x265-params", `${vui}:range=limited:chromaloc=0:repeat-headers=1:${youtube ? `keyint=${fpsNum / fpsDen}:min-keyint=${fpsNum / fpsDen}:open-gop=0:bframes=0:scenecut=0` : "keyint=120:min-keyint=60"}:log-level=warning`];

const args = [
  "-hide_banner", "-v", "warning", "-stats", "-y",
  "-i", SOURCE,
  ...segs.flatMap((s) => ["-threads", "2", "-i", p(s.file)]),
  "-/filter_complex", graphFile,
  "-map", `[b${segs.length}]`, "-map", "0:a:0",
  ...encoder, ...hlgTags, "-tag:v", "hvc1",
  "-fps_mode", "passthrough", "-video_track_timescale", String((fpsNum * 10) / fpsDen),
  "-c:a", "copy", // original narration, untouched
  "-map_metadata", "-1", "-map_chapters", "-1",
  ...(until ? ["-t", until] : []),
  "-movflags", "+faststart+write_colr", "-f", "mov", out,
];
writeFileSync(p("work/composite", draft ? "command.draft.txt" : "command.txt"), `ffmpeg ${args.map((a) => (/[\s:;\[\]']/.test(a) ? JSON.stringify(a) : a)).join(" ")}\n`);
console.log(`${segs.length} segment → ${out}\n${draft ? "TASLAK (VideoToolbox)" : `MASTER ADAYI (libx265 CRF ${arg("crf") ?? CRF})`}`);
const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
if (r.status !== 0) { console.error(`ffmpeg çıkış kodu ${r.status}`); process.exit(r.status ?? 1); }
console.log(`Yazıldı: ${out}`);
