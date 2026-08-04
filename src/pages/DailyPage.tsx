import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import GameCard from "@/components/GameCard";
import { MatchDie, landedRotationFor } from "@/components/MatchDie";
import PreGameShell from "@/components/PreGameShell";
import { useDailyGame } from "@/hooks/useDailyGame";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DAILY_ROUNDS,
  MAX_MISSES,
  remainingCount,
  type DailyMark,
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

/** Five markers, filled as misses are spent. No numbers. */
const MissTracker: React.FC<{ used: number }> = ({ used }) => (
  <div
    role="img"
    aria-label={`${used} of ${MAX_MISSES} misses used`}
    style={{ display: "flex", gap: SPACE[2], alignItems: "center" }}
  >
    {Array.from({ length: MAX_MISSES }, (_, i) => (
      <span
        key={i}
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          border: BORDER.heavy,
          background: i < used ? COLORS.red : "transparent",
          transition: "background 200ms ease",
        }}
      />
    ))}
  </div>
);

/** One marker per resolved call, in the order they happened. */
const MarksRow: React.FC<{ marks: DailyMark[] }> = ({ marks }) => (
  <div style={{ display: "flex", gap: SPACE[2], flexWrap: "wrap", justifyContent: "center" }}>
    {marks.map((m, i) => (
      <span
        key={i}
        title={m === "MATCH" ? "Match" : "Miss"}
        style={{
          width: 20,
          height: 20,
          borderRadius: m === "MATCH" ? RADIUS.sm : 999,
          border: BORDER.heavy,
          background: m === "MATCH" ? COLORS.ink : COLORS.red,
        }}
      />
    ))}
  </div>
);

/** Share block — squares and counts only, never a card, position or rule. */
const ShareBlock: React.FC<{ text: string; mobile: boolean }> = ({ text, mobile }) => {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    hapticTap();
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* user dismissed or share unsupported — fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — nothing more we can do */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: SPACE[4] }}>
      <pre
        style={{
          margin: 0,
          border: BORDER.heavy,
          borderRadius: RADIUS.sm,
          background: COLORS.panel,
          padding: SPACE[4],
          textAlign: "center",
          whiteSpace: "pre-wrap",
          ...textStyle("caption", mobile),
          color: COLORS.ink,
        }}
      >
        {text}
      </pre>
      <button
        type="button"
        className="ww-press"
        onClick={share}
        style={{ ...buttonStyle("primary", "lg", { mobile }), alignSelf: "stretch" }}
      >
        {copied ? "COPIED" : "SHARE"}
      </button>
    </div>
  );
};

const DailyResultCard: React.FC<{
  puzzleNumber: number;
  attributes: ("SHAPE" | "NUMBER" | "COLOR")[];
  missesUsed: number;
  marks: DailyMark[];
  failed: boolean;
  shareText: string;
  mobile: boolean;
  revisit: boolean;
  onLeave: () => void;
}> = ({ puzzleNumber, attributes, missesUsed, marks, failed, shareText, mobile, revisit, onLeave }) => {

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
        {failed
          ? "Run failed — five misses used up."
          : revisit
            ? "Already played today. One puzzle a day — come back tomorrow."
            : "All three rounds called. One puzzle a day — come back tomorrow."}
      </p>
      <div style={{ display: "flex", gap: SPACE[4], alignSelf: "stretch" }}>
        {stat("Result", failed ? "FAILED" : "COMPLETE")}
        {stat("Misses", `${missesUsed}/${MAX_MISSES}`)}
      </div>
      <MarksRow marks={marks} />
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
        return ATTR_LABEL[daily.roll.attribute];
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
          content="Nine cards, ten seconds, three rules and five misses. Everyone plays the same Whoop Whoop daily recall puzzle."
        />
        <meta property="og:title" content={`Whoop Whoop Daily Puzzle #${daily.puzzleNumber}`} />
        <meta
          property="og:description"
          content="Nine cards, ten seconds, three rules and five misses. Everyone plays the same Whoop Whoop daily recall puzzle."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div style={{ minHeight: "100dvh", background: PAGE_BG }}>
        {daily.debugBypass && (
          <div
            role="status"
            style={{
              position: "fixed",
              top: 4,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              padding: "2px 8px",
              borderRadius: 999,
              background: COLORS.red,
              color: COLORS.surface,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              pointerEvents: "none",
            }}
          >
            DEBUG — LOCK BYPASSED, NOT A REAL RUN
          </div>
        )}
        <PreGameShell mobile={mobile} gap={SPACE[5]}>

          {finished ? (
            <DailyResultCard
              puzzleNumber={daily.result!.puzzleNumber}
              attributes={daily.result!.attributes}
              missesUsed={daily.result!.missesUsed}
              marks={daily.result!.marks}
              failed={daily.result!.failed}
              shareText={formatDailyShare(daily.result!)}

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
                Nine cards face up for ten seconds. Then they go down and the die decides the rule
                — three rounds, five misses to spend. You get one attempt today.
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
                  <div style={{ marginTop: SPACE[2] }}>
                    <MissTracker used={state.missesUsed} />
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
                  ? `${ATTR_LABEL[daily.roll.attribute]} — ${MAX_MISSES - state.missesUsed} misses left.`
                  : "Nine cards, ten seconds. Then the die decides each round's rule."}
              </p>
            </div>
          )}
        </PreGameShell>
      </div>
    </>
  );
};

export default DailyPage;
