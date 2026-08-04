// ============================================================================
// dailyEngine — the daily puzzle's own tiny state machine.
//
// The daily is NOT a game of Whoop Whoop: it is one recall test with three
// rule changes. There is no draw pile, no refills, no re-rolls, no bot.
//
// Sequence (see DailyPhase):
//   READY    static start gate; nothing runs until START
//   DEAL     nine cards deal face down (3×3)
//   STUDY    all nine flip face up and hold for STUDY_MS with a countdown
//   HIDE     all nine flip back face down
//   ROLL     the die rolls for the current round (clock paused)
//   PLAY     player claims, then taps two cards (one peek allowed per run)
//   WHOOPED  the round ran out of misses: the answer is shown briefly
//   DONE     all three rounds played out
//
// Misses are capped PER ROUND (MISSES_PER_ROUND). A wrong pair spends one of
// the round's two misses and play continues in that round. The second miss
// Whoops the round: the correct pair is revealed, removed, and play moves on.
// The run never ends early — every player plays all three rounds.
//
// All three die rolls are drawn from the daily seed at init time and validated
// so that every reachable board still holds a pair for that round's rule.
// ============================================================================

import { createDeck, type Card } from "@/cardData";
import { createRng, type Rng } from "@/lib/rng";
import { pickRoll } from "@/lib/rolls";
import type { RollAttribute } from "@/lib/multiplayer";

export const STUDY_MS = 10000;
/** Misses allowed in each round. The third miss is impossible — 2 Whoops it. */
export const MISSES_PER_ROUND = 2;
/** How long the whole remaining board stays face up during a peek. */
export const PEEK_MS = 5000;
export const DAILY_SLOTS = 9;
export const DAILY_ROUNDS = 3;

export const DAILY_ROLL_ATTRS: readonly RollAttribute[] = [
  "SHAPE",
  "NUMBER",
  "COLOR",
] as const;

export type DailyPhase =
  | "READY"
  | "DEAL"
  | "STUDY"
  | "HIDE"
  | "ROLL"
  | "PLAY"
  | "WHOOPED"
  | "DONE";

export interface DailyRoll {
  attribute: RollAttribute;
  faceIndex: 0 | 1;
}

/** One entry per resolved call within a round, in the order they happened. */
export type DailyMark = "MISS" | "SOLVE";

export interface DailyState {
  phase: DailyPhase;
  /** Fixed nine slots; a slot becomes null once its card leaves the board. */
  grid: (Card | null)[];
  faceUp: boolean;
  /** The three rolls for the day, decided at init from the seed. */
  rolls: DailyRoll[];
  /** 1-based round, 1 → 3. */
  roundIndex: number;
  claiming: boolean;
  selected: number[];
  /** Misses spent in the current round. Resets each round, caps at 2. */
  roundMisses: number;
  /** Misses spent across the whole run. */
  totalMisses: number;
  /** Rounds solved by a correct call, 0 → 3. */
  roundsSolved: number;
  /** Per-round event lists, index 0 = round 1. */
  roundEvents: DailyMark[][];
  /** One peek per run. */
  peekUsed: boolean;
  /** The round the peek was used in, or null. */
  peekRound: number | null;
  /** True while the peek reveal is showing. */
  peeking: boolean;
  /** True when no round was solved. */
  failed: boolean;
  /** Bumps on every wrong call so the UI can replay its shake. */
  wrongToken: number;
  /** Indices that were just called wrong (cleared by CLEAR_WRONG). */
  wrongPair: number[];
  /** Indices of the pair that just matched (cleared by CLEAR_MATCH). */
  matchedPair: number[];
  /** The answer pair shown during WHOOPED. Cleared when the round advances. */
  revealPair: number[];
  /** Wall-clock ms when the running clock last started. Null while paused. */
  startedAt: number | null;
  /** Clock time banked from completed rounds, in ms. */
  accumulatedMs: number;
  /** Final total time. Null until DONE. Recorded but never scored. */
  elapsedMs: number | null;
}

export type DailyAction =
  | { type: "START" }
  | { type: "REVEAL" }
  | { type: "HIDE" }
  | { type: "ROLL_START" }
  | { type: "PLAY_START"; at: number }
  | { type: "CLAIM" }
  | { type: "CANCEL_CLAIM" }
  | { type: "SELECT"; idx: number }
  | { type: "RESOLVE"; at: number }
  | { type: "PEEK" }
  | { type: "PEEK_END" }
  | { type: "ROUND_END"; at: number }
  | { type: "CLEAR_WRONG" }
  | { type: "CLEAR_MATCH" };

