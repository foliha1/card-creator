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
 * Animation timings. Every loop duration lives here so the sequences
 * are tunable in one place. Transform and opacity only, everywhere.
 * ------------------------------------------------------------------ */
const T = {
  /** Slide 2 — nine cards flipping face up and back down (30% slower). */
  deck: {
    faceDown: 650,
    flip: 390,
    /** Per-card stagger: reads as a deal rather than a strobe. */
    stagger: 52,
    faceUp: 1300,
    hold: 650,
  },
  /** Slide 3 — leader lines drawing out with their labels. */
  study: {
    /** One frame at the start of the loop so the in-transition has a from-state. */
    prime: 30,
    /** Anchor dot at the card end: leads the stroke in, trails it out. */
    dot: 120,
    in: 500,
    stagger: 100,
    hold: 2000,
    out: 500,
    rest: 500,
  },

  /** Slide 4 — hard cut between the three die examples, plus a landing punch. */
  die: {
    dwell: 2000,
    /** Scale punch on the tile only: reads as the die landing. */
    punch: 180,
  },
} as const;


/** Slide 2 stagger spans eight gaps after the first card. */
const DECK_FLIP_WINDOW = T.deck.flip + T.deck.stagger * 8;
/** Slide 3 in/out window: last label starts two staggers late. */
const STUDY_IN_WINDOW = T.study.in + T.study.stagger * 2;
const STUDY_OUT_WINDOW = T.study.out + T.study.stagger * 2;

/** `prefers-reduced-motion: reduce` — every loop stops, one static frame. */
const useReducedMotion = (): boolean => {
  const [reduce, setReduce] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
};

/** False while the tab is hidden, so nothing loops in the background. */
const usePageVisible = (): boolean => {
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" ? true : !document.hidden,
  );
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
};

/**
 * Steps through `steps` (durations in ms) forever while `running` is true, and
 * resets to phase 0 the moment it goes false. One timer per visual, and only
 * the visual on the visible slide is ever running.
 */
const usePhase = (steps: readonly number[], running: boolean): number => {
  const [phase, setPhase] = useState(0);
  const key = steps.join(",");
  useEffect(() => {
    setPhase(0);
    if (!running) return;
    const durations = key.split(",").map(Number);
    let i = 0;
    let t = 0;
    const tick = () => {
      t = window.setTimeout(() => {
        i = (i + 1) % durations.length;
        setPhase(i);
        tick();
      }, durations[i]);
    };
    tick();
    return () => window.clearTimeout(t);
  }, [running, key]);
  return phase;
};

/**
 * Decodes a set of images once and reports when they are all ready. Slide 2
 * flips at 500ms after the card mounts; on the first-run gate the face SVGs are
 * still in flight then, so the flip showed a blank mid-rotation.
 */
const useImagesReady = (srcs: readonly string[]): boolean => {
  const [ready, setReady] = useState(false);
  const key = srcs.join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      key.split(",").map(
        (src) =>
          new Promise<void>((resolve) => {
            const im = new Image();
            im.decoding = "async";
            im.onload = () => resolve();
            im.onerror = () => resolve();
            im.src = src;
          }),
      ),
    ).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return ready;
};



/* ------------------------------------------------------------------ *
 * Authored Figma geometry. The card is authored against a 390-wide
 * screen but laid out responsively: widths, padding and gaps are fluid,
 * type stays at its authored size, and only the middle visual shrinks.
 * ------------------------------------------------------------------ */
/** Authored phone geometry; the card holds this ratio as its maximum. */
const CARD_BASE_W = 354;
const CARD_BASE_H = 569;
const CARD_RATIO = CARD_BASE_H / CARD_BASE_W;

/** Responsive size steps: phone (authored), tablet, desktop. */
type Step = {
  cardMaxW: number;
  innerMaxW: number;
  headingBig: number;
  heading: number;
  bodyBig: number;
  body: number;
  headingRowH: number;
  /** Multiplier applied to authored visual dimensions (not to type). */
  vis: number;
};

