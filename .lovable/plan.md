
# Full-screen multiplayer route (branch experiment)

Multiplayer today renders inside a 440×900 DesktopShell window whose intrinsic content (~877px) exceeds usable space (~844px). Uniform scaling shrinks frame + content together, so it can't recover the clipped rows. This change moves multiplayer out of the window system entirely into a dedicated full-screen route. Solo, DesktopShell, and Window.tsx are untouched.

## 1. Routing

`src/App.tsx`
- Add a new route: `<Route path="/play/:roomCode" element={<MultiplayerPage />} />` (replaces the current mapping of that path to `Index`).
- Add `<Route path="/play" element={<MultiplayerPage />} />` for the no-code entry.
- `/` still renders `Index` (DesktopShell) unchanged.

`src/pages/Index.tsx`
- Remove the `useParams` room-code read and the `initialRoomCode` prop passed to `DesktopShell` (it's now dead on `/`). Keep all Helmet/JSON-LD as-is.

`src/components/DesktopShell.tsx`
- Drop the `initialRoomCode` prop and the auto-open-multiplayer effect on line 98.
- Change the taskbar/desktop MULTIPLAYER launcher so clicking it does `navigate("/play")` (via `react-router-dom`) instead of `openWindow("multiplayer")`.
- Leave the `"multiplayer"` window id, size table, and lazy import in place but unreachable — or remove those entries. Either way, no other window changes.

## 2. New full-screen page

`src/pages/MultiplayerPage.tsx` (new)
- Reads `roomCode` from `useParams`.
- Root container:
  ```
  height: 100dvh
  display: flex
  flexDirection: column
  overflow: hidden
  boxSizing: border-box
  background: COLORS.surface
  ```
- Renders the existing `MultiplayerWindow` component inside it (which already contains the nickname step, lobby, and `MultiplayerGameView`). Wraps with `Helmet` for a multiplayer-specific title/description.
- Passes `initialRoomCode={roomCode}` through so the auto-join flow keeps working.

## 3. Make MultiplayerWindow / MultiplayerGameView fill their parent

`src/components/MultiplayerWindow.tsx`
- Change the outer container from its current fixed-window layout to `flex: 1 1 auto; minHeight: 0; display: flex; flexDirection: column` so it fills the page.
- Nickname step and lobby screens: keep their transcribed pixel values but center them inside the flex parent (`margin: auto`) so they sit sensibly at any viewport instead of hugging a 440-wide frame.

`src/components/MultiplayerGameView.tsx`
- Keep every transcribed row unchanged: RoundBar 40 + OpponentRow 64 + ScoreRow 65.32 + action row 110.94, all gaps 8, all colors/radii/borders exactly as-is. (Note: RoundBar is 40 in the transcribed constants; the 64 in the brief refers to OpponentRow — none of these numbers are being touched.)
- Root already is `flex column` with `height: 100%`; leave that. The card-area wrapper (currently `flex: 1 1 auto`) stays.
- Replace the inner grid:
  - Remove per-card `aspectRatio: "104.33 / 146.07"` on both occupied and empty slots.
  - Grid becomes:
    ```
    aspectRatio: "328.99 / 454.21"
    maxWidth: 100%
    maxHeight: 100%
    margin: auto
    gridTemplateColumns: repeat(3, 1fr)
    gridTemplateRows: repeat(3, 1fr)
    gap: 8
    ```
  - Cells derive card aspect automatically from the grid rows/cols.
- No logic changes. No token changes.

## 4. Non-goals

- No edits to `useGameState.ts`, `useMultiplayerGame.ts`, `publicState.ts`, `claim-lock`, or tests.
- `Window.tsx`, `GameWindow.tsx`, `DesktopShell`'s window sizing/scaling logic all stay exactly as they are.
- Solo mode remains a window inside DesktopShell.

## 5. Verification

Drive Playwright at 375×667, 390×844, 1440×750, 1440×1100. For each: navigate to `/play`, complete nickname, host a room, open a second context as joiner, start the game, screenshot. Confirm:
- Full 3×3 board visible, centered, no clipping, no scrollbars.
- RoundBar, OpponentRow, ScoreRow, DieBox, WHOOP/SELECT MATCH/YOUR ROLL button all fully on screen and clickable.
- Cancel Match Selection banner reachable during a claim.
- Nickname + lobby screens don't sit inside a tiny 440px column.
- `/` (DesktopShell + solo) looks identical to before.
- `bunx vitest run` — all 105 tests still green.

## Technical notes

- `100dvh` handles mobile URL-bar collapse correctly; do not use `100vh`.
- The 3×3 grid uses `aspectRatio` + `maxWidth/maxHeight: 100%` so the browser picks whichever dimension is the binding constraint — this is what makes it fit both short-and-wide and tall-and-narrow viewports without JS measurement.
- `MultiplayerWindow` currently assumes it lives inside a fixed-size Window; the only structural change it needs is its outermost wrapper switching to flex-fill. Internal panels keep their transcribed pixel values.
- The `"multiplayer"` entry can remain in `DesktopShell`'s window tables without being opened; simplest safe change is to leave the tables and only rewire the launcher click handler.
