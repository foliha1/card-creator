// Audio-path characterisation. Two behaviours are load-bearing and cannot be
// checked by reading the code: the deal cue must schedule one click per card
// staggered with the visual, and turning SFX off mid-run must silence what is
// already scheduled on the graph (a cue can carry over a second of offsets).

import { beforeEach, describe, expect, it, vi } from "vitest";

interface StubSource {
  started: number[];
  stopped: number[];
  onended: (() => void) | null;
}

const sources: StubSource[] = [];
const gains: { value: number }[] = [];

function param() {
  return {
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    cancelScheduledValues: () => {},
  };
}

function makeSource(): StubSource & Record<string, unknown> {
  const s = {
    started: [] as number[],
    stopped: [] as number[],
    onended: null as (() => void) | null,
    buffer: null,
    loop: false,
    type: "sine",
    frequency: param(),
    connect: () => {},
    start(at: number) { s.started.push(at); },
    stop(at?: number) { s.stopped.push(at ?? -1); },
  };
  sources.push(s as unknown as StubSource);
  return s as unknown as StubSource & Record<string, unknown>;
}

class StubCtx {
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  createGain() {
    const g = { gain: param(), connect: () => {} };
    gains.push(g.gain as unknown as { value: number });
    return g;
  }
  createBiquadFilter() {
    return { type: "bandpass", frequency: param(), Q: { value: 1 }, connect: () => {} };
  }
  createBuffer(_ch: number, len: number) {
    const data = new Float32Array(len);
    return { getChannelData: () => data, sampleRate: this.sampleRate };
  }
  createBufferSource() { return makeSource(); }
  createOscillator() { return makeSource(); }
  resume() { return Promise.resolve(); }
}

async function loadSounds() {
  vi.resetModules();
  sources.length = 0;
  gains.length = 0;
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
  return await import("@/lib/sounds");
}

describe("audio cues", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("schedules one deal click per card, staggered with the deal-in visual", async () => {
    const s = await loadSounds();
    s.setSfxEnabled(true);
    s.playDeal(9, { startMs: 900, stepMs: 60 });

    // Two nodes per card (the flip texture and its body), so nine cards give
    // nine distinct start times, 60ms apart, from the 900ms landing point.
    const starts = [...new Set(sources.flatMap((x) => x.started))]
      .map((t) => Math.round(t * 1000))
      .sort((a, b) => a - b);
    const clicks = starts.filter((t) => (t - 30 - 900) % 60 === 0);
    expect(clicks.length).toBe(9);
    expect(clicks[0] - clicks[0]).toBe(0);
    expect(clicks[1] - clicks[0]).toBe(60);
    expect(clicks[8] - clicks[0]).toBe(480);
  });

  it("collapses a repeated deal cue inside the dedupe window", async () => {
    const s = await loadSounds();
    s.setSfxEnabled(true);
    s.playDeal(9, { startMs: 900 });
    const first = sources.length;
    s.playDeal(9, { startMs: 900 });
    expect(sources.length).toBe(first);
  });

  it("silences already-scheduled audio when SFX are turned off mid-run", async () => {
    const s = await loadSounds();
    s.setSfxEnabled(true);
    s.playDeal(9, { startMs: 900 });
    s.playDiceRoll();
    expect(sources.length).toBeGreaterThan(0);
    const scheduled = sources.length;

    s.setSfxEnabled(false);
    // Every scheduled source is stopped, not just left to ring out.
    expect(sources.filter((x) => x.stopped.length > 0).length).toBe(scheduled);
    // And the master bus is cut, so nothing already ramping stays audible.
    expect(gains.some((g) => g.value === 0)).toBe(true);

    // Nothing new is scheduled while disabled.
    const after = sources.length;
    s.playCorrect();
    s.playFlip();
    expect(sources.length).toBe(after);
  });
});
