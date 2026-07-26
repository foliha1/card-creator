// ============================================================================
// RollHeroOverlay — plays the hero roll animation on top of the play-area
// container, timed against serverNow() so every client's animation lands at
// the same wall-clock moment regardless of message-arrival latency.
//
// Layout: absolutely positioned inside a `position: relative` parent. Its
// "home" is the 80x80 cream box inside the dice box (bottom left of the tray).
// The overlay renders at that position and lifts itself over the play area
// via `transform: translate(dx, dy) scale(2.5)`. Transform ONLY — never
// animate `left/top` (would fight the parent's layout and repaint constantly).
//
// Timeline (offsets from startAt, total ROLL_HERO_MS = 1100):
//   0     → 450  cube tumbles from spin(seed) → landed rotation
//   450   → 600  crossfade: cube → cream instruction card (150ms)
//   600   → 850  hold on instruction card (250ms)
//   850   → 1100 transform back to home: translate(0,0) scale(1) (250ms)
//   1100  →      overlay hidden; dice box shows the instruction natively
// ============================================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { COLORS, FONT_FAMILY } from "@/lib/tokens";
import {
  MatchDie,
  landedComponentsFor,
} from "@/components/MatchDie";
import type { RollCommitPayload } from "@/lib/multiplayer";
import { ROLL_HERO_MS } from "@/lib/multiplayer";
import { serverNow } from "@/hooks/useServerClock";

const HOME_SIZE = 80;         // 80×80 cream home box
const LIFT_SCALE = 2.5;
const TUMBLE_MS = 450;
const CROSSFADE_START = 450;
const CROSSFADE_MS = 150;
const LAND_START = 850;
const LAND_MS = 250;

// Ease-out cubic — snappy start, gentle settle onto landed rotation.
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

interface Props {
  commit: RollCommitPayload;
  // Rect (page coordinates) of the 80×80 home cell inside the dice box.
  homeRect: DOMRect;
  // Rect of the play area — we translate to its center for the lifted state.
  targetRect: DOMRect;
  // Rect of the overlay's positioning parent, so we can convert to local px.
  parentRect: DOMRect;
  onComplete: () => void;
}

export const RollHeroOverlay: React.FC<Props> = ({
  commit,
  homeRect,
  targetRect,
  parentRect,
  onComplete,
}) => {
  const { attribute, faceIndex, tumbleSeed, startAt } = commit;

  // Home position, in the overlay parent's local coordinate space. Centered
  // on the home cell so lift/scale pivot from its center.
  const homeCenterX = homeRect.left + homeRect.width / 2;
  const homeCenterY = homeRect.top + homeRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const localLeft = homeCenterX - parentRect.left - HOME_SIZE / 2;
  const localTop = homeCenterY - parentRect.top - HOME_SIZE / 2;
  const dx = targetCenterX - homeCenterX;
  const dy = targetCenterY - homeCenterY;

  const landed = landedComponentsFor(attribute, faceIndex);
  // 2–3 full spins per axis, derived from the seed so every client agrees.
  const spinsX = 2 + (tumbleSeed & 1);
  const spinsY = 2 + ((tumbleSeed >> 1) & 1);
  const spinDirX = ((tumbleSeed >> 2) & 1) ? 1 : -1;
  const spinDirY = ((tumbleSeed >> 3) & 1) ? 1 : -1;
  const initialX = landed.x + spinDirX * spinsX * 360;
  const initialY = landed.y + spinDirY * spinsY * 360;

  // Stage flags. Landed = final scale/translate applied; Instruction = crossfade done.
  const [landing, setLanding] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [cubeRot, setCubeRot] = useState<{ x: number; y: number }>({ x: initialX, y: initialY });
  const rafRef = useRef<number | null>(null);

  // rAF loop drives the cube tumble against serverNow(). Kicks off on mount;
  // if the joiner arrived mid-tumble, `elapsed` is already > 0 and we skip
  // straight to the current interpolated frame.
  useLayoutEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = serverNow() - startAt;
      const p = Math.max(0, Math.min(1, elapsed / TUMBLE_MS));
      const e = easeOut(p);
      setCubeRot({
        x: initialX + (landed.x - initialX) * e,
        y: initialY + (landed.y - initialY) * e,
      });
      if (elapsed < TUMBLE_MS) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Snap to exact landed rotation so downstream frames don't drift.
        setCubeRot({ x: landed.x, y: landed.y });
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // Rotation targets are derived from immutable commit fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule stage transitions off serverNow so late arrivals still land.
  useEffect(() => {
    const now = serverNow();
    const elapsed = now - startAt;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (t: number, fn: () => void) => {
      const delay = Math.max(0, t - elapsed);
      timers.push(setTimeout(fn, delay));
    };
    at(CROSSFADE_START, () => setShowInstruction(true));
    at(LAND_START, () => setLanding(true));
    at(ROLL_HERO_MS, onComplete);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outer transform: lifted → home. Only the transform animates, never left/top.
  const outerTransform = landing
    ? "translate(0px, 0px) scale(1)"
    : `translate(${dx}px, ${dy}px) scale(${LIFT_SCALE})`;

  const cubeRotationStr = `rotateX(${cubeRot.x}deg) rotateY(${cubeRot.y}deg)`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: localLeft,
        top: localTop,
        width: HOME_SIZE,
        height: HOME_SIZE,
        transform: outerTransform,
        transformOrigin: "50% 50%",
        transition: landing ? `transform ${LAND_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)` : "none",
        pointerEvents: "none",
        zIndex: 30,
        willChange: "transform",
      }}
    >
      {/* Cube layer — fades out during crossfade. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: showInstruction ? 0 : 1,
          transition: `opacity ${CROSSFADE_MS}ms linear`,
        }}
      >
        <MatchDie
          size={HOME_SIZE}
          attribute={attribute}
          faceIndex={faceIndex}
          rotation={cubeRotationStr}
        />
      </div>
      {/* Instruction card layer — fades in during crossfade. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.surface,
          border: `2px solid ${COLORS.ink}`,
          borderRadius: 8,
          boxShadow: "0px 4px 4px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
          boxSizing: "border-box",
          opacity: showInstruction ? 1 : 0,
          transition: `opacity ${CROSSFADE_MS}ms linear`,
          transform: "rotate(-3.65deg)",
        }}
      >
        <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: COLORS.ink, fontStyle: "italic" }}>
          Match the
        </span>
        <span style={{ fontFamily: FONT_FAMILY, fontSize: 20, color: COLORS.ink, fontWeight: 700 }}>
          {attribute}
        </span>
      </div>
    </div>
  );
};

export default RollHeroOverlay;
