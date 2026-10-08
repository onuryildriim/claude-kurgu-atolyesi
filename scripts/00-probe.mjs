// Preflight: inspects public/main.mov and the local toolchain, writes work/source-metadata.json.
// Read-only with respect to the source. Re-run any time: `npm run probe`.
import { execFileSync } from "node:child_process";
import { statSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, SOURCE } from "./lib/paths.mjs";

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
const tryRun = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
};

if (!existsSync(SOURCE)) {
  console.error(`Kaynak bulunamadı: ${SOURCE}`);
  process.exit(1);
}

// 1. Is the export finished? (size/mtime stable, moov atom readable)
const st1 = statSync(SOURCE);
await new Promise((r) => setTimeout(r, 3000));
const st2 = statSync(SOURCE);
const stable = st1.size === st2.size && st1.mtimeMs === st2.mtimeMs;

const probe = JSON.parse(
  run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-show_chapters", "-of", "json", SOURCE]),
);
const firstFrames = JSON.parse(
  run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-read_intervals", "%+#3", "-show_frames", "-of", "json", SOURCE]),
);
const frameSideData = [
  ...new Set(firstFrames.frames.flatMap((f) => (f.side_data_list ?? []).map((s) => s.side_data_type))),
];

// 2. Timestamp behaviour in three windows (start / middle / end), in 1/600 ticks.
const duration = Number(probe.format.duration);
const windows = [0, Math.floor(duration / 2), Math.max(0, Math.floor(duration) - 8)];
const ptsDeltas = {};
for (const w of windows) {
  const csv = run("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-read_intervals", `${w}%+8`,
    "-show_entries", "packet=pts", "-of", "csv=p=0", SOURCE,
  ]);
  const pts = csv.split("\n").map((l) => parseInt(l, 10)).filter(Number.isFinite).sort((a, b) => a - b);
  const hist = {};
  for (let i = 1; i < pts.length; i++) hist[pts[i] - pts[i - 1]] = (hist[pts[i] - pts[i - 1]] ?? 0) + 1;
  ptsDeltas[`t=${w}s`] = { packets: pts.length, deltaHistogramTicks: hist };
}
const allDeltas = new Set(Object.values(ptsDeltas).flatMap((w) => Object.keys(w.deltaHistogramTicks)));

const v = probe.streams.find((s) => s.codec_type === "video");
const a = probe.streams.find((s) => s.codec_type === "audio");

// 3. Toolchain
const encoders = tryRun("ffmpeg", ["-hide_banner", "-encoders"]);
const filters = tryRun("ffmpeg", ["-hide_banner", "-filters"]);
const has = (txt, name) => new RegExp(`\\s${name}\\s`).test(txt);
const remotionVersion = (p) => {
  try {
    return JSON.parse(run("node", ["-p", `JSON.stringify(require('${p}/package.json').version)`]));
  } catch {
    return null;
  }
};

