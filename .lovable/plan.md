# Global color themes across cards and intro animation

Yes — both are recolorable at runtime. I checked the assets:

- The 48 card SVGs are flat vector files using exactly four literal hex fills: paper `#f8f2e9`, ink `#231f20`, and the shape hue (`#d72229` red / `#0072b2` blue / `#e79024` yellow). The card back uses all four.
- The intro Lottie (`whoop-intro.json`, 776 KB) uses the exact same four colors and nothing else (plus one black). Every color lives in plain numeric RGB arrays that can be remapped in JS.

So a single palette of four brand slots drives the entire app: UI, cards, and intro.

## What gets built

**1. Palette definition**

A theme is four colors: `paper`, `ink`, and three shape hues (`hue1`, `hue2`, `hue3`). Today's brand values become the default "Classic" theme. Themes are selected at runtime from the existing settings surface and persisted, like the current sfx/music settings.

**2. Card recoloring**

Cards keep rendering as images, so the grid, flip and deal animations are untouched. On theme change, each card SVG's source text is fetched once, its four known hex values are swapped for the active palette's, and the result is cached as a blob URL keyed by theme. `GameCard` reads the themed URL instead of the raw path. The existing preload pass warms the cache for the active theme so cards never show a back-then-face race.

**3. Intro animation recoloring**

The Lottie JSON is parsed once, and every color array is remapped through the same palette map before being handed to the player. Cached per theme, so switching themes doesn't refetch the 776 KB asset.

**4. Game-integrity guardrails**

Color is a real matching attribute, so a theme whose three hues aren't clearly distinguishable would make the game unfair or unplayable. Each palette is checked at authoring time for:

- pairwise separation between the three hues (perceptual distance, not just hex difference)
- each hue against paper for card legibility
- ink against paper for linework

Palettes that fail don't ship. Color-blind-safe hue triples are preferred, as the current red/blue/orange set already is.

## Technical notes

- Palette lives alongside `src/lib/tokens.ts` and is exposed through the existing theme context; UI tokens (`COLORS.red`, `.blue`, `.orange`, `.surface`, `.ink`) resolve from the active palette rather than fixed literals, so buttons, chips and the die art follow automatically.
- Die faces in `public/dice/*.svg` go through the same SVG recolor path.
- Recolor is a whole-token hex replace on the SVG text, case-insensitive, restricted to the four known brand values — no parsing, no DOM inlining, no layout risk.
- Blob URLs are revoked when a theme is swapped out to avoid leaks across switches.
- Reduced-motion, deal/select/match animations, and all engine code are untouched. Animation CSS that hardcodes brand hex (`ww-select-ring` `#0072B2`, `ww-wrong` `#D72229`, `ww-great` `#59CD90`) moves to CSS variables fed by the palette.

## Scope

Not included: per-player themes, user-authored custom palettes, or theming the photographic/pattern background beyond its existing tint.
