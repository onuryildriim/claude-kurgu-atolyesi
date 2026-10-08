// Automated QC of a composite (draft or master candidate) against the original source.
//   node scripts/80-qc.mjs --file work/composite/draft-hlg.mov [--stills] [--skip-decode]
//   node scripts/80-qc.mjs --file work/composite/final-hlg.candidate.mov --stills --promote
//   node scripts/80-qc.mjs --file work/composite/final-hlg.mix.candidate.mov --audio mix --clean <temiz-ses dosyası> --skip-decode --promote
//     --audio mix: the track is narration + music + effects (scripts/75-audio.mjs) → lag / null / peak / loudness
//     checks instead of bit-identity; --clean proves the video stream is the same packets as the fully checked file.
//     --promote-to <path> overrides the destination (default out/final-hlg.mov).
// Writes work/qc/reports/qc.<name>.json. --promote moves the candidate to out/final-hlg.mov ONLY if
// every automated check passed. Stills use the documented viewing transform (same for both files)
// and are a layout/consistency aid, not an HDR reference.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { p, SOURCE, ORIGINAL, FINAL } from "./lib/paths.mjs";
import { loadPlan } from "./lib/plan.mjs";
import { viewingTransform, sourceIsHlg } from "./lib/filters.mjs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const file = p(arg("file") ?? "work/composite/final-hlg.candidate.mov");
const name = path.basename(file).replace(/\.mov$/, "");
if (!existsSync(file)) throw new Error(`Dosya yok: ${file}`);
const plan = loadPlan();
const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 }); return `${r.stdout ?? ""}${r.stderr ?? ""}`; };
const probe = (f, extra = []) => JSON.parse(execFileSync("ffprobe", ["-v", "error", ...extra, "-show_format", "-show_streams", "-of", "json", f], { encoding: "utf8", maxBuffer: 1 << 28 }));
const checks = [];
const check = (id, pass, detail) => { checks.push({ id, pass: !!pass, detail }); console.log(`${pass ? "OK  " : "FAIL"} ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); };

// ---- 1. container / stream metadata --------------------------------------------------------
const src = probe(SOURCE), out = probe(file, ["-count_packets"]);
const sv = src.streams.find((s) => s.codec_type === "video"), sa = src.streams.find((s) => s.codec_type === "audio");
const ov = out.streams.find((s) => s.codec_type === "video"), oa = out.streams.find((s) => s.codec_type === "audio");
check("container", /QuickTime/.test(out.format.format_long_name), out.format.format_long_name);
check("resolution", ov.width === sv.width && ov.height === sv.height, `${ov.width}x${ov.height}`);
check("cadence", ov.r_frame_rate === sv.r_frame_rate && ov.avg_frame_rate === sv.avg_frame_rate, `${ov.r_frame_rate} avg ${ov.avg_frame_rate}`);
check("frame-count", Number(ov.nb_read_packets) === Number(sv.nb_frames), `${ov.nb_read_packets} / kaynak ${sv.nb_frames}`);
check("video-duration", Math.abs(Number(ov.duration) - Number(sv.duration)) < 1 / 120, `${ov.duration} / kaynak ${sv.duration}`);
check("codec-profile", ov.codec_name === "hevc" && ov.profile === "Main 10" && ov.codec_tag_string === "hvc1", `${ov.codec_name} ${ov.profile} ${ov.codec_tag_string}`);
check("pixel-format", ov.pix_fmt === "yuv420p10le", ov.pix_fmt);
const HLG = sourceIsHlg();
const want = HLG ? ["bt2020", "arib-std-b67", "bt2020nc"] : ["bt709", "bt709", "bt709"];
check(HLG ? "hlg-signalling" : "sdr-bt709-signalling", ov.color_primaries === want[0] && ov.color_transfer === want[1] && ov.color_space === want[2] && ov.color_range === "tv",
  `${ov.color_primaries}/${ov.color_transfer}/${ov.color_space}/${ov.color_range}, chroma ${ov.chroma_location}`);
// an assembled ProRes base (scripts/08-assemble.mjs) carries no chroma-location tag → compare with the user's original
const refChroma = sv.chroma_location ?? probe(ORIGINAL).streams.find((s) => s.codec_type === "video").chroma_location;
check("chroma-location", ov.chroma_location === refChroma, `${ov.chroma_location} / kaynak ${refChroma}${sv.chroma_location ? "" : " (orijinal main.mov; birleştirilmiş taban etiketsiz)"}`);
check("no-dolby-vision-record", !(ov.side_data_list ?? []).some((s) => /DOVI/.test(s.side_data_type)), (ov.side_data_list ?? []).map((s) => s.side_data_type).join(",") || "yok");
const frame0 = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-read_intervals", "%+#2", "-show_frames", "-of", "json", file], { encoding: "utf8", maxBuffer: 1 << 28 }));
const fsd = [...new Set(frame0.frames.flatMap((f) => (f.side_data_list ?? []).map((s) => s.side_data_type)))];
check("no-dolby-vision-rpu", !fsd.some((t) => /Dolby/.test(t)), fsd.join(",") || "kare yan verisi yok");
const vui = sh("ffmpeg", ["-hide_banner", "-i", file, "-map", "0:v:0", "-c", "copy", "-bsf:v", "trace_headers", "-frames:v", "1", "-f", "null", "-"]);
const vuiVal = (k) => Number((vui.match(new RegExp(`${k}\\s+[01]+\\s*=\\s*(\\d+)`)) ?? [])[1]);
const v = { colour_primaries: vuiVal("colour_primaries"), transfer_characteristics: vuiVal("transfer_characteristics"), matrix_coeffs: vuiVal("matrix_coefficients"), video_full_range_flag: vuiVal("video_full_range_flag") };
check("bitstream-vui", HLG ? (v.colour_primaries === 9 && v.transfer_characteristics === 18 && v.matrix_coeffs === 9 && v.video_full_range_flag === 0) : (v.colour_primaries === 1 && v.transfer_characteristics === 1 && v.matrix_coeffs === 1 && v.video_full_range_flag === 0), v);

// ---- 2. audio: untouched narration, one track, same timing ---------------------------------
check("single-audio-track", out.streams.filter((s) => s.codec_type === "audio").length === 1, `${oa.codec_name} ${oa.sample_rate} Hz ${oa.channels} kanal`);
const md5 = (f, copy, stream = "0:a:0") => sh("ffmpeg", ["-v", "error", "-i", f, "-map", stream, ...(copy ? ["-c", "copy"] : []), "-f", "md5", "-"]).match(/MD5=([0-9a-f]+)/)?.[1];
let audioReport = null;
if (arg("audio") === "mix") {
  const SR = Number(sa.sample_rate) || 44100, B = p("work/audio/build"); // the narration's own rate
  const pcm = (f, ss, t) => { const b = execFileSync("ffmpeg", ["-v", "error", ...(ss === undefined ? [] : ["-ss", String(ss), "-t", String(t)]), "-i", f, "-map", "0:a:0", "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 }); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
  check("audio-format", oa.codec_name === "aac" && Number(oa.sample_rate) === SR && oa.channels === 2, `${oa.codec_name} ${oa.sample_rate} Hz ${oa.channels} kanal, ${Math.round(Number(oa.bit_rate) / 1000)} kb/s`);
  check("audio-timing", Number(oa.start_time) === 0 && Math.abs(Number(oa.duration) - Number(ov.duration)) < 0.03, `ses ${oa.start_time}+${oa.duration}, video ${ov.start_time}+${ov.duration}`);
  // lag of the delivered track against the ORIGINAL narration (decoded from the source), three windows
  const lags = [];
  const D = Number(ov.duration); // windows relative to this video
  // whole-file decodes, sliced (seeking inside AAC lands on different samples in two different containers)
  const fullA = pcm(SOURCE), fullB = pcm(file);
  for (const t of [4, Math.round(D / 2), Math.floor(D - 12)]) {
    const a = fullA.subarray(t * SR, (t + 8) * SR), b = fullB.subarray(t * SR, (t + 8) * SR), R = 1024, n = Math.min(a.length, b.length) - 2 * R;
    let best = -Infinity, lag = 0;
    for (let l = -R; l <= R; l++) { let acc = 0; for (let i = R; i < R + n; i++) acc += a[i] * b[i + l]; if (acc > best) { best = acc; lag = l; } }
    lags.push(lag);
  }
  check("narration-lag-zero", lags.every((l) => l === 0), `gecikme (örnek) baş/orta/son: ${lags.join(" / ")}`);
  // null test on the pre-encode files: mix − music stem − effects stem − narration(source) = silence
  // the narration as it went into the mix: the untouched source, or the user-requested leveled narration (75-audio → narration.wav)
  const [mix, mus, fx, src] = [pcm(`${B}/mix.wav`), pcm(`${B}/stem-muzik.wav`), pcm(`${B}/stem-efekt.wav`), existsSync(`${B}/narration.proc.wav`) ? pcm(`${B}/narration.wav`) : pcm(SOURCE)];
  let resid = 0; for (let i = 0; i < mix.length; i++) resid = Math.max(resid, Math.abs(mix[i] - (mus[i] ?? 0) - fx[i] - (src[i] ?? 0)));
  check("null-test", resid < 1e-5, `miks − stem'ler − kaynak anlatım: en büyük artık ${resid.toExponential(2)} (${(20 * Math.log10(resid + 1e-12)).toFixed(0)} dBFS)`);
  // the delivered (lossy) track is that mix: residual energy well below the signal
  const del = pcm(file); let e = 0, d = 0; const n = Math.min(del.length, mix.length); for (let i = 0; i < n; i++) { e += mix[i] ** 2; d += (del[i] - mix[i]) ** 2; }
  const snr = 10 * Math.log10(e / d);
  check("delivered-track-is-the-mix", snr > 25, `AAC sonrası miksle SNR ${snr.toFixed(1)} dB`);
  const loud = (f) => { const o = sh("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"]); const tl = o.slice(o.lastIndexOf("Summary:")); const num = (re) => { const m = tl.match(re); return m ? Number(m[1]) : -Infinity; }; return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) }; }; // a silent stem (no music) reads as -inf
  const L = { delivered: loud(file), narration: loud(SOURCE), music: loud(`${B}/stem-muzik.wav`), effects: loud(`${B}/stem-efekt.wav`) };
  check("true-peak", L.delivered.truePeak <= -1, `${L.delivered.truePeak} dBTP (sınır −1)`);
  check("narration-dominates", L.narration.lufs - L.music.lufs >= 15, `bütünleşik: miks ${L.delivered.lufs} · anlatım ${L.narration.lufs} · müzik ${L.music.lufs} · efekt ${L.effects.lufs} LUFS`);
  audioReport = { lags, nullResidual: resid, snrDb: snr, loudness: L, build: JSON.parse(readFileSync(`${B}/audio-report.json`, "utf8")) };
  if (arg("clean")) { const [a, b] = [md5(file, true, "0:v:0"), md5(p(arg("clean")), true, "0:v:0")]; check("video-packets-identical-to-clean", a && a === b, `${a} / ${b}`); }
} else {
const [pS, pO, dS, dO] = [md5(SOURCE, true), md5(file, true), md5(SOURCE, false), md5(file, false)];
check("audio-packets-identical", pS && pS === pO, `${pS} / ${pO}`);
check("audio-decoded-pcm-identical", dS && dS === dO, `${dS} / ${dO}  (priming + edit list dahil)`);
check("audio-timing", oa.start_time === sa.start_time && Math.abs(Number(oa.duration) - Number(sa.duration)) < 0.001 && ov.start_time === sv.start_time,
  `ses ${oa.start_time}+${oa.duration}, video ${ov.start_time} / kaynak ses ${sa.start_time}+${sa.duration}`);
}