const STEPS: { min: number; step: Step }[] = [
  {
    min: 1280,
    step: { cardMaxW: 520, innerMaxW: 426, headingBig: 64, heading: 48, bodyBig: 18, body: 16, headingRowH: 112, vis: 520 / CARD_BASE_W },
  },
  {
    min: 768,
    step: { cardMaxW: 440, innerMaxW: 360, headingBig: 56, heading: 42, bodyBig: 17, body: 15, headingRowH: 98, vis: 440 / CARD_BASE_W },
  },
  {
    min: 0,
    step: { cardMaxW: CARD_BASE_W, innerMaxW: 290, headingBig: 48, heading: 36, bodyBig: 16, body: 14, headingRowH: 84, vis: 1 },
  },
];


const stepFor = (w: number): Step => STEPS.find((s) => w >= s.min)!.step;

/** Track the viewport width step (phone / tablet / desktop). */
const useStep = (): Step => {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 390 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return stepFor(w);
};

/** The card art is a literal brand artifact: ink and khaki stay literal. */
const INK = RAW.warmBlack;

const heading = (big: boolean, sz: Step): React.CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontWeight: 400,
  fontStyle: "normal",
  fontSize: big ? sz.headingBig : sz.heading,
  lineHeight: 1.05,
  letterSpacing: "-0.01em",
  color: INK,
  textAlign: "center",
  margin: 0,
});

const body = (big: boolean, sz: Step): React.CSSProperties => ({
  fontFamily: FONT_FAMILY_UI,
  fontWeight: FONT_WEIGHT_UI,
  fontSize: big ? sz.bodyBig : sz.body,
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

/** A grid of card backs at authored dimensions times the visual scale. */
const backGrid = (
  cols: number,
  rows: number,
  cw: number,
  ch: number,
  gap: number,
  v: number,
) => {
  const w = cw * v;
  const h = ch * v;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${w}px)`,
        gridAutoRows: `${h}px`,
        gap: gap * v,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <img
          key={i}
          src={CARD_BACK}
          alt=""
          style={{ width: w, height: h, display: "block" }}
        />
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Slide 2 — nine cards flipping face up, staggered like a deal, then
 * flipping back down. Loop: down → flip up → up → flip down → hold.
 * ------------------------------------------------------------------ */
const DECK_FACES = [
  ["/cards/2-circle-red.svg", "Two red circles"],
  ["/cards/4-star-yellow.svg", "Four orange stars"],
  ["/cards/1-square-blue.svg", "One blue square"],
  ["/cards/3-tri-yellow.svg", "Three orange triangles"],
  ["/cards/2-star-blue.svg", "Two blue stars"],
  ["/cards/4-square-red.svg", "Four red squares"],
  ["/cards/1-circle-yellow.svg", "One orange circle"],
  ["/cards/3-square-blue.svg", "Three blue squares"],
  ["/cards/2-tri-red.svg", "Two red triangles"],
] as const;

const DECK_STEPS = [
  T.deck.faceDown,
  DECK_FLIP_WINDOW,
  T.deck.faceUp,
  DECK_FLIP_WINDOW,
  T.deck.hold,
] as const;

const DECK_FACE_SRCS = [CARD_BACK, ...DECK_FACES.map(([src]) => src)];

const DeckVisual: React.FC<{ sz: Step; active: boolean }> = ({ sz, active }) => {
  const v = sz.vis;
  const reduce = useReducedMotion();
  const visible = usePageVisible();
  // Hold the loop until every face has decoded: on the first-run gate the SVGs
  // are still in flight when the first flip would fire, which showed a blank.
  const imagesReady = useImagesReady(DECK_FACE_SRCS);
  const phase = usePhase(DECK_STEPS, active && visible && !reduce && imagesReady);
  // Face up across the flip-up window and the face-up hold.
  const up = reduce || phase === 1 || phase === 2;

  const w = 47.25 * v;
  const h = 66.15 * v;


  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(3, ${w}px)`,
        gridAutoRows: `${h}px`,
        gap: 8 * v,
      }}
      aria-hidden="true"
    >
      {DECK_FACES.map(([src], i) => (
        <div key={src} style={{ width: w, height: h, perspective: 600 }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
              // promote to its own layer up front so the first rotation does
              // not trigger a compositing flash
              willChange: "transform",
              transform: up ? "rotateY(180deg)" : "rotateY(0deg)",
              transition: reduce ? undefined : `transform ${T.deck.flip}ms ease`,
              transitionDelay: reduce ? undefined : `${i * T.deck.stagger}ms`,
            }}
          >

            <img
              src={CARD_BACK}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                backfaceVisibility: "hidden",
              }}
            />
            <img
              src={src}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Slide 3 — one card face; the leader lines draw out from the card and
 * their labels fade in on the same clock, then reverse.
 * ------------------------------------------------------------------ */
const STUDY_STEPS = [
  T.study.prime,
  STUDY_IN_WINDOW,
  T.study.hold,
  STUDY_OUT_WINDOW,
  T.study.rest,
] as const;

/** Authored slide-3 geometry (scale 1): container, card, lines, labels. */
const STUDY_BOX = { w: 215, h: 186 };
const STUDY_CARD = { x: 0, y: 0.68, w: 132, h: 184.8 };
const STUDY_ROWS = [
  { label: "Number", lineX: 34, lineY: 28.18, lineW: 121, labelY: 22.68 },
  { label: "Shape", lineX: 85, lineY: 61.68, lineW: 70, labelY: 56.68 },
  { label: "Color", lineX: 110, lineY: 95.68, lineW: 45, labelY: 90.68 },
] as const;
const STUDY_LABEL_X = 162;

const StudyVisual: React.FC<{ sz: Step; active: boolean }> = ({ sz, active }) => {
  const v = sz.vis;
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const phase = usePhase(STUDY_STEPS, active && pageVisible && !reduce);
  const shown = reduce || phase === 1 || phase === 2;

  return (
    <div style={{ position: "relative", width: STUDY_BOX.w * v, height: STUDY_BOX.h * v }}>
      {img("/cards/3-star-blue.svg", "A card showing three blue stars", STUDY_CARD.w * v, STUDY_CARD.h * v, {
        position: "absolute",
        left: STUDY_CARD.x * v,
        top: STUDY_CARD.y * v,
      })}
      {STUDY_ROWS.map((row, i) => {
        const delay = reduce ? 0 : i * T.study.stagger;
        const dur = shown ? T.study.in : T.study.out;
        const ease = shown ? "cubic-bezier(0.16, 1, 0.3, 1)" : "ease-in";
        return (
          <React.Fragment key={row.label}>
            <span
              style={{
                position: "absolute",
                left: row.lineX * v,
                top: row.lineY * v,
                width: row.lineW * v,
                height: 1,
                background: COLORS.orange,
                display: "block",
                // above the card artwork
                zIndex: 1,
                transformOrigin: "left center",
                transform: shown ? "scaleX(1)" : "scaleX(0)",
                transition: reduce ? undefined : `transform ${dur}ms ${ease} ${delay}ms`,
              }}
            />
            <span
              style={{
                position: "absolute",
                left: STUDY_LABEL_X * v,
                top: row.labelY * v,
                zIndex: 1,
                fontFamily: FONT_FAMILY_UI,
                fontWeight: FONT_WEIGHT_UI,
                fontSize: sz.body,
                lineHeight: 1.2,
                color: INK,
                whiteSpace: "nowrap",
                opacity: shown ? 1 : 0,
                transition: reduce ? undefined : `opacity ${dur}ms ${ease} ${delay}ms`,
              }}
            >
              {row.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};



/* ------------------------------------------------------------------ *
 * Slide 4 — the die-decides tile + overlapping pair, cycling through
 * three examples. Each change cross dissolves: the tile label first,
 * the card pair a beat behind it, mirroring die-lands-then-you-look.
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

const CYCLE_MS = T.die.dwell;

const DieVisual: React.FC<{ sz: Step; active: boolean }> = ({ sz, active }) => {
  const v = sz.vis;
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const [i, setI] = useState(0);
  /** Bumped on manual interaction so the auto-cycle timer restarts. */
  const [cycleKey, setCycleKey] = useState(0);
  const advance = useCallback(() => setI((n) => (n + 1) % DIE_EXAMPLES.length), []);
  const running = active && pageVisible && !reduce;

  // Reset to the first example whenever the slide leaves the screen.
  useEffect(() => {
    if (!active) setI(0);
  }, [active]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(advance, CYCLE_MS);
    return () => window.clearInterval(t);
  }, [advance, cycleKey, running]);

  const ex = DIE_EXAMPLES[i];
  const CW = 74.83 * v;
  const CH = 104.72 * v;
  const OX = 46.17 * v;
  const OY = 37.76 * v;
  const dot = 9 * v;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * v }}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          advance();
          setCycleKey((k) => k + 1);
        }}
        style={{ display: "flex", alignItems: "center", gap: 34 * v, cursor: "pointer" }}
      >
        <div
          style={{
            width: 121 * v,
            height: 121 * v,
            flex: "0 0 auto",
            background: RAW.cream,
            border: `2px solid ${INK}`,
            borderRadius: 9.68 * v,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 8 * v,
            boxSizing: "border-box",
          }}
        >
          <span
            key={ex.label}
            style={{
              display: "block",
              fontFamily: FONT_FAMILY,
              fontWeight: 400,
              fontSize: 28 * v,
              lineHeight: 0.9,
              color: INK,
              textAlign: "center",
              // Hard cut, with a small landing punch on the tile only.
              animation: reduce
                ? undefined
                : `ww-die-punch ${T.die.punch}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          >
            {ex.label}
          </span>
        </div>

        {/* card pair: pure cut, no fade and no delay */}
        <div style={{ position: "relative", width: CW + OX, height: CH + OY }}>
          {img(ex.a[0], ex.a[1], CW, CH, { position: "absolute", left: 0, top: 0 })}
          {img(ex.b[0], ex.b[1], CW, CH, { position: "absolute", left: OX, top: OY })}
        </div>

      </div>


      {/* example indicators — small circles, deliberately unlike the square
          slide dots at the top of the card */}
      <div style={{ display: "flex", gap: 8 * v }}>
        {DIE_EXAMPLES.map((e, n) => (
          <button
            key={e.label}
            type="button"
            aria-label={e.label}
            aria-current={n === i}
            onClick={(ev) => {
              ev.stopPropagation();
              setI(n);
              setCycleKey((k) => k + 1);
            }}
            style={{
              width: dot,
              height: dot,
              padding: 0,
              borderRadius: "50%",
              background: n === i ? INK : "transparent",
              border: n === i ? "none" : `1.5px solid ${INK}`,
              boxSizing: "border-box",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Slide 7 — PEEK button over a 2x3 grid of backs.
 * ------------------------------------------------------------------ */
const PeekVisual: React.FC<{ sz: Step }> = ({ sz }) => {
  const v = sz.vis;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * v }}>
      <div
        aria-hidden="true"
        style={{
          width: 158 * v,
          height: 27 * v,
          background: COLORS.blue,
          border: `2px solid ${INK}`,
          borderRadius: RADIUS.sm,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          fontSize: 16 * v,
          letterSpacing: "0.02em",
          color: RAW.cream,
        }}
      >
        PEEK
      </div>
      {backGrid(3, 2, 47.25, 66.15, 8, v)}
    </div>
  );
};


/* ------------------------------------------------------------------ *
 * The visual is the only flexible element: it keeps its authored size
 * when there is room and shrinks (never grows) when there is not.
 * ------------------------------------------------------------------ */
const VisualFit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);

  useEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const measure = () => {
      const bw = b.clientWidth;
      const bh = b.clientHeight;
      const iw = i.offsetWidth;
      const ih = i.offsetHeight;
      if (!bw || !bh || !iw || !ih) return;
      setS(Math.min(1, bw / iw, bh / ih));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
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
        ref={inner}
        style={{
          flex: "0 0 auto",
          transform: s < 1 ? `scale(${s})` : undefined,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};


/* ------------------------------------------------------------------ *
 * The eight slides.
 * ------------------------------------------------------------------ */
type Slide = {
  heading: string;
  body: string;
  big?: boolean;
  visual?: (sz: Step, active: boolean) => React.ReactNode;
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
    visual: (sz, active) => <DeckVisual sz={sz} active={active} />,
  },
  {
    heading: "Study, Study, Study",
    body:
      "While the cards are face up, you get 10 seconds to learn the shape, the number, and the color of every card. The die has not rolled yet, so you don't know what really matters.",
    visual: (sz, active) => <StudyVisual sz={sz} active={active} />,
  },
  {
    heading: "The Die Decides",
    body:
      "Shape, number, or color. Whichever face lands is what a match means this round. The die rolls again every round. Same cards, new rule.",
    visual: (sz, active) => <DieVisual sz={sz} active={active} />,
  },
  {
    heading: "Find Your Match",
    body:
      "Tap a card to pick it. Tap it again to change your mind. Your second tap locks the match.",
    visual: (sz) => (
      <div style={{ display: "flex", gap: 19.8 * sz.vis }} aria-hidden="true">
        {img(CARD_BACK, "", 107.19 * sz.vis, 150.06 * sz.vis)}
        {img(CARD_BACK, "", 107.19 * sz.vis, 150.06 * sz.vis)}
      </div>
    ),
  },
  {
    heading: "Match or Miss",
    body:
      "Find a match and that pair leaves. Two misses ends the round and all cards stay on the board.",
    visual: (sz) => backGrid(3, 3, 47.25, 66.15, 8, sz.vis),
  },
  {
    heading: "One More Thing",
    body:
      "You have one PEEK per game that shows all remaining cards for five seconds. But know that it shows up in your final results.",
    visual: (sz) => <PeekVisual sz={sz} />,

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

  const hostRef = useRef<HTMLDivElement>(null);
  const sz = useStep();


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
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: RAW.khaki,
            borderRadius: RADIUS.sm,
            padding: "24px clamp(16px, 9%, 32px) 32px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "clamp(12px, 4%, 24px)",
            "--ww-step-dx": `${d * 24}px`,
          } as React.CSSProperties
        }
      >
        {/* top row: progress dots + close */}
        <div
          style={{
            width: "100%",
            maxWidth: sz.innerMaxW,
            flex: "0 0 auto",

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

        {/* heading row (fixed on slides 2-7 so the heading never moves) */}
        {s.big ? null : (
          <div
            style={{
              width: "100%",
              maxWidth: sz.innerMaxW,
              height: sz.headingRowH,
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <h2 style={heading(false, sz)}>{s.heading}</h2>
          </div>
        )}

        {/* visual + body share the flexible space */}
        <div
          style={{
            width: "100%",
            maxWidth: sz.innerMaxW,
            flex: "1 1 auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {s.big ? <h2 style={heading(true, sz)}>{s.heading}</h2> : null}
          {s.visual ? <VisualFit>{s.visual(sz, entering)}</VisualFit> : null}
          <p style={{ ...body(!!s.big, sz), flex: "0 0 auto" }}>{s.body}</p>
        </div>

        {/* buttons */}
        <div
          style={{
            width: "100%",
            maxWidth: sz.innerMaxW,
            flex: "0 0 auto",
            display: "flex",
            gap: "clamp(16px, 16.5%, 48px)",
          }}
        >

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
        /* Same 24px frame as DailyFrame: the shape rules must measure the
           identical width and height here, or the pattern band snaps to a
           different cell count and appears to shift when this opens. */
        gap: 24,
        padding: 24,
        paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
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
          padding: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: sz.cardMaxW,
            height: "100%",
            maxHeight: Math.round(sz.cardMaxW * CARD_RATIO),
            flex: "0 0 auto",
            position: "relative",
          }}
        >
          {prev && renderSlide(prev.index, false, prev.dir)}
          <React.Fragment key={step}>{renderSlide(step, true, dir)}</React.Fragment>
        </div>

      </div>

      <DailyShapeRule />
    </div>
  );
};

export default DailyHowToSteps;
