// Asset-led events. Supplementary videos are ALWAYS muted (their audio is not approved) and are
// the normalised copies from public/derived/assets (CFR 60, BT.709 limited). Proportions are
// preserved; nothing that is being explained is cropped away.
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { color, layout, radius, space, type } from "../theme/theme";
import type { EventOf } from "../plan/schema";
import { Appear, Kicker, useEnvelope, useLocal, useProgress } from "./shared";

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: "fit-content", padding: `${space.sm}px ${space.md}px`, borderRadius: radius.sm, background: color.ink, border: `1px solid ${color.line}`, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
    {children}
  </div>
);

const CARD_W = 470;
const Card: React.FC<{ at: number; src: string; label: string; index: number }> = ({ at, src, label, index }) => {
  const p = useProgress(at, 0.4);
  return (
    <div
      style={{
        position: "absolute", top: index * 58, left: index * 26, width: CARD_W, opacity: p,
        scale: String(0.96 + 0.04 * p), rotate: `${(index - 1) * 1.6}deg`,
        borderRadius: radius.md, overflow: "hidden", border: `1px solid ${color.line}`, background: color.ink, boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
      }}
    >
      <Img src={staticFile(src)} alt={label} style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
};

export const Cards: React.FC<{ event: EventOf<"cards"> }> = ({ event }) => {
  const local = useLocal(event);
  const { opacity, enter } = useEnvelope();
  const { kicker, images, caption } = event.content;
  const stackW = CARD_W + (images.length - 1) * 26;
  return (
    <div style={{ position: "absolute", top: layout.panelTop, right: layout.margin, width: stackW, opacity, translate: `${(1 - enter) * 28}px 0px`, display: "flex", flexDirection: "column", gap: space.md }}>
      <Tag>
        <Kicker>{kicker}</Kicker>
      </Tag>
      <div style={{ position: "relative", height: 418 + (images.length - 1) * 58 }}>
        {images.map((img, i) => (
          <Card key={img.src} at={local(img.at)} src={img.src} label={img.label} index={i} />
        ))}
      </div>
      {caption ? (
        <Appear at={local(caption.at)}>
          <Tag>
            <span style={{ ...type.small, color: color.text }}>{caption.text}</span>
          </Tag>
        </Appear>
      ) : null}
    </div>
  );
};

const SCREEN_H = 780;
const SCREEN_W = Math.round((SCREEN_H * 1180) / 2556);
const BEZEL = 11;

const Clip: React.FC<{ src: string; trimStart: number; fadeIn: boolean }> = ({ src, trimStart, fadeIn }) => {
  const { fps } = useVideoConfig();
  const p = useProgress(0, 0.25);
  return (
    <AbsoluteFill style={{ opacity: fadeIn ? p : 1 }}>
      <Video src={staticFile(src)} muted trimBefore={Math.round(trimStart * fps)} style={{ width: "100%", height: "100%" }} objectFit="cover" />
    </AbsoluteFill>
  );
};

export const Phone: React.FC<{ event: EventOf<"phone"> }> = ({ event }) => {
  const local = useLocal(event);
  const { opacity, enter } = useEnvelope();
  const { kicker, clips, caption } = event.content;
  const outerW = SCREEN_W + BEZEL * 2;
  return (
    <div style={{ position: "absolute", top: 50, right: layout.margin + (layout.panelWidth - outerW) / 2, width: outerW, opacity, translate: `0px ${(1 - enter) * 28}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm + 2 }}>
      <Tag>
        <Kicker>{kicker}</Kicker>
      </Tag>
      <div style={{ padding: BEZEL, borderRadius: 50, background: "#05060A", border: `2px solid ${color.line}`, boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}>
        <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, borderRadius: 40, overflow: "hidden", background: "#000" }}>
          {clips.map((c, i) => (
            <Sequence key={c.src} from={local(c.at)} layout="none">
              <Clip src={c.src} trimStart={c.trimStart} fadeIn={i > 0} />
            </Sequence>
          ))}
        </div>
      </div>
      {caption ? (
        <Appear at={local(caption.at)}>
          <Tag>
            <span style={{ ...type.small, color: color.text, whiteSpace: "nowrap" }}>{caption.text}</span>
          </Tag>
        </Appear>
      ) : null}
    </div>
  );
};

const Highlight: React.FC<{ at: number; x: number; w: number; label: string; below: boolean }> = ({ at, x, w, label, below }) => {
  const p = useProgress(at, 0.4);
  return (
    <div style={{ position: "absolute", left: `${x * 100}%`, width: `${w * 100}%`, top: 0, bottom: 0, opacity: p }}>
      <div style={{ position: "absolute", inset: 0, border: `4px solid ${color.accent}`, borderRadius: 8 }} />
      <div style={{ position: "absolute", left: "50%", translate: "-50% 0px", [below ? "top" : "bottom"]: "calc(100% + 10px)", whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 8, background: color.accent, color: color.accentInk, ...type.small, fontWeight: 800 }}>
        {label}
      </div>
    </div>
  );
};

export const Insert: React.FC<{ event: EventOf<"insert"> }> = ({ event }) => {
  const local = useLocal(event);
  const { fps } = useVideoConfig();
  const { opacity, enter } = useEnvelope();
  const { src, trimStart, aspect, crop, title, caption, highlights, chips } = event.content;
  const viewAspect = (aspect * crop.w) / crop.h;
  const W = viewAspect > 2.2 ? 1800 : 1600;
  const H = Math.round(W / viewAspect);
  const vidW = W / crop.w; // the full asset frame, scaled so that the crop fills the view
  const vidH = vidW / aspect;
  return (
    <AbsoluteFill style={{ background: color.backdrop, opacity, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: space.lg }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: space.md, width: W }}>
        <Kicker>{title}</Kicker>
        <span style={{ ...type.small, color: color.textMuted }}>{caption}</span>
      </div>
      <div style={{ position: "relative", width: W, height: H, scale: String(0.98 + 0.02 * enter) }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: radius.md, overflow: "hidden", border: `1px solid ${color.line}`, background: "#fff" }}>
          <Video src={staticFile(src)} muted trimBefore={Math.round(trimStart * fps)} style={{ position: "absolute", left: -crop.x * vidW, top: -crop.y * vidH, width: vidW, height: vidH }} objectFit="fill" />
        </div>
        {/* highlight x/w are fractions of the FULL asset frame; convert into the cropped view */}
        {highlights.map((h, i) => (
          <Highlight key={h.label} at={local(h.at)} x={(h.x - crop.x) / crop.w} w={h.w / crop.w} label={h.label} below={i % 2 === 1} />
        ))}
      </div>
      {chips.length ? (
        <div style={{ display: "flex", alignItems: "center", gap: space.md, width: W, minHeight: 56 }}>
          {chips.map((c, i) => (
            <Appear key={c.text} at={local(c.at)} style={{ display: "flex", alignItems: "center", gap: space.md }}>
              {i > 0 ? <span style={{ ...type.title, color: color.textMuted }}>→</span> : null}
              <span style={{ padding: `${space.sm}px ${space.lg}px`, borderRadius: 999, background: i === chips.length - 1 ? color.accent : color.inkRaised, color: i === chips.length - 1 ? color.accentInk : color.text, border: `1px solid ${color.line}`, ...type.body, fontWeight: 700 }}>{c.text}</span>
            </Appear>
          ))}
        </div>
      ) : (
        <div style={{ minHeight: 56 }} />
      )}
    </AbsoluteFill>
  );
};
