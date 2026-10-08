// Schema of work/edit-plan.json. Times are SOURCE-TIMELINE SECONDS (absolute); rendering logic
// converts them to frames using the verified cadence. Imported by Remotion and by the Node scripts.
import { z } from "zod";

const t = z.number().min(0); // absolute seconds on the source timeline
const timedText = z.object({ at: t, text: z.string().min(1) });

const base = z.object({
  id: z.string().regex(/^E\d{2}[a-z]?$/),
  start: t,
  end: t,
  layer: z.number().int().min(0).default(1),
  side: z.enum(["left", "right", "full"]),
  position: z.string(), // human-readable placement / scale / crop note
  enter: z.string(),
  exit: z.string(),
  transcript: z.string().min(1), // supporting phrase from work/transcript.tr.*
  reason: z.string().min(1),
  uncertainty: z.string().optional(),
  asset: z.union([z.string(), z.array(z.string())]).optional(),
  sfx: z.boolean().optional(), // false = no sound effects for this event (scripts/75-audio.mjs)
  // v2: hand-placed designed cues (synthesised by scripts/lib/synth.mjs, names = work/audio/cues/<kind>.wav)
  cues: z.array(z.object({ at: z.number().min(0), kind: z.string().min(1), gainDb: z.number().default(0) })).optional(),
});

const headline = base.extend({
  type: z.literal("headline"),
  content: z.object({ lines: z.array(z.string()).min(1), strikeLine: z.number().int(), strikeAt: t, after: z.string() }),
});
const callout = base.extend({
  type: z.literal("callout"),
  content: z.object({ kicker: z.string(), headline: z.string(), sub: z.string().optional(), subAt: t.optional() }),
});
const list = base.extend({
  type: z.literal("list"),
  content: z.object({ kicker: z.string(), title: z.string(), items: z.array(timedText).min(1), marker: z.enum(["dot", "check", "minus"]).default("dot") }),
});
const cards = base.extend({
  type: z.literal("cards"),
  content: z.object({ kicker: z.string(), images: z.array(z.object({ at: t, src: z.string(), label: z.string() })).min(1), caption: timedText.optional() }),
});
const phone = base.extend({
  type: z.literal("phone"),
  content: z.object({
    kicker: z.string(),
    clips: z.array(z.object({ at: t, src: z.string(), trimStart: z.number().min(0).default(0), label: z.string() })).min(1),
    caption: timedText.optional(),
  }),
});
const insert = base.extend({
  type: z.literal("insert"),
  content: z.object({
    src: z.string(),
    trimStart: z.number().min(0),
    aspect: z.number().positive(),
    // visible region as fractions of the full asset frame (zoom for legibility; the explained element stays in view)
    crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().gt(0).max(1), h: z.number().gt(0).max(1) }).default({ x: 0, y: 0, w: 1, h: 1 }),
    title: z.string(),
    caption: z.string(),
    highlights: z.array(z.object({ at: t, x: z.number(), w: z.number(), label: z.string() })).default([]), // x/w as fractions of the frame
    chips: z.array(timedText).default([]),
  }),
});
const steps = base.extend({
  type: z.literal("steps"),
  content: z.object({
    kicker: z.string(),
    title: z.string(),
    variant: z.enum(["funnel", "flow"]),
    steps: z.array(z.object({ at: t, label: z.string(), value: z.string().optional(), weight: z.number().min(0).max(1).optional() })).min(2),
    notes: z.array(timedText).default([]),
    footnote: z.string(),
  }),
});
const bars = base.extend({
  type: z.literal("bars"),
  content: z.object({
    kicker: z.string(),
    title: z.string(),
    rows: z.array(z.object({ at: t, label: z.string(), value: z.number().positive(), display: z.string(), emphasis: z.boolean().default(false) })).min(2),
    footnote: z.string(),
  }),
});
const search = base.extend({
  type: z.literal("search"),
  content: z.object({
    kicker: z.string(),
    title: z.string(),
    queries: z.array(timedText).min(1),
    countAt: t,
    countText: z.string(),
    topAt: t,
    topText: z.string(),
    footnote: z.string(),
  }),
});
const versus = base.extend({
  type: z.literal("versus"),
  content: z.object({
    kicker: z.string(),
    left: z.object({ at: t, abbr: z.string(), label: z.string() }),
    right: z.object({ at: t, abbr: z.string(), label: z.string() }),
    question: timedText,
    footnote: z.string(),
  }),
});
const stat = base.extend({
  type: z.literal("stat"),
  content: z.object({
    kicker: z.string(),
    rows: z.array(z.object({ at: t, label: z.string(), value: z.string(), emphasis: z.boolean().default(false) })).min(1),
    footer: timedText.optional(),
    footnote: z.string().optional(),
  }),
});
const social = base.extend({
  type: z.literal("social"),
  content: z.object({ kicker: z.string(), handle: z.string().min(1), cta: timedText }),
});
// Full-screen scenes (side "full", opaque backdrop): the presenter is not visible while they run.
const sceneTool = base.extend({
  type: z.literal("scene-tool"),
  content: z.object({
    kicker: z.string(),
    title: z.string(),
    items: z.array(timedText).min(1),
    // speed is baked into the derived clips (scripts/30-normalize-assets.mjs); they play at 1× here
    clips: z.array(z.object({ at: t, src: z.string(), label: z.string() })).min(1),
    note: z.string(),
  }),
});


