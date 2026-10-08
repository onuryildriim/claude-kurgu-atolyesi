// Renders the transparent graphics layer ONLY for the active event ranges, as ProRes 4444 with
// straight alpha (3840×2160 via scale:2). Segments are content-hashed: unchanged segments are
// skipped, so interrupted or repeated runs only render what is missing or edited.
//   node scripts/60-render-segments.mjs [--only seg03,seg07] [--concurrency 5] [--force]
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { p, SEGMENTS_DIR } from "./lib/paths.mjs";
import { loadPlan, segmentsOf } from "./lib/plan.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const only = arg("only")?.split(",");
const concurrency = Number(arg("concurrency", "5"));
const force = process.argv.includes("--force");

const plan = loadPlan();
const segments = segmentsOf(plan);
mkdirSync(SEGMENTS_DIR, { recursive: true });

// Anything that can change pixels goes into the hash: rendering code, the events of the segment,
// and the assets they reference (size + mtime).
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const codeHash = createHash("sha1");
// source files only: Finder writes src/.DS_Store when the user browses the folder, which once invalidated every cached segment
for (const f of walk(p("src")).sort()) if (/\.(tsx?|css|json)$/.test(f) && !f.endsWith("edit-plan.json")) codeHash.update(f).update(readFileSync(f));
const codeDigest = codeHash.digest("hex");
const hashOf = (seg) => {
  const h = createHash("sha1").update(codeDigest).update(`${seg.start}-${seg.end}`).update(JSON.stringify(plan.source));
  for (const e of plan.events.filter((ev) => seg.ids.includes(ev.id))) {
    h.update(JSON.stringify(e));
    const srcs = [e.content.src, e.content.bg?.src, e.content.pip?.src, ...(e.content.images ?? []).map((i) => i.src), ...(e.content.clips ?? []).map((c) => c.src)].filter(Boolean);
    for (const s of srcs) { const st = statSync(p("public", s)); h.update(`${s}:${st.size}:${st.mtimeMs}`); }
  }
  return h.digest("hex").slice(0, 10);
};

const jobs = segments.map((s) => ({ ...s, hash: hashOf(s) })).map((s) => ({ ...s, file: path.join(SEGMENTS_DIR, `${s.name}-${s.hash}.mov`) }));
// --adopt-from <old manifest> --adopt-only seg02,seg04: rename the old render with the SAME frame range to the new name/hash
// (use only for segments whose pixels are known to be unchanged, e.g. an overlay moved to its own segment)
{
  const from = process.argv.indexOf("--adopt-from"), onlyA = process.argv.indexOf("--adopt-only");
  if (from > 0 && onlyA > 0) {
    const old = JSON.parse(readFileSync(p(process.argv[from + 1]), "utf8")).segments;
    for (const j of jobs.filter((x) => process.argv[onlyA + 1].split(",").includes(x.name))) {
      const o = old.find((x) => x.start === j.start && x.end === j.end);
      if (!o || !existsSync(p(o.file)) || existsSync(j.file)) { console.log(`benimsenmedi  ${j.name} (eşleşme yok ya da zaten var)`); continue; }
      renameSync(p(o.file), j.file); console.log(`benimsendi  ${o.name} [${o.ids.join(",")}] → ${path.basename(j.file)} [${j.ids.join(",")}]`);
    }
  }
}
// --adopt: the pixels are known to be unchanged (only the hash recipe changed) → rename each slot's single existing render to its new hash
if (process.argv.includes("--adopt")) for (const j of jobs) {
  if (existsSync(j.file)) continue;
  const old = readdirSync(SEGMENTS_DIR).filter((f) => f.startsWith(`${j.name}-`) && f.endsWith(".mov") && !f.includes("partial"));
  if (old.length === 1) { renameSync(path.join(SEGMENTS_DIR, old[0]), j.file); console.log(`benimsendi  ${old[0]} → ${path.basename(j.file)}`); }
}
const todo = jobs.filter((j) => (!only || only.includes(j.name)) && (force || !existsSync(j.file)));
const cached = jobs.filter((j) => existsSync(j.file)).length;
console.log(`${jobs.length} segment: ${todo.length} render edilecek, ${cached} önbellekte hazır${only ? `, --only ile sınırlı (${only.join(",")})` : ""}.`);

if (todo.length) {
  const serveUrl = await bundle({ entryPoint: p("src/index.ts"), webpackOverride: enableTailwind, publicDir: p("public") });
// bundle() leaves a full copy of public/ in the temp dir; remove it when this script ends
process.on("exit", () => { try { rmSync(serveUrl, { recursive: true, force: true }); } catch { /* already gone */ } });
  const inputProps = { plan, showProxy: false }; // the SDR proxy must never reach a graphics render
  const composition = await selectComposition({ serveUrl, id: "Graphics", inputProps });
  for (const j of todo) {
    const t0 = Date.now();
    const tmp = j.file.replace(/\.mov$/, ".partial.mov");
    await renderMedia({
      composition, serveUrl, inputProps, outputLocation: tmp,
      codec: "prores", proResProfile: "4444", imageFormat: "png", pixelFormat: "yuva444p10le",
      colorSpace: "bt709", // tags + converts with the BT.709 matrix; the composite undoes exactly this
      scale: 2, frameRange: [j.start, j.end - 1], muted: true, enforceAudioTrack: false,
      concurrency, chromiumOptions: { gl: "angle" }, overwrite: true, logLevel: "error",
    });
    renameSync(tmp, j.file);
    // drop stale renders of the same segment slot
    for (const f of readdirSync(SEGMENTS_DIR)) if (f.startsWith(`${j.name}-`) && f.endsWith(".mov") && path.join(SEGMENTS_DIR, f) !== j.file) rmSync(path.join(SEGMENTS_DIR, f));
    const secs = (Date.now() - t0) / 1000;
    console.log(`${j.name}  kare ${j.start}–${j.end - 1} (${j.frames})  ${j.ids.join(",")}  ${secs.toFixed(0)} sn  ${(j.frames / secs).toFixed(1)} kare/sn  ${(statSync(j.file).size / 1e6).toFixed(0)} MB`);
  }
}

const missing = jobs.filter((j) => !existsSync(j.file));
writeFileSync(path.join(SEGMENTS_DIR, "manifest.json"), JSON.stringify({ fps: plan.source.fps, frames: plan.source.frames, complete: missing.length === 0,
  segments: jobs.map(({ name, start, end, frames, ids, hash, file }) => ({ name, start, end, frames, ids, hash, file: path.relative(p(), file), rendered: existsSync(file) })) }, null, 2));
console.log(missing.length ? `Eksik segmentler: ${missing.map((m) => m.name).join(", ")}` : "Tüm segmentler hazır → work/segments/manifest.json");
