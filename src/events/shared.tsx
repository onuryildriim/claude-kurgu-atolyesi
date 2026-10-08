// Shared building blocks: timing helpers, the panel shell and the "appear" primitive.
// All motion is a pure function of the current frame (no CSS transitions, no wall clock).
import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { color, layout, motion, radius, space, type } from "../theme/theme";
import type { PlanEvent } from "../plan/schema";

const enterEase = Easing.bezier(...motion.bezierEnter);
const exitEase = Easing.bezier(...motion.bezierExit);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Converts an absolute source-timeline second into a frame local to the event's Sequence. */
export const useLocal = (event: PlanEvent) => {
  const { fps } = useVideoConfig();
  return (absSeconds: number) => Math.round((absSeconds - event.start) * fps);
};

/** Entrance/exit envelope of a whole event: 0 → 1 → 0 plus slide progress. */
export const useEnvelope = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, motion.enter * fps], [0, 1], { ...clamp, easing: enterEase });
  const exit = interpolate(frame, [durationInFrames - motion.exit * fps, durationInFrames - 1], [1, 0], { ...clamp, easing: exitEase });
  return { opacity: Math.min(enter, exit), enter };
};

/** Progress 0→1 starting at a local frame (used for items, bars, strokes). */
export const useProgress = (atFrame: number, seconds: number = motion.itemEnter) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [atFrame, atFrame + seconds * fps], [0, 1], { ...clamp, easing: enterEase });
};

/**
 * Reveals children at a local frame. Space is reserved from the start so that text already on
 * screen never moves while the viewer is reading it.
 */
export const Appear: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; rise?: number }> = ({ at, children, style, rise = 10 }) => {
  const p = useProgress(at);
  return <div style={{ opacity: p, translate: `0px ${(1 - p) * rise}px`, ...style }}>{children}</div>;
};

/**
 * Reveals a stacked row by growing it from zero height: the panel extends DOWNWARDS as items
 * arrive, so text that is already on screen never moves and no empty box is shown beforehand.
 */
export const Reveal: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; gap?: number; maxHeight?: number }> = ({ at, children, style, gap = 12, maxHeight = 170 }) => {
  const p = useProgress(at, 0.34);
  return (
    <div style={{ overflow: "hidden", maxHeight: p * maxHeight, marginTop: p * gap, opacity: interpolate(p, [0.35, 1], [0, 1], clamp) }}>
      <div style={style}>{children}</div>
    </div>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: space.sm, color: color.accent, ...type.kicker }}>
    <span style={{ width: 22, height: 4, borderRadius: 2, background: color.accent, flex: "none" }} />
    {children}
  </div>
);

/** Schematic/source note. Sits directly under the title so that it never moves as rows arrive. */
export const Footnote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ ...type.note, color: color.textMuted, marginTop: -space.sm }}>{children}</div>
);

/** Opaque side panel anchored to the verified free area (upper right, or upper left). */
export const Panel: React.FC<{ side: "left" | "right"; children: React.ReactNode; width?: number }> = ({ side, children, width }) => {
  const { opacity, enter } = useEnvelope();
  const w = width ?? (side === "left" ? layout.panelWidthLeft : layout.panelWidth);
  const dir = side === "left" ? -1 : 1;
  return (
    <div
      style={{
        position: "absolute",
        top: layout.panelTop,
        [side]: layout.margin,
        width: w,
        boxSizing: "border-box",
        padding: `${space.lg}px ${space.xl}px ${space.lg + 2}px`,
        background: color.ink,
        border: `1px solid ${color.line}`,
        borderRadius: radius.lg,
        boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
        color: color.text,
        display: "flex",
        flexDirection: "column",
        gap: space.md,
        overflow: "hidden",
        opacity,
        translate: `${(1 - enter) * motion.slide * dir}px 0px`,
      }}
    >
      {children}
    </div>
  );
};
