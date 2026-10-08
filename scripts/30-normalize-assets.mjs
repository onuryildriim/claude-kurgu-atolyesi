// Normalises supplementary videos for deterministic playback inside Remotion (Chrome):
// H.264 8-bit, BT.709 limited range, constant frame rate = the source cadence, NO audio (asset audio is never approved).
// Originals in public/assets/ are read-only; results go to public/derived/assets/<id>.mp4.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { p, sourceTiming } from "./lib/paths.mjs";

// The list is DATA: work/assets.config.json → { "videos": [{ id, src, trim?: [from, to], fit?: seconds, p3?: bool }] }.
// If the file is missing it is created with one plain entry per video found in public/assets/.
//   trim + fit: speed = (to − from) / fit is BAKED here, so Remotion always plays 1× (deterministic).
//   p3: Display-P3/sRGB screen recordings → BT.709; detected automatically from the stream tags when omitted.
const CONFIG = p("work/assets.config.json");
if (!existsSync(CONFIG)) {
  const slug = (n) => n.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const found = existsSync(p("public/assets")) ? readdirSync(p("public/assets")).filter((n) => /\.(mov|mp4|m4v)$/i.test(n)).sort() : [];
  mkdirSync(p("work"), { recursive: true });
  writeFileSync(CONFIG, JSON.stringify({ videos: found.map((n) => ({ id: slug(n), src: `public/assets/${n}` })) }, null, 2) + "\n");
  console.log(`oluşturuldu  work/assets.config.json (${found.length} video)`);
}
export const VIDEO_ASSETS = JSON.parse(readFileSync(CONFIG, "utf8")).videos;

const outDir = p("public/derived/assets");
const FPS = (() => { const { fpsNum, fpsDen } = sourceTiming(); return fpsDen === 1 ? String(fpsNum) : `${fpsNum}/${fpsDen}`; })();
mkdirSync(outDir, { recursive: true });
const probe = (file) =>
  JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_range,color_primaries,width,height", "-of", "json", file], { encoding: "utf8" })).streams[0];

for (const a of VIDEO_ASSETS) {
  const out = `${outDir}/${a.id}.mp4`;
  if (existsSync(out) && !process.argv.includes("--force")) { console.log(`atlandı  ${a.id}`); continue; }
  const src = p(a.src);
  const { color_range, color_primaries } = probe(src);
  const p3 = a.p3 ?? color_primaries === "smpte432";
  const inRange = color_range === "pc" ? "pc" : "tv";
  const tmp = out.replace(/\.mp4$/, ".partial.mp4");
  const speed = a.trim ? (a.trim[1] - a.trim[0]) / a.fit : 1;
  const retime = a.trim ? `trim=start=${a.trim[0]}:end=${a.trim[1]},setpts=(PTS-STARTPTS)/${speed.toFixed(6)},` : "";
  const gamut = p3 ? `colorspace=all=bt709:ispace=bt709:iprimaries=smpte432:itrc=iec61966-2-1:irange=${inRange}:range=tv:format=yuv420p,` : "";
  execFileSync("ffmpeg", [
    "-hide_banner", "-v", "error", "-y", "-i", src, "-map", "0:v:0", "-an",
    "-vf", `${retime}fps=${FPS},${gamut}scale=in_color_matrix=bt709:in_range=${p3 ? "tv" : inRange}:out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-g", "15",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    "-movflags", "+faststart", tmp,
  ], { stdio: "inherit" });
  renameSync(tmp, out);
  console.log(`yazıldı  ${a.id}  (${inRange} -> tv, CFR ${FPS}, sessiz${a.trim ? `, ${a.trim[0]}–${a.trim[1]} sn ×${speed.toFixed(2)}` : ""}${p3 ? ", P3→BT.709" : ""})`);
}
