// Placement check across shot changes: the presenter's framing jumps at every cut, so a panel
// that is safe at an event's start may cover the face after a cut. This samples a composite
// right after every detected cut that falls inside a side-panel event and tiles the frames.
//   node scripts/66-cut-check.mjs [--file work/composite/draft-hlg.mov]   → frames from a composite
//   node scripts/66-cut-check.mjs --remotion                               → fast: Remotion stills over the
//        SDR proxy (no graphics render needed); also samples every event's entrance and exit
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { p, PROXY } from "./lib/paths.mjs";
import { loadPlan } from "./lib/plan.mjs";
import { viewingTransform } from "./lib/filters.mjs";

const remotion = process.argv.includes("--remotion");
const i = process.argv.indexOf("--file");
const file = p(i > 0 ? process.argv[i + 1] : "work/composite/draft-hlg.mov");
const cutsFile = p("work/qc/reports/scene-cuts.txt");
if (!existsSync(cutsFile)) {
  spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-i", PROXY, "-an", "-vf", `scale=320:180,select='gt(scene,0.10)',metadata=print:file=${cutsFile}`, "-f", "null", "-"], { stdio: "inherit" });
}
// parse "pts_time:… / lavfi.scene_score=…" pairs; keep confident cuts, de-duplicate bursts
const cuts = [];
let t = 0;
for (const line of readFileSync(cutsFile, "utf8").split("\n")) {
  const m = line.match(/pts_time:([\d.]+)/);
  if (m) t = Number(m[1]);
  const s = line.match(/scene_score=([\d.]+)/);
  if (s && Number(s[1]) >= 0.13 && t - (cuts.at(-1) ?? -1) > 0.4) cuts.push(t);
}
writeFileSync(p("work/qc/reports/cuts.json"), JSON.stringify(cuts));

const plan = loadPlan();
const samples = [];
for (const e of plan.events) {
  if (e.side === "full") continue;
  if (remotion) samples.push({ id: e.id, side: e.side, t: e.start + 0.45 });
  for (const c of cuts) if (c > e.start - 0.2 && c < e.end - 0.5) samples.push({ id: e.id, side: e.side, t: Math.max(c + 0.3, e.start + 0.45) });
  if (remotion) samples.push({ id: e.id, side: e.side, t: e.end - 0.3 });
}
const dir = p("work/qc/stills/cuts");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
if (remotion) {
  const { bundle } = await import("@remotion/bundler");
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const { enableTailwind } = await import("@remotion/tailwind-v4");
  const serveUrl = await bundle({ entryPoint: p("src/index.ts"), webpackOverride: enableTailwind, publicDir: p("public") });
// bundle() leaves a full copy of public/ in the temp dir; remove it when this script ends
process.on("exit", () => { try { rmSync(serveUrl, { recursive: true, force: true }); } catch { /* already gone */ } });
  const inputProps = { plan, showProxy: true };
  const composition = await selectComposition({ serveUrl, id: "Preview", inputProps });
  for (const [n, s] of samples.entries()) {
    await renderStill({ composition, serveUrl, inputProps, frame: Math.round(s.t * plan.source.fps), scale: 1 / 3, imageFormat: "jpeg", jpegQuality: 85,
      output: `${dir}/${String(n + 1).padStart(3, "0")}_${s.id}.jpg`, chromiumOptions: { gl: "angle" }, logLevel: "error" });
  }
} else samples.forEach((s, n) => {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", s.t.toFixed(2), "-i", file, "-frames:v", "1", "-update", "1", "-vf", viewingTransform({ width: 640, height: 360 }), "-q:v", "4",
    `${dir}/${String(n + 1).padStart(3, "0")}_${s.id}.jpg`]);
});
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", `${dir}/[0-9]*_E*.jpg`, "-vf", "tile=5x4:padding=4:color=black", "-q:v", "4", `${dir}/sheet_%02d.jpg`]);
console.log(`${cuts.length} kesme, ${samples.length} örnek:`);
console.log(samples.map((s, n) => `${n + 1}:${s.id}@${s.t.toFixed(1)}`).join("  "));
