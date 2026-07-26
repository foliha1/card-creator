Update the multiplayer page so the `whoop-pattern-bg.svg` backdrop shows through the board containers and remains visible around the edges on mobile.

## Changes

### 1. Background pattern layer (`src/pages/MultiplayerPage.tsx`)
- Move `backgroundImage` from the root `div` to a `::before` pseudo-element so its opacity can be controlled independently.
- Set the pseudo-element `opacity` to `0.6` (a 40% reduction from full opacity).
- Keep the root `backgroundColor: #231F20` so the page still has the brand dark fallback behind the faded pattern.
- Add a scoped `<style>` block with responsive rules:
  - Default (desktop / large tablets): `background-size: cover; background-position: center;`
  - Mobile (`@media (max-width: 600px)`): `background-size: auto 80%; background-position: center;` so the pattern edges stay visible in the small margins around the centered board instead of being cropped by `cover`.
- Add `position: relative` and `isolation: isolate` to the root so the pseudo-element layers correctly behind children.

### 2. Transparent board containers
- `src/components/MultiplayerWindow.tsx`: change `shellStyle.background` from `#231F20` to `transparent`.
- `src/components/MultiplayerGameView.tsx`: change the outer game container `background` from `SURFACE` (`#F8F2E9`) to `transparent` so the pattern shows through the gaps between UI panels.
- Leave individual UI panels (RoundBar, OpponentRow, ScoreRow, DieBox, ActionButton, card mat) with their existing opaque fills so text, cards, and chips remain readable.

### 3. Verification
- Run the existing test suite to confirm all 96/105 tests still pass.
- Run typecheck to confirm no TypeScript errors.
- Visually verify at common viewports (mobile 390×844, tablet 833×910, desktop 1440×900) that:
  - the pattern is visible around the board edges on mobile,
  - the board remains centered,
  - the game UI panels are still legible.