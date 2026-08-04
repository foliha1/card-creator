import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import GameCard from "@/components/GameCard";
import { MatchDie, landedRotationFor } from "@/components/MatchDie";
import PreGameShell from "@/components/PreGameShell";
import { useDailyGame } from "@/hooks/useDailyGame";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  formatSeconds,
  DAILY_ROUNDS,
  remainingCount,
  type DailyPhase,
} from "@/lib/dailyEngine";
import { hapticError, hapticSuccess, hapticTap } from "@/lib/haptics";
import { playCorrect, playDeal, playDiceRoll, playWhoopCall, playWrong } from "@/lib/sounds";
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
const TUMBLE_MS = 800;
const ATTR_LABEL: Record<string, string> = {
  SHAPE: "Match the shape",
  NUMBER: "Match the number",
  COLOR: "Match the colour",
};

/**
 * The die. Hidden behind a blank until the first roll, so the round's rule can
 * never leak while the board is still face up — the whole point of the mode.
 */
const DailyDie: React.FC<{
  phase: DailyPhase;
  roundIndex: number;
  attribute: "SHAPE" | "NUMBER" | "COLOR";
  faceIndex: 0 | 1;
  tumbleSeed: number;
  size: number;
}> = ({ phase, roundIndex, attribute, faceIndex, tumbleSeed, size }) => {
  const landed = landedRotationFor(attribute, faceIndex);
  const spins = 2 + (tumbleSeed & 1);
  const dir = (tumbleSeed >> 2) & 1 ? 1 : -1;
  const spun = `rotateX(${dir * (spins * 360 + 140)}deg) rotateY(${-dir * (spins * 360 + 55)}deg)`;
  const [rotation, setRotation] = useState(spun);

  useEffect(() => {
    if (phase !== "ROLL") return;
    setRotation(spun);
    const id = requestAnimationFrame(() => setRotation(landed));
    return () => cancelAnimationFrame(id);
  }, [phase, roundIndex, spun, landed]);

  const preRoll =
    roundIndex === 1 && (phase === "DEAL" || phase === "STUDY" || phase === "HIDE");
  const rolling = phase === "ROLL";

  if (preRoll) {
    return (
      <div
        aria-label="The die has not rolled yet"
        style={{
          width: size,
          height: size,
          border: BORDER.heavy,
          borderRadius: RADIUS.sm,
          background: COLORS.panel,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.inkMuted,
          ...textStyle("title"),
        }}
      >
        ?
      </div>
    );
  }

  return (
    <div style={{ transform: rolling ? "scale(1.6)" : "scale(1)", transition: `transform 300ms ease` }}>
      <MatchDie
        size={size}
        attribute={attribute}
        faceIndex={faceIndex}
        rotation={rotation}
        transition={rolling ? `transform ${TUMBLE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)` : undefined}
      />
    </div>
  );
};

