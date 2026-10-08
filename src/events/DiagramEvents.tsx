// Conceptual diagrams. Every one carries a Turkish footnote that marks it as schematic; the
// only numbers shown are the ones spoken in the narration (see work/edit-plan.json).
import React from "react";
import { color, radius, space, type } from "../theme/theme";
import type { EventOf } from "../plan/schema";
import { Appear, Footnote, Kicker, Panel, Reveal, useLocal, useProgress } from "./shared";

const side = (s: "left" | "right" | "full") => (s === "left" ? "left" : "right");

const FunnelRow: React.FC<{ at: number; label: string; value?: string; weight: number; first: boolean }> = ({ at, label, value, weight, first }) => {
  const p = useProgress(at, 0.45);
  return (
    <Reveal at={at} gap={space.sm + 2} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: space.sm }}>
        <span style={{ ...type.small, color: first ? color.textMuted : color.text }}>{label}</span>
        {value ? <span style={{ ...type.title, fontSize: 30, color: first ? color.text : color.accent }}>{value}</span> : null}
      </div>
      {first ? null : (
        <div style={{ height: 12, borderRadius: 6, background: color.inkRaised }}>
          <div style={{ height: "100%", borderRadius: 6, background: color.accent, width: `${weight * p * 100}%` }} />
        </div>
      )}
    </Reveal>
  );
};

const FlowBox: React.FC<{ at: number; label: string; value?: string; last: boolean; first: boolean }> = ({ at, label, value, last, first }) => (
  <Reveal at={at} gap={first ? space.md : 0} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    {first ? null : (
      <svg width={24} height={26} viewBox="0 0 24 26">
        <path d="M12 2 V20 M5 14 L12 22 L19 14" fill="none" stroke={color.textMuted} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
    <div
      style={{
        width: "100%", boxSizing: "border-box", padding: `${space.sm}px ${space.md}px`, borderRadius: radius.sm,
        background: last ? color.accent : color.inkRaised, color: last ? color.accentInk : color.text,
        border: `1px solid ${last ? color.accent : color.line}`, textAlign: "center",
      }}
    >
      <div style={{ ...type.body, fontWeight: 700 }}>{label}</div>
      {value ? <div style={{ ...type.note, opacity: 0.85 }}>{value}</div> : null}
    </div>
  </Reveal>
);

export const Steps: React.FC<{ event: EventOf<"steps"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, title, variant, steps, notes, footnote } = event.content;
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      <div style={type.title}>{title}</div>
      <Footnote>{footnote}</Footnote>
      <div style={{ display: "flex", flexDirection: "column", marginTop: -space.md }}>
        {steps.map((s, i) =>
          variant === "funnel" ? (
            <FunnelRow key={s.label} at={local(s.at)} label={s.label} value={s.value} weight={s.weight ?? 1} first={i === 0} />
          ) : (
            <FlowBox key={s.label} at={local(s.at)} label={s.label} value={s.value} first={i === 0} last={i === steps.length - 1} />
          ),
        )}
        {notes.map((n, i) => (
          <Reveal key={n.text} at={local(n.at)} gap={i === 0 ? space.md : space.sm} style={{ display: "flex", gap: space.sm, ...type.small }}>
            <span style={{ color: color.negative, fontWeight: 800 }}>!</span>
            <span>{n.text}</span>
          </Reveal>
        ))}
      </div>
    </Panel>
  );
};

const BarRow: React.FC<{ at: number; label: string; display: string; fraction: number; emphasis: boolean }> = ({ at, label, display, fraction, emphasis }) => {
  const p = useProgress(at, 0.6);
  return (
    <Reveal at={at} gap={space.md} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ ...type.small, color: emphasis ? color.accent : color.text, fontWeight: 700 }}>{label}</span>
        <span style={{ ...type.title, fontSize: 28 }}>{display}</span>
      </div>
      <div style={{ height: 14, borderRadius: 7, background: color.inkRaised }}>
        {/* linear scale on purpose; a 2 px floor keeps the smallest bar from vanishing entirely */}
        <div style={{ height: "100%", borderRadius: 7, minWidth: 2, width: `${fraction * p * 100}%`, background: emphasis ? color.accent : color.text }} />
      </div>
    </Reveal>
  );
};

