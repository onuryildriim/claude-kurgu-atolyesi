// v2 stage (see .claude/skills/video-kurgula/references/visual-language.md):
// the presenter morphs from the full frame into a white-framed card (L2) or box (L3) on the right, the
// left becomes a board whose content builds as it is spoken, and at the end the card grows back to the
// full frame so the return to the camera is invisible. The presenter clip is cut from the base by
// scripts/32-pip.mjs (same frames as the event, full 16:9 frame, SDR).
// Everything is a pure function of the frame.
import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { color, type } from "../theme/theme";
import type { EventOf } from "../plan/schema";
import { useLocal } from "./shared";

type StageEvent = EventOf<"stage">;
type Board = StageEvent["content"]["scenes"][number]["board"];
type Local = (s: number) => number;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const back = Easing.bezier(0.34, 1.4, 0.64, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const FRAME_WHITE = "#FFFFFF";
const LINE = "#2A2E37";
const RAISED = "#171A20";
const CARD = { x: 1046, y: 104, w: 790, h: 872 };
const BOX = { x: 1430, y: 104, w: 420, h: 480 };
const MORPH = 0.62; // seconds, full frame ↔ card

/** 0→1 over `sec` starting at local frame `at`. */
export const useP = (at: number, sec: number, ease = outExpo) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [at, at + sec * fps], [0, 1], { ...clamp, easing: ease });
};

// ── small shared atoms ──────────────────────────────────────────────────────────────────────────
export const LogLabel: React.FC<{ children: React.ReactNode; tone?: "accent" | "muted"; style?: React.CSSProperties }> = ({ children, tone = "accent", style }) => (
  <div style={{ ...type.log, color: tone === "accent" ? color.accent : color.textMuted, whiteSpace: "nowrap", ...style }}>{children}</div>
);

/** Row that slides in from the left at `at` (space is reserved: nothing else moves). */
const In: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dx?: number; dy?: number }> = ({ at, children, style, dx = -26, dy = 0 }) => {
  const p = useP(at, 0.5);
  return <div style={{ opacity: interpolate(p, [0, 0.4], [0, 1], clamp), translate: `${(1 - p) * dx}px ${(1 - p) * dy}px`, ...style }}>{children}</div>;
};

const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const p = useP(at, 0.5, back);
  return <div style={{ opacity: interpolate(p, [0, 0.3], [0, 1], clamp), scale: String(0.86 + 0.14 * p), ...style }}>{children}</div>;
};

const Check: React.FC<{ at: number; size?: number }> = ({ at, size = 30 }) => {
  const p = useP(at, 0.45, inOut);
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" style={{ flex: "none" }}>
      <circle cx={15} cy={15} r={14} fill={color.accent} opacity={interpolate(p, [0, 0.3], [0, 1], clamp)} />
      <path d="M8 15.5 L13 20.5 L22 10" fill="none" stroke={color.accentInk} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - p)} />
    </svg>
  );
};

/** Typed text with an amber caret while typing. */
const Typed: React.FC<{ at: number; text: string; seconds: number; style?: React.CSSProperties; caret?: boolean }> = ({ at, text, seconds, style, caret = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.round(interpolate(frame, [at, at + seconds * fps], [0, text.length], clamp));
  const typing = frame >= at && n < text.length;
  const blink = Math.floor((frame - at) / (0.5 * fps)) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && frame >= at && (typing || blink) ? <span style={{ display: "inline-block", width: "0.55em", height: "1.05em", translate: "0px 0.18em", background: color.accent, marginLeft: 2 }} /> : null}
      <span style={{ color: "transparent" }}>{text.slice(n)}</span>
    </span>
  );
};

// ── boards ──────────────────────────────────────────────────────────────────────────────────────
const Questions: React.FC<{ b: Extract<Board, { kind: "questions" }>; L: Local }> = ({ b, L }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {b.items.map((it, i) => {
        const next = b.items[i + 1] ? L(b.items[i + 1].at) : 1e9;
        const past = interpolate(frame, [next, next + 12], [0, 1], clamp);
        return (
          <In key={it.text} at={L(it.at)} style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
            <span style={{ ...type.log, fontSize: 22, color: color.accent, width: 40 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ ...type.headline, fontSize: 46, color: past > 0 ? `color-mix(in srgb, ${color.text} ${100 - past * 45}%, ${color.dim})` : color.text }}>{it.text}</span>
          </In>
        );
      })}
    </div>
  );
};

const ListBoard: React.FC<{ b: Extract<Board, { kind: "list" }>; L: Local }> = ({ b, L }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
    {b.items.map((it, i) => (
      <In key={it.text} at={L(it.at)} style={{ display: "flex", alignItems: "center", gap: 22 }}>
        {b.marker === "check" ? <Check at={L(it.at) + 6} size={38} /> : b.marker === "num" ? <span style={{ ...type.log, fontSize: 22, color: color.accent, width: 38 }}>{String(i + 1).padStart(2, "0")}</span> : <span style={{ width: 14, height: 14, borderRadius: 7, background: color.accent }} />}
        <span style={{ ...type.headline, fontSize: 44 }}>{it.text}</span>
      </In>
    ))}
  </div>
);

