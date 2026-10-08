// Builds the clearly-labelled SDR PREVIEW proxy used only by Remotion Studio for layout review.
// It is tone-mapped with the documented viewing LUT and is never an input to the HLG master.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { SOURCE, PROXY, LUT_PREVIEW, sourceTiming } from "./lib/paths.mjs";
import { viewingTransform } from "./lib/filters.mjs";

if (existsSync(PROXY) && !process.argv.includes("--force")) {
  console.log(`Proxy zaten var, atlanıyor: ${PROXY} (yeniden üretmek için --force)`);
  process.exit(0);
}
if (!existsSync(LUT_PREVIEW)) throw new Error("Önce `npm run luts` çalıştırın.");
const { fpsNum, fpsDen } = sourceTiming();
mkdirSync(path.dirname(PROXY), { recursive: true });
const tmp = PROXY.replace(/\.mp4$/, ".partial.mp4");

execFileSync("ffmpeg", [
  "-hide_banner", "-v", "error", "-stats", "-y", "-i", SOURCE,
  "-map", "0:v:0", "-map", "0:a:0",
  "-vf", viewingTransform({ width: 1920, height: 1080 }),
  "-fps_mode", "passthrough", // source is strict CFR; passthrough keeps its exact timestamps (-r would contradict it)
  "-video_track_timescale", String(fpsNum * 10 / fpsDen),
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-g", "30", "-pix_fmt", "yuv420p",
  "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
  "-c:a", "aac", "-b:a", "128k", // preview-only audio; the master stream-copies the original track
  "-metadata", "title=SDR PREVIEW PROXY — not for delivery",
  "-movflags", "+faststart", tmp,
], { stdio: "inherit" });
renameSync(tmp, PROXY);
console.log(`Yazıldı: ${PROXY}`);
