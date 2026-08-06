import React, { useEffect, useRef, useState } from "react";
import { DAILY_SCREEN_FADE_MS } from "@/lib/animationTiming";

/**
 * Cross-fade between the daily screens (ready → gameplay → end-game reveal →
 * results). One surface only: the outgoing screen fades out, the children are
 * swapped while invisible, then the incoming screen fades in. Opacity only —
 * no slide, no scale — so it is kept under `prefers-reduced-motion: reduce`.
 *
 * `background` is transitioned on the same clock so the khaki gameplay screen
 * never flashes cream (or the reverse) mid-swap.
 */
const HALF = DAILY_SCREEN_FADE_MS / 2;

const DailyScreenFade: React.FC<{
  /** Identity of the screen being shown; a change triggers the cross-fade. */
  screenKey: string;
  /** Page background for this screen, cross-faded with the content. */
  background: string;
  children: React.ReactNode;
}> = ({ screenKey, background, children }) => {
  const [shown, setShown] = useState({ key: screenKey, children, background });
  const [visible, setVisible] = useState(true);
  const pending = useRef({ children, background });

  pending.current = { children, background };

  useEffect(() => {
    if (screenKey === shown.key) {
      // Same screen, fresh children (a tick of the clock, a card tap).
      setShown((s) => ({ ...s, children, background }));
      return;
    }
    setVisible(false);
    const t = window.setTimeout(() => {
      setShown({ key: screenKey, ...pending.current });
      setVisible(true);
    }, HALF);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey, children, background]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: shown.background,
        opacity: visible ? 1 : 0,
        transition: `opacity ${HALF}ms ease, background-color ${HALF}ms ease`,
      }}
    >
      {shown.children}
    </div>
  );
};

export default DailyScreenFade;
