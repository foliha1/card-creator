import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: 1,
  error: null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
  },
}));

vi.mock("@/lib/visitor", () => ({
  getVisitorId: () => "visitor-test",
}));

import {
  flushDailyEvents,
  getAttribution,
  pendingDailyEvents,
  resetDailyEvents,
  setDailyTrackingEnabled,
  trackDaily,
} from "@/lib/dailyEvents";

function setSearch(search: string, referrer = "") {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search },
  });
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: referrer,
  });
}

describe("daily instrumentation", () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockClear();
    resetDailyEvents();
    setSearch("");
  });

  it("writes queued events through the log_daily_events RPC", async () => {
    trackDaily("ready_viewed", { puzzleNumber: 4 });
    trackDaily("run_started", { puzzleNumber: 4 });
    expect(pendingDailyEvents()).toHaveLength(2);

    const sent = await flushDailyEvents();
    expect(sent).toBe(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("log_daily_events");
    expect(args.p_visitor_id).toBe("visitor-test");
    const rows = args.p_events as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.event)).toEqual(["ready_viewed", "run_started"]);
    expect(rows[0].puzzle_number).toBe(4);
    expect(pendingDailyEvents()).toHaveLength(0);
  });

  it("batches a burst into one request", async () => {
    trackDaily("round_solved", { props: { round: 1, misses: 0 } });
    trackDaily("round_failed", { props: { round: 2, misses: 2 } });
    trackDaily("run_finished", { props: { roundsSolved: 2, totalMisses: 2 } });
    await flushDailyEvents();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((rpc.mock.calls[0][1] as { p_events: unknown[] }).p_events).toHaveLength(3);
  });

  it("records nothing while ?debug=1 is active", async () => {
    setSearch("?debug=1");
    trackDaily("run_started");
    trackDaily("run_finished");
    expect(pendingDailyEvents()).toHaveLength(0);
    expect(await flushDailyEvents()).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("swallows RPC failures", async () => {
    rpc.mockImplementationOnce(async (_fn, _args) => {
      throw new Error("network down");
    });
    trackDaily("ready_viewed");
    await expect(flushDailyEvents()).resolves.toBe(0);
  });

  it("captures referrer host and utm_source, stripped of any URL detail", () => {
    setSearch("?utm_source=Instagram%20Reels&day=2", "https://www.tiktok.com/@x?y=1");
    const attr = getAttribution();
    expect(attr.referrer).toBe("tiktok.com");
    expect(attr.utm_source).toBe("instagramreels");
    // `ref` is accepted as an alias.
    localStorage.clear();
    setSearch("?ref=newsletter", "");
    expect(getAttribution().utm_source).toBe("newsletter");
  });

  it("attaches attribution to the first event only", async () => {
    setSearch("?utm_source=reels", "https://t.co/abc");
    trackDaily("ready_viewed");
    await flushDailyEvents();
    const first = (rpc.mock.calls[0][1] as { p_events: Array<Record<string, unknown>> })
      .p_events[0];
    expect(first.referrer).toBe("t.co");
    expect(first.utm_source).toBe("reels");

    trackDaily("run_started");
    trackDaily("run_finished");
    await flushDailyEvents();
    const later = (rpc.mock.calls[1][1] as { p_events: Array<Record<string, unknown>> })
      .p_events;
    expect(later.some((r) => r.referrer !== undefined)).toBe(false);
    expect(later.some((r) => r.utm_source !== undefined)).toBe(false);
  });

  it("honours an explicit suppression override", async () => {
    setDailyTrackingEnabled(false);
    trackDaily("share_clicked", { props: { method: "image" } });
    expect(pendingDailyEvents()).toHaveLength(0);
    setDailyTrackingEnabled(true);
    trackDaily("share_clicked", { props: { method: "text" } });
    expect(pendingDailyEvents()).toHaveLength(1);
    await flushDailyEvents();
  });
});
