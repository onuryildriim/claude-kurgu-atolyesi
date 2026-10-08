// Full-screen scenes on the opaque backdrop: the presenter is hidden while they run, so they are
// reserved for passages where the picture explains more than the face. No invented figures.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { color, space, type } from "../theme/theme";
import type { EventOf } from "../plan/schema";
import { Kicker, Reveal, useEnvelope, useLocal } from "./shared";
import { Marker } from "./TextEvents";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { opacity, enter } = useEnvelope();
  return (
    <AbsoluteFill style={{ background: color.backdrop, opacity, color: color.text }}>
      <AbsoluteFill style={{ scale: String(0.98 + 0.02 * enter) }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const SCREEN_H = 880;
const SCREEN_W = Math.round((SCREEN_H * 1320) / 2868);
const BEZEL = 12;

const ToolClip: React.FC<{ src: string; fadeIn: boolean }> = ({ src, fadeIn }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity: fadeIn ? interpolate(frame, [0, 0.2 * fps], [0, 1], clamp) : 1 }}>
      <Video src={staticFile(src)} muted style={{ width: "100%", height: "100%" }} objectFit="cover" />
    </AbsoluteFill>
  );
};

export const SceneTool: React.FC<{ event: EventOf<"scene-tool"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, title, items, clips, note } = event.content;
  return (
    <Scene>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 150 }}>
        <div style={{ width: 860, display: "flex", flexDirection: "column", gap: space.lg }}>
          <Kicker>{kicker}</Kicker>
          <div style={{ ...type.headline, fontSize: 66 }}>{title}</div>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
            {items.map((item) => (
              <Reveal key={item.text} at={local(item.at)} gap={space.md + 2} maxHeight={120} style={{ display: "flex", gap: space.md, ...type.body, fontSize: 33 }}>
                <span style={{ marginTop: 4 }}><Marker kind="check" /></span>
                <span>{item.text}</span>
              </Reveal>
            ))}
          </div>
          <div style={{ ...type.note, color: color.textMuted }}>{note}</div>
        </div>
        <div style={{ padding: BEZEL, borderRadius: 58, background: "#05060A", border: `2px solid ${color.line}`, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", flex: "none" }}>
          <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, borderRadius: 47, overflow: "hidden", background: "#000" }}>
            {clips.map((c, i) => (
              <Sequence key={c.src} from={local(c.at)} layout="none">
                <ToolClip src={c.src} fadeIn={i > 0} />
              </Sequence>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
