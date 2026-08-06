import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { HelpCircle } from "lucide-react";
import GameCard from "@/components/GameCard";
import DailyFrame from "@/components/DailyFrame";
import DailyHowToPlay from "@/components/DailyHowToPlay";
import { MatchDie, landedRotationFor } from "@/components/MatchDie";
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
import { formatDailyShare, getLocalDateString, type DailyResult } from "@/lib/daily";
import { renderDailyShareImage } from "@/lib/dailyShareImage";

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
  textStyle,
} from "@/lib/tokens";

const TUMBLE_MS = 800;
const ATTR_LABEL: Record<string, string> = {
  SHAPE: "Match the shape",
  NUMBER: "Match the number",
  COLOR: "Match the color",
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

/**
 * Share block — renders the day's result as a PNG and shares it alongside the
 * unchanged share text. Every failure path degrades to text, silently.
 */
const ShareBlock: React.FC<{
  text: string;
  result: DailyResult;
  streak: number | null;
  mobile: boolean;
}> = ({ text, result, streak, mobile }) => {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);

  const flashCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const shareTextOnly = async () => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* dismissed or unsupported — fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — nothing more we can do */
    }
    flashCopied();
  };

  const share = async () => {
    hapticTap();
    setWorking(true);
    let blob: Blob | null = null;
    try {
      blob = await renderDailyShareImage(result, streak);
    } catch {
      blob = null;
    }
    setWorking(false);

    if (blob) {
      const file = new File([blob], `whoop-whoop-${result.puzzleNumber}.png`, {
        type: "image/png",
      });
      try {
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function" &&
          navigator.canShare?.({ files: [file] })
        ) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch {
        /* dismissed or file share refused — fall back below */
      }
    }

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await shareTextOnly();
      return;
    }

    // No web share at all — download the image and copy the text.
    if (blob) {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `whoop-whoop-${result.puzzleNumber}.png`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        /* download blocked — the text copy below is still useful */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
    flashCopied();
  };

  return (
    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: SPACE[4] }}>
      <button
        type="button"
        className="ww-press"
        onClick={share}
        disabled={working}
        style={{ ...buttonStyle("primary", "lg", { mobile }), alignSelf: "stretch" }}
      >
        {working ? "MAKING IMAGE…" : copied ? "COPIED" : "SHARE"}
      </button>
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
  /** The stored run, used to render the share image. */
  result: DailyResult;
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
  result,
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
        width: "100%",
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SPACE[6],
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
      </div>


      {streak !== null && streak >= 1 && (
        <p style={{ ...textStyle("body", mobile), color: COLORS.ink, textAlign: "center", margin: 0 }}>
          {formatStreakLine(streak)}
        </p>
      )}

      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: SPACE[2] }}>
        {roundEvents.map((events, i) => (
          <div
            key={`round-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE[3],
              ...textStyle("caption", mobile),
              color: COLORS.ink,
            }}
          >
            <span style={{ color: COLORS.inkMuted }}>Round {i + 1}</span>
            <span>
              {attributes[i] ? ATTR_LABEL[attributes[i]] : ""}
              {peekUsed && peekRound === i + 1 ? " 👀" : ""}
            </span>
            <span style={{ marginLeft: "auto" }}>
              <RoundMarks events={events} />
            </span>
          </div>
        ))}
      </div>

      <ShareBlock text={shareText} result={result} streak={streak} mobile={mobile} />


      {!hasSubscribed() && (
        <div
          style={{
            alignSelf: "stretch",
            border: BORDER.heavy,
            borderRadius: RADIUS.sm,
            padding: SPACE[6],
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DailyEmailCapture />
        </div>
      )}

      <button
        type="button"
        className="ww-press"
        onClick={onLeave}
        style={{ ...buttonStyle("ink", "lg", { mobile }), alignSelf: "stretch" }}
      >
        DONE
      </button>
    </div>
  );
};



/** Ready screen — logo + daily badge, date, how-to-play chip, play CTA. */
const DailyReadyScreen: React.FC<{
  today: string;
  /** Null hides the streak line — never show a zero. */
  streak: number | null;
  /** True when today's run is already complete. */
  played?: boolean;
  mobile?: boolean;
  onPlay: () => void;
  onHowToPlay: () => void;
}> = ({ today, streak, played = false, mobile = false, onPlay, onHowToPlay }) => (
  <DailyFrame gap={40}>
      <DailyLogoLockup />


      <div
        className="daily-intro"
        style={{
          ...textStyle("hero", mobile),
          textAlign: "center",
          color: COLORS.ink,
        }}
      >
        {today}
        {played && (
          <div style={{ marginTop: 8 }}>
            <span
              style={{
                ...textStyle("pill", mobile),
                display: "inline-block",
                padding: "8px 16px",
                borderRadius: 999,
                background: COLORS.orange,
                border: BORDER.heavy,
                color: COLORS.ink,
              }}
            >
              Played today
            </span>
          </div>
        )}

        {streak !== null && streak >= 1 && (
          <div
            style={{
              ...textStyle("pill", mobile),
              marginTop: 8,
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
            ...textStyle("chip", mobile),
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 32,
            padding: "8px 16px",
            border: "none",
            borderRadius: RADIUS.sm,
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
            ...textStyle("action", mobile),
            width: "100%",
            height: 80,
            boxSizing: "border-box",
            border: BORDER.heavy,
            borderRadius: RADIUS.sm,
          }}

        >
          {played ? "See Today's Result" : "Play Today's Daily"}
        </button>
      </div>
  </DailyFrame>

);


/**
 * Card area that scales its cards to the space it is given instead of pushing
 * the page taller. Same approach as the multiplayer board: measure the content
 * box with a ResizeObserver, then take Math.min(byWidth, byHeight) so the real
 * 5:7 card proportions are always preserved.
 */
const BOARD_COLS = 3;
const BOARD_GAP = 8;
const BOARD_RATIO = 7 / 5; // card height / card width
const BOARD_MIN_CARD_W = 44;

const DailyBoard: React.FC<{
  rows: number;
  children: React.ReactNode;
}> = ({ rows, children }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number, h: number) =>
      setBox((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }
      );
    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byWidth = (box.w - (BOARD_COLS - 1) * BOARD_GAP) / BOARD_COLS;
  const byHeight = (box.h - (rows - 1) * BOARD_GAP) / rows / BOARD_RATIO;
  const raw = Math.min(byWidth, byHeight);
  const cardW = Math.floor(
    Math.max(BOARD_MIN_CARD_W, Number.isFinite(raw) && raw > 0 ? raw : BOARD_MIN_CARD_W)
  );
  const cardH = Math.round(cardW * BOARD_RATIO);

  return (
    <div
      ref={ref}
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${BOARD_COLS}, ${cardW}px)`,
          gridAutoRows: `${cardH}px`,
          gap: BOARD_GAP,
        }}
      >
        {children}
      </div>
    </div>
  );
};


