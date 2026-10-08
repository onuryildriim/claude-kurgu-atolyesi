# Animation scenes — bespoke motion graphics written as code

Claude can write complete animations as code: a history piece on a real map with a year counter, a product promo
built from screenshots, an isometric order→delivery flow, a HUD over a map — and synthesise their sound effects in
code too. It renders, **looks at the rendered frames itself**, reads the sound's level and spectrogram, and fixes what
it sees. We do this from the CLI, inside the Remotion pipeline, 1–3 times per video where the speech earns it.

## When a passage earns an animation scene

Use an L4 scene (presenter hidden, voice continues; or L3 with the presenter box) when the speech:

- tells a **process** (how a product is made, how a payment flows, how a tool works),
- tells **history or growth over time** (a year counter + map/timeline/chart that grows),
- describes **a product** (the user's own product: promo-style tour of real screenshots),
- explains **a mechanism** that a working miniature shows better than words (a model, a funnel that leaks, a queue),
- compares **scale** (a dot grid of people, a 1-million-token block vs 500 k).

1–3 per video, 8–25 s each, placed where the narration has no face-critical moment (no joke, no emotional line).
Not for things a board (L2) already handles in 5 s.

## Styles (all in brand tokens from `src/theme/theme.ts`; the user can ban or prefer styles in `marka/MARKA.md`)

| Style | Look | Good for |
|---|---|---|
| **Pano** (default) | dark board, thin lines, accent active state, mono labels, schematic nodes/arrows | mechanisms, pipelines, AI/tooling |
| **Ürün turu** | the user's app UI on a soft light surface (not pure white), device frames, a cursor/finger that clicks, feature callouts on the left, slow camera push/pan across real screenshots | the user's products (uses supplied screenshots/recordings only) |
| **Harita / zaman** | dark relief-free map from real geodata (`world-atlas`/`topojson-client`, Natural Earth), accent territory/route, big year or value counter top-left, timeline at the bottom | history, geography, growth, "from X to Y" |
| **İzometrik akış** | isometric flat blocks, 2–3 tones + accent, small figures/objects moving through stations | logistics, order/sale flows, "what happens after you tap Buy" |
| **Çizgi illüstrasyon** | flat 2D vector, thick uniform outline, flat fills, no gradients/shadows, warm off-white ground | friendly explainers, metaphors; use sparingly (it breaks a dark board, so give it its own chapter moment) |
| **HUD / simülasyon** | dark map or scene with live telemetry readouts (counters, gauges, progress) | "watch it happen" moments: sales coming in, downloads ticking, a build running |

Characters with lip-sync and dialogue scenes are out of scope unless the user asks (they need voice assets).

## How to build one (from the CLI)

1. **Beat sheet** in the plan: list the spoken phrases of the passage with word times and decide one visual beat
   per phrase (`at`). The scene's job is to show each beat as it is said. Write it under the event's `beats`.
2. **Data first.** Real numbers/dates/geometry only: spoken, from a supplied asset, or from a data package
   (`npm i -D world-atlas topojson-client d3-geo` for maps). Cite it in the scene's source line.
3. **Code** a component `src/scenes/<EventId>.tsx` (or a reusable `src/scenes/<Style>.tsx` driven by props): SVG +
   Remotion primitives, every value a pure function of `frame` (`interpolate`, `spring` with fixed config, seeded
   noise — never `Math.random()`), 1920×1080 design units, `Scene` shell from `src/events/SceneEvents.tsx`,
   tokens from `src/theme/theme.ts`. Camera moves = a transform on one root group (slow push 1.00→1.06, pans that
   follow the active element). Register it like any new event type (`SKILL.md` → "New event types").
4. **Look at it** before the full render: `node scripts/65-design-stills.mjs --at <t1,t2,…>` at every beat, read
   the stills at full size; fix overlaps, clipped labels, text that moves, empty frames between beats. Render a
   low-res preview of the scene alone (`npx remotion render … --scale 0.5 --frames a-b`) and check it frame-sheet
   style (`ffmpeg … tile`).
5. **Sound it** (see `audio.md` → "Sound design v2"): one designed cue per beat, synthesised in code, themed to
   the subject.
6. Repeatable styles become reusable components with props; note new ones in the catalogue in `editorial-style.md`.

## Quality bar (what made the references convincing)

- Text is crisp and correct Turkish (ç ğ ı İ ö ş ü, `toLocaleUpperCase("tr-TR")`); real place names and dates.
- A clear focal point per beat (accent colour), everything else recedes.
- Continuous motion: the scene never freezes and never cuts to black between beats; the camera breathes.
- A beginning (title/establishing shot), a build (beats) and an ending (closing line or the final state held 1 s).
- It looks deliberately designed in the channel's brand, not like a stock template.
