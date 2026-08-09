import { describe, expect, it } from "vitest";

import {
  dailyResultRejectReason,
  MIN_MS_PER_EVENT,
  type DailySubmission,
} from "@/lib/dailyResultRules";

const TODAY = "2026-08-12"; // server UTC date
const VALID: DailySubmission = {
  puzzleNumber: 2, // 2026-08-12 is launch + 1
  puzzleDate: "2026-08-12",
  roundsSolved: 3,
  totalMisses: 1,
  roundEvents: [["SOLVE"], ["MISS", "SOLVE"], ["SOLVE"]],
  elapsedMs: 7_874,
};

const sub = (patch: Partial<DailySubmission>): DailySubmission => ({ ...VALID, ...patch });

describe("a genuine run", () => {
  it("passes", () => {
    expect(dailyResultRejectReason(VALID, TODAY)).toBeNull();
  });

  it("passes from a locale a day behind or a day ahead of UTC", () => {
    expect(
      dailyResultRejectReason(sub({ puzzleNumber: 1, puzzleDate: "2026-08-11" }), TODAY)
    ).toBeNull();
    expect(
      dailyResultRejectReason(sub({ puzzleNumber: 3, puzzleDate: "2026-08-13" }), TODAY)
    ).toBeNull();
  });

  it("passes a fully Whooped run (no rounds solved, six misses)", () => {
    expect(
      dailyResultRejectReason(
        sub({
          roundsSolved: 0,
          totalMisses: 6,
          roundEvents: [
            ["MISS", "MISS"],
            ["MISS", "MISS"],
            ["MISS", "MISS"],
          ],
          elapsedMs: 20_000,
        }),
        TODAY
      )
    ).toBeNull();
  });

  it("passes exactly at the elapsed floor", () => {
    expect(
      dailyResultRejectReason(
        sub({
          roundsSolved: 3,
          totalMisses: 0,
          roundEvents: [["SOLVE"], ["SOLVE"], ["SOLVE"]],
          elapsedMs: 3 * MIN_MS_PER_EVENT,
        }),
        TODAY
      )
    ).toBeNull();
  });
});

describe("rejections", () => {
  it("puzzle_number that does not match puzzle_date", () => {
    expect(dailyResultRejectReason(sub({ puzzleNumber: 99 }), TODAY)).toBe("puzzle_mismatch");
  });

  it("pre-launch dates, which have no positive puzzle number", () => {
    expect(
      dailyResultRejectReason(sub({ puzzleNumber: 0, puzzleDate: "2026-08-10" }), TODAY)
    ).toBe("puzzle_mismatch");
  });

  it("a date outside the plausible time-zone window", () => {
    expect(
      dailyResultRejectReason(sub({ puzzleNumber: 5, puzzleDate: "2026-08-15" }), TODAY)
    ).toBe("date_out_of_window");
    expect(
      dailyResultRejectReason(sub({ puzzleNumber: 100, puzzleDate: "2026-11-18" }), TODAY)
    ).toBe("date_out_of_window");
  });

  it("rounds_solved outside 0 to 3", () => {
    expect(dailyResultRejectReason(sub({ roundsSolved: 4 }), TODAY)).toBe(
      "rounds_out_of_range"
    );
    expect(dailyResultRejectReason(sub({ roundsSolved: -1 }), TODAY)).toBe(
      "rounds_out_of_range"
    );
  });

  it("total_misses above what the per-round cap allows", () => {
    expect(dailyResultRejectReason(sub({ totalMisses: 7 }), TODAY)).toBe(
      "misses_out_of_range"
    );
  });

  it("round_events of the wrong shape", () => {
    expect(dailyResultRejectReason(sub({ roundEvents: "SOLVE" }), TODAY)).toBe("events_shape");
    expect(dailyResultRejectReason(sub({ roundEvents: [["SOLVE"], ["SOLVE"]] }), TODAY)).toBe(
      "events_shape"
    );
    expect(dailyResultRejectReason(sub({ roundEvents: [["SOLVE"], ["SOLVE"], "x"] }), TODAY)).toBe(
      "events_shape"
    );
  });

  it("a round with more marks than the miss cap allows", () => {
    expect(
      dailyResultRejectReason(
        sub({ roundEvents: [["MISS", "MISS", "SOLVE"], ["SOLVE"], ["SOLVE"]] }),
        TODAY
      )
    ).toBe("events_round_length");
  });

  it("an unknown mark", () => {
    expect(
      dailyResultRejectReason(sub({ roundEvents: [["WIN"], ["SOLVE"], ["SOLVE"]] }), TODAY)
    ).toBe("events_bad_mark");
  });

  it("a round that could not have happened", () => {
    // two solves in one round
    expect(
      dailyResultRejectReason(
        sub({ roundsSolved: 3, totalMisses: 0, roundEvents: [["SOLVE", "SOLVE"], ["SOLVE"], []] }),
        TODAY
      )
    ).toBe("events_impossible_round");
    // a solve that is not the last mark of its round
    expect(
      dailyResultRejectReason(
        sub({ roundsSolved: 3, totalMisses: 1, roundEvents: [["SOLVE", "MISS"], ["SOLVE"], ["SOLVE"]] }),
        TODAY
      )
    ).toBe("events_impossible_round");
    // a round that ended on one miss without a solve
    expect(
      dailyResultRejectReason(
        sub({ roundsSolved: 2, totalMisses: 1, roundEvents: [["MISS"], ["SOLVE"], ["SOLVE"]] }),
        TODAY
      )
    ).toBe("events_impossible_round");
  });

  it("round_events inconsistent with rounds_solved", () => {
    expect(
      dailyResultRejectReason(
        sub({ roundsSolved: 3, totalMisses: 2, roundEvents: [["SOLVE"], ["MISS", "MISS"], ["SOLVE"]] }),
        TODAY
      )
    ).toBe("events_solves_mismatch");
  });

  it("round_events inconsistent with total_misses", () => {
    expect(dailyResultRejectReason(sub({ totalMisses: 4 }), TODAY)).toBe(
      "events_misses_mismatch"
    );
  });

  it("an elapsed time no human could produce", () => {
    expect(dailyResultRejectReason(sub({ elapsedMs: 0 }), TODAY)).toBe("elapsed_too_fast");
    expect(dailyResultRejectReason(sub({ elapsedMs: 999 }), TODAY)).toBe("elapsed_too_fast");
  });

  it("a missing puzzle number or date", () => {
    expect(dailyResultRejectReason(sub({ puzzleNumber: null }), TODAY)).toBe("missing_puzzle");
    expect(dailyResultRejectReason(sub({ puzzleDate: null }), TODAY)).toBe("missing_puzzle");
  });
});
