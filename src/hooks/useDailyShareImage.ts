// ============================================================================
// useDailyShareImage — render the share PNG once per theme, on the results
// screen, so it can be shown as a preview AND handed straight to the share
// sheet.
//
// Rendering is fire-and-forget: the screen never waits on it, and any failure
// resolves to `null` so the caller hides the preview and falls back to the
// on-demand render inside the share handler.
//
// Both the light and the night render are cached for the life of the run, so
// flipping the modal's toggle back and forth never re-renders.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyResult } from "@/lib/daily";
import { renderDailyShareImage, type ShareImageTheme } from "@/lib/dailyShareImage";

export type DailyShareImage = {
  /** The exact artifact that gets shared, once it exists. */
  blob: Blob | null;
  /** Object URL for the blob, for the preview <img>. */
  url: string | null;
  status: "pending" | "ready" | "failed";
  /** Which theme the blob above was drawn in. */
  theme: ShareImageTheme;
  /** Render (or serve from cache) the other theme. Safe to call repeatedly. */
  setTheme: (theme: ShareImageTheme) => void;
};

type Entry = { blob: Blob; url: string };

export function useDailyShareImage(
  result: DailyResult | null,
  streak: number | null,
  enabled = true,
  initialTheme: ShareImageTheme = "light"
): DailyShareImage {
  const [theme, setThemeState] = useState<ShareImageTheme>(initialTheme);
  const [state, setState] = useState<Omit<DailyShareImage, "theme" | "setTheme">>({
    blob: null,
    url: null,
    status: "pending",
  });

  const cache = useRef<Map<string, Entry>>(new Map());
  const liveRef = useRef(true);

  // Re-render only when the identity of the run (or its streak) changes.
  const key = result ? `${result.puzzleNumber}:${streak ?? "-"}` : null;

  useEffect(() => {
    liveRef.current = true;
    const map = cache.current;
    return () => {
      liveRef.current = false;
      map.forEach((e) => URL.revokeObjectURL(e.url));
      map.clear();
    };
  }, [key]);

  useEffect(() => {
    if (!enabled || !result || !key) return;
    const cacheKey = `${key}:${theme}`;
    const hit = cache.current.get(cacheKey);
    if (hit) {
      setState({ blob: hit.blob, url: hit.url, status: "ready" });
      return;
    }
    setState({ blob: null, url: null, status: "pending" });

    renderDailyShareImage(result, streak, theme).then(
      (blob) => {
        if (!liveRef.current) return;
        const url = URL.createObjectURL(blob);
        cache.current.set(cacheKey, { blob, url });
        setState({ blob, url, status: "ready" });
      },
      () => {
        if (liveRef.current) setState({ blob: null, url: null, status: "failed" });
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, theme]);

  const setTheme = useCallback((next: ShareImageTheme) => setThemeState(next), []);

  return { ...state, theme, setTheme };
}
