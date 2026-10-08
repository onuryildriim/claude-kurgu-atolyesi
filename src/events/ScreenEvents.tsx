// the framed screen-recording layout
// (white-framed card + presenter box on a dark backdrop), the cold-open hook with a rolling counter,
// kinetic "sticker" words, chapter cards and a two-column comparison panel.
// Everything is a pure function of the frame; all surfaces are opaque (HLG blending, see theme.ts).
import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { color, font, space, type } from "../theme/theme";
import type { EventOf } from "../plan/schema";
import { Kicker, Panel, Reveal, useLocal } from "./shared";
import { Marker } from "./TextEvents";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const back = Easing.bezier(0.34, 1.56, 0.64, 1); // small overshoot for pops

const FRAME_WHITE = "#FFFFFF";
const BORDER = 5;
const REC_ASPECT = 1928 / 1080; // all screen recordings of this project

/** 0→1 over `sec` starting at local frame `at`. */
const useP = (at: number, sec: number, ease = outExpo) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [at, at + sec * fps], [0, 1], { ...clamp, easing: ease });
};

/** Exit envelope of the whole event (1 → 0 in the last `sec`). */
const useExit = (sec = 0.32) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - sec * fps, durationInFrames - 1], [1, 0], { ...clamp, easing: Easing.bezier(0.4, 0, 1, 1) });
};

const Backdrop: React.FC<{ opacity: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <AbsoluteFill style={{ opacity, background: "radial-gradient(120% 90% at 18% 0%, #243042 0%, #161D28 45%, #0B0F15 100%)", color: color.text }}>
    {children}
  </AbsoluteFill>
);

// ── camera over a recording ─────────────────────────────────────────────────────────────────────
type Cam = { zoom: number; cx: number; cy: number };
const useCamera = (keys: { at: number; zoom: number; cx: number; cy: number }[]): Cam => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let prev: Cam = { zoom: 1, cx: 0.5, cy: 0.5 };
  let cur: Cam = prev;
  let from = -1;
  for (const k of keys) {
    if (k.at > frame) break;
    prev = cur;
    cur = { zoom: k.zoom, cx: k.cx, cy: k.cy };
    from = k.at;
  }
  if (from < 0) return cur;
  const p = interpolate(frame, [from, from + 0.85 * fps], [0, 1], { ...clamp, easing: inOut });
  const lz = Math.exp(Math.log(prev.zoom) + (Math.log(cur.zoom) - Math.log(prev.zoom)) * p); // zoom feels linear in log space
  return { zoom: lz, cx: prev.cx + (cur.cx - prev.cx) * p, cy: prev.cy + (cur.cy - prev.cy) * p };
};

/** Maps recording fractions to card pixels for the current camera. */
const project = (W: number, H: number, cam: Cam) => {
  const vh0 = Math.max(H, W / REC_ASPECT);
  const vw0 = vh0 * REC_ASPECT;
  const vw = vw0 * cam.zoom, vh = vh0 * cam.zoom;
  const ox = Math.min(0, Math.max(W - vw, W / 2 - cam.cx * vw));
  const oy = Math.min(0, Math.max(H - vh, H / 2 - cam.cy * vh));
  return { vw, vh, ox, oy, x: (fx: number) => ox + fx * vw, y: (fy: number) => oy + fy * vh };
};

const ClipLayer: React.FC<{ src: string; trimStart: number; rate: number; fade: boolean; style: React.CSSProperties }> = ({ src, trimStart, rate, fade, style }) => {
  const { fps } = useVideoConfig();
  const p = useP(0, 0.22, inOut);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade ? p : 1 }}>
      <Video src={staticFile(src)} muted trimBefore={Math.round(trimStart * fps)} playbackRate={rate} style={style} objectFit="fill" />
    </div>
  );
};

