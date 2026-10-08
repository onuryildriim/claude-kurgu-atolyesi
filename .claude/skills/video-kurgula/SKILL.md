---
name: video-kurgula
description: End-to-end edit of a talking-head YouTube video in this workspace, in the channel's OWN brand (marka/MARKA.md + src/theme/theme.ts) — stage layouts that reframe the presenter, word-synced boards, kinetic theses, on-screen graphics, bespoke code-written animation scenes, sound effects + the user's music, master render, QC and delivery docs. Use when the user gives a new video and says "bunu kurgula", "yeni videoyu kurgula", "kurgula", "videoyu düzenle", "yeni video geldi", "edit this video", or asks to continue/resume an edit ("devam"). Also use for revision requests on a delivered edit.
---

# video-kurgula — yeni videoyu kanalın kendi standardında kurgula ve teslim et

The user drops a finished talking-head export (already cut, e.g. from CapCut/Final Cut) at `public/main.mov`, puts
supporting assets (screenshots, screen recordings) **and the music track** into `public/assets/`, says
**"bunu kurgula"**, and expects a **finished delivery** — graphics, full-screen scenes, sound effects, music, QC, docs.

## Before anything: the brand

Read **`marka/MARKA.md`** first. It holds the channel's identity: who the channel is for, tone of voice, colours,
fonts, closing card, things the user never wants. If it still contains the `<!-- DOLDURULMADI -->` marker, **stop and
run the `marka-kimligi` skill first** (a short interview) — editing without a brand produces a generic video.
`src/theme/theme.ts` must match `MARKA.md`; the house rules the user taught you live in
`references/editorial-style.md` → "Ev kuralları".

Chat in the user's language (default Turkish). On-screen text is in the video's language (`MARKA.md`).

## Operating mode

- **Default: no approval gates.** Make the editorial decisions yourself using `references/editorial-style.md`,
  deliver, then take revision notes. Ask only on a true blocker (no video found, source the pipeline cannot handle,
  missing tool, brand not set up). If `MARKA.md` says the user wants a content check or plan approval first, do that.
- Music is supplied by the user (an audio file in `public/assets/`). Never generate music and never spend paid API
  credits (ElevenLabs etc.) unless the user explicitly asks — state the cost first. Details: `references/audio.md`.
- Long jobs: start detached (`nohup … &`), tell the user the ETA per step and a `! tail -f <log>` command, and keep
  working on whatever does not depend on the job. **Verify output FILES** (frame counts, ffprobe), never just exit codes.
- Keep `work/progress.md` current after every step — it is the resume point if the session dies. On "devam", read it
  first and continue from the first unchecked box.
- Never modify or delete: `public/main.mov`, originals in `public/assets/`, anything in `projects/`, and any file
  already delivered in `out/` (new versions get new names).
- You cannot hear audio or see HDR. Verify by measurement and stills, and say plainly which checks need the user's
  ears/eyes.

## Workflow

Commands, durations and known traps for every step: **`references/pipeline.md`** (read it before step 1).

0. **Open the project.** Find the new video (path in the message, a file dropped into `public/`, or
   `public/main.mov` already replaced). Pick a short kebab-case slug, then
   `node scripts/05-new-project.mjs --slug <slug> [--video <file>] [--assets <dir|files…>]` (`--dry-run` first).
   It archives the previous finished project to `projects/<old>/` (moves, never deletes) and scaffolds `work/`.
1. **Probe + fitness check**: `npm run probe`. Default master path: **3840×2160, HEVC 10-bit, Rec.2100 HLG**
   (iPhone HDR). SDR / 1080p / 30 fps sources go through the SDR branch — read "Different source formats" in
   `references/pipeline.md` first.
2. **Prepare**: `npm run luts` (only if `work/luts/*.cube` are missing) → `npm run proxy` → `npm run assets`.
3. **Transcribe**: optional `work/transcribe.vocab.txt` (names, brands, jargon) → `npm run transcribe`. Review the raw
   text; write `work/transcript/corrections.tr.json` with only high-confidence fixes, list unclear passages under
   `uncertain` — never invent speech. Deliverable: `out/final.tr.srt`.
4. **Asset inventory**: look at frames of every asset (contact sheets) and write `work/asset-manifest.json`
   (what it shows, where it fits, limitations, privacy notes).
