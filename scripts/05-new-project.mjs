// Starts a NEW video project in this workspace. The finished project is ARCHIVED (moved, never
// deleted) to projects/<old-slug>/ and a clean per-video area is scaffolded. Generic parts stay:
// src/, scripts/, library/, work/luts, work/color-pipeline.md.
//   node scripts/05-new-project.mjs --slug <yeni-video> [--video <dosya>] [--assets <klasör|dosya> …]
//        [--archive-as <eski-proje-adı>] [--keep-source] [--force] [--dry-run]
//   --video / --assets : copied in (APFS clone, instant). Omit them if the files are already in place.
//   --keep-source      : public/main.mov (and assets not used by the old project) already belong to the
//                        NEW video — leave them. Auto-detected when main.mov no longer matches the old probe.
//   --force            : archive even if the old project's work/progress.md is not marked TAMAMLANDI.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { p } from "./lib/paths.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const multi = (n) => { const i = args.indexOf(`--${n}`); if (i < 0) return []; const out = []; for (let k = i + 1; k < args.length && !args[k].startsWith("--"); k++) out.push(args[k]); return out; };
const dry = flag("dry-run");
const slug = val("slug");
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error("--slug <küçük-harf-ve-tire> gerekli (örn. --slug aso-araci-tanitim)");
const say = (s) => console.log(`${dry ? "[deneme] " : ""}${s}`);
const move = (from, to) => { say(`taşı  ${path.relative(p(), from)}  →  ${path.relative(p(), to)}`); if (!dry) { mkdirSync(path.dirname(to), { recursive: true }); renameSync(from, to); } };
const clone = (from, to) => { say(`kopyala  ${from}  →  ${path.relative(p(), to)}`); if (!dry) { mkdirSync(path.dirname(to), { recursive: true }); try { execFileSync("cp", ["-c", from, to]); } catch { cpSync(from, to); } } };

// ── 1. archive the current project ───────────────────────────────────────────────────────────
// A fresh clone has no work/project.json — the demo plan there is simply replaced, nothing is archived.
const hasOld = existsSync(p("work/project.json")) && (existsSync(p("work/edit-plan.json")) || existsSync(p("work/source-metadata.json")));
if (hasOld) {
  const progress = existsSync(p("work/progress.md")) ? readFileSync(p("work/progress.md"), "utf8") : "";
  if (!/TAMAMLANDI/.test(progress) && !flag("force")) throw new Error("Mevcut proje work/progress.md içinde TAMAMLANDI olarak işaretli değil. Bitmemiş işi arşivlemek için --force.");
  const meta = existsSync(p("work/source-metadata.json")) ? JSON.parse(readFileSync(p("work/source-metadata.json"), "utf8")) : null;
  const project = existsSync(p("work/project.json")) ? JSON.parse(readFileSync(p("work/project.json"), "utf8")) : null;
  const stamp = new Date((existsSync(p("work/edit-plan.json")) ? statSync(p("work/edit-plan.json")) : statSync(p("work"))).mtimeMs).toISOString().slice(0, 10);
  const oldSlug = val("archive-as") ?? project?.slug ?? `proje-${stamp}`;
  const dest = p("projects", oldSlug);
  if (existsSync(dest)) throw new Error(`Arşiv klasörü zaten var: projects/${oldSlug} (başka bir ad için --archive-as).`);
  if (oldSlug === slug) throw new Error("Yeni proje adı arşivlenen projeyle aynı olamaz.");

  // did the user already drop the NEW video over public/main.mov?
  const srcNow = existsSync(p("public/main.mov")) ? statSync(p("public/main.mov")) : null;
  const probed = meta?.source?.sizeBytes;
  // only meaningful when the probed source WAS main.mov (an assembled base.mov has another size by design)
  const sourceReplaced = srcNow && probed && meta?.source?.path === "public/main.mov" && srcNow.size !== probed;
  const keepSource = flag("keep-source") || sourceReplaced;
  if (sourceReplaced) say("not  public/main.mov eski projenin ölçümüyle uyuşmuyor → yeni video olarak yerinde bırakılıyor");

  for (const name of readdirSync(p("work"))) {
    if (name === "luts") continue; // generic LUTs stay
    if (name === "color-pipeline.md") { clone(p("work", name), path.join(dest, "work", name)); continue; } // generic doc: stays + archived copy
    move(p("work", name), path.join(dest, "work", name));
  }
  if (existsSync(p("out"))) for (const name of readdirSync(p("out"))) if (name !== ".DS_Store") move(p("out", name), path.join(dest, "out", name));
  for (const name of ["derived", "proxy"]) if (existsSync(p("public", name))) move(p("public", name), path.join(dest, "public", name));
  if (!keepSource && existsSync(p("public/main.mov"))) move(p("public/main.mov"), path.join(dest, "public/main.mov"));
  if (existsSync(p("public/assets"))) {
    // with --keep-source only the files the OLD project knew about are archived
    const manifestFile = path.join(dry ? p("work") : path.join(dest, "work"), "asset-manifest.json");
    const known = existsSync(manifestFile) ? new Set(JSON.parse(readFileSync(manifestFile, "utf8")).assets.map((a) => path.basename(a.path))) : null;
    for (const name of readdirSync(p("public/assets"))) {
      if (name === ".DS_Store") continue;
      if (keepSource && known && !known.has(name)) { say(`bırak  public/assets/${name} (yeni videonun varlığı)`); continue; }
      move(p("public/assets", name), path.join(dest, "public/assets", name));
    }
  }
  say(`arşivlendi → projects/${oldSlug}/  (hiçbir şey silinmedi; yer açmak için projects/${oldSlug}/work/segments elle silinebilir)`);
}

