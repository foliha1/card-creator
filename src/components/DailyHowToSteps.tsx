import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import DailyShapeRule from "@/components/DailyShapeRule";
import {
  BORDER,
  COLORS,
  FONT_FAMILY_UI,
  FONT_WEIGHT_UI,
  RADIUS,
  SPACE,
  buttonStyle,
  textStyle,
} from "@/lib/tokens";

/** localStorage flag: the first-run gate fires exactly once per browser. */
const SEEN_KEY = "ww_daily_howto_seen";

export function hasSeenHowTo(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: never trap the player behind the gate
  }
}

export function markHowToSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

const CARD_BACK = "/cards/card-back.svg";

const DICE = [
  { src: "/dice/match-number.svg", alt: "Die face: match the number" },
  { src: "/dice/match-shape.svg", alt: "Die face: match the shape" },
  { src: "/dice/match-color.svg", alt: "Die face: match the colour" },
];

/** Geist body copy. */
const body = (mobile: boolean): React.CSSProperties => ({
  fontFamily: FONT_FAMILY_UI,
  fontWeight: FONT_WEIGHT_UI,
  fontSize: mobile ? 13 : 14,
  lineHeight: 1.4,
  color: COLORS.ink,
  margin: 0,
  textAlign: "center",
});

const caption = (mobile: boolean): React.CSSProperties => ({
  ...body(mobile),
  fontSize: mobile ? 12 : 13,
  color: COLORS.inkMuted,
});

/**
 * A height-driven visual box: the height comes from the flex row it sits in and
 * `aspect-ratio` derives the width, so art never overflows sideways and never
 * forces a scroll. `cap` bounds the height on tall viewports.
 */
const Fit: React.FC<{
  ratio: string;
  cap?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ ratio, cap, children, style }) => (
  <div
    style={{
      height: "100%",
      maxHeight: cap,
      aspectRatio: ratio,
      flex: "0 0 auto",
      display: "grid",
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * A grid of card backs. `share` puts the grid in a width-driven flex cell, for
 * rows of several grids where the column width is the binding constraint.
 */
const backGrid = (cols: number, count: number, key: string, cap?: number, share = false) => {
  const rows = Math.ceil(count / cols);
  const ratio = `${cols * 180 + (cols - 1) * 6}/${rows * 252 + (rows - 1) * 8}`;
  const grid = (
    <div
      style={{
        width: share ? "100%" : undefined,
        height: share ? undefined : "100%",
        maxHeight: share ? undefined : cap,
        maxWidth: share ? cap : undefined,
        aspectRatio: ratio,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: "1fr",
        gap: 3,
        flex: "0 0 auto",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <img
          key={i}
          src={CARD_BACK}
          alt=""
          aria-hidden="true"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      ))}
    </div>
  );
  if (!share) return <React.Fragment key={key}>{grid}</React.Fragment>;
  return (
    <div
      key={key}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {grid}
    </div>
  );
};


const cardImg = (src: string, alt: string): React.ReactNode => (
  <img
    src={src}
    alt={alt}
    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
  />
);

type Step = {
  heading: string;
  body: React.ReactNode;
  visual: (mobile: boolean) => React.ReactNode;
};

const STEPS: Step[] = [
  {
    heading: "Find three matching pairs.",
    body: "The board starts with nine cards, face down.",
    visual: () => backGrid(3, 9, "g9", 300),
  },
  {
    heading: "Learn all three things.",
    body:
      "You get ten seconds. Learn the shape, the number, and the colour of every card. The die has not rolled yet, so you do not know which one will count.",
    visual: (mobile) => (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE[10],
        }}
      >
        <Fit ratio="180/252" cap={240}>{cardImg("/cards/3-star-blue.svg", "Three blue stars")}</Fit>
        <ul
          style={{
            ...body(mobile),
            textAlign: "left",
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: SPACE[6],
          }}
        >
          <li>Shape — star</li>
          <li>Number — three</li>
          <li>Colour — blue</li>
        </ul>
      </div>
    ),
  },
  {
    heading: "The die picks what counts.",
    body: "The die rolls again every round, so the same nine cards mean something new each time.",
    visual: (mobile) => (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE[6],
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: "1 1 0",
            minHeight: 0,
            display: "flex",
            justifyContent: "center",
            gap: SPACE[6],
          }}
        >
          {DICE.map(({ src, alt }) => (
            <Fit
              key={src}
              ratio="1/1"
              cap={96}
              style={{
                // The die art is warm-black, so the tile stays cream in both
                // themes — same treatment the die gets in play.
                background: COLORS.offWhite,
                borderRadius: RADIUS.lg,
                padding: 6,
                boxSizing: "border-box",
              }}
            >
              {cardImg(src, alt)}
            </Fit>
          ))}
        </div>
        <div
          style={{
            flex: "1 1 0",
            minHeight: 0,
            display: "flex",
            justifyContent: "center",
            gap: SPACE[6],
          }}
        >
          <Fit ratio="180/252" cap={180}>{cardImg("/cards/2-circle-red.svg", "Two red circles")}</Fit>
          <Fit ratio="180/252" cap={180}>{cardImg("/cards/3-star-red.svg", "Three red stars")}</Fit>
        </div>
        <p style={caption(mobile)}>
          On COLOR these two are a pair: both red. Shape and number stop mattering.
        </p>
      </div>
    ),
  },
  {
    heading: "Tap two cards.",
    body:
      "Tap two cards to call a match. Tap the same card again to change your mind. Two misses ends a round.",
    visual: () => (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE[8],
        }}
      >
        <Fit
          ratio="180/252"
          cap={190}
          style={{
            borderRadius: RADIUS.md,
            outline: `4px solid ${COLORS.blue}`,
            outlineOffset: 2,
          }}
        >
          {cardImg(CARD_BACK, "A selected card")}
        </Fit>
        <Fit ratio="180/252" cap={190}>{cardImg(CARD_BACK, "An unselected card")}</Fit>
      </div>
    ),
  },
  {
    heading: "The board shrinks.",
    body:
      "Solve a round and that pair leaves: nine, then seven, then five. Two misses ends the round and the correct pair stays on the board. One peek per game shows everything for five seconds, and it appears in your score.",
    visual: () => (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE[8],
          minHeight: 0,
        }}
      >
        {backGrid(3, 9, "s9", 120, true)}
        {backGrid(3, 7, "s7", 120, true)}
        {backGrid(3, 5, "s5", 120, true)}
      </div>
    ),
  },
];

export const HOWTO_STEP_COUNT = STEPS.length;

const SWIPE_PX = 40;

/**
 * Five-card How to Play stepper. One card at a time, never scrolling.
 *
 * `gate` mode is the first-run interstitial: the final button starts the run,
 * and Skip starts it immediately. `reference` mode is the ready-screen chip:
 * the final button plays, and closing just closes.
 */
const DailyHowToSteps: React.FC<{
  mode: "gate" | "reference";
  mobile?: boolean;
  /** Start the daily run. */
  onStart: () => void;
  /** Dismiss without starting (reference mode only). */
  onClose: () => void;
}> = ({ mode, mobile = false, onStart, onClose }) => {
  const [step, setStep] = useState(0);
  const [prev, setPrev] = useState<{ index: number; dir: 1 | -1 } | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    markHowToSeen();
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next === step || next < 0 || next >= STEPS.length) return;
      const d: 1 | -1 = next > step ? 1 : -1;
      setDir(d);
      setPrev({ index: step, dir: d });
      setStep(next);
    },
    [step],
  );

  useEffect(() => {
    if (!prev) return;
    const t = window.setTimeout(() => setPrev(null), 260);
    return () => window.clearTimeout(t);
  }, [prev]);

  const last = step === STEPS.length - 1;

  const finish = useCallback(() => {
    markHowToSeen();
    onStart();
  }, [onStart]);

  const dismiss = useCallback(() => {
    markHowToSeen();
    if (mode === "gate") onStart();
    else onClose();
  }, [mode, onStart, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      else if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss, go, step]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - start.y)) return;
    go(dx < 0 ? step + 1 : step - 1);
  };

  const renderStep = (index: number, entering: boolean, d: 1 | -1) => {
    const s = STEPS[index];
    return (
      <div
        className={entering ? "ww-step-in" : "ww-step-out"}
        style={
          {
            position: entering ? "relative" : "absolute",
            inset: entering ? undefined : 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE[10],
            minHeight: 0,
            "--ww-step-dx": `${d * 24}px`,
          } as React.CSSProperties
        }
      >
        <h2
          style={{
            ...textStyle("title", mobile),
            margin: 0,
            textAlign: "center",
            color: COLORS.ink,
          }}
        >
          {s.heading}
        </h2>

        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {s.visual(mobile)}
        </div>

        <p style={body(mobile)}>{s.body}</p>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to Play"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: COLORS.surface,
        padding: 24,
        paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE[10],
        overflow: "hidden",
        "--daily-content-max-width": "402px",
        "--daily-content-padding-x": "24px",
      } as React.CSSProperties}
    >
      <DailyShapeRule />

      <div
        style={{
          width: "100%",
          maxWidth: 402,
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: SPACE[8],
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* dots + skip/close */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6 }} aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  border: `1.5px solid ${COLORS.ink}`,
                  background: i === step ? COLORS.ink : "transparent",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={mode === "gate" ? "Skip how to play and start" : "Close how to play"}
            style={{
              ...textStyle("chip", mobile),
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 32,
              padding: "4px 8px",
              margin: "-4px -8px",
              background: "transparent",
              border: "none",
              color: COLORS.ink,
              cursor: "pointer",
            }}
          >
            {mode === "gate" ? "Skip" : <X size={20} strokeWidth={2.5} aria-hidden="true" />}
          </button>
        </div>

        {/* card stage */}
        <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
          {prev && renderStep(prev.index, false, prev.dir)}
          <React.Fragment key={step}>{renderStep(step, true, dir)}</React.Fragment>
        </div>

        {/* footer */}
        <button
          type="button"
          className="ww-press"
          onClick={() => (last ? finish() : go(step + 1))}
          style={{ ...buttonStyle(last ? "primary" : "ink", "lg", { mobile, fullWidth: true }) }}
        >
          {last ? (mode === "gate" ? "Start" : "Play") : "Next"}
        </button>
      </div>

      <DailyShapeRule />
    </div>
  );
};

export default DailyHowToSteps;