const Terminal: React.FC<{ b: Extract<Board, { kind: "terminal" }>; L: Local; width: number }> = ({ b, L, width }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
    <Pop at={L(b.lines[0].at) - 8} style={{ width, borderRadius: 18, background: "#0B0D11", border: `1px solid ${LINE}`, boxShadow: "0 30px 70px rgba(0,0,0,0.5)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 18px", borderBottom: `1px solid ${LINE}`, background: RAISED }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
        <span style={{ ...type.code, fontSize: 17, color: color.textMuted, marginLeft: 12 }}>~/proje</span>
      </div>
      <div style={{ padding: "22px 26px 26px", display: "flex", flexDirection: "column", gap: 8, minHeight: 250 }}>
        {b.lines.map((l) => {
          const at = L(l.at);
          const tone = l.tone === "accent" ? color.accent : l.tone === "muted" ? color.textMuted : color.text;
          return l.tone === "cmd" ? (
            <div key={l.text + l.at} style={{ ...type.code, fontSize: 27, color: tone }}>
              <span style={{ color: color.accent }}>❯ </span>
              <Typed at={at} text={l.text} seconds={l.typeSeconds ?? Math.max(0.5, l.text.length / 22)} />
            </div>
          ) : (
            <In key={l.text + l.at} at={at} dx={0} dy={8} style={{ ...type.code, fontSize: l.tone === "accent" ? 30 : 24, fontWeight: l.tone === "accent" ? 700 : 500, color: tone }}>{l.text}</In>
          );
        })}
      </div>
    </Pop>
    {b.chips.length ? (
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {b.chips.map((c) => (
          <Pop key={c.text} at={L(c.at)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderRadius: 999, background: c.on ? color.accent : RAISED, color: c.on ? color.accentInk : color.text, border: `1px solid ${c.on ? color.accent : LINE}`, ...type.body, fontSize: 28, fontWeight: 800 }}>
            {c.on ? "✓" : null} {c.text}
          </Pop>
        ))}
      </div>
    ) : null}
  </div>
);

const AppBoard: React.FC<{ b: Extract<Board, { kind: "app" }>; L: Local }> = ({ b, L }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const H = 720, SRC_W = 3854, SRC_H = 2160;
  const W = (H * b.crop.w * SRC_W) / (b.crop.h * SRC_H);
  const vw = W / b.crop.w, vh = H / b.crop.h;
  return (
    <div style={{ display: "flex", gap: 46, alignItems: "flex-start" }}>
      <Pop at={L(b.clips[0].at)} style={{ position: "relative", width: W, height: H, overflow: "hidden", borderRadius: 26, boxShadow: "0 30px 70px rgba(0,0,0,0.55)", background: "#000", flex: "none" }}>
        {b.clips.map((c, i) => {
          const from = Math.max(0, L(c.at));
          const next = b.clips[i + 1] ? L(b.clips[i + 1].at) : durationInFrames;
          return (
            <Sequence key={`${c.src}${c.at}`} from={from} durationInFrames={Math.max(1, next - from)} layout="none">
              <Video src={staticFile(c.src)} muted trimBefore={Math.round(c.trimStart * fps)} style={{ position: "absolute", left: -b.crop.x * vw, top: -b.crop.y * vh, width: vw, height: vh }} objectFit="fill" />
            </Sequence>
          );
        })}
      </Pop>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingTop: 30 }}>
        {b.points.map((pt) => (
          <In key={pt.text} at={L(pt.at)} style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Check at={L(pt.at) + 6} size={32} />
            <span style={{ ...type.title, fontSize: 34 }}>{pt.text}</span>
          </In>
        ))}
        <In at={L(b.clips[0].at) + 20} dx={0} style={{ marginTop: 14 }}><LogLabel tone="muted">{b.caption}</LogLabel></In>
      </div>
    </div>
  );
};

const BoardView: React.FC<{ board: Board; L: Local; width: number }> = ({ board, L, width }) => {
  switch (board.kind) {
    case "questions": return <Questions b={board} L={L} />;
    case "list": return <ListBoard b={board} L={L} />;
    case "terminal": return <Terminal b={board} L={L} width={width} />;
    case "app": return <AppBoard b={board} L={L} />;
  }
};

// ── the stage itself ────────────────────────────────────────────────────────────────────────────
const tc = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

type Scene = StageEvent["content"]["scenes"][number];
const BOARD_X = 104;
const boardWidth = (scn: Scene) => (scn.size === "box" ? BOX.x : CARD.x) - BOARD_X - 70;

