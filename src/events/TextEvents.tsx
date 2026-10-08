// Text-led events: headline (hook), callout, list, stat, social (closing).
import React from "react";
import { color, space, type } from "../theme/theme";
import type { EventOf } from "../plan/schema";
import { Appear, Footnote, Kicker, Panel, Reveal, useLocal, useProgress } from "./shared";

const side = (s: "left" | "right" | "full") => (s === "left" ? "left" : "right");

export const Headline: React.FC<{ event: EventOf<"headline"> }> = ({ event }) => {
  const local = useLocal(event);
  const { lines, strikeLine, strikeAt, after } = event.content;
  const strike = useProgress(local(strikeAt), 0.35);
  return (
    <Panel side={side(event.side)} width={548}>
      <div style={{ ...type.headline, fontSize: 48 }}>
        {lines.map((line, i) => (
          <div key={line} style={{ position: "relative", width: "fit-content", whiteSpace: "nowrap", color: i === strikeLine ? `color-mix(in srgb, ${color.text} ${100 - strike * 45}%, ${color.textMuted})` : color.text }}>
            {line}
            {i === strikeLine ? (
              <span style={{ position: "absolute", left: -4, top: "54%", height: 6, borderRadius: 3, background: color.negative, width: `calc(${strike * 100}% + ${strike * 8}px)` }} />
            ) : null}
          </div>
        ))}
      </div>
      <Appear at={local(strikeAt) + 14} style={{ ...type.body, color: color.accent, fontWeight: 700 }}>
        {after}
      </Appear>
    </Panel>
  );
};

export const Callout: React.FC<{ event: EventOf<"callout"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, headline, sub, subAt } = event.content;
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      <div style={{ ...type.headline, textWrap: "balance" }}>{headline}</div>
      {sub ? (
        <Appear at={subAt === undefined ? 12 : local(subAt)} style={{ ...type.body, color: color.textMuted }}>
          {sub}
        </Appear>
      ) : null}
    </Panel>
  );
};

export const Marker: React.FC<{ kind: "dot" | "check" | "minus" }> = ({ kind }) => (
  <svg width={26} height={26} viewBox="0 0 26 26" style={{ flex: "none", marginTop: 4 }}>
    {kind === "dot" ? <circle cx={13} cy={13} r={5} fill={color.accent} /> : null}
    {kind === "minus" ? <rect x={5} y={11} width={16} height={4} rx={2} fill={color.negative} /> : null}
    {kind === "check" ? <path d="M5 13.5 L11 19 L21 7.5" fill="none" stroke={color.accent} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" /> : null}
  </svg>
);

export const List: React.FC<{ event: EventOf<"list"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, title, items, marker } = event.content;
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      <div style={type.title}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: -space.md }}>
        {items.map((item) => (
          <Reveal key={item.text} at={local(item.at)} gap={space.sm + 4} style={{ display: "flex", gap: space.sm + 2, ...type.body }}>
            <Marker kind={marker} />
            <span>{item.text}</span>
          </Reveal>
        ))}
      </div>
    </Panel>
  );
};

export const Stat: React.FC<{ event: EventOf<"stat"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, rows, footer, footnote } = event.content;
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      {footnote ? <Footnote>{footnote}</Footnote> : null}
      <div style={{ display: "flex", flexDirection: "column", marginTop: -space.md }}>
        {rows.map((row) => (
          <Reveal key={row.label} at={local(row.at)} gap={space.md} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ ...type.small, color: color.textMuted }}>{row.label}</span>
            <span style={{ ...type.number, fontSize: row.emphasis ? 64 : 46, color: row.emphasis ? color.accent : color.text }}>{row.value}</span>
          </Reveal>
        ))}
        {footer ? (
          <Reveal at={local(footer.at)} gap={space.md} style={{ ...type.body, color: color.text }}>
            {footer.text}
          </Reveal>
        ) : null}
      </div>
    </Panel>
  );
};

const InstagramGlyph: React.FC = () => (
  <svg width={54} height={54} viewBox="0 0 54 54" style={{ flex: "none" }}>
    <rect x={5} y={5} width={44} height={44} rx={13} fill="none" stroke={color.accent} strokeWidth={4.5} />
    <circle cx={27} cy={27} r={10} fill="none" stroke={color.accent} strokeWidth={4.5} />
    <circle cx={39.5} cy={14.5} r={3} fill={color.accent} />
  </svg>
);

export const Social: React.FC<{ event: EventOf<"social"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, handle, cta } = event.content;
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      <div style={{ display: "flex", alignItems: "center", gap: space.md }}>
        <InstagramGlyph />
        <span style={{ ...type.headline, fontSize: 50, whiteSpace: "nowrap" }}>{handle}</span>
      </div>
      <div style={{ marginTop: -space.md }}>
        <Reveal at={local(cta.at)} gap={space.md} style={{ ...type.body, color: color.text }}>
          {cta.text}
        </Reveal>
      </div>
    </Panel>
  );
};
