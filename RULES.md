# WHOOP! WHOOP! — Rules

**Version 6.4**

> Note: this file did not exist in the repository before v6.4. It has been created
> here as the canonical written rulebook, reconstructed from the shipped game
> engine (`src/hooks/useGameState.ts`) so that rules changes have a single home.

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

- **Correct claim:** +2 points, and the claimer becomes the next roller.
- **No-claim rotation:** the roll passes clockwise to the next player.

## If Your Claim Is WRONG

- The two cards you named stay **face-up** for the rest of the round.
- You are **locked out for the rest of the round**. While locked out you
  **cannot flip, cannot claim, and cannot roll**. Your flip turn is simply
  passed over.
- Your locked-out turn **still counts** toward completing the rotation, so a
  no-claim rotation can still end the round normally.
- The lockout **clears at the round boundary**, together with the face-up
  penalty cards, which turn back down. It lasts exactly as long as those cards
  are face-up — nothing to track, nothing to remember.
- Because a locked-out player cannot claim, they cannot win the round or seize
  the roll. The roll can still pass to them clockwise on a no-claim rotation —
  by then their lockout has cleared.

## Last Call

When the draw pile is empty and a full rotation passes with no claim, the game
enters **Last Call**: every card turns face-up, one final rule is rolled, and
all penalties are cleared. Players claim matching pairs until no valid pair on
the rule remains. Highest score wins.

---

## Disputes

| Situation | Ruling |
| --- | --- |
| Two players claim at once | The first claim to reach the table wins the window; the other is void and carries no penalty. |
| A claim is cancelled before naming two cards | No penalty. The interrupted player finishes their flip turn. |
| A wrong-claim lockout at a round boundary | It ends there. The lockout is round-scoped and never carries into the next round. |
| A locked-out player's turn comes around | It is passed over, but it counts toward the rotation backstop. |
| A player leaves mid-round | Their seat and score are kept; their flip turn is passed over until they return. |

---

## Quick Reference

| | |
| --- | --- |
| Dice per round | 1 |
| Correct claim | +2, claimer rolls next |
| Wrong claim | Named cards stay face-up; claimer **locked out for the rest of the round** (no flip, no claim, no roll) |
| Lockout duration | Round-scoped — clears at every round boundary |
| No-claim rotation | Roll passes clockwise |
| Last Call | Draw pile empty + no-claim rotation → all cards face-up, one final rule |

---

## Version History

### v6.4 — Wrong-claim penalty becomes a round-long lockout
A wrong claim no longer defers a single forfeited flip into future rounds.
Instead the claimer is locked out of flipping, claiming and rolling for the
remainder of the current round, and the lockout clears at the round boundary.
**Rationale:** the face-up penalty cards are the physical tracker at the table.
Tying the penalty to exactly how long those cards stay face-up means there is
no bookkeeping — no remembering who still owes a skip from two rounds ago.

### v6.2 — Deferred skip penalty (superseded by v6.4)
A wrong claim owed one forfeited flip, consumed when that player's turn next
came around, persisting across round boundaries.

### v6.1 — Single-die core
Every round rolls exactly one die and one matching attribute.