const BoardLayer: React.FC<{ scn: Scene; first: boolean; L: Local; content: number; o: number; dy: number }> = ({ scn, first, L, content, o, dy }) => {
  const { fps } = useVideoConfig();
  const titleIn = useP(L(scn.at) + (first ? Math.round(0.45 * fps) : 0), 0.6);
  return (
    <>
      <div style={{ position: "absolute", left: BOARD_X, top: 112, width: boardWidth(scn), opacity: content * o, translate: `0px ${dy}px`, color: color.text }}>
        <div style={{ opacity: titleIn, translate: `${(1 - titleIn) * -24}px 0px` }}>
          <LogLabel>{`// ${scn.kicker}`}</LogLabel>
          <div style={{ ...type.headline, fontSize: 60, lineHeight: 1.05, letterSpacing: -1.2, marginTop: 12, color: color.text }}>{scn.title}</div>
        </div>
        <div style={{ marginTop: 52 }}>
          <BoardView board={scn.board} L={L} width={boardWidth(scn)} />
        </div>
      </div>
      {scn.source || scn.figure ? (
        <div style={{ position: "absolute", left: BOARD_X, bottom: 48, opacity: content * o, display: "flex", gap: 22 }}>
          {scn.figure ? <LogLabel tone="muted">{scn.figure}</LogLabel> : null}
          {scn.source ? <LogLabel tone="muted">↳ {scn.source}</LogLabel> : null}
        </div>
      ) : null}
    </>
  );
};

export const Stage: React.FC<{ event: StageEvent }> = ({ event }) => {
  const L = useLocal(event);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { presenter, scenes } = event.content;
  let si = 0;
  while (si + 1 < scenes.length && L(scenes[si + 1].at) <= frame) si++;
  const sc = scenes[si];
  const prev = si > 0 ? scenes[si - 1] : sc;
  const swap = si > 0 ? interpolate(frame, [L(sc.at), L(sc.at) + 0.6 * fps], [0, 1], { ...clamp, easing: inOut }) : 1;
  const RA = prev.size === "box" ? BOX : CARD, RB = sc.size === "box" ? BOX : CARD;
  const R = { x: lerp(RA.x, RB.x, swap), y: lerp(RA.y, RB.y, swap), w: lerp(RA.w, RB.w, swap), h: lerp(RA.h, RB.h, swap) };
  const enter = interpolate(frame, [0, MORPH * fps], [0, 1], { ...clamp, easing: inOut });
  const leave = interpolate(frame, [durationInFrames - MORPH * fps, durationInFrames - 1], [0, 1], { ...clamp, easing: inOut });
  const m = enter * (1 - leave);
  const content = interpolate(frame, [0.42 * fps, 0.9 * fps], [0, 1], clamp) * (1 - interpolate(frame, [durationInFrames - (MORPH + 0.3) * fps, durationInFrames - MORPH * fps], [0, 1], clamp));

  // presenter rect and the video inside it
  const rect = { x: lerp(0, R.x, m), y: lerp(0, R.y, m), w: lerp(1920, R.w, m), h: lerp(1080, R.h, m) };
  const s1 = Math.max(R.h / 1080, R.w / 1920) * presenter.zoom;
  const vw1 = 1920 * s1, vh1 = 1080 * s1;
  const ox1 = Math.min(0, Math.max(R.w - vw1, R.w / 2 - presenter.cx * vw1));
  const oy1 = Math.min(0, Math.max(R.h - vh1, R.h / 2 - presenter.cy * vh1));
  const s = lerp(1, s1, m);
  const ox = lerp(0, ox1, m), oy = lerp(0, oy1, m);

  return (
    <AbsoluteFill>
      {/* board backdrop with a faint grid */}
      <AbsoluteFill style={{ opacity: m, background: color.board, backgroundImage: `linear-gradient(${LINE}55 1px, transparent 1px), linear-gradient(90deg, ${LINE}55 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />
      <AbsoluteFill style={{ opacity: m, background: "radial-gradient(90% 80% at 20% 10%, rgba(255,178,36,0.06) 0%, rgba(0,0,0,0) 55%)" }} />
      {/* presenter */}
      <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", borderRadius: 30 * m, boxSizing: "border-box",
        border: m > 0.02 ? `${5 * m}px solid ${FRAME_WHITE}` : "none", boxShadow: m > 0.02 ? `0 40px 90px rgba(0,0,0,${0.55 * m})` : "none", background: "#000" }}>
        <Video src={staticFile(presenter.src)} muted style={{ position: "absolute", left: ox - 5 * m, top: oy - 5 * m, width: 1920 * s, height: 1080 * s }} objectFit="fill" />
      </div>
      {/* camera tag on the card */}
      <div style={{ position: "absolute", left: R.x + 6, top: R.y - 34, opacity: content, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ width: 9, height: 9, borderRadius: 5, background: color.negative }} />
        <LogLabel tone="muted">CAM 01 · {tc(event.start + frame / fps)}</LogLabel>
      </div>
      {/* boards: the outgoing one lifts away while the next one settles */}
      {si > 0 && swap < 1 ? <BoardLayer key={`b${si - 1}`} scn={prev} first={si - 1 === 0} L={L} content={content} o={1 - swap} dy={-swap * 30} /> : null}
      <BoardLayer key={`b${si}`} scn={sc} first={si === 0} L={L} content={content} o={swap} dy={(1 - swap) * 30} />
    </AbsoluteFill>
  );
};
