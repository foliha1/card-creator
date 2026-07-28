import React, { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

const STORAGE_KEY = "ww_intro_seen";
const ASSET_URL = "/intro/whoop-intro.json";

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

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onDone }) => {
  const [data, setData] = useState<unknown | null>(null);
  const doneRef = useRef(false);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  const dismiss = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    markSeen();
    onDone();
  }, [onDone]);

  // Load asset. On any failure, dismiss immediately.
  useEffect(() => {
    let cancelled = false;
    if (prefersReducedMotion()) {
      dismiss();
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
        if (!cancelled) dismiss();
      });
    return () => {
      cancelled = true;
    };
  }, [dismiss]);

  // Global skip: any keypress skips.
  useEffect(() => {
    const onKey = () => dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  if (!data) return null;

  return (
    <div
      role="presentation"
      onClick={dismiss}
      onTouchStart={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        pointerEvents: "auto",
        cursor: "pointer",
      }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={data}
        loop={false}
        autoplay
        onComplete={dismiss}
        onDOMLoaded={() => {
          // Extra safety: if animation is somehow zero-length, dismiss.
          const total = lottieRef.current?.getDuration?.(true);
          if (total !== undefined && total <= 0) dismiss();
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default IntroAnimation;
