// Sound design: builds the effects stem from the PLAN (sample-accurate, in Node), the music stem
// (gain + fades + gentle narration-keyed ducking, in FFmpeg) and sums them with the UNTOUCHED
// narration:  mix = narration + music stem + effects stem  (plain linear sum, no limiter).
// The video stream is never re-encoded; audio is encoded exactly once (aac_at 256 kb/s).
//   node scripts/75-audio.mjs                    → stems + mix (work/audio/build) and the report
//   node scripts/75-audio.mjs --preview 0-40     → audition clip over the SDR proxy (work/audio/preview)
//   node scripts/75-audio.mjs --selection library/audio/selection.default.json   → try another selection file
//   node scripts/75-audio.mjs --mux              → mixed candidate from out/final-hlg.temiz-ses.mov (or the fresh candidate) + out/stems
// Choices live in work/audio/selection.json (which candidate per sound, levels in dB).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { p, PROXY, SOURCE, sourceTiming } from "./lib/paths.mjs";
import { loadPlan } from "./lib/plan.mjs";
import { viewingTransform } from "./lib/filters.mjs";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
// the narration's own sample rate (44.1 kHz camera audio, 48 kHz from other tools): never resample the narration
const SR = Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", SOURCE], { encoding: "utf8" }).trim()) || 44100, CH = 2;
const BUILD = p("work/audio/build");
mkdirSync(BUILD, { recursive: true });

// --selection <file> overrides the project file (tests); a new project starts from library/audio/selection.default.json
const selection = JSON.parse(readFileSync(p(arg("selection") ?? "work/audio/selection.json"), "utf8"));
// Music is SUPPLIED BY THE USER with each video (an audio file next to the other assets). If the selection does not
// point at an existing file, take the audio file in public/assets/ (name containing müzik/muzik/music wins, else the
// longest); only if there is none fall back to the approved library track.
const probeDur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());
const NO_MUSIC = selection.music === "none"; // no-music videos: the music stem is silence
if (NO_MUSIC) console.log("müzik  YOK (selection.music = \"none\")");
else if (!existsSync(p(selection.music))) {
  const dir = p("public/assets");
  const found = (existsSync(dir) ? readdirSync(dir) : []).filter((n) => /\.(mp3|wav|m4a|aac|flac|aif|aiff|ogg)$/i.test(n))
    .map((n) => ({ n, named: /m[uü]zi[kc]|music/i.test(n), dur: probeDur(`${dir}/${n}`) })).sort((x, y) => y.named - x.named || y.dur - x.dur);
  if (found.length) { selection.music = `public/assets/${found[0].n}`; console.log(`müzik  ${selection.music} (${found[0].dur.toFixed(0)} sn)${found.length > 1 ? ` — ${found.length} ses dosyasından seçildi` : ""}`); }
  else {
    // optional channel default track: the first audio file in library/audio/music/ (git-ignored, the user's own)
    const libDir = p("library/audio/music");
    const lib = selection.musicFallback ?? (existsSync(libDir) ? readdirSync(libDir).filter((n) => /\.(mp3|wav|m4a|aac|flac|aif|aiff|ogg)$/i.test(n)).map((n) => `library/audio/music/${n}`)[0] : undefined);
    if (lib && existsSync(p(lib))) { selection.music = lib; console.log(`UYARI  public/assets içinde müzik yok → kanalın varsayılan parçası: ${selection.music}`); }
    else throw new Error("Müzik yok: public/assets içine bir ses dosyası koyun, library/audio/music/ içine varsayılan bir parça koyun ya da work/audio/selection.json → music: \"none\" yazın.");
  }
}
const { levels } = selection;
const plan = loadPlan();
const { frames, fps } = sourceTiming();
const TOTAL = Math.round((frames / fps) * SR); // samples per channel = exact video length

