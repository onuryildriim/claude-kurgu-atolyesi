---
name: marka-kimligi
description: Sets up or changes the channel's own editing identity in this workspace — interviews the user, studies their reference stills, then writes marka/MARKA.md, src/theme/theme.ts (colours, fonts, motion), the sound selection and a sample still so every edit looks like THEIR channel, not a template. Use when the user says "markamı kur", "marka kimliği", "kendi stilimi oluştur", "stilimi değiştir", "renklerimi/fontumu değiştir", "kurulum yap", on the first run when marka/MARKA.md still has the DOLDURULMADI marker, or before the first "bunu kurgula".
---

# marka-kimligi — kanalın kendi kurgu kimliğini kur

Goal: after this skill, `video-kurgula` produces edits that look and sound like the user's channel. Output files:
`marka/MARKA.md` (filled, marker removed), `src/theme/theme.ts` (tokens), `library/audio/selection.default.json`
(levels/effects), `references/visual-language.md` §1–2 if the brand idea changes the label layer, and a sample still.
Chat in the user's language (default Turkish). Keep it fast: ≈ 10 minutes for the user.

## 0. Check the machine (once)

Run and report in one short table what is missing — install what you can yourself (npm packages, the whisper
model download), and give the user the exact command for anything that needs them (Homebrew, logins, API keys):

```bash
node -v; ffmpeg -version | head -1; whisper-cli --help >/dev/null 2>&1 && echo whisper ok
ls ~/Models/whisper/ggml-large-v3-turbo.bin
```
- Node ≥ 20, FFmpeg (`brew install node ffmpeg`), whisper.cpp (`brew install whisper-cpp`).
- Whisper model (≈1.6 GB): `mkdir -p ~/Models/whisper && curl -L -o ~/Models/whisper/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin`
- `npm install` in the repo if `node_modules` is missing.

## 1. Interview (one message, max ~12 questions, numbered, multiple-choice where possible)

Ask what `marka/MARKA.md` needs: channel + audience, the brand idea in one sentence, colours they own (logo,
thumbnail colours — or "sen öner"), fonts (or "sen öner"), tempo (sade / dengeli / yoğun), sound (hiç / hafif /
belirgin), hook and closing card, subscribe card + avatar photo, approval preference, format (4K HDR iPhone / 1080p),
2–5 channels whose editing they like and what exactly they like, things they never want.
Tell them they can answer briefly and attach screenshots/links. Do not ask what you can infer from their files.

## 2. Study the references

- Screenshots in `marka/style-refs/` (or pasted): read them at full size. Write per still one line in its README:
  layout, type hierarchy, accent usage, density, motion hints. Extract the **grammar**, never the other channel's
  palette/logo/labels.
- Their logo / thumbnails / website if given: sample the real colours (ffmpeg/`magick` pixel reads), do not guess.
- A YouTube link alone cannot be watched: ask for 3–6 screenshots instead.

## 3. Decide and write

- **Colours:** one accent with enough contrast on the board (WCAG ≥ 4.5:1 for text in accent, check it); board/ink,
  raised, line, text, muted, dim, negative. HLG master: never pure `#FFFFFF` surfaces (white maps to 203 cd/m²).
- **Fonts:** from `@remotion/google-fonts` only, with `latin-ext` (Turkish ç ğ ı İ ö ş ü) — verify the export exists
  (`ls node_modules/@remotion/google-fonts/dist` or the package exports) before writing the import.
- **Motion:** map the tempo to `theme.ts → motion` (calm: enter 0.38 s expo-out, exit 0.22; energetic: enter
  0.22–0.28 s, larger `slide`, punch-ins allowed) and to the density line in `MARKA.md`.
- **Sound:** set `levels.sfxDb` / `musicDb` from their answer (hiç → `"sfx": false` default or empty set; hafif → −13;
  belirgin → −9). The base effects are synthesised in code (`scripts/lib/synth.mjs`): tune their character there for free,
  or point `selection.default.json → sfx` at the user's own files in `library/audio/sfx/` (licensed packs, ElevenLabs —
  paid generation only after stating the cost and getting a yes).
- Keep every token key and type in `theme.ts` (components import them); change values, not the shape.
- Fill `marka/MARKA.md` completely, remove the `DOLDURULMADI` line.
- The house rules section in `.claude/skills/video-kurgula/references/editorial-style.md` stays empty — it fills from
  real revisions, not from the interview. Put explicit "asla" items from the interview there as the first rules.

## 4. Show it

`npx tsc --noEmit && npx eslint src && npm run plan:check` (the demo plan in `work/edit-plan.json` must still pass —
if `work/source-metadata.json` is missing, validate with `node -e "import('./scripts/lib/plan.mjs').then(m=>m.loadPlan())"`).
Render 2–3 stills of the demo plan with the new theme (`npx remotion still Graphics <out.png> --frame <n>` on a
coloured backdrop, or the design-stills script once a real video exists), look at them yourself, fix what is off,
and show the user. Ask for one round of feedback ("renk/font/tempo değişsin mi?"), apply it, done.

## 5. Changing the brand later

The same skill handles "rengimi değiştir", "daha sade olsun" etc.: update `MARKA.md` + `theme.ts` (+ audio levels),
re-render a still, show it. Remind the user that any `src/` change re-renders all graphics of the current video.
