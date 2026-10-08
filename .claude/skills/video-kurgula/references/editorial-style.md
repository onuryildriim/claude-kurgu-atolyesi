# Editorial style — how to write `work/edit-plan.json`

Schema of record: `src/plan/schema.ts`. Format example: `library/examples/edit-plan.example.json`.
Brand (colours, fonts, tone, closing card): `marka/MARKA.md` + `src/theme/theme.ts`.
Visual grammar (layouts, motion, density): `visual-language.md`. Animation scenes: `animation-scenes.md`.

This file has two parts: **craft principles** that make any talking-head edit good, and **Ev kuralları** — the
user's own taste, learned from their corrections. The second part starts empty and grows with every video.
When the two conflict, **Ev kuralları win**.

## Craft principles

1. **The graphics layer serves the speech.** Every event quotes the supporting `transcript` phrase and states a
   `reason`. Times are absolute source seconds from the reviewed transcript (±0.3 s); items appear when the words are
   spoken (`at`), never earlier.
2. **Nothing invented.** Numbers only if spoken or visible in a supplied asset. Diagrams that illustrate a principle
   carry "Şematik gösterim"; examples carry "Videodaki örnek rakamlar". Unclear product names are not written (note
   it under `uncertainty`).
3. **Timeline is sacred.** Same frame count, duration, cadence; narration level and timing untouched unless asked.
4. **Text on screen never moves.** Panels grow downward as items arrive, space is reserved for late elements.
   Reading speed ≤ 17 chars/s (the validator warns), min event 2.5 s, each `at` ≥ 0.8 s before the event ends.
5. **Placement follows the presenter.** Sample the frame before choosing a side; if a cut inside the event moves the
   face under the panel, end the event before the cut or switch sides. Very tight close-ups → leave a quiet section
   (`quietSections` with the reason). Bottom third stays free (hand gestures).
6. **Let it breathe.** Personal asides, jokes and short self-explanatory remarks stay without graphics.
7. **Hook first.** The first ~6–8 s carry the video's promise as a strong visual (a question, a struck claim, a
   number that counts). No bullet list straight after the hook — the next graphic is the main thesis.
8. **Assertive wording.** Drop hedges in headlines; sub-lines in natural spoken language.
9. **Captions never promise what is not shown.**
10. **Key concept ⇒ full-screen scene.** When the speaker defines the core idea of the video, hide the presenter for
    that passage (8–12 s) with a scene that builds up in sync. One or two per video.
11. **Closing card** in the last ~5 s, as defined in `marka/MARKA.md`.
12. **Privacy:** list every asset that shows personal/financial data under privacy notes in the manifest, QC report
    and delivery message.

## Ev kuralları (the user's taste — grows with every revision)

<!-- Claude: the user corrected something twice, or said "bunu kural yap" → add ONE line here:
     - YYYY-MM-DD · <the rule, imperative> — "<the user's own words>"
     Keep the list short and concrete. Remove a rule only when the user reverses it. -->

_(henüz kural yok — ilk videonun revizyonlarından sonra dolmaya başlar)_

## Event catalogue (type → use)

| Type | Use | Notes |
|---|---|---|
| `headline` | the hook; a claim that gets struck through | `lines`, `strikeLine`, `strikeAt`, `after` |
| `callout` | one thesis sentence, optional sub-line at `subAt` | the workhorse; 5–10 s |
| `list` | 3–5 spoken points, `marker` dot / check / minus | items arrive at their `at` |
| `stat` | one to three big numbers with labels | spoken numbers only; `emphasis` on the key one |
| `steps` | `funnel` (shrinking stages) or `flow` (process) | schematic label in `footnote` |
| `bars` | compare magnitudes that are spoken | "Videodaki varsayımsal örnek" when hypothetical |
| `search` | search-query illustration (queries typed, result count, top result) | |
| `versus` | two terms side by side + question | small-panel alternative to a concept scene |
| `cards` | fanned screenshots (PNG) with labels + caption | ≤ 3 cards |
| `phone` | phone frame playing derived clips | clips switch at `at` |
| `insert` | full-screen dashboard/recording with crop, highlights, chips | `layer: 2`, `side: "full"` |
| `scene-tool` | full-screen product demo: feature list + big phone | clips from `work/assets.config.json` with `trim`/`fit` |
| `screen` | screen recording in a framed card + presenter box (`pip`, cut by `scripts/32-pip.mjs`); `camera` zooms, `highlights`, `badges`, `titles`, `prompts` arrive as spoken | `side: "full"`; one long event per section |
| `stage` | presenter morphs into a card/box (L2/L3) while boards build beside it (`scenes`; boards: `questions`, `list`, `terminal`, `app`) | workhorse for dense sections; new board kinds are added per video |
| `hook` | cold open: full-screen rolling figure, wiped away on the first cut | first ~6 s |
| `punch` | kinetic "sticker" words (TR uppercase via `toLocaleUpperCase("tr-TR")`) | 2–5 words per line |
| `kinetic` | L5 thesis lines, word reveal, accent words, `dimAt` | 2–4 per video |
| `chapter` | full-screen chapter card | ~2.7 s |
| `tag` | small chapter tag in the corner (= YouTube chapter list) | persists through the section |
| `compare` | two columns (✗ vs ✓) in a side panel | |
| `subscribe` | subscribe / bell / like card with the user's avatar, a cursor presses the buttons | avatar from `MARKA.md` |
| `social` | closing card (handle + CTA) | always last |

Common fields: `id` (`E01`, `E14a`…), `start`, `end`, `layer` (1 panels, 2 full-screen), `side`, `position`, `enter`,
`exit` (human-readable notes), `transcript`, `reason`, optional `uncertainty`, `asset`, `"sfx": false`, `cues`.
Same-side or full-screen overlaps are errors; keep ≥ 0.25 s between consecutive events.

## Density guide (7–8 min talking head)

Default, tune it via `MARKA.md` ("sade" vs "yoğun"): ≈ 30–45 timed events · 70–85 % of runtime covered · 2–4 quiet
L0 sections · something changes every 2–4 s inside board sections · one persistent device per chapter · 2–4 L5
theses · 1–3 L4 animation scenes · chapter tag on every chapter, source line on every external fact.
A calm channel ("sade"): ~20–25 events per 10 min, one message at a time.
If the source does not allow reframing (1080p or a tight shot): ~25 events, 60–70 %, mostly side panels.

## Vertical (Reels / Shorts)

- Build it natively vertical: speaker re-cropped 9:16, recordings re-framed; never a letterboxed 16:9 over a blur.
- One message on screen at a time; each text exits before the next enters.
- No burned-in captions if the platform adds them; keep graphics out of the bottom UI band and the right button column.
- The real shot (speaker + room) stays the main picture; graphics live in the band above the head.
- Pacing: something changes every 1–2 s (punch-in, card item, chip); hook in the first 1–1.5 s.

## Checklist before rendering

`npm run plan:check` clean (warnings read) · design stills of every new/complex event read at full size · cut-check
sheets read · spelling (Turkish: ç ğ ı İ ö ş ü, "yapay zekâ") · no event ends after a cut it should precede · closing
card present · `unusedAssets` lists every supplied asset that was not used, with the reason.
