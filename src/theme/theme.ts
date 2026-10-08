// MARKA TOKENLARI — kanalının görsel kimliği burada yaşar. Bu dosya NÖTR BİR BAŞLANGIÇ temasıdır:
// `marka-kimligi` skill'i (Claude'a "markamı kur" de) renkleri, fontları ve hareket temposunu senin
// marka/MARKA.md dosyana göre yeniden yazar. Tüm bileşenler değerleri buradan okur.
// Single source of truth for the overlay design system. All values are in 1920×1080 design
// units; the graphics layer is rendered with scale=2 for the 3840×2160 master.
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// latin-ext carries the Turkish glyphs (ç ğ ı İ ö ş ü). Rendering blocks until fonts are ready.
const display = loadInter("normal", { weights: ["700", "800"], subsets: ["latin", "latin-ext"] });
const text = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
// mono layer: micro labels, terminal, code — see visual-language.md
const mono = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

export const font = {
  display: `${display.fontFamily}, ${text.fontFamily}, sans-serif`,
  text: `${text.fontFamily}, sans-serif`,
  mono: `${mono.fontFamily}, ui-monospace, monospace`,
};

// sRGB authoring values. In the HLG master, #FFFFFF maps to 203 cd/m² (75 % HLG) — never peak white.
export const color = {
  ink: "#111318", // panel surface (opaque: blending happens in HLG signal space, see color-pipeline.md)
  inkRaised: "#1B1E25",
  line: "#2C313B",
  text: "#F2F4F7",
  textMuted: "#A3A9B4",
  accent: "#5B8CFF", // the one accent (başlangıç mavisi — kendi marka rengini koy)
  accentInk: "#06122E",
  negative: "#FF6A55",
  backdrop: "#0B0C10", // full-screen inserts
  dim: "#5D636E", // superseded words, past steps (v2)
  board: "#111318", // v2 stage board (same ink, named for intent)
} as const;

export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 22 } as const;

export const type = {
  kicker: { fontFamily: font.text, fontWeight: 800, fontSize: 19, letterSpacing: 2.2, textTransform: "uppercase" as const },
  headline: { fontFamily: font.display, fontWeight: 800, fontSize: 46, lineHeight: 1.08, letterSpacing: -0.6 },
  title: { fontFamily: font.display, fontWeight: 700, fontSize: 36, lineHeight: 1.12, letterSpacing: -0.4 },
  body: { fontFamily: font.text, fontWeight: 600, fontSize: 27, lineHeight: 1.28 },
  small: { fontFamily: font.text, fontWeight: 600, fontSize: 21, lineHeight: 1.3 },
  note: { fontFamily: font.text, fontWeight: 600, fontSize: 17, lineHeight: 1.3, letterSpacing: 0.3 },
  number: { fontFamily: font.display, fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: -1.5 },
  log: { fontFamily: font.mono, fontWeight: 700, fontSize: 15, letterSpacing: 1.6, textTransform: "uppercase" as const },
  code: { fontFamily: font.mono, fontWeight: 500, fontSize: 24, lineHeight: 1.5 },
} as const;

// Safe placement derived from sampling the footage (work/qc/placement): the upper-right wall is
// free in most shots; a few shots need the left side. Bottom area is avoided (hand gestures).
export const layout = {
  width: 1920,
  height: 1080,
  margin: 58,
  panelTop: 70,
  panelWidth: 500,
  panelWidthLeft: 500,
  panelMaxHeight: 640,
} as const;

// Motion, in seconds. Deterministic: everything is derived from the current frame.
export const motion = {
  enter: 0.38,
  exit: 0.22,
  itemEnter: 0.3,
  slide: 28, // px travelled during entrance
  bezierEnter: [0.16, 1, 0.3, 1] as const,
  bezierExit: [0.4, 0, 1, 1] as const,
} as const;
