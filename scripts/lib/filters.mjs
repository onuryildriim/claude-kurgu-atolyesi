// FFmpeg filter fragments shared by the proxy, composite and QC scripts, so that the colour
// handling is defined exactly once. See work/color-pipeline.md for the reasoning.
import { existsSync, readFileSync } from "node:fs";
import { LUT_GFX, LUT_PREVIEW, p } from "./paths.mjs";

/** HLG (Rec.2100) source → the documented HLG path; otherwise an SDR BT.709 source (e.g. phone SDR, screen recordings, dubbed versions). */
export const sourceIsHlg = () => {
  const f = p("work/source-metadata.json");
  return existsSync(f) ? !!JSON.parse(readFileSync(f, "utf8")).summary.hdr?.isHlgTagged : true;
};
const BT709 = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv";

const SWS = "flags=accurate_rnd+full_chroma_int+bitexact";
const esc = (file) => file.replace(/\\/g, "/").replace(/([:'])/g, "\\$1");

/**
 * HLG (bt2020nc, tv range, 10-bit) -> SDR BT.709 viewing transform. Preview proxy + QC stills only.
 * Downscale happens first (in Y'CbCr) to keep the 129^3 LUT cheap.
 */
export const viewingTransform = ({ width, height } = {}) =>
  !sourceIsHlg()
    ? [`scale=${width ? `${width}:${height}:` : ""}in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv:flags=bicubic`, "format=yuv420p", BT709].join(",") // untagged dubbed output is usually BT.709
    : [
    width ? `scale=${width}:${height}:flags=bicubic` : null,
    `scale=in_color_matrix=bt2020:in_range=tv:out_range=pc:${SWS}`,
    "format=gbrp16le",
    `lut3d=file='${esc(LUT_PREVIEW)}':interp=tetrahedral`,
    `scale=out_color_matrix=bt709:out_range=tv:${SWS}`,
    "format=yuv420p",
    // The pixels are SDR now: retag the frames, otherwise the source's HLG tags reach the encoder
    // and override the -color_* output options (seen with ffmpeg 9.0.1).
    "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
  ].filter(Boolean).join(",");

/**
 * Remotion ProRes 4444 segment (rendered with colorSpace:'bt709' => bt709 matrix, tv range,
 * straight alpha, sRGB-encoded R'G'B') -> HLG Y'CbCr 4:2:0 10-bit with straight alpha.
 *   startFrame: absolute source frame index of the segment's first frame.
 * Alpha never passes through a colour transform: lutrgb/lut3d only touch R, G, B.
 */
export const gfxToHlg = (startFrame, fps = "60") =>
  !sourceIsHlg()
    ? [`settb=1/${fps}`, `setpts=N+${startFrame}`, `scale=in_color_matrix=bt709:in_range=tv:out_color_matrix=bt709:out_range=tv:${SWS}`, "format=yuva420p10le", BT709].join(",") // SDR base: graphics stay BT.709
    : [
    `settb=1/${fps}`,
    `setpts=N+${startFrame}`,
    `scale=in_color_matrix=bt709:in_range=tv:out_range=pc:${SWS}`,
    "format=gbrap16le",
    // 1D shaper u = c^(1/2.4); the LUT was built over u (see scripts/40-make-luts.mjs)
    "lutrgb=r='pow(val/maxval,1/2.4)*maxval':g='pow(val/maxval,1/2.4)*maxval':b='pow(val/maxval,1/2.4)*maxval'",
    `lut3d=file='${esc(LUT_GFX)}':interp=tetrahedral`,
    `scale=out_color_matrix=bt2020:out_range=tv:out_chroma_loc=left:${SWS}`,
    "format=yuva420p10le",
    "setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv",
  ].join(",");

/** Strips Dolby Vision + unregistered SEI frame side data from the base (master is plain HLG). */
export const stripDovi =
  "sidedata=mode=delete:type=DOVI_RPU_BUFFER,sidedata=mode=delete:type=DOVI_METADATA,sidedata=mode=delete:type=SEI_UNREGISTERED";

export const OVERLAY = "overlay=format=yuv420p10:alpha=straight:eof_action=pass:repeatlast=0";
