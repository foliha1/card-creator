# WHOOP! WHOOP! — Rules

**Version 6.6**

> Note: this file did not exist in the repository before v6.4. It is the
> canonical written rulebook, and rules changes have a single home here.

---

## The Table

- A grid of face-down cards (3x2 or 3x3) with a draw pile beside it.
- Each card has a **shape**, a **number** and a **colour**.
- Play is **turn-based** and rotates clockwise.

## A Round

1. **The roll.** The roller rolls the single die. It lands on one attribute:
   **SHAPE**, **NUMBER** or **COLOR**. That is the round's matching rule.
2. **Flipping.** Starting with the roller, each player in turn flips one card
   face-up for a moment, then it turns back down. Everyone sees it — remember it.
3. **Claiming.** At any point a player may shout **WHOOP! WHOOP!** and name two
   cards they believe match on the rule.
4. **The round ends** when a claim is correct, or when a full rotation of flips
   passes with no claim at all (the rotation backstop).

## Scoring

- **Correct claim:** you take the two cards into your score pile (+2), and you
  become the next roller. Every card is worth one point.
- **No-claim rotation:** the roll passes clockwise to the next player.

## If Your Claim Is WRONG

- The two cards you named stay **face-up** for the rest of the round.
- You **return one card from your score pile** to the **bottom of the draw
  pile**. You choose which card — all cards are worth one point, so the choice
  costs you the same either way.
- If your score pile is **empty**, you return nothing. The face-up cards are the
  whole penalty.
- Nothing is tracked, nothing persists, nothing is owed. You keep flipping, you
  keep claiming, you can still roll. The penalty is paid the moment it happens.
- The face-up cards turn back down at the round boundary as normal.

## Ending the Game

Once the draw pile is empty, the game **ends when two consecutive full
rotations pass with no correct claim**. A single quiet rotation is not enough —
the table gets a second one. Any correct claim resets the count to zero, and so
does a quiet rotation taken while the draw pile still has cards in it.

Any unmatched cards left on the table are stranded and score for nobody.

If the grid drains to zero through correct claims, the game ends immediately
regardless of the count.

Count piles. **Most cards wins.** Ties go to the player who made the most recent
correct claim.

---

## Disputes

| Situation | Ruling |
| --- | --- |
| Two players claim at once | The first claim to reach the table wins the window; the other is void and carries no penalty. |
| A claim is cancelled before naming two cards | No penalty. The interrupted player finishes their flip turn. |
| Which card is returned on a wrong claim | The claimant chooses. All cards are worth one point, so any choice is equivalent. |
| A wrong claim with an empty score pile | Nothing is returned. The two face-up cards are the entire penalty. |
| A card is returned to an empty draw pile | It becomes the new bottom — and therefore the top — of the pile, and refills the grid as normal. |
| A player leaves mid-round | Their seat and pile are kept; their flip turn is passed over until they return. |
| A correct claim lands after one quiet rotation | The count resets to zero. Two consecutive quiet rotations are needed to end the game. |
| A quiet rotation while the draw pile still has cards | It does not count. The count resets to zero; only rotations on an empty pile accumulate. |
| The grid empties through correct claims | The game ends immediately, whatever the quiet-rotation count is. |

---

## Quick Reference

| | |
| --- | --- |
| Dice per round | 1 |
| Correct claim | Take both cards (+2), claimer rolls next |
| Wrong claim | Named cards stay face-up for the round; return one card from your pile to the bottom of the draw pile |
| Wrong claim, empty pile | Return nothing; face-up cards only |
| Penalty duration | None — paid instantly, nothing tracked |
| No-claim rotation | Roll passes clockwise |
| Game end | Draw pile empty + **two consecutive** no-claim rotations → game over, unmatched cards score for nobody |
| Game end (alternate) | Grid drains to zero through correct claims → game over immediately |
| Winner | Most cards; ties to the most recent correct claim |

---

## Version History

### v6.7 — Digital-only daily puzzle mode (`/today`)
A single-player, digital-only mode that is **not** a game of Whoop Whoop: one
board, one die, one solve. Six cards deal face down, all six flip face up for
**five seconds** with a visible countdown, then flip back down. Only then does
the die roll. A clock counts up, shown to one decimal, from the moment the die
lands. The player calls WHOOP! WHOOP! and taps two cards: a correct pair stops
the clock and ends the puzzle; a wrong pair adds **one second** to the final
time, counts as a wrong call, and play continues with the cards still down.
There is no draw pile, no refill, no rotation, no re-roll and no opponent. The
board and the die come from that day's UTC seed, so every player worldwide gets
the identical puzzle, and one attempt per day is enforced locally.
**Rationale:** the daily is a recall test, not a game. Because the rule arrives
after the board is hidden, it isolates The Shift and makes speed a fair measure.
Table play is unaffected by this mode.

### v6.6 — Game end requires two consecutive quiet rotations
Once the draw pile is empty, the game now ends only after **two consecutive**
full rotations pass with no correct claim. A correct claim resets the count, and
so does a quiet rotation taken while the draw pile still holds cards.
**Rationale:** at two seats a rotation is only two flips, so the single-rotation
trigger fired easily and ended games with the whole board still on the table.
Last Call used to harvest that situation and it has been removed. Requiring two
consecutive quiet rotations makes an accidental early finish much less likely at
small tables without reintroducing a separate mode. This supersedes the
single-rotation trigger introduced when Last Call was removed in v6.5.

The other end-game route is unchanged: if the grid drains to zero through
correct claims, the game ends immediately.

### v6.5 — Card return replaces the lockout; Last Call removed
A wrong claim now costs one card from the claimant's score pile, returned to the
bottom of the draw pile. The round-long lockout is gone.
**Rationale:** the lockout required the table to remember who was locked out
across round boundaries that arrive unpredictably, and in play that proved
unreliable. A card return is self-executing, fully public, and denominated in
the same currency as the reward — you win cards, you lose cards. This supersedes
the v6.4 lockout one day after it was written.

Last Call is **removed**, not deferred. The end-game trigger is unchanged; the
game simply ends there, and unmatched cards score for nobody.

The new penalty is deliberately **softer** than the lockout: a wrong claimant
stays in the round and can claim again immediately. That shifts the game
slightly away from cautious memory play and toward speed.

### v6.4 — Wrong-claim penalty becomes a round-long lockout (superseded by v6.5)
A wrong claim locked the claimer out of flipping, claiming and rolling for the
remainder of the round, clearing at the round boundary.

### v6.2 — Deferred skip penalty (superseded by v6.4)
A wrong claim owed one forfeited flip, consumed when that player's turn next
came around, persisting across round boundaries.

### v6.1 — Single-die core
Every round rolls exactly one die and one matching attribute.

### v6.8 — Daily puzzle: three rounds (digital only)

- `/today` opens on a static ready screen (puzzle number, date, Play). Nothing
  runs until Play is pressed; if today's attempt is already stored, the result
  screen shows instead.
- Nine cards deal face down (3×3), flip face up for a 5-second countdown, then
  flip down for good. There is no second reveal.
- Three rounds. Each round rolls one fresh die from the daily seed. A correct
  pair is removed from the board permanently (9 → 7 → 5); no refills.
- A wrong pair adds 1 second, increments wrong calls, and the round continues
  with the cards still down.
- One clock across all three rounds, paused during every roll animation.
- All three rolls are drawn from the seeded stream at init and validated so that
  every reachable board still holds a pair — the player never sees a re-roll.
- One attempt per day (localStorage). Result screen: puzzle number, total time,
  wrong calls, and the three rules rolled.