// ---- 3. untouched picture: regions/times without overlays, source vs output ------------------
const active = (t) => plan.events.some((e) => t >= e.start - 0.1 && t <= e.end + 0.1);
// 1-second windows in the graphics-free gaps of THIS plan (≥ 3,4 s free, one window every ~9 s of gap), thinned to 15
const gapWindows = [];
{
  const evs = [...plan.events].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const e of [...evs, { start: plan.source.durationSeconds, end: plan.source.durationSeconds }]) {
    const free = e.start - cursor;
    if (free >= 3.4) { const n = Math.max(1, Math.floor(free / 9)); for (let k = 1; k <= n; k++) gapWindows.push(Math.floor(cursor + (free * k) / (n + 1) - 0.5)); }
    cursor = Math.max(cursor, e.end);
  }
}
const step = Math.max(1, gapWindows.length / 15);
const probes = Array.from({ length: Math.min(15, gapWindows.length) }, (_, i) => gapWindows[Math.floor(i * step)]).filter((t) => t >= 1 && !active(t) && !active(t + 1));
const metrics = [];
// untagged SDR sources would be auto-converted BT.601→BT.709 against the tagged output: tag both the same way
const TAG = sourceIsHlg() ? "" : "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv,";
for (const t of probes) {
  const log = sh("ffmpeg", ["-hide_banner", "-v", "info", "-ss", String(t), "-t", "1", "-i", SOURCE, "-ss", String(t), "-t", "1", "-i", file,
    "-filter_complex", `[0:v]${TAG}format=yuv420p10le[a];[1:v]${TAG}format=yuv420p10le[b];[a][b]psnr[o]`, "-map", "[o]", "-f", "null", "-"]);
  const m = log.match(/PSNR y:([\d.inf]+) u:([\d.inf]+) v:([\d.inf]+) average:([\d.inf]+) min:([\d.inf]+)/);
  // averaged over the same 1 s window as the PSNR (a single-frame seek can land one frame apart on some sources)
  const stat = (f) => { const s = sh("ffmpeg", ["-hide_banner", "-v", "error", "-ss", String(t), "-t", "1", "-i", f, "-vf", "format=yuv420p10le,signalstats,metadata=print:file=-", "-f", "null", "-"]);
    const g = (k) => { const v = [...s.matchAll(new RegExp(`${k}=([\\d.]+)`, "g"))].map((x) => Number(x[1])); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) : NaN; };
    return { YMIN: g("YMIN"), YLOW: g("YLOW"), YAVG: g("YAVG"), YHIGH: g("YHIGH"), YMAX: g("YMAX"), UAVG: g("UAVG"), VAVG: g("VAVG") }; };
  const a = stat(SOURCE), b = stat(file);
  metrics.push({ t, psnr: m ? { y: +m[1], u: +m[2], v: +m[3], min: +m[5] } : null, source: a, output: b,
    dYavg: +(b.YAVG - a.YAVG).toFixed(3), dUavg: +(b.UAVG - a.UAVG).toFixed(3), dVavg: +(b.VAVG - a.VAVG).toFixed(3), dYlow: b.YLOW - a.YLOW, dYhigh: b.YHIGH - a.YHIGH, dYmax: b.YMAX - a.YMAX });
}
const worstPsnr = Math.min(...metrics.map((m) => m.psnr?.y ?? 0));
const worstShift = Math.max(...metrics.flatMap((m) => [Math.abs(m.dYavg), Math.abs(m.dUavg), Math.abs(m.dVavg)]));
check("untouched-picture-psnr", worstPsnr >= 40, `${metrics.length} pencere, en düşük Y-PSNR ${worstPsnr.toFixed(2)} dB`);
check("no-level-or-colour-shift", worstShift < 0.5, `ortalama Y/U/V kayması en çok ${worstShift.toFixed(3)} kod (10 bit)`);
// YMAX/YMIN are single-pixel extremes (noisy under lossy coding) and are reported only; the pass
// criterion uses the 10th/90th percentiles plus "no new clipping at the legal-range limits".
check("no-contrast-or-highlight-change", metrics.every((m) => Math.abs(m.dYhigh) <= 3 && Math.abs(m.dYlow) <= 3 && !(m.output.YMAX >= 1019 && m.source.YMAX < 1019)),
  `YHIGH farkı: ${metrics.map((m) => m.dYhigh).join(", ")} | YLOW farkı: ${metrics.map((m) => m.dYlow).join(", ")} | YMAX farkı (bilgi): ${metrics.map((m) => m.dYmax).join(", ")}`);

