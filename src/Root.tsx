import "./index.css";
import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import rawPlan from "../work/edit-plan.json";
import { planSchema } from "./plan/schema";
import { GraphicsLayer, GraphicsLayerProps } from "./compositions/GraphicsLayer";
import { ShortOverlay, ShortProps } from "./compositions/ShortOverlay";

// The editorial plan is data (work/edit-plan.json); it is validated once here.
const plan = planSchema.parse(rawPlan);

// Timeline = the verified source cadence and length recorded in the plan (never hardcoded here).
const calculateMetadata: CalculateMetadataFunction<GraphicsLayerProps> = ({ props }) => ({
  fps: props.plan.source.fps,
  durationInFrames: props.plan.source.frames,
  // Alpha-capable defaults so that a Studio/CLI render of "Graphics" is transparent too.
  defaultCodec: "prores",
  defaultProResProfile: "4444",
  defaultVideoImageFormat: "png",
  defaultPixelFormat: "yuva444p10le",
});

const shortMetadata: CalculateMetadataFunction<ShortProps> = ({ props }) => ({
  fps: props.fps,
  durationInFrames: Math.round(props.durationSeconds * props.fps),
  defaultCodec: "prores",
  defaultProResProfile: "4444",
  defaultVideoImageFormat: "png",
  defaultPixelFormat: "yuva444p10le",
});
const shortDefaults: ShortProps = { kicker: "", title: "", titleAccent: "", captions: [], cta: { at: 99, text: "", sub: "" }, durationSeconds: 1, fps: 30, locale: "tr" };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Vertical Shorts overlay (scripts/90-shorts.mjs) */}
      <Composition id="Short" component={ShortOverlay} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={shortDefaults} calculateMetadata={shortMetadata} />
      {/* Layout/content review over the tone-mapped SDR proxy. Not a colour reference. */}
      <Composition id="Preview" component={GraphicsLayer} width={1920} height={1080} fps={60} durationInFrames={1} defaultProps={{ plan, showProxy: true }} calculateMetadata={calculateMetadata} />
      {/* Transparent graphics only — this is what scripts/60-render-segments.mjs renders at scale 2. */}
      <Composition id="Graphics" component={GraphicsLayer} width={1920} height={1080} fps={60} durationInFrames={1} defaultProps={{ plan, showProxy: false }} calculateMetadata={calculateMetadata} />
    </>
  );
};