// ── screen recordings in a framed card, cold-open hook, kinetic words ──
const frac = z.number().min(0).max(1);
// Screen recording in a rounded white-framed card on a dark backdrop,
// optionally with the presenter in a framed box on the right (PIP, cut from the base by
// scripts/32-pip.mjs). The "camera" zooms into the recording; highlights/badges arrive as spoken.
const screen = base.extend({
  type: z.literal("screen"),
  content: z.object({
    kicker: z.string(),
    title: z.string(),
    // rate: playback speed of the recording (≠ 1 when the narration was re-timed, e.g. a dubbed translation)
    clips: z.array(z.object({ at: t, src: z.string(), trimStart: z.number().min(0).default(0), rate: z.number().positive().default(1) })).min(1),
    // visible area: zoom ≥ 1 on the fitted recording, (cx, cy) = point kept in view (fractions of the recording)
    camera: z.array(z.object({ at: t, zoom: z.number().min(1).max(4), cx: frac, cy: frac })).default([]),
    highlights: z.array(z.object({ at: t, until: t.optional(), x: frac, y: frac, w: frac, h: frac, label: z.string().optional() })).default([]),
    // badges sit in fixed slots (nothing moves); `until` frees a slot for a later badge
    badges: z.array(z.object({ at: t, until: t.optional(), slot: z.number().int().min(0).max(3).optional(), value: z.string(), label: z.string(), op: z.enum(["", "+", "="]).default(""), emphasis: z.boolean().default(false) })).default([]),
    titles: z.array(z.object({ at: t, kicker: z.string(), title: z.string() })).default([]), // later chapters of a long screen event
    prompts: z.array(z.object({ at: t, until: t, label: z.string(), text: z.string(), typeSeconds: z.number().positive().default(3) })).default([]), // typed-out prompt cards
    // crop of the base frame (fractions; h follows the box). at/until: the card makes room for the box and takes it back
    pip: z.object({ src: z.string(), x: frac, y: frac, w: frac, at: t.optional(), until: t.optional() }).optional(),
    note: z.string().optional(),
    instantBg: z.boolean().default(false), // directly after another full-screen event: no backdrop fade (no presenter flash)
    // v2: persistent file tree beside the card (the section's "device"); `active` moves the highlight as files are discussed
    tree: z.object({
      title: z.string(),
      items: z.array(z.object({ key: z.string(), label: z.string(), depth: z.number().int().min(0).max(4), at: t, folder: z.boolean().default(false) })).min(1),
      active: z.array(z.object({ at: t, key: z.string() })).default([]),
      until: t.optional(), // the tree slides out and the card takes the full width again
    }).optional(),
    // v2: time-skip card over the recording ("kayıt burada kesildi")
    skips: z.array(z.object({ at: t, until: t, kicker: z.string(), text: z.string() })).default([]),
  }),
});
// Cold open: full-screen rolling counter over the blurred source footage, then the backdrop wipes away and
// the claims stack up beside the presenter (strike = "not needed", check = "all digital").
const hook = base.extend({
  type: z.literal("hook"),
  content: z.object({
    kicker: z.string(),
    value: z.number().int().positive(),
    prefix: z.string().default(""), // e.g. "$"
    suffix: z.string(),
    locale: z.enum(["tr", "en"]).default("tr"), // thousands separator . / ,
    label: z.string(),
    countAt: t,
    revealAt: t,
    bg: z.object({ src: z.string(), trimStart: z.number().min(0) }),
    chips: z.array(z.string()).default([]),
    lines: z.array(z.object({ at: t, icon: z.enum(["box", "truck", "file"]), text: z.string(), tone: z.enum(["no", "yes"]) })).min(1),
  }),
});
// Big kinetic words beside the presenter (opaque "stickers"), one line at a time.
const punch = base.extend({
  type: z.literal("punch"),
  content: z.object({ lines: z.array(z.object({ at: t, text: z.string(), accent: z.boolean().default(false) })).min(1), locale: z.enum(["tr", "en"]).default("tr") }), // uppercase rules (İ vs I)
});
// Full-screen chapter card (short): number + title, wiped in and out.
const chapter = base.extend({
  type: z.literal("chapter"),
  content: z.object({ index: z.string(), title: z.string(), sub: z.string().optional(), cutOut: z.boolean().default(false) }), // cutOut: a full-screen event follows
});
// Two columns compared row by row (physical vs digital …) in a side panel.
const compare = base.extend({
  type: z.literal("compare"),
  content: z.object({
    kicker: z.string(),
    left: z.object({ title: z.string(), at: t, items: z.array(timedText) }),
    right: z.object({ title: z.string(), at: t, items: z.array(timedText) }),
    footer: timedText.optional(),
  }),
});