// ---- 4. full decode: errors + unexpected black -----------------------------------------------
let decode = null;
if (!process.argv.includes("--skip-decode")) {
  const log = sh("ffmpeg", ["-hide_banner", "-v", "info", "-i", file, "-map", "0:v:0", "-vf", "blackdetect=d=0.1:pic_th=0.98:pix_th=0.06", "-f", "null", "-"]);
  const errors = log.split("\n").filter((l) => /error|corrupt|invalid|missing/i.test(l) && !/Dolby|cover type/.test(l));
  const black = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const decoded = Number((log.match(/frame=\s*(\d+)(?![\s\S]*frame=)/) ?? [])[1]);
  decode = { decoded, errors, black };
  check("full-decode", errors.length === 0 && decoded === Number(sv.nb_frames), `${decoded} kare çözüldü, ${errors.length} hata`);
  check("no-unexpected-black", black.length === 0, black.length ? JSON.stringify(black) : "siyah kare aralığı yok");
}

// ---- 5. stills for visual review: entrance / hold / exit of every event ----------------------
if (process.argv.includes("--stills")) {
  const dir = p("work/qc/stills", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const e of plan.events) {
    for (const [label, t] of [["1giris", e.start + 0.2], ["2tutus", e.end - 0.6], ["3cikis", e.end - 0.08]]) {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", file, "-frames:v", "1", "-update", "1", "-vf", viewingTransform({ width: 960, height: 540 }), "-q:v", "3",
        `${dir}/${String(++n).padStart(3, "0")}_${e.id}_${label}.jpg`]);
    }
  }
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", `${dir}/*.jpg`, "-vf", "tile=3x3:padding=4:color=black", "-q:v", "4", `${dir}/sheet_%02d.jpg`]);
  console.log(`Kareler: ${dir} (${readdirSync(dir).filter((f) => f.startsWith("sheet_")).length} kontak sayfası; satır = olay, sütun = giriş/tutuş/çıkış)`);
}

const passed = checks.every((c) => c.pass);
mkdirSync(p("work/qc/reports"), { recursive: true });
writeFileSync(p("work/qc/reports", `qc.${name}.json`), JSON.stringify({ file: path.relative(p(), file), sizeBytes: Number(out.format.size), bitrate: Number(out.format.bit_rate), passed, checks, untouchedPictureWindows: metrics, decode, audio: audioReport }, null, 2));
console.log(passed ? "\nTÜM OTOMATİK KONTROLLER GEÇTİ" : "\nBAŞARISIZ KONTROL VAR");
if (process.argv.includes("--promote")) {
  if (!passed) { console.error("Aday terfi ettirilmedi."); process.exit(1); }
  const dest = arg("promote-to") ? p(arg("promote-to")) : FINAL;
  mkdirSync(path.dirname(dest), { recursive: true });
  renameSync(file, dest);
  console.log(`Terfi: ${dest}`);
}
process.exit(passed ? 0 : 1);