const DailyPage: React.FC = () => {
  useBodyScrollLock();
  const mobile = useIsMobile();
  const daily = useDailyGame();
  const { state, phase } = daily;
  const [howTo, setHowTo] = useState(false);
  const [showResult, setShowResult] = useState(false);
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
    setShowResult(true);
  }, [phase]);

  const playedToday = daily.result !== null && (daily.alreadyPlayed || phase === "DONE");
  const finished = playedToday && showResult;
  const ready = !finished && (phase === "READY" || playedToday);

  const readout = (() => {
    switch (phase) {
      case "DEAL":
        return "Dealing…";
      case "STUDY":
        return `Memorize: ${daily.studyRemaining}`;
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


      <div style={{ minHeight: "100dvh", background: COLORS.surface }}>
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
              played={playedToday}
              onPlay={() => {
                hapticTap();
                if (playedToday) setShowResult(true);
                else daily.start();
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
        <DailyFrame gap={SPACE[4]} fill={!finished}>


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
              result={daily.result!}

              streak={streak?.current ?? null}
              mobile={mobile}
              revisit={daily.alreadyPlayed}
              onLeave={() => {
                hapticTap();
                setShowResult(false);
              }}
            />
          ) : ready ? null : (
            <div
              style={{
                width: "100%",
                alignSelf: "stretch",
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: SPACE[4],
              }}
            >

              <div
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: SPACE[3],
                }}
              >
                <div>
                  <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted }}>
                    Round {state.roundIndex} of {DAILY_ROUNDS} · {remainingCount(state)} cards
                  </div>
                  <div
                    aria-live="polite"
                    style={{ ...textStyle("title", mobile), color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}
                  >
                    {readout}
                  </div>
                  <div style={{ marginTop: SPACE[2] }}>
                    <MissTracker used={state.roundMisses} />
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: SPACE[2],
                    flex: "0 0 auto",
                  }}
                >
                  <DailyDie
                    phase={phase}
                    roundIndex={state.roundIndex}
                    attribute={daily.roll.attribute}
                    faceIndex={daily.roll.faceIndex}
                    tumbleSeed={daily.tumbleSeed}
                    size={56}
                  />
                  <button
                    type="button"
                    className="ww-press"
                    disabled={!daily.canPeek}
                    onClick={() => {
                      hapticTap();
                      daily.peek();
                    }}
                    style={{
                      ...buttonStyle("ink", "sm", {
                        mobile,
                        disabled: !daily.canPeek,
                      }),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {state.peekUsed ? "PEEK USED" : "PEEK (5s)"}
                  </button>
                </div>
              </div>

              <DailyBoard rows={Math.max(1, Math.ceil(state.grid.length / 3))}>
                {state.grid.map((card, idx) =>
                  card === null ? (
                    <div
                      key={`empty-${idx}`}
                      aria-hidden="true"
                      style={{
                        height: "100%",
                        borderRadius: RADIUS.sm,
                        border: `2px dashed ${COLORS.inkMuted}`,
                        opacity: 0.25,
                      }}
                    />
                  ) : (
                    <GameCard
                      key={card.id}
                      card={card}
                      fill
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
              </DailyBoard>

              <div style={{ flex: "0 0 auto" }}>
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
              </div>
            </div>
          )}

        </DailyFrame>
        )}
      </div>
    </>
  );
};

export default DailyPage;
