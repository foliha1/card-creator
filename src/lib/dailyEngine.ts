// ============================================================================
// dailyEngine — the daily puzzle's own tiny state machine.
//
// The daily is NOT a game of Whoop Whoop: it is one recall test. There is no
// draw pile, no refills, no rounds, no re-rolls, no bot. One board of six
// cards, one die, one solve.
//
// Sequence (see DailyPhase):
//   DEAL   board deals face down
//   STUDY  all six flip face up and hold for STUDY_MS with a countdown
//   HIDE   all six flip back face down
//   ROLL   the die rolls and lands on the day's attribute
//   PLAY   clock runs; player claims, then taps two cards
//   DONE   correct pair stopped the clock
//
// A wrong pair adds WRONG_PENALTY_MS to the final time, increments wrongCalls
// and play continues with the cards still face down.
// ============================================================================

import { createDeck, type Card } from "@/cardData";
import { createRng, type Rng } from "@/lib/rng";
import type { RollAttribute } from "@/lib/multiplayer";

export const STUDY_MS = 5000;
export const WRONG_PENALTY_MS = 1000;
export const DAILY_SLOTS = 6;

export const DAILY_ROLL_ATTRS: readonly RollAttribute[] = [
  "SHAPE",
  "NUMBER",
  "COLOR",
] as const;

export type DailyPhase = "DEAL" | "STUDY" | "HIDE" | "ROLL" | "PLAY" | "DONE";

export interface DailyState {
  phase: DailyPhase;
  grid: Card[];
  faceUp: boolean;
  /** The day's rolled rule. Known from init but only shown from ROLL onward. */
  attribute: RollAttribute;
  faceIndex: 0 | 1;
  claiming: boolean;
  selected: number[];
  wrongCalls: number;
  /** Bumps on every wrong call so the UI can replay its shake. */
  wrongToken: number;
  /** Indices that were just called wrong (cleared by CLEAR_WRONG). */
  wrongPair: number[];
  matchedPair: number[];
  /** Wall-clock ms when the clock started. Null until PLAY. */
  startedAt: number | null;
  /** Accumulated wrong-call penalty, in ms. */
  penaltyMs: number;
  /** Final time including penalties. Null until DONE. */
  elapsedMs: number | null;
}

export type DailyAction =
  | { type: "REVEAL" }
  | { type: "HIDE" }
  | { type: "ROLL_START" }
  | { type: "PLAY_START"; at: number }
  | { type: "CLAIM" }
  | { type: "CANCEL_CLAIM" }
  | { type: "SELECT"; idx: number }
  | { type: "RESOLVE"; at: number }
  | { type: "CLEAR_WRONG" };

function matchesOn(a: Card, b: Card, attr: RollAttribute): boolean {
  if (attr === "SHAPE") return a.shape === b.shape;
  if (attr === "NUMBER") return a.number === b.number;
  return a.color === b.color;
}

function hasPair(grid: Card[], attr: RollAttribute): boolean {
  for (let i = 0; i < grid.length; i++) {
    for (let j = i + 1; j < grid.length; j++) {
      if (matchesOn(grid[i], grid[j], attr)) return true;
    }
  }
  return false;
}

/**
 * Deal the day's board and pick the day's die, both from the seeded stream so
 * every player worldwide gets the identical puzzle. If the dealt six hold no
 * pair for the rolled attribute the next six are dealt (deterministically)
 * until they do — the puzzle must always be solvable.
 */
export function initDailyState(seed: string, rngIn?: Rng): DailyState {
  const rng: Rng = rngIn ?? createRng(seed);
  const deck = createDeck(rng);
  const { attribute, faceIndex } = {
    attribute: DAILY_ROLL_ATTRS[Math.floor(rng() * DAILY_ROLL_ATTRS.length)],
    faceIndex: Math.floor(rng() * 2) as 0 | 1,
  };

  let grid = deck.slice(0, DAILY_SLOTS);
  let cursor = DAILY_SLOTS;
  while (!hasPair(grid, attribute) && cursor + DAILY_SLOTS <= deck.length) {
    grid = deck.slice(cursor, cursor + DAILY_SLOTS);
    cursor += DAILY_SLOTS;
  }

  return {
    phase: "DEAL",
    grid,
    faceUp: false,
    attribute,
    faceIndex,
    claiming: false,
    selected: [],
    wrongCalls: 0,
    wrongToken: 0,
    wrongPair: [],
    matchedPair: [],
    startedAt: null,
    penaltyMs: 0,
    elapsedMs: null,
  };
}

export function dailyReducer(state: DailyState, action: DailyAction): DailyState {
  switch (action.type) {
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
      const correct = !!a && !!b && matchesOn(a, b, state.attribute);
      if (correct) {
        const elapsed =
          Math.max(0, action.at - (state.startedAt ?? action.at)) + state.penaltyMs;
        return {
          ...state,
          phase: "DONE",
          claiming: false,
          faceUp: true,
          matchedPair: [i, j],
          selected: [],
          elapsedMs: elapsed,
        };
      }
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

    case "CLEAR_WRONG":
      return state.wrongPair.length === 0 ? state : { ...state, wrongPair: [] };

    default:
      return state;
  }
}

/** Live time to display while playing (or the frozen final time when done). */
export function liveElapsedMs(state: DailyState, now: number): number {
  if (state.elapsedMs !== null) return state.elapsedMs;
  if (state.startedAt === null) return 0;
  return Math.max(0, now - state.startedAt) + state.penaltyMs;
}

/** `12.3` — seconds to one decimal. */
export function formatSeconds(ms: number): string {
  return (Math.floor(ms / 100) / 10).toFixed(1);
}
