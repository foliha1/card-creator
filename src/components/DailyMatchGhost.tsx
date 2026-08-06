// ============================================================================
// DailyMatchGhost — the correct-match reward for the daily puzzle.
//
// The daily engine removes a solved pair from the board the instant it
// resolves, so the reward is played by copies rendered into a fixed layer
// pinned over the slots the pair just left. Sequence:
//
//   1. REVEAL  both copies flip face up (the pair the player found)
//   2. HOLD    a beat long enough to read them
//   3. GREAT   the existing multiplayer ghost treatment (.ww-great + wash /
//              shine / ring) which lifts, scales and fades the pair out
//
// Under prefers-reduced-motion the reveal and the hold stay; the ghost layer
// is skipped entirely and the slots simply end up empty.
// ============================================================================

import React from "react";
import type { Card } from "@/cardData";
import { CARD_BACK_PATH } from "@/cardData";
import { RADIUS } from "@/lib/tokens";
import {
  DAILY_MATCH_HOLD_MS,
  DAILY_MATCH_REVEAL_MS,
  DAILY_MATCH_GREAT_MS,
} from "@/lib/animationTiming";

export interface GhostCard {
  key: string;
  card: Card;
  rect: { top: number; left: number; width: number; height: number };
}

type Stage = "reveal" | "hold" | "great";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

const DailyMatchGhost: React.FC<{ pair: GhostCard[]; onDone: () => void }> = ({
  pair,
  onDone,
}) => {
  const [stage, setStage] = React.useState<Stage>("reveal");
  const [faceUp, setFaceUp] = React.useState(false);
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    const reduced = prefersReducedMotion();
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Start face down, then flip on the next frame so the transition runs.
    const raf = requestAnimationFrame(() => setFaceUp(true));
    timers.push(setTimeout(() => setStage("hold"), DAILY_MATCH_REVEAL_MS));
    const afterHold = DAILY_MATCH_REVEAL_MS + DAILY_MATCH_HOLD_MS;
    if (reduced) {
      timers.push(setTimeout(() => doneRef.current(), afterHold));
    } else {
      timers.push(setTimeout(() => setStage("great"), afterHold));
      timers.push(
        setTimeout(() => doneRef.current(), afterHold + DAILY_MATCH_GREAT_MS)
      );
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (pair.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}
    >
      {pair.map((g) => (
        <div
          key={g.key}
          className={stage === "great" ? "ww-great" : undefined}
          style={{
            position: "absolute",
            top: g.rect.top,
            left: g.rect.left,
            width: g.rect.width,
            height: g.rect.height,
            borderRadius: RADIUS.md,
            perspective: 600,
            pointerEvents: "none",
            ["--ww-k" as string]: String(g.rect.width / 104.333),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              transition: `transform ${DAILY_MATCH_REVEAL_MS}ms cubic-bezier(0.4,0,0.2,1)`,
              transform: faceUp ? "rotateY(0deg)" : "rotateY(180deg)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                borderRadius: RADIUS.md,
                overflow: "hidden",
              }}
            >
              <img
                src={g.card.svgPath}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                borderRadius: RADIUS.md,
                overflow: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <img
                src={CARD_BACK_PATH}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>

          {stage === "great" && (
            <>
              <div
                className="ww-great-wash"
                style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
              />
              <div className="ww-great-shine" style={{ pointerEvents: "none", zIndex: 2 }} />
              <div
                className="ww-great-ring"
                style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default DailyMatchGhost;
