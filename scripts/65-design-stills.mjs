// Design review: renders one still per event (readable hold state, just before the exit) from
// the Preview composition (graphics over the SDR proxy) and tiles them into contact sheets.
// Layout/content check only — NOT a colour reference for the HLG master.
//   node scripts/65-design-stills.mjs [--only E09,E17]
//   node scripts/65-design-stills.mjs --at 346.2,350.1   → full-size stills at given source seconds (work/qc/design/at_*.jpg)
//   add --no-proxy to render the graphics alone (transparent areas black) before the proxy exists
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { p } from "./lib/paths.mjs";
import { loadPlan } from "./lib/plan.mjs";

const i = process.argv.indexOf("--only");
const only = i > 0 ? process.argv[i + 1].split(",") : null;
const plan = loadPlan();
const dir = p("work/qc/design");
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (/^(hold_|sheet_)/.test(f)) rmSync(`${dir}/${f}`);

const serveUrl = await bundle({ entryPoint: p("src/index.ts"), webpackOverride: enableTailwind, publicDir: p("public") });
// bundle() leaves a full copy of public/ in the temp dir; remove it when this script ends
process.on("exit", () => { try { rmSync(serveUrl, { recursive: true, force: true }); } catch { /* already gone */ } });
const inputProps = { plan, showProxy: !process.argv.includes("--no-proxy") }; // --no-proxy: graphics only (before the proxy exists)
const composition = await selectComposition({ serveUrl, id: "Preview", inputProps });
const j = process.argv.indexOf("--at");
if (j > 0) {
  for (const sec of process.argv[j + 1].split(",").map(Number)) {
    const output = `${dir}/at_${sec.toFixed(2)}.jpg`;
    await renderStill({ composition, serveUrl, inputProps, frame: Math.round(sec * plan.source.fps), scale: 1, imageFormat: "jpeg", jpegQuality: 90, output, chromiumOptions: { gl: "angle" }, logLevel: "error" });
    console.log(output);
  }
  process.exit(0);
}
const events = plan.events.filter((e) => !only || only.includes(e.id));
let n = 0;
for (const e of events) {
  const frame = Math.round((e.end - 0.6) * plan.source.fps);
  await renderStill({ composition, serveUrl, inputProps, frame, scale: 0.5, imageFormat: "jpeg", jpegQuality: 88, output: `${dir}/hold_${String(++n).padStart(2, "0")}_${e.id}.jpg`, chromiumOptions: { gl: "angle" }, logLevel: "error" });
  console.log(`${e.id}  kare ${frame}`);
}
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", `${dir}/hold_*.jpg`, "-vf", "tile=2x2:padding=6:color=black", "-q:v", "3", `${dir}/sheet_%02d.jpg`]);
console.log(`Kontak sayfaları: ${dir}/sheet_*.jpg`);
