import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

vi.mock("@/lib/visitor", () => ({ getVisitorId: () => "visitor-1" }));


import {
  hasSubscribed,
  isValidEmail,
  markSubscribed,
  subscribeDaily,
} from "@/lib/dailySubscribe";

beforeEach(() => {
  invoke.mockReset();
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
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(subscribeDaily(" Player@Example.COM ")).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("ac-subscribe", {
      body: { email: "player@example.com", visitorId: "visitor-1" },
    });
  });

  it("passes the signup source through when given", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await subscribeDaily("player@example.com", "visitor-1", "landing");
    expect(invoke).toHaveBeenCalledWith("ac-subscribe", {
      body: { email: "player@example.com", visitorId: "visitor-1", source: "landing" },
    });
  });

  it("treats a duplicate signup as a success (the server stays quiet)", async () => {
    // ON CONFLICT DO NOTHING still returns ok — the player sees no difference.
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(subscribeDaily("player@example.com")).resolves.toBe(true);
    await expect(subscribeDaily("player@example.com")).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(hasSubscribed()).toBe(true);
  });

  it("succeeds even when the email sender sync failed", async () => {
    invoke.mockResolvedValue({ data: { ok: true, syncedToAc: false }, error: null });
    await expect(subscribeDaily("player@example.com")).resolves.toBe(true);
    expect(hasSubscribed()).toBe(true);
  });

  it("never calls the function for an invalid address", async () => {
    await expect(subscribeDaily("nope")).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns false on a function error or a throw", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(subscribeDaily("player@example.com")).resolves.toBe(false);
    invoke.mockResolvedValue({ data: { ok: false }, error: null });
    await expect(subscribeDaily("player@example.com")).resolves.toBe(false);
    invoke.mockRejectedValue(new Error("offline"));
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
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await subscribeDaily("player@example.com");
    expect(hasSubscribed()).toBe(true);
  });

});
