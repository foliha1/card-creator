import React, { useEffect, useRef, useState } from "react";
import { DAILY_SCREEN_FADE_MS } from "@/lib/animationTiming";

/**
 * True cross-fade between the daily screens (ready → gameplay → results).
 *
 * An opaque wrapper holds the page background and never animates its opacity,
 * so there is always a solid colour behind everything — no flash of the body.
 * Outgoing and incoming content are stacked as two absolutely positioned
 * layers and fade in opposite directions over the same window, overlapping.
 * The wrapper's background-color transitions on the same clock so khaki →
 * cream reads as one blend. Opacity only — no slide, no scale — so it is kept
 * under `prefers-reduced-motion: reduce`.
 */
const MS = DAILY_SCREEN_FADE_MS;

interface Layer {
  key: string;
  children: React.ReactNode;
}

const DailyScreenFade: React.FC<{
  /** Identity of the screen being shown; a change triggers the cross-fade. */
  screenKey: string;
  /** Page background for this screen, cross-faded with the content. */
  background: string;
  children: React.ReactNode;
}> = ({ screenKey, background, children }) => {
  const [current, setCurrent] = useState<Layer>({ key: screenKey, children });
  const [outgoing, setOutgoing] = useState<Layer | null>(null);
  // Drives the incoming layer from 0 → 1 on the frame after the swap.
  const [entering, setEntering] = useState(false);
  const prevKey = useRef(screenKey);

  useEffect(() => {
    if (screenKey === prevKey.current) {
      // Same screen, fresh children (a tick of the clock, a card tap).
      setCurrent((c) => ({ ...c, children }));
      return;
    }
    prevKey.current = screenKey;
    setOutgoing(current);
    setCurrent({ key: screenKey, children });
    setEntering(true);
    const raf = requestAnimationFrame(() => setEntering(false));
    const t = window.setTimeout(() => setOutgoing(null), MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey, children]);

  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transition: `opacity ${MS}ms ease`,
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        background,
        transition: `background-color ${MS}ms ease`,
      }}
    >
      {outgoing && (
        <div style={{ ...layerStyle, opacity: entering ? 1 : 0, pointerEvents: "none" }}>
          {outgoing.children}
        </div>
      )}
      <div
        style={
          outgoing
            ? { ...layerStyle, opacity: entering ? 0 : 1 }
            : { position: "relative" }
        }
      >
        {current.children}
      </div>
    </div>
  );
};

export default DailyScreenFade;