// ── v2 stage layouts ─────────────────────────────────────────────────────────────────
// Stage: the presenter is reframed into a card (L2) or a small box (L3) on the right; the left is a board.
// Entry/exit morph from/to the full frame, so the cut back to the camera is invisible.
const timed = z.object({ at: t, text: z.string().min(1) });
const board = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("questions"), items: z.array(timed).min(1) }),
  z.object({ kind: z.literal("list"), items: z.array(timed).min(1), marker: z.enum(["check", "dot", "num"]).default("check") }),
  z.object({ kind: z.literal("terminal"), lines: z.array(z.object({ at: t, text: z.string(), tone: z.enum(["cmd", "out", "accent", "muted"]).default("out"), typeSeconds: z.number().positive().optional() })).min(1),
    chips: z.array(z.object({ at: t, text: z.string(), on: z.boolean().default(false) })).default([]) }),
  z.object({ kind: z.literal("app"), clips: z.array(z.object({ at: t, src: z.string(), trimStart: z.number().min(0) })).min(1),
    crop: z.object({ x: frac, y: frac, w: frac, h: frac }), caption: z.string(), points: z.array(timed).default([]) }),

]);
const stage = base.extend({
  type: z.literal("stage"),
  content: z.object({
    presenter: z.object({ src: z.string(), cx: frac.default(0.5), cy: frac.default(0.45), zoom: z.number().min(1).max(2.5).default(1) }),
    // consecutive boards inside one stage (the presenter stays framed; card ↔ box resizes smoothly)
    scenes: z.array(z.object({
      at: t,
      size: z.enum(["card", "box"]).default("card"),
      kicker: z.string(),
      title: z.string(),
      board,
      source: z.string().optional(), // "↳ KAYNAK: …" log line
      figure: z.string().optional(), // "ŞEKİL 03"
    })).min(1),
  }),
});
// Kinetic thesis (L5): lines over a dark scrim on the camera; words can be accented, dimmed or struck later.
const kinetic = base.extend({
  type: z.literal("kinetic"),
  content: z.object({
    kicker: z.string().optional(),
    lines: z.array(z.object({ at: t, text: z.string(), accent: z.array(z.string()).default([]), dimAt: t.optional() })).min(1),
    align: z.enum(["center", "left"]).default("center"),
  }),
});
// Channel subscribe/like/bell lower-third with the presenter's avatar; a cursor presses the buttons.
const subscribe = base.extend({
  type: z.literal("subscribe"),
  content: z.object({ name: z.string(), sub: z.string(), avatar: z.string(), avatarFocus: z.object({ x: frac, y: frac, zoom: z.number().min(1).max(4) }).default({ x: 0.5, y: 0.4, zoom: 1.6 }),
    clickAt: t, bellAt: t, likeAt: t }),
});
// Log-layer chapter tag (top-left), persists through a section.
const tag = base.extend({
  type: z.literal("tag"),
  content: z.object({ index: z.string(), label: z.string(), total: z.string().optional() }),
});

export const eventSchema = z.discriminatedUnion("type", [headline, callout, list, cards, phone, insert, steps, bars, search, versus, stat, social, sceneTool, screen, hook, punch, chapter, compare, stage, kinetic, subscribe, tag]);
export const planSchema = z.object({
  version: z.literal(1),
  source: z.object({ path: z.string(), fps: z.number().positive(), frames: z.number().int().positive(), durationSeconds: z.number().positive() }),
  language: z.literal("tr"),
  notes: z.array(z.string()),
  unusedAssets: z.array(z.object({ asset: z.string(), reason: z.string() })),
  quietSections: z.array(z.object({ start: t, end: t, reason: z.string() })),
  events: z.array(eventSchema).min(1),
});

export type EditPlan = z.infer<typeof planSchema>;
export type PlanEvent = z.infer<typeof eventSchema>;
export type EventOf<T extends PlanEvent["type"]> = Extract<PlanEvent, { type: T }>;