const DailyResultCard: React.FC<{
  puzzleNumber: number;
  attributes: ("SHAPE" | "NUMBER" | "COLOR")[];
  elapsedMs: number;
  wrongCalls: number;
  mobile: boolean;
  revisit: boolean;
  onLeave: () => void;
}> = ({ puzzleNumber, attributes, elapsedMs, wrongCalls, mobile, revisit, onLeave }) => {
  const stat = (label: string, value: string) => (
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
        {revisit
          ? "Already solved today. One puzzle a day — come back tomorrow."
          : "Three rounds down. One puzzle a day — come back tomorrow for the next one."}
      </p>
      <div style={{ display: "flex", gap: SPACE[4], alignSelf: "stretch" }}>
        {stat("Total time", `${formatSeconds(elapsedMs)}s`)}
        {stat("Wrong calls", String(wrongCalls))}
      </div>
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: SPACE[2] }}>
        {attributes.map((attr, i) => (
          <div
            key={`${attr}-${i}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: SPACE[3],
              ...textStyle("caption", mobile),
              color: COLORS.ink,
            }}
          >
            <span style={{ color: COLORS.inkMuted }}>Round {i + 1}</span>
            <span>{ATTR_LABEL[attr]}</span>
          </div>
        ))}
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
  const daily = useDailyGame();
  const { state, phase } = daily;
  const leave = () => navigate("/");

  // --- sound + haptic cues, driven off phase / counters ---
  useEffect(() => {
    if (phase === "STUDY") playDeal(9);
    if (phase === "ROLL") playDiceRoll();
  }, [phase, state.roundIndex]);

  useEffect(() => {
    if (state.wrongToken === 0) return;
    playWrong();
    hapticError();
  }, [state.wrongToken]);

  useEffect(() => {
    if (state.matchedPair.length === 0) return;
    playCorrect();
    hapticSuccess();
  }, [state.matchedPair.length, state.roundIndex]);

  useEffect(() => {
    if (phase !== "DONE") return;
    hapticSuccess();
  }, [phase]);

  const finished = daily.result !== null && (daily.alreadyPlayed || phase === "DONE");
  const ready = !finished && phase === "READY";

  const readout = (() => {
    switch (phase) {
      case "DEAL":
        return "Dealing…";
      case "STUDY":
        return `Memorise: ${daily.studyRemaining}`;
      case "HIDE":
        return "Cards down";
      case "ROLL":
        return "Rolling…";
      default:
        return `${formatSeconds(daily.elapsedMs)}s`;
    }
  })();

  const canClaim = phase === "PLAY" && !state.claiming;
  const cardsTappable = phase === "PLAY" && state.claiming && state.selected.length < 2;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Helmet>
        <title>{`Daily Puzzle #${daily.puzzleNumber} | Whoop Whoop`}</title>
        <meta
          name="description"
          content="Nine cards, five seconds, three rules. Everyone plays the same Whoop Whoop daily recall puzzle — how fast can you call all three pairs?"
        />
        <meta property="og:title" content={`Whoop Whoop Daily Puzzle #${daily.puzzleNumber}`} />
        <meta
          property="og:description"
          content="Nine cards, five seconds, three rules. Everyone plays the same Whoop Whoop daily recall puzzle."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div style={{ minHeight: "100dvh", background: PAGE_BG }}>
        <PreGameShell mobile={mobile} gap={SPACE[5]}>
          {finished ? (
            <DailyResultCard
              puzzleNumber={daily.result!.puzzleNumber}
              attributes={daily.result!.attributes}
              elapsedMs={daily.result!.elapsedMs}
              wrongCalls={daily.result!.wrongCalls}
              mobile={mobile}
              revisit={daily.alreadyPlayed}
              onLeave={leave}
            />
          ) : ready ? (
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
              <h1
                style={{
                  ...textStyle("title", mobile),
                  color: COLORS.ink,
                  textAlign: "center",
                  margin: 0,
                }}
              >
                Daily Puzzle #{daily.puzzleNumber}
              </h1>
              <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted }}>{today}</div>
              <p
                style={{
                  ...textStyle("body", mobile),
                  color: COLORS.inkMuted,
                  textAlign: "center",
                  margin: 0,
                }}
              >
                Nine cards face up for five seconds. Then they go down and the die decides the rule
                — three rounds, one clock. You get one attempt today.
              </p>
              <button
                type="button"
                className="ww-press"
                onClick={() => {
                  hapticTap();
                  daily.start();
                }}
                style={{ ...buttonStyle("primary", "lg", { mobile }), alignSelf: "stretch" }}
              >
                PLAY
              </button>
            </div>
          ) : (
            <div
              style={{
                ...panelStyle("surface", 6),
                alignSelf: "stretch",
                display: "flex",
                flexDirection: "column",
                gap: SPACE[5],
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: SPACE[4],
                }}
              >
                <div>
                  <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted }}>
                    Round {state.roundIndex} of {DAILY_ROUNDS} · {remainingCount(state)} cards
                  </div>
                  <div
                    aria-live="polite"
                    style={{ ...textStyle("display", mobile), color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}
                  >
                    {readout}
                  </div>
                </div>
                <DailyDie
                  phase={phase}
                  roundIndex={state.roundIndex}
                  attribute={daily.roll.attribute}
                  faceIndex={daily.roll.faceIndex}
                  tumbleSeed={daily.tumbleSeed}
                  size={56}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: SPACE[3],
                }}
              >
                {state.grid.map((card, idx) =>
                  card === null ? (
                    <div
                      key={`empty-${idx}`}
                      aria-hidden="true"
                      style={{
                        aspectRatio: "2 / 3",
                        borderRadius: RADIUS.sm,
                        border: `2px dashed ${COLORS.inkMuted}`,
                        opacity: 0.25,
                      }}
                    />
                  ) : (
                    <GameCard
                      key={card.id}
                      card={card}
                      faceUp={state.faceUp}
                      highlighted={state.selected.includes(idx)}
                      matched={state.matchedPair.includes(idx)}
                      wrong={state.wrongPair.includes(idx)}
                      interactive={cardsTappable}
                      dealIndex={idx}
                      dealKey={daily.seed}
                      onClick={() => {
                        hapticTap();
                        daily.select(idx);
                      }}
                    />
                  )
                )}
              </div>

              {state.claiming ? (
                <button
                  type="button"
                  className="ww-press"
                  onClick={daily.cancelClaim}
                  disabled={state.selected.length > 0}
                  style={{
                    ...buttonStyle("ink", "lg", {
                      mobile,
                      fullWidth: true,
                      disabled: state.selected.length > 0,
                    }),
                  }}
                >
                  {state.selected.length > 0 ? "PICK YOUR PAIR" : "CANCEL MATCH"}
                </button>
              ) : (
                <button
                  type="button"
                  className="ww-press"
                  disabled={!canClaim}
                  onClick={() => {
                    hapticTap();
                    playWhoopCall();
                    daily.claim();
                  }}
                  style={{
                    ...buttonStyle("primary", "lg", {
                      mobile,
                      fullWidth: true,
                      disabled: !canClaim,
                    }),
                  }}
                >
                  WHOOP! WHOOP!
                </button>
              )}

              <p
                style={{
                  ...textStyle("caption", mobile),
                  color: COLORS.inkMuted,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {phase === "PLAY"
                  ? `${ATTR_LABEL[daily.roll.attribute]} — a wrong pair costs 1 second.`
                  : "Nine cards, five seconds. Then the die decides each round's rule."}
              </p>
            </div>
          )}
        </PreGameShell>
      </div>
    </>
  );
};

export default DailyPage;
