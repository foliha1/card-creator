import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import DailyShapeRule from "@/components/DailyShapeRule";
import {
  COLORS,
  FONT_FAMILY,
  FONT_FAMILY_UI,
  FONT_WEIGHT_UI,
  RADIUS,
  RAW,
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

/* ------------------------------------------------------------------ *
 * Authored Figma geometry. The card is authored against a 390-wide
 * screen but laid out responsively: widths, padding and gaps are fluid,
 * type stays at its authored size, and only the middle visual shrinks.
 * ------------------------------------------------------------------ */
const CARD_MAX_W = 354;
const INNER_MAX_W = 290;
/** Fixed heading row so the heading lands at the same y on slides 2-7. */
const HEADING_ROW_H = 84;


/** The card art is a literal brand artifact: ink and khaki stay literal. */
const INK = RAW.warmBlack;

const heading = (big: boolean): React.CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontWeight: 400,
  fontStyle: "normal",
  fontSize: big ? 48 : 36,
  lineHeight: 1.05,
  letterSpacing: "-0.01em",
  color: INK,
  textAlign: "center",
  margin: 0,
});

const body = (big: boolean): React.CSSProperties => ({
  fontFamily: FONT_FAMILY_UI,
  fontWeight: FONT_WEIGHT_UI,
  fontSize: big ? 16 : 14,
  lineHeight: 1.2,
  color: INK,
  textAlign: "center",
  margin: 0,
});

const img = (src: string, alt: string, w: number, h: number, style?: React.CSSProperties) => (
  <img
    src={src}
    alt={alt}
    style={{ width: w, height: h, display: "block", objectFit: "contain", ...style }}
  />
);

