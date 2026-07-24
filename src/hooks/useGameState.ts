import { useReducer, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, createDeck, ATTRIBUTES } from "@/cardData";
import { createOpponentMemory } from "@/lib/opponentMemory";

type MessageType = "info" | "success" | "error" | "warning";

const PLAYERS = ["you", "opponent"] as const;
export const OPPONENT_TUNING = {
  reactionMinMs: 2500,
  reactionMaxMs: 5500,
  confidenceThreshold: 0.55,
  thinkDelayMs: 1400,
} as const;
const REVEAL_MS = 2000;

function rollRandomAttributes(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)]);
  }
  return result;
}

// v6.1 Single-Die Core: always roll exactly one die.
function getDieCount(): number {
  return 1;
}

function cardsMatchOnAttribute(a: Card, b: Card, attr: string): boolean {
  switch (attr) {
    case "SHAPE": return a.shape === b.shape;
    case "NUMBER": return a.number === b.number;
    case "COLOR": return a.color === b.color;
    default: return false;
  }
}

function cardsMatchRule(a: Card, b: Card, rule: string[]): boolean {
  return rule.every((attr) => cardsMatchOnAttribute(a, b, attr));
}

function hasValidPair(grid: (Card | null)[], rule: string[]): boolean {
  const cards = grid.filter((c): c is Card => c !== null);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardsMatchRule(cards[i], cards[j], rule)) return true;
    }
  }
  return false;
}

