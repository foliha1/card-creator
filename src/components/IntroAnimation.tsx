import React, { Suspense, useEffect, useRef, useState } from "react";
import type { LottieRefCurrentProps } from "lottie-react";
import whoopLightLogo from "@/assets/WhoopWhoop_Light_Logo.svg.asset.json";

const Lottie = React.lazy(() =>
  import("lottie-react").then((m) => ({ default: m.default })),
);

const STORAGE_KEY = "ww_intro_seen";
const ASSET_URL = "/intro/whoop-intro.json";
const MATCH_CUT_MS = 500;

// Visual tuning: the artboard-space width of the logo at the final frame
// (1920x1920 artboard). Adjust after testing.
export const INTRO_LOGO_ARTBOARD_W = 700;

// Module-level preload. Starts as soon as this module is evaluated (lazy
// import from MultiplayerPage), so by the time the component mounts the
// fetch is already in flight — and often complete.
let introJsonPromise: Promise<unknown> | null = null;
export const preloadIntroJson = (): Promise<unknown> => {
  if (introJsonPromise) return introJsonPromise;
  introJsonPromise = fetch(ASSET_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .catch(() => null);
  return introJsonPromise;
};

// Resolves with the parsed JSON if it arrives within `ms`, else null.
export const getIntroJsonWithin = (ms: number): Promise<unknown | null> => {
  const p = preloadIntroJson();
  return new Promise((resolve) => {
    let settled = false;
    const to = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    p.then((data) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(to);
      resolve(data ?? null);
    });
  });
};

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

export type IntroDoneReason = "complete" | "skip";

interface IntroAnimationProps {
  onDone: (reason: IntroDoneReason) => void;
  /** Preloaded Lottie JSON. When provided, no fetch is issued. */
  preloadedData?: unknown | null;
}

type Phase = "playing" | "matchcut" | "persistent";

interface CutRect {
  startLeft: number;
  startTop: number;
  startW: number;
  endLeft: number;
  endTop: number;
  endW: number;
}

interface LottieJson {
  fr?: number;
  ip?: number;
  op?: number;
}

const computeDurationMs = (json: unknown): number | null => {
  if (!json || typeof json !== "object") return null;
  const j = json as LottieJson;
  const fr = typeof j.fr === "number" ? j.fr : 0;
  const ip = typeof j.ip === "number" ? j.ip : 0;
  const op = typeof j.op === "number" ? j.op : 0;
  if (fr <= 0 || op <= ip) return null;
  return ((op - ip) / fr) * 1000;
};

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onDone, preloadedData }) => {
  const [data, setData] = useState<unknown | null>(preloadedData ?? null);
  const [phase, setPhase] = useState<Phase>("playing");
  const [cut, setCut] = useState<CutRect | null>(null);
  const [transformed, setTransformed] = useState(false);
  const doneRef = useRef(false);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const durationMsRef = useRef<number | null>(computeDurationMs(preloadedData));

  const finish = React.useCallback(
    (reason: IntroDoneReason) => {
      if (doneRef.current) return;
      doneRef.current = true;
      markSeen();
      onDone(reason);
    },
    [onDone],
  );

  const skip = React.useCallback(() => {
    if (phase !== "playing" && phase !== "matchcut") return;
    finish("skip");
  }, [finish, phase]);

  const startMatchCut = React.useCallback(() => {
    if (doneRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.max(vw, vh) / 1920;
    const startW = INTRO_LOGO_ARTBOARD_W * scale;
    const aspect = 199 / 252;
    const startH = startW * aspect;
    const startLeft = vw / 2 - startW / 2;
    const startTop = vh / 2 - startH / 2;

    const el = document.querySelector<HTMLImageElement>('[data-lobby-logo="true"]');
    if (!el) {
      finish("skip");
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      finish("skip");
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

  useEffect(() => {
    if (phase !== "matchcut" || !cut) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransformed(true));
    });
    const to = window.setTimeout(() => {
      finish("complete");
      setPhase("persistent");
    }, MATCH_CUT_MS + 40);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(to);
    };
  }, [phase, cut, finish]);

  // Load asset if not preloaded. On any failure, dismiss immediately.
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    if (prefersReducedMotion()) {
      finish("skip");
      return;
    }
    preloadIntroJson().then((json) => {
      if (cancelled) return;
      if (!json) {
        finish("skip");
        return;
      }
      durationMsRef.current = computeDurationMs(json);
      setData(json);
    });
    return () => {
      cancelled = true;
    };
  }, [data, finish]);

  // Duration-based fallback: onComplete on lottie-react can miss on the final
  // frame. Fire startMatchCut after the animation's real duration if
  // onComplete has not run yet.
  useEffect(() => {
    if (!data || phase !== "playing") return;
    const duration = durationMsRef.current;
    if (!duration || duration <= 0) return;
    const to = window.setTimeout(() => {
      if (!doneRef.current && phase === "playing") startMatchCut();
    }, duration + 50);
    return () => window.clearTimeout(to);
  }, [data, phase, startMatchCut]);

  // Hard safety net: whatever happens, never keep the user stuck.
  useEffect(() => {
    const duration = durationMsRef.current ?? 3000;
    const cap = duration + MATCH_CUT_MS + 2000;
    const to = window.setTimeout(() => {
      if (!doneRef.current) finish("skip");
    }, cap);
    return () => window.clearTimeout(to);
  }, [data, finish]);

  // Skip on any keypress or pointer down anywhere — only while the intro is
  // still visually active. Once in the persistent background phase, the
  // listeners are removed so clicks on the lobby are unaffected.
  useEffect(() => {
    if (phase === "persistent") return;
    const onKey = () => skip();
    const onPointer = () => skip();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("touchstart", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("touchstart", onPointer, true);
    };
  }, [skip, phase]);

  if (!data && phase === "playing") return null;

  const isActive = phase === "playing" || phase === "matchcut";

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        // While playing/matchcut: on top of everything so it fully covers the
        // page. Once persistent: drop behind all UI so it becomes the
        // background layer for the rest of the session.
        zIndex: isActive ? 2147483000 : -1,
        background: "transparent",
        pointerEvents: isActive ? "auto" : "none",
        cursor: isActive ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {data && (
        <Suspense fallback={null}>
          <Lottie
            lottieRef={lottieRef}
            animationData={data}
            loop={false}
            autoplay
            onComplete={startMatchCut}
            onDOMLoaded={() => {
              const total = lottieRef.current?.getDuration?.(true);
              if (total !== undefined && total <= 0) finish("skip");
            }}
            rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
            style={{ width: "100%", height: "100%", pointerEvents: "none" }}
          />
        </Suspense>
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
