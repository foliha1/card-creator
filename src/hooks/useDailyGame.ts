// ============================================================================
// useDailyGame — drives the daily puzzle's phase sequence and clock.
//
// The daily runs on its own tiny machine (src/lib/dailyEngine.ts), NOT on the
// full game engine: no draw pile, no refills, no re-rolls, no bot. This hook
// owns timing (start gate, study countdown, three rolls, clock ticks) and the
// one-attempt-per-day persistence.
// ============================================================================

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  currentRoll,
  dailyReducer,
  initDailyState,
  liveElapsedMs,
  STUDY_MS,
  type DailyPhase,
  type DailyRoll,
  type DailyState,
} from "@/lib/dailyEngine";
import { ROLL_HERO_MS } from "@/lib/multiplayer";
import { pickTumbleSeed } from "@/lib/rolls";
import {
  getDailyNumber,
  getDailySeed,
  loadDailyResult,
  saveDailyResult,
  type DailyResult,
} from "@/lib/daily";

const DEAL_MS = 700;      // deal-in settles before the reveal
const FLIP_MS = 500;      // card flip duration (matches GameCard)
const WRONG_ANIM_MS = 900;
const MATCH_ANIM_MS = 700;

export interface UseDailyGameResult {
  state: DailyState;
  phase: DailyPhase;
  /** Seconds remaining in the study window, rounded up (5 → 1). */
  studyRemaining: number;
  /** Live clock in ms, including penalties. Frozen once solved. */
  elapsedMs: number;
  roll: DailyRoll;
  tumbleSeed: number;
  seed: string;
  puzzleNumber: number;
  result: DailyResult | null;
  alreadyPlayed: boolean;
  start: () => void;
  claim: () => void;
  cancelClaim: () => void;
  select: (idx: number) => void;
}

export function useDailyGame(): UseDailyGameResult {
  const seed = useMemo(() => getDailySeed(), []);
  const puzzleNumber = useMemo(() => getDailyNumber(), []);
  // Testing-only bypass: ?debug=1 ignores (and never writes) the daily lock.
  const debugBypass = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);
  const stored = useMemo(
    () => (debugBypass ? null : loadDailyResult(seed)),
    [seed, debugBypass]
  );

  const [state, dispatch] = useReducer(
    dailyReducer,
    seed,
    (s: string) => initDailyState(s)
  );
  const [tumbleSeed] = useState(() => pickTumbleSeed());
  const [result, setResult] = useState<DailyResult | null>(stored);
  const alreadyPlayed = stored !== null;


  // ---- phase sequence: (start gate) deal → study → hide → roll → play ----
  useEffect(() => {
    if (state.phase !== "DEAL") return;
    const t = setTimeout(() => dispatch({ type: "REVEAL" }), DEAL_MS);
    return () => clearTimeout(t);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "STUDY") return;
    const t = setTimeout(() => dispatch({ type: "HIDE" }), STUDY_MS);
    return () => clearTimeout(t);
  }, [state.phase]);

  // HIDE is entered both after the study window and after each solved round.
  useEffect(() => {
    if (state.phase !== "HIDE") return;
    const t = setTimeout(
      () => dispatch({ type: "ROLL_START" }),
      state.roundIndex === 1 ? FLIP_MS : MATCH_ANIM_MS
    );
    return () => clearTimeout(t);
  }, [state.phase, state.roundIndex]);

  useEffect(() => {
    if (state.phase !== "ROLL") return;
    const t = setTimeout(
      () => dispatch({ type: "PLAY_START", at: Date.now() }),
      ROLL_HERO_MS
    );
    return () => clearTimeout(t);
  }, [state.phase]);

  // ---- study countdown ----
  const [studyRemaining, setStudyRemaining] = useState(
    Math.ceil(STUDY_MS / 1000)
  );
  useEffect(() => {
    if (state.phase !== "STUDY") return;
    const start = Date.now();
    setStudyRemaining(Math.ceil(STUDY_MS / 1000));
    const id = setInterval(() => {
      const left = Math.max(0, STUDY_MS - (Date.now() - start));
      setStudyRemaining(Math.ceil(left / 1000));
    }, 100);
    return () => clearInterval(id);
  }, [state.phase]);

  // ---- running clock (paused whenever startedAt is null, e.g. during rolls) ----
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.phase !== "PLAY") return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.phase]);

  const elapsedMs = liveElapsedMs(state, now);

  // ---- animation cleanup ----
  useEffect(() => {
    if (state.wrongPair.length === 0) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_WRONG" }), WRONG_ANIM_MS);
    return () => clearTimeout(t);
  }, [state.wrongToken, state.wrongPair.length]);

  useEffect(() => {
    if (state.matchedPair.length === 0) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_MATCH" }), MATCH_ANIM_MS);
    return () => clearTimeout(t);
  }, [state.matchedPair.length, state.roundIndex]);

  // ---- auto-resolve once two cards are picked ----
  const resolveRef = useRef(0);
  useEffect(() => {
    if (state.phase !== "PLAY" || state.selected.length !== 2) return;
    const token = ++resolveRef.current;
    const t = setTimeout(() => {
      if (resolveRef.current === token) {
        dispatch({ type: "RESOLVE", at: Date.now() });
      }
    }, 450);
    return () => clearTimeout(t);
  }, [state.phase, state.selected.length]);

  // ---- persist the solve, once ----
  useEffect(() => {
    if (result !== null) return;
    if (state.phase !== "DONE" || state.elapsedMs === null) return;
    const finished: DailyResult = {
      seed,
      puzzleNumber,
      attributes: state.rolls.map((r) => r.attribute),
      elapsedMs: state.elapsedMs,
      wrongCalls: state.wrongCalls,
      completedAt: new Date().toISOString(),
    };
    saveDailyResult(finished);
    setResult(finished);
  }, [
    state.phase,
    state.elapsedMs,
    state.rolls,
    state.wrongCalls,
    result,
    seed,
    puzzleNumber,
  ]);

  const start = useCallback(() => dispatch({ type: "START" }), []);
  const claim = useCallback(() => dispatch({ type: "CLAIM" }), []);
  const cancelClaim = useCallback(() => dispatch({ type: "CANCEL_CLAIM" }), []);
  const select = useCallback((idx: number) => dispatch({ type: "SELECT", idx }), []);

  return {
    state,
    phase: state.phase,
    studyRemaining,
    elapsedMs,
    roll: currentRoll(state),
    tumbleSeed,
    seed,
    puzzleNumber,
    result,
    alreadyPlayed,
    start,
    claim,
    cancelClaim,
    select,
  };
}
