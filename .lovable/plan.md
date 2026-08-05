# Recreate a seamless Daily pattern strip

## Goal
Replace the existing `WhoopWhoop_Daily_Pattern.svg` asset with a new, seamlessly horizontal-repeating SVG built from the individual shape SVGs the user will attach in chat.

## Constraints from the user
- Delivery: individual shape SVGs as chat attachments.
- Repeat direction: horizontal only (matches current top/bottom strip).
- Output: replace the existing `src/assets/WhoopWhoop_Daily_Pattern.svg.asset.json` pointer.
- Design: ~8 px spacing between shapes; keep shapes close to current breakpoint sizes; alternate shapes one after another.

## Steps

1. **Receive and inspect shapes**
   - Download the attached SVGs to a temporary workspace.
   - Read each SVG to extract viewBox, width/height, and shape paths.
   - Inspect the current pattern asset (via its CDN URL) to confirm baseline strip height and overall scale.

2. **Design the tile**
   - Choose a tile height that matches the current strip at each breakpoint (mobile 19 px, tablet 24 px, desktop 28 px) by scaling the artwork to fit.
   - Lay out the shapes in a single row with ~8 px gaps, alternating shapes sequentially.
   - Compute the exact tile width so the right edge matches the left edge for a seamless `repeat-x`.

3. **Build the seamless SVG**
   - Create a new SVG file with a `viewBox` whose width equals the computed tile width and whose height matches the strip’s art height.
   - Embed each shape inline (or use `<image>` only if the source files are clean and self-contained). Prefer inline paths for crisp scaling and small file size.
   - Ensure no visible seam at the tile boundary: the first shape’s left edge and the last shape’s right edge must align with the viewBox edges, accounting for the 8 px rhythm.

4. **Upload and replace the asset**
   - Run `lovable-assets create --file <new-pattern.svg>` and write the resulting JSON to `src/assets/WhoopWhoop_Daily_Pattern.svg.asset.json`.
   - Delete the old asset pointer’s CDN object with `lovable-assets delete --file src/assets/WhoopWhoop_Daily_Pattern.svg.asset.json` after the new one renders correctly.

5. **Verify**
   - Confirm `DailyShapeRule.tsx` still imports the updated pointer and that `src/index.css` continues to tile it with `repeat-x`.
   - Take Playwright screenshots at mobile, tablet, and desktop viewports on `/today` to check that the pattern repeats without seams and stays anchored to the centred content container.
   - Run `bunx tsc --noEmit` and `bun run build` to ensure no broken references.

## Out of scope
- Changing the pattern’s CSS integration, breakpoint heights, or container anchoring logic beyond what the new tile requires.
- Adding animation or interactivity to the strip.