const ff = (args, opts = {}) => execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { maxBuffer: 1 << 30, ...opts });
const decode = (file, extra = []) => { const b = ff(["-i", file, ...extra, "-map", "0:a:0", "-ac", String(CH), "-ar", String(SR), "-f", "f32le", "-"]); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const lin = (d) => 10 ** (d / 20);
const measure = (file) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const tail = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  return { lufs: Number(tail.match(/I:\s+(-?[\d.]+) LUFS/)[1]), truePeak: Number(tail.match(/Peak:\s+(-?[\d.]+) dBFS/)[1]) };
};
const writeWav = (file, data) => { // 32-bit float WAV: the sum stays exact, nothing is quantised before the single AAC encode
  const h = Buffer.alloc(58);
  const bytes = data.length * 4;
  h.write("RIFF", 0); h.writeUInt32LE(50 + bytes, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(18, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(CH, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * CH * 4, 28); h.writeUInt16LE(CH * 4, 32); h.writeUInt16LE(32, 34); h.writeUInt16LE(0, 36);
  h.write("fact", 38); h.writeUInt32LE(4, 42); h.writeUInt32LE(data.length / CH, 46); h.write("data", 50); h.writeUInt32LE(bytes, 54);
  writeFileSync(file, Buffer.concat([h, Buffer.from(data.buffer, data.byteOffset, bytes)]));
};

// ── 1. narration: decoded once. NOT processed — unless the user asked for it (selection.narration) ─────────
// selection.narration (only when the user asks to lift quiet parts):
//   { parts: [{ from, to, gainDb }], gate: true, compressor: true, targetLufs: -16, limitDbfs: -2 }
//   parts: constant gain per source range (applied at the splices, where the signal is already faded to silence);
//   gate: gentle downward expander (range −10 dB) so raised room tone stays down in pauses; compressor 2.5:1;
//   then one constant gain to targetLufs and a sample-peak limiter with latency compensation. No delay is added.
const narrationRaw = decode(SOURCE);
let narration = new Float32Array(TOTAL * CH);
narration.set(narrationRaw.subarray(0, Math.min(narrationRaw.length, narration.length)));
writeWav(`${BUILD}/narration.source.wav`, narration);
const NP = selection.narration;
if (NP) {
  const partGain = (NP.parts ?? []).map((pt) => `between(t,${pt.from},${pt.to})*${(10 ** (pt.gainDb / 20)).toFixed(5)}`).join("+");
  const vol = partGain ? `volume='if(${(NP.parts ?? []).map((pt) => `between(t,${pt.from},${pt.to})`).join("+")},${partGain},1)':eval=frame` : "anull";
  const dyn = [vol,
    NP.gate ? "agate=threshold=0.0045:ratio=2:range=0.32:attack=10:release=250:knee=2.5" : null,
    NP.compressor ? "acompressor=threshold=0.04:ratio=2.5:attack=8:release=180:knee=4:makeup=1" : null].filter(Boolean).join(",");
  ff(["-i", `${BUILD}/narration.source.wav`, "-af", dyn, "-c:a", "pcm_f32le", `${BUILD}/narration.dyn.wav`]);
  const m1 = measure(`${BUILD}/narration.dyn.wav`);
  const g = (NP.targetLufs ?? -16) - m1.lufs;
  const lim = (10 ** ((NP.limitDbfs ?? -2) / 20)).toFixed(4);
  ff(["-i", `${BUILD}/narration.dyn.wav`, "-af", `volume=${g.toFixed(2)}dB,alimiter=limit=${lim}:attack=5:release=60:level=disabled:latency=1`, "-c:a", "pcm_f32le", `${BUILD}/narration.proc.wav`]);
  narration = new Float32Array(TOTAL * CH);
  const proc = decode(`${BUILD}/narration.proc.wav`);
  narration.set(proc.subarray(0, Math.min(proc.length, narration.length)));
  console.log(`anlatım işlendi (kullanıcı isteği): bölümler ${JSON.stringify(NP.parts)} · kapı ${!!NP.gate} · kompresör ${!!NP.compressor} · +${g.toFixed(1)} dB → hedef ${NP.targetLufs ?? -16} LUFS`);
}
writeWav(`${BUILD}/narration.wav`, narration);
const narr = measure(`${BUILD}/narration.wav`);

// ── 2. cue list from the plan ──────────────────────────────────────────────────────────────────
// priority decides who survives when two cues are closer than MIN_GAP (a list's first item right
// after its panel whoosh, a card pop right after the stack appears, …). Exits are silent.
const MIN_GAP = 0.35;
const cues = [];
for (const e of plan.events) {
  if (e.sfx === false) continue;
  const c = e.content;
  // two whooshes: the quick one for compact panels, the slower one for large panels that build up
  const whoosh = typeof selection.sfx.whoosh === "string" ? "whoosh" : (selection.whooshSlowTypes ?? []).includes(e.type) ? "whoosh.slow" : "whoosh.fast";
  cues.push({ t: e.start, kind: e.side === "full" ? "transition" : whoosh, pr: 2, id: e.id });
  for (const k of ["items", "steps", "notes", "rows", "chips", "queries", "highlights"]) for (const x of c[k] ?? []) cues.push({ t: x.at, kind: "tick", pr: 1, id: e.id });
  for (const k of ["caption", "footer", "question", "cta"]) if (c[k]?.at !== undefined) cues.push({ t: c[k].at, kind: "tick", pr: 1, id: e.id });
  for (const k of ["subAt", "countAt", "topAt"]) if (c[k] !== undefined) cues.push({ t: c[k], kind: "tick", pr: 1, id: e.id });
  for (const x of c.images ?? []) cues.push({ t: x.at, kind: "pop", pr: 3, id: e.id });
  if (c.strikeAt !== undefined) cues.push({ t: c.strikeAt, kind: "pen", pr: 3, id: e.id });
  // project-2 components
  for (const x of c.badges ?? []) cues.push({ t: x.at, kind: x.emphasis ? "pop" : "tick", pr: x.emphasis ? 3 : 1, id: e.id });
  for (const x of c.lines ?? []) {
    cues.push({ t: x.at, kind: e.type === "punch" ? "whoosh.fast" : "tick", pr: 2, id: e.id });
    if (x.tone === "no") cues.push({ t: x.at + 0.42, kind: "pen", pr: 3, id: e.id });
  }
  for (const side of ["left", "right"]) if (e.type === "compare") { cues.push({ t: c[side].at, kind: "tick", pr: 1, id: e.id }); for (const x of c[side].items) cues.push({ t: x.at, kind: "tick", pr: 1, id: e.id }); }
  for (const x of c.prompts ?? []) cues.push({ t: x.at, kind: "pop", pr: 3, id: e.id });
  for (const x of c.titles ?? []) cues.push({ t: x.at, kind: "whoosh.fast", pr: 2, id: e.id });
  if (e.type === "hook") { cues.push({ t: c.countAt, kind: "whoosh.slow", pr: 2, id: e.id }); cues.push({ t: c.revealAt, kind: "transition", pr: 2, id: e.id }); }
}
// ── v2 components: designed cues synthesised by scripts/lib/synth.mjs (work/audio/cues/<name>.wav) ──
const typing = []; // typed text: one key click per character, outside the MIN_GAP thinning (a bed, not a cue)
const typeBurst = (t, text, seconds, id) => { const n = text.length, step = Math.max(seconds / Math.max(1, n), 0.045); for (let i = 0; i < n; i++) if (text[i] !== " ") typing.push({ t: t + i * step, kind: "cue:type", pr: 0, id }); };
const C = (t, name, pr, id) => cues.push({ t, kind: name === "tick" ? "tick" : `cue:${name}`, pr, id }); // "tick" = the approved library tick
for (const e of plan.events) {
  if (e.sfx === false) continue;
  const c = e.content;
  for (const x of e.cues ?? []) C(x.at, x.kind, 4, e.id);
  if (e.type === "stage") {
    // the generic entrance whoosh pushed above is replaced by the camera swoosh of the morph
    for (let i = cues.length - 1; i >= 0; i--) if (cues[i].id === e.id && cues[i].t === e.start && !cues[i].kind.startsWith("cue:")) cues.splice(i, 1);
    C(e.start + 0.05, "swoosh-cam", 2, e.id);
    C(e.end - 0.62, "swoosh-cam", 2, e.id);
    c.scenes.forEach((sc, i) => { if (i > 0) C(sc.at, "swoosh-cam", 2, e.id); });
    for (const sc of c.scenes) {
      const b = sc.board;
      if (b.kind === "questions") for (const x of b.items) C(x.at, "ping", 1, e.id);
      if (b.kind === "list") for (const x of b.items) C(x.at + 0.1, b.marker === "check" ? "tick-ok" : "ping", 1, e.id);
      if (b.kind === "terminal") {
        for (const l of b.lines) { if (l.tone === "cmd") typeBurst(l.at, l.text, l.typeSeconds ?? Math.max(0.5, l.text.length / 22), e.id); else C(l.at, l.tone === "accent" ? "ping" : "tick", 1, e.id); }
        for (const x of b.chips) C(x.at, x.on ? "tick-ok" : "pop", 1, e.id);
      }
      if (b.kind === "app") { C(b.clips[0].at, "pop", 2, e.id); for (const x of b.points) C(x.at + 0.1, "tick-ok", 1, e.id); }
    }
  }
  if (e.type === "kinetic") {
    for (let i = cues.length - 1; i >= 0; i--) if (cues[i].id === e.id && !cues[i].kind.startsWith("cue:")) cues.splice(i, 1);
    typing.push({ t: c.lines[0].at, kind: "cue:riser-end", pr: 0, id: e.id }); // the riser ENDS on the first line: it precedes the impact, so it bypasses the MIN_GAP thinning
    C(c.lines[0].at, "impact", 4, e.id);
    for (const l of c.lines.slice(1)) C(l.at, "thock", 2, e.id);
  }
  if (e.type === "subscribe") {
    for (let i = cues.length - 1; i >= 0; i--) if (cues[i].id === e.id && !cues[i].kind.startsWith("cue:")) cues.splice(i, 1);
    C(e.start + 0.05, "swoosh-cam", 2, e.id);
    C(c.clickAt, "click", 3, e.id); C(c.bellAt, "click", 3, e.id); C(c.bellAt + 0.05, "bell", 4, e.id); C(c.likeAt, "click", 3, e.id); C(c.likeAt + 0.05, "pop", 4, e.id);
  }
  if (e.type === "tag") for (let i = cues.length - 1; i >= 0; i--) if (cues[i].id === e.id) cues.splice(i, 1); // the log layer is silent
  if (e.type === "screen") {
    for (const a of c.tree?.active ?? []) C(a.at, "ping", 1, e.id);
    for (const sk of c.skips ?? []) C(sk.at, "fast-forward", 4, e.id);
    let z = 1; for (const k of c.camera ?? []) { if (Math.abs(k.zoom - z) > 0.2) C(k.at, "swoosh-cam", 1, e.id); z = k.zoom; }
  }
  if (e.type === "chapter") { for (let i = cues.length - 1; i >= 0; i--) if (cues[i].id === e.id) cues.splice(i, 1); C(e.start, "swoosh-deep", 3, e.id); }
}
cues.sort((a, b) => a.t - b.t);
const kept = [];
for (const cue of cues) {
  const last = kept.at(-1);
  if (last && cue.t - last.t < MIN_GAP) { if (cue.pr > last.pr) kept[kept.length - 1] = cue; continue; }
  kept.push(cue);
}

kept.push(...typing.filter((tp, i, arr) => tp.kind !== "cue:type" || i === 0 || tp.t - arr[i - 1].t >= 0.04)); // ≤ 25 clicks/s
kept.sort((a, b) => a.t - b.t);

// ── 3. effects stem (sample-accurate placement) ────────────────────────────────────────────────
const WINDOW = Math.round(0.05 * SR);
const TRIM = { whoosh: 0, transition: 1, tick: -3, pop: -2, pen: -2 }; // dB, relative to levels.sfxDb
const sounds = {};
const chosen = Object.entries(selection.sfx).flatMap(([kind, v]) => (typeof v === "string" ? [[kind, v]] : Object.entries(v).map(([variant, file]) => [`${kind}.${variant}`, file])));
for (const [kind, file] of chosen) {
  const pcm = decode(p(file));
  const n = pcm.length / CH;
  const mono = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) { mono[i] = (pcm[i * 2] + pcm[i * 2 + 1]) / 2; peak = Math.max(peak, Math.abs(pcm[i * 2]), Math.abs(pcm[i * 2 + 1])); }
  // loudest 50 ms window (RMS) and where it sits; onset = first sample within 30 dB of the peak
  let acc = 0, best = 0, bestAt = 0;
  for (let i = 0; i < n; i++) { acc += mono[i] ** 2; if (i >= WINDOW) acc -= mono[i - WINDOW] ** 2; if (acc > best) { best = acc; bestAt = i - WINDOW / 2; } }
  const rmsDb = db(Math.sqrt(best / WINDOW));
  let onset = 0; while (onset < n && Math.abs(mono[onset]) < peak * lin(-30)) onset++;
  // loudest window → narration loudness + sfxDb (+ per-kind trim); never let an effect peak above the voice − 3 dB
  let gainDb = narr.lufs + levels.sfxDb + TRIM[kind.split(".")[0]] - rmsDb;
  gainDb = Math.min(gainDb, narr.truePeak - 3 - db(peak));
  sounds[kind] = { pcm, n, gain: lin(gainDb), gainDb, onset, peakAt: Math.max(0, Math.round(bestAt)), file };
}
// synthesised cues: level set relative to the narration like the base set, per-cue trims (dB)
const CUE_TRIM = { type: -12, click: -6, "tick-ok": -5, ping: -7, "swoosh-cam": -4, riser: -5, impact: -1, strike: -4, bell: -5, pop: -5, "swoosh-deep": -1, "fast-forward": -4, thock: -9, tick: -3 };
const usedCues = new Set(kept.filter((c) => c.kind.startsWith("cue:")).map((c) => c.kind.slice(4).replace(/-end$/, "")));
for (const name of usedCues) {
  const file = p(`work/audio/cues/${name}.wav`);
  if (!existsSync(file)) throw new Error(`Cue yok: ${file} → node scripts/lib/synth.mjs`);
  const pcm = decode(file);
  const n = pcm.length / CH;
  const mono = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) { mono[i] = (pcm[i * 2] + pcm[i * 2 + 1]) / 2; peak = Math.max(peak, Math.abs(pcm[i * 2]), Math.abs(pcm[i * 2 + 1])); }
  let acc = 0, best = 0, bestAt = 0;
  for (let i = 0; i < n; i++) { acc += mono[i] ** 2; if (i >= WINDOW) acc -= mono[i - WINDOW] ** 2; if (acc > best) { best = acc; bestAt = i - WINDOW / 2; } }
  let onset = 0; while (onset < n && Math.abs(mono[onset]) < peak * lin(-30)) onset++;
  let gainDb = narr.lufs + levels.sfxDb + (CUE_TRIM[name] ?? -6) - db(Math.sqrt(best / WINDOW));
  gainDb = Math.min(gainDb, narr.truePeak - 3 - db(peak));
  const snd = { pcm, n, gain: lin(gainDb), gainDb, onset, peakAt: Math.max(0, Math.round(bestAt)), file: `work/audio/cues/${name}.wav` };
  sounds[`cue:${name}`] = snd;
  sounds[`cue:${name}-end`] = { ...snd, anchorEnd: true };
}
const sfxStem = new Float32Array(TOTAL * CH);
const placed = [];
for (const cue of kept) {
  const s = sounds[cue.kind];
  // swells: their loudest moment lands just after the graphic starts moving; transients: onset on the cue
  const swell = cue.kind.startsWith("whoosh") || cue.kind === "transition" || cue.kind.startsWith("cue:swoosh");
  const anchor = s.anchorEnd ? s.n - Math.round(0.02 * SR) : swell ? Math.min(s.peakAt, Math.round(0.6 * SR)) - Math.round(0.15 * SR) : s.onset;
  const start = Math.max(0, Math.round(cue.t * SR) - anchor);
  for (let i = 0; i < s.n && start + i < TOTAL; i++) { sfxStem[(start + i) * 2] += s.pcm[i * 2] * s.gain; sfxStem[(start + i) * 2 + 1] += s.pcm[i * 2 + 1] * s.gain; }
  placed.push({ ...cue, startSample: start });
}
writeWav(`${BUILD}/stem-efekt.wav`, sfxStem);

