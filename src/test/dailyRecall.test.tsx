// ============================================================================
// The recall trend line: the calculation, and the tooltip's tap/Escape contract.
// ============================================================================

import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import {
  computeRecallTrend,
  formatRecallLine,
  RECALL_TOOLTIP,
  type RecallGame,
} from "@/lib/dailyRecall";
import DailyRecallTrend from "@/components/DailyRecallTrend";
import type { DailyMark } from "@/lib/dailyEngine";

const game = (n: number, rounds: DailyMark[][]): RecallGame => ({
  puzzle_number: n,
  round_events: rounds,
});
const clean = (n: number, count = 3) =>
  game(n, Array.from({ length: count }, () => ["SOLVE"] as DailyMark[]));
const missy = (n: number, count = 3) =>
  game(n, Array.from({ length: count }, () => ["MISS", "SOLVE"] as DailyMark[]));

describe("computeRecallTrend", () => {
  it("renders nothing with exactly 5 games", () => {
    const rows = [1, 2, 3, 4, 5].map((n) => clean(n));
    expect(computeRecallTrend(rows)).toBeNull();
  });

  it("renders with exactly 6 games", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((n) => clean(n));
    expect(computeRecallTrend(rows)).not.toBeNull();
  });

  it("reads 100% when every round was first time", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((n) => clean(n));
    expect(computeRecallTrend(rows)).toEqual({
      latePct: 100,
      earlyPct: 100,
      upPoints: null,
    });
  });

  it("reports a rise in percentage points", () => {
    // early: 9 rounds, 0 first-time (0%). late: 9 rounds, all first-time (100%).
    const rows = [missy(1), missy(2), missy(3), clean(4), clean(5), clean(6)];
    expect(computeRecallTrend(rows)).toEqual({
      latePct: 100,
      earlyPct: 0,
      upPoints: 100,
    });
  });

  it("gives no arrow and no comparison on a decline", () => {
    const rows = [clean(1), clean(2), clean(3), missy(4), missy(5), missy(6)];
    const t = computeRecallTrend(rows)!;
    expect(t.upPoints).toBeNull();
    expect(formatRecallLine(t)).toBe("0% correct first match.");
  });

  it("shows the arrow for a 1-point rise", () => {
    // early: 100 rounds, 66 first-time (66%). late: 100 rounds, 67 (67%).
    const spread = (n: number, hits: number): RecallGame =>
      game(
        n,
        Array.from({ length: 100 }, (_, i) =>
          i < hits ? (["SOLVE"] as DailyMark[]) : (["MISS", "SOLVE"] as DailyMark[])
        )
      );
    const rows = [
      spread(1, 66),
      game(2, []),
      game(3, []),
      game(4, []),
      game(5, []),
      spread(6, 67),
    ];
    const t = computeRecallTrend(rows)!;
    expect(t).toEqual({ latePct: 67, earlyPct: 66, upPoints: 1 });
    expect(formatRecallLine(t)).toBe(
      "Your recall is climbing! 67% correct first match."
    );
  });

  it("counts rounds, not games, when games differ in length", () => {
    // early: game with 1 first-time round + game with 3 missed rounds = 1/4 = 25%.
    // late: 6 rounds, 3 first-time = 50%. A game-average would read 50% vs 50%.
    const rows = [
      clean(1, 1),
      missy(2, 3),
      game(3, []),
      game(4, []),
      game(5, [["SOLVE"], ["SOLVE"], ["SOLVE"]]),
      game(6, [["MISS", "SOLVE"], ["MISS", "MISS"], ["MISS", "SOLVE"]]),
    ];
    const t = computeRecallTrend(rows)!;
    expect(t.earlyPct).toBe(25);
    expect(t.latePct).toBe(50);
    expect(t.upPoints).toBe(25);
  });

  it("orders by puzzle number regardless of input order", () => {
    const rows = [clean(6), missy(2), missy(1), clean(5), clean(4), missy(3)];
    expect(computeRecallTrend(rows)!.upPoints).toBe(100);
  });
});

describe("DailyRecallTrend tooltip", () => {
  it("opens on a tap with no hover, and Escape closes it and returns focus", () => {
    render(
      <DailyRecallTrend
        trend={{ latePct: 64, earlyPct: 55, upPoints: 9 }}
        mobile={true}
      />
    );
    expect(screen.getByTestId("recall-line").textContent).toContain(
      "Your recall is climbing! 64% correct first match."
    );
    const icon = screen.getByTestId("recall-info");
    expect(icon).toHaveAttribute("aria-label", "What is a first-time match?");
    expect(screen.queryByTestId("recall-tooltip")).toBeNull();

    // Synthetic tap only — no mouseover/hover events at all.
    act(() => {
      icon.focus();
      icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(screen.getByTestId("recall-tooltip").textContent).toBe(RECALL_TOOLTIP);

    vi.useFakeTimers();
    act(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByTestId("recall-tooltip")).toBeNull();
    act(() => {
      vi.runAllTimers();
    });
    expect(document.activeElement).toBe(icon);
    vi.useRealTimers();
  });

  it("shows no arrow and no comparison when flat or declining", () => {
    const { container } = render(
      <DailyRecallTrend trend={{ latePct: 64, earlyPct: 70, upPoints: null }} mobile={false} />
    );
    expect(screen.getByTestId("recall-line").textContent).toContain(
      "64% correct first match."
    );
    expect(screen.getByTestId("recall-line").textContent).not.toContain("climbing");
    expect(container.querySelectorAll("svg").length).toBe(1); // info icon only
  });
});
