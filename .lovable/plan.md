

## Desktop Background & Watermark Fix

### Changes (single file: `src/components/DesktopShell.tsx`)

1. **Background color**: Change `#2568B0` → `#0072B2`

2. **Watermark logo** (lines 133-147): Replace the simple `<img>` with a tone-on-tone approach:
   - Wrap the logo in a `<div>` with `background: #01527F`, positioned absolutely and centered like the current img
   - Set the `<img>` to `filter: brightness(0) saturate(100%)` (renders it black) and `mix-blend-mode: screen`
   - This makes the black logo transparent via screen blend, revealing the `#01527F` background only where the logo exists — creating a debossed dark-blue-on-blue effect
   - Remove `opacity: 0.1`, set to `opacity: 1`
   - Keep `pointerEvents: none` and existing size/positioning

### Technical Detail

The `screen` blend mode formula: lighter values show through. Black (0,0,0) screened over `#01527F` shows `#01527F`. The surrounding transparent/white areas of the SVG screened will show white — so we need the wrapper div to clip or the SVG background to be transparent. Since SVGs from this set have a cream/white background rectangle, we may need to adjust: if the SVG has a non-transparent background, the screen approach won't isolate the logo. In that case, fallback to `opacity: 0.18` with `filter: brightness(0.3) sepia(1) hue-rotate(180deg) saturate(3)` to tint toward dark blue — or simply use `opacity: 0.15` which against `#0072B2` will create a natural darkened tone. I'll try the simplest reliable approach first (opacity ~0.15-0.2 with the logo naturally darker) and adjust the filter to darken it into the `#01527F` range.

