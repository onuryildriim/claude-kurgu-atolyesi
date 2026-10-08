// v2: also cuts the FULL 16:9 presenter clip of every `stage` event (content.presenter.src):
// the stage morphs that clip from the full frame into its card, so it must be the whole frame, 1920×1080.
// Cuts the presenter clips shown in the framed "PIP" box of `screen` events (content.pip) from the
// base timeline: same frames as the event, cropped around the presenter, tone-mapped to SDR with the
// documented viewing transform (the graphics layer is SDR and is lifted back to HLG with the gfx LUT).
//   node scripts/32-pip.mjs [--force]      → public/<content.pip.src> (e.g. public/derived/pip/E07.mp4)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { p, SOURCE, sourceTiming } from "./lib/paths.mjs";
import { loadPlan } from "./lib/plan.mjs";
import { viewingTransform } from "./lib/filters.mjs";

const BOX = { w: 518, h: 470 }; // src/events/ScreenEvents.tsx → pipBox (design units); clips are made at 2×
const force = process.argv.includes("--force");
const plan = loadPlan();
const { fps, width, height } = sourceTiming();
const cut = (id, src, startS, endS, vf) => {
  const out = p("public", src);
  if (existsSync(out) && !force && statSync(out).mtimeMs > statSync(SOURCE).mtimeMs) { console.log(`atlandı  ${id}`); return; }
  const start = Math.floor(startS * fps), frames = Math.ceil(endS * fps) - start;
  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = out.replace(/\.mp4$/, ".partial.mp4");
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-ss", (start / fps).toFixed(6), "-i", SOURCE, "-an",
    "-vf", `trim=end_frame=${frames},${vf}`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-g", "15", "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", "-movflags", "+faststart", tmp], { stdio: "inherit" });
  renameSync(tmp, out);
  console.log(`yazıldı  ${id}  kare ${start}+${frames}  → ${src}`);
};
for (const e of plan.events) {
  if (e.type === "stage") cut(e.id, e.content.presenter.src, e.start, e.end, viewingTransform({ width: 1920, height: 1080 }));
  if (e.type !== "screen" || !e.content.pip) continue;
  const { src, x, y, w } = e.content.pip;
  const out = p("public", src);
  if (existsSync(out) && !force && statSync(out).mtimeMs > statSync(SOURCE).mtimeMs) { console.log(`atlandı  ${e.id}`); continue; }
  const start = Math.floor(e.start * fps), frames = Math.ceil(e.end * fps) - start;
  const cw = Math.round((w * width) / 2) * 2, ch = Math.min(height, Math.round((cw * BOX.h) / BOX.w / 2) * 2);
  const cx = Math.max(0, Math.min(width - cw, Math.round(x * width))), cy = Math.max(0, Math.min(height - ch, Math.round(y * height)));
  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = out.replace(/\.mp4$/, ".partial.mp4");
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-ss", (start / fps).toFixed(6), "-i", SOURCE, "-an",
    "-vf", `trim=end_frame=${frames},crop=${cw}:${ch}:${cx}:${cy},${viewingTransform({ width: BOX.w * 2, height: BOX.h * 2 })}`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-g", "15", "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", "-movflags", "+faststart", tmp], { stdio: "inherit" });
  renameSync(tmp, out);
  console.log(`yazıldı  ${e.id}  kare ${start}+${frames}  kırpma ${cw}x${ch}@${cx},${cy}`);
}
