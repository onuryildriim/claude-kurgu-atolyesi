# Claude Kurgu Atölyesi — konuşan-kafa YouTube videoları için kodla kurgu

This repo is a **reusable editing workshop**: a Remotion graphics layer + FFmpeg/x265 compositing + sound design,
driven by one data file per video (`work/edit-plan.json`). It becomes the user's own through two files:
`marka/MARKA.md` (brand identity) and the "Ev kuralları" in `.claude/skills/video-kurgula/references/editorial-style.md`
(rules learned from the user's corrections).

## First run

If `marka/MARKA.md` still starts with the `DOLDURULMADI` marker, or `node_modules` is missing, or the user says
"kurulum", "markamı kur", "başlayalım": **invoke the `marka-kimligi` skill first** (machine check + brand interview).

## When the user hands over a video ("bunu kurgula", "yeni video", "kurgula", "devam", revision notes)

**Invoke the `video-kurgula` skill** (`.claude/skills/video-kurgula/`). It holds the workflow, the editorial rules
and the delivery format. Default: finished delivery without approval gates (decide, build, verify, deliver, then
revise), unless `marka/MARKA.md` → "Çalışma tercihleri" says otherwise.

- Chat in the user's language (default **Turkish**). On-screen text in the language set in `MARKA.md`.
- Input layout (same every time): main video at `public/main.mov`, supporting assets **and the music track** in
  `public/assets/`. Never generate music unless asked.
- Resume point of the current video: `work/progress.md`. Finished videos are archived under `projects/<slug>/`.
- Long jobs run detached with logs in `work/logs/`; always give the ETA and a `! tail -f …` command.
- Never modify/delete: `public/main.mov`, originals in `public/assets/`, anything in `projects/`, delivered files in `out/`.
- You cannot hear audio or see HDR: measure, inspect stills, and say what needs the user's ears/eyes.
- Learning loop: a correction given twice (or "bunu kural yap") → one line in "Ev kuralları". Brand changes →
  `MARKA.md` + `src/theme/theme.ts`.

## Layout

| Path | Role |
|---|---|
| `marka/` | The channel's identity: `MARKA.md`, `style-refs/` (screenshots the user likes). |
| `src/` | Remotion code: `plan/schema.ts` (plan schema), `events/*` (components), `theme/theme.ts` (design tokens). Any change re-renders all segments. |
| `scripts/` | Numbered pipeline (`05` new project → `00` probe → `10` proxy → `20/21` transcript → `30` assets → `40` LUTs → `50` validate → `60` render → `65/66` stills → `70` composite → `75` audio → `80` QC; `90` shorts). |
| `library/` | Reusable across videos: sound selection (effects are synthesised by `scripts/lib/synth.mjs`), optional own SFX, whisper vocabulary, plan example. |
| `work/`, `out/`, `public/{main.mov,assets,derived,proxy}` | The CURRENT video only (`work/project.json` has its slug). |
| `projects/` | Archived finished videos (git-ignored). |

Checks after code changes: `npx tsc --noEmit && npx eslint src && npm run plan:check`.
