// ============================================================================
// DailyRoundIntro — the round intro for the daily puzzle.
//
// An overlay above the card grid (cards stay visible, dimmed) that names the
// round, rolls the die large and centred, holds on the landed face, then flies
// the die to its resting slot in the header.
//
// The overlay is up for the engine's entire ROLL phase. That phase is the sum
// of DAILY_TUMBLE_MS plus a tunable hold on the landed face (DAILY_HOLD_MS).
// Under prefers-reduced-motion the tumble and the fly are both skipped — the
// landed face is shown for the same duration, then cuts to the resting state.
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { MatchDie, landedRotationFor } from "@/components/MatchDie";
import type { RollAttribute } from "@/lib/multiplayer";
import { COLORS, FONT_SIZE, textStyle } from "@/lib/tokens";

/** Tumble duration of the daily die. The single source of truth. */
export const DAILY_TUMBLE_MS = 800;
/** Pause on the landed face before the overlay clears and the die flies away. */
export const DAILY_HOLD_MS = 2400;
/** Total ROLL phase duration used by the daily engine. */
export const DAILY_ROLL_HERO_MS = DAILY_TUMBLE_MS + DAILY_HOLD_MS;
/** Fly-to-corner duration once the overlay clears. */
export const DAILY_FLY_MS = 420;

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
  /** The resting slot in the header the die flies to. */
  anchorRef: React.RefObject<HTMLElement>;
  /** Size of the resting die in the header. */
  smallSize: number;
  /** Fires whenever the overlay appears or clears, so the header can hide its
   *  own die while the overlay owns it. */
  onVisibleChange?: (visible: boolean) => void;
}

const DailyRoundIntro: React.FC<DailyRoundIntroProps> = ({
  active,
  roundIndex,
  attribute,
  faceIndex,
  tumbleSeed,
  anchorRef,
  smallSize,
  onVisibleChange,
}) => {
  const [reduced] = useState(prefersReducedMotion);
  const [visible, setVisible] = useState(active);
  const [flying, setFlying] = useState(false);
  const [fly, setFly] = useState<{ dx: number; dy: number; scale: number } | null>(null);
  const dieRef = useRef<HTMLDivElement | null>(null);

  const [big] = useState(() => {
    if (typeof window === "undefined") return 168;
    const v = Math.min(window.innerWidth, window.innerHeight);
    return Math.round(Math.max(120, Math.min(200, v * 0.34)));
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

  // Enter on ROLL; on leave either cut (reduced motion) or fly to the header.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (active) {
      setVisible(true);
      setFlying(false);
      setFly(null);
      return;
    }
    if (!visibleRef.current) return;
    const el = dieRef.current;
    const target = anchorRef.current;
    if (reduced || !el || !target) {
      setVisible(false);
      return;
    }
    const a = el.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (a.width === 0) {
      setVisible(false);
      return;
    }
    let raf = requestAnimationFrame(() => {
      setFly({ dx: b.left - a.left, dy: b.top - a.top, scale: smallSize / a.width });
      setFlying(true);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);


  useEffect(() => {
    if (!flying) return;
    const t = window.setTimeout(() => {
      setFlying(false);
      setVisible(false);
      setFly(null);
    }, DAILY_FLY_MS);
    return () => window.clearTimeout(t);
  }, [flying]);

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
      }}
    >
      {/* Dim, not hide: the cards stay visible underneath as faint shapes. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(35, 31, 32, 0.75)",
          opacity: flying ? 0 : 1,
          transition: `opacity ${DAILY_FLY_MS}ms ease`,
        }}
      />

      <div
        ref={dieRef}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: big,
          height: big,
          marginLeft: -big / 2,
          marginTop: -big / 2,
          transformOrigin: "top left",
          transform: fly
            ? `translate(${fly.dx}px, ${fly.dy}px) scale(${fly.scale})`
            : "translate(0px, 0px) scale(1)",
          transition: flying
            ? `transform ${DAILY_FLY_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : undefined,
          willChange: "transform",
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
            fontSize: FONT_SIZE["5xl"],
            color: COLORS.surface,
            opacity: flying ? 0 : 1,
            transition: `opacity 200ms ease`,
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