export function matchesOn(a: Card, b: Card, attr: RollAttribute): boolean {
  if (attr === "SHAPE") return a.shape === b.shape;
  if (attr === "NUMBER") return a.number === b.number;
  return a.color === b.color;
}

/** Every unordered pair of card indices matching `attr` on the given board. */
export function pairsFor(
  board: (Card | null)[],
  attr: RollAttribute
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < board.length; i++) {
    const a = board[i];
    if (!a) continue;
    for (let j = i + 1; j < board.length; j++) {
      const b = board[j];
      if (!b) continue;
      if (matchesOn(a, b, attr)) out.push([i, j]);
    }
  }
  return out;
}

function without(board: (Card | null)[], i: number, j: number): (Card | null)[] {
  const next = [...board];
  next[i] = null;
  next[j] = null;
  return next;
}

/**
 * True when the three rolls are solvable no matter which valid pair the player
 * removes each round. Exhaustive — the board is tiny.
 */
export function rollsAreSolvable(
  board: (Card | null)[],
  rolls: DailyRoll[]
): boolean {
  const walk = (b: (Card | null)[], round: number): boolean => {
    if (round >= rolls.length) return true;
    const options = pairsFor(b, rolls[round].attribute);
    if (options.length === 0) return false;
    return options.every(([i, j]) => walk(without(b, i, j), round + 1));
  };
  return walk(board, 0);
}

/**
 * Deal the day's nine cards and the day's three dice, all from the seeded
 * stream so every player worldwide gets the identical puzzle.
 */
export function initDailyState(seed: string, rngIn?: Rng): DailyState {
  const rng: Rng = rngIn ?? createRng(seed);
  const deck = createDeck(rng);
  const grid: (Card | null)[] = deck.slice(0, DAILY_SLOTS);

  let rolls: DailyRoll[] = [];
  for (let attempt = 0; attempt < 500; attempt++) {
    const candidate: DailyRoll[] = [];
    for (let r = 0; r < DAILY_ROUNDS; r++) {
      candidate.push(pickRoll(DAILY_ROLL_ATTRS, rng));
    }
    if (rollsAreSolvable(grid, candidate)) {
      rolls = candidate;
      break;
    }
  }
  if (rolls.length === 0) {
    // Fallback: with 9 of 48 distinct cards this is unreachable in practice.
    rolls = Array.from({ length: DAILY_ROUNDS }, () => ({
      attribute: "COLOR" as RollAttribute,
      faceIndex: 0 as 0 | 1,
    }));
  }

  return {
    phase: "READY",
    grid,
    faceUp: false,
    rolls,
    roundIndex: 1,
    claiming: false,
    selected: [],
    roundMisses: 0,
    totalMisses: 0,
    roundsSolved: 0,
    roundEvents: Array.from({ length: DAILY_ROUNDS }, () => [] as DailyMark[]),
    peekUsed: false,
    peekRound: null,
    peeking: false,
    failed: false,
    wrongToken: 0,
    wrongPair: [],
    matchedPair: [],
    revealPair: [],
    startedAt: null,
    accumulatedMs: 0,
    elapsedMs: null,
  };
}

/** The rule in play for the current round. */
export function currentRoll(state: DailyState): DailyRoll {
  return state.rolls[Math.min(state.roundIndex, DAILY_ROUNDS) - 1];
}

/** Cards still on the board. */
export function remainingCount(state: DailyState): number {
  return state.grid.filter((c) => c !== null).length;
}

/** True when the peek may be taken right now. */
export function canPeek(state: DailyState): boolean {
  return state.phase === "PLAY" && !state.peekUsed && !state.claiming && !state.peeking;
}

function pushEvent(state: DailyState, mark: DailyMark): DailyMark[][] {
  return state.roundEvents.map((events, i) =>
    i === state.roundIndex - 1 ? [...events, mark] : events
  );
}