const HighlightBox: React.FC<{ at: number; until?: number; left: number; top: number; width: number; height: number; label?: string; cardH: number }> = ({ at, until, left, top, width, height, label, cardH }) => {
  const p = useP(at, 0.45, back);
  const out = useP(until ?? 1e9, 0.25, inOut);
  const o = Math.min(interpolate(p, [0, 0.4], [0, 1], clamp), 1 - out);
  if (o <= 0) return null;
  const s = 1.18 - 0.18 * p;
  const labelBelow = top < 90;
  return (
    <div style={{ position: "absolute", left, top, width, height, opacity: o }}>
      <div style={{ position: "absolute", inset: -8, border: `5px solid ${color.accent}`, borderRadius: 14, scale: String(s), boxShadow: "0 0 0 3px rgba(0,0,0,0.25)" }} />
      {label ? (
        <div style={{ position: "absolute", left: "50%", [labelBelow ? "top" : "bottom"]: `calc(100% + 18px)`, translate: `-50% ${(1 - p) * (labelBelow ? -10 : 10)}px`, whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 10, background: color.accent, color: color.accentInk, ...type.body, fontSize: 26, fontWeight: 800, maxWidth: cardH * 2 }}>
          {label}
        </div>
      ) : null}
    </div>
  );
};

const Badge: React.FC<{ at: number; value: string; label: string; op: string; emphasis: boolean; width: number }> = ({ at, value, label, op, emphasis, width }) => {
  const p = useP(at, 0.5, back);
  const o = interpolate(p, [0, 0.35], [0, 1], clamp);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space.md, width, opacity: o, translate: `${(1 - p) * 40}px 0px`, scale: String(0.92 + 0.08 * p) }}>
      <span style={{ width: 34, textAlign: "center", ...type.number, fontSize: 44, color: color.textMuted, flex: "none" }}>{op}</span>
      <div style={{ flex: 1, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: space.md, padding: "12px 20px", borderRadius: 16,
        background: emphasis ? color.accent : color.ink, color: emphasis ? color.accentInk : color.text, border: `2px solid ${emphasis ? color.accent : "#2E3746"}`, boxShadow: "0 12px 30px rgba(0,0,0,0.35)" }}>
        <span style={{ ...type.number, fontSize: emphasis ? 44 : 36, letterSpacing: -1, whiteSpace: "nowrap" }}>{value}</span>
        <span style={{ ...type.small, fontSize: 19, fontWeight: 700, opacity: emphasis ? 0.85 : 0.75, textAlign: "right" }}>{label}</span>
      </div>
    </div>
  );
};

const PromptCard: React.FC<{ at: number; label: string; text: string; typeSeconds: number; width: number }> = ({ at, label, text, typeSeconds, width }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = useP(at, 0.5, back);
  const typeStart = at + Math.round(0.35 * fps);
  const n = Math.round(interpolate(frame, [typeStart, typeStart + typeSeconds * fps], [0, text.length], clamp));
  const caretOn = n < text.length || Math.floor((frame - typeStart) / (0.5 * fps)) % 2 === 0;
  if (p <= 0) return null;
  return (
    <div style={{ width, opacity: interpolate(p, [0, 0.3], [0, 1], clamp), translate: `0px ${(1 - p) * 60}px`, scale: String(0.94 + 0.06 * p), padding: "22px 30px 26px", borderRadius: 22,
      background: "#0E1117", border: `3px solid ${color.accent}`, boxShadow: "0 30px 70px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", gap: 12 }}>
      <Kicker>{label}</Kicker>
      <div style={{ ...type.body, fontSize: 27, lineHeight: 1.42, whiteSpace: "pre-wrap", color: color.text }}>
        <span>{text.slice(0, n)}</span>
        <span style={{ display: "inline-block", width: 3, height: 30, marginLeft: 2, translate: "0px 5px", background: caretOn ? color.accent : "transparent" }} />
        <span style={{ color: "transparent" }}>{text.slice(n)}</span>
      </div>
    </div>
  );
};

const FULL = { x: 170, y: 160, w: 1580, h: 889 };
const WITH_PIP = { x: 56, y: 172, w: 1248, h: 702 };
const PIP_BOX = { x: 1346, y: 172, w: 518, h: 470 };
const WITH_TREE = { x: 56, y: 172, w: 1292, h: 727 };
const TREE_BOX = { x: 1384, y: 172, w: 480 };

