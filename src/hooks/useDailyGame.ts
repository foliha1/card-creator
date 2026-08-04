// ============================================================================
// useDailyGame — the daily puzzle: one seat, one seed, one round.
//
// Reuses the existing engine (useGameState) with seatCount 1 and no bots, so
// there is no opponent and no rotation to wait on. The puzzle ends on the
// first correct match; completion is recorded in localStorage so the same day
// cannot be replayed.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useGameState,
  SETTLE_MATCH_MS,
  SETTLE_WRONG_MS,
} from "@/hooks/useGameState";
import { pickRoll, pickTumbleSeed, rngOf } from "@/lib/rolls";
import { toPublicState, type PublicState } from "@/lib/publicState";
import type {
  IntentAction,
  RollCommitPayload,
  RollAttribute,
} from "@/lib/multiplayer";
import {
  getDailyNumber,
  getDailySeed,
  loadDailyResult,
  saveDailyResult,
  type DailyResult,
} from "@/lib/daily";

const SEAT = 0;
const REVEAL_MS = 2000;
const ROLL_ATTRS: readonly RollAttribute[] = ["SHAPE", "NUMBER", "COLOR"] as const;
const SEAT_MAP = [
  { seat: 0, visitor_id: "daily-you", display_name: "You" },
];

export interface UseDailyGameResult {
  publicState: PublicState;
  onIntent: (a: IntentAction) => void;
  rollCommit: RollCommitPayload | null;
  mySeat: 0;
  seed: string;
  puzzleNumber: number;
  flips: number;
  wrongCalls: number;
  /** Completed result for today, whether just solved or loaded from storage. */
  result: DailyResult | null;
  /** True when the stored result was loaded on mount (revisit, not a fresh solve). */
  alreadyPlayed: boolean;
}

export function useDailyGame(gridSize: "3x2" | "3x3" = "3x2"): UseDailyGameResult {
  const seed = useMemo(() => getDailySeed(), []);
  const puzzleNumber = useMemo(() => getDailyNumber(), []);
  const stored = useMemo(() => loadDailyResult(seed), [seed]);

  const g = useGameState(gridSize, {
    seatCount: 1,
    botSeats: [],
    names: ["You"],
    seed,
  });
  const { state, dispatch, doRollDice } = g;

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [result, setResult] = useState<DailyResult | null>(stored);
  const alreadyPlayed = stored !== null;

  // ---- settle scheduler (mirrors solo/host) ----
  useEffect(() => {
    if (state.phase !== "SETTLING" || state.settleKind === null) return;
    const ms = state.settleKind === "MATCH" ? SETTLE_MATCH_MS : SETTLE_WRONG_MS;
    const token = state.settleToken;
    const t = setTimeout(() => dispatch({ type: "SETTLE_COMPLETE", token }), ms);
    return () => clearTimeout(t);
  }, [state.phase, state.settleKind, state.settleToken, dispatch]);

  // ---- one round: the first correct match finishes the puzzle ----
  useEffect(() => {
    if (result !== null) return;
    if (state.settleKind !== "MATCH") return;
    const finished: DailyResult = {
      seed,
      puzzleNumber,
      flips: state.flipCount,
      wrongCalls: state.wrongCalls,
      completedAt: new Date().toISOString(),
    };
    saveDailyResult(finished);
    setResult(finished);
  }, [state.settleKind, state.flipCount, state.wrongCalls, result, seed, puzzleNumber]);

  const tokenRef = useRef(0);
  const nextToken = () => ++tokenRef.current;

  const [rollCommit, setRollCommit] = useState<RollCommitPayload | null>(null);
  const commitAndRoll = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "AWAITING_ROLL" || s.rolling) return;
    const { attribute, faceIndex } = pickRoll(ROLL_ATTRS, rngOf(s));
    const tumbleSeed = pickTumbleSeed();
    const startAt = Date.now() + 150;
    setRollCommit({
      roundId: `daily:${seed}:${s.roundNum}`,
      attribute,
      faceIndex,
      tumbleSeed,
      startAt,
    });
    setTimeout(() => {
      void doRollDice([attribute]);
    }, Math.max(0, startAt - Date.now()));
  }, [doRollDice, seed]);

  const onIntent = useCallback(
    (action: IntentAction) => {
      if (result !== null) return; // puzzle over — ignore further play
      switch (action.type) {
        case "REQUEST_ROLL":
          commitAndRoll();
          return;
        case "PLAYER_ENTER_CLAIM":
          dispatch({ type: "PLAYER_ENTER_CLAIM", by: SEAT });
          return;
        case "CANCEL_CLAIM":
          dispatch({ type: "CANCEL_CLAIM", by: SEAT });
          return;
        case "PLAYER_SELECT_CARD":
          dispatch({ type: "PLAYER_SELECT_CARD", by: SEAT, idx: action.idx });
          return;
        case "PLAYER_RESOLVE_MATCH":
          dispatch({ type: "PLAYER_RESOLVE_MATCH", by: SEAT });
          return;
        case "FLIP_START":
          dispatch({
            type: "FLIP_START",
            by: SEAT,
            idx: action.idx,
            token: action.token,
          });
          setTimeout(
            () => dispatch({ type: "FLIP_COMPLETE", token: action.token }),
            REVEAL_MS
          );
          return;
        default:
          return; // no rematch, no debug drains in the daily
      }
    },
    [commitAndRoll, dispatch, result]
  );

  const publicState = useMemo<PublicState>(
    () => toPublicState(state, SEAT_MAP, 0, `daily:${seed}`, [], []),
    [state, seed]
  );

  return {
    publicState,
    onIntent,
    rollCommit,
    mySeat: 0,
    seed,
    puzzleNumber,
    flips: state.flipCount,
    wrongCalls: state.wrongCalls,
    result,
    alreadyPlayed,
  };
}