export const Bars: React.FC<{ event: EventOf<"bars"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, title, rows, footnote } = event.content;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      <div style={type.title}>{title}</div>
      <Footnote>{footnote}</Footnote>
      <div style={{ display: "flex", flexDirection: "column", marginTop: -space.md }}>
        {rows.map((r) => (
          <BarRow key={r.label} at={local(r.at)} label={r.label} display={r.display} fraction={r.value / max} emphasis={r.emphasis} />
        ))}
      </div>
    </Panel>
  );
};

const RESULT_ROWS = 7;

export const Search: React.FC<{ event: EventOf<"search"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, title, queries, countAt, countText, topAt, topText, footnote } = event.content;
  const top = useProgress(local(topAt), 0.5);
  const TOP_ROWS = 3; // rows drawn inside the top bracket (schematic, not a literal count)
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      <div style={type.title}>{title}</div>
      <Footnote>{footnote}</Footnote>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, padding: `${space.sm}px ${space.md}px`, borderRadius: 14, background: color.inkRaised, border: `1px solid ${color.line}` }}>
        <svg width={24} height={24} viewBox="0 0 24 24">
          <circle cx={10.5} cy={10.5} r={6.5} fill="none" stroke={color.textMuted} strokeWidth={2.6} />
          <path d="M15.5 15.5 L21 21" stroke={color.textMuted} strokeWidth={2.6} strokeLinecap="round" />
        </svg>
        <span style={{ ...type.body }}>{queries[queries.length - 1].text}</span>
      </div>
      <Appear at={local(countAt)} style={{ ...type.small, color: color.textMuted }}>
        {countText}
      </Appear>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
        <div
          style={{
            position: "absolute", left: -10, right: -10, top: -6, height: TOP_ROWS * 45 + 4, borderRadius: radius.sm,
            border: `3px solid ${color.accent}`, opacity: top,
          }}
        />
        {Array.from({ length: RESULT_ROWS }, (_, i) => (
          <Appear key={i} at={local(countAt) + 6 + i * 4} rise={6} style={{ display: "flex", alignItems: "center", gap: space.sm, height: 38 }}>
            <span style={{ ...type.small, width: 30, color: i < TOP_ROWS ? color.text : color.textMuted, fontWeight: 800 }}>{i < RESULT_ROWS - 1 ? i + 1 : "…"}</span>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: i < TOP_ROWS ? color.textMuted : color.line, flex: "none" }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <span style={{ height: 9, borderRadius: 5, width: `${78 - i * 6}%`, background: i < TOP_ROWS ? color.textMuted : color.line }} />
              <span style={{ height: 7, borderRadius: 4, width: `${48 - i * 3}%`, background: color.line }} />
            </span>
          </Appear>
        ))}
      </div>
      <div style={{ marginTop: -space.md }}>
        <Reveal at={local(topAt)} gap={space.md} style={{ ...type.small, color: color.accent, fontWeight: 700 }}>
          {topText}
        </Reveal>
      </div>
    </Panel>
  );
};

export const Versus: React.FC<{ event: EventOf<"versus"> }> = ({ event }) => {
  const local = useLocal(event);
  const { kicker, left, right, question, footnote } = event.content;
  const cell = (c: typeof left, accent: boolean) => (
    <Appear at={local(c.at)} style={{ flex: 1, padding: space.md, borderRadius: radius.md, background: color.inkRaised, border: `1px solid ${color.line}`, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ ...type.number, fontSize: 52, color: accent ? color.accent : color.text }}>{c.abbr}</span>
      <span style={{ ...type.small, color: color.textMuted }}>{c.label}</span>
    </Appear>
  );
  return (
    <Panel side={side(event.side)}>
      <Kicker>{kicker}</Kicker>
      <Footnote>{footnote}</Footnote>
      <div style={{ display: "flex", gap: space.md, alignItems: "stretch" }}>
        {cell(left, false)}
        {cell(right, true)}
      </div>
      <div style={{ marginTop: -space.md }}>
        <Reveal at={local(question.at)} gap={space.md} style={{ ...type.title, fontSize: 32 }}>
          {question.text}
        </Reveal>
      </div>
    </Panel>
  );
};