// v2: the section's persistent device — the project's file tree, the file being discussed highlighted
type TreeT = NonNullable<EventOf<"screen">["content"]["tree"]>;
const FileTree: React.FC<{ tree: TreeT; local: (s: number) => number; o: number }> = ({ tree, local, o }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let act: string | null = null, actAt = 0;
  for (const a of tree.active) if (local(a.at) <= frame) { act = a.key; actAt = local(a.at); }
  const flash = interpolate(frame, [actAt, actAt + 0.5 * fps], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: TREE_BOX.x, top: TREE_BOX.y, width: TREE_BOX.w, opacity: o, translate: `${(1 - o) * 60}px 0px`, padding: "22px 24px", boxSizing: "border-box", borderRadius: 22,
      background: color.ink, border: "1px solid #2A2E37", boxShadow: "0 30px 70px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ ...type.log, color: color.accent, marginBottom: 10 }}>{tree.title}</div>
      {tree.items.map((it) => <TreeRow key={it.key} it={it} at={local(it.at)} on={it.key === act} flash={flash} />)}
    </div>
  );
};

const TreeRow: React.FC<{ it: TreeT["items"][number]; at: number; on: boolean; flash: number }> = ({ it, at, on, flash }) => {
  const p = useP(at, 0.45);
  return (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "4px 10px", paddingLeft: 10 + it.depth * 22, borderRadius: 9,
            background: on ? `rgba(255,178,36,${0.1 + 0.1 * (1 - flash)})` : "transparent", opacity: interpolate(p, [0, 0.4], [0, 1], clamp), translate: `${(1 - p) * 14}px 0px`,
            fontFamily: font.mono, fontWeight: on ? 700 : 500, fontSize: 18, color: on ? color.accent : it.folder ? color.text : color.textMuted, whiteSpace: "nowrap" }}>
            {on ? <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 4, borderRadius: 2, background: color.accent }} /> : null}
            <span style={{ color: it.folder ? color.accent : "inherit", width: 14 }}>{it.folder ? "▾" : "·"}</span>{it.label}
          </div>
  );
};

