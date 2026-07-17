## Plan

Make two targeted tuning changes to Auntie O.'s AI behavior.

### 1. `src/hooks/useGameState.ts` — confidence-scaled claim reaction
- Update `OPPONENT_TUNING`:
  - `reactionMinMs: 3500`
  - `reactionMaxMs: 7000`
  - keep `confidenceThreshold: 0.55`
- Replace the flat random delay in the opponent claim scheduler (currently `reactionMinMs + Math.random() * span`) with a confidence-scaled delay:
  - `t = clamp((best.confidence - confidenceThreshold) / (2 - confidenceThreshold), 0, 1)`
  - `delay = reactionMaxMs - t * (reactionMaxMs - reactionMinMs)`
- Result: high-confidence pairs are claimed faster (~3.5s), shaky pairs slower (~7s), giving the human more time to beat her on uncertain memories.

### 2. `src/lib/opponentMemory.ts` — faster memory decay and corruption
- Change decay multiplier from `0.88` to `0.85`.
- Change corruption probability from `0.12` to `0.16`.
- Result: older memories fade and corrupt faster, increasing the chance Auntie O. claims wrong — the intended "ruined dinner" behavior.

No other files or game logic will be changed.