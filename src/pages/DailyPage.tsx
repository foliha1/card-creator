import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { HelpCircle, Moon, Sun } from "lucide-react";
import GameCard from "@/components/GameCard";
import DailyFrame from "@/components/DailyFrame";
import DailyHowToPlay from "@/components/DailyHowToPlay";
import DailyRoundIntro, { DAILY_FADE_IN_MS } from "@/components/DailyRoundIntro";
import DailyMatchGhost, { type GhostCard } from "@/components/DailyMatchGhost";
import DailyScreenFade from "@/components/DailyScreenFade";


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
} from "@/lib/dailyEngine";
import { formatDailyShare, type DailyResult } from "@/lib/daily";
import { renderDailyShareImage } from "@/lib/dailyShareImage";
import { preloadGameArt } from "@/lib/preloadArt";

import { formatStreakLine } from "@/lib/dailyResults";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { runDailyEndSequence } from "@/lib/dailyEndSequence";
import {
  DAILY_MATCH_HOLD_MS,
  DAILY_MATCH_REVEAL_MS,
  GREAT_MATCH_DELAY_MS,
  DEAL_MOVE_MS,
} from "@/lib/animationTiming";

import { hapticError, hapticSuccess, hapticTap } from "@/lib/haptics";

import {
  playCorrect,
  playDeal,
  playDeselect,
  playDiceRoll,
  playFlip,
  playPeek,
  playReveal,
  playRoundAdvance,
  playSelect,
  playStart,
  playTick,
  playWhoopCall,
  playWrong,
  startTheme,
  stopTheme,
  unlockAudio,
} from "@/lib/sounds";

import {
  BORDER,
  COLORS,
  RAW,

  RADIUS,
  SPACE,
  buttonStyle,
  textStyle,
  FONT_FAMILY_UI,
  FONT_WEIGHT_UI,
} from "@/lib/tokens";
import { useThemeMode } from "@/lib/nightMode";

const ATTR_LABEL: Record<string, string> = {
  SHAPE: "Match the shape",
  NUMBER: "Match the number",
  COLOR: "Match the color",
};

// Results-screen entrance motion: block stagger and the per-mark sequence.
const BLOCK_STAGGER_MS = 40;
const BLOCK_IN_MS = 250;
const MARK_STAGGER_MS = 70;
const MARK_IN_MS = 180;
/** Delay index of each block, in the order they arrive. */
const RESULT_BLOCK = {
  heading: 0,
  message: 1,
  stats: 2,
  rounds: 3,
  streak: 4,
  share: 5,
  email: 6,
  done: 7,
} as const;
const blockIn = (block: keyof typeof RESULT_BLOCK): React.CSSProperties =>
  ({ "--ww-res-delay": `${RESULT_BLOCK[block] * BLOCK_STAGGER_MS}ms` } as React.CSSProperties);
/** Marks start once their block has landed. */
const MARKS_BASE_DELAY_MS = RESULT_BLOCK.rounds * BLOCK_STAGGER_MS + BLOCK_IN_MS;

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
const RoundMarks: React.FC<{
  events: DailyMark[];
  /** When set, each mark animates in with this running index as its offset. */
  animateFrom?: number;
  /** Delay of the first mark in the whole sequence. */
  baseDelayMs?: number;
}> = ({ events, animateFrom, baseDelayMs = 0 }) => {
  const anim = (i: number): React.CSSProperties =>
    animateFrom === undefined
      ? {}
      : ({
          "--ww-mark-delay": `${baseDelayMs + (animateFrom + i) * MARK_STAGGER_MS}ms`,
        } as React.CSSProperties);
  const cls = animateFrom === undefined ? undefined : "ww-mark-in";
  return (
    <div style={{ display: "flex", gap: SPACE[2], alignItems: "center" }}>
      {events.length === 0 ? (
        <span className={cls} style={{ display: "inline-flex", ...anim(0) }}>
          <span
            style={{
              width: 20,
              height: 20,
              opacity: 0.3,
              border: BORDER.heavy,
              borderRadius: 999,
            }}
          />
        </span>
      ) : (
        events.map((m, i) => (
          <span
            key={i}
            className={cls}
            title={m === "SOLVE" ? "Solved" : "Miss"}
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: m === "SOLVE" ? COLORS.blue : COLORS.red,
              ...anim(i),
            }}
          />
        ))
      )}
    </div>
  );
};


