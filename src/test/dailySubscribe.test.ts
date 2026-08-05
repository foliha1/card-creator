import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

vi.mock("@/lib/visitor", () => ({ getVisitorId: () => "visitor-1" }));

import {
  hasSubscribed,
  isValidEmail,
  markSubscribed,
  subscribeDaily,
} from "@/lib/dailySubscribe";

beforeEach(() => {
  rpc.mockReset();
  localStorage.clear();
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("player@example.com")).toBe(true);
    expect(isValidEmail("  Player.One+daily@sub.example.co.uk ")).toBe(true);
  });

  it("rejects malformed or oversized input", () => {
    for (const bad of ["", "   ", "player", "player@", "@example.com", "a@b", "a b@c.com"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
    expect(isValidEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("subscribeDaily", () => {
  it("sends a trimmed, lowercased address with the visitor id", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(subscribeDaily(" Player@Example.COM ")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("subscribe_daily", {
      p_email: "player@example.com",
      p_visitor_id: "visitor-1",
    });
  });

  it("treats a duplicate signup as a success (RPC stays quiet)", async () => {
    // ON CONFLICT DO NOTHING still returns true — the player sees no difference.
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(subscribeDaily("player@example.com")).resolves.toBe(true);
    await expect(subscribeDaily("player@example.com")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(hasSubscribed()).toBe(true);
  });

  it("never calls the RPC for an invalid address", async () => {
    await expect(subscribeDaily("nope")).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns false on an RPC error or a throw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(subscribeDaily("player@example.com")).resolves.toBe(false);
    rpc.mockRejectedValue(new Error("offline"));
    await expect(subscribeDaily("player@example.com")).resolves.toBe(false);
    expect(hasSubscribed()).toBe(false);
  });
});

describe("localStorage hide", () => {
  it("is false before signup and true after", () => {
    expect(hasSubscribed()).toBe(false);
    markSubscribed();
    expect(hasSubscribed()).toBe(true);
    expect(localStorage.getItem("ww_daily_subscribed")).toBe("1");
  });

  it("marks the visitor on a successful subscribe", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await subscribeDaily("player@example.com");
    expect(hasSubscribed()).toBe(true);
  });
});
