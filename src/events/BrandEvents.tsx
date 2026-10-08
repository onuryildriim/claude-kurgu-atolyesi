// Brand pieces: kinetic thesis lines (L5), the channel's subscribe / bell /
// like lower-third (avatar + cursor that presses the buttons), and the log-layer chapter tag.
// Pure functions of the frame. The base is SDR here, so the scrim may be translucent.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { color, type } from "../theme/theme";
import type { EventOf } from "../plan/schema";
import { useLocal } from "./shared";
import { LogLabel, useP } from "./StageEvents";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const back = Easing.bezier(0.34, 1.5, 0.64, 1);

const useEnds = (inSec = 0.35, outSec = 0.3) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const a = interpolate(frame, [0, inSec * fps], [0, 1], { ...clamp, easing: inOut });
  const z = interpolate(frame, [durationInFrames - outSec * fps, durationInFrames - 1], [1, 0], { ...clamp, easing: inOut });
  return Math.min(a, z);
};

// ── kinetic thesis ──────────────────────────────────────────────────────────────────────────────
const Word: React.FC<{ at: number; text: string; accent: boolean; dim: number }> = ({ at, text, accent, dim }) => {
  const p = useP(at, 0.55);
  return (
    <span style={{ display: "inline-block", overflow: "hidden", paddingBottom: 10, marginBottom: -10 }}>
      <span style={{ display: "inline-block", translate: `0px ${(1 - p) * 105}%`, color: accent ? color.accent : dim > 0 ? `color-mix(in srgb, ${color.text} ${100 - dim * 60}%, ${color.dim})` : color.text }}>{text}</span>
    </span>
  );
};