const meta = {
  generatedAt: new Date().toISOString(),
  source: {
    path: path.relative(ROOT, SOURCE),
    sizeBytes: st2.size,
    mtime: st2.mtime.toISOString(),
    sizeAndMtimeStableOver3s: stable,
    note: "Export treated as finalized: moov readable, size/mtime stable. Read-only input.",
  },
  summary: {
    container: probe.format.format_long_name,
    majorBrand: probe.format.tags?.major_brand,
    durationSeconds: duration,
    overallBitrate: Number(probe.format.bit_rate),
    video: {
      codec: v.codec_name, profile: v.profile, level: v.level, tag: v.codec_tag_string,
      width: v.width, height: v.height, sampleAspectRatio: v.sample_aspect_ratio ?? "absent (1:1 implied)",
      pixFmt: v.pix_fmt, effectiveBitDepth: /10/.test(v.pix_fmt) ? 10 : 8,
      colorRange: v.color_range, colorPrimaries: v.color_primaries, colorTransfer: v.color_transfer,
      colorSpace: v.color_space, chromaLocation: v.chroma_location,
      rFrameRate: v.r_frame_rate, avgFrameRate: v.avg_frame_rate, timeBase: v.time_base,
      startTime: v.start_time, nbFrames: Number(v.nb_frames), durationSeconds: Number(v.duration),
      bitrate: Number(v.bit_rate),
      rotation: (v.side_data_list ?? []).find((s) => s.rotation !== undefined)?.rotation ?? 0,
      streamSideData: v.side_data_list ?? [],
      frameSideDataTypes: frameSideData,
      constantFrameRate: allDeltas.size === 1,
      ptsDeltas,
    },
    audio: {
      codec: a.codec_name, profile: a.profile, sampleRate: Number(a.sample_rate), channels: a.channels,
      channelLayout: a.channel_layout, bitrate: Number(a.bit_rate), initialPadding: a.initial_padding,
      startTime: a.start_time, durationSeconds: Number(a.duration),
    },
    hdr: {
      isHlgTagged: v.color_transfer === "arib-std-b67" && v.color_primaries === "bt2020" && v.color_space === "bt2020nc",
      dolbyVision: (v.side_data_list ?? []).find((s) => /DOVI/.test(s.side_data_type)) ?? null,
      masteringDisplayMetadata: frameSideData.some((t) => /Mastering/.test(t)),
      contentLightLevel: frameSideData.some((t) => /Content light/i.test(t)),
      policy: "Master is delivered as plain Rec.2100 HLG. Dolby Vision RPU is NOT carried over and no DV claim is made.",
    },
  },
  tools: {
    ffmpeg: tryRun("ffmpeg", ["-version"]).split("\n").slice(0, 3),
    encoders: { libx265: has(encoders, "libx265"), hevc_videotoolbox: has(encoders, "hevc_videotoolbox"), prores_ks: has(encoders, "prores_ks") },
    filters: Object.fromEntries(["zscale", "libplacebo", "lut3d", "overlay", "tonemap", "colorspace", "sidedata", "ssim", "psnr", "libvmaf", "signalstats"].map((f) => [f, has(filters, f)])),
    whisperCli: tryRun("which", ["whisper-cli"]).trim(),
    whisperModels: tryRun("ls", ["-la", path.join(os.homedir(), "Models/whisper")]).split("\n"),
    node: process.version,
    remotion: Object.fromEntries(["remotion", "@remotion/cli", "@remotion/renderer", "@remotion/bundler", "@remotion/google-fonts"].map((p) => [p, remotionVersion(p)])),
  },
  system: {
    cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryGiB: +(os.totalmem() / 2 ** 30).toFixed(1),
    os: `${os.type()} ${os.release()}`, diskFree: tryRun("df", ["-h", ROOT]).split("\n")[1],
  },
  raw: { ffprobe: probe },
};

writeFileSync(path.join(ROOT, "work/source-metadata.json"), JSON.stringify(meta, null, 2));
const s = meta.summary;
console.log(`OK  ${s.video.width}x${s.video.height} ${s.video.pixFmt} ${s.video.rFrameRate} fps, ${s.video.nbFrames} frames, ${s.durationSeconds}s`);
console.log(`    ${s.video.colorPrimaries}/${s.video.colorTransfer}/${s.video.colorSpace}/${s.video.colorRange}  CFR=${s.video.constantFrameRate}  HLG=${s.hdr.isHlgTagged}  DV=${!!s.hdr.dolbyVision}`);
if (!s.hdr.isHlgTagged) console.log("NOT  SDR kaynak (HLG değil) → pipeline SDR BT.709 dalını kullanır (scripts/lib/filters.mjs → sourceIsHlg).");
if (!stable || !s.video.constantFrameRate) {
  console.error("UYARI: kaynak beklenen koşulları sağlamıyor; devam etmeden önce work/source-metadata.json dosyasını inceleyin.");
  process.exit(2);
}
