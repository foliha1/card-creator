// Trigger boundaries and the once-per-puzzle guard for the 10-day milestone.

import { beforeEach, describe, expect, it } from "vitest";
import {
  hasCelebrated,
  isMilestonePreview,
  isMilestoneStreak,
  markCelebrated,
} from "@/lib/dailyMilestone";

describe("isMilestoneStreak", () => {
  it("fires on every multiple of ten", () => {
    for (const n of [10, 20, 30, 40, 100, 1000]) {
      expect(isMilestoneStreak(n)).toBe(true);
    }
  });

  it("does not fire off-milestone or at zero", () => {
    for (const n of [0, 1, 9, 11, 19, 21, 29, 99, -10]) {
      expect(isMilestoneStreak(n)).toBe(false);
    }
  });

  it("does not fire on a missing streak", () => {
    expect(isMilestoneStreak(null)).toBe(false);
    expect(isMilestoneStreak(undefined)).toBe(false);
    expect(isMilestoneStreak(Number.NaN)).toBe(false);
  });
});

describe("once-per-puzzle guard", () => {
  beforeEach(() => window.localStorage.clear());

  it("is off before the first celebration and on after", () => {
    expect(hasCelebrated(42)).toBe(false);
    markCelebrated(42);
    expect(hasCelebrated(42)).toBe(true);
  });

  it("is keyed per puzzle number", () => {
    markCelebrated(42);
    expect(hasCelebrated(43)).toBe(false);
  });
});

describe("preview flag", () => {
  it("reads ?milestone=1 and ignores ?debug=1", () => {
    expect(isMilestonePreview("?milestone=1")).toBe(true);
    expect(isMilestonePreview("?debug=1")).toBe(false);
    expect(isMilestonePreview("")).toBe(false);
    expect(isMilestonePreview("?milestone=0")).toBe(false);
  });
});
