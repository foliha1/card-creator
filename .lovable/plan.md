Goal: on mobile, make every cream surface fill the viewport so the pattern background is completely hidden behind it. Desktop keeps the current centered-card treatment.

## Current state
- `src/pages/MultiplayerPage.tsx` centers a 420×900 max column over the dark `#231F20` page and the `/whoop-pattern-bg.svg` still.
- `src/components/MultiplayerWindow.tsx` wraps every pre-game screen in a transparent `.mp-shell` with an inner column capped at `maxWidth: 390`. The cream cards inside (play-style, name-prompt, lobby, solo-setup, full/host-left) are `height: "auto"` and do not reach the viewport edges.
- `src/components/MultiplayerGameView.tsx` has a cream root (`background: SURFACE` / `#F8F2E9`) with `height: "auto"` and `maxHeight: "100%"`, so it hugs content and leaves the pattern visible around it on short screens.
- The existing plan proposed scaling the SVG radial center and forcing the pattern to the viewport edges. On mobile that still leaves a busy pattern behind small cream cards, so the new direction is to cover the pattern with cream instead.

## Proposed changes

### 1. Let the page column fill the viewport on mobile
File: `src/pages/MultiplayerPage.tsx`
- Read `useIsMobile()` (or a CSS media query) inside the page.
- On mobile only:
  - Remove the inner column's `maxWidth` and `maxHeight` caps.
  - Set the inner column to `width: 100%`, `height: 100%`, `padding: 0`.
  - Keep safe-area insets for children; the column itself should not add horizontal padding that prevents edge-to-edge cream.
- Desktop remains exactly as-is.

### 2. Expand the MultiplayerWindow shell and every cream card to the viewport on mobile
File: `src/components/MultiplayerWindow.tsx`
- Use the existing `mobile` flag from `useIsMobile()`.
- On mobile:
  - Change `shellStyle` to `background: COLORS.surface`, `minHeight: "100dvh"`, `width: "100%"`, `padding: 0` (safe areas applied to inner cards), and `alignItems: "stretch"`.
  - Change `innerColStyle` to `maxWidth: "none"`, `width: "100%"`, `height: "100%"`, `minHeight: "100dvh"`.
  - Update every cream card style (`cardStyle`, `containerStyle`, idle play-style card, name-prompt card, lobby card, solo-setup card) to `width: "100%"`, `height: "100%"`, `minHeight: "100dvh"`, `borderRadius: 0`, and keep their internal padding/gaps.
  - Keep the `overflowY: "auto"` behavior on the shell so tall content remains scrollable.
- Desktop keeps current transparent shell, 390px max inner column, and rounded cream cards.

### 3. Expand the in-game board to the viewport on mobile
File: `src/components/MultiplayerGameView.tsx`
- On mobile only:
  - Change the root cream div to `height: "100%"`, `minHeight: "calc(100dvh - ${SITE_HEADER_H}px)"`, remove `maxHeight: "100%"`, and set `width: "100%"`.
  - Keep the 8px padding or adjust to safe-area insets so content is not flush with edges.
  - Ensure the inner column (`header` + panel + card area + bottom row) stretches to fill the available height.
- Desktop remains unchanged.

### 4. Preserve safe areas and scrollability
- Horizontal safe-area insets should be applied to the cream cards, not the transparent shell, so cream still reaches the physical edges.
- Vertical safe-area insets should be respected at the bottom so controls are not obscured.
- Any screen whose content exceeds the viewport must remain scrollable (`overflowY: "auto"`).

### 5. Verification
- Run typecheck.
- Run the existing test suite.
- Visually verify on mobile (≈402×725) that:
  - The play-style screen, name prompt, lobby, solo-setup, and in-game board each have cream filling the entire viewport.
  - No pattern background is visible behind or around the cream surface.
  - Content remains centered/readable and does not overflow in a broken way.
- Visually verify on desktop (≥768px) that the existing centered-card layout is unchanged and the pattern still shows around the cream container.