/** A grid of card backs at exact Figma dimensions. */
const backGrid = (
  cols: number,
  rows: number,
  cw: number,
  ch: number,
  gap: number,
) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, ${cw}px)`,
      gridAutoRows: `${ch}px`,
      gap,
    }}
    aria-hidden="true"
  >
    {Array.from({ length: cols * rows }).map((_, i) => (
      <img
        key={i}
        src={CARD_BACK}
        alt=""
        style={{ width: cw, height: ch, display: "block" }}
      />
    ))}
  </div>
);

/* ------------------------------------------------------------------ *
 * Slide 3 — one card face with leader-lined attribute labels.
 * ------------------------------------------------------------------ */
const StudyVisual: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
    {img("/cards/3-star-blue.svg", "A card showing three blue stars", 132, 184.8)}
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {["Number", "Shape", "Color"].map((label) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 26, height: 1, background: COLORS.orange, display: "block" }} />
          <span
            style={{
              fontFamily: FONT_FAMILY_UI,
              fontWeight: FONT_WEIGHT_UI,
              fontSize: 14,
              lineHeight: 1.2,
              color: INK,
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * Slide 4 — the die-decides tile + overlapping pair, cycling through
 * three examples. Cycling is state-driven so it can be animated later.
 * ------------------------------------------------------------------ */
type DieExample = { label: string; a: [string, string]; b: [string, string] };

const DIE_EXAMPLES: DieExample[] = [
  {
    label: "Match the COLOR",
    a: ["/cards/2-circle-yellow.svg", "Two orange circles"],
    b: ["/cards/4-star-yellow.svg", "Four orange stars"],
  },
  {
    label: "Match the SHAPE",
    a: ["/cards/3-circle-red.svg", "Three red circles"],
    b: ["/cards/1-circle-blue.svg", "One blue circle"],
  },
  {
    label: "Match the NUMBER",
    a: ["/cards/3-square-yellow.svg", "Three orange squares"],
    b: ["/cards/3-tri-red.svg", "Three red triangles"],
  },
];

const CYCLE_MS = 2000;

const DieVisual: React.FC = () => {
  const [i, setI] = useState(0);
  const advance = useCallback(() => setI((n) => (n + 1) % DIE_EXAMPLES.length), []);

  useEffect(() => {
    const t = window.setInterval(advance, CYCLE_MS);
    return () => window.clearInterval(t);
  }, [advance]);

  const ex = DIE_EXAMPLES[i];
  const CW = 74.83;
  const CH = 104.72;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        advance();
      }}
      style={{ display: "flex", alignItems: "center", gap: 34, cursor: "pointer" }}
    >
      <div
        style={{
          width: 121,
          height: 121,
          flex: "0 0 auto",
          background: RAW.cream,
          border: `2px solid ${INK}`,
          borderRadius: 9.68,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 0.9,
            color: INK,
            textAlign: "center",
          }}
        >
          {ex.label}
        </span>
      </div>

      <div style={{ position: "relative", width: CW + 46.17, height: CH + 37.76 }}>
        {img(ex.a[0], ex.a[1], CW, CH, { position: "absolute", left: 0, top: 0 })}
        {img(ex.b[0], ex.b[1], CW, CH, { position: "absolute", left: 46.17, top: 37.76 })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Slide 7 — PEEK button over a 2x3 grid of backs.
 * ------------------------------------------------------------------ */
const PeekVisual: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
    <div
      aria-hidden="true"
      style={{
        width: 158,
        height: 27,
        background: COLORS.blue,
        border: `2px solid ${INK}`,
        borderRadius: RADIUS.sm,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_FAMILY,
        fontWeight: 400,
        fontSize: 16,
        letterSpacing: "0.02em",
        color: RAW.cream,
      }}
    >
      PEEK
    </div>
    {backGrid(3, 2, 47.25, 66.15, 8)}
  </div>
);

/* ------------------------------------------------------------------ *
 * The eight slides.
 * ------------------------------------------------------------------ */
type Slide = {
  heading: string;
  body: string;
  big?: boolean;
  visual?: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    heading: "Welcome!",
    big: true,
    body:
      "Whoop! Whoop! Daily is a quick, fun, and surprisingly challenging memory game. But if you want all the details, hit next and lets learn how to play.",
  },
  {
    heading: "9 Cards on Deck",
    body:
      "The board starts with nine cards, face down. Then they all flip to reveal the face of each card.",
    visual: backGrid(3, 3, 47.25, 66.15, 8),
  },
  {
    heading: "Study, Study, Study",
    body:
      "While the cards are face up, you get 10 seconds to learn the shape, the number, and the color of every card. The die has not rolled yet, so you don't know what really matters.",
    visual: <StudyVisual />,
  },
  {
    heading: "The Die Decides",
    body:
      "Shape, number, or color. Whichever face lands is what a match means this round. The die rolls again every round. Same cards, new rule.",
    visual: <DieVisual />,
  },
  {
    heading: "Find Your Match",
    body:
      "Tap a card to pick it. Tap it again to change your mind. Your second tap locks the match.",
    visual: (
      <div style={{ display: "flex", gap: 19.8 }} aria-hidden="true">
        {img(CARD_BACK, "", 107.19, 150.06)}
        {img(CARD_BACK, "", 107.19, 150.06)}
      </div>
    ),
  },
  {
    heading: "Match or Miss",
    body:
      "Find a match and that pair leaves. Two misses ends the round and all cards stay on the board.",
    visual: backGrid(3, 3, 47.25, 66.15, 8),
  },
  {
    heading: "One More Thing",
    body:
      "You have one PEEK per game that shows all remaining cards for five seconds. But know that it shows up in your final results.",
    visual: <PeekVisual />,
  },
  {
    heading: "Thats It!",
    big: true,
    body:
      "You, my friend, are ready to play Whoop! Whoop! Daily. Have fun and don't worry, your memory will get better.",
  },
];

export const HOWTO_STEP_COUNT = SLIDES.length;

const SWIPE_PX = 40;

const buttonBase: React.CSSProperties = {
  height: 43.54,
  borderRadius: RADIUS.sm,
  border: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  boxSizing: "border-box",
  fontFamily: FONT_FAMILY,
  fontWeight: 400,
  fontSize: 16,
  letterSpacing: "0.02em",
  background: INK,
  color: RAW.cream,
  cursor: "pointer",
};

/**
 * Eight-slide How to Play sequence.
 *
 * `gate` mode is the first-run interstitial: the close control and the final
 * button both start the run. `reference` mode is the ready-screen chip: close
 * just closes, the final button starts a run.
 */
const DailyHowToSteps: React.FC<{
  mode: "gate" | "reference";
  mobile?: boolean;
  /** Start the daily run. */
  onStart: () => void;
  /** Dismiss without starting (reference mode only). */
  onClose: () => void;
}> = ({ mode, onStart, onClose }) => {
  const [step, setStep] = useState(0);
  const [prev, setPrev] = useState<{ index: number; dir: 1 | -1 } | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const drag = useRef<{ x: number; y: number } | null>(null);

  /* Scale the fixed 354x569 card to whatever room the viewport gives us. */
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.min(1, width / CARD_W, height / CARD_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    markHowToSeen();
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next === step || next < 0 || next >= SLIDES.length) return;
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

  const renderSlide = (index: number, entering: boolean, d: 1 | -1) => {
    const s = SLIDES[index];
    const first = index === 0;
    const last = index === SLIDES.length - 1;
    return (
      <div
        className={entering ? "ww-step-in" : "ww-step-out"}
        style={
          {
            position: entering ? "relative" : "absolute",
            inset: entering ? undefined : 0,
            width: CARD_W,
            height: CARD_H,
            background: RAW.khaki,
            borderRadius: RADIUS.sm,
            padding: "24px 32px 32px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            "--ww-step-dx": `${d * 24}px`,
          } as React.CSSProperties
        }
      >
        {/* top row: progress dots + close */}
        <div
          style={{
            width: INNER_W,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 12.17,
                  height: 12.17,
                  background: i === index ? INK : "transparent",
                  border: i === index ? "none" : `2px solid ${INK}`,
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={mode === "gate" ? "Skip how to play and start" : "Close how to play"}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              background: "transparent",
              border: "none",
              color: INK,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* heading + visual + body */}
        <div
          style={{
            width: INNER_W,
            flex: "1 1 auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <h2 style={heading(!!s.big)}>{s.heading}</h2>
          {s.visual ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {s.visual}
            </div>
          ) : null}
          <p style={body(!!s.big)}>{s.body}</p>
        </div>

        {/* buttons */}
        <div style={{ width: INNER_W, display: "flex", gap: 48 }}>
          {last ? (
            <button
              type="button"
              className="ww-press"
              onClick={finish}
              style={{
                ...buttonBase,
                flex: "1 1 0",
                background: COLORS.red,
                border: `2px solid ${INK}`,
                fontStyle: "italic",
              }}
            >
              Lets Play!
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <>
              {!first && (
                <button
                  type="button"
                  className="ww-press"
                  onClick={() => go(index - 1)}
                  style={{ ...buttonBase, flex: "1 1 0" }}
                >
                  <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
                  BACK
                </button>
              )}
              <button
                type="button"
                className="ww-press"
                onClick={() => go(index + 1)}
                style={{ ...buttonBase, flex: "1 1 0" }}
              >
                NEXT
                <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
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
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        overflow: "hidden",
        "--daily-content-max-width": "402px",
        "--daily-content-padding-x": "24px",
      } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <DailyShapeRule />

      <div
        ref={hostRef}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          width: "100%",
          padding: "12px 12px calc(12px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: CARD_W * scale,
            height: CARD_H * scale,
            flex: "0 0 auto",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CARD_W,
              height: CARD_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {prev && renderSlide(prev.index, false, prev.dir)}
            <React.Fragment key={step}>{renderSlide(step, true, dir)}</React.Fragment>
          </div>
        </div>
      </div>

      <DailyShapeRule />
    </div>
  );
};

export default DailyHowToSteps;