/**
 * Share block — renders the day's result as a PNG and shares it alongside the
 * unchanged share text. Every failure path degrades to text, silently.
 */
const ShareBlock: React.FC<{
  text: string;
  result: DailyResult;
  streak: number | null;
  mobile: boolean;
  /** When set, the multiplayer shine sweep runs once after this delay. */
  sweepDelayMs?: number;
}> = ({ text, result, streak, mobile, sweepDelayMs }) => {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  /** Set when the clipboard write was refused: we show the text to copy by hand. */
  const [manual, setManual] = useState(false);
  const manualRef = React.useRef<HTMLTextAreaElement | null>(null);

  const flashCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Clipboard write, started while the user's tap is still an active gesture.
   * Firefox (and Safari) revoke gesture status across an await, so this must be
   * kicked off before the share image renders — never after.
   */
  const beginClipboardWrite = (): Promise<boolean> => {
    try {
      const write = navigator?.clipboard?.writeText?.(text);
      if (!write) return Promise.resolve(false);
      return write.then(
        () => true,
        () => false
      );
    } catch {
      return Promise.resolve(false);
    }
  };

  /** Honest ending for the clipboard path: only claim "COPIED" if it copied. */
  const settleClipboard = async (copyPromise: Promise<boolean>) => {
    const ok = await copyPromise;
    if (ok) {
      setManual(false);
      flashCopied();
    } else {
      setManual(true);
      window.setTimeout(() => {
        manualRef.current?.focus();
        manualRef.current?.select();
      }, 0);
    }
  };

  const shareTextOnly = async (copyPromise: Promise<boolean>) => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* dismissed or unsupported — fall through to clipboard */
    }
    await settleClipboard(copyPromise);
  };

  const share = async () => {
    hapticTap();
    // Started first, inside the live gesture. If a native share succeeds we
    // simply never surface the result.
    const copyPromise = beginClipboardWrite();
    setManual(false);
    setWorking(true);
    let blob: Blob | null = null;
    try {
      blob = await renderDailyShareImage(result, streak);
    } catch {
      blob = null;
    }
    setWorking(false);

    if (blob) {
      try {
        // The File constructor is unavailable/throwing on some older Safari
        // builds — constructing it here means that failure falls through to
        // the text share instead of aborting the whole thing.
        const file = new File([blob], `whoop-whoop-${result.puzzleNumber}.png`, {
          type: "image/png",
        });
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function" &&
          navigator.canShare?.({ files: [file] })
        ) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch {
        /* no File support, dismissed, or file share refused — fall back below */
      }
    }

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await shareTextOnly(copyPromise);
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
    await settleClipboard(copyPromise);
  };

  // One-shot sweep: travels the full width and exits off the far edge.
  const sweep: React.CSSProperties | null =
    sweepDelayMs === undefined
      ? null
      : ({ "--ww-sweep-delay": `${sweepDelayMs}ms` } as React.CSSProperties);

  return (
    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: SPACE[4] }}>
      <button
        type="button"
        className="ww-press"
        onClick={share}
        disabled={working}
        style={{
          ...buttonStyle("primary", "lg", { mobile }),
          alignSelf: "stretch",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {working ? "MAKING IMAGE…" : copied ? "COPIED" : "SHARE"}
        {sweep && <span aria-hidden="true" className="ww-sweep-once" style={sweep} />}
      </button>

      {manual && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
          <label
            htmlFor="ww-share-manual"
            style={{ ...TEXT.caption, color: COLORS.inkMuted }}
          >
            Your browser blocked the copy — select and copy this:
          </label>
          <textarea
            id="ww-share-manual"
            ref={manualRef}
            readOnly
            rows={4}
            value={text}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              ...TEXT.body,
              width: "100%",
              resize: "none",
              padding: SPACE[3],
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.ink}`,
              background: COLORS.panel,
              color: COLORS.ink,
            }}
          />
        </div>
      )}
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

  // Running index of each round's first mark, so the marks read as one
  // left-to-right sequence across all three rounds.
  const markOffsets: number[] = [];
  let markCount = 0;
  for (const events of roundEvents) {
    markOffsets.push(markCount);
    markCount += Math.max(1, events.length);
  }
  const sweepDelayMs = MARKS_BASE_DELAY_MS + markCount * MARK_STAGGER_MS + MARK_IN_MS;

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

      <h1
        className="ww-res-in"
        style={{ ...textStyle("title", mobile), color: COLORS.ink, textAlign: "center", margin: 0, ...blockIn("heading") }}
      >
        WHOOP! WHOOP! Daily #{puzzleNumber}
      </h1>
      <p
        className="ww-res-in"
        style={{ ...textStyle("body", mobile), color: COLORS.inkMuted, textAlign: "center", margin: 0, ...blockIn("message") }}
      >
        {failed
          ? "Whooped! Better luck tomorrow."
          : revisit
            ? "You already tested your memory today. Come back tomorrow!"
            : "All three rounds played. One puzzle a day — come back tomorrow."}
      </p>
      <div
        className="ww-res-in"
        style={{ display: "flex", gap: SPACE[4], alignSelf: "stretch", ...blockIn("stats") }}
      >
        {stat("Solved", `${roundsSolved}/${DAILY_ROUNDS}`)}
        {stat("Misses", `${totalMisses}`)}
      </div>


      {streak !== null && streak >= 1 && (
        <p
          className="ww-res-in"
          style={{ ...textStyle("body", mobile), color: COLORS.ink, textAlign: "center", margin: 0, ...blockIn("streak") }}
        >
          {formatStreakLine(streak)}
        </p>
      )}

      <div
        className="ww-res-in"
        style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: SPACE[3], ...blockIn("rounds") }}
      >
        <h2 style={{ ...textStyle("label", mobile), color: COLORS.inkMuted, margin: 0 }}>
          Round review
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            columnGap: SPACE[3],
          }}
        >
          {roundEvents.map((events, i) => {
            const cell: React.CSSProperties = {
              fontFamily: FONT_FAMILY_UI,
              fontWeight: FONT_WEIGHT_UI,
              fontSize: mobile ? 13 : 14,
              lineHeight: 1.35,
              paddingTop: i === 0 ? 0 : SPACE[3],
              paddingBottom: i === roundEvents.length - 1 ? 0 : SPACE[3],
              ...(i === 0 ? {} : { borderTop: "1px solid rgba(35, 31, 32, 0.18)" }),
            };
            return (
              <React.Fragment key={`round-${i}`}>
                <div style={{ ...cell, color: COLORS.inkMuted }}>R{i + 1}</div>
                <div style={{ ...cell, color: COLORS.ink }}>
                  {attributes[i] ? ATTR_LABEL[attributes[i]] : ""}
                </div>
                <div
                  style={{
                    ...cell,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: SPACE[2],
                  }}
                >

                  {peekUsed && peekRound === i + 1 && (
                    <span aria-label="Peek used this round" title="Peek used">
                      👀
                    </span>
                  )}
                  <RoundMarks
                    events={events}
                    animateFrom={markOffsets[i]}
                    baseDelayMs={MARKS_BASE_DELAY_MS}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>


      <div className="ww-res-in" style={{ alignSelf: "stretch", ...blockIn("share") }}>
        <ShareBlock
          text={shareText}
          result={result}
          streak={streak}
          mobile={mobile}
          sweepDelayMs={sweepDelayMs}
        />
      </div>


      {!hasSubscribed() && (
        <div
          className="ww-res-in"
          style={{
            alignSelf: "stretch",
            border: BORDER.heavy,
            borderRadius: RADIUS.sm,
            background: COLORS.orange,
            padding: SPACE[6],
            display: "flex",
            flexDirection: "column",
            ...blockIn("email"),
          }}
        >
          <DailyEmailCapture />
        </div>
      )}

      <button
        type="button"
        className="ww-press ww-res-in"
        onClick={onLeave}
        style={{ ...buttonStyle("ink", "lg", { mobile }), alignSelf: "stretch", ...blockIn("done") }}
      >
        DONE
      </button>
    </div>
  );
};



/**
 * Manual light/night switch. Theming only — it writes `data-theme` on <html>,
 * which flips the CSS custom properties the COLORS tokens point at. Until it is
 * touched the theme follows `prefers-color-scheme`.
 */
const DailyThemeToggle: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => {
  const { theme, toggle } = useThemeMode();
  const night = theme === "night";
  return (
    <button
      type="button"
      className="ww-press daily-btn-howto"
      onClick={() => {
        hapticTap();
        toggle();
      }}
      aria-label={night ? "Switch to light mode" : "Switch to night mode"}
      title={night ? "Switch to light mode" : "Switch to night mode"}
      style={{
        ...textStyle("chip", mobile),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 32,
        minWidth: 32,
        padding: "8px 12px",
        border: "none",
        borderRadius: RADIUS.sm,
      }}
    >
      {night ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
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
                // Fixed orange fill: the ink token flips cream in night mode.
                color: RAW.warmBlack,
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


      <div
        className="daily-intro"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: SPACE[3],
          animationDelay: "120ms",
        }}
      >
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
        <DailyThemeToggle mobile={mobile} />
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
  /** Reports the measured grid width so the header can share the card edges. */
  onGridWidth?: (w: number) => void;
  children: React.ReactNode;
}> = ({ rows, onGridWidth, children }) => {
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
  const gridW = cardW * BOARD_COLS + (BOARD_COLS - 1) * BOARD_GAP;

  useEffect(() => {
    onGridWidth?.(gridW);
  }, [gridW, onGridWidth]);

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

  // Preload all card / die artwork on first mount so the first flip and the
  // round-intro die never flicker while SVGs decode.
  useEffect(() => {
    preloadGameArt();
  }, []);

  const daily = useDailyGame();
  const { state, phase } = daily;
  const [howTo, setHowTo] = useState(false);
  const [showResult, setShowResult] = useState(false);
  // True while the round intro overlay is up: taps stay locked.
  const [introUp, setIntroUp] = useState(false);
  // Measured card-grid width: the single alignment line for the gameplay screen.
  const [gridWidth, setGridWidth] = useState(0);
  // Read after the run is persisted so today counts toward the streak.
  const streak = useDailyStreak(
    daily.puzzleNumber,
    daily.resultSaved || daily.result === null
  );

  // --- correct-match ghost layer ---------------------------------------
  // The engine empties the solved slots the instant the claim resolves, so the
  // reward is played by copies pinned over the slots the pair just left. The
  // capture effect is declared BEFORE the board bookkeeping effect below so it
  // still sees the pre-removal board and the slots' live rects.
  const [ghost, setGhost] = useState<GhostCard[]>([]);
  // The end-of-run chain awaits the ghost layer instead of guessing at timers:
  // `awaitSettle` resolves the moment the success sequence has finished, so the
  // final reveal can never start while the pair is still celebrating.
  const settleResolveRef = React.useRef<(() => void) | null>(null);
  const settleDoneRef = React.useRef(false);
  const awaitSettle = React.useCallback(
    () =>
      settleDoneRef.current
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            settleResolveRef.current = resolve;
          }),
    []
  );

  const [finalReveal, setFinalReveal] = useState(false);
  const slotRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const boardRef = React.useRef(state.grid);

  useEffect(() => {
    if (state.matchedPair.length !== 2) return;
    const copies = state.matchedPair.flatMap<GhostCard>((i) => {
      const el = slotRefs.current[i];
      const card = boardRef.current[i];
      if (!el || !card) return [];
      const r = el.getBoundingClientRect();
      return [{
        key: `${state.roundIndex}-${i}`,
        card,
        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      }];
    });
    if (copies.length) {
      settleDoneRef.current = false;
      setGhost(copies);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.matchedPair.length, state.roundIndex]);


  useEffect(() => {
    boardRef.current = state.grid;
  }, [state.grid]);

  // --- sound + haptic cues, driven off phase / counters ---
  // Safety net: any first gesture anywhere on the page unlocks audio, in case
  // the run was started from something other than the Play button.
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    const on = () => { unlockAudio(); setAudioReady(true); };
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
  }, []);


  useEffect(() => {
    let diceTimer: ReturnType<typeof setTimeout> | undefined;
    // The deal-in animation mounts with the board on DEAL. The cards land at
    // the END of the move, so the single batch cue is scheduled to land with
    // the first card.
    if (phase === "DEAL") {
      playDeal(state.grid.length, { startMs: DEAL_MOVE_MS });
    }
    if (phase === "ROLL") {
      // The intro fades up first and only then starts the tumble, so the dice
      // cue waits for the tumble's first frame instead of the phase edge.
      diceTimer = setTimeout(() => playDiceRoll(), DAILY_FADE_IN_MS);
    }
    // HIDE is the end of a round (roundIndex has already advanced) except the
    // first time, where it is the cards going face down after the study window.
    if (phase === "HIDE") {
      if (state.roundIndex === 1) playFlip();
      // Round-end marker. It lives here, not on ROLL, so it never collides
      // with the dice roll of the next intro.
      else playRoundAdvance();
    }
    return () => { if (diceTimer) clearTimeout(diceTimer); };
  }, [phase, state.roundIndex, state.grid.length]);

  // Soft tick on each of the last three seconds of the study countdown.
  useEffect(() => {
    if (phase !== "STUDY") return;
    const left = daily.studyRemaining;
    if (left > 0 && left <= 3) playTick();
  }, [phase, daily.studyRemaining]);


  useEffect(() => {
    if (state.wrongToken === 0) return;
    hapticError();
    // The wrong-match animation starts on this same commit (no CSS delay), so
    // the cue fires with its first frame. The whoop landed on the second tap,
    // 450ms of claim resolution earlier, so the two never overlap.
    playWrong();
  }, [state.wrongToken]);


  useEffect(() => {
    if (state.matchedPair.length === 0) return;
    // Land the chime with the ghost treatment, not with the reveal.
    const t = setTimeout(() => {
      playCorrect();
      hapticSuccess();
    }, DAILY_MATCH_REVEAL_MS + DAILY_MATCH_HOLD_MS + GREAT_MATCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.matchedPair.length, state.roundIndex]);

  // Peek reveals the whole board for 5s — cue it as it opens.
  useEffect(() => {
    if (!state.peeking) return;
    playPeek();
  }, [state.peeking]);

  // End of run: one ordered chain, one cancel token (src/lib/dailyEndSequence).
  // A solved round 3 settles first (flip → hold → success → exit); only then do
  // the remaining cards flip up, hold, and hand over to the result screen.
  // `runSettled` keeps the board on screen for the whole chain.
  const [runSettled, setRunSettled] = useState(false);
  useEffect(() => {
    if (phase !== "DONE") return;
    // Round 3's own last event, not `matchedPair` — that still holds an earlier
    // round's solved pair when round 3 ends on two misses.
    const lastRound = state.roundEvents[state.roundEvents.length - 1] ?? [];
    const solved = lastRound[lastRound.length - 1] === "SOLVE";
    return runDailyEndSequence({
      solved,
      awaitSettle,
      onReveal: () => {
        setGhost([]);
        setFinalReveal(true);
        playReveal();
      },
      onResults: () => {
        hapticSuccess();
        setRunSettled(true);
        setShowResult(true);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);




  const playedToday =
    daily.result !== null && (daily.alreadyPlayed || (phase === "DONE" && runSettled));
  const finished = playedToday && showResult;
  const ready = !finished && (phase === "READY" || playedToday);

  // Background theme: ready (intro) and results screens only. It fades out the
  // moment the run starts and fades back in when the result screen opens. The
  // loop keeps running underneath so it never restarts from the top.
  // `startTheme()` is safe to call before a gesture — it records the intent and
  // the theme fades in as soon as `unlockAudio()` runs.
  useEffect(() => {
    if (ready || finished) startTheme();
    else stopTheme();
  }, [audioReady, ready, finished]);

  useEffect(() => () => stopTheme(), []);



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
        // No resting die any more: the readout is the only rule reminder.
        return state.peeking
          ? "Peeking…"
          : ATTR_LABEL[daily.roll.attribute] ?? "\u00A0";
    }
  })();

  // During PLAY a card tap *is* the claim: no button, no intermediate states.
  // Both settle sequences (wrong shake, match ghost) lock the board.
  const cardsTappable =
    phase === "PLAY" &&
    !introUp &&
    !state.peeking &&
    state.selected.length < 2 &&
    state.wrongPair.length === 0 &&
    ghost.length === 0;


  // Arrow keys walk focus across the 3-column board; Enter/Space on a card
  // selects and then claims (handled by GameCard's own key handler).
  const boardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -BOARD_COLS,
      ArrowDown: BOARD_COLS,
    };
    const delta = step[e.key];
    if (delta === undefined) return;
    const total = state.grid.length;
    if (total === 0) return;

    const focusable = (i: number) =>
      slotRefs.current[i]?.querySelector<HTMLElement>('[role="button"]') ?? null;

    const active = document.activeElement as HTMLElement | null;
    const slot = active?.closest?.("[data-slot]") as HTMLElement | null;
    const from = slot ? Number(slot.dataset.slot) : -1;

    e.preventDefault();

    if (from < 0) {
      for (let i = 0; i < total; i++) {
        const el = focusable(i);
        if (el) { el.focus(); return; }
      }
      return;
    }

    // Walk in the requested direction, skipping empty slots, and stop at the edges.
    for (let i = from + delta; i >= 0 && i < total; i += delta) {
      // Horizontal moves must not jump rows.
      if (Math.abs(delta) === 1 && Math.floor(i / BOARD_COLS) !== Math.floor(from / BOARD_COLS)) break;
      const el = focusable(i);
      if (el) { el.focus(); return; }
    }
  };


  const [ty, tm, td] = daily.dateKey.split("-").map(Number);
  const today = new Date(ty, tm - 1, td).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Helmet>
        <title>{`Daily Game #${daily.puzzleNumber} | WHOOP! WHOOP! — Daily Memory Game`}</title>
        <meta
          name="description"
          content="Play the free WHOOP! WHOOP! daily memory game. Nine cards, ten seconds, three rounds, two misses a round. A new memory challenge every day—no signup needed."
        />
        <meta property="og:title" content={`WHOOP! WHOOP! — Daily Memory Game | Daily Game #${daily.puzzleNumber}`} />
        <meta
          property="og:description"
          content="Play the free WHOOP! WHOOP! daily memory game. Nine cards, ten seconds, three rounds, two misses a round. A new memory challenge every day—no signup needed."
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


      <DailyScreenFade
        screenKey={finished ? "result" : ready ? "ready" : "play"}
        background={finished || ready ? COLORS.surface : COLORS.panel}
      >
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
              color: RAW.cream,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              pointerEvents: "none",
            }}
          >
            {`DEBUG — ${
              daily.debugOverride === "seed"
                ? "SEED OVERRIDE"
                : daily.debugOverride === "day"
                  ? `DAY OFFSET → ${daily.dateKey}`
                  : "LOCK BYPASSED"
            } · SEED ${daily.seed} · #${daily.puzzleNumber} · NOT A REAL RUN`}
          </div>
        )}
        {ready && (
          <>
            <DailyReadyScreen
              mobile={mobile}
              today={today}
              streak={streak?.current ?? null}
              played={playedToday}
              onPlay={() => {
                // First user gesture on the page: resume the AudioContext and
                // kick off the clip decode, or nothing ever plays.
                unlockAudio();
                setAudioReady(true);
                hapticTap();
                if (playedToday) setShowResult(true);
                else {
                  // 600ms cue; the deal lands at 700ms, so it clears cleanly.
                  playStart();
                  daily.start();
                }
              }}

              onHowToPlay={() => {
                // Any tap on the ready screen also opens the audio path, so the
                // theme has a window in which to start.
                unlockAudio();
                setAudioReady(true);
                startTheme();
                hapticTap();
                setHowTo(true);
              }}

            />
            {howTo && <DailyHowToPlay onClose={() => setHowTo(false)} />}
          </>
        )}
        {!ready && (
        <DailyFrame gap={SPACE[4]} fill={!finished} tone={finished ? "surface" : "panel"}>


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
              onKeyDown={boardKeyDown}
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
                  width: gridWidth ? gridWidth : "100%",
                  alignSelf: "center",
                }}
              >
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ ...textStyle("caption", mobile), fontFamily: FONT_FAMILY_UI, fontWeight: FONT_WEIGHT_UI, color: COLORS.inkMuted }}>
                    Round {state.roundIndex} of {DAILY_ROUNDS} · {remainingCount(state)} cards
                  </div>
                  <div
                    aria-live="polite"
                    style={{
                      ...textStyle("title", mobile),
                      color: COLORS.ink,
                      fontVariantNumeric: "tabular-nums",
                      minHeight: "1.2em",
                    }}
                  >
                    {readout}
                  </div>
                  <div style={{ marginTop: SPACE[2] }}>
                    <MissTracker used={state.roundMisses} />
                  </div>
                </div>
                <button
                  type="button"
                  className="ww-press"
                  disabled={!daily.canPeek}
                  onClick={() => {
                    hapticTap();
                    daily.peek();
                  }}
                  style={{
                    ...buttonStyle("secondary", "sm", {
                      mobile,
                      disabled: !daily.canPeek,
                    }),
                    whiteSpace: "nowrap",
                    flex: "0 0 auto",
                  }}
                >
                  {state.peekUsed ? "PEEK USED" : "PEEK (5s)"}
                </button>
              </div>


              <DailyBoard
                rows={Math.max(1, Math.ceil(state.grid.length / 3))}
                onGridWidth={setGridWidth}
              >
                {state.grid.map((card, idx) => (
                  // Persistent slot wrapper: it outlives the card, so the
                  // ghost layer can still measure the slot a solved pair left.
                  <div
                    key={`slot-${idx}`}
                    data-slot={idx}
                    ref={(el) => { slotRefs.current[idx] = el; }}
                    style={{ position: "relative", width: "100%", height: "100%" }}
                  >
                    {card === null ? (
                      <div
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
                        card={card}
                        fill
                        faceUp={state.faceUp || finalReveal}
                        highlighted={state.selected.includes(idx)}
                        matched={state.matchedPair.includes(idx)}
                        wrong={state.wrongPair.includes(idx)}
                        interactive={cardsTappable}
                        dealIndex={idx}
                        dealKey={daily.seed}
                        onClick={() => {
                          // Paint the selection first; haptics and sound are
                          // best-effort and can block, so they follow.
                          const calls = state.selected.length === 1 && !state.selected.includes(idx);
                          const selects = state.selected.length === 0;
                          const deselects = state.selected.includes(idx);
                          daily.select(idx);
                          hapticTap();
                          if (calls) playWhoopCall();
                          else if (deselects) playDeselect();
                          else if (selects) playSelect();
                        }}

                      />
                    )}
                  </div>
                ))}
              </DailyBoard>


              {ghost.length > 0 && (
                <DailyMatchGhost
                  pair={ghost}
                  onDone={() => {
                    settleDoneRef.current = true;
                    settleResolveRef.current?.();
                    settleResolveRef.current = null;
                    setGhost([]);
                  }}

                />
              )}


              {/* Fixed overlay: never affects the board's measured size. */}
              <DailyRoundIntro
                active={phase === "ROLL"}
                roundIndex={state.roundIndex}
                attribute={daily.roll.attribute}
                faceIndex={daily.roll.faceIndex}
                tumbleSeed={daily.tumbleSeed}
                onVisibleChange={setIntroUp}
              />
            </div>
          )}


        </DailyFrame>
        )}
      </DailyScreenFade>
    </>
  );
};

export default DailyPage;
