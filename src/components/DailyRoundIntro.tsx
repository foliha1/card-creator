// ============================================================================
// DailyRoundIntro — the round intro for the daily puzzle.
//
// An overlay above the card grid (cards stay visible, dimmed) that names the
// round, rolls the die large and centred, holds on the landed face, then fades
// out together with the scrim. There is no resting die: the readout carries the
// rule from PLAY onwards.
//
// The overlay is up for the engine's entire ROLL phase. That phase is the sum
// of DAILY_TUMBLE_MS plus a tunable hold on the landed face (DAILY_HOLD_MS).
// Under prefers-reduced-motion the tumble is skipped — the landed face is shown
// for the same duration, then fades out.
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { MatchDie, landedRotationFor } from "@/components/MatchDie";
import type { RollAttribute } from "@/lib/multiplayer";
import { COLORS, FONT_SIZE, textStyle } from "@/lib/tokens";

/** Fade-up of the scrim, round title and die before the tumble starts. */
export const DAILY_FADE_IN_MS = 200;
/** Tumble duration of the daily die. The single source of truth. */
export const DAILY_TUMBLE_MS = 800;
/** Pause on the landed face before the overlay fades out. */
export const DAILY_HOLD_MS = 2000;
/** Total ROLL phase duration used by the daily engine. */
export const DAILY_ROLL_HERO_MS = DAILY_FADE_IN_MS + DAILY_TUMBLE_MS + DAILY_HOLD_MS;
/** Fade-out duration once the hold ends. */
const FADE_MS = 320;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface DailyRoundIntroProps {
  /** True while the engine is in its ROLL phase. */
  active: boolean;
  roundIndex: number;
  attribute: RollAttribute;
  faceIndex: 0 | 1;
  tumbleSeed: number;
  /** Fires whenever the overlay appears or clears, so taps stay locked. */
  onVisibleChange?: (visible: boolean) => void;
}

const DailyRoundIntro: React.FC<DailyRoundIntroProps> = ({
  active,
  roundIndex,
  attribute,
  faceIndex,
  tumbleSeed,
  onVisibleChange,
}) => {
  const [reduced] = useState(prefersReducedMotion);
  const [visible, setVisible] = useState(active);
  const [fading, setFading] = useState(false);

  const [big] = useState(() => {
    if (typeof window === "undefined") return 202;
    const v = Math.min(window.innerWidth, window.innerHeight);
    return Math.round(Math.max(120, Math.min(200, v * 0.34)) * 1.2);
  });

  // The landed face is always the seeded value for the round — the tumble only
  // decorates the approach to it, it never decides it.
  const landed = landedRotationFor(attribute, faceIndex);
  const spins = 2 + (tumbleSeed & 1);
  const dir = (tumbleSeed >> 2) & 1 ? 1 : -1;
  const spun = `rotateX(${dir * (spins * 360 + 140)}deg) rotateY(${-dir * (spins * 360 + 55)}deg)`;
  const [rotation, setRotation] = useState(reduced ? landed : spun);

  useEffect(() => {
    if (!active || reduced) return;
    setRotation(spun);
    const id = requestAnimationFrame(() => setRotation(landed));
    return () => cancelAnimationFrame(id);
  }, [active, roundIndex, spun, landed, reduced]);

  // Enter on ROLL; on leave fade the whole overlay out.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (active) {
      setVisible(true);
      setFading(false);
      return;
    }
    if (!visibleRef.current) return;
    const raf = requestAnimationFrame(() => setFading(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => {
      setFading(false);
      setVisible(false);
    }, FADE_MS);
    return () => window.clearTimeout(t);
  }, [fading]);

  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        pointerEvents: "none",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {/* Dim, not hide: the cards stay visible underneath as faint shapes. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(35, 31, 32, 0.75)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: big,
          height: big,
          marginLeft: -big / 2,
          marginTop: -big / 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "100%",
            marginBottom: 44,
            zIndex: 2,

            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            ...textStyle("display"),
            fontSize: FONT_SIZE["6xl"],
            color: COLORS.surface,
          }}
        >
          Round {roundIndex}
        </div>

        <MatchDie
          size={big}
          attribute={attribute}
          faceIndex={faceIndex}
          rotation={rotation}
          transition={
            reduced ? undefined : `transform ${DAILY_TUMBLE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
          }
        />
      </div>
    </div>
  );
};

export default DailyRoundIntro;
