import { useReducer, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, createDeck, ATTRIBUTES } from "@/cardData";
import { createOpponentMemory, OpponentMemory } from "@/lib/opponentMemory";

type MessageType = "info" | "success" | "error" | "warning";

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

function defaultNames(seatCount: number): string[] {
  const base = ["you", "opponent"];
  const out: string[] = [];
  for (let i = 0; i < seatCount; i++) {
    out.push(base[i] ?? `player ${i + 1}`);
  }
  return out;
}

function emptyWrongBy(seatCount: number): Set<number>[] {
  return Array.from({ length: seatCount }, () => new Set<number>());
}

// ============================================================================
// Reducer-driven control flow
// ============================================================================

export type Phase =
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

export interface State {
  phase: Phase;
  slotCount: number;
  seatCount: number;
  names: string[];
  roller: number;
  flipper: number;
  grid: (Card | null)[];
  deck: Card[];
  scores: number[];
  rule: string[];
  dieValues: string[];
  wrongBy: Set<number>[];
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
  claimBy: number | null;
}

export interface InitOptions {
  seatCount?: number;
  names?: string[];
}

export type Action =
  | { type: "INIT"; slotCount: number; seatCount?: number; names?: string[] }
  | { type: "TUMBLE"; values: string[] }
  | { type: "ROLL_START" }
  | { type: "ROLL_LAND"; values: string[]; rule: string[] }
  | { type: "ROLL_SETTLE" }
  | { type: "PLAYER_ENTER_CLAIM"; by: number }
  | { type: "PLAYER_ENTER_CLAIM_DURING_ROLL"; by: number }
  | { type: "PLAYER_SELECT_CARD"; by: number; idx: number }
  | { type: "PLAYER_RESOLVE_MATCH"; by: number }
  | { type: "FLIP_START"; by: number; idx: number; token: number }
  | { type: "FLIP_COMPLETE"; token: number }
  | { type: "SKIP_TICK" }
  | { type: "CLAIM_START"; by: number; a: number; b: number; token: number }
  | { type: "CLAIM_RESOLVE"; token: number }
  | { type: "LAST_CALL_CLAIM"; by: number; a: number; b: number }
  | { type: "CANCEL_CLAIM"; by: number }
  | { type: "MARK_DISCONNECTED"; seats: number[] }
  | { type: "SAFETY_SWAP"; grid: (Card | null)[]; deck: Card[] }
  | { type: "REMOVE_MATCHED" }
  | { type: "SET_MESSAGE"; message: string; messageType: MessageType };

export function initialState(slotCount: number, opts: InitOptions = {}): State {
  const seatCount = opts.seatCount ?? 2;
  const names = opts.names ?? defaultNames(seatCount);
  const newDeck = createDeck();
  const dealt = newDeck.splice(0, slotCount);
  const newGrid = dealt.concat(Array(slotCount - dealt.length).fill(null));
  const values = rollRandomAttributes(getDieCount());
  const { rule } = computeRule(values);
  return {
    phase: "AWAITING_ROLL",
    slotCount,
    seatCount,
    names,
    roller: 0,
    flipper: 0,
    grid: newGrid,
    deck: newDeck,
    scores: Array(seatCount).fill(0),
    rule,
    dieValues: values,
    wrongBy: emptyWrongBy(seatCount),
    skip: Array(seatCount).fill(false),
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
    claimBy: null,
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
  const top = Math.max(...s.scores);
  const winners = s.scores
    .map((v, i) => (v === top ? i : -1))
    .filter((i) => i !== -1);
  const outcome =
    winners.length === 1
      ? `${s.names[winners[0]]} wins! ${s.scores.join("–")}`
      : `Tie ${s.scores.join("–")}`;
  return {
    ...s,
    phase: "GAME_OVER",
    message: `Game over — ${outcome}`,
    messageType: "info",
    inFlight: null,
    peekingCard: null,
    claimBy: null,
  };
}

function startRound(s: State, winnerIndex: number | null): State {
  const hasCards = s.grid.some((c) => c !== null);
  const filled = s.grid.filter((c) => c !== null).length;
  if (!hasCards && s.deck.length === 0) return withGameOverAnnounce(s);
  if (filled < 2 && s.deck.length === 0) return withGameOverAnnounce(s);

  const nextRoller =
    winnerIndex !== null ? winnerIndex : (s.roller + 1) % s.seatCount;
  return {
    ...s,
    phase: "AWAITING_ROLL",
    roller: nextRoller,
    flipper: nextRoller,
    wrongBy: emptyWrongBy(s.seatCount),
    skip: Array(s.seatCount).fill(false),
    flippedThisCycle: new Set(),
    claimedThisCycle: false,
    selectedCards: [],
    matchedCards: new Set(),
    inFlight: null,
    peekingCard: null,
    roundNum: s.roundNum + 1,
    roundsSinceClaim: winnerIndex !== null ? 0 : s.roundsSinceClaim,
    claimPending: false,
    claimBy: null,
  };
}

function cycleAdvance(s: State, addWho: number): State {
  const flipped = new Set(s.flippedThisCycle);
  flipped.add(addWho);
  if (flipped.size >= s.seatCount) {
    const noClaim = !s.claimedThisCycle;
    if (s.phase === "LAST_CALL") {
      const next = (s.flipper + 1) % s.seatCount;
      return {
        ...s,
        flipper: next,
        flippedThisCycle: new Set(),
        inFlight: null,
        peekingCard: null,
      };
    }
    if (s.drawEmpty && noClaim) {
      const value = ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)];
      return {
        ...s,
        phase: "LAST_CALL",
        allFaceUp: true,
        wrongBy: emptyWrongBy(s.seatCount),
        skip: Array(s.seatCount).fill(false),
        dieValues: [value],
        rule: [value],
        flippedThisCycle: new Set(),
        claimedThisCycle: false,
        roundsSinceClaim: s.roundsSinceClaim + 1,
        inFlight: null,
        peekingCard: null,
        claimBy: null,
      };
    }
    return startRound({ ...s, flippedThisCycle: flipped }, null);
  }
  const next = (s.flipper + 1) % s.seatCount;
  return {
    ...s,
    flipper: next,
    flippedThisCycle: flipped,
    inFlight: null,
    peekingCard: null,
  };
}

