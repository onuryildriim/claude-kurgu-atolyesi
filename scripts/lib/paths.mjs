// Shared paths and verified source constants for all pipeline scripts.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const p = (...parts) => path.join(ROOT, ...parts);

export const ORIGINAL = p("public/main.mov"); // read-only original from the user (HEVC Main 10, Rec.2100 HLG)
// The pipeline's base timeline. Normally the original; when the user asks for clips to be spliced in
// (their own voice-over screen recordings, a restructured intro …) scripts/08-assemble.mjs builds
// public/derived/base.mov from work/assemble.json and work/project.json → "source" points at it.
const project = existsSync(p("work/project.json")) ? JSON.parse(readFileSync(p("work/project.json"), "utf8")) : {};
export const SOURCE = p(project.source ?? "public/main.mov");
export const PROXY = p("public/proxy/main.preview-sdr-1080p.mp4"); // SDR preview only, never in the master
export const PLAN = p("work/edit-plan.json");
export const LUT_GFX = p("work/luts/srgb_to_hlg_gfx203.cube");
export const LUT_PREVIEW = p("work/luts/hlg_to_sdr709_preview.cube");
export const SEGMENTS_DIR = p("work/segments");
export const FINAL = p("out/final-hlg.mov");

/** Cadence and length come from the probed metadata, never from hardcoded values. */
export const sourceTiming = () => {
  const f = p("work/source-metadata.json");
  if (!existsSync(f)) throw new Error("work/source-metadata.json yok — önce `npm run probe` çalıştırın.");
  const v = JSON.parse(readFileSync(f, "utf8")).summary.video;
  const [num, den] = v.rFrameRate.split("/").map(Number);
  return { fpsNum: num, fpsDen: den, fps: num / den, frames: v.nbFrames, width: v.width, height: v.height };
};
