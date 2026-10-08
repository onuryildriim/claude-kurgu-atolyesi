# Sound — base effects, designed cues, user-supplied music, mix, QC

The sound identity is part of the brand: `marka/MARKA.md` → "Ses" says how much sound the channel wants
(none / subtle / punchy). All default effects are **synthesised in code** (`scripts/lib/synth.mjs`, run by
`npm run audio` → `work/audio/cues/*.wav`), so the repo ships no audio files. The user can swap in their own files
(`library/audio/sfx/`, paths in `library/audio/selection.default.json → sfx`).

## Base effect set (mapping in `library/audio/selection.default.json`)

| Cue | Default (synth cue) | Placed by `scripts/75-audio.mjs` |
|---|---|---|
| quick whoosh | `swoosh-cam` | entrance of compact panels: `headline`, `callout`, `social`, `versus` |
| slow whoosh | `swoosh-deep` | entrance of large panels: `list`, `steps`, `bars`, `search`, `stat`, `phone`, `cards` (`whooshSlowTypes`) |
| tick | `thock` | every timed item/row/note/chip/highlight, captions, sub-lines, scene elements |
| strike | `strike` | the hook's strike-through (`strikeAt`) |
| transition | `swoosh-deep` | entrance of every full-screen event (`side: "full"`) |
| pop | `pop` | each card image |

Exits are silent. Two cues closer than 0.35 s → the higher priority survives (pop/strike > whoosh/transition >
tick). Mute one event with `"sfx": false` in the plan. Levels (`work/audio/selection.json → levels`): music
22 dB below the narration's integrated loudness + light narration-keyed ducking (ratio 1.6), effects ≈ 11 dB
below (per-kind trims in the script), fade-in 1.5 s, fade-out 4 s. A good starting balance; the user tunes it by ear.

## Designed cues synthesised in code

Effects are **chosen for what happens on screen**, not one generic whoosh for everything. The base set above stays
the base layer for ordinary panels. On top of that, every video gets a **cue pack synthesised in code** for its
boards, theses and animation scenes. No credits are spent; music is never generated.

