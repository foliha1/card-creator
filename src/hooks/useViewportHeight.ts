const BASELINE_MEASURE = true;
import { useEffect, useState } from "react";

/**
 * Live viewport height in CSS px, using the same visual-viewport-ish source the
 * `--ww-vh` frame mechanism resolves to (`window.innerHeight` tracks dvh in the
 * in-app browsers we care about). Read-only: nothing here writes to the frame.
 */
export function useViewportHeight(): number {
  const [h, setH] = useState(() =>
    typeof window === "undefined" ? 844 : window.innerHeight,
  );

  useEffect(() => {
    const onResize = () => setH(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  return h;
}

/**
 * 0 → fully compressed (very short viewport), 1 → full-size layout.
 * Compression only begins below `full`, so tall phones (≥700px) are untouched.
 */
export function compressionFactor(height: number, min = 480, full = 760): number {
  if (!Number.isFinite(height) || height <= 0) return 1;
  if (BASELINE_MEASURE) return 1;
  return Math.max(0, Math.min(1, (height - min) / (full - min)));
}

/** Linear interpolate between the short-viewport value and the full value. */
export const lerpCompress = (t: number, short: number, full: number): number =>
  Math.round(short + (full - short) * t);