// ── 2. bring in the new material ─────────────────────────────────────────────────────────────
const video = val("video");
if (video) { if (!existsSync(video)) throw new Error(`Video yok: ${video}`); clone(path.resolve(video), p("public/main.mov")); }
for (const a of multi("assets")) {
  const abs = path.resolve(a);
  if (!existsSync(abs)) throw new Error(`Varlık yok: ${a}`);
  const files = statSync(abs).isDirectory() ? readdirSync(abs).filter((n) => n !== ".DS_Store").map((n) => path.join(abs, n)) : [abs];
  for (const f of files) if (statSync(f).isFile()) clone(f, p("public/assets", path.basename(f)));
}

// ── 3. scaffold ──────────────────────────────────────────────────────────────────────────────
if (!dry) {
  for (const d of ["work/audio", "work/logs", "work/transcript", "work/qc/reports", "out", "public/assets"]) mkdirSync(p(d), { recursive: true });
  writeFileSync(p("work/project.json"), JSON.stringify({ slug, createdAt: new Date().toISOString() }, null, 2) + "\n");
  writeFileSync(p("work/audio/selection.json"), readFileSync(p("library/audio/selection.default.json")));
  writeFileSync(p("work/progress.md"), `# İlerleme günlüğü — ${slug}\n\nAkış ve kurallar: \`.claude/skills/video-kurgula/SKILL.md\`. Her adım bitince işaretleyin; oturum kesilirse buradan devam edilir.\n\n` +
    ["0 Proje açıldı (`scripts/05-new-project.mjs`)", "1 `npm run probe` — kaynak özellikleri okundu, hat uygunluğu kontrol edildi", "2 `npm run luts` (yoksa) · `npm run proxy` · `npm run assets`", "3 `npm run transcribe` — ham döküm → `work/transcript/corrections.tr.json` → gözden geçirilmiş döküm + `out/final.tr.srt`",
      "4 Varlık envanteri `work/asset-manifest.json` (her varlığın kareleri incelenerek)", "5 Kurgu planı `work/edit-plan.json` → `npm run plan:check`", "6 Tasarım kareleri + `node scripts/66-cut-check.mjs --remotion` (gözle)", "7 Müzik: kullanıcının verdiği dosya `public/assets/` içinde bulundu (süre/LUFS ölçüldü)",
      "8 `npm run render:gfx` (nohup)", "9 `npm run composite` (nohup) → `npm run qc` → `out/final-hlg.temiz-ses.mov`", "10 `npm run audio` → `npm run qc:mix` → `out/final-hlg.mov` + `out/stems/`", "11 Görsel denetim (master kareleri) + `work/qc-report.md` + `out/README.tr.md`", "12 Teslim mesajı"]
      .map((s) => `- [ ] ${s}`).join("\n") + "\n\n## Kararlar ve notlar\n\n");
}
say(`\nYeni proje hazır: ${slug}\nSıradaki: npm run probe  (sonra .claude/skills/video-kurgula/SKILL.md akışı)`);
