import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import React, { Suspense, useEffect, useState } from "react";
import { COLORS } from "@/lib/tokens";
const IntroAnimation = React.lazy(() => import("@/components/IntroAnimation"));
import { hasSeenIntro, preloadIntroJson, getIntroJsonWithin } from "@/components/IntroAnimation";
import whoopLightLogo from "@/assets/WhoopWhoop_Light_Logo.svg.asset.json";

const PAGE_BG = "#231F20";
// TODO: Temporary intro QA override — set to false to restore once-per-visitor behavior.
const FORCE_INTRO_EVERY_RELOAD_FOR_TESTING = true;
// If the intro JSON hasn't arrived within this window, skip the intro
// entirely rather than showing warm-black while we wait.
const INTRO_READY_BUDGET_MS = 600;

// Kick off the download as early as possible: the moment this module
// evaluates, before the component mounts.
preloadIntroJson();

const MultiplayerWindow = React.lazy(() => import("@/components/MultiplayerWindow"));

type IntroStatus = "pending" | "running" | "skipped" | "complete" | "none";

const MultiplayerPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode?: string }>();
  const initialIntroStatus = (): IntroStatus => {
    const alreadySeen = hasSeenIntro();
    if (!FORCE_INTRO_EVERY_RELOAD_FOR_TESTING && alreadySeen) return "none";
    return "pending";
  };
  const [introStatus, setIntroStatus] = useState<IntroStatus>(initialIntroStatus);
  const [introData, setIntroData] = useState<unknown | null>(null);

  // Preload the logo image for the match-cut.
  useEffect(() => {
    const img = new Image();
    img.src = whoopLightLogo.url;
  }, []);

  // Race the JSON against the ready budget. If it wins → play the intro.
  // If it loses → skip entirely and show the static pattern.
  useEffect(() => {
    if (introStatus !== "pending") return;
    let cancelled = false;
    getIntroJsonWithin(INTRO_READY_BUDGET_MS).then((json) => {
      if (cancelled) return;
      if (json) {
        setIntroData(json);
        setIntroStatus("running");
      } else {
        setIntroStatus("skipped");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [introStatus]);

  // The intro's Lottie is the page background whenever it is/was playing.
  // The static pattern is only used when the intro is skipped or never runs.
  const introMounted = introStatus === "running" || introStatus === "complete";
  const showPattern = introStatus === "skipped" || introStatus === "none";

  const title = "Multiplayer — WHOOP! WHOOP!";
  const description =
    "Play WHOOP! WHOOP! online with friends. Start a table, share the link, and match cards under the die.";
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>
      <div
        className="mp-page-root"
        role="main"
        aria-label="WHOOP! WHOOP! multiplayer"
        style={{
          height: "100dvh",
          width: "100%",
          overflow: "hidden",
          position: "relative",
          isolation: "isolate",
          backgroundColor: PAGE_BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        {showPattern && (
          <img
            src="/whoop-pattern-bg.svg"
            alt=""
            aria-hidden="true"
            decoding="async"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center center",
              opacity: 1,
              zIndex: -1,
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        )}

        <div
          style={{
            width: "100%",
            maxWidth: 420,
            height: "100%",
            maxHeight: 900,
            margin: "auto",
            padding: "calc(8px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left))",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Suspense fallback={<div style={{ margin: "auto", color: COLORS.ink }}>Loading…</div>}>
            <MultiplayerWindow
              initialRoomCode={roomCode}
              introStatus={introStatus === "pending" ? "running" : introStatus}
            />
          </Suspense>
        </div>
      </div>
      {introMounted && (
        <Suspense fallback={null}>
          <IntroAnimation
            preloadedData={introData}
            onDone={(reason) =>
              setIntroStatus(reason === "complete" ? "complete" : "skipped")
            }
          />
        </Suspense>
      )}
    </>
  );
};

export default MultiplayerPage;