// ── 4. music stem: gain → fades → ducking keyed by the narration ───────────────────────────────
let musicFile = NO_MUSIC ? null : p(selection.music);
if (!NO_MUSIC) { // shorter than the video → repeat it with 5 s equal-power crossfades (no hard seam), never stretch it
  const len = probeDur(musicFile), need = frames / fps, X = 5;
  if (len < need - 1) {
    const n = Math.ceil((need - X) / (len - X));
    const chain = Array.from({ length: n - 1 }, (_, i) => `[${i === 0 ? "0:a" : `x${i}`}][${i + 1}:a]acrossfade=d=${X}:c1=qsin:c2=qsin[x${i + 1}]`).join(";");
    ff([...Array.from({ length: n }, () => ["-i", musicFile]).flat(), "-filter_complex", chain, "-map", `[x${n - 1}]`, "-c:a", "pcm_f32le", `${BUILD}/music-looped.wav`]);
    console.log(`müzik videodan kısa (${len.toFixed(0)} < ${need.toFixed(0)} sn) → ${n} kez, ${X} sn çapraz geçişle yinelendi`);
    musicFile = `${BUILD}/music-looped.wav`;
  }
}
const dur = frames / fps;
const music = NO_MUSIC ? { lufs: null, truePeak: null } : measure(musicFile);
const musicGainDb = NO_MUSIC ? 0 : narr.lufs + levels.musicDb - music.lufs;
if (NO_MUSIC) writeWav(`${BUILD}/stem-muzik.wav`, new Float32Array(TOTAL * CH));
else {
const duck = levels.duck ? `[m][1:a]sidechaincompress=threshold=0.0316:ratio=${levels.duckRatio ?? 1.6}:attack=15:release=350:detection=rms:makeup=1[out]` : "[m]anull[out]";
ff(["-i", musicFile, "-i", `${BUILD}/narration.wav`, "-filter_complex",
  `[0:a]aresample=${SR}:filter_size=64:cutoff=0.97,aformat=sample_fmts=flt:channel_layouts=stereo,atrim=0:${dur},volume=${musicGainDb.toFixed(2)}dB,afade=t=in:st=0:d=${levels.fadeIn},afade=t=out:st=${(dur - levels.fadeOut).toFixed(3)}:d=${levels.fadeOut},apad=whole_len=${TOTAL}[m];${duck}`,
  "-map", "[out]", "-c:a", "pcm_f32le", `${BUILD}/stem-muzik.wav`]);
}
const musicStem = decode(`${BUILD}/stem-muzik.wav`).subarray(0, TOTAL * CH);

