import React, { useEffect, useRef, useState } from "react";
import type { LottieRefCurrentProps } from "lottie-react";
import lockupAsset from "@/assets/WhoopWhoop_Daily_Lockup.svg.asset.json";
import animationAsset from "@/assets/whoop-daily-logo.json.asset.json";

const Lottie = React.lazy(() => import("lottie-react").then((m) => ({ default: m.default })));

// Preload both the player chunk and the animation JSON as soon as this module is
// imported, so the swap from static to animated happens as early as possible.
let dataPromise: Promise<unknown> | null = null;
const loadData = () => {
  if (!dataPromise) {
    void import("lottie-react");
    dataPromise = fetch(animationAsset.url).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
    );
  }
  return dataPromise;
};
loadData().catch(() => {
  /* static fallback covers it */
});

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The daily logo lockup. The static SVG is painted first and stays visible
 * until the Lottie has mounted and rendered its first frame, then the two
 * cross-fade in place — no gap, no layout shift, no flicker. If the JSON fetch
 * fails, the player fails, or the visitor prefers reduced motion, the static
 * lockup simply remains.
 */
const DailyLogoLockup: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const [json, setJson] = useState<unknown | null>(null);
  const [ready, setReady] = useState(false);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let live = true;
    loadData()
      .then((data) => {
        if (live) setJson(data);
      })
      .catch(() => {
        /* keep the static fallback */
      });
    return () => {
      live = false;
    };
  }, []);

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    transition: "opacity 200ms ease",
  };

  return (
    <div
      style={{ position: "relative", width: "100%", maxWidth: 251, aspectRatio: "251 / 211", ...style }}
    >
      <img
        src={lockupAsset.url}
        alt="Whoop Whoop Daily"
        style={{ ...layer, objectFit: "contain", opacity: ready ? 0 : 1 }}
      />
      {json && (
        <React.Suspense fallback={null}>
          <div style={{ ...layer, opacity: ready ? 1 : 0 }}>
            <Lottie
              lottieRef={lottieRef}
              animationData={json}
              loop={false}
              autoplay
              aria-hidden="true"
              onDOMLoaded={() => setReady(true)}
              rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </React.Suspense>
      )}
    </div>
  );
};

export default DailyLogoLockup;
