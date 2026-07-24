# Wrong-claim cards stay exposed until end of round

## Behavior

When any player makes a wrong WHOOP:

- The two cards they picked stay **face-up** to everyone for the rest of the round.
- The player who was wrong still gets their existing penalties (locked out of those two cards, skip next flip).
- The **other** player (or Auntie O.) may include those exposed cards in their own WHOOP claim.
- All exposed cards flip back down when the round ends — whether it ends by a correct match (winner rolls) or by a full flip cycle with no claim (roll passes clockwise).
- Last Call is unaffected — everything is face-up there anyway, and `wrong` is already cleared on entry.

## Changes

### `src/hooks/useGameState.ts`

1. **Split `wrong` into two Sets on state.** Rename the current `wrong: Set<number>` to `wrongBy: [Set<number>, Set<number>]` (index 0 = you, 1 = opponent). Union = "exposed after wrong claim." Membership = "this player may not pick these."
   - Wire the derived `wrongCards` export (used by the view) to be the union of both sets so existing "is exposed?" checks keep working.
2. **HUMAN_RESOLVE_MATCH wrong branch** (L394): add `ia, ib` to `wrongBy[0]` instead of the shared `wrong`.
3. **CLAIM_RESOLVE wrong branch** (L512): add `a, b` to `wrongBy[by]`.
4. **Selection / claim guards** — allow picking cards the *other* player exposed:
   - `HUMAN_SELECT_CARD` (L356): reject only if `wrongBy[0].has(idx)`, not the union.
   - `CLAIM_START` (L462–463): reject only if `wrongBy[action.by].has(a|b)`.
   - Opponent auto-flip candidate filter (L726): exclude only `wrongBy[1]`.
   - Opponent memory `bestPair` excluded set (L876): exclude only `wrongBy[1]`.
5. **Peek / flip guards** — a player also shouldn't be able to flip a card they themselves exposed, but *should* be able to flip one the opponent exposed:
   - `peekCard` (L689) and `FLIP_START` guard (L419): reject only if `wrongBy[by].has(idx)`.
6. **Round reset** — `startRound` (L220) already clears `wrong`; update to clear both sets in `wrongBy`. This is the mechanism that flips exposed cards back down at end of round, covering both round-end paths (winner rolls after correct match, and full no-claim cycle in `cycleAdvance` which calls `startRound`).
7. **Last Call** — the transition in `cycleAdvance` (L257) already resets `wrong`; keep it clearing both sets.

### `src/components/GameWindow.tsx`

1. **Face-up rendering** (L848–855): extend the `faceUp` predicate on `<GameCard>` with `|| g.wrongCards.has(i)` so exposed cards render face-up until end of round (in addition to the transient `wrongFlash`/`wrongWash` animation).
2. **Dim styling** (L835–837): drop the `opacity: 0.55, cursor: "default"` block — exposed cards should look normal (still face-up) and be tappable when the current player is allowed to pick them. Retain the existing flash/wash animations for the moment-of-wrong feedback.
3. **Click handling** — replace the blanket `g.wrongCards.has(index)` short-circuit at L370 with a check keyed on the current player. Simplest: expose a new `wrongByMe` boolean helper from the hook (`wrongBy[0].has(idx)` from the human's perspective) and short-circuit on that. Selection during `claimMode` naturally falls through to `selectCard`, whose reducer guard now permits opponent-exposed indices.
4. **No copy changes required** — existing "No match!" toasts still apply; no new message states.

## Return-surface impact

`useGameState`'s exported `wrongCards` stays as a `Set<number>` (union of both). One new export: `wrongByMe: Set<number>` for the click-gate. All other exports unchanged, so no other component needs edits.

## Verification

1. You wrong-claim → both cards stay visibly face-up, appear normal (not dimmed), you cannot re-select or flip them, Auntie O. can claim them.
2. Auntie O. wrong-claims → both cards stay face-up, you can tap them in your next WHOOP claim, and normal-flip them if you're the flipper.
3. Round ends via correct match → all exposed cards flip back down at the roll.
4. Round ends via full no-claim cycle → same, exposed cards flip back at the passed roll.
5. Last Call still works (`wrong`/`wrongBy` cleared, everything face-up).
6. Skip-next-flip penalty for the wrong claimant still fires exactly once.
