# Delivery — files, docs, message

## Files the user receives (`out/`)

| File | What |
|---|---|
| `final-hlg.mov` | the video: graphics + music/effects mix (this is the upload) |
| `final-hlg.temiz-ses.mov` | same video packets + the original audio, bit-identical copy |
| `stems/muzik.wav`, `stems/efekt.wav` | 24-bit stems (narration + these two = the mix) |
| `final.tr.srt` | full Turkish subtitles (not burned in) |
| `README.tr.md` | what was done, real specs table, how to change text/timing/sound, rebuild commands, human checks |

Internal but referenced: `work/qc-report.md`, `work/edit-plan.json`, `work/asset-manifest.json`, `work/progress.md`.

## Docs

Write them fresh for every video with this video's measurements — never carry numbers over from an older project
(`projects/<old>/` has previous versions to copy the structure from).

`work/qc-report.md` keeps three confidence levels apart:
- **A. Automatic** — the check tables from `work/qc/reports/qc.*.json` (21 video checks, 24 with the mix).
- **B. Inspected by me** — which stills/sheets were read and what was verified per event (SDR viewing transform,
  not an HDR reference).
- **C. Only a human can do** — HDR display, unlisted YouTube HDR test upload, listening to music/effects and
  balance, the `uncertain` subtitle passages, privacy-sensitive assets, licence of generated audio.

Finish `work/progress.md` with all boxes ticked and a line containing **TAMAMLANDI** plus the SHA-256 prefixes of
the deliverables (the next `05-new-project.mjs` run requires it).

## Delivery message (Turkish, short, scannable)

1. One sentence: done + the one thing they must do (listen/watch once).
2. **Dosyalar** table (as above, with sizes).
3. **Neler eklendi**: event count, the full-screen scenes with timestamps, which assets were used, the closing card.
   v2: the animation scenes (style + timestamps), the thesis lines, and the **YouTube bölüm listesi** (`0:00 …`,
   same titles as the chapter tags) ready to paste into the description.
4. **Ölçümler**: frame count/duration identical, QC x/x, lag 0, null test, true peak, music vs narration.
5. **Size kalanlar**: ears (music/effects), HDR screen, YouTube test, uncertain subtitle passages, privacy items.
5b. **Ses tasarımı**: the synthesised cue pack (names + where they play, e.g. `riser+impact 2:14 tez`), and which
   preview clip to listen to first.
6. **Müzik**: which supplied file was used (looped? library fallback?). ElevenLabs credits only if something was generated on request.
7. **Değişiklik isterseniz**: “metin/zamanlama → yazın”, “müziği aç/kıs, şu olayda ses olmasın → ~5 dk”.

During long jobs: per-step ETA table + the `! tail -f …` command, and a one-line status whenever a step ends.
Report failures plainly with the output; never describe a check as passed unless its file/result was read.
