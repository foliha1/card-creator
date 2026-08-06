import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import GameCard from "@/components/GameCard";
import DailyShapeRule from "@/components/DailyShapeRule";
import DailyHowToPlay from "@/components/DailyHowToPlay";
import { MatchDie, landedRotationFor } from "@/components/MatchDie";
import PreGameShell from "@/components/PreGameShell";
import DailyLogoLockup from "@/components/DailyLogoLockup";
import DailyEmailCapture from "@/components/DailyEmailCapture";
import { hasSubscribed } from "@/lib/dailySubscribe";

import { useDailyGame } from "@/hooks/useDailyGame";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DAILY_ROUNDS,
  MISSES_PER_ROUND,
  remainingCount,
  type DailyMark,
  type DailyPhase,
} from "@/lib/dailyEngine";
import { formatDailyShare, getLocalDateString } from "@/lib/daily";
import { formatStreakLine } from "@/lib/dailyResults";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { hapticError, hapticSuccess, hapticTap } from "@/lib/haptics";

import { playCorrect, playDeal, playDiceRoll, playWhoopCall, playWrong } from "@/lib/sounds";
import {
  BORDER,
  COLORS,
  FONT_FAMILY,
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

/** Two markers for the current round, filled as its misses are spent. */
const MissTracker: React.FC<{ used: number }> = ({ used }) => (
  <div
    role="img"
    aria-label={`${used} of ${MISSES_PER_ROUND} misses used this round`}
    style={{ display: "flex", gap: SPACE[2], alignItems: "center" }}
  >
    {Array.from({ length: MISSES_PER_ROUND }, (_, i) => (
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

/** One marker per resolved call in a round, in the order they happened. */
const RoundMarks: React.FC<{ events: DailyMark[] }> = ({ events }) => (
  <div style={{ display: "flex", gap: SPACE[2], alignItems: "center" }}>
    {events.length === 0 ? (
      <span style={{ width: 20, height: 20, opacity: 0.3, border: BORDER.heavy, borderRadius: 999 }} />
    ) : (
      events.map((m, i) => (
        <span
          key={i}
          title={m === "SOLVE" ? "Solved" : "Miss"}
          style={{
            width: 20,
            height: 20,
            borderRadius: m === "SOLVE" ? RADIUS.sm : 999,
            border: BORDER.heavy,
            background: m === "SOLVE" ? COLORS.ink : COLORS.red,
          }}
        />
      ))
    )}
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

/**
 * Secondary share options. All three reuse the exact string from
 * formatDailyShare — never a second, chattier variant.
 */
const SharePills: React.FC<{ text: string }> = ({ text }) => {
  const [copiedKey, setCopiedKey] = useState<"text" | "copy" | null>(null);

  const flash = (key: "text" | "copy") => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  };

  const copy = async (key: "text" | "copy") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — nothing more we can do */
    }
    flash(key);
  };

  const isMobile = () =>
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const onText = () => {
    hapticTap();
    if (isMobile()) {
      window.location.href = `sms:?body=${encodeURIComponent(text)}`;
      return;
    }
    void copy("text");
  };

  const onX = () => {
    hapticTap();
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const pill = (label: string, onClick: () => void, key?: string) => (
    <button
      key={label}
      type="button"
      className="ww-press daily-share-pill"
      onClick={onClick}
    >
      {key && copiedKey === key ? "Copied!" : label}
    </button>
  );

  return (
    <div
      style={{
        alignSelf: "stretch",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: SPACE[2],
      }}
    >
      {pill("Text a Friend", onText, "text")}
      {pill("Share on X", onX)}
      {pill("Copy", () => void copy("copy"), "copy")}
    </div>
  );
};


const DailyResultCard: React.FC<{
  puzzleNumber: number;
  attributes: ("SHAPE" | "NUMBER" | "COLOR")[];
  roundsSolved: number;
  totalMisses: number;
  roundEvents: DailyMark[][];
  peekUsed: boolean;
  peekRound: number | null;
  failed: boolean;
  shareText: string;
  /** Null hides the streak line entirely — never show a zero. */
  streak: number | null;
  mobile: boolean;
  revisit: boolean;
  onLeave: () => void;
}> = ({
  puzzleNumber,
  attributes,
  roundsSolved,
  totalMisses,
  roundEvents,
  peekUsed,
  peekRound,
  failed,
  shareText,
  streak,
  mobile,
  revisit,
  onLeave,
}) => {
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
          ? "Whooped! Better luck tomorrow."
          : revisit
            ? "Already played today. One puzzle a day — come back tomorrow."
            : "All three rounds played. One puzzle a day — come back tomorrow."}
      </p>
      <div style={{ display: "flex", gap: SPACE[4], alignSelf: "stretch" }}>
        {stat("Solved", `${roundsSolved}/${DAILY_ROUNDS}`)}
        {stat("Misses", `${totalMisses}`)}
        {stat("Peek", peekUsed ? `R${peekRound ?? "?"}` : "Unused")}
      </div>

      {streak !== null && streak >= 1 && (
        <p style={{ ...textStyle("body", mobile), color: COLORS.ink, textAlign: "center", margin: 0 }}>
          {formatStreakLine(streak)}
        </p>
      )}

      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: SPACE[2] }}>
        {roundEvents.map((events, i) => (
          <div
            key={`events-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE[3],
              ...textStyle("caption", mobile),
              color: COLORS.inkMuted,
            }}
          >
            <span>
              Round {i + 1}
              {peekUsed && peekRound === i + 1 ? " 👀" : ""}
            </span>
            <RoundMarks events={events} />
          </div>
        ))}
      </div>

      <ShareBlock text={shareText} mobile={mobile} />

      <SharePills text={shareText} />

      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: SPACE[2],
        }}
      >
        <p
          style={{
            ...textStyle("subhead", mobile),
            color: COLORS.ink,
            textAlign: "center",
            margin: 0,
          }}
        >
          Liked that? The full game has a table, an opponent, and a lot more shouting.
        </p>
        <Link
          to="/play"
          style={{
            ...textStyle("body", mobile),
            color: COLORS.blue,
            textAlign: "center",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Play the full game
        </Link>
      </div>

      {!hasSubscribed() && <DailyEmailCapture />}


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



/** Ready screen — logo + daily badge, date, how-to-play chip, play CTA. */
const DailyReadyScreen: React.FC<{
  today: string;
  /** Null hides the streak line — never show a zero. */
  streak: number | null;
  onPlay: () => void;
  onHowToPlay: () => void;
}> = ({ today, streak, onPlay, onHowToPlay }) => (
  <div
    style={{
      position: "relative",
      minHeight: "100dvh",
      height: "100dvh",
      boxSizing: "border-box",
      background: COLORS.surface,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 24,
      padding: 24,
      paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
      overflowY: "auto",
      "--daily-content-max-width": "402px",
      "--daily-content-padding-x": "24px",
    } as React.CSSProperties}
  >
    <DailyShapeRule />

    <div
      style={{
        width: "100%",
        maxWidth: 402,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}
    >
      <DailyLogoLockup />

      <div
        className="daily-intro"
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: "clamp(22px, 8vw, 32px)",
          lineHeight: "1.22",
          textAlign: "center",
          color: COLORS.ink,
        }}
      >
        {today}
        {streak !== null && streak >= 1 && (
          <div
            style={{
              marginTop: 8,
              fontFamily: FONT_FAMILY,
              fontSize: 16,
              lineHeight: 1.2,
              color: COLORS.inkMuted,
            }}
          >
            {formatStreakLine(streak)}
          </div>
        )}
      </div>

      <div className="daily-intro" style={{ display: "inline-block", animationDelay: "120ms" }}>
        <button
          type="button"
          className="ww-press daily-btn-howto"
          onClick={onHowToPlay}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 32,
            padding: "8px 16px",
            border: "none",
            borderRadius: RADIUS.sm,
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: 16,
            lineHeight: 1.15,

          }}
        >
          <HelpCircle size={16} aria-hidden="true" />
          How to Play
        </button>
      </div>

      <div className="daily-intro" style={{ width: "100%", animationDelay: "240ms" }}>
        <button
          type="button"
          className="ww-press daily-btn-play"
          onClick={onPlay}
          style={{
            width: "100%",
            height: 80,
            boxSizing: "border-box",
            paddingBottom: 6,
            border: BORDER.heavy,
            borderRadius: RADIUS.sm,
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: "clamp(22px, 7vw, 32px)",
            lineHeight: 1.15,
          }}

        >
          Play Today's Daily
        </button>
      </div>
  </DailyFrame>

);


const DailyPage: React.FC = () => {
  useBodyScrollLock();
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const daily = useDailyGame();
  const { state, phase } = daily;
  const leave = () => navigate("/");
  const [howTo, setHowTo] = useState(false);
  // Read after the run is persisted so today counts toward the streak.
  const streak = useDailyStreak(
    daily.puzzleNumber,
    daily.resultSaved || daily.result === null
  );

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
      case "WHOOPED":
        return "Whooped!";
      default:
        return state.peeking ? "Peeking…" : ATTR_LABEL[daily.roll.attribute];
    }
  })();

  const canClaim = phase === "PLAY" && !state.claiming && !state.peeking;
  const cardsTappable = phase === "PLAY" && state.claiming && state.selected.length < 2;
  const [ty, tm, td] = getLocalDateString().split("-").map(Number);
  const today = new Date(ty, tm - 1, td).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Helmet>
        <title>{`Daily Puzzle #${daily.puzzleNumber} | WHOOP! WHOOP!`}</title>
        <meta
          name="description"
          content="Nine cards, ten seconds, three rules and five misses. Everyone plays the same WHOOP! WHOOP! daily recall puzzle."
        />
        <meta property="og:title" content={`WHOOP! WHOOP! Daily Puzzle #${daily.puzzleNumber}`} />
        <meta
          property="og:description"
          content="Nine cards, ten seconds, three rules and five misses. Everyone plays the same WHOOP! WHOOP! daily recall puzzle."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://whoop-whoop.lovable.app/today" />
        <meta property="og:image" content="https://whoop-whoop.lovable.app/og-daily.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="WHOOP! WHOOP! — Nine cards. Ten seconds. Then the rules change."
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://whoop-whoop.lovable.app/og-daily.png" />
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
        {ready && (
          <>
            <DailyReadyScreen
              today={today}
              streak={streak?.current ?? null}
              onPlay={() => {
                hapticTap();
                daily.start();
              }}
              onHowToPlay={() => {
                hapticTap();
                setHowTo(true);
              }}
            />
            {howTo && <DailyHowToPlay onClose={() => setHowTo(false)} />}
          </>
        )}
        {!ready && (
        <PreGameShell mobile={mobile} gap={SPACE[5]}>

          {finished ? (
            <DailyResultCard
              puzzleNumber={daily.result!.puzzleNumber}
              attributes={daily.result!.attributes}
              roundsSolved={daily.result!.roundsSolved}
              totalMisses={daily.result!.totalMisses}
              roundEvents={daily.result!.roundEvents}
              peekUsed={daily.result!.peekUsed}
              peekRound={daily.result!.peekRound}
              failed={daily.result!.failed}
              shareText={formatDailyShare(daily.result!, streak?.current ?? null)}
              streak={streak?.current ?? null}
              mobile={mobile}
              revisit={daily.alreadyPlayed}
              onLeave={leave}
            />
          ) : ready ? null : (
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
                    <MissTracker used={state.roundMisses} />
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
                      faceUp={state.faceUp || state.revealPair.includes(idx)}
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

              <button
                type="button"
                className="ww-press"
                disabled={!daily.canPeek}
                onClick={() => {
                  hapticTap();
                  daily.peek();
                }}
                style={{
                  ...buttonStyle("ink", "md", {
                    mobile,
                    fullWidth: true,
                    disabled: !daily.canPeek,
                  }),
                }}
              >
                {state.peekUsed ? "PEEK USED" : "PEEK (5s)"}
              </button>

              <p
                style={{
                  ...textStyle("caption", mobile),
                  color: COLORS.inkMuted,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {phase === "PLAY"
                  ? `${ATTR_LABEL[daily.roll.attribute]} — ${MISSES_PER_ROUND - state.roundMisses} misses left this round.`
                  : "Nine cards, ten seconds. Then the die decides each round's rule."}
              </p>
            </div>
          )}
        </PreGameShell>
        )}
      </div>
    </>
  );
};

export default DailyPage;
