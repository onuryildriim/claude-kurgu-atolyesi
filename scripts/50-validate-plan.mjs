// Validates work/edit-plan.json: schema, bounds, ordering, reading time, timed items inside their
// event, asset existence, same-side overlaps. Exits non-zero on any error.
import { existsSync } from "node:fs";
import { p, sourceTiming } from "./lib/paths.mjs";
import { loadPlan, segmentsOf } from "./lib/plan.mjs";

const plan = loadPlan(); // throws with a readable zod error if the shape is wrong
const timing = sourceTiming();
const errors = [], warnings = [];
const MIN_DURATION = 2.5; // seconds a viewer needs to register even a short card
const READ_CPS = 17; // generous reading speed (characters / second) for Turkish on-screen text

if (plan.source.frames !== timing.frames || plan.source.fps !== timing.fps) errors.push(`Plan kaynağı (${plan.source.frames} kare @ ${plan.source.fps}) ölçülen kaynakla (${timing.frames} @ ${timing.fps}) uyuşmuyor.`);

const ids = new Set();
const timesOf = (e) => {
  const c = e.content, out = [];
  for (const k of ["items", "images", "clips", "steps", "notes", "rows", "chips", "queries", "highlights", "badges", "lines", "camera", "skips", "scenes"]) for (const x of c[k] ?? []) out.push(x.at);
  for (const k of ["clickAt", "bellAt", "likeAt"]) if (c[k] !== undefined) out.push(c[k]);
  for (const x of c.tree?.items ?? []) out.push(x.at);
  for (const x of c.tree?.active ?? []) out.push(x.at);
  for (const sc of c.scenes ?? []) { const b = sc.board; for (const k of ["items", "lines", "chips", "points", "clips"]) for (const x of b[k] ?? []) out.push(x.at);
    for (const [k, v] of Object.entries(b)) if (k.endsWith("At") && typeof v === "number") out.push(v); }
  for (const k of ["caption", "footer", "question", "left", "right", "cta"]) if (c[k]?.at !== undefined) out.push(c[k].at);
  for (const k of ["strikeAt", "subAt", "countAt", "topAt", "revealAt"]) if (c[k] !== undefined) out.push(c[k]);
  for (const side of ["left", "right"]) for (const x of c[side]?.items ?? []) out.push(x.at);
  for (const k of ["titles", "badges", "highlights", "prompts"]) for (const x of c[k] ?? []) { if (k === "titles" || k === "prompts") out.push(x.at); if (x.until !== undefined) out.push(x.until); }
  if (c.pip?.at !== undefined) out.push(c.pip.at);
  return out;
};
const textOf = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.map(textOf).join(" ") : v && typeof v === "object" ? Object.entries(v).filter(([k]) => !["src", "footnote"].includes(k)).map(([, x]) => textOf(x)).join(" ") : "");

for (const e of plan.events) {
  if (ids.has(e.id)) errors.push(`${e.id}: kimlik yineleniyor`);
  ids.add(e.id);
  if (e.end <= e.start) errors.push(`${e.id}: bitiş ≤ başlangıç`);
  if (e.end > plan.source.durationSeconds) errors.push(`${e.id}: kaynak süresini aşıyor`);
  if (e.end - e.start < MIN_DURATION) errors.push(`${e.id}: ${MIN_DURATION} sn'den kısa`);
  for (const at of timesOf(e)) if (at < e.start || at > e.end - 0.8) errors.push(`${e.id}: iç zaman ${at} olay aralığının dışında ya da sona çok yakın`);
  const chars = textOf(e.content).replace(/\s+/g, " ").length;
  if (!["insert", "screen", "hook", "stage", "tag", "subscribe"].includes(e.type) && chars / (e.end - e.start) > READ_CPS) warnings.push(`${e.id}: metin yoğun (${chars} karakter / ${(e.end - e.start).toFixed(1)} sn)`);
  const srcs = [e.content.src, e.content.bg?.src, e.content.avatar, ...(e.content.images ?? []).map((i) => i.src), ...(e.content.clips ?? []).map((c) => c.src), ...(e.content.scenes ?? []).flatMap((sc) => (sc.board.clips ?? []).map((c) => c.src))].filter(Boolean);
  if (e.type === "stage" && !existsSync(p("public", e.content.presenter.src))) warnings.push(`${e.id}: sahne klibi henüz yok → node scripts/32-pip.mjs`);
  if (e.content.pip && !existsSync(p("public", e.content.pip.src))) warnings.push(`${e.id}: PIP klibi henüz yok → node scripts/32-pip.mjs`);
  for (const s of srcs) if (!existsSync(p("public", s))) errors.push(`${e.id}: varlık yok → public/${s}`);
  for (const a of [e.asset ?? []].flat()) if (!existsSync(p(a))) errors.push(`${e.id}: kaynak varlık yok → ${a}`);
}
const sorted = [...plan.events].sort((a, b) => a.start - b.start);
for (let i = 1; i < sorted.length; i++) {
  const a = sorted[i - 1], b = sorted[i];
  // layer ≥ 3 = overlays drawn above everything (chapter tag, subscribe card): they may sit over a full-screen event
  const overlay = (a.layer >= 3) !== (b.layer >= 3);
  if (!overlay && b.start < a.end && (a.side === b.side || a.side === "full" || b.side === "full")) errors.push(`${a.id} ↔ ${b.id}: aynı alanda çakışma`);
  else if (b.start - a.end < 0.25 && b.start >= a.end) warnings.push(`${a.id} → ${b.id}: aradaki boşluk ${(b.start - a.end).toFixed(2)} sn`);
}
for (const u of plan.unusedAssets) if (!existsSync(p(u.asset))) errors.push(`unusedAssets: yok → ${u.asset}`);

const segs = segmentsOf(plan);
const gfxFrames = segs.reduce((n, s) => n + s.frames, 0);
console.log(`${plan.events.length} olay, ${segs.length} segment, ${gfxFrames} grafik karesi (${((gfxFrames / plan.source.frames) * 100).toFixed(1)} % süre)`);
for (const w of warnings) console.log(`uyarı  ${w}`);
for (const er of errors) console.error(`HATA   ${er}`);
if (errors.length) process.exit(1);
console.log("Plan geçerli.");
