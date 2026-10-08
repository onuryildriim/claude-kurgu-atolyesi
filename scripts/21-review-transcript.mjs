// Applies the reviewed corrections to the raw whisper output and writes the deliverable
// transcript files. Fails loudly if a correction no longer matches (so nothing is silently lost).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { p } from "./lib/paths.mjs";

const raw = JSON.parse(readFileSync(p("work/transcript/raw.json"), "utf8"));
const { corrections, uncertain } = JSON.parse(readFileSync(p("work/transcript/corrections.tr.json"), "utf8"));
const meta = JSON.parse(readFileSync(p("work/source-metadata.json"), "utf8"));

let segments = raw.transcription
  .map((s) => ({ start: s.offsets.from / 1000, end: s.offsets.to / 1000, text: s.text.trim() }))
  .filter((s) => s.text.length > 0);

// Corrections may span a segment boundary, so they are applied on the joined text with markers.
const SEP = " ␂ ";
let joined = segments.map((s) => s.text).join(SEP);
const used = [];
for (const c of corrections) {
  const flexible = c.from.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(`(?: | ␂ )`);
  // "all": true replaces every occurrence (recurring mis-hearings such as "Cloud" → "Claude"), word-bounded
  if (c.all) {
    const reAll = new RegExp(`(?<![\\p{L}\\p{N}])${c.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu");
    const n = (joined.match(reAll) ?? []).length;
    if (!n) { console.error(`Düzeltme eşleşmedi: "${c.from}"`); process.exit(1); }
    joined = joined.replace(reAll, c.to);
    used.push({ ...c, count: n });
    continue;
  }
  const re = new RegExp(flexible);
  const m = joined.match(re);
  if (!m) { console.error(`Düzeltme eşleşmedi: "${c.from}"`); process.exit(1); }
  // keep segment markers that were inside the match
  const seps = (m[0].match(/␂/g) ?? []).length;
  joined = joined.replace(re, seps ? c.to + SEP.repeat(seps) : c.to);
  used.push(c);
}
const texts = joined.split("␂").map((t) => t.replace(/\s+/g, " ").trim());
if (texts.length !== segments.length) { console.error("Segment sayısı değişti; düzeltmeleri kontrol edin."); process.exit(1); }
segments = segments.map((s, i) => ({ ...s, text: texts[i] })).filter((s) => s.text);

const srtTime = (t) => {
  const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
const srt = segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join("\n");
const txt = segments.map((s) => s.text).join("\n") + "\n";
const duration = meta.summary.durationSeconds;

writeFileSync(p("work/transcript.tr.txt"), txt);
writeFileSync(p("work/transcript.tr.srt"), srt);
writeFileSync(p("work/transcript.tr.json"), JSON.stringify({
  source: meta.source.path, sourceSizeBytes: meta.source.sizeBytes, sourceDurationSeconds: duration,
  language: "tr", engine: "whisper.cpp 1.9.4", model: "ggml-large-v3-turbo",
  coverage: { firstStart: segments[0].start, lastEnd: segments.at(-1).end },
  timestampNote: "Segment zamanları whisper tahminidir (±0,2–0,5 sn); kare hassasiyetinde doğrulanmamıştır.",
  correctionsApplied: used, uncertainPassages: uncertain, segments,
}, null, 2));
mkdirSync(p("out"), { recursive: true });
writeFileSync(p("out/final.tr.srt"), srt);
console.log(`${segments.length} segment, ${segments[0].start.toFixed(2)}s → ${segments.at(-1).end.toFixed(2)}s / ${duration}s; ${used.length} düzeltme, ${uncertain.length} belirsiz pasaj işaretli.`);