const SkipCard: React.FC<{ at: number; until: number; kicker: string; text: string }> = ({ at, until, kicker, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = useP(at, 0.5, back);
  const out = interpolate(frame, [until, until + 0.3 * fps], [0, 1], clamp);
  const o = interpolate(p, [0, 0.3], [0, 1], clamp) * (1 - out);
  if (o <= 0) return null;
  const run = ((frame - at) / fps) * 1.6;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, padding: "30px 44px", borderRadius: 26, background: "rgba(15,17,21,0.96)", border: `2px solid ${color.accent}`, boxShadow: "0 40px 90px rgba(0,0,0,0.6)", scale: String(0.92 + 0.08 * p) }}>
        <div style={{ display: "flex" }}>
          {[0, 1].map((i) => (
            <svg key={i} width={46} height={52} viewBox="0 0 46 52" style={{ marginLeft: i ? -14 : 0, opacity: 0.45 + 0.55 * Math.max(0, Math.sin((run - i * 0.25) * Math.PI)) }}>
              <path d="M6 6 L40 26 L6 46 Z" fill={color.accent} />
            </svg>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...type.log, color: color.accent }}>{kicker}</div>
          <div style={{ ...type.headline, fontSize: 46 }}>{text}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Title of a long screen event: later titles slide in over the previous one (same slot, nothing else moves). */
const TitleSwap: React.FC<{ titles: { at: number; kicker: string; title: string }[] }> = ({ titles }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let i = 0;
  while (i + 1 < titles.length && titles[i + 1].at <= frame) i++;
  const cur = titles[i];
  const p = i === 0 ? 1 : interpolate(frame, [cur.at, cur.at + 0.55 * fps], [0, 1], { ...clamp, easing: outExpo });
  const prev = i > 0 ? titles[i - 1] : null;
  const row = (tt: { kicker: string; title: string }, o: number, dy: number) => (
    <div style={{ position: "absolute", left: 0, top: 0, display: "flex", flexDirection: "column", gap: 6, whiteSpace: "nowrap", opacity: o, translate: `0px ${dy}px` }}>
      <Kicker>{tt.kicker}</Kicker>
      <div style={{ ...type.headline, fontSize: 50, whiteSpace: "nowrap" }}>{tt.title}</div>
    </div>
  );
  return (
    <>
      {prev && p < 1 ? row(prev, 1 - p, -p * 40) : null}
      {row(cur, p, (1 - p) * 40)}
    </>
  );
};

export const Screen: React.FC<{ event: EventOf<"screen"> }> = ({ event }) => {
  const local = useLocal(event);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { kicker, title, titles, clips, camera, highlights, badges, prompts, pip, note, instantBg, tree, skips } = event.content;
  const inBgFade = useP(0, 0.28, inOut);
  const inBg = instantBg ? 1 : inBgFade;
  const inCard = useP(Math.round(0.06 * fps), 0.7);
  const inTitle = useP(Math.round(0.18 * fps), 0.6);
  const exit = useExit();
  const cam = useCamera(camera.map((k) => ({ ...k, at: local(k.at) })));

  // how much room the presenter box has: 0 = full-width card, 1 = card left + box right
  const pipAt = pip?.at === undefined ? Math.round(0.22 * fps) : local(pip.at);
  const pipIn = pip ? interpolate(frame, [pipAt, pipAt + 0.75 * fps], [0, 1], { ...clamp, easing: inOut }) : 0;
  const pipOut = pip?.until === undefined ? 0 : interpolate(frame, [local(pip.until), local(pip.until) + 0.75 * fps], [0, 1], { ...clamp, easing: inOut });
  const L = pip ? (pip.at === undefined ? 1 - pipOut : pipIn * (1 - pipOut)) : 0;
  const popFrom = pip?.at === undefined ? pipAt : pipAt + Math.round(0.25 * fps);
  const boxPop = pip ? interpolate(frame, [popFrom, popFrom + 0.6 * fps], [0, 1], { ...clamp, easing: back }) * (1 - pipOut) : 0;
  const treeIn = tree ? interpolate(frame, [Math.round(0.2 * fps), Math.round(0.95 * fps)], [0, 1], { ...clamp, easing: inOut }) : 0;
  const treeOut = tree?.until === undefined ? 0 : interpolate(frame, [local(tree.until), local(tree.until) + 0.75 * fps], [0, 1], { ...clamp, easing: inOut });
  const T = tree ? treeIn * (1 - treeOut) : 0;
  const card = pip
    ? { x: lerp(FULL.x, WITH_PIP.x, L), y: lerp(FULL.y, WITH_PIP.y, L), w: lerp(FULL.w, WITH_PIP.w, L), h: lerp(FULL.h, WITH_PIP.h, L) }
    : { x: lerp(FULL.x, WITH_TREE.x, T), y: lerp(FULL.y, WITH_TREE.y, T), w: lerp(FULL.w, WITH_TREE.w, T), h: lerp(FULL.h, WITH_TREE.h, T) };
  const pr = project(card.w - 2 * BORDER, card.h - 2 * BORDER, cam);
  const allTitles = [{ at: 0, kicker, title }, ...titles.map((x) => ({ ...x, at: local(x.at) }))];

  return (
    <Backdrop opacity={Math.min(inBg, exit)}>
      <div style={{ position: "absolute", left: card.x + 4, top: card.y - 104, opacity: inTitle * exit, translate: `${(1 - inTitle) * -30}px 0px` }}>
        <TitleSwap titles={allTitles} />
      </div>
      {/* the framed recording */}
      <div style={{ position: "absolute", left: card.x, top: card.y, width: card.w, height: card.h, boxSizing: "border-box", border: `${BORDER}px solid ${FRAME_WHITE}`, borderRadius: 30,
        overflow: "hidden", background: "#fff", boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
        opacity: interpolate(inCard, [0, 0.25], [0, 1], clamp), translate: `0px ${(1 - inCard) * 60 + (1 - exit) * 30}px`, scale: String((0.9 + 0.1 * inCard) * (0.96 + 0.04 * exit)) }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 25, overflow: "hidden" }}>
          {clips.map((c, i) => {
            const from = local(c.at);
            const next = clips[i + 1] ? local(clips[i + 1].at) : durationInFrames;
            return (
              <Sequence key={`${c.src}-${c.at}`} from={from} durationInFrames={Math.max(1, next - from + Math.round(0.25 * fps))} layout="none">
                <ClipLayer src={c.src} trimStart={c.trimStart} rate={c.rate} fade={i > 0} style={{ position: "absolute", left: pr.ox, top: pr.oy, width: pr.vw, height: pr.vh }} />
              </Sequence>
            );
          })}
          {highlights.map((h) => (
            <HighlightBox key={`${h.at}-${h.x}`} at={local(h.at)} until={h.until === undefined ? undefined : local(h.until)} left={pr.x(h.x)} top={pr.y(h.y)} width={h.w * pr.vw} height={h.h * pr.vh} label={h.label} cardH={card.h} />
          ))}
        </div>
      </div>
      {/* presenter box */}
      {pip && boxPop > 0 ? (
        <div style={{ position: "absolute", left: PIP_BOX.x, top: PIP_BOX.y, width: PIP_BOX.w, height: PIP_BOX.h, boxSizing: "border-box", border: `${BORDER}px solid ${FRAME_WHITE}`, borderRadius: 30, overflow: "hidden",
          background: "#000", boxShadow: "0 30px 70px rgba(0,0,0,0.5)", opacity: interpolate(boxPop, [0, 0.3], [0, 1], clamp) * exit, scale: String(0.82 + 0.18 * boxPop), translate: `${(1 - boxPop) * 50}px 0px` }}>
          <Video src={staticFile(pip.src)} muted style={{ width: "100%", height: "100%" }} objectFit="cover" />
        </div>
      ) : null}
      {/* badges in fixed slots: under the presenter box, or bottom-right over the card */}
      {badges.map((b, i) => {
        const slot = b.slot ?? i;
        const w = L > 0.5 ? PIP_BOX.w + 50 : 600;
        const pos = L > 0.5 ? { left: PIP_BOX.x - 50, top: PIP_BOX.y + PIP_BOX.h + 26 + slot * 84 } : { left: card.x + card.w - w - 30, top: card.y + card.h - 30 - (slot + 1) * 84 };
        return (
          <div key={`${b.at}-${b.value}`} style={{ position: "absolute", ...pos, opacity: exit * (b.until === undefined ? 1 : 1 - interpolate(frame, [local(b.until), local(b.until) + 0.25 * fps], [0, 1], clamp)) }}>
            <Badge at={local(b.at)} value={b.value} label={b.label} op={b.op} emphasis={b.emphasis} width={w} />
          </div>
        );
      })}
      {prompts.map((pc) => (
        <div key={pc.at} style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center",
          opacity: exit * (1 - interpolate(frame, [local(pc.until), local(pc.until) + 0.3 * fps], [0, 1], clamp)) }}>
          <PromptCard at={local(pc.at)} label={pc.label} text={pc.text} typeSeconds={pc.typeSeconds} width={1240} />
        </div>
      ))}
      {note ? <div style={{ position: "absolute", left: card.x + 6, top: card.y + card.h + 14, ...type.note, color: color.textMuted, opacity: inTitle * exit }}>{note}</div> : null}
      {tree && T > 0 ? <FileTree tree={tree} local={local} o={T * exit} /> : null}
      {skips.map((sk) => <SkipCard key={sk.at} at={local(sk.at)} until={local(sk.until)} kicker={sk.kicker} text={sk.text} />)}
    </Backdrop>
  );
};