function hasAnyValidPair(grid: (Card | null)[]): boolean {
  const allRules: string[][] = [["SHAPE"], ["NUMBER"], ["COLOR"]];
  return allRules.some((rule) => hasValidPair(grid, rule));
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function computeRule(values: string[]): { rule: string[] } {
  return { rule: [values[0]] };
}

// ============================================================================
// Reducer-driven control flow
//
// A single PHASE governs what actions are legal. All timed actions carry a
// monotonically-increasing `token`; the reducer ignores stale completions
// whose token doesn't match the current inFlight action. That single check
// replaces the previous swarm of shadow-ref guards.
// ============================================================================

type Phase =
  | "AWAITING_ROLL"
  | "FLIPPING"
  | "CLAIM_SELECTING"
  | "CLAIM_RESOLVING"
  | "LAST_CALL"
  | "GAME_OVER";

type InFlight =
  | null
  | { kind: "flip"; token: number; by: number; idx: number }
  | { kind: "claim"; token: number; by: number; a: number; b: number };

interface State {
  phase: Phase;
  slotCount: number;
  roller: number;
  flipper: number;
  grid: (Card | null)[];
  deck: Card[];
  scores: number[];
  rule: string[];
  dieValues: string[];
  wrongBy: [Set<number>, Set<number>];
  skip: boolean[];
  flippedThisCycle: Set<number>;
  claimedThisCycle: boolean;
  drawEmpty: boolean;
  roundNum: number;
  roundsSinceClaim: number;
  allFaceUp: boolean;
  selectedCards: number[];
  matchedCards: Set<number>;
  peekingCard: number | null;
  rolling: boolean;
  message: string;
  messageType: MessageType;
  inFlight: InFlight;
  claimPending: boolean;
}

type Action =
  | { type: "INIT"; slotCount: number }
  | { type: "TUMBLE"; values: string[] }
  | { type: "ROLL_START" }
  | { type: "ROLL_LAND"; values: string[]; rule: string[] }
  | { type: "ROLL_SETTLE" }
  | { type: "HUMAN_ENTER_CLAIM" }
  | { type: "HUMAN_ENTER_CLAIM_DURING_ROLL" }
  | { type: "HUMAN_SELECT_CARD"; idx: number }
  | { type: "HUMAN_RESOLVE_MATCH" }
  | { type: "FLIP_START"; by: number; idx: number; token: number }
  | { type: "FLIP_COMPLETE"; token: number }
  | { type: "SKIP_TICK" }
  | { type: "CLAIM_START"; by: number; a: number; b: number; token: number }
  | { type: "CLAIM_RESOLVE"; token: number }
  | { type: "LAST_CALL_CLAIM"; by: number; a: number; b: number }
  | { type: "SAFETY_SWAP"; grid: (Card | null)[]; deck: Card[] }
  | { type: "REMOVE_MATCHED" }
  | { type: "SET_MESSAGE"; message: string; messageType: MessageType };

function initialState(slotCount: number): State {
  const newDeck = createDeck();
  const dealt = newDeck.splice(0, slotCount);
  const newGrid = dealt.concat(Array(slotCount - dealt.length).fill(null));
  const values = rollRandomAttributes(getDieCount());
  const { rule } = computeRule(values);
  return {
    phase: "AWAITING_ROLL",
    slotCount,
    roller: 0,
    flipper: 0,
    grid: newGrid,
    deck: newDeck,
    scores: [0, 0],
    rule,
    dieValues: values,
    wrongBy: [new Set(), new Set()],
    skip: [false, false],
    flippedThisCycle: new Set(),
    claimedThisCycle: false,
    drawEmpty: newDeck.length === 0,
    roundNum: 1,
    roundsSinceClaim: 0,
    allFaceUp: false,
    selectedCards: [],
    matchedCards: new Set(),
    peekingCard: null,
    rolling: false,
    message: "",
    messageType: "info",
    inFlight: null,
    claimPending: false,
  };
}

function refill(
  grid: (Card | null)[],
  deck: Card[],
  slots: number[]
): { grid: (Card | null)[]; deck: Card[] } {
  const g = [...grid];
  const d = [...deck];
  for (const i of slots) {
    if (d.length > 0) g[i] = d.shift()!;
    else g[i] = null;
  }
  return { grid: g, deck: d };
}

function withGameOverAnnounce(s: State): State {
  const [you, opp] = s.scores;
  const outcome =
    you > opp
      ? `You win! ${you}–${opp}`
      : opp > you
      ? `Opponent wins! ${opp}–${you}`
      : `Tie ${you}–${opp}`;
  return {
    ...s,
    phase: "GAME_OVER",
    message: `Game over — ${outcome}`,
    messageType: "info",
    inFlight: null,
    peekingCard: null,
  };
}

function startRound(s: State, winnerIndex: number | null): State {
  // GAME_OVER safety: if nothing can be played, end.
  const hasCards = s.grid.some((c) => c !== null);
  const filled = s.grid.filter((c) => c !== null).length;
  if (!hasCards && s.deck.length === 0) return withGameOverAnnounce(s);
  if (filled < 2 && s.deck.length === 0) return withGameOverAnnounce(s);

  const nextRoller =
    winnerIndex !== null ? winnerIndex : (s.roller + 1) % PLAYERS.length;
  return {
    ...s,
    phase: "AWAITING_ROLL",
    roller: nextRoller,
    flipper: nextRoller,
    wrongBy: [new Set(), new Set()],
    skip: [false, false],
    flippedThisCycle: new Set(),
    claimedThisCycle: false,
    selectedCards: [],
    matchedCards: new Set(),
    inFlight: null,
    peekingCard: null,
    roundNum: s.roundNum + 1,
    roundsSinceClaim: winnerIndex !== null ? 0 : s.roundsSinceClaim,
    claimPending: false,
  };
}

function cycleAdvance(s: State, addWho: number): State {
  const flipped = new Set(s.flippedThisCycle);
  flipped.add(addWho);
  if (flipped.size >= PLAYERS.length) {
    const noClaim = !s.claimedThisCycle;
    if (s.phase === "LAST_CALL") {
      // In Last Call, cycle just rotates flippers indefinitely — no round advance.
      const next = (s.flipper + 1) % PLAYERS.length;
      return {
        ...s,
        flipper: next,
        flippedThisCycle: new Set(),
        inFlight: null,
        peekingCard: null,
      };
    }
    if (s.drawEmpty && noClaim) {
      // Enter LAST_CALL
      const value = ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)];
      return {
        ...s,
        phase: "LAST_CALL",
        allFaceUp: true,
        wrongBy: [new Set(), new Set()],
        skip: [false, false],
        dieValues: [value],
        rule: [value],
        flippedThisCycle: new Set(),
        claimedThisCycle: false,
        roundsSinceClaim: s.roundsSinceClaim + 1,
        inFlight: null,
        peekingCard: null,
      };
    }
    // No-claim round completed: roll passes clockwise.
    return startRound({ ...s, flippedThisCycle: flipped }, null);
  }
  const next = (s.flipper + 1) % PLAYERS.length;
  return {
    ...s,
    flipper: next,
    flippedThisCycle: flipped,
    inFlight: null,
    peekingCard: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT":
      return initialState(action.slotCount);

    case "TUMBLE":
      if (!state.rolling) return state;
      return { ...state, dieValues: action.values };

    case "ROLL_START":
      if (state.phase !== "AWAITING_ROLL") return state;
      return { ...state, rolling: true };

    case "ROLL_LAND": {
      if (!state.rolling) return state;
      return {
        ...state,
        dieValues: action.values,
        rule: action.rule,
      };
    }

    case "ROLL_SETTLE": {
      if (!state.rolling) return state;
      const base = { ...state, rolling: false };
      if (state.claimPending) {
        // Human hit WHOOP during roll — go straight to selection.
        return {
          ...base,
          phase: "CLAIM_SELECTING",
          claimPending: false,
          selectedCards: [],
          matchedCards: new Set(),
          message: "Select 2 cards that match the rule.",
          messageType: "info",
        };
      }
      // Roll complete → enter flip phase, flipper = roller.
      return {
        ...base,
        phase: "FLIPPING",
        flipper: state.roller,
      };
    }

    case "HUMAN_ENTER_CLAIM": {
      if (state.phase !== "FLIPPING") return state;
      // The held (in-progress) flip counts toward the cycle regardless of
      // whether its reveal timer completes.
      const flipped = new Set(state.flippedThisCycle);
      if (state.inFlight?.kind === "flip") flipped.add(state.inFlight.by);
      else flipped.add(state.flipper);
      return {
        ...state,
        phase: "CLAIM_SELECTING",
        flippedThisCycle: flipped,
        inFlight: null,
        peekingCard: null,
        selectedCards: [],
        matchedCards: new Set(),
        message: "Select 2 cards that match the rule.",
        messageType: "info",
      };
    }

    case "HUMAN_ENTER_CLAIM_DURING_ROLL": {
      if (state.phase !== "AWAITING_ROLL") return state;
      if (state.roller !== 0) return state;
      if (state.claimPending) return state;
      return { ...state, claimPending: true };
    }

    case "HUMAN_SELECT_CARD": {
      if (state.phase !== "CLAIM_SELECTING") return state;
      const idx = action.idx;
      if (state.wrongBy[0].has(idx)) return state;
      if (state.selectedCards.includes(idx)) return state;
      if (state.grid[idx] === null) return state;
      if (state.selectedCards.length >= 2) return state;
      return { ...state, selectedCards: [...state.selectedCards, idx] };
    }

    case "HUMAN_RESOLVE_MATCH": {
      if (state.phase !== "CLAIM_SELECTING") return state;
      if (state.selectedCards.length !== 2) return state;
      const [ia, ib] = state.selectedCards;
      const a = state.grid[ia];
      const b = state.grid[ib];
      if (a && b && cardsMatchRule(a, b, state.rule)) {
        const scores = [...state.scores];
        scores[0] += 2;
        const { grid: newGrid, deck: newDeck } = refill(
          state.grid,
          state.deck,
          state.selectedCards
        );
        const draining = newDeck.length === 0;
        const post: State = {
          ...state,
          scores,
          grid: newGrid,
          deck: newDeck,
          matchedCards: new Set(state.selectedCards),
          selectedCards: [],
          claimedThisCycle: true,
          drawEmpty: state.drawEmpty || draining,
          message: "Correct! +2 points.",
          messageType: "success",
        };
        // Winner rolls: human becomes next Roller and Flipper.
        return startRound(post, 0);
      }
      // Wrong claim: expose cards to opponent (they can be claimed by them),
      // block this player from re-picking them, skip penalty, resume cycle.
      const wrongByHuman = new Set(state.wrongBy[0]);
      wrongByHuman.add(ia);
      wrongByHuman.add(ib);
      const skip = [...state.skip];
      skip[0] = true;
      const post: State = {
        ...state,
        phase: "FLIPPING",
        wrongBy: [wrongByHuman, state.wrongBy[1]],
        skip,
        selectedCards: [],
        matchedCards: new Set(),
        message: "No match! You lose your next flip.",
        messageType: "error",
      };
      // The claimant's flip was already recorded in flippedThisCycle when
      // they entered claim mode, so cycleAdvance will end the round if the
      // cycle is complete. Add 0 again is idempotent (Set).
      return cycleAdvance(post, 0);
    }

    case "FLIP_START": {
      if (state.phase !== "FLIPPING") return state;
      if (state.flipper !== action.by) return state;
      if (state.inFlight) return state;
      if (state.wrongBy[action.by].has(action.idx)) return state;
      if (state.grid[action.idx] === null) return state;
      return {
        ...state,
        inFlight: {
          kind: "flip",
          token: action.token,
          by: action.by,
          idx: action.idx,
        },
        peekingCard: action.idx,
      };
    }

    case "FLIP_COMPLETE": {
      // Stale-token guard: ignore completions whose action was superseded.
      if (state.inFlight?.kind !== "flip") return state;
      if (state.inFlight.token !== action.token) return state;
      const who = state.inFlight.by;
      return cycleAdvance(state, who);
    }

    case "SKIP_TICK": {
      if (state.phase !== "FLIPPING") return state;
      if (state.inFlight) return state;
      const who = state.flipper;
      if (!state.skip[who]) return state;
      const skip = [...state.skip];
      skip[who] = false;
      // Consumed skip counts as this player's flip opportunity.
      return cycleAdvance({ ...state, skip }, who);
    }

    case "CLAIM_START": {
      // Opponent-initiated claim (interrupts any in-flight flip).
      if (
        state.phase !== "FLIPPING" &&
        state.phase !== "CLAIM_SELECTING" // safety, ignore
      ) {
        return state;
      }
      if (state.phase === "CLAIM_SELECTING") return state;
      if (action.by !== 1) return state; // human uses HUMAN_RESOLVE_MATCH path
      if (state.grid[action.a] === null || state.grid[action.b] === null) return state;
      if (state.wrongBy[action.by].has(action.a) || state.wrongBy[action.by].has(action.b)) return state;
      // Record claimant's flip opportunity for cycle accounting.
      const flipped = new Set(state.flippedThisCycle);
      flipped.add(action.by);
      return {
        ...state,
        phase: "CLAIM_RESOLVING",
        flippedThisCycle: flipped,
        peekingCard: null,
        inFlight: {
          kind: "claim",
          token: action.token,
          by: action.by,
          a: action.a,
          b: action.b,
        },
      };
    }

    case "CLAIM_RESOLVE": {
      if (state.inFlight?.kind !== "claim") return state;
      if (state.inFlight.token !== action.token) return state;
      const { by, a, b } = state.inFlight;
      const cardA = state.grid[a];
      const cardB = state.grid[b];
      if (cardA && cardB && cardsMatchRule(cardA, cardB, state.rule)) {
        const scores = [...state.scores];
        scores[by] += 2;
        const { grid: newGrid, deck: newDeck } = refill(
          state.grid,
          state.deck,
          [a, b]
        );
        const draining = newDeck.length === 0;
        const post: State = {
          ...state,
          scores,
          grid: newGrid,
          deck: newDeck,
          claimedThisCycle: true,
          drawEmpty: state.drawEmpty || draining,
          message:
            by === 1 ? "Opponent claim — correct! +2" : "Correct! +2 points.",
          messageType: by === 1 ? "warning" : "success",
          inFlight: null,
        };
        return startRound(post, by);
      }
      // Wrong opponent claim — expose cards to the other player, penalize claimant.
      const wrongForBy = new Set(state.wrongBy[by]);
      wrongForBy.add(a);
      wrongForBy.add(b);
      const nextWrongBy: [Set<number>, Set<number>] =
        by === 0 ? [wrongForBy, state.wrongBy[1]] : [state.wrongBy[0], wrongForBy];
      const skip = [...state.skip];
      skip[by] = true;
      const post: State = {
        ...state,
        phase: "FLIPPING",
        wrongBy: nextWrongBy,
        skip,
        inFlight: null,
        message:
          by === 1
            ? "Opponent claim — wrong! They lose their next flip."
            : "No match! You lose your next flip.",
        messageType: "info",
      };
      return cycleAdvance(post, by);
    }

    case "LAST_CALL_CLAIM": {
      if (state.phase !== "LAST_CALL") return state;
      const { by, a, b } = action;
      if (a === b) return state;
      const cardA = state.grid[a];
      const cardB = state.grid[b];
      if (!cardA || !cardB) return state;
      if (!cardsMatchRule(cardA, cardB, state.rule)) return state;
      const newGrid = [...state.grid];
      newGrid[a] = null;
      newGrid[b] = null;
      const scores = [...state.scores];
      scores[by] += 2;
      const hasCards = newGrid.some((c) => c !== null);
      const stillPlayable = hasValidPair(newGrid, state.rule);
      const post: State = {
        ...state,
        grid: newGrid,
        scores,
        message:
          by === 1
            ? "Last Call — Auntie O. claimed! +2"
            : "Last Call — you claimed! +2",
        messageType: by === 1 ? "warning" : "success",
      };
      if (!hasCards || !stillPlayable) return withGameOverAnnounce(post);
      return post;
    }

    case "SAFETY_SWAP":
      return {
        ...state,
        grid: action.grid,
        deck: action.deck,
        message: "Refreshing grid — no possible matches!",
        messageType: "warning",
      };

    case "REMOVE_MATCHED": {
      if (state.matchedCards.size === 0) return state;
      const g = [...state.grid];
      state.matchedCards.forEach((i) => { g[i] = null; });
      return { ...state, grid: g };
    }

    case "SET_MESSAGE":
      return { ...state, message: action.message, messageType: action.messageType };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useGameState(gridSize: "3x2" | "3x3" = "3x2") {
  const slotCount = gridSize === "3x3" ? 9 : 6;
  const [state, dispatch] = useReducer(reducer, slotCount, initialState);

  // Read-latest snapshot for timer callbacks (never used for guards — only
  // to compute picks/candidates from the freshest grid/memory).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Monotonic token allocator (unique across the hook's lifetime).
  const tokenRef = useRef(0);
  const nextToken = () => ++tokenRef.current;

  const memoryRef = useRef(createOpponentMemory());
  const prevPeekingRef = useRef<number | null>(null);
  const prevGridRef = useRef<(Card | null)[]>(state.grid);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppClaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppClaimResolveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-init when slotCount changes.
  const firstSlotRef = useRef(slotCount);
  useEffect(() => {
    if (firstSlotRef.current === slotCount) return;
    firstSlotRef.current = slotCount;
    memoryRef.current.reset();
    prevPeekingRef.current = null;
    dispatch({ type: "INIT", slotCount });
  }, [slotCount]);

  // ------------------------------------------------------------------
  // Roll animation (shared by human rollDice, opponent auto-roll, and
  // the "claim during roll" flow). Two dispatches with a small settle
  // window preserve the visual cadence of the original implementation.
  // ------------------------------------------------------------------
  const runRollAnimation = useCallback((): Promise<string[]> => {
    return new Promise((resolve) => {
      dispatch({ type: "ROLL_START" });
      const count = getDieCount();
      const finalValues = rollRandomAttributes(count);
      const { rule } = computeRule(finalValues);
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = setInterval(() => {
        dispatch({ type: "TUMBLE", values: rollRandomAttributes(count) });
      }, 100);
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = setTimeout(() => {
        rollTimeoutRef.current = null;
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        dispatch({ type: "ROLL_LAND", values: finalValues, rule });
        if (rollSettleRef.current) clearTimeout(rollSettleRef.current);
        rollSettleRef.current = setTimeout(() => {
          rollSettleRef.current = null;
          dispatch({ type: "ROLL_SETTLE" });
          resolve(rule);
        }, 300);
      }, 800);
    });
  }, []);

  // Human roll
  const rollDice = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase !== "AWAITING_ROLL") return;
    if (s.roller !== 0) return;
    if (s.rolling) return;
    await runRollAnimation();
  }, [runRollAnimation]);

  // Legacy export — kept to preserve the return surface. Callers who want a
  // Promise can still await it; no consumer currently does.
  const doRollDice = runRollAnimation;

  // Opponent auto-roll
  useEffect(() => {
    if (state.phase !== "AWAITING_ROLL") return;
    if (state.roller !== 1) return;
    if (state.rolling) return;
    const t = setTimeout(() => {
      runRollAnimation();
    }, OPPONENT_TUNING.thinkDelayMs);
    return () => clearTimeout(t);
  }, [state.phase, state.roller, state.rolling, runRollAnimation]);

  // ------------------------------------------------------------------
  // Human peek — dispatches FLIP_START + schedules FLIP_COMPLETE.
  // ------------------------------------------------------------------
  const peekCard = useCallback((index: number) => {
    const s = stateRef.current;
    if (s.phase !== "FLIPPING") return;
    if (s.flipper !== 0) return;
    if (s.inFlight) return;
    if (s.wrongBy[0].has(index)) return;
    if (s.grid[index] === null) return;
    const token = nextToken();
    dispatch({ type: "FLIP_START", by: 0, idx: index, token });
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      peekTimerRef.current = null;
      dispatch({ type: "FLIP_COMPLETE", token });
    }, REVEAL_MS);
  }, []);

  // ------------------------------------------------------------------
  // Skip penalty — consume when it's the penalized player's turn to flip.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (state.phase !== "FLIPPING") return;
    if (state.inFlight) return;
    if (!state.skip[state.flipper]) return;
    dispatch({ type: "SKIP_TICK" });
  }, [state.phase, state.flipper, state.inFlight, state.skip]);

  // ------------------------------------------------------------------
  // Opponent auto-flip. Deps intentionally minimal (phase + flipper +
  // inFlight-nullness) so the effect doesn't re-run when the grid or
  // peeking card changes mid-reveal. Latest data is read via stateRef.
  // ------------------------------------------------------------------
  const inFlightNullMarker = state.inFlight === null;
  useEffect(() => {
    if (state.phase !== "FLIPPING") return;
    if (state.flipper !== 1) return;
    if (!inFlightNullMarker) return;
    if (oppDelayRef.current) clearTimeout(oppDelayRef.current);
    oppDelayRef.current = setTimeout(() => {
      oppDelayRef.current = null;
      const s = stateRef.current;
      if (s.phase !== "FLIPPING" || s.flipper !== 1 || s.inFlight) return;
      const candidates = s.grid
        .map((c, i) => (c !== null && !s.wrongBy[1].has(i) ? i : -1))
        .filter((i) => i !== -1);
      if (candidates.length === 0) {
        // Nothing to flip — count this as the opponent's flip opportunity.
        dispatch({ type: "SKIP_TICK" });
        return;
      }
      const unknown = candidates.filter(
        (i) => memoryRef.current.recall(i) === null
      );
      const pool = unknown.length > 0 ? unknown : candidates;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const token = nextToken();
      dispatch({ type: "FLIP_START", by: 1, idx: pick, token });
      if (oppRevealRef.current) clearTimeout(oppRevealRef.current);
      oppRevealRef.current = setTimeout(() => {
        oppRevealRef.current = null;
        dispatch({ type: "FLIP_COMPLETE", token });
      }, REVEAL_MS);
    }, OPPONENT_TUNING.thinkDelayMs);
    return () => {
      if (oppDelayRef.current) {
        clearTimeout(oppDelayRef.current);
        oppDelayRef.current = null;
      }
    };
  }, [state.phase, state.flipper, inFlightNullMarker]);

  // ------------------------------------------------------------------
  // Claim intents
  // ------------------------------------------------------------------
  const enterClaimMode = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "CLAIM_SELECTING" || s.phase === "CLAIM_RESOLVING") return;
    if (s.phase === "GAME_OVER") return;
    if (s.rolling) return;
    // Cancel any in-flight human peek timer.
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    if (s.phase === "AWAITING_ROLL") {
      if (s.roller !== 0) return;
      dispatch({ type: "HUMAN_ENTER_CLAIM_DURING_ROLL" });
      runRollAnimation();
      return;
    }
    dispatch({ type: "HUMAN_ENTER_CLAIM" });
  }, [runRollAnimation]);

  const selectCard = useCallback((index: number) => {
    dispatch({ type: "HUMAN_SELECT_CARD", idx: index });
  }, []);

  const resolveMatch = useCallback(() => {
    dispatch({ type: "HUMAN_RESOLVE_MATCH" });
  }, []);

  const opponentClaim = useCallback((a: number, b: number) => {
    const s = stateRef.current;
    if (s.phase !== "FLIPPING") return;
    if (a === b) return;
    if (s.grid[a] === null || s.grid[b] === null) return;
    if (s.wrongBy[1].has(a) || s.wrongBy[1].has(b)) return;
    const token = nextToken();
    dispatch({ type: "CLAIM_START", by: 1, a, b, token });
    if (oppClaimResolveRef.current) clearTimeout(oppClaimResolveRef.current);
    oppClaimResolveRef.current = setTimeout(() => {
      oppClaimResolveRef.current = null;
      dispatch({ type: "CLAIM_RESOLVE", token });
    }, 1600);
  }, []);

  // Legacy export — reducer resolves opponent claim on its own timer, but
  // the return surface still exposes this callable.
  const resolveOpponentClaim = useCallback(() => {
    // No-op: opponent claim resolution is now token-driven inside the reducer.
  }, []);

  const claimLastCall = useCallback((a: number, b: number) => {
    dispatch({ type: "LAST_CALL_CLAIM", by: 0, a, b });
  }, []);

  const removeMatchedFromGrid = useCallback(() => {
    dispatch({ type: "REMOVE_MATCHED" });
  }, []);

  // ------------------------------------------------------------------
  // Dead-grid safety valve (unchanged rule).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (
      state.phase === "GAME_OVER" ||
      state.phase === "CLAIM_SELECTING" ||
      state.phase === "CLAIM_RESOLVING" ||
      state.rolling
    ) {
      return;
    }
    const grid = state.grid;
    const deck = state.deck;
    if (!grid.some((c) => c !== null)) return;
    if (deck.length === 0) return;
    if (hasAnyValidPair(grid)) return;
    const filledIndices = grid
      .map((c, i) => (c !== null ? i : -1))
      .filter((i) => i !== -1);
    if (filledIndices.length < 2 || deck.length < 2) return;
    const swapIndices = shuffleArray([...filledIndices]).slice(0, 2);
    const newDeck = [...deck];
    const newGrid = [...grid];
    for (const idx of swapIndices) {
      if (newGrid[idx]) newDeck.push(newGrid[idx]!);
    }
    shuffleArray(newDeck);
    for (const idx of swapIndices) {
      newGrid[idx] = newDeck.length > 0 ? newDeck.shift()! : null;
    }
    dispatch({ type: "SAFETY_SWAP", grid: newGrid, deck: newDeck });
  }, [state.grid, state.deck, state.phase, state.rolling]);

  // ------------------------------------------------------------------
  // Memory bookkeeping
  // ------------------------------------------------------------------
  // Forget slots whose card changed or emptied.
  useEffect(() => {
    const prev = prevGridRef.current;
    for (let i = 0; i < state.grid.length; i++) {
      const pc = prev[i] ?? null;
      const cc = state.grid[i] ?? null;
      if ((pc?.id ?? null) !== (cc?.id ?? null)) {
        memoryRef.current.forget(i);
      }
    }
    prevGridRef.current = state.grid;
  }, [state.grid]);

  // Observe on completed reveal + schedule opponent claim decision.
  useEffect(() => {
    const prev = prevPeekingRef.current;
    prevPeekingRef.current = state.peekingCard;
    if (prev === null || state.peekingCard !== null) return;
    const card = state.grid[prev];
    memoryRef.current.decayAll();
    if (card) memoryRef.current.observe(prev, card);

    if (
      state.phase !== "FLIPPING" ||
      state.inFlight // don't schedule while a claim is already resolving
    ) return;
    const excluded = new Set<number>(state.wrongBy[1]);
    state.grid.forEach((c, i) => { if (c === null) excluded.add(i); });
    const best = memoryRef.current.bestPair(state.rule, excluded);
    if (!best || best.confidence < OPPONENT_TUNING.confidenceThreshold) return;
    const span = OPPONENT_TUNING.reactionMaxMs - OPPONENT_TUNING.reactionMinMs;
    const t = Math.max(
      0,
      Math.min(
        1,
        (best.confidence - OPPONENT_TUNING.confidenceThreshold) /
          (2 - OPPONENT_TUNING.confidenceThreshold)
      )
    );
    const delay = OPPONENT_TUNING.reactionMaxMs - t * span;
    if (oppClaimTimerRef.current) clearTimeout(oppClaimTimerRef.current);
    oppClaimTimerRef.current = setTimeout(() => {
      oppClaimTimerRef.current = null;
      opponentClaim(best.a, best.b);
    }, delay);
  }, [state.peekingCard, state.grid, state.phase, state.inFlight, state.wrongBy, state.rule, opponentClaim]);

  // Cancel a pending opponent claim decision on round/phase change.
  useEffect(() => {
    if (oppClaimTimerRef.current) {
      clearTimeout(oppClaimTimerRef.current);
      oppClaimTimerRef.current = null;
    }
  }, [state.roundNum, state.phase]);

  // ------------------------------------------------------------------
  // Opponent Last Call scanner
  // ------------------------------------------------------------------
  useEffect(() => {
    if (state.phase !== "LAST_CALL") return;
    const delay = 1200 + Math.random() * 1600;
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s.phase !== "LAST_CALL") return;
      const cards = s.grid
        .map((c, i) => ({ c, i }))
        .filter((x): x is { c: Card; i: number } => x.c !== null);
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          if (cardsMatchRule(cards[i].c, cards[j].c, s.rule)) {
            pairs.push([cards[i].i, cards[j].i]);
          }
        }
      }
      if (pairs.length === 0) return;
      const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
      dispatch({ type: "LAST_CALL_CLAIM", by: 1, a, b });
    }, delay);
    return () => clearTimeout(t);
  }, [state.phase, state.grid, state.scores]);

  // ------------------------------------------------------------------
  // Derived return surface (byte-identical to the previous shape).
  // ------------------------------------------------------------------
  const opponentClaimingValue = useMemo(
    () =>
      state.inFlight?.kind === "claim" && state.inFlight.by === 1
        ? { indices: [state.inFlight.a, state.inFlight.b] as [number, number] }
        : null,
    [state.inFlight]
  );

  const wrongCardsUnion = useMemo(() => {
    const u = new Set<number>(state.wrongBy[0]);
    state.wrongBy[1].forEach((i) => u.add(i));
    return u;
  }, [state.wrongBy]);

  return {
    deck: state.deck,
    grid: state.grid,
    matchRule: state.rule,
    dieValues: state.dieValues,
    scores: state.scores,
    roundNum: state.roundNum,
    players: PLAYERS as unknown as string[],
    rollerIndex: state.roller,
    flipperIndex: state.flipper,
    skipNextFlip: state.skip,
    peekingCard: state.peekingCard,
    claimMode: state.phase === "CLAIM_SELECTING",
    selectedCards: state.selectedCards,
    wrongCards: wrongCardsUnion,
    wrongByMe: state.wrongBy[0],
    matchedCards: state.matchedCards,
    gameOver: state.phase === "GAME_OVER",
    message: state.message,
    messageType: state.messageType,
    rolling: state.rolling,
    peekCard,
    enterClaimMode,
    selectCard,
    removeMatchedFromGrid,
    resolveMatch,
    doRollDice,
    opponentClaiming: opponentClaimingValue,
    opponentClaim,
    resolveOpponentClaim,
    rollPhase: state.phase === "AWAITING_ROLL",
    rollDice,
    lastCall: state.phase === "LAST_CALL",
    allFaceUp: state.allFaceUp,
    drawEmpty: state.drawEmpty,
    roundsSinceClaim: state.roundsSinceClaim,
    claimLastCall,
    claimPending: state.claimPending,
  };
}
