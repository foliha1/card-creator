import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import React, { Suspense } from "react";
import { COLORS } from "@/lib/tokens";

const PAGE_BG = "#231F20";

const MultiplayerWindow = React.lazy(() => import("@/components/MultiplayerWindow"));

const MultiplayerPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode?: string }>();
  const title = "Multiplayer — WHOOP! WHOOP!";
  const description =
    "Play WHOOP! WHOOP! online with friends. Start a room, share the link, and match cards under the die.";
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
        role="main"
        aria-label="WHOOP! WHOOP! multiplayer"
        style={{
          height: "100dvh",
          width: "100%",
          overflow: "hidden",
          background: PAGE_BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
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
            <MultiplayerWindow initialRoomCode={roomCode} />
          </Suspense>
        </div>
      </div>
    </>
  );
};

export default MultiplayerPage;
