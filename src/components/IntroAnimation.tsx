import React, { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import whoopLightLogo from "@/assets/WhoopWhoop_Light_Logo.svg.asset.json";

const STORAGE_KEY = "ww_intro_seen";
const ASSET_URL = "/intro/whoop-intro.json";
const MATCH_CUT_MS = 500;

// Visual tuning: the artboard-space width of the logo at the final frame
// (1920x1920 artboard). Adjust after testing.
export const INTRO_LOGO_ARTBOARD_W = 700;

export const hasSeenIntro = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const markSeen = () => {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
};

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

interface IntroAnimationProps {
  onDone: () => void;
}

type Phase = "playing" | "matchcut";

interface CutRect {
  startLeft: number;
  startTop: number;
  startW: number;
  endLeft: number;
  endTop: number;
  endW: number;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onDone }) => {
  const [data, setData] = useState<unknown | null>(null);
  const [phase, setPhase] = useState<Phase>("playing");
  const [cut, setCut] = useState<CutRect | null>(null);
  const [transformed, setTransformed] = useState(false);
  const doneRef = useRef(false);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    markSeen();
    onDone();
  }, [onDone]);

  const skip = React.useCallback(() => {
    finish();
  }, [finish]);

  const startMatchCut = React.useCallback(() => {
    if (doneRef.current) return;
    // Compute start rect: centred, sized by cover scale of 1920 artboard.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.max(vw, vh) / 1920;
    const startW = INTRO_LOGO_ARTBOARD_W * scale;
    // Preserve logo aspect ratio (252 x 199).
    const aspect = 199 / 252;
    const startH = startW * aspect;
    const startLeft = vw / 2 - startW / 2;
    const startTop = vh / 2 - startH / 2;

    // Measure lobby logo.
    const el = document.querySelector<HTMLImageElement>('[data-lobby-logo="true"]');
    if (!el) {
      finish();
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      finish();
      return;
    }

    setCut({
      startLeft,
      startTop,
      startW,
      endLeft: r.left,
      endTop: r.top,
      endW: r.width,
    });
    setPhase("matchcut");
  }, [finish]);

  // Kick off the CSS transition on the frame after we mount the img.
  useEffect(() => {
    if (phase !== "matchcut" || !cut) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransformed(true));
    });
    const to = window.setTimeout(finish, MATCH_CUT_MS + 40);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(to);
    };
  }, [phase, cut, finish]);

  // Load asset. On any failure, dismiss immediately.
  useEffect(() => {
    let cancelled = false;
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    fetch(ASSET_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch(() => {
        if (!cancelled) finish();
      });
    return () => {
      cancelled = true;
    };
  }, [finish]);

  // Skip on any keypress.
  useEffect(() => {
    const onKey = () => skip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  if (!data && phase === "playing") return null;

  return (
    <div
      role="presentation"
      onClick={phase === "playing" ? skip : undefined}
      onTouchStart={phase === "playing" ? skip : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "transparent",
        pointerEvents: phase === "playing" ? "auto" : "none",
        cursor: phase === "playing" ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {phase === "playing" && data && (
        <Lottie
          lottieRef={lottieRef}
          animationData={data}
          loop={false}
          autoplay
          onComplete={startMatchCut}
          onDOMLoaded={() => {
            const total = lottieRef.current?.getDuration?.(true);
            if (total !== undefined && total <= 0) finish();
          }}
          rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
          style={{ width: "100%", height: "100%" }}
        />
      )}
      {phase === "matchcut" && cut && (() => {
        const aspect = 199 / 252;
        const tx = cut.endLeft - cut.startLeft;
        const ty = cut.endTop - cut.startTop;
        const s = cut.endW / cut.startW;
        return (
          <img
            src={whoopLightLogo.url}
            alt=""
            aria-hidden="true"
            style={{
              position: "fixed",
              left: cut.startLeft,
              top: cut.startTop,
              width: cut.startW,
              height: cut.startW * aspect,
              transformOrigin: "top left",
              transform: transformed
                ? `translate(${tx}px, ${ty}px) scale(${s})`
                : "translate(0,0) scale(1)",
              transition: `transform ${MATCH_CUT_MS}ms ease-out`,
              willChange: "transform",
              pointerEvents: "none",
              userSelect: "none",
            }}
            draggable={false}
          />
        );
      })()}
    </div>
  );
};

export default IntroAnimation;
