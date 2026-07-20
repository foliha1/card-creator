import React, { useState, useEffect, useMemo, useRef } from "react";
import { COLORS, FONT_FAMILY, textStyle, SPACE, RADIUS } from "@/lib/tokens";

interface BootScreenProps {
  onComplete: () => void;
}

const CARD_W = 108;
const CARD_H = Math.round(CARD_W * (7 / 5));
const FLIP_INTERVAL = 700;
const MIN_DURATION = 1800;
const SETTLE_HOLD = 250;
const FADE_MS = 400;

const FACES = [
  "/cards/3-star-red.svg",
  "/cards/2-circle-blue.svg",
  "/cards/1-square-yellow.svg",
  "/cards/4-tri-red.svg",
  "/cards/2-star-yellow.svg",
  "/cards/3-circle-blue.svg",
  "/cards/1-tri-blue.svg",
  "/cards/4-square-yellow.svg",
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const reduced = useMemo(prefersReducedMotion, []);
  const [flipped, setFlipped] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const startRef = useRef<number>(Date.now());
  const poolRef = useRef<number[]>([]);
  const lastUsedRef = useRef<number | null>(null);

  const pickNextFace = () => {
    if (poolRef.current.length === 0) {
      const all = FACES.map((_, i) => i);
      // Avoid starting the new cycle with the same card that ended the last one.
      if (lastUsedRef.current !== null && all.length > 1) {
        const withoutLast = all.filter((i) => i !== lastUsedRef.current);
        poolRef.current = shuffle(withoutLast);
        const remaining = [lastUsedRef.current];
        poolRef.current.push(remaining[0]);
      } else {
        poolRef.current = shuffle(all);
      }
    }
    const next = poolRef.current.pop()!;
    lastUsedRef.current = next;
    return next;
  };

  useEffect(() => {
    const timers: number[] = [];
    const t = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, ms));

    if (reduced) {
      setFlipped(true); // face-up
      t(1200, () => setExiting(true));
      t(1200 + FADE_MS, () => onComplete());
      return () => timers.forEach(clearTimeout);
    }

    // Continuously flip
    const interval = window.setInterval(() => {
      setFlipped((f) => {
        const next = !f;
        // When returning to the back, swap the face for the next reveal.
        if (!next) {
          setFaceIndex(pickNextFace());
        }
        // If we've passed min duration and next state is face-up, settle.
        if (next && Date.now() - startRef.current >= MIN_DURATION) {
          window.clearInterval(interval);
          t(SETTLE_HOLD, () => setExiting(true));
          t(SETTLE_HOLD + FADE_MS, () => onComplete());
        }
        return next;
      });
    }, FLIP_INTERVAL);

    return () => {
      window.clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [onComplete, reduced]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE[6],
        zIndex: 9999,
        transition: `opacity ${FADE_MS}ms ease`,
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Single flipping card */}
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.45))",
          perspective: 800,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            transformStyle: "preserve-3d",
            transition: reduced
              ? "none"
              : "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <img
            src="/cards/card-back.svg"
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              borderRadius: RADIUS.md,
            }}
          />
          <img
            src={FACES[faceIndex]}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              borderRadius: RADIUS.md,
            }}
          />
        </div>
      </div>

      {/* Caption */}
      <div
        style={{
          ...textStyle("subhead"),
          fontStyle: "italic",
          color: COLORS.surface,
          opacity: 0.6,
          letterSpacing: 0.5,
        }}
      >
        Loading…
      </div>
    </div>
  );
};

export default BootScreen;