5. **Edit plan**: read `references/visual-language.md` and `references/animation-scenes.md`, then split the
   transcript into chapters (→ chapter tags + the YouTube chapter list), choose the layout (L0–L5) of every passage,
   one persistent device per chapter, the 2–4 thesis lines, and the 1–3 passages that get an animation scene. Write
   `work/edit-plan.json` following `references/editorial-style.md` (schema: `src/plan/schema.ts`, format example:
   `library/examples/edit-plan.example.json`). `npm run plan:check`.
5b. **Build what the plan needs** (new event types / bespoke `src/scenes/*`):
   `npx tsc --noEmit && npx eslint src && npm run plan:check`.
6. **Look before rendering**: `node scripts/65-design-stills.mjs` (+ `--at <secs>`) and
   `node scripts/66-cut-check.mjs --remotion`. Read the sheets yourself: panel on the face after a cut → other side or
   end the event before the cut; text must never shift while on screen; nothing clipped.
7. **Music**: find the user's track in `public/assets/`, measure duration + loudness, note it in `work/progress.md`.
8. **Render graphics** (detached): `npm run render:gfx` → check every segment's frame count against the manifest.
9. **Master** (detached): `npm run composite` → `npm run qc` (all-pass; promotes to `out/final-hlg.temiz-ses.mov`)
   → read the QC contact sheets of every event (entrance / hold / exit).
10. **Sound**: `npm run audio` → `npm run qc:mix` (all-pass; promotes to `out/final-hlg.mov`, writes `out/stems/`).
    Make two or three `--preview a-b` clips of the busiest passages for the user.
11. **Docs**: `work/qc-report.md`, `out/README.tr.md`, final `work/progress.md` with the line `TAMAMLANDI`
    (`references/delivery.md`).
12. **Delivery message** (`references/delivery.md`): files, what was added, measurements, what needs their ears/eyes,
    which music file was used, how to ask for changes.

Typical wall time for a 7–8 min 4K video: ≈ 3–4 h, mostly rendering (first video: +2–3 h while missing components
are built). Say so up front.

## Vertical videos (Reels / Shorts)

- From a finished long video: `scripts/90-shorts.mjs` (see `references/pipeline.md`).
- A pre-cut vertical video (Reel) that only needs zooms, band graphics and SFX: build a vertical composition +
  script on request (1080×1920, graphics in the band above the head, one block at a time).
- Rules: `references/visual-language.md` §9 and the vertical part of `references/editorial-style.md`.

## Revisions on a delivered edit

- Text / timing / side / removing an event: edit `work/edit-plan.json` → `plan:check` → stills → only the affected
  segments re-render → composite → qc → audio → qc:mix.
- Sound only (louder music, another effect, `"sfx": false` on an event): `work/audio/selection.json` or the plan →
  `npm run audio && npm run qc:mix` (~5 min, the video stream is copied, not re-encoded).
- Keep the previous delivery: rename it before promoting a new one; save a copy of the plan (`work/edit-plan.revN.json`).

## Learning the user's taste (this is how the workshop becomes theirs)

- **Anything the user corrects twice is a house rule**: add it to `references/editorial-style.md` → "Ev kuralları",
  one line, with the date and the user's own words in quotes. Tell the user you added it.
- If the user says "bunu kural yap", "bunu hep böyle yap", "bir daha yapma" — add it immediately, once is enough.
- Brand-level changes (colour, font, closing card, tone) go to `marka/MARKA.md` **and** `src/theme/theme.ts`.
- A screenshot the user likes ("böyle olsun") goes to `marka/style-refs/` with a line in its README.
- Never copy another channel's look verbatim: learn the grammar from references, keep the user's brand.

## New event types

The kit has panels, lists, stats, steps/funnels, bars, search, versus, cards, phone, insert, screen, stage boards,
kinetic theses, chapter tags, social and subscribe cards (`src/events/*`). For a new one: add a zod object in
`src/plan/schema.ts` (timed parts carry `at`), a component (full-screen ones use the `Scene` shell in
`src/events/SceneEvents.tsx`), a `case` in `src/compositions/GraphicsLayer.tsx`, the new timed keys in `timesOf`
(`scripts/50-validate-plan.mjs`) and in the cue loops of `scripts/75-audio.mjs`. Rules: reserve space for everything
that appears later (nothing on screen may move), all motion is a pure function of the frame, opaque surfaces in HLG,
schematic diagrams carry a "Şematik gösterim" label, no invented numbers.
