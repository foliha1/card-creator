// ============================================================================
// Component-level coverage for the END of a daily run.
//
// The unit tests around `runDailyEndSequence` prove the callback chain fires;
// they say nothing about whether the result screen actually becomes visible.
// This mounts the real page, plays a real run with a debug seed, and asserts
// the result screen is in the DOM, at full opacity, and not sitting behind a
// leftover outgoing fade layer.
// ============================================================================

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

import {
  dailyReducer,
  initDailyState,
  matchesOn,
  pairsFor,
  MISSES_PER_ROUND,
  type DailyAction,
  type DailyState,
} from "@/lib/dailyEngine";

// The streak line talks to the backend; the run itself must not.
vi.mock("@/lib/dailyResults", () => ({
  saveDailyResultRemote: vi.fn(() => Promise.resolve()),
  fetchStreak: vi.fn(() => Promise.resolve(null)),
  formatStreakLine: () => null,
}));

// Web Audio does not exist in jsdom: every sound export is a no-op.
vi.mock("@/lib/sounds", () => {
  const noop = () => {};
  return {
    getSfxEnabled: noop,
    setSfxEnabled: noop,
    getMusicEnabled: noop,
    setMusicEnabled: noop,
    setMuted: noop,
    isMuted: noop,
    hasAudioUnlocked: noop,
    unlockAudio: noop,
    startTheme: noop,
    stopTheme: noop,
    playFlip: noop,
    playDeal: noop,
    playSelect: noop,
    playDeselect: noop,
    playWhoopCall: noop,
    playCorrect: noop,
    playWrong: noop,
    playDiceRoll: noop,
    playDieLand: noop,
    playPeek: noop,
    playReveal: noop,
    playStart: noop,
    playRoundAdvance: noop,
    playTick: noop,
    playSubscribed: noop,
    CLIP_GAIN: 1,
  };
});

// lottie-web touches a real canvas on import; jsdom has none.
vi.mock("lottie-react", () => ({ default: () => null }));

import DailyPage from "@/pages/DailyPage";

const SEED = "whoop-test-visible-result";

// --- a mirror of the run, so the test knows which slots to tap -------------
const R = (s: DailyState, a: DailyAction) => dailyReducer(s, a);

function mirrorToPlay(seed: string): DailyState {
  let s = initDailyState(seed);
  s = R(s, { type: "START" });
  s = R(s, { type: "REVEAL" });
  s = R(s, { type: "HIDE" });
  s = R(s, { type: "ROLL_START" });
  return R(s, { type: "PLAY_START", at: 0 });
}

function goodPair(s: DailyState): [number, number] {
  const attr = s.rolls[s.roundIndex - 1].attribute;
  const options = pairsFor(s.grid, attr);
  expect(options.length).toBeGreaterThan(0);
  return options[0];
}

function badPair(s: DailyState): [number, number] {
  const attr = s.rolls[s.roundIndex - 1].attribute;
  for (let i = 0; i < s.grid.length; i++) {
    for (let j = i + 1; j < s.grid.length; j++) {
      const a = s.grid[i];
      const b = s.grid[j];
      if (a && b && !matchesOn(a, b, attr)) return [i, j];
    }
  }
  throw new Error("no mismatched pair available");
}

function mirrorClaim(s: DailyState, i: number, j: number, at: number): DailyState {
  s = R(s, { type: "SELECT", idx: i });
  s = R(s, { type: "SELECT", idx: j });
  s = R(s, { type: "RESOLVE", at });
  if (s.matchedPair.length > 0) s = R(s, { type: "CLEAR_MATCH" });
  if (s.wrongPair.length > 0) s = R(s, { type: "CLEAR_WRONG" });
  return s;
}

function mirrorNextRound(s: DailyState): DailyState {
  if (s.phase === "WHOOPED") s = R(s, { type: "ROUND_END", at: 0 });
  if (s.phase !== "HIDE") return s;
  s = R(s, { type: "ROLL_START" });
  return R(s, { type: "PLAY_START", at: 0 });
}

// --- DOM helpers ----------------------------------------------------------
const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

