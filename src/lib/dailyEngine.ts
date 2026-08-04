// ============================================================================
// dailyEngine — the daily puzzle's own tiny state machine.
//
// The daily is NOT a game of Whoop Whoop: it is one recall test with three
// rule changes. There is no draw pile, no refills, no re-rolls, no bot.
//
// Sequence (see DailyPhase):
//   READY  static start gate; nothing runs until START
//   DEAL   nine cards deal face down (3×3)
//   STUDY  all nine flip face up and hold for STUDY_MS with a countdown
//   HIDE   all nine flip back face down — they are never shown again
//   ROLL   the die rolls for the current round (clock paused)
//   PLAY   clock runs; player claims, then taps two cards
//   DONE   all three rounds solved
//
// A correct pair is removed from the board for good (9 → 7 → 5). A wrong pair
// adds WRONG_PENALTY_MS to the total, increments wrongCalls, and play continues
// in the same round with the cards still face down.
//
// All three die rolls are drawn from the daily seed at init time and validated
// so that every reachable board still holds a pair for that round's rule — the
// player never sees a re-roll mid-play.
// ============================================================================

import { createDeck, type Card } from "@/cardData";
import { createRng, type Rng } from "@/lib/rng";
import { pickRoll } from "@/lib/rolls";
import type { RollAttribute } from "@/lib/multiplayer";

export const STUDY_MS = 5000;
export const WRONG_PENALTY_MS = 1000;
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
  | "DONE";

export interface DailyRoll {
  attribute: RollAttribute;
  faceIndex: 0 | 1;
}

export interface DailyState {
  phase: DailyPhase;
  /** Fixed nine slots; a slot becomes null once its card is matched away. */
  grid: (Card | null)[];
  faceUp: boolean;
  /** The three rolls for the day, decided at init from the seed. */
  rolls: DailyRoll[];
  /** 1-based round, 1 → 3. */
  roundIndex: number;
  claiming: boolean;
  selected: number[];
  wrongCalls: number;
  /** Bumps on every wrong call so the UI can replay its shake. */
  wrongToken: number;
  /** Indices that were just called wrong (cleared by CLEAR_WRONG). */
  wrongPair: number[];
  /** Indices of the pair that just matched (cleared by CLEAR_MATCH). */
  matchedPair: number[];
  /** Wall-clock ms when the running clock last started. Null while paused. */
  startedAt: number | null;
  /** Clock time banked from completed rounds, in ms. */
  accumulatedMs: number;
  /** Accumulated wrong-call penalty, in ms. */
  penaltyMs: number;
  /** Final total time including penalties. Null until DONE. */
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
    wrongCalls: 0,
    wrongToken: 0,
    wrongPair: [],
    matchedPair: [],
    startedAt: null,
    accumulatedMs: 0,
    penaltyMs: 0,
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
      if (state.phase !== "PLAY" || state.claiming) return state;
      return { ...state, claiming: true, selected: [], wrongPair: [] };

    case "CANCEL_CLAIM":
      if (state.phase !== "PLAY" || !state.claiming) return state;
      return { ...state, claiming: false, selected: [] };

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

      if (!correct) {
        return {
          ...state,
          claiming: false,
          selected: [],
          wrongPair: [i, j],
          wrongToken: state.wrongToken + 1,
          wrongCalls: state.wrongCalls + 1,
          penaltyMs: state.penaltyMs + WRONG_PENALTY_MS,
        };
      }

      const banked =
        state.accumulatedMs + Math.max(0, action.at - (state.startedAt ?? action.at));
      const grid = without(state.grid, i, j);
      const last = state.roundIndex >= DAILY_ROUNDS;

      return {
        ...state,
        phase: last ? "DONE" : "HIDE",
        roundIndex: last ? state.roundIndex : state.roundIndex + 1,
        grid,
        claiming: false,
        selected: [],
        matchedPair: [i, j],
        wrongPair: [],
        startedAt: null,
        accumulatedMs: banked,
        elapsedMs: last ? banked + state.penaltyMs : null,
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
  return state.accumulatedMs + running + state.penaltyMs;
}

/** `12.3` — seconds to one decimal. */
export function formatSeconds(ms: number): string {
  return (Math.floor(ms / 100) / 10).toFixed(1);
}