// ── cold open ───────────────────────────────────────────────────────────────────────────────────
const DIGIT_H = 232;
const Odometer: React.FC<{ value: number; at: number; seconds: number; sep: string }> = ({ value, at, seconds, sep }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at, at + seconds * fps], [0, 1], { ...clamp, easing: Easing.bezier(0.12, 0.8, 0.2, 1) });
  const v = value * p;
  const digits = String(value).length;
  const cols: React.ReactNode[] = [];
  for (let k = digits - 1; k >= 0; k--) {
    const place = 10 ** k;
    // continuous position of this column; the final state lands exactly on the digit
    const pos = p >= 1 ? Math.floor(value / place) % 10 : (v / place) % 10;
    cols.push(
      <div key={k} style={{ height: DIGIT_H, width: 132, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: -pos * DIGIT_H, left: 0, right: 0 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
            <div key={i} style={{ height: DIGIT_H, display: "grid", placeItems: "center" }}>{d}</div>
          ))}
        </div>
      </div>,
    );
    if (k % 3 === 0 && k > 0) cols.push(<div key={`dot${k}`} style={{ width: 44, textAlign: "center" }}>{sep}</div>);
  }
  return <div style={{ display: "flex", alignItems: "center", ...type.number, fontSize: 250, lineHeight: `${DIGIT_H}px`, letterSpacing: -6, color: color.accent }}>{cols}</div>;
};