export const Kinetic: React.FC<{ event: EventOf<"kinetic"> }> = ({ event }) => {
  const L = useLocal(event);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = useEnds(0.4, 0.35);
  const { kicker, lines, align } = event.content;
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ background: "rgba(9,10,13,0.86)" }} />
      <AbsoluteFill style={{ alignItems: align === "center" ? "center" : "flex-start", justifyContent: "center", padding: "0 150px", flexDirection: "column", gap: 18 }}>
        {kicker ? <LogLabel style={{ fontSize: 20, marginBottom: 16 }}>{`// ${kicker}`}</LogLabel> : null}
        {lines.map((l) => {
          const words = l.text.split(" ");
          const dim = l.dimAt === undefined ? 0 : interpolate(frame, [L(l.dimAt), L(l.dimAt) + 0.4 * fps], [0, 1], clamp);
          return (
            <div key={l.text} style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: "0 26px", ...type.headline, fontSize: 92, lineHeight: 1.08, letterSpacing: -2.4, maxWidth: 1620, textAlign: align }}>
              {words.map((w, i) => (
                <Word key={`${w}${i}`} at={L(l.at) + Math.round(i * 0.07 * fps)} text={w} accent={l.accent.some((a) => w.replace(/[.,!?;:]/g, "").toLocaleLowerCase("tr-TR") === a.toLocaleLowerCase("tr-TR"))} dim={dim} />
              ))}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── subscribe / bell / like ─────────────────────────────────────────────────────────────────────
const Cursor: React.FC<{ x: number; y: number; press: number }> = ({ x, y, press }) => (
  <svg width={44} height={52} viewBox="0 0 44 52" style={{ position: "absolute", left: x, top: y, scale: String(1 - press * 0.14), transformOrigin: "6px 4px", filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))" }}>
    <path d="M6 4 L6 40 L15 31 L21 46 L28 43 L22 28 L35 28 Z" fill="#FFFFFF" stroke="#111" strokeWidth={2.5} strokeLinejoin="round" />
  </svg>
);

const Bell: React.FC<{ on: number; ring: number }> = ({ on, ring }) => (
  <svg width={34} height={34} viewBox="0 0 34 34" style={{ rotate: `${Math.sin(ring * Math.PI * 6) * 18 * (1 - ring)}deg` }}>
    <path d="M17 4 C11 4 8 9 8 14 V20 L5 25 H29 L26 20 V14 C26 9 23 4 17 4 Z" fill={on > 0.5 ? color.accent : "none"} stroke={on > 0.5 ? color.accent : "#F5F2EA"} strokeWidth={2.6} strokeLinejoin="round" />
    <path d="M13 28 C13.5 30.5 15 31.5 17 31.5 C19 31.5 20.5 30.5 21 28" fill="none" stroke={on > 0.5 ? color.accent : "#F5F2EA"} strokeWidth={2.6} strokeLinecap="round" />
  </svg>
);

const Thumb: React.FC<{ on: number }> = ({ on }) => (
  <svg width={34} height={34} viewBox="0 0 34 34">
    <path d="M4 15 H10 V30 H4 Z M10 15 L16 4 C19 4 20 6 19.5 9 L18.5 13 H27 C29.5 13 31 15 30.5 17.5 L28.5 27 C28 29 26.5 30 24.5 30 H10" fill={on > 0.5 ? color.accent : "none"} stroke={on > 0.5 ? color.accent : "#F5F2EA"} strokeWidth={2.6} strokeLinejoin="round" />
  </svg>
);

export const Subscribe: React.FC<{ event: EventOf<"subscribe"> }> = ({ event }) => {
  const L = useLocal(event);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { name, sub, avatar, avatarFocus, clickAt, bellAt, likeAt } = event.content;
  const o = useEnds(0.45, 0.35);
  const rise = useP(0, 0.6, back);
  const c = L(clickAt), b = L(bellAt), l = L(likeAt);
  const subscribed = interpolate(frame, [c + 3, c + 9], [0, 1], clamp);
  const bellOn = interpolate(frame, [b + 3, b + 6], [0, 1], clamp);
  const ring = interpolate(frame, [b + 3, b + 3 + 0.9 * fps], [0, 1], clamp);
  const likeOn = interpolate(frame, [l + 3, l + 6], [0, 1], clamp);
  const likePop = useP(l + 3, 0.45, back);
  // card geometry (design px) and button targets for the cursor
  const X = 64, Y = 1080 - 64 - 128;
  const btn = { sub: { x: X + 470, y: Y + 66 }, bell: { x: X + 690, y: Y + 66 }, like: { x: X + 768, y: Y + 66 } };
  const path = [
    { t: c - 0.75 * fps, x: X + 980, y: Y + 210 },
    { t: c - 0.05 * fps, ...btn.sub },
    { t: b - 0.05 * fps, ...btn.bell },
    { t: l - 0.05 * fps, ...btn.like },
    { t: l + 0.9 * fps, x: X + 1000, y: Y + 220 },
  ];
  let k = 0;
  while (k + 1 < path.length - 1 && frame >= path[k + 1].t) k++;
  const seg = interpolate(frame, [path[k].t, path[k + 1].t], [0, 1], { ...clamp, easing: inOut });
  const cur = { x: path[k].x + (path[k + 1].x - path[k].x) * seg, y: path[k].y + (path[k + 1].y - path[k].y) * seg };
  const press = Math.max(...[c, b, l].map((t) => interpolate(frame, [t - 2, t + 2, t + 7], [0, 1, 0], clamp)));
  const cursorO = interpolate(frame, [path[0].t, path[0].t + 0.2 * fps, path[4].t - 0.25 * fps, path[4].t], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: X, top: Y, height: 128, display: "flex", alignItems: "center", gap: 22, padding: "0 30px 0 18px", borderRadius: 64, background: "rgba(15,17,21,0.94)", border: "1px solid #2A2E37",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)", translate: `0px ${(1 - rise) * 60}px` }}>
        <div style={{ width: 92, height: 92, borderRadius: 46, overflow: "hidden", border: `3px solid ${color.accent}`, flex: "none", position: "relative" }}>
          <Img src={staticFile(avatar)} style={{ position: "absolute", maxWidth: "none", height: "auto", width: `${avatarFocus.zoom * 100}%`, left: `${(0.5 - avatarFocus.x * avatarFocus.zoom) * 100}%`, top: `${(0.5 - avatarFocus.y * avatarFocus.zoom * (2096 / 1179)) * 100}%` }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 270 }}>
          <div style={{ ...type.headline, fontSize: 36, color: color.text }}>{name}</div>
          <LogLabel tone="muted" style={{ fontSize: 15, textTransform: "none", letterSpacing: 0.4, fontWeight: 500 }}>{sub}</LogLabel>
        </div>
        <div style={{ position: "relative", height: 62, minWidth: 196, padding: "0 26px", borderRadius: 31, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: subscribed > 0.5 ? "#272A31" : "#F5F2EA", color: subscribed > 0.5 ? color.text : "#0F1115", ...type.title, fontSize: 26, scale: String(1 - press * (frame < b - 4 ? 0.06 : 0)) }}>
          {subscribed > 0.5 ? <><span style={{ color: color.accent }}>✓</span> Abone olundu</> : "Abone ol"}
        </div>
        <div style={{ width: 62, height: 62, borderRadius: 31, display: "grid", placeItems: "center", background: "#272A31" }}><Bell on={bellOn} ring={ring} /></div>
        <div style={{ width: 62, height: 62, borderRadius: 31, display: "grid", placeItems: "center", background: "#272A31", scale: String(1 + 0.18 * Math.sin(likePop * Math.PI)) }}><Thumb on={likeOn} /></div>
      </div>
      {cursorO > 0 ? <div style={{ opacity: cursorO }}><Cursor x={cur.x} y={cur.y} press={press} /></div> : null}
    </AbsoluteFill>
  );
};

// ── chapter tag (log layer) ─────────────────────────────────────────────────────────────────────
export const Tag: React.FC<{ event: EventOf<"tag"> }> = ({ event }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = useEnds(0.4, 0.4);
  const pulse = interpolate(frame, [0.1 * fps, 0.9 * fps], [0, 1], clamp);
  const { index, label, total } = event.content;
  return (
    <div style={{ position: "absolute", left: 58, top: 50, opacity: o, translate: `${(1 - o) * -16}px 0px`, display: "flex", alignItems: "center", gap: 14, padding: "12px 20px 12px 16px", borderRadius: 14, background: "rgba(15,17,21,0.82)", border: "1px solid #2A2E37" }}>
      <span style={{ position: "relative", width: 12, height: 12 }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: 6, background: color.accent }} />
        <span style={{ position: "absolute", inset: -10 * pulse, borderRadius: 20, border: `2px solid ${color.accent}`, opacity: 1 - pulse }} />
      </span>
      <LogLabel style={{ fontSize: 17 }}>{total ? `${index} / ${total}` : index}</LogLabel>
      <LogLabel tone="muted" style={{ fontSize: 17, color: color.text }}>{label}</LogLabel>
    </div>
  );
};
