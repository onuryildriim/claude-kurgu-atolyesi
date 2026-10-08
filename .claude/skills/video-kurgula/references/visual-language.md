# Visual language — the grammar of the edit

This file is the **grammar** (how graphics behave). The **look** (colours, fonts, brand idea, closing card) comes
from `marka/MARKA.md` and `src/theme/theme.ts` — never hard-code colours here or in components; use the tokens.
Reference stills the user likes: `marka/style-refs/` (learn the grammar from them, never copy another channel's
palette, labels or layouts).

## 1. Brand idea → one sentence

`MARKA.md` → "Marka fikri" describes how every graphic should feel (e.g. "a builder's log", "a calm teacher's
whiteboard", "a fast news ticker"). Every board, label and motion choice must fit that sentence. One accent colour
(`color.accent`) marks the single thing to look at; everything else is text/muted.

## 2. The label layer (micro labels) — what makes it look "produced"

Small mono text (`type.log`), uppercase, letter-spacing ~1.5, muted or accent. At most three on screen at once.

| Label | Where | Example | Rule |
|---|---|---|---|
| Chapter tag | top-left, persists through the section | `● 03  NEDEN ŞİMDİ?` | matches the YouTube chapter list |
| Kicker | above a title on the board | `// MALİYET` | 1–4 words |
| Source line | bottom-left of the board | `↳ KAYNAK: …` | **every factual claim from outside the video**; only real sources |
| Figure counter | top-right of the board | `ŞEKİL 04` | optional |
| Schematic note | under a diagram | `ŞEMATİK GÖSTERİM` | honesty rule |

The style of these labels (code-comment `//`, bullets, plain words, none at all) is a brand choice → `MARKA.md`.

## 3. Stage layouts — the presenter moves, the board takes the space

A 4K source lets us reframe the presenter losslessly.

| ID | Layout | Use |
|---|---|---|
| **L0** | Full camera, no graphics (maybe a chapter tag) | jokes, personal asides, emotional lines — the breathing room |
| **L1** | Camera + side panel | short asides, a single number, a 2–3 item list |
| **L2** | **Split stage**: presenter reframed into one side (~42 %), the other side is the board | argument sections: lists, numbers, comparisons |
| **L3** | **Box**: board full width, presenter in a framed box (~28 % width) | data-heavy boards, screen recordings |
| **L4** | Full-screen board / animation scene, presenter hidden, voice continues | key concept, process, product demo (`animation-scenes.md`) |
| **L5** | Full-screen kinetic type over the dimmed camera or the board | the video's 2–4 thesis sentences |

**Layout changes are the edit.** The presenter frame animates between layouts (position + scale + crop, 0.45–0.6 s),
never pops. Change layout on a jump cut (it hides the cut) or at a sentence boundary — never mid-word. Alternate
push-ins (100 % ↔ 112–118 %) on L0 cuts so consecutive jump cuts never show the same framing. Faces never under
graphics; bottom ~18 % stays free in L0/L1 (hands).

## 4. Motion grammar

1. **Word-synced.** Every element enters on the word that names it (word timestamps, ±0.1 s). Never early.
2. **Transform, don't replace.** Struck price → new price beside it; number counts to the spoken value; bar fills;
   list item ticks `✓` when confirmed; superseded words turn dim. The viewer watches a change, not a new card.
3. **A persistent device per section.** One element that lives through the whole chapter and evolves: a timeline,
   a running total, a progress bar, a checklist.
4. **Show the mechanism.** When the speech explains how something works, simulate it: a cursor clicking a mock UI,
   a prompt typed into a terminal, nodes lighting up. Never a stock icon where a working miniature can be shown.
5. **Kinetic type for theses.** 2–4 per video, L5. Short lines, one accent word, strikes/dims as the sentence turns.
6. **Easing and energy come from the brand** (`theme.ts → motion`): calm channels use expo-out 0.35–0.45 s and quiet
   exits; energetic channels may use faster entries, punch-ins, shakes. Whatever the tempo: no motion without meaning.
7. **Nothing moves once placed**: reserve space for everything that arrives later.

## 5. Video architecture

| Part | Time | What |
|---|---|---|
| Cold open | 0–6 s | the hook (see `editorial-style.md`) |
| Thesis | ~6–30 s | L5 kinetic question/thesis, then L0/L1 |
| Chapters | rest | each opens with the chapter tag, uses one persistent device, ends on L0 |
| Closing | last ~5–15 s | the closing card from `MARKA.md` |

## 6. Density and rhythm

See `editorial-style.md` → "Density guide" and the tempo in `MARKA.md`. Captions are **not burned in** for
long-form unless `MARKA.md` says so (the SRT goes to YouTube).

## 7. Do / don't

- Do sample the frame before choosing a side; do check every cut with `66-cut-check`.
- Do put a source line under every external fact; don't invent a source, a number or a date.
- Don't leave empty dark frames during transitions — the next layout must already be building.
- Don't stack panels over a board; one board at a time.
- Don't use another channel's palette, labels or layouts verbatim.

## 8. Component kit — status

| Piece | Kind | Status |
|---|---|---|
| theme tokens (`font`, `color`, `type`, `motion`, `layout`) | theme | starter theme — `marka-kimligi` rewrites it |
| `stage` (L2/L3) with boards: questions, list, terminal, app | layout | done (`src/events/StageEvents.tsx`) |
| `tag`, stage `source` / `figure` lines | overlay | done |
| `kinetic` (L5) | event | done (`BrandEvents.tsx`) |
| `subscribe` card (avatar, Abone ol → Abone olundu, bell, like) | event | done |
| `screen` with presenter box, zooms, highlights | event | done |
| board blocks `count` (count-up), `swap`, `bar` | event | todo — build when a video needs it |
| `scene-*` bespoke animation scenes | scene | per video, see `animation-scenes.md` |

Update this table whenever a piece lands.

## 9. Vertical (Reels / Shorts) — native 9:16

**Canvas.** 1080×1920 design units. Safe areas: top 0–140 status bar, **graphics band ≈160–720**, speaker below;
the bottom ~420 px and the right ~140 px are platform UI — nothing important there.

| ID | Vertical layout | Use |
|---|---|---|
| **V0** | Full real footage, no graphics | personal lines, jokes; short |
| **V1** | Real footage + graphics in the band above the head | the default: kicker, 2–5 word punch lines, numbers that count |
| **V3** | Full-screen board / app screen, speaker hidden | app recordings, a 2–5 s animation beat |
| **V5** | Kinetic thesis: 2–4 big words | the hook and the one thesis |

Hook in the first 1–1.5 s; closing = follow card from `MARKA.md` synced to the spoken CTA.