function replaceAt<T>(arr: T[], idx: number, value: T): T[] {
  const out = arr.slice();
  out[idx] = value;
  return out;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT":
      return initialState(action.slotCount, {
        seatCount: action.seatCount ?? state.seatCount,
        names: action.names ?? state.names,
      });

    case "TUMBLE":
      if (!state.rolling) return state;
      return { ...state, dieValues: action.values };

    case "ROLL_START":
      if (state.phase !== "AWAITING_ROLL") return state;
      return { ...state, rolling: true };

    case "ROLL_LAND": {
      if (!state.rolling) return state;
      return { ...state, dieValues: action.values, rule: action.rule };
    }

    case "ROLL_SETTLE": {
      if (!state.rolling) return state;
      const base = { ...state, rolling: false };
      if (state.claimPending) {
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
      return { ...base, phase: "FLIPPING", flipper: state.roller };
    }

    case "PLAYER_ENTER_CLAIM": {
      if (state.phase !== "FLIPPING") return state;
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
        claimBy: action.by,
        message: "Select 2 cards that match the rule.",
        messageType: "info",
      };
    }

    case "PLAYER_ENTER_CLAIM_DURING_ROLL": {
      if (state.phase !== "AWAITING_ROLL") return state;
      if (state.roller !== action.by) return state;
      if (state.claimPending) return state;
      return { ...state, claimPending: true, claimBy: action.by };
    }

    case "PLAYER_SELECT_CARD": {
      if (state.phase !== "CLAIM_SELECTING") return state;
      if (state.claimBy !== action.by) return state;
      const idx = action.idx;
      if (state.wrongBy[action.by].has(idx)) return state;
      if (state.selectedCards.includes(idx)) return state;
      if (state.grid[idx] === null) return state;
      if (state.selectedCards.length >= 2) return state;
      return { ...state, selectedCards: [...state.selectedCards, idx] };
    }

    case "PLAYER_RESOLVE_MATCH": {
      if (state.phase !== "CLAIM_SELECTING") return state;
      if (state.claimBy !== action.by) return state;
      if (state.selectedCards.length !== 2) return state;
      const by = action.by;
      const [ia, ib] = state.selectedCards;
      const a = state.grid[ia];
      const b = state.grid[ib];
      if (a && b && cardsMatchRule(a, b, state.rule)) {
        const scores = replaceAt(state.scores, by, state.scores[by] + 2);
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
          claimBy: null,
          message: `${state.names[by]} — match! +2`,
          messageType: "success",
        };
        return startRound(post, by);
      }
      // Wrong claim
      const wrongForBy = new Set(state.wrongBy[by]);
      wrongForBy.add(ia);
      wrongForBy.add(ib);
      const nextWrongBy = state.wrongBy.slice();
      nextWrongBy[by] = wrongForBy;
      const skip = replaceAt(state.skip, by, true);
      const post: State = {
        ...state,
        phase: "FLIPPING",
        wrongBy: nextWrongBy,
        skip,
        selectedCards: [],
        matchedCards: new Set(),
        claimBy: null,
        message: `${state.names[by]} — no match. Skip next flip.`,
        messageType: "error",
      };
      return cycleAdvance(post, by);
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
      const skip = replaceAt(state.skip, who, false);
      return cycleAdvance({ ...state, skip }, who);
    }

    case "CLAIM_START": {
      if (state.phase !== "FLIPPING" && state.phase !== "CLAIM_SELECTING") return state;
      if (state.phase === "CLAIM_SELECTING") return state;
      if (state.grid[action.a] === null || state.grid[action.b] === null) return state;
      if (
        state.wrongBy[action.by].has(action.a) ||
        state.wrongBy[action.by].has(action.b)
      )
        return state;
      const flipped = new Set(state.flippedThisCycle);
      flipped.add(action.by);
      return {
        ...state,
        phase: "CLAIM_RESOLVING",
        flippedThisCycle: flipped,
        peekingCard: null,
        claimBy: action.by,
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
        const scores = replaceAt(state.scores, by, state.scores[by] + 2);
        const { grid: newGrid, deck: newDeck } = refill(state.grid, state.deck, [a, b]);
        const draining = newDeck.length === 0;
        const post: State = {
          ...state,
          scores,
          grid: newGrid,
          deck: newDeck,
          claimedThisCycle: true,
          drawEmpty: state.drawEmpty || draining,
          message: `${state.names[by]} — match! +2`,
          messageType: "success",
          inFlight: null,
          claimBy: null,
        };
        return startRound(post, by);
      }
      const wrongForBy = new Set(state.wrongBy[by]);
      wrongForBy.add(a);
      wrongForBy.add(b);
      const nextWrongBy = state.wrongBy.slice();
      nextWrongBy[by] = wrongForBy;
      const skip = replaceAt(state.skip, by, true);
      const post: State = {
        ...state,
        phase: "FLIPPING",
        wrongBy: nextWrongBy,
        skip,
        inFlight: null,
        claimBy: null,
        message: `${state.names[by]} — no match. Skip next flip.`,
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
      const scores = replaceAt(state.scores, by, state.scores[by] + 2);
      const hasCards = newGrid.some((c) => c !== null);
      const stillPlayable = hasValidPair(newGrid, state.rule);
      const post: State = {
        ...state,
        grid: newGrid,
        scores,
        message: `Last Call — ${state.names[by]} matched! +2`,
        messageType: "success",
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

    // Cancel-claim path for multiplayer. Resets claim state to FLIPPING with
    // NO skip penalty. claimBy transitions non-null → null, which the host
    // hook watches to bump claimWindow (so the consumed claim_locks row is
    // rotated past). Preserves flippedThisCycle: the flip that led to the
    // claim already counted. Cycle-advances so play continues.
    case "CANCEL_CLAIM": {
      if (state.phase !== "CLAIM_SELECTING") return state;
      if (state.claimBy !== action.by) return state;
      const post: State = {
        ...state,
        phase: "FLIPPING",
        selectedCards: [],
        matchedCards: new Set(),
        peekingCard: null,
        inFlight: null,
        claimBy: null,
        message: `${state.names[action.by]} — cancelled.`,
        messageType: "info",
      };
      return cycleAdvance(post, action.by);
    }

    // Piggyback on the existing skip machinery for disconnected seats:
    // marking skip[seat]=true makes SKIP_TICK auto-advance past that seat
    // when it becomes flipper. No new game-rule surface.
    case "MARK_DISCONNECTED": {
      if (!action.seats.length) return state;
      const skip = state.skip.slice();
      for (const s of action.seats) {
        if (s >= 0 && s < skip.length) skip[s] = true;
      }
      return { ...state, skip };
    }

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseGameStateOptions {
  seatCount?: number;
  botSeats?: number[];
  names?: string[];
}

export function useGameState(
  gridSize: "3x2" | "3x3" = "3x2",
  opts: UseGameStateOptions = {}
) {
  const slotCount = gridSize === "3x3" ? 9 : 6;
  const seatCount = opts.seatCount ?? 2;
  const botSeats = opts.botSeats ?? [1];
  const names = opts.names ?? defaultNames(seatCount);
  const botSeatSet = useMemo(() => new Set(botSeats), [botSeats.join(",")]);
  const humanSeat = useMemo(() => {
    for (let i = 0; i < seatCount; i++) if (!botSeatSet.has(i)) return i;
    return 0;
  }, [seatCount, botSeatSet]);
  // The scheduling bot seat (single-bot memory scheduler preserves today's
  // behaviour verbatim at N=2, botSeats=[1]). Multi-bot memory is out of scope.
  const schedulerBot = botSeats.length > 0 ? botSeats[0] : -1;

  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initialState(slotCount, { seatCount, names })
  );

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const tokenRef = useRef(0);
  const nextToken = () => ++tokenRef.current;

  const memoryRef = useRef<OpponentMemory | null>(null);
  if (botSeats.length > 0 && memoryRef.current === null) {
    memoryRef.current = createOpponentMemory();
  }
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

  const firstSlotRef = useRef(slotCount);
  useEffect(() => {
    if (firstSlotRef.current === slotCount) return;
    firstSlotRef.current = slotCount;
    memoryRef.current?.reset();
    prevPeekingRef.current = null;
    dispatch({ type: "INIT", slotCount, seatCount, names });
  }, [slotCount, seatCount, names]);

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

  const rollDice = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase !== "AWAITING_ROLL") return;
    if (s.roller !== humanSeat) return;
    if (s.rolling) return;
    await runRollAnimation();
  }, [runRollAnimation, humanSeat]);

  const doRollDice = runRollAnimation;

  // Bot auto-roll
  useEffect(() => {
    if (state.phase !== "AWAITING_ROLL") return;
    if (!botSeatSet.has(state.roller)) return;
    if (state.rolling) return;
    const t = setTimeout(() => {
      runRollAnimation();
    }, OPPONENT_TUNING.thinkDelayMs);
    return () => clearTimeout(t);
  }, [state.phase, state.roller, state.rolling, runRollAnimation, botSeatSet]);

  const peekCard = useCallback((index: number) => {
    const s = stateRef.current;
    if (s.phase !== "FLIPPING") return;
    if (s.flipper !== humanSeat) return;
    if (s.inFlight) return;
    if (s.wrongBy[humanSeat].has(index)) return;
    if (s.grid[index] === null) return;
    const token = nextToken();
    dispatch({ type: "FLIP_START", by: humanSeat, idx: index, token });
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      peekTimerRef.current = null;
      dispatch({ type: "FLIP_COMPLETE", token });
    }, REVEAL_MS);
  }, [humanSeat]);

  useEffect(() => {
    if (state.phase !== "FLIPPING") return;
    if (state.inFlight) return;
    if (!state.skip[state.flipper]) return;
    dispatch({ type: "SKIP_TICK" });
  }, [state.phase, state.flipper, state.inFlight, state.skip]);

  // Bot auto-flip
  const inFlightNullMarker = state.inFlight === null;
  useEffect(() => {
    if (state.phase !== "FLIPPING") return;
    if (!botSeatSet.has(state.flipper)) return;
    if (!inFlightNullMarker) return;
    const botSeat = state.flipper;
    if (oppDelayRef.current) clearTimeout(oppDelayRef.current);
    oppDelayRef.current = setTimeout(() => {
      oppDelayRef.current = null;
      const s = stateRef.current;
      if (s.phase !== "FLIPPING" || s.flipper !== botSeat || s.inFlight) return;
      const candidates = s.grid
        .map((c, i) => (c !== null && !s.wrongBy[botSeat].has(i) ? i : -1))
        .filter((i) => i !== -1);
      if (candidates.length === 0) {
        dispatch({ type: "SKIP_TICK" });
        return;
      }
      const unknown = candidates.filter(
        (i) => memoryRef.current?.recall(i) == null
      );
      const pool = unknown.length > 0 ? unknown : candidates;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const token = nextToken();
      dispatch({ type: "FLIP_START", by: botSeat, idx: pick, token });
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
  }, [state.phase, state.flipper, inFlightNullMarker, botSeatSet]);

  const enterClaimMode = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "CLAIM_SELECTING" || s.phase === "CLAIM_RESOLVING") return;
    if (s.phase === "GAME_OVER") return;
    if (s.rolling) return;
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    if (s.phase === "AWAITING_ROLL") {
      if (s.roller !== humanSeat) return;
      dispatch({ type: "PLAYER_ENTER_CLAIM_DURING_ROLL", by: humanSeat });
      runRollAnimation();
      return;
    }
    dispatch({ type: "PLAYER_ENTER_CLAIM", by: humanSeat });
  }, [runRollAnimation, humanSeat]);

  const selectCard = useCallback((index: number) => {
    dispatch({ type: "PLAYER_SELECT_CARD", by: humanSeat, idx: index });
  }, [humanSeat]);

  const resolveMatch = useCallback(() => {
    dispatch({ type: "PLAYER_RESOLVE_MATCH", by: humanSeat });
  }, [humanSeat]);

  const opponentClaim = useCallback((a: number, b: number) => {
    const s = stateRef.current;
    if (s.phase !== "FLIPPING") return;
    if (schedulerBot < 0) return;
    if (a === b) return;
    if (s.grid[a] === null || s.grid[b] === null) return;
    if (s.wrongBy[schedulerBot].has(a) || s.wrongBy[schedulerBot].has(b)) return;
    const token = nextToken();
    dispatch({ type: "CLAIM_START", by: schedulerBot, a, b, token });
    if (oppClaimResolveRef.current) clearTimeout(oppClaimResolveRef.current);
    oppClaimResolveRef.current = setTimeout(() => {
      oppClaimResolveRef.current = null;
      dispatch({ type: "CLAIM_RESOLVE", token });
    }, 1600);
  }, [schedulerBot]);

  const resolveOpponentClaim = useCallback(() => {}, []);

  const claimLastCall = useCallback((a: number, b: number) => {
    dispatch({ type: "LAST_CALL_CLAIM", by: humanSeat, a, b });
  }, [humanSeat]);

  const removeMatchedFromGrid = useCallback(() => {
    dispatch({ type: "REMOVE_MATCHED" });
  }, []);

  // Dead-grid safety valve
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

  // Bot memory — only if any bot seat exists
  useEffect(() => {
    if (!memoryRef.current) return;
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

  useEffect(() => {
    if (!memoryRef.current) return;
    if (schedulerBot < 0) return;
    const prev = prevPeekingRef.current;
    prevPeekingRef.current = state.peekingCard;
    if (prev === null || state.peekingCard !== null) return;
    const card = state.grid[prev];
    memoryRef.current.decayAll();
    if (card) memoryRef.current.observe(prev, card);

    if (state.phase !== "FLIPPING" || state.inFlight) return;
    const excluded = new Set<number>(state.wrongBy[schedulerBot]);
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
  }, [state.peekingCard, state.grid, state.phase, state.inFlight, state.wrongBy, state.rule, opponentClaim, schedulerBot]);

  useEffect(() => {
    if (oppClaimTimerRef.current) {
      clearTimeout(oppClaimTimerRef.current);
      oppClaimTimerRef.current = null;
    }
  }, [state.roundNum, state.phase]);

  // Bot Last Call scanner
  useEffect(() => {
    if (state.phase !== "LAST_CALL") return;
    if (schedulerBot < 0) return;
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
      dispatch({ type: "LAST_CALL_CLAIM", by: schedulerBot, a, b });
    }, delay);
    return () => clearTimeout(t);
  }, [state.phase, state.grid, state.scores, schedulerBot]);

  const opponentClaimingValue = useMemo(
    () =>
      state.inFlight?.kind === "claim" && botSeatSet.has(state.inFlight.by)
        ? { indices: [state.inFlight.a, state.inFlight.b] as [number, number] }
        : null,
    [state.inFlight, botSeatSet]
  );

  const wrongCardsUnion = useMemo(() => {
    const u = new Set<number>();
    for (const s of state.wrongBy) s.forEach((i) => u.add(i));
    return u;
  }, [state.wrongBy]);

  return {
    // Multiplayer escape hatches — host uses these to broadcast state and
    // inject validated intents from joiners. Do NOT use in single-player UI.
    state,
    dispatch,

    deck: state.deck,
    grid: state.grid,
    matchRule: state.rule,
    dieValues: state.dieValues,
    scores: state.scores,
    roundNum: state.roundNum,
    players: state.names,
    rollerIndex: state.roller,
    flipperIndex: state.flipper,
    skipNextFlip: state.skip,
    peekingCard: state.peekingCard,
    claimMode: state.phase === "CLAIM_SELECTING",
    selectedCards: state.selectedCards,
    wrongCards: wrongCardsUnion,
    wrongByMe: state.wrongBy[humanSeat] ?? new Set<number>(),
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
