Goal: make the dark radial center of the multiplayer page background 30% larger, and ensure the pattern reaches every window edge at all breakpoints (stretching vertically and bleeding off the sides on mobile).

## Current state
- `src/pages/MultiplayerPage.tsx` renders the pattern on a `::before` pseudo-element at `opacity: 0.6`.
- Desktop uses `background-size: cover; background-position: center`.
- Mobile (`max-width: 600px`) uses `background-size: auto 80%;`, leaving a margin and not touching the top/bottom edges.
- `public/whoop-pattern-bg.svg` contains the radial vignette defined by `gradientTransform="translate(1000 999.5) scale(1000 999.5)"`.

## Proposed changes

### 1. Enlarge the radial center by 30% in the SVG
File: `public/whoop-pattern-bg.svg`
- Update the radial gradient transform from `scale(1000 999.5)` to `scale(1300 1299.35)` (1000 × 1.3 and 999.5 × 1.3).
- This expands the opaque dark center outward before the fade begins, making the vignette 30% larger while keeping the same fade curve and stops.

### 2. Make the pattern extend to all viewport edges
File: `src/pages/MultiplayerPage.tsx`
- Remove the mobile-only `background-size: auto 80%` media query so the pattern is not artificially shrunk on phones.
- Use a responsive sizing strategy that guarantees edge-to-edge coverage:
  - Default (desktop / large tablets): `background-size: cover; background-position: center;`
  - Mobile (`@media (max-width: 600px)`): `background-size: auto 100%; background-position: center;`
    - `auto 100%` scales the square SVG to full viewport height, so the pattern touches the top and bottom edges and bleeds off the left/right sides.
- Keep `background-repeat: no-repeat`, `opacity: 0.6`, and the `#231F20` fallback behind it.

### 3. Verification
- Run typecheck.
- Run the existing test suite (105 tests).
- Visually verify at common viewports that:
  - The dark center is visibly larger than before.
  - On mobile (390×844) the pattern reaches the top and bottom and crops/bleeds on the sides.
  - On tablet (833×910) and desktop (1440×900) the pattern covers the full viewport with no bare edges.
  - The centered board and all interactive elements remain legible and clickable.