import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import MultiplayerGameView from "@/components/MultiplayerGameView";
import PreGameShell from "@/components/PreGameShell";
import { useDailyGame } from "@/hooks/useDailyGame";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BORDER,
  COLORS,
  RADIUS,
  SPACE,
  buttonStyle,
  panelStyle,
  textStyle,
} from "@/lib/tokens";

const PAGE_BG = "#231F20";

/** Finished-state card: puzzle number, flips, wrong calls. Share block comes later. */
const DailyResultCard: React.FC<{
  puzzleNumber: number;
  flips: number;
  wrongCalls: number;
  mobile: boolean;
  onLeave: () => void;
}> = ({ puzzleNumber, flips, wrongCalls, mobile, onLeave }) => {
  const stat = (label: string, value: number) => (
    <div
      key={label}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        border: BORDER.heavy,
        borderRadius: RADIUS.sm,
        background: COLORS.panel,
        padding: `${SPACE[4]}px ${SPACE[3]}px`,
        textAlign: "center",
      }}
    >
      <div style={{ ...textStyle("display", mobile), color: COLORS.ink }}>{value}</div>
      <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted }}>{label}</div>
    </div>
  );

  return (
    <div
      style={{
        ...panelStyle("surface", 8),
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SPACE[6],
        padding: mobile ? SPACE[6] : SPACE[10],
      }}
    >
      <h1 style={{ ...textStyle("title", mobile), color: COLORS.ink, textAlign: "center", margin: 0 }}>
        Daily Puzzle #{puzzleNumber}
      </h1>
      <p style={{ ...textStyle("body", mobile), color: COLORS.inkMuted, textAlign: "center", margin: 0 }}>
        Solved. One puzzle a day — come back tomorrow for the next one.
      </p>
      <div style={{ display: "flex", gap: SPACE[4], alignSelf: "stretch" }}>
        {stat("Flips", flips)}
        {stat("Wrong calls", wrongCalls)}
      </div>
      <button
        type="button"
        className="ww-press"
        onClick={onLeave}
        style={{ ...buttonStyle("ink", "lg", { mobile }), alignSelf: "stretch" }}
      >
        BACK TO GAMES
      </button>
    </div>
  );
};

const DailyPage: React.FC = () => {
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const daily = useDailyGame("3x2");
  const leave = () => navigate("/");

  const finished = daily.result !== null;

  return (
    <>
      <Helmet>
        <title>Daily Puzzle #{daily.puzzleNumber} | Whoop Whoop</title>
        <meta
          name="description"
          content="One grid, one die, one shot. Everyone plays the same Whoop Whoop daily puzzle — see how few flips it takes you."
        />
        <meta property="og:title" content={`Whoop Whoop Daily Puzzle #${daily.puzzleNumber}`} />
        <meta
          property="og:description"
          content="One grid, one die, one shot. Everyone plays the same Whoop Whoop daily puzzle."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div style={{ minHeight: "100dvh", background: PAGE_BG }}>
        {finished ? (
          <PreGameShell mobile={mobile}>
            <DailyResultCard
              puzzleNumber={daily.result!.puzzleNumber}
              flips={daily.result!.flips}
              wrongCalls={daily.result!.wrongCalls}
              mobile={mobile}
              onLeave={leave}
            />
          </PreGameShell>
        ) : (
          <MultiplayerGameView
            publicState={daily.publicState}
            mySeat={daily.mySeat}
            rollCommit={daily.rollCommit}
            onIntent={daily.onIntent}
            onLeave={leave}
            mobile={mobile}
            roomId={daily.seed}
            visitorId="daily-you"
            isHost={true}
            soloMode={true}
          />
        )}
      </div>
    </>
  );
};

export default DailyPage;