**Engine:** `scripts/lib/synth.mjs` (plain Node, no dependencies; 13 cues, auto-placed for v2 event types by `75-audio.mjs`, extra hand cues via an event's `cues: [{at, kind}]`): float32
buffers at 48 kHz → WAV; oscillators (sine/triangle/saw), filtered noise (one-pole/biquad LP/HP/BP), ADSR and
exponential envelopes, pitch sweeps, FM bell, short convolution-free reverb (a few feedback delays), soft clip;
**seeded** random so a re-render sounds identical. Output to `work/audio/cues/<name>.wav`; the plan or
`work/audio/selection.json → cues` maps event keys to cue names, and `scripts/75-audio.mjs` places them like
the base set.

**Cue vocabulary** (build these once, tune per video):

| Cue | Synthesis idea | Visual it belongs to |
|---|---|---|
| `type` | 6–12 ms noise click through BP 2–4 kHz, random pitch ±8 %, one per character (thin out to ≤ 25/s) | terminal / prompt typing |
| `count` | tiny sine blip whose pitch rises with the counter's progress | count-up numbers, year counters |
| `tick-ok` | two-note soft FM bell (e.g. E6→B6, 120 ms) | `✓` on a list/check item |
| `strike` | short filtered noise scratch + low thump | strike-through / ✗ |
| `riser` | 0.6–1.5 s noise + sine sweep up, ends exactly at the reveal | before a big number or a thesis (L5) |
| `impact` | sub sine 55→40 Hz 250 ms + noise transient | the key number / thesis word landing |
| `swoosh-cam` | band-passed noise with a moving centre, length = camera move | layout morphs (L0↔L2↔L3), camera pans in scenes |
| `ping` | sine + quiet 5th harmonic, 400 ms decay | map points, nodes lighting up |
| `coin` | two high bells 1/2 step apart, very short | money values, sales arriving |
| `shutter` | two noise bursts 40 ms apart | screenshot / card appears |
| `glitch` | bit-crushed noise, 80 ms | error, wrong claim |
| themed | per subject, e.g. warm wood taps (crafts), glassy taps (app UI), drums (history) | the scene's own theme |

**Rules:**
- One cue per visual event; nothing plays without a picture change. Minimum spacing 0.35 s (typing excepted, it is one bed).
- Level: cues sit ≈ 11–14 dB under the narration (like the base set), impacts/risers at most −9 dB; nothing
  between 2–5 kHz that is sharp (ear fatigue); short tails; exits stay silent.
- Measure every generated cue (`volumedetect`, `astats` peak/RMS, `showspectrumpic` for a picture you read) —
  short synth sounds can come out silent, clipped or hissy.
- Make a preview (`75-audio.mjs --preview a-b`) of the busiest scene and give the user a cue list with times; only
  their ears can approve the taste. A cue they dislike twice is removed from the vocabulary.
- Realistic foley (paper, crowd, real instruments) is ElevenLabs territory: only on request, cost first.

## No music
The user can ask for a video **without music** ("müzik ekleme"): set `work/audio/selection.json → music: "none"`. The music
stem is then silence (stems and QC keep working), only the effects are added, and the narration stays bit-identical
(null test). "Sesi hiç değiştirme" = no gain/EQ/compression on the narration, also no `gainDb` in `assemble.json`; the
only touch is the 12 ms splice fade of `08-assemble`.
If the user later asks to raise a quiet part and "master" the sound: `selection.narration = { parts: [{from,to,gainDb}], gate, compressor, targetLufs: -16, limitDbfs: -2 }` (75-audio; no delay, QC null test uses the processed narration).

## Music — supplied by the user (never generated unless asked)

The user puts the music for each video into `public/assets/` together with the other assets. `scripts/75-audio.mjs`
finds it by itself when `work/audio/selection.json → music` does not point at an existing file: audio files
(`mp3 wav m4a aac flac aif aiff ogg`), a name containing *müzik / muzik / music* wins, otherwise the longest.
To force a file, write its path into `music`.

- Step 7 of the workflow: `ffprobe` the duration and measure `ebur128`; write both into `work/progress.md`.
- **Shorter than the video** → the script repeats it with 5 s equal-power crossfades (`work/audio/build/music-looped.wav`)
  and prints a note; mention it in the delivery message. Longer → trimmed, 4 s fade-out at the video's end.
- The gain is computed from the track's own loudness, so any track lands 22 dB under the narration.
  A track with vocals or big dynamics can still fight the voice — you cannot hear it, so say in the delivery
  message that the balance needs their ears, and that “müziği aç/kıs” takes ~5 min.
- **No audio file in `public/assets/`** → the script uses `library/audio/music/*` if the user keeps a default track there, otherwise it stops — ask for a track
  or set `work/audio/selection.json → music: "none"`.
- The music file is not a visual asset: leave it out of `assets.config.json`; list it under `audioAssets` in
  `work/asset-manifest.json` (file, duration, LUFS). Licence/rights of the supplied track are the user's.
- ElevenLabs (`mcp__claude_ai_ElevenLabs__creative_*`) is only for explicit requests (“şuna yeni bir efekt üret”,
  “müzik üret”). Music ≈ 15 credits/s, effects ≈ 5–14 credits each: state
  the cost and get a yes before running. Tool sequence: `creative_add_flow_node` (with `model_parameters`) →
  `creative_run_flow_nodes` (`estimate_only` first, then `generations_count: 1`) → poll
  `creative_get_flow_run_status` → `curl` the signed `media[].url` (valid 2 h; let a subagent poll + download,
  the payload is huge). Short effects sometimes come out silent — measure (`volumedetect`) before using.

## Build and verify

```bash
npm run audio      # narration (untouched) + music stem + effects stem → mix; mux with stream-copied video; out/stems/*.wav
npm run qc:mix     # lag 0 samples (start/middle/end) · null test (mix − stems − narration ≈ −140 dBFS) · AAC SNR > 25 dB
                   # · true peak ≤ −1 dBTP · narration dominates · video packets identical to the clean master
node scripts/75-audio.mjs --preview 0-40    # audition clip with graphics, for the user
```
`work/audio/build/audio-report.json` lists every placed cue — skim it: a cue count far from
(#events + #timed items) means a plan key is missing from the cue loops.

Phone/lav narration is often quiet (≈ −26 LUFS). Narration is never processed by default; if it is quiet, offer a constant gain on the whole mix (max until −1 dBTP) in the delivery message — do not
apply it unasked.

Licence note for the docs: synthesised effects are generated by this code (no third-party licence); effects the user
adds and the music are the user's own choice and responsibility.