const LineIcon: React.FC<{ icon: "box" | "truck" | "file"; tone: "no" | "yes"; strike: number }> = ({ icon, tone, strike }) => {
  const c = tone === "no" ? color.text : color.accentInk;
  return (
    <div style={{ width: 78, height: 78, borderRadius: 18, flex: "none", display: "grid", placeItems: "center", background: tone === "no" ? color.inkRaised : color.accent, position: "relative" }}>
      <svg width={46} height={46} viewBox="0 0 46 46" fill="none" stroke={c} strokeWidth={3.4} strokeLinejoin="round" strokeLinecap="round">
        {icon === "box" ? (<><path d="M6 14 L23 6 L40 14 L40 34 L23 42 L6 34 Z" /><path d="M6 14 L23 22 L40 14 M23 22 V42" /></>) : null}
        {icon === "truck" ? (<><path d="M3 12 H28 V32 H3 Z" /><path d="M28 18 H37 L43 25 V32 H28" /><circle cx={11} cy={35} r={4} fill={color.inkRaised} /><circle cx={35} cy={35} r={4} fill={color.inkRaised} /></>) : null}
        {icon === "file" ? (<><path d="M11 4 H28 L37 13 V42 H11 Z" /><path d="M28 4 V13 H37" /><path d="M17 26 L22 31 L31 20" /></>) : null}
      </svg>
      {tone === "no" ? <div style={{ position: "absolute", width: 96 * strike, height: 6, borderRadius: 3, background: color.negative, rotate: "-40deg" }} /> : null}
    </div>
  );
};

const HookLine: React.FC<{ at: number; icon: "box" | "truck" | "file"; text: string; tone: "no" | "yes" }> = ({ at, icon, text, tone }) => {
  const { fps } = useVideoConfig();
  const p = useP(at, 0.55, back);
  const strike = useP(at + Math.round(0.42 * fps), 0.35, inOut);
  const o = interpolate(p, [0, 0.3], [0, 1], clamp);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 26px 14px 14px", borderRadius: 24, background: tone === "yes" ? color.ink : color.ink,
      border: `2px solid ${tone === "yes" ? color.accent : "#2E3746"}`, boxShadow: "0 18px 40px rgba(0,0,0,0.4)", opacity: o, translate: `${(1 - p) * 90}px 0px`, rotate: `${(1 - p) * 4}deg`, width: "fit-content" }}>
      <LineIcon icon={icon} tone={tone} strike={strike} />
      <span style={{ position: "relative", ...type.headline, fontSize: 46, whiteSpace: "nowrap", color: tone === "no" ? `color-mix(in srgb, ${color.text} ${100 - strike * 35}%, ${color.textMuted})` : color.text }}>
        {text}
        {tone === "no" ? <span style={{ position: "absolute", left: -6, top: "54%", height: 6, borderRadius: 3, background: color.negative, width: `calc(${strike * 100}% + ${strike * 12}px)` }} /> : null}
      </span>
    </div>
  );
};

