# Pipeline reference — commands, durations, traps

> Default master format: 4K HLG (iPhone HDR footage). SDR / 1080p sources are handled by the SDR branch
> (`sourceIsHlg()` in `scripts/lib/filters.mjs`) — see "Different source formats". Durations below are for a
> 7.6 min 4K60 source on an Apple Silicon Mac.

All paths are relative to the repo root. Per-video data lives in `work/`, `out/`, `public/main.mov`,
`public/assets/`, `public/derived/`, `public/proxy/`. Generic: `src/`, `scripts/`, `library/`, `work/luts/`,
`work/color-pipeline.md` (the colour decisions and measurements — read it once if you touch colour).

## Steps

| # | Command | Output | Time (7.6 min 4K60 source) |
|---|---|---|---|
| 0 | `node scripts/05-new-project.mjs --slug <slug> [--video f] [--assets dir…] [--dry-run]` | archive → `projects/<old>/`, fresh `work/` | seconds |
| 0b | `node scripts/08-assemble.mjs` (only if clips are spliced in / camera zooms) | `work/composite/base.mov` from `work/assemble.json`; then `work/project.json → "source": "work/composite/base.mov"` | ~10 min (5.4 min 4K30, ProRes 422 HQ, ~26 GB) |
| 1 | `npm run probe` | `work/source-metadata.json` | seconds |
| 2a | `npm run luts` | `work/luts/*.cube` (+ self-test) — only if missing | ~1 min |
| 2b | `npm run proxy` | `public/proxy/main.preview-sdr-1080p.mp4` (SDR preview, never in the master) | ~4 min |
| 2c | `npm run assets` | `public/derived/assets/<id>.mp4` (CFR 60, BT.709 tv, silent) from `work/assets.config.json` | ~1 min |
| 3 | `npm run transcribe` | raw whisper → reviewed `work/transcript.tr.{txt,srt,json}` + `out/final.tr.srt` | ~5 min |
| 3b | `node scripts/32-pip.mjs` | presenter clips for `screen` events with `pip` → `public/derived/pip/E*.mp4` (from the base, SDR) | ~1 min |
| 5 | `npm run plan:check` | schema, bounds, overlaps, reading speed, asset existence | seconds |
| 6 | `node scripts/65-design-stills.mjs [--only E09] [--at 346.2,350.1]` · `node scripts/66-cut-check.mjs --remotion` | `work/qc/design/*.jpg`, `work/qc/stills/cuts/sheet_*.jpg` | 2–4 min |
| 8 | `npm run render:gfx` | `work/segments/*.mov` (ProRes 4444 alpha, 3840×2160) + `manifest.json` | ~27 min (≈12 fps) |
| 9a | `npm run composite` | `work/composite/final-hlg.candidate.mov` (libx265 medium CRF 14) | ~48 min (≈9.5 fps) |
| 9b | `npm run qc` | 21 checks + stills; all-pass → `out/final-hlg.temiz-ses.mov` | ~8 min |
| 10a | `npm run audio` | `work/audio/build/*`, `work/composite/final-hlg.mix.candidate.mov`, `out/stems/*.wav` | ~2 min |
| 10b | `npm run qc:mix` | 24 checks; all-pass → `out/final-hlg.mov` | ~4 min |
| — | `node scripts/75-audio.mjs --preview a-b` | `work/audio/preview/onizleme_a-b.mp4` (graphics + mix, SDR view) | ~1 min |
| — | `npm run composite:draft` | fast VideoToolbox draft — inspection only, NEVER a deliverable | ~15 min |

`npm run master` chains 8 → 10b. Every script skips existing output (`--force` to redo).

## Running long jobs

```bash
nohup scripts/run-master-detached.sh > work/logs/chain.log 2>&1 &      # render → manifest check → composite
until grep -q "\[chain\] BITTI\|MANIFEST EKSIK" work/logs/chain.log; do sleep 30; done   # waiter (≤10 min per foreground call)
```
- Wait on the **PID** (`while kill -0 <pid> 2>/dev/null; do sleep 15; done`). **Never** `pgrep -f <script name>` in
  a wait loop — the loop's own command line matches and it never ends.
