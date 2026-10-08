// Loads + validates work/edit-plan.json with the same zod schema Remotion uses (Node strips the
// TypeScript types natively), and derives the graphics render segments from the event ranges.
import { readFileSync } from "node:fs";
import { PLAN } from "./paths.mjs";
import { planSchema } from "../../src/plan/schema.ts";

export const PAD_FRAMES = 2; // transparent padding rendered on both sides of each segment

export const loadPlan = () => planSchema.parse(JSON.parse(readFileSync(PLAN, "utf8")));

/** Merges overlapping/adjacent event ranges into render segments (absolute source frames, end exclusive). */
// plan.ownSegments (read from the raw JSON: zod strips unknown keys): event ids rendered as their OWN segment and laid
// over whatever segment they overlap (the composite overlays in start order). Lets a small overlay change (e.g. the
// subscribe card inside a 6-minute screen segment) be re-rendered without re-rendering the long segment.
const ownIds = () => { try { return JSON.parse(readFileSync(PLAN, "utf8")).ownSegments ?? []; } catch { return []; } };
export const segmentsOf = (plan) => {
  const { fps, frames } = plan.source;
  const own = new Set(ownIds());
  const ranges = plan.events.filter((e) => !own.has(e.id))
    .map((e) => ({ start: Math.max(0, Math.floor(e.start * fps) - PAD_FRAMES), end: Math.min(frames, Math.ceil(e.end * fps) + PAD_FRAMES), ids: [e.id] }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r.start <= last.end) { last.end = Math.max(last.end, r.end); last.ids.push(...r.ids); }
    else merged.push({ ...r });
  }
  for (const e of plan.events.filter((ev) => own.has(ev.id))) merged.push({ start: Math.max(0, Math.floor(e.start * fps) - PAD_FRAMES), end: Math.min(frames, Math.ceil(e.end * fps) + PAD_FRAMES), ids: [e.id] });
  merged.sort((a, b) => a.start - b.start);
  return merged.map((s, i) => ({ index: i + 1, name: `seg${String(i + 1).padStart(2, "0")}`, ...s, frames: s.end - s.start }));
};
