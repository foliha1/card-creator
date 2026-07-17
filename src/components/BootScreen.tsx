import React, { useState, useEffect, useMemo } from "react";
import { COLORS, FONT_FAMILY, TYPE, SPACE, RADIUS } from "@/lib/tokens";

interface BootScreenProps {
  onComplete: () => void;
}

type Phase = "black" | "cards" | "logo" | "wordmark" | "exit";

const CARDS = [
  { face: "/cards/2-circle-red.svg", rot: -8 },
  { face: "/cards/3-star-blue.svg", rot: 0 },
  { face: "/cards/1-square-yellow.svg", rot: 8 },
];

const CARD_W = 64;
const CARD_H = Math.round(CARD_W * (7 / 5));

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const reduced = useMemo(prefersReducedMotion, []);
  const [phase, setPhase] = useState<Phase>("black");
  const [flipped, setFlipped] = useState<boolean[]>([false, false, false]);

  useEffect(() => {
    const timers: number[] = [];
    const t = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, ms));

    if (reduced) {
      t(50, () => setPhase("logo"));
      t(600, () => setFlipped([true, true, true]));
      t(900, () => setPhase("wordmark"));
      t(1400, () => setPhase("exit"));
      t(1900, () => onComplete());
    } else {
      t(300, () => setPhase("cards"));
      // staggered flips 140ms apart, starting ~400ms after cards appear
      t(700, () => setFlipped((f) => [true, f[1], f[2]]));
      t(840, () => setFlipped((f) => [f[0], true, f[2]]));
      t(980, () => setFlipped((f) => [f[0], f[1], true]));
      t(1100, () => setPhase("logo"));
      t(1900, () => setPhase("wordmark"));
      t(2300, () => setPhase("exit"));
      t(2600, () => onComplete());
    }
    return () => timers.forEach(clearTimeout);
  }, [onComplete, reduced]);

  const visible = phase !== "black";
  const exiting = phase === "exit";

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
        transition: "opacity 400ms ease",
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Logo above */}
      <img
        src="/WhoopWhoop_Stacked_Logo.svg"
        alt="Whoop Whoop"
        style={{
          width: 180,
          filter: "brightness(10)",
          opacity: phase === "logo" || phase === "wordmark" || phase === "exit" ? 1 : 0,
          animation:
            phase === "logo" || phase === "wordmark"
              ? "boot-logo-in 500ms ease both"
              : undefined,
          transform: exiting ? "translateY(-8px)" : "translateY(0)",
          transition: "transform 400ms ease, opacity 400ms ease",
        }}
      />

      {/* Cards row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: -CARD_W * 0.35,
          transform: exiting ? "translateY(-8px)" : "translateY(0)",
          transition: "transform 400ms ease",
        }}
      >
        {CARDS.map((c, i) => (
          <div
            key={i}
            style={{
              width: CARD_W,
              height: CARD_H,
              marginLeft: i === 0 ? 0 : -CARD_W * 0.28,
              opacity: visible ? undefined : 0,
              animation:
                visible && !reduced
                  ? `boot-card-rise 500ms cubic-bezier(0.2,0.8,0.2,1) ${i * 90}ms both`
                  : undefined,
              filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.45))",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                transform: `rotate(${c.rot}deg)`,
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
                    : "transform 500ms cubic-bezier(0.4,0,0.2,1)",
                  transform: flipped[i] ? "rotateY(180deg)" : "rotateY(0deg)",
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
                  src={c.face}
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
          </div>
        ))}
      </div>

      {/* Wordmark below */}
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: TYPE.ui,
          color: COLORS.surface,
          letterSpacing: 1,
          opacity: phase === "wordmark" || phase === "exit" ? 1 : 0,
          animation:
            phase === "wordmark"
              ? reduced
                ? "boot-logo-in 400ms ease both"
                : "boot-wordmark-pop 500ms cubic-bezier(0.2,0.8,0.2,1) both"
              : undefined,
          transform: exiting ? "translateY(-8px)" : "translateY(0)",
          transition: "transform 400ms ease",
        }}
      >
        WHOOP! WHOOP!
      </div>
    </div>
  );
};

export default BootScreen;
