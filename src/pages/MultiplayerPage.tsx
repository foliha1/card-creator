import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import React, { Suspense, useEffect, useState } from "react";
import { COLORS } from "@/lib/tokens";
import IntroAnimation from "@/components/IntroAnimation";
import whoopLightLogo from "@/assets/WhoopWhoop_Light_Logo.svg.asset.json";

const PAGE_BG = "#231F20";
const INTRO_JSON_URL = "/intro/whoop-intro.json";

const MultiplayerWindow = React.lazy(() => import("@/components/MultiplayerWindow"));

const MultiplayerPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode?: string }>();
  // TEMP: always show intro for testing (was: !hasSeenIntro()).
  const [introStatus, setIntroStatus] = useState<"running" | "skipped" | "complete" | "none">("running");

  // Preload intro JSON and logo image to reduce first-frame flicker.
  useEffect(() => {
    let cancelled = false;
    fetch(INTRO_JSON_URL, { cache: "force-cache" }).catch(() => {
      /* ignore, IntroAnimation handles failure */
    });
    const img = new Image();
    img.src = whoopLightLogo.url;
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, []);

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
            <MultiplayerWindow initialRoomCode={roomCode} introStatus={introStatus} />
          </Suspense>
        </div>
      </div>
      {introStatus === "running" && (
        <IntroAnimation
          onDone={(reason) => setIntroStatus(reason === "complete" ? "complete" : "skipped")}
        />
      )}
    </>
  );
};

export default MultiplayerPage;
