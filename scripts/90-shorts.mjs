// Vertical Shorts (1080×1920) cut from a FINISHED long-form master — no graphics re-render:
// the 16:9 master (graphics burned in) is letterboxed over its own blurred copy, a thin Remotion overlay adds the
// title, word-by-word captions and the call-to-action; narration comes from the clean-audio master, the music runs
// continuously underneath and a whoosh marks every cut.
//   node scripts/90-shorts.mjs work/shorts/short-tr.json
// Config: { name, fps, video: { file, hlg }, narration, music, words, narrationLufs, segments: [{ a, dur, v?: [{ from, dur }] }],
//           overlay: { kicker, title, titleAccent, cta: { at, text, sub }, locale } }
//   segment.a = start in the narration (= master) timeline; v = optional picture pieces (montage) filling dur.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { p, LUT_PREVIEW } from "./lib/paths.mjs";

const cfg = JSON.parse(readFileSync(p(process.argv[2]), "utf8"));
const FPS = cfg.fps, W = 1080, H = 1920, PW = 1080, PH = 608, PTOP = 656;
const outDir = p("out/shorts"), tmpDir = p("work/shorts");
mkdirSync(outDir, { recursive: true }); mkdirSync(tmpDir, { recursive: true });
const esc = (f) => f.replace(/\\/g, "/").replace(/([:'])/g, "\\$1");
const SWS = "flags=accurate_rnd+full_chroma_int";

// ── timeline ────────────────────────────────────────────────────────────────────────────────
let t = 0;
const segs = cfg.segments.map((s) => { const o = { ...s, start: t }; t += s.dur; return o; });
const TOTAL = +t.toFixed(3);

// ── captions from word timings (whisper -ml 1 JSON of the master's narration) ─────────────────
const words = JSON.parse(readFileSync(p(cfg.words), "utf8")).transcription
  .map((w) => ({ t: w.offsets.from / 1000, text: w.text.trim() })).filter((w) => w.text);
const captions = [];
for (const s of segs) {
  const ws = words.filter((w) => w.t >= s.a - 0.05 && w.t < s.a + s.dur - 0.1);
  let chunk = [];
  const flush = (end) => { if (!chunk.length) return; captions.push({ from: +(s.start + Math.max(0, chunk[0].t - s.a)).toFixed(3), to: 0, text: chunk.map((c) => c.text).join(" ") }); chunk = []; };
  for (const w of ws) { chunk.push(w); if (chunk.length >= 3 || chunk.map((c) => c.text).join(" ").length > 14 || /[.,?!]$/.test(w.text)) flush(); }
  flush();
  // each caption holds until the next one (or the segment end)
}
captions.sort((a, b) => a.from - b.from);
captions.forEach((c, i) => { const segEnd = segs.find((s) => c.from >= s.start && c.from < s.start + s.dur); c.to = +Math.min(captions[i + 1]?.from ?? TOTAL, segEnd.start + segEnd.dur).toFixed(3); });
const ctaAt = cfg.overlay.cta.at;
const shownCaptions = captions.filter((c) => c.from < ctaAt);

// ── 1. overlay (Remotion) ────────────────────────────────────────────────────────────────────
const overlayFile = path.join(tmpDir, `${cfg.name}.overlay.mov`);
const inputProps = { ...cfg.overlay, captions: shownCaptions, durationSeconds: TOTAL, fps: FPS };
writeFileSync(path.join(tmpDir, `${cfg.name}.props.json`), JSON.stringify(inputProps, null, 2));
const serveUrl = await bundle({ entryPoint: p("src/index.ts"), webpackOverride: enableTailwind, publicDir: p("public") });
const composition = await selectComposition({ serveUrl, id: "Short", inputProps });
await renderMedia({ composition, serveUrl, inputProps, outputLocation: overlayFile, codec: "prores", proResProfile: "4444", imageFormat: "png",
  pixelFormat: "yuva444p10le", colorSpace: "bt709", muted: true, enforceAudioTrack: false, chromiumOptions: { gl: "angle" }, overwrite: true, logLevel: "error" });
console.log(`overlay → ${path.relative(p(), overlayFile)} (${TOTAL} sn, ${shownCaptions.length} altyazı)`);

// ── 2. picture + sound (FFmpeg) ─────────────────────────────────────────────────────────────
const toSdr = cfg.video.hlg
  ? `scale=1920:1080:flags=bicubic,scale=in_color_matrix=bt2020:in_range=tv:out_range=pc:${SWS},format=gbrp16le,lut3d=file='${esc(LUT_PREVIEW)}':interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv:${SWS}`
  : `scale=1920:1080:in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv:${SWS}`;
const inputs = [], lines = [];
let n = 0;
const vLabels = [];
for (const s of segs) for (const v of s.v ?? [{ from: s.a, dur: s.dur }]) {
  inputs.push("-ss", v.from.toFixed(3), "-t", (v.dur + 0.2).toFixed(3), "-i", p(cfg.video.file));
  lines.push(`[${n}:v]${toSdr},fps=${FPS},trim=end_frame=${Math.round(v.dur * FPS)},setpts=PTS-STARTPTS,format=yuv420p,setsar=1[v${n}]`);
  vLabels.push(`[v${n}]`); n++;
}
const aLabels = [];
for (const s of segs) {
  inputs.push("-ss", s.a.toFixed(3), "-t", (s.dur + 0.2).toFixed(3), "-i", p(cfg.narration));
  lines.push(`[${n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${s.dur},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${(s.dur - 0.05).toFixed(3)}:d=0.05[a${n}]`);
  aLabels.push(`[a${n}]`); n++;
}
const iMusic = n++; inputs.push("-stream_loop", "-1", "-i", p(cfg.music));
const iOver = n++; inputs.push("-i", overlayFile);
const iWhoosh = n++; inputs.push("-i", p("work/audio/cues/swoosh-cam.wav"));
lines.push(`${vLabels.join("")}concat=n=${vLabels.length}:v=1:a=0[pic]`, `[pic]split[pa][pb]`);
lines.push(`[pa]scale=-2:${H}:${SWS},crop=${W}:${H},boxblur=28:3,eq=brightness=-0.22:saturation=0.8[bg]`);
lines.push(`[pb]scale=${PW}:${PH}:flags=lanczos[fg]`);
lines.push(`[bg][fg]overlay=0:${PTOP}[base]`);
lines.push(`[${iOver}:v]scale=in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv:${SWS},format=yuva420p[ov]`);
lines.push(`[base][ov]overlay=0:0:format=yuv420:alpha=straight,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[vout]`);
lines.push(`${aLabels.join("")}concat=n=${aLabels.length}:v=0:a=1[narr]`);
const musicGain = (cfg.narrationLufs - 18 - cfg.musicLufs).toFixed(2); // music 18 LU under the narration (Shorts: a little livelier)
lines.push(`[${iMusic}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${TOTAL},volume=${musicGain}dB,afade=t=in:d=0.3,afade=t=out:st=${(TOTAL - 1.2).toFixed(2)}:d=1.2[mus]`);
const cuts = segs.slice(1).map((s) => s.start);
lines.push(`[${iWhoosh}:a]aresample=48000,aformat=channel_layouts=stereo,volume=-9dB,asplit=${Math.max(1, cuts.length)}${cuts.map((_, i) => `[w${i}]`).join("")}`);
cuts.forEach((c, i) => lines.push(`[w${i}]adelay=${Math.max(0, Math.round((c - 0.15) * 1000))}:all=1[wd${i}]`));
lines.push(`[narr][mus]${cuts.map((_, i) => `[wd${i}]`).join("")}amix=inputs=${2 + cuts.length}:normalize=0:duration=first,volume=${cfg.gainDb ?? 0}dB,alimiter=limit=0.89:attack=3:release=80:level=disabled,atrim=0:${TOTAL}[aout]`);
const graph = path.join(tmpDir, `${cfg.name}.graph.txt`);
writeFileSync(graph, lines.join(";\n") + "\n");
const out = path.join(outDir, `${cfg.name}.mp4`);
const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "warning", "-y", ...inputs, "-/filter_complex", graph, "-map", "[vout]", "-map", "[aout]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high", "-pix_fmt", "yuv420p", "-bf", "0", "-g", String(FPS), "-keyint_min", String(FPS), "-sc_threshold", "0",
  "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
  "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-t", String(TOTAL), "-movflags", "+faststart", out], { stdio: ["ignore", "inherit", "inherit"] });
if (r.status !== 0) { console.error(`ffmpeg çıkış kodu ${r.status}`); process.exit(1); }
const info = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,nb_frames,duration", "-of", "compact", out], { encoding: "utf8" });
console.log(`Yazıldı: ${path.relative(p(), out)}\n${info}`);
