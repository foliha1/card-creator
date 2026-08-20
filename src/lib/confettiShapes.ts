// ============================================================================
// Brand confetti shapes — circle, square, triangle.
//
// Paths are copied verbatim from the brand pattern strip
// `public/WhoopWhoop_Daily_Pattern_Seamless_Night.svg` (viewBox 0 0 360 19),
// the same file `DailyShapeRule` / `dailyShareImage` render as the strip, so
// the confetti and the strip are literally the same geometry. The star is
// deliberately not included: at particle size its points blur away.
//
// Source bounding boxes inside that shared viewBox:
//   triangle  x 3.934 -> 20.067   (w 16.133)  y 0.153 -> 18.847 (h 18.694)
//   square    x 51.934 -> 68.067  (w 16.133)  y 1.434 -> 17.567 (h 16.133)
//   circle    cx 84, cy 9.4996, r 8.066       (w 16.132, h 16.132)
//
// Each is normalised with an explicit matrix into ONE 10x10 box, centred on
// its own bbox centre, scaled uniformly (aspect preserved) so nothing is
// squashed. Uniform scale is why the triangle's rendered box is 8.63 x 10
// rather than 10 x 10 — its ink area stays within ~14% of the others.
// ============================================================================

import confetti from "canvas-confetti";

/** The single normalised box every shape is fitted into. */
export const NORMALISED_BOX = 10;

type Box = { x: number; y: number; w: number; h: number };

const SOURCES: { path: string; box: Box }[] = [
  {
    // triangle
    path: "M3.93399 9.50513L20.067 18.8472V0.15332L3.93399 9.50513Z",
    box: { x: 3.93399, y: 0.15332, w: 16.13301, h: 18.69388 },
  },
  {
    // square (rounded rect from the strip)
    path: "M66.92 1.43359H53.081C52.4475 1.43359 51.934 1.94712 51.934 2.58059V16.4196C51.934 17.0531 52.4475 17.5666 53.081 17.5666H66.92C67.5535 17.5666 68.067 17.0531 68.067 16.4196V2.58059C68.067 1.94712 67.5535 1.43359 66.92 1.43359Z",
    box: { x: 51.934, y: 1.43359, w: 16.133, h: 16.13301 },
  },
  {
    // circle
    path: "M84 17.5656C88.4547 17.5656 92.066 13.9543 92.066 9.49959C92.066 5.04487 88.4547 1.43359 84 1.43359C79.5453 1.43359 75.934 5.04487 75.934 9.49959C75.934 13.9543 79.5453 17.5656 84 17.5656Z",
    box: { x: 75.934, y: 1.43359, w: 16.132, h: 16.13201 },
  },
];

/** Uniform fit-to-box matrix, centred on the path's own bbox centre. */
export function normaliseMatrix(box: Box, target = NORMALISED_BOX): number[] {
  const scale = Math.min(target / box.w, target / box.h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return [scale, 0, 0, scale, -cx * scale, -cy * scale];
}

/** Rendered bbox of a shape at scalar 1, for verification. */
export function renderedBox(box: Box, target = NORMALISED_BOX) {
  const scale = Math.min(target / box.w, target / box.h);
  return { w: box.w * scale, h: box.h * scale };
}

export const SHAPE_SOURCES = SOURCES;

let cached: ReturnType<typeof confetti.shapeFromPath>[] | null = null;

/**
 * Builds the three shapes ONCE (three `shapeFromPath` calls total, ever) and
 * caches them. Never called per particle.
 */
export function getBrandConfettiShapes() {
  if (cached) return cached;
  cached = SOURCES.map(({ path, box }) =>
    confetti.shapeFromPath({
      path,
      // canvas-confetti accepts a plain 6-number matrix at runtime; its
      // typings only describe DOMMatrix.
      matrix: normaliseMatrix(box) as unknown as DOMMatrix,
    }),
  );
  return cached;
}
