// The results screen's group line must be invisible to a signed-out player:
// no prompt, no sign-in nudge, and no group RPC traffic at all — so its height
// is identical to the no-groups case (both render nothing).

import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let session: unknown = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      rpc(...args);
      return Promise.resolve({ data: [], error: null });
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import DailyGroupsLine from "@/components/DailyGroupsLine";

const renderLine = () =>
  render(
    <MemoryRouter>
      <DailyGroupsLine puzzleNumber={10} email={null} mobile />
    </MemoryRouter>
  );

describe("groups gate on the results screen", () => {
  beforeEach(() => {
    rpc.mockClear();
    session = null;
  });

  it("renders nothing and calls no group RPC when signed out", async () => {
    const { container } = renderLine();
    await waitFor(() => expect(container.innerHTML).toBe(""));
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain("get_my_groups");
  });

  it("renders nothing when signed in with no groups, matching the signed-out height", async () => {
    const signedOut = renderLine();
    await waitFor(() => expect(signedOut.container.innerHTML).toBe(""));
    const signedOutHtml = signedOut.container.innerHTML;

    session = { user: { email: "someone@example.com" } };
    const signedIn = renderLine();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(signedIn.container.innerHTML).toBe(signedOutHtml);
  });
});
