# Global color themes across cards and intro animation

Yes — both are recolorable at runtime. I checked the assets:

- The 48 card SVGs are flat vector files using exactly four literal hex fills: paper `#f8f2e9`, ink `#231f20`, and the shape hue (`#d72229` red / `#0072b2` blue / `#e79024` yellow). The card back uses all four.
- The intro Lottie (`whoop-intro.json`, 776 KB) uses the exact same four colors and nothing else (plus one black). Every color lives in plain numeric RGB arrays that can be remapped in JS.

Paper (`#f8f2e9`) and ink (`#231f20`) are fixed and never change. A theme swaps only the three shape hues, everywhere they appear: UI, cards, and intro.

## What gets built

**1. Palette definition**

A theme is three colors — the hues currently named red, blue and yellow/orange. Paper and ink stay constant across every theme. Today's values become the default "Classic" theme.

Second theme, "Neon", from your colors, mapped onto the three hue slots:

| Slot | Classic | Neon |
| --- | --- | --- |
| hue 1 (red) | `#d72229` | `#FF47DA` magenta |
| hue 2 (blue) | `#0072b2` | `#46237A` violet |
| hue 3 (yellow) | `#e79024` | `#3DDC97` mint |

Themes are selected at runtime from the existing settings surface and persisted, like the current sfx/music settings.

**2. Card recoloring**

Cards keep rendering as images, so the grid, flip and deal animations are untouched. On theme change, each card SVG's source text is fetched once, its three hue hex values are swapped for the active palette's (paper and ink left as-is), and the result is cached as a blob URL keyed by theme. `GameCard` reads the themed URL instead of the raw path. The existing preload pass warms the cache for the active theme so cards never show a back-then-face race.

**3. Intro animation recoloring**

The Lottie JSON is parsed once, and every color array matching one of the three hues is remapped through the palette; paper and ink arrays are left untouched. Cached per theme, so switching themes doesn't refetch the 776 KB asset.

**4. Game-integrity guardrails**

Color is a real matching attribute, so a theme whose three hues aren't clearly distinguishable would make the game unfair or unplayable. Each palette is checked at authoring time for:

- pairwise separation between the three hues (perceptual distance, not just hex difference)
- each hue against the fixed paper for card legibility, and against ink where hue and linework meet

Palettes that fail don't ship. Color-blind-safe hue triples are preferred, as the current red/blue/orange set already is.

## Technical notes

- Palette lives alongside `src/lib/tokens.ts` and is exposed through the existing theme context; the hue tokens (`COLORS.red`, `.blue`, `.orange` and their hover variants) resolve from the active palette rather than fixed literals, so buttons, chips and the die art follow automatically. `COLORS.surface` and `COLORS.ink` stay literal.
- Die faces in `public/dice/*.svg` go through the same SVG recolor path.
- Recolor is a whole-token hex replace on the SVG text, case-insensitive, restricted to the three known hue values — no parsing, no DOM inlining, no layout risk.
- Blob URLs are revoked when a theme is swapped out to avoid leaks across switches.
- Reduced-motion, deal/select/match animations, and all engine code are untouched. Animation CSS that hardcodes a hue (`ww-select-ring` `#0072B2`, `ww-wrong` `#D72229`) moves to CSS variables fed by the palette; the green `ww-great` `#59CD90` stays fixed unless you want it themed too.

## Scope

Not included: per-player themes, user-authored custom palettes, or theming the photographic/pattern background beyond its existing tint.