export const Hook: React.FC<{ event: EventOf<"hook"> }> = ({ event }) => {
  const local = useLocal(event);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { kicker, value, prefix, suffix, label, countAt, revealAt, bg, chips, lines, locale } = event.content;
  const sep = locale === "en" ? "," : ".";
  const reveal = local(revealAt);
  const wipe = interpolate(frame, [reveal, reveal + 0.5 * fps], [0, 1], { ...clamp, easing: inOut });
  const intro = useP(0, 0.5);
  const exit = useExit(0.35);
  const slowZoom = interpolate(frame, [0, reveal + 0.5 * fps], [1.12, 1.24], clamp);
  const suffixIn = useP(local(countAt) + Math.round(0.9 * fps), 0.45, back);
  const labelIn = useP(local(countAt) + Math.round(1.05 * fps), 0.5);
  return (
    <AbsoluteFill>
      {/* phase A: full-screen counter; wiped away upwards at revealAt */}
      {wipe < 1 ? (
        <AbsoluteFill style={{ clipPath: `inset(0px 0px ${wipe * 100}% 0px)`, background: color.backdrop }}>
          <AbsoluteFill style={{ scale: String(slowZoom), filter: "blur(7px) saturate(0.9)" }}>
            <Video src={staticFile(bg.src)} muted trimBefore={Math.round(bg.trimStart * fps)} style={{ width: "100%", height: "100%" }} objectFit="cover" />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: "radial-gradient(70% 70% at 50% 50%, rgba(8,10,14,0.72) 0%, rgba(8,10,14,0.9) 100%)" }} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, translate: `0px ${-wipe * 120}px`, opacity: intro }}>
            <div style={{ ...type.kicker, fontSize: 30, letterSpacing: 8, color: color.text, opacity: intro }}>{kicker}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 26, scale: String(0.9 + 0.1 * intro) }}>
              {prefix ? <span style={{ ...type.number, fontSize: 200, color: color.accent, marginRight: -10 }}>{prefix}</span> : null}
              <Odometer value={value} at={local(countAt)} seconds={1.2} sep={sep} />
              <span style={{ ...type.number, fontSize: 150, color: color.text, opacity: suffixIn, translate: `${(1 - suffixIn) * 30}px 0px` }}>{suffix}</span>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", opacity: labelIn, translate: `0px ${(1 - labelIn) * 20}px` }}>
              <span style={{ ...type.headline, fontSize: 58, letterSpacing: 10, color: color.text }}>{label}</span>
              {chips.map((c) => (
                <span key={c} style={{ padding: "8px 18px", borderRadius: 999, background: color.inkRaised, border: "2px solid #2E3746", ...type.body, fontWeight: 700 }}>{c}</span>
              ))}
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}
      {/* phase B: claims beside the presenter */}
      <div style={{ position: "absolute", right: 58, top: 250, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 22, opacity: exit, translate: `${(1 - exit) * 40}px 0px` }}>
        {lines.map((l) => (
          <HookLine key={l.text} at={local(l.at)} icon={l.icon} text={l.text} tone={l.tone} />
        ))}
      </div>
      {/* the figure stays as a compact tag after the wipe */}
      {wipe > 0 ? (
        <div style={{ position: "absolute", right: 58, top: 120, display: "flex", alignItems: "baseline", gap: 12, padding: "12px 22px", borderRadius: 16, background: color.accent, color: color.accentInk,
          opacity: interpolate(wipe, [0.5, 1], [0, 1], clamp) * exit, translate: `0px ${(1 - wipe) * -20}px` }}>
          <span style={{ ...type.number, fontSize: 46 }}>{prefix}{value.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}{suffix ? ` ${suffix}` : ""}</span>
          <span style={{ ...type.kicker, fontSize: 20 }}>{label}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── kinetic words ───────────────────────────────────────────────────────────────────────────────
const Sticker: React.FC<{ at: number; text: string; accent: boolean; align: "left" | "right"; locale: "tr" | "en" }> = ({ at, text, accent, align, locale }) => {
  const p = useP(at, 0.5, outExpo);
  const pop = useP(at, 0.55, back);
  const reveal = align === "right" ? `inset(0px 0px 0px ${(1 - p) * 100}%)` : `inset(0px ${(1 - p) * 100}% 0px 0px)`;
  return (
    <div style={{ clipPath: reveal, scale: String(0.9 + 0.1 * pop), transformOrigin: align === "right" ? "right center" : "left center", padding: "10px 26px 14px", borderRadius: 18,
      background: accent ? color.accent : color.ink, color: accent ? color.accentInk : color.text, boxShadow: "0 16px 36px rgba(0,0,0,0.4)", width: "fit-content",
      ...type.headline, fontSize: 70, letterSpacing: -1, whiteSpace: "nowrap" }}>
      {text.toLocaleUpperCase(locale === "en" ? "en-US" : "tr-TR")}
    </div>
  );
};

export const Punch: React.FC<{ event: EventOf<"punch"> }> = ({ event }) => {
  const local = useLocal(event);
  const exit = useExit(0.28);
  const align = event.side === "left" ? "left" : "right";
  return (
    <div style={{ position: "absolute", top: 150, [align]: 58, display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : "flex-start", gap: 14, opacity: exit, translate: `0px ${(1 - exit) * -24}px` }}>
      {event.content.lines.map((l) => (
        <Sticker key={l.text} at={local(l.at)} text={l.text} accent={l.accent} align={align} locale={event.content.locale} />
      ))}
    </div>
  );
};

// ── chapter card ────────────────────────────────────────────────────────────────────────────────
export const Chapter: React.FC<{ event: EventOf<"chapter"> }> = ({ event }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { index, title, sub, cutOut } = event.content;
  const sweep = interpolate(frame, [0, 0.42 * fps], [0, 1], { ...clamp, easing: inOut });
  const out = cutOut ? 0 : interpolate(frame, [durationInFrames - 0.4 * fps, durationInFrames - 1], [0, 1], { ...clamp, easing: inOut });
  const words = title.split(" ");
  return (
    <AbsoluteFill style={{ clipPath: `inset(${out * 100}% 0px 0px 0px)` }}>
      <AbsoluteFill style={{ background: color.accent, clipPath: `inset(0px ${(1 - sweep) * 100}% 0px 0px)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 18% 0%, #243042 0%, #161D28 45%, #0B0F15 100%)", clipPath: `inset(0px ${(1 - interpolate(frame, [0.12 * fps, 0.55 * fps], [0, 1], { ...clamp, easing: inOut })) * 100}% 0px 0px)` }} />
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 170, gap: 18 }}>
        <div style={{ ...type.number, fontSize: 64, color: color.accent, opacity: interpolate(frame, [0.35 * fps, 0.6 * fps], [0, 1], clamp) }}>{index}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 30px", maxWidth: 1600 }}>
          {words.map((w, i) => {
            const p = interpolate(frame, [(0.4 + i * 0.09) * fps, (0.9 + i * 0.09) * fps], [0, 1], { ...clamp, easing: outExpo });
            return (
              <span key={`${w}${i}`} style={{ overflow: "hidden", display: "inline-block", paddingBottom: 12 }}>
                <span style={{ display: "inline-block", ...type.headline, fontSize: 150, lineHeight: 1.02, letterSpacing: -3, color: color.text, translate: `0px ${(1 - p) * 110}%` }}>{w}</span>
              </span>
            );
          })}
        </div>
        {sub ? <div style={{ ...type.body, fontSize: 36, color: color.textMuted, opacity: interpolate(frame, [0.8 * fps, 1.1 * fps], [0, 1], clamp) }}>{sub}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── comparison panel ────────────────────────────────────────────────────────────────────────────
const ColumnHead: React.FC<{ at: number; title: string; good: boolean }> = ({ at, title, good }) => {
  const p = useP(at, 0.45, back);
  return (
    <div style={{ opacity: interpolate(p, [0, 0.3], [0, 1], clamp), scale: String(0.9 + 0.1 * p), padding: "8px 14px", borderRadius: 12, textAlign: "center",
      background: good ? color.accent : color.inkRaised, color: good ? color.accentInk : color.text, border: `1px solid ${good ? color.accent : color.line}`, ...type.body, fontWeight: 800 }}>
      {title}
    </div>
  );
};

export const Compare: React.FC<{ event: EventOf<"compare"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, left, right, footer } = event.content;
  const col = (c: typeof left, good: boolean) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <ColumnHead at={local(c.at)} title={c.title} good={good} />
      {c.items.map((it) => (
        <Reveal key={it.text} at={local(it.at)} gap={space.md} style={{ display: "flex", gap: space.sm, ...type.small, fontSize: 23, fontWeight: 700 }}>
          <Marker kind={good ? "check" : "minus"} />
          <span>{it.text}</span>
        </Reveal>
      ))}
    </div>
  );
  return (
    <Panel side={event.side === "left" ? "left" : "right"} width={560}>
      <Kicker>{kicker}</Kicker>
      <div style={{ display: "flex", gap: space.lg, alignItems: "flex-start" }}>
        {col(left, false)}
        {col(right, true)}
      </div>
      {footer ? (
        <div style={{ marginTop: -space.md }}>
          <Reveal at={local(footer.at)} gap={space.md} style={{ ...type.title, fontSize: 34, color: color.accent, fontFamily: font.display }}>
            {footer.text}
          </Reveal>
        </div>
      ) : null}
    </Panel>
  );
};