// ── 5. the mix is a plain sum ──────────────────────────────────────────────────────────────────
const mix = new Float32Array(TOTAL * CH);
for (let i = 0; i < mix.length; i++) mix[i] = narration[i] + (musicStem[i] ?? 0) + sfxStem[i];
writeWav(`${BUILD}/mix.wav`, mix);
const mixM = measure(`${BUILD}/mix.wav`), musM = NO_MUSIC ? { lufs: null, truePeak: null } : measure(`${BUILD}/stem-muzik.wav`);

const report = {
  createdFrom: { selection, planEvents: plan.events.length },
  sampleRate: SR, samplesPerChannel: TOTAL,
  narration: narr, musicSource: music, musicGainDb: Number(musicGainDb.toFixed(2)), musicStem: musM,
  musicBelowNarrationLu: NO_MUSIC ? null : Number((narr.lufs - musM.lufs).toFixed(1)),
  sfx: Object.fromEntries(Object.entries(sounds).map(([k, s]) => [k, { file: s.file, gainDb: Number(s.gainDb.toFixed(1)), onsetMs: Math.round((s.onset / SR) * 1000), loudestAtMs: Math.round((s.peakAt / SR) * 1000) }])),
  cues: { candidates: cues.length, placed: placed.length, byKind: placed.reduce((o, c) => ({ ...o, [c.kind]: (o[c.kind] ?? 0) + 1 }), {}) },
  mix: mixM, truePeakOk: mixM.truePeak <= -1,
  cueList: placed.map((c) => ({ t: c.t, kind: c.kind, id: c.id })),
};
writeFileSync(`${BUILD}/audio-report.json`, JSON.stringify(report, null, 2));
console.log(`anlatım ${narr.lufs} LUFS / ${narr.truePeak} dBTP · müzik stem ${musM.lufs} LUFS (anlatımın ${report.musicBelowNarrationLu} LU altı) · ${placed.length} efekt (${JSON.stringify(report.cues.byKind)})`);
console.log(`miks ${mixM.lufs} LUFS, gerçek tepe ${mixM.truePeak} dBTP ${report.truePeakOk ? "(≤ −1 ✓)" : "(> −1 ✗ — seviyeleri düşürün)"}`);
if (!report.truePeakOk) process.exit(1);