function slotButton(idx: number): HTMLElement {
  const slot = document.querySelector(`[data-slot="${idx}"]`);
  if (!slot) throw new Error(`slot ${idx} not rendered`);
  // The card exposes role="button" only while taps are live; otherwise drive
  // the card element itself.
  const btn =
    slot.querySelector<HTMLElement>('[role="button"]') ??
    (slot.firstElementChild as HTMLElement | null);
  if (!btn) throw new Error(`slot ${idx} has no card`);
  return btn;
}

async function tapSlot(idx: number) {
  const btn = slotButton(idx);
  await act(async () => {
    btn.click();
  });
}

/** Tap a pair and let the 450ms auto-resolve plus its settle window run out. */
async function claimInDom(i: number, j: number) {
  await tapSlot(i);
  await tapSlot(j);
  await tick(450);   // RESOLVE
  await tick(2000);  // wrong shake / match ghost settle
}

/** Ready → PLAY of round 1 (start gate, deal, study, hide, roll). */
async function startRun() {
  const play = screen.getByRole("button", { name: /Play Today's Daily/i });
  await act(async () => {
    play.click();
  });
  await tick(700);   // DEAL → STUDY
  await tick(10000); // STUDY → HIDE
  await tick(1000);  // HIDE → ROLL
  await tick(2000);  // ROLL → PLAY
}

async function advanceRound() {
  await tick(2000); // WHOOPED pause / HIDE hold
  await tick(2000); // ROLL hero → PLAY
}

/** The visible current layer plus the leftover outgoing layer, if any. */
function layers() {
  return {
    current: document.querySelector<HTMLElement>('[data-testid="daily-fade-current"]'),
    outgoing: document.querySelector<HTMLElement>('[data-testid="daily-fade-outgoing"]'),
  };
}

async function expectResultVisible() {
  // Give the end chain (settle → reveal → hold → results) and the 250ms fade
  // all the room they need.
  await tick(6000);

  const heading = await screen.findByRole("heading", { name: /round review/i });
  expect(heading).toBeInTheDocument();

  const { current, outgoing } = layers();
  expect(current).not.toBeNull();
  // The results tree must be inside the LIVE layer, not a stale snapshot.
  expect(within(current!).getByRole("button", { name: /share/i })).toBeInTheDocument();
  expect(current!.style.opacity === "" || current!.style.opacity === "1").toBe(true);
  // Nothing may be left covering it.
  expect(outgoing).toBeNull();
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, "", `/?debug=1&seed=${SEED}`);
  window.localStorage.clear();
  // jsdom has neither of these.
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  // jsdom has no rAF under fake timers: back it with setTimeout, keeping the
  // handles distinct so cancelAnimationFrame clears the right one.
  const frames = new Map<number, ReturnType<typeof setTimeout>>();
  let nextFrame = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, setTimeout(() => { frames.delete(id); cb(Date.now()); }, 16));
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    const t = frames.get(id);
    if (t !== undefined) { clearTimeout(t); frames.delete(id); }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/?debug=1&seed=${SEED}`]}>
        <DailyPage />
      </MemoryRouter>
    </HelmetProvider>
  );

describe("daily run endings are visible on screen", () => {
  it("shows the result screen after a round 3 correct match", async () => {
    mount();
    let m = mirrorToPlay(SEED);
    await startRun();

    for (let round = 1; round <= 3; round++) {
      const [i, j] = goodPair(m);
      await claimInDom(i, j);
      m = mirrorClaim(m, i, j, round * 100);
      if (round < 3) {
        await advanceRound();
        m = mirrorNextRound(m);
      }
    }

    await expectResultVisible();
  }, 30000);

  it("shows the result screen after round 3 ends on two misses", async () => {
    mount();
    let m = mirrorToPlay(SEED);
    await startRun();

    for (let round = 1; round <= 2; round++) {
      const [i, j] = goodPair(m);
      await claimInDom(i, j);
      m = mirrorClaim(m, i, j, round * 100);
      await advanceRound();
      m = mirrorNextRound(m);
    }

    for (let k = 0; k < MISSES_PER_ROUND; k++) {
      const [i, j] = badPair(m);
      await claimInDom(i, j);
      m = mirrorClaim(m, i, j, 500 + k);
    }

    await expectResultVisible();
  }, 30000);
});