- For a single job use `nohup node scripts/<x>.mjs > work/logs/<x>.log 2>&1 &` and remember `$!`.
- Foreground waits are capped at 10 min: poll in ≤10-min chunks or use a background waiter, and give the user
  `! tail -f work/logs/render-gfx.log` / `! tail -c 300 work/logs/composite.log` plus the ETA.
- After render: every segment's `nb_frames` must equal the manifest; after composite: frame count = source.
  A piped `tail` once masked a failure — check files.

## Caching rules

- Segments are content-hashed (code under `src/` + the segment's events + referenced assets). **Any change
  under `src/` re-renders everything (~27 min)**; plan-only changes re-render only affected segments. So finish
  component work before the first full render, and do not touch `src/` for a text-only revision.
- `scripts/` and `library/` are not part of the hash.

## SDR sources (iPhone SDR / screen recordings)
iPhone SDR camera + Mac screen recording (both BT.709 8-bit): `work/assemble.json → "output": "sdr"` keeps the base BT.709
(ProRes **LT**, ~1 GB/min at 4K60 — HQ would be ~13 GB/min), `scripts/lib/filters.mjs → sourceIsHlg()` (from the probe)
switches the proxy, graphics overlay, x265 tags and QC to BT.709. Screen recordings 3854×2160 → `crop: [3840, 2160, 7, 0]`.
In SDR the graphics may use translucent scrims (no HLG blending caveat).

## Known traps (all hit in real projects)
- Remotion `bundle()` copies the whole `public/` into the temp dir and never deletes it: keep huge files (the assembled base) out of `public/` (`work/composite/base.mov`); the render/still scripts now remove their bundle on exit (five stale bundles once ate 200 GB).
- `20-transcribe.mjs --force` must re-extract the WAV after a re-assembled base (fixed); `60-render` hashes only source files (`src/.DS_Store` from Finder once invalidated every segment; `--adopt` renames renders whose pixels are known unchanged).
- `05-new-project.mjs` moves every file in `public/assets/` that the OLD plan did not reference into the archive — a file
  the user just dropped for the NEW video (e.g. an avatar photo) can end up in `projects/<old>/public/assets/`. Check the
  dry run; copy it back with `cp -c` if needed.

- ffmpeg here has **no `zscale`, `libplacebo`, `drawtext`, `soxr`**. Colour transforms are done with the
  generated 3D LUTs; use `colorspace` for P3→709 of screen recordings (done automatically in step 2c).
- ffmpeg 9: `-fps_mode passthrough` cannot be combined with `-r`; frame tags override output `-color_*`
  options → chains that end in SDR need a trailing `setparams`.
- **VideoToolbox adds its own Dolby Vision 8.4 RPU to HLG 10-bit input** → masters are libx265 with
  `-dolbyvision 0`; VideoToolbox is for drafts only. Source Dolby Vision is dropped on purpose (plain HLG).
- Graphics white = 203 cd/m² (HLG 75 %, code 721). Blending happens in HLG signal space → **opaque panels
  only**, no large translucent surfaces.
- The presenter's framing jumps at every cut. A panel that is safe at an event's start can land on the face
  after a cut → always run `66-cut-check.mjs --remotion` and look at the sheets.
- Remotion's `Root.tsx` imports `work/edit-plan.json` statically: no Remotion step works before the plan exists.
- Supplementary videos are always muted. Speed changes are baked by ffmpeg (`trim` + `fit` in
  `work/assets.config.json`), Remotion plays them at 1× (deterministic). Give each clip `fit` = its slot + 0.3 s
  so it never runs out before the next clip covers it.
- Screen recordings are VFR + Display P3: normalisation makes them CFR 60 + BT.709 (auto-detected `smpte432`).
- Whisper model: `~/Models/whisper/ggml-large-v3-turbo.bin` (`WHISPER_MODEL` overrides). Timestamps ±0.3 s.
- The audio build is deterministic; narration is decoded once and summed untouched (no limiter). If the mix's
  true peak would exceed −1 dBTP, lower `musicDb`/`sfxDb` — never process the narration.

## Different source formats

The scripts read cadence, frame count and size from the probe, but these parts assume the default format (4K60 HLG, iPhone/mirrorless HDR):

| Assumption | Where | If the new source differs |
|---|---|---|
| Rec.2100 HLG, 10-bit | `scripts/lib/filters.mjs` (`gfxToHlg`, `stripDovi`, `viewingTransform`), `40-make-luts.mjs`, x265 params + HLG tags in `70-composite.mjs`, HLG checks in `80-qc.mjs` | **SDR BT.709 source**: add an SDR branch — overlay the graphics directly (BT.709, no gfx LUT), proxy without the viewing LUT, x265 8/10-bit with bt709 tags, QC expecting bt709. Implement it behind a `sourceIsHlg` switch derived from `work/source-metadata.json`; do not fake HLG. |
| 3840×2160 | composition is 1920×1080 rendered at `scale: 2` in `60-render-segments.mjs` | 1920×1080 source → `scale: 1`. Other aspect ratios → new layout constants in `src/theme/theme.ts`; stop and tell the user first. |
| 60 fps | `fps=60` in `30-normalize-assets.mjs`; plan `source.fps` drives Remotion | use the probed fps for the derived assets too. |
| one stereo AAC 44.1 kHz narration track | `75-audio.mjs` (`SR = 44100`), audio checks in `80-qc.mjs` | match `SR` to the source rate; keep a single encode. |
| file name | `public/main.mov` (`scripts/lib/paths.mjs`) | clone any container to that name; ffmpeg reads by content. |

If an adaptation is needed, do it, note it in `work/progress.md` → "Kararlar ve notlar" and in the delivery
message, and extend this table so the next video benefits.

## Splicing clips in + camera zooms

When the user sends extra clips **with their own narration** (e.g. voice-over screen recordings)
to be placed "where it makes sense", the timeline is no longer `main.mov`:
- Find the splice points from the transcript + `silencedetect` + scene cuts; cut **in silence**, ideally on a shot
  change (a 12 ms fade is applied at every splice). Write `work/assemble.json` (pieces + zooms), run
  `scripts/08-assemble.mjs`, set `work/project.json → source`, then probe → proxy → transcribe as usual. Every
  script reads `SOURCE` (scripts/lib/paths.mjs), so QC compares the master with the base.
- Level-match spliced narration with `gainDb` (measure `ebur128`; e.g. −31,4 LUFS → +11 dB, limiter −2 dBFS).
- SDR pieces are lifted into HLG with the graphics LUT; they are normally covered by a full-screen `screen` event anyway.
- **Camera zooms** (`zooms` in output seconds): punch-ins 1.12–1.20 on emphasis lines (hard, `in/out 0`, aligned with
  a cut or a sentence), slow push-ins over a question, a zoom-out settle after returning from a full-screen scene.
  Re-run the cut-check after zooming: a bigger face reaches the panels.
- 30 fps sources work: asset normalisation uses the probed fps.
- Short stable moments in a recording (a page shown for ~1 s) → a frozen derived clip: `trim: [t, t+0.1]`, `fit: <seconds>`.

## YouTube upload file

The x265 master (open GOP, B-frames, keyint 120, CRF 14) played fine locally, but on YouTube the video lost frames in
two near-static, very low-bitrate stretches (hook blur + a static screen recording, 1–6 Mbit/s): picture jumped ahead /
froze while the audio ran on. Deliver an upload-safe file as standard from now on:
`node scripts/70-composite.mjs --youtube --crf 12` (closed GOP, IDR every second, no B-frames → no edit list), then mux
`work/audio/build/mix.wav` as `pcm_s24le` into `out/final-hlg.youtube.mov`. Tell the user to upload that one and
to check the first seconds + one static screen passage on YouTube before publishing.

## Shorts (vertical, 15–30 s) from a finished master

`node scripts/90-shorts.mjs work/shorts/<name>.json` — no graphics re-render: the 16:9 master (graphics burned in) is
letterboxed over its own blur; a small Remotion overlay (`Short` composition, src/compositions/ShortOverlay.tsx) adds a
title (kicker + line + big accent figure), word-by-word captions (from whisper `-ml 1` word JSON) and a CTA card.
Narration from the clean-audio master, continuous music bed (18 LU under), whoosh per cut, then +gain to ≈ −14 LUFS with a
−1 dB limiter. x264 closed GOP, 1 s keyframes, no B-frames. ~3 min per short. Structure that works: hook (figure) → idea → proof → 2 s montage → CTA "full video linked below".