export function dailyReducer(state: DailyState, action: DailyAction): DailyState {
  switch (action.type) {
    case "START":
      if (state.phase !== "READY") return state;
      return { ...state, phase: "DEAL" };

    case "REVEAL":
      if (state.phase !== "DEAL") return state;
      return { ...state, phase: "STUDY", faceUp: true };

    case "HIDE":
      if (state.phase !== "STUDY") return state;
      return { ...state, phase: "HIDE", faceUp: false };

    case "ROLL_START":
      if (state.phase !== "HIDE") return state;
      return { ...state, phase: "ROLL" };

    case "PLAY_START":
      if (state.phase !== "ROLL") return state;
      return { ...state, phase: "PLAY", startedAt: action.at };

    case "CLAIM":
      if (state.phase !== "PLAY" || state.claiming || state.peeking) return state;
      return { ...state, claiming: true, selected: [], wrongPair: [] };

    case "CANCEL_CLAIM":
      if (state.phase !== "PLAY" || !state.claiming) return state;
      return { ...state, claiming: false, selected: [] };

    case "PEEK":
      if (!canPeek(state)) return state;
      return {
        ...state,
        peeking: true,
        faceUp: true,
        peekUsed: true,
        peekRound: state.roundIndex,
      };

    case "PEEK_END":
      if (!state.peeking) return state;
      return { ...state, peeking: false, faceUp: false };

    case "SELECT": {
      if (state.phase !== "PLAY" || !state.claiming) return state;
      if (state.grid[action.idx] == null) return state;
      if (state.selected.length >= 2) return state;
      if (state.selected.includes(action.idx)) {
        return { ...state, selected: state.selected.filter((i) => i !== action.idx) };
      }
      return { ...state, selected: [...state.selected, action.idx] };
    }

    case "RESOLVE": {
      if (state.phase !== "PLAY" || state.selected.length !== 2) return state;
      const [i, j] = state.selected;
      const a = state.grid[i];
      const b = state.grid[j];
      const attr = currentRoll(state).attribute;
      const correct = !!a && !!b && matchesOn(a, b, attr);

      const banked =
        state.accumulatedMs + Math.max(0, action.at - (state.startedAt ?? action.at));

      if (!correct) {
        const roundMisses = state.roundMisses + 1;
        const whooped = roundMisses >= MISSES_PER_ROUND;
        const answer = whooped ? (pairsFor(state.grid, attr)[0] ?? []) : [];
        return {
          ...state,
          phase: whooped ? "WHOOPED" : state.phase,
          claiming: false,
          selected: [],
          wrongPair: [i, j],
          wrongToken: state.wrongToken + 1,
          roundMisses,
          totalMisses: state.totalMisses + 1,
          roundEvents: pushEvent(state, "MISS"),
          revealPair: [...answer],
          faceUp: whooped ? state.faceUp : state.faceUp,
          startedAt: whooped ? null : state.startedAt,
          accumulatedMs: whooped ? banked : state.accumulatedMs,
        };
      }

      const grid = without(state.grid, i, j);
      const last = state.roundIndex >= DAILY_ROUNDS;
      const roundsSolved = state.roundsSolved + 1;

      return {
        ...state,
        phase: last ? "DONE" : "HIDE",
        roundIndex: last ? state.roundIndex : state.roundIndex + 1,
        roundMisses: last ? state.roundMisses : 0,
        roundsSolved,
        roundEvents: pushEvent(state, "SOLVE"),
        grid,
        claiming: false,
        selected: [],
        matchedPair: [i, j],
        wrongPair: [],
        failed: last ? roundsSolved === 0 : false,
        startedAt: null,
        accumulatedMs: banked,
        elapsedMs: last ? banked : null,
      };
    }

    // The Whooped round's answer has been shown — clear it and move on.
    case "ROUND_END": {
      if (state.phase !== "WHOOPED") return state;
      const [i, j] = state.revealPair;
      const grid =
        i === undefined || j === undefined ? state.grid : without(state.grid, i, j);
      const last = state.roundIndex >= DAILY_ROUNDS;
      return {
        ...state,
        phase: last ? "DONE" : "HIDE",
        roundIndex: last ? state.roundIndex : state.roundIndex + 1,
        roundMisses: last ? state.roundMisses : 0,
        grid,
        revealPair: [],
        wrongPair: [],
        selected: [],
        claiming: false,
        faceUp: false,
        failed: last ? state.roundsSolved === 0 : false,
        startedAt: null,
        elapsedMs: last ? state.accumulatedMs : null,
      };
    }

    case "CLEAR_WRONG":
      return state.wrongPair.length === 0 ? state : { ...state, wrongPair: [] };

    case "CLEAR_MATCH":
      return state.matchedPair.length === 0 ? state : { ...state, matchedPair: [] };

    default:
      return state;
  }
}

/** Live time to display while playing (or the frozen final time when done). */
export function liveElapsedMs(state: DailyState, now: number): number {
  if (state.elapsedMs !== null) return state.elapsedMs;
  const running = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt);
  return state.accumulatedMs + running;
}

/** `12.3` — seconds to one decimal. */
export function formatSeconds(ms: number): string {
  return (Math.floor(ms / 100) / 10).toFixed(1);
}