// ── 6. optional outputs ────────────────────────────────────────────────────────────────────────
const preview = arg("preview");
if (preview) {
  const [a, b] = preview.split("-").map(Number);
  mkdirSync(p("work/audio/preview"), { recursive: true });
  const out = p(`work/audio/preview/onizleme_${a}-${b}.mp4`);
  // picture: the checked master with graphics if it exists (SDR viewing transform), else the bare proxy
  const master = [p("out/final-en.temiz-ses.mov"), p("out/final-hlg.temiz-ses.mov")].find((f) => existsSync(f)) ?? "";
  const [video, vf] = existsSync(master) ? [master, viewingTransform({ width: 1280, height: 720 })] : [PROXY, "scale=1280:-2"];
  ff(["-ss", String(a), "-t", String(b - a), "-i", video, "-ss", String(a), "-t", String(b - a), "-i", `${BUILD}/mix.wav`, "-map", "0:v:0", "-map", "1:a:0",
    "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac_at", "-b:a", "256k", "-movflags", "+faststart", out]);
  console.log(`önizleme → ${out} (yalnızca ses dengesi/eşzamanlılık için; renk referansı değildir)`);
}
if (process.argv.includes("--mux")) {
  // the fully checked clean-audio master if it was already promoted, else the fresh candidate
  const candidate = [p("out/final-en.temiz-ses.mov"), p("out/final-hlg.temiz-ses.mov"), p("work/composite/final-hlg.candidate.mov")].find((f) => existsSync(f));
  if (!candidate) throw new Error("Video master'ı yok — önce `npm run composite` (ve `npm run qc`).");
  const out = p("work/composite/final-hlg.mix.candidate.mov");
  ff(["-i", candidate, "-i", `${BUILD}/mix.wav`, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac_at", "-b:a", "256k", "-ar", String(SR),
    "-map_metadata", "-1", "-tag:v", "hvc1", "-movflags", "+faststart+write_colr", "-f", "mov", out]);
  mkdirSync(p("out/stems"), { recursive: true });
  ff(["-i", `${BUILD}/stem-muzik.wav`, "-c:a", "pcm_s24le", p("out/stems/muzik.wav")]);
  ff(["-i", `${BUILD}/stem-efekt.wav`, "-c:a", "pcm_s24le", p("out/stems/efekt.wav")]);
  const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
  writeFileSync(p("work/audio/audio-manifest.json"), JSON.stringify({ ...report, cueList: undefined, stems: { muzik: sha(p("out/stems/muzik.wav")), efekt: sha(p("out/stems/efekt.wav")) } }, null, 2));
  console.log(`miksli aday → ${out}\nstem'ler → out/stems/{muzik,efekt}.wav`);
}
