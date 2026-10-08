// The one data-driven composition. It renders every event of work/edit-plan.json on a
// TRANSPARENT canvas. `showProxy` puts the SDR preview proxy underneath — Studio only; the
// render script always passes showProxy:false, so the proxy can never reach the HLG master.
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import type { EditPlan, PlanEvent } from "../plan/schema";
import { Callout, Headline, List, Social, Stat } from "../events/TextEvents";
import { Bars, Search, Steps, Versus } from "../events/DiagramEvents";
import { Cards, Insert, Phone } from "../events/MediaEvents";
import { SceneTool } from "../events/SceneEvents";
import { Chapter, Compare, Hook, Punch, Screen } from "../events/ScreenEvents";
import { Stage } from "../events/StageEvents";
import { Kinetic, Subscribe, Tag } from "../events/BrandEvents";

export type GraphicsLayerProps = { plan: EditPlan; showProxy: boolean };

const render = (event: PlanEvent) => {
  switch (event.type) {
    case "headline": return <Headline event={event} />;
    case "callout": return <Callout event={event} />;
    case "list": return <List event={event} />;
    case "stat": return <Stat event={event} />;
    case "steps": return <Steps event={event} />;
    case "bars": return <Bars event={event} />;
    case "search": return <Search event={event} />;
    case "versus": return <Versus event={event} />;
    case "cards": return <Cards event={event} />;
    case "phone": return <Phone event={event} />;
    case "insert": return <Insert event={event} />;
    case "social": return <Social event={event} />;
    case "scene-tool": return <SceneTool event={event} />;
    case "screen": return <Screen event={event} />;
    case "hook": return <Hook event={event} />;
    case "punch": return <Punch event={event} />;
    case "chapter": return <Chapter event={event} />;
    case "compare": return <Compare event={event} />;
    case "stage": return <Stage event={event} />;
    case "kinetic": return <Kinetic event={event} />;
    case "subscribe": return <Subscribe event={event} />;
    case "tag": return <Tag event={event} />;
  }
};

export const GraphicsLayer: React.FC<GraphicsLayerProps> = ({ plan, showProxy }) => {
  const { fps } = useVideoConfig();
  const events = [...plan.events].sort((a, b) => a.layer - b.layer || a.start - b.start);
  return (
    <AbsoluteFill>
      {showProxy ? <Video src={staticFile("proxy/main.preview-sdr-1080p.mp4")} style={{ width: "100%", height: "100%" }} /> : null}
      {events.map((event) => {
        const from = Math.floor(event.start * fps);
        return (
          <Sequence key={event.id} name={`${event.id} · ${event.type}`} from={from} durationInFrames={Math.ceil(event.end * fps) - from}>
            {render(event)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
