// ============================================================================
// useDailyShareImage — render the share PNG once, on the results screen, so it
// can be shown as a preview AND handed straight to the share sheet.
//
// Rendering is fire-and-forget: the screen never waits on it, and any failure
// resolves to `null` so the caller hides the preview and falls back to the
// on-demand render inside the share handler.
// ============================================================================

import { useEffect, useState } from "react";
import type { DailyResult } from "@/lib/daily";
import { renderDailyShareImage } from "@/lib/dailyShareImage";

export type DailyShareImage = {
  /** The exact artifact that gets shared, once it exists. */
  blob: Blob | null;
  /** Object URL for the blob, for the preview <img>. */
  url: string | null;
  status: "pending" | "ready" | "failed";
};

export function useDailyShareImage(
  result: DailyResult | null,
  streak: number | null,
  enabled = true
): DailyShareImage {
  const [state, setState] = useState<DailyShareImage>({
    blob: null,
    url: null,
    status: "pending",
  });

  // Re-render only when the identity of the run (or its streak) changes.
  const key = result ? `${result.puzzleNumber}:${streak ?? "-"}` : null;

  useEffect(() => {
    if (!enabled || !result) return;
    let live = true;
    let url: string | null = null;
    setState({ blob: null, url: null, status: "pending" });

    renderDailyShareImage(result, streak).then(
      (blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setState({ blob, url, status: "ready" });
      },
      () => {
        if (live) setState({ blob: null, url: null, status: "failed" });
      }
    );

    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return state;
}
