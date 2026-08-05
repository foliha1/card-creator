import React, { useEffect, useRef, useState } from "react";
import type { LottieRefCurrentProps } from "lottie-react";
import lockupAsset from "@/assets/WhoopWhoop_Daily_Lockup.svg.asset.json";
import animationAsset from "@/assets/whoop-daily-logo.json.asset.json";

const Lottie = React.lazy(() => import("lottie-react").then((m) => ({ default: m.default })));

/**
 * The daily logo lockup. Renders the static SVG immediately, then swaps to the
 * animated Lottie once its JSON has loaded. If the fetch or the player fails,
 * or the visitor prefers reduced motion, the static lockup simply stays.
 */
const DailyLogoLockup: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const [json, setJson] = useState<unknown | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let live = true;
    fetch(animationAsset.url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
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

  return (
    <div style={{ width: "100%", maxWidth: 251, aspectRatio: "251 / 211", ...style }}>
      {json ? (
        <React.Suspense
          fallback={
            <img
              src={lockupAsset.url}
              alt="Whoop Whoop Daily"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          }
        >
          <Lottie
            lottieRef={lottieRef}
            animationData={json}
            loop={false}
            autoplay
            aria-label="Whoop Whoop Daily"
            rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
            style={{ width: "100%", height: "100%" }}
          />
        </React.Suspense>
      ) : (
        <img
          src={lockupAsset.url}
          alt="Whoop Whoop Daily"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
    </div>
  );
};

export default DailyLogoLockup;
