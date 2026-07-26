// ============================================================================
// MultiplayerGameView — prompt 12b, Figma-accurate multiplayer surface.
//
// Rendering-only. All state comes from PublicState + the transient event
// stream. No reducer touches, no new tokens. Pixel values below are
// transcribed from the Figma spec at a 385px content column; card grid uses
// aspect-ratio so it scales gracefully on narrower phones without changing
// the ratio.
//
// Chip state derivation is deterministic:
//   claimBy === seat           → WHOOP!  (arbiter grant is authoritative)
//   event NOPE  on seat        → NICE! not shown; PENALTY shows via skip[]
//   event GREAT_MATCH on seat  → NICE!  (transient, 1.4s window)
//   disconnected[seat]         → GONE   (see report — invented state)
//   skip[seat]                 → PENALTY
//   AWAITING_ROLL && roller    → ROLLING!
//   FLIPPING     && flipper    → FLIPPING
//   otherwise                  → idle
// Precedence is top-down so a claim winner reads WHOOP! even if they were
// also the flipper the moment before.
//
// TOO SLOW! chip state is included in the style map but does not fire on
// opponent chips in normal flow — the arbiter's `won:false` is a local-only
// signal to the loser (see multiplayer.ts). The design system carries the
// state; the game currently only surfaces it on the SELF banner.
// ============================================================================

import React from "react";
import { Settings, X } from "lucide-react";
import GameCard from "@/components/GameCard";
import { COLORS, FONT_FAMILY } from "@/lib/tokens";
import type { PublicState } from "@/lib/publicState";
import type { IntentAction, RollAttribute, RollCommitPayload, TransientEvent } from "@/lib/multiplayer";
import { ROLL_HERO_MS } from "@/lib/multiplayer";
import { serverNow } from "@/hooks/useServerClock";
import RollHeroOverlay from "@/components/RollHeroOverlay";
import { MATCH_ART_SRC } from "@/components/MatchDie";
import type { Card } from "@/cardData";
import { callClaimLock } from "@/lib/claimLock";
import {
  playFlip, playDiceRoll, playWhoopCall, playCorrect, playWrong, playDeal,
  unlockAudio,
} from "@/lib/sounds";

interface Props {
  publicState: PublicState;
  mySeat: number | null; // null = spectator
  events?: TransientEvent[];
  // Latest server-committed roll. Drives the hero overlay when its window
  // ([startAt, startAt + ROLL_HERO_MS]) is still live on the server clock.
  rollCommit?: RollCommitPayload | null;
  // Latest host-emitted claim rejection (window mismatch). When its seat
  // matches mySeat, the pressing player sees CONNECTION ISSUE — TRY AGAIN
  // instead of a silently stuck LOCKING… state.
  lastClaimReject?: { seat: number; grant_claim_window: number; host_claim_window: number; reason: string } | null;
  onIntent: (a: IntentAction) => void;
  onLeave: () => void;
  mobile?: boolean;
  roomId: string;
  visitorId: string;
  isHost: boolean;
}

// -------- Figma-transcribed constants --------
const INK = COLORS.ink;               // #231F20
const SURFACE = COLORS.surface;       // #F8F2E9
const PANEL = COLORS.panel;           // #D0C3AF
const MUTED = COLORS.inkMuted;        // #544C4A
const RED = COLORS.red;               // #D72229
const BLUE = COLORS.blue;             // #0072B2
const ORANGE = COLORS.orange;         // #E79024
const GREEN = COLORS.success;         // #59CD90

const R_CARD = 6.33043;
const R_BOX = 4;
const R_STRIP = 6.33043;
const BORDER_HEAVY = `2px solid ${INK}`;
const CARD_SHADOW = "0px 4px 4px rgba(0,0,0,0.25)";

type ChipKind = "ROLLING" | "WHOOP" | "NICE" | "FLIPPING" | "TOO_SLOW" | "PENALTY" | "GONE" | "IDLE" | "EMPTY";

interface ChipStyle {
  bg: string; border: string; nameBg: string; nameBorder: string;
  name: string; score: string; label: string;
  labelText: string | null;
}

const CHIP: Record<ChipKind, ChipStyle> = {
  ROLLING:  { bg: ORANGE, border: INK,   nameBg: SURFACE, nameBorder: INK,   name: INK,   score: RED, label: INK,     labelText: "ROLLING!" },
  WHOOP:    { bg: RED,    border: INK,   nameBg: SURFACE, nameBorder: INK,   name: INK,   score: RED, label: SURFACE, labelText: "WHOOP!" },
  NICE:     { bg: GREEN,  border: INK,   nameBg: SURFACE, nameBorder: INK,   name: INK,   score: RED, label: INK,     labelText: "NICE!" },
  FLIPPING: { bg: BLUE,   border: INK,   nameBg: SURFACE, nameBorder: INK,   name: INK,   score: RED, label: SURFACE, labelText: "FLIPPING" },
  TOO_SLOW: { bg: INK,    border: INK,   nameBg: SURFACE, nameBorder: INK,   name: INK,   score: RED, label: SURFACE, labelText: "TOO SLOW!" },
  PENALTY:  { bg: MUTED,  border: MUTED, nameBg: PANEL,   nameBorder: MUTED, name: MUTED, score: MUTED, label: PANEL, labelText: "PENALTY" },
  // GONE — the one invented state (see report). More urgent than PENALTY:
  // full-weight red border against panel fill, name/score at full ink so their
  // earned score stays visible. Distinct from EMPTY (which uses muted ink to
  // read as "never here").
  GONE:     { bg: PANEL,  border: RED,   nameBg: SURFACE, nameBorder: RED,   name: INK,   score: RED, label: RED,     labelText: "GONE" },
  IDLE:     { bg: PANEL,  border: INK,   nameBg: SURFACE, nameBorder: INK,   name: INK,   score: RED, label: INK,     labelText: null },
  EMPTY:    { bg: PANEL,  border: MUTED, nameBg: PANEL,   nameBorder: MUTED, name: MUTED, score: MUTED, label: MUTED, labelText: null },
};

interface DerivedChip { kind: ChipKind; name: string; score: number | null; }

function chipsForOpponents(
  s: PublicState,
  mySeat: number | null,
  events: TransientEvent[],
): DerivedChip[] {
  // Recent NICE (GREAT_MATCH) events per seat — the chip flashes NICE! while
  // the event is alive in the dedup buffer. Both NICE and TOO SLOW can be
  // active on different seats simultaneously — nothing serialises them.
  const nice = new Set<number>();
  for (const e of events) if (e.kind === "GREAT_MATCH") nice.add(e.seat);

  // Max 5 opponent chips. Host + 5 = 6 seats total.
  const MAX = 5;
  const opponents = s.seatMap.filter((e) => e.seat !== mySeat).slice(0, MAX);
  const out: DerivedChip[] = opponents.map((entry) => {
    const seat = entry.seat;
    let kind: ChipKind = "IDLE";
    if (s.claimBy === seat) kind = "WHOOP";
    else if (nice.has(seat)) kind = "NICE";
    else if (s.disconnectedSeats.includes(seat)) kind = "GONE";
    else if (s.skip[seat]) kind = "PENALTY";
    else if (((s.phase === "AWAITING_ROLL" && s.roller === seat) || (s.rolling && s.roller === seat))) kind = "ROLLING";
    else if (s.phase === "FLIPPING" && s.flipper === seat) kind = "FLIPPING";
    return { kind, name: entry.display_name, score: s.scores[seat] ?? 0 };
  });
  // Pad with EMPTY placeholders to MAX so the row width feels stable.
  while (out.length < MAX) out.push({ kind: "EMPTY", name: "---", score: null });
  return out;
}

// -------- Small building blocks --------

const ChipCell: React.FC<{ chip: DerivedChip }> = ({ chip }) => {
  const c = CHIP[chip.kind];
  return (
    <div
      role="group"
      aria-label={`${chip.name}${c.labelText ? ` — ${c.labelText}` : ""}`}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        height: 48, borderRadius: 8, flex: "1 1 0", minWidth: 0,
        background: c.bg, border: `2px solid ${c.border}`,
        boxSizing: "border-box",
      }}
    >
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        padding: "4px 8px", height: 25, borderRadius: R_STRIP,
        background: c.nameBg, border: `2px solid ${c.nameBorder}`,
        boxSizing: "border-box", width: "100%",
      }}>
        <span style={{
          fontFamily: FONT_FAMILY, fontSize: 14, lineHeight: "17px",
          color: c.name, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", flex: "1 1 auto", minWidth: 0,
        }}>{chip.name}</span>
        {chip.score !== null && (
          <span style={{
            fontFamily: FONT_FAMILY, fontSize: 14, lineHeight: "17px",
            color: c.score, marginLeft: 8, flex: "0 0 auto",
          }}>{chip.score}</span>
        )}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        padding: "4px 8px", height: 23, borderRadius: R_STRIP,
        width: "100%", boxSizing: "border-box",
      }}>
        {c.labelText && (
          <span style={{
            fontFamily: FONT_FAMILY, fontSize: 12, lineHeight: "15px", color: c.label,
          }}>{c.labelText}</span>
        )}
      </div>
    </div>
  );
};

const OpponentRow: React.FC<{ chips: DerivedChip[] }> = ({ chips }) => (
  <div style={{
    display: "flex", flexDirection: "row", alignItems: "center",
    padding: 8, gap: 8, height: 64,
    background: PANEL, border: BORDER_HEAVY, borderRadius: R_BOX,
    boxSizing: "border-box",
  }}>
    {chips.map((c, i) => <ChipCell key={i} chip={c} />)}
  </div>
);

const Header: React.FC<{
  round: number;
  onSettings: () => void;
  onClose: () => void;
}> = ({ round, onSettings, onClose }) => (
  <div style={{
    display: "flex", flexDirection: "column", justifyContent: "center",
    alignItems: "center", padding: 8, gap: 8, height: 56,
    background: SURFACE, alignSelf: "stretch", boxSizing: "border-box",
  }}>
    <div style={{
      display: "flex", flexDirection: "row", alignItems: "flex-start",
      gap: 8, height: 40, width: "100%",
    }}>
      <button
        type="button"
        onClick={onSettings}
        aria-label="Settings"
        style={{
          all: "unset", cursor: "pointer",
          width: 40, height: 40, flex: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 8, boxSizing: "border-box",
          background: BLUE, border: BORDER_HEAVY, borderRadius: R_BOX,
        }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSettings(); } }}
      >
        <Settings size={24} color={SURFACE} aria-hidden="true" />
      </button>
      <div style={{
        flex: "1 1 0", height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 8, gap: 7.91, boxSizing: "border-box",
        background: INK, border: BORDER_HEAVY, borderRadius: R_BOX,
      }}>
        <span style={{
          fontFamily: FONT_FAMILY, fontWeight: 400, fontSize: 20,
          lineHeight: "24px", color: SURFACE, textAlign: "center",
        }}>
          Round: {round}
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Leave game"
        style={{
          all: "unset", cursor: "pointer",
          width: 40, height: 40, flex: "none", alignSelf: "stretch",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 12, boxSizing: "border-box",
          background: RED, border: BORDER_HEAVY, borderRadius: R_BOX,
        }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }}
      >
        <X size={16} color={SURFACE} aria-hidden="true" />
      </button>
    </div>
  </div>
);

// Focus outline for keyboard users on the header buttons.
const HEADER_FOCUS_CSS = `
.mp-header-btn:focus-visible { outline: 2px solid ${ORANGE}; outline-offset: 2px; }
`;

const ModalShell: React.FC<{
  titleId: string;
  onCancel: () => void;
  children: React.ReactNode;
}> = ({ titleId, onCancel, children }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: SURFACE, border: BORDER_HEAVY, borderRadius: R_BOX,
          padding: 16, maxWidth: 340, width: "100%",
          display: "flex", flexDirection: "column", gap: 12,
          fontFamily: FONT_FAMILY, color: INK,
        }}
      >
        {children}
      </div>
    </div>
  );
};

type BannerKind = "YOUR_FLIP" | "TOO_SLOW" | "CLAIM_ERROR" | "PENALTY" | "CANCEL" | null;

const BannerStyles: Record<Exclude<BannerKind, null>, { bg: string; text: string; label: string; icon?: boolean }> = {
  YOUR_FLIP:   { bg: BLUE,    text: SURFACE, label: "YOUR FLIP!" },
  TOO_SLOW:    { bg: INK,     text: SURFACE, label: "TOO SLOW!" },
  CLAIM_ERROR: { bg: RED,     text: SURFACE, label: "CONNECTION ISSUE — TRY AGAIN" },
  PENALTY:     { bg: MUTED,   text: SURFACE, label: "PENALTY" },
  CANCEL:      { bg: SURFACE, text: RED,     label: "Cancel Match Selection", icon: true },
};

const CancelX: React.FC = () => (
  <span aria-hidden="true" style={{
    display: "inline-block", position: "relative", width: 14.55, height: 14.55,
    marginRight: 8, flex: "0 0 auto",
  }}>
    <span style={{
      position: "absolute", top: "50%", left: "50%",
      width: 18.99, height: 1.58, background: RED,
      transform: "translate(-50%, -50%) rotate(45deg)",
    }} />
    <span style={{
      position: "absolute", top: "50%", left: "50%",
      width: 18.99, height: 1.58, background: RED,
      transform: "translate(-50%, -50%) rotate(-45deg)",
    }} />
  </span>
);

const ScoreRow: React.FC<{
  score: number; cardsLeft: number; banner: BannerKind; onCancel?: () => void;
}> = ({ score, cardsLeft, banner, onCancel }) => {
  const box: React.CSSProperties = {
    flex: "1 1 0", height: 49.32, background: SURFACE,
    border: BORDER_HEAVY, borderRadius: R_STRIP, padding: 12.6609,
    boxSizing: "border-box", display: "flex", alignItems: "center",
    fontFamily: FONT_FAMILY, fontSize: 20, lineHeight: "24px",
  };
  if (banner) {
    const b = BannerStyles[banner];
    const clickable = banner === "CANCEL" && !!onCancel;
    return (
      <div style={{
        height: 65.32, background: PANEL, border: BORDER_HEAVY,
        borderRadius: R_BOX, padding: 8, boxSizing: "border-box",
        display: "flex", alignItems: "center",
      }}>
        <button
          type="button"
          onClick={clickable ? onCancel : undefined}
          disabled={!clickable}
          aria-label={b.label}
          style={{
            all: "unset", cursor: clickable ? "pointer" : "default",
            width: "100%", height: 49.32, background: b.bg, color: b.text,
            border: BORDER_HEAVY, borderRadius: R_STRIP, boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT_FAMILY, fontSize: 20, lineHeight: "24px",
          }}
        >
          {b.icon && <CancelX />}
          {b.label}
        </button>
      </div>
    );
  }
  return (
    <div style={{
      height: 65.32, background: PANEL, border: BORDER_HEAVY,
      borderRadius: R_BOX, padding: 8, gap: 8, boxSizing: "border-box",
      display: "flex", alignItems: "center",
    }}>
      <div style={box}>
        <span style={{ color: INK }}>Your Score:&nbsp;</span>
        <span style={{ color: RED }}>{score}</span>
      </div>
      <div style={box}>
        <span style={{ color: INK }}>Cards Left: {cardsLeft}</span>
      </div>
    </div>
  );
};

type ButtonKind = "WHOOP" | "YOUR_ROLL" | "SELECT_MATCH" | "DISABLED";
const ButtonStyles: Record<ButtonKind, { bg: string; text: string; label: string }> = {
  WHOOP:        { bg: RED,    text: SURFACE, label: "WHOOP! WHOOP!" },
  YOUR_ROLL:    { bg: ORANGE, text: INK,     label: "YOUR ROLL!" },
  SELECT_MATCH: { bg: BLUE,   text: SURFACE, label: "SELECT MATCH" },
  DISABLED:     { bg: PANEL,  text: MUTED,   label: "WAIT" },
};

const DieBox: React.FC<{
  rule: string;
  heroActive: boolean;
  waiting: boolean;
  homeRef?: React.Ref<HTMLDivElement>;
}> = ({ rule, heroActive, waiting, homeRef }) => (
  <div style={{
    width: 111.07, height: 110.94, background: ORANGE,
    border: BORDER_HEAVY, borderRadius: R_BOX, padding: 8, gap: 16,
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", boxSizing: "border-box", flex: "0 0 auto",
  }}>
    {/* The 80×80 cream box is the home cell for the roll-hero overlay. When
        the overlay is live we hide the art so the animation lands cleanly.
        While AWAITING_ROLL (and not mid-hero) the face is blank — the prior
        round's rule must not read as current. Size stays fixed so layout
        does not shift when the rule appears on settle. */}
    <div
      ref={homeRef}
      style={{
        width: 80, height: 80, background: SURFACE, borderRadius: 8,
        transform: "rotate(-3.65deg)", boxShadow: CARD_SHADOW,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "8%", boxSizing: "border-box",
        opacity: heroActive ? 0 : 1, overflow: "hidden",
      }}
    >
      {!waiting && (
        <img
          src={MATCH_ART_SRC[rule as RollAttribute]}
          alt={`Match the ${rule}`}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
        />
      )}
    </div>
  </div>
);

const ActionButton: React.FC<{
  kind: ButtonKind; disabled?: boolean; onClick?: () => void; label?: string;
}> = ({ kind, disabled, onClick, label }) => {
  const s = ButtonStyles[kind];
  const isDisabled = disabled || kind === "DISABLED";
  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={{
        all: "unset", cursor: isDisabled ? "not-allowed" : "pointer",
        flex: "1 1 0", height: 110.94, background: s.bg, color: s.text,
        border: BORDER_HEAVY, borderRadius: R_BOX, boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT_FAMILY, fontStyle: "italic", fontWeight: 400,
        fontSize: 32, lineHeight: "39px", textAlign: "center", padding: 4,
      }}
    >
      {label ?? s.label}
    </button>
  );
};

// -------- Grid overlay --------

const GridOverlay: React.FC<{ kind: "GREAT_MATCH" | "NOPE" }> = ({ kind }) => {
  const isGreat = kind === "GREAT_MATCH";
  return (
    <div style={{
      position: "absolute", inset: 16, borderRadius: R_STRIP,
      background: isGreat ? GREEN : RED, border: BORDER_HEAVY,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none", overflow: "hidden",
    }}>
      <span style={{
        fontFamily: FONT_FAMILY, fontStyle: "italic",
        fontSize: isGreat ? 88 : 100, lineHeight: "85%",
        color: isGreat ? INK : SURFACE,
        transform: `rotate(${isGreat ? -4.69 : 6.55}deg)`,
        whiteSpace: "nowrap",
      }}>
        {isGreat ? "Great Match!" : "NOPE!"}
      </span>
    </div>
  );
};

// -------- Main component --------

const MultiplayerGameView: React.FC<Props> = ({
  publicState: s, mySeat, events = [], rollCommit = null, lastClaimReject = null, onIntent, onLeave, mobile: _mobile = false, roomId, visitorId, isHost,
}) => {
  void _mobile;
  const [showSettings, setShowSettings] = React.useState(false);
  const [showLeave, setShowLeave] = React.useState(false);
  const modalOpen = showSettings || showLeave;
  void _mobile;

  // ---- roll-hero overlay wiring ----------------------------------------
  // Root of the play area — the overlay is absolutely positioned inside it.
  // Home ref points at the 80×80 cream box inside the dice tray.
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const homeRef = React.useRef<HTMLDivElement | null>(null);
  // `activeCommit` is the commit we're CURRENTLY animating. It becomes null
  // when the 1100ms window expires (or is skipped if we arrived too late).
  const [activeCommit, setActiveCommit] = React.useState<RollCommitPayload | null>(null);
  const [heroRects, setHeroRects] = React.useState<{
    home: DOMRect; target: DOMRect; parent: DOMRect;
  } | null>(null);
  React.useEffect(() => {
    if (!rollCommit) return;
    // Ignore repeats of the same commit (state updates after we've completed).
    if (activeCommit && activeCommit.startAt === rollCommit.startAt) return;
    const elapsed = serverNow() - rollCommit.startAt;
    if (elapsed >= ROLL_HERO_MS) return; // arrived too late — skip animation
    const home = homeRef.current?.getBoundingClientRect() ?? null;
    const target = cardAreaRef.current?.getBoundingClientRect() ?? null;
    const parent = rootRef.current?.getBoundingClientRect() ?? null;
    if (!home || !target || !parent) return;
    setHeroRects({ home, target, parent });
    setActiveCommit(rollCommit);
    // cardAreaRef is declared below; the ref itself is stable so eslint's
    // dependency check is not helpful here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollCommit]);
  const heroActive = activeCommit !== null;
  const isMyTurnToRoll = mySeat !== null && s.roller === mySeat && s.phase === "AWAITING_ROLL" && !s.rolling;
  const isMyTurnToFlip = mySeat !== null && s.flipper === mySeat && s.phase === "FLIPPING" && s.peekingCard === null;
  // Block WHOOP for ~500ms during the flip rotation itself (matches
  // GameCard's `transform 0.5s` transition). Once the face has settled the
  // full hold window remains claimable.
  const [isAnimating, setIsAnimating] = React.useState(false);
  const prevPeekRef = React.useRef<number | null>(s.peekingCard);
  React.useEffect(() => {
    const prev = prevPeekRef.current;
    prevPeekRef.current = s.peekingCard;
    if (prev === null && s.peekingCard !== null) {
      setIsAnimating(true);
      const t = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(t);
    }
    if (s.peekingCard === null) setIsAnimating(false);
  }, [s.peekingCard]);
  const canClaim =
    mySeat !== null &&
    (s.phase === "FLIPPING" || s.phase === "AWAITING_ROLL") &&
    s.claimBy === null &&
    !isAnimating;
  const inClaimMode = s.phase === "CLAIM_SELECTING" && s.claimBy === mySeat;
  const inLastCall = s.phase === "LAST_CALL";
  const [lastCallSel, setLastCallSel] = React.useState<number[]>([]);
  const [claimBusy, setClaimBusy] = React.useState(false);
  const [tooSlowAt, setTooSlowAt] = React.useState<number | null>(null);
  const [claimErrAt, setClaimErrAt] = React.useState<number | null>(null);
  React.useEffect(() => { if (!inLastCall) setLastCallSel([]); }, [inLastCall]);
  // Clear transient claim feedback when the claim window rotates.
  React.useEffect(() => { setTooSlowAt(null); setClaimErrAt(null); }, [s.claimWindow]);
  // Auto-clear TOO SLOW after a short interval so the banner doesn't stick.
  React.useEffect(() => {
    if (tooSlowAt === null) return;
    const t = setTimeout(() => setTooSlowAt(null), 1400);
    return () => clearTimeout(t);
  }, [tooSlowAt]);
  // Auto-clear claim-error banner similarly.
  React.useEffect(() => {
    if (claimErrAt === null) return;
    const t = setTimeout(() => setClaimErrAt(null), 1800);
    return () => clearTimeout(t);
  }, [claimErrAt]);

  // Host-dropped claim grant (window mismatch): if the rejected seat is
  // ours, we thought we won but the host discarded the grant. Surface the
  // CONNECTION ISSUE banner instead of a silent hang. Also clears LOCKING…
  // if we happen to still be mid-request.
  const lastRejectKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!lastClaimReject || mySeat === null) return;
    if (lastClaimReject.seat !== mySeat) return;
    const key = `${lastClaimReject.grant_claim_window}:${lastClaimReject.host_claim_window}:${lastClaimReject.reason}`;
    if (lastRejectKeyRef.current === key) return;
    lastRejectKeyRef.current = key;
    console.warn("[claim_reject:self]", lastClaimReject);
    setClaimBusy(false);
    setClaimErrAt(Date.now());
  }, [lastClaimReject, mySeat]);

  // Detect self outcome events (last ~1.4s) for the grid overlay.
  const myGreat = mySeat !== null && events.some((e) => e.kind === "GREAT_MATCH" && e.seat === mySeat);
  const myNope = mySeat !== null && events.some((e) => e.kind === "NOPE" && e.seat === mySeat);
  const overlay: "GREAT_MATCH" | "NOPE" | null = myGreat ? "GREAT_MATCH" : myNope ? "NOPE" : null;

  // -------- Sound effects --------
  // Each fires once per event using refs to remember previous values / seen
  // event ids. Do not derive from render — refs survive re-renders and dedupe
  // re-broadcasts of the same PublicState snapshot.
  const prevPeekForSoundRef = React.useRef<number | null>(s.peekingCard);
  React.useEffect(() => {
    const prev = prevPeekForSoundRef.current;
    prevPeekForSoundRef.current = s.peekingCard;
    if (prev === null && s.peekingCard !== null) playFlip();
  }, [s.peekingCard]);

  const prevRollingRef = React.useRef<boolean>(s.rolling);
  React.useEffect(() => {
    const prev = prevRollingRef.current;
    prevRollingRef.current = s.rolling;
    // Roll resolves when the rolling animation flag drops from true → false.
    if (prev && !s.rolling) playDiceRoll();
  }, [s.rolling]);

  const prevClaimByRef = React.useRef<number | null>(s.claimBy);
  React.useEffect(() => {
    const prev = prevClaimByRef.current;
    prevClaimByRef.current = s.claimBy;
    if (prev === null && s.claimBy !== null) playWhoopCall();
  }, [s.claimBy]);

  const seenEventIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    for (const e of events) {
      if (seenEventIdsRef.current.has(e.id)) continue;
      seenEventIdsRef.current.add(e.id);
      if (e.kind === "GREAT_MATCH") playCorrect();
      else if (e.kind === "NOPE") playWrong();
    }
    // Bound the dedup set so it doesn't grow forever across a long session.
    if (seenEventIdsRef.current.size > 256) {
      const arr = Array.from(seenEventIdsRef.current);
      seenEventIdsRef.current = new Set(arr.slice(-128));
    }
  }, [events]);

  // Deal sound when the grid refills after a claim. Watch occupied count
  // rising — a claim removes cards then the deck deals to fill the gaps.
  const occupiedCount = s.grid.reduce((n, slot) => n + (slot.occupied ? 1 : 0), 0);
  const prevOccupiedRef = React.useRef<number>(occupiedCount);
  React.useEffect(() => {
    const prev = prevOccupiedRef.current;
    prevOccupiedRef.current = occupiedCount;
    if (occupiedCount > prev) playDeal(occupiedCount - prev);
  }, [occupiedCount]);


  // Auto-resolve match once two cards are selected during a claim.
  React.useEffect(() => {
    if (!inClaimMode) return;
    if (s.selectedCards.length === 2 && mySeat !== null) {
      const t = setTimeout(() => {
        onIntent({ type: "PLAYER_RESOLVE_MATCH", by: mySeat });
      }, 800);
      return () => clearTimeout(t);
    }
  }, [inClaimMode, s.selectedCards.length, mySeat, onIntent]);

  const handleCardClick = (i: number) => {
    if (mySeat === null) return;
    if (modalOpen) return;
    if (inLastCall) {
      const slot = s.grid[i];
      if (!slot.occupied) return;
      setLastCallSel((prev) => {
        if (prev.includes(i)) return prev.filter((x) => x !== i);
        if (prev.length >= 2) return prev;
        const next = [...prev, i];
        if (next.length === 2) {
          onIntent({ type: "LAST_CALL_CLAIM", by: mySeat, a: next[0], b: next[1] });
          return [];
        }
        return next;
      });
      return;
    }
    if (inClaimMode) {
      onIntent({ type: "PLAYER_SELECT_CARD", by: mySeat, idx: i });
      return;
    }
    if (isMyTurnToFlip) {
      const slot = s.grid[i];
      if (!slot.occupied) return;
      onIntent({ type: "FLIP_START", by: mySeat, idx: i, token: Date.now() });
    }
  };

  // -------- Compose self surfaces --------

  // Score row banner selection. Precedence: cancel-during-claim > penalty >
  // too-slow > your-flip > none.
  let banner: BannerKind = null;
  const canCancelClaim = inClaimMode && s.selectedCards.length < 2;
  if (canCancelClaim) banner = "CANCEL";
  else if (mySeat !== null && s.skip[mySeat] && s.phase === "FLIPPING" && s.flipper === mySeat) banner = "PENALTY";
  else if (claimErrAt !== null) banner = "CLAIM_ERROR";
  else if (tooSlowAt !== null) banner = "TOO_SLOW";
  else if (isMyTurnToFlip) banner = "YOUR_FLIP";

  // Button state.
  let buttonKind: ButtonKind = "DISABLED";
  let buttonOnClick: (() => void) | undefined;
  let buttonLabel: string | undefined;
  if (inClaimMode) {
    // Whether the second touch has locked in (button becomes a passive label).
    buttonKind = "SELECT_MATCH";
    if (s.selectedCards.length >= 2) {
      buttonOnClick = undefined;
    }
  } else if (isMyTurnToRoll) {
    buttonKind = "YOUR_ROLL";
    buttonOnClick = () => onIntent({ type: "REQUEST_ROLL" });
    buttonLabel = s.roundNum === 1 ? "PLAY!" : "YOUR ROLL!";
  } else if (canClaim && !inLastCall && s.phase !== "GAME_OVER") {
    buttonKind = "WHOOP";
    buttonOnClick = async () => {
      if (mySeat === null || claimBusy || modalOpen) return;
      unlockAudio();
      setClaimBusy(true);
      const result = await callClaimLock({
        room_id: roomId,
        game_id: s.gameId,
        claim_window: s.claimWindow,
        player_seat: mySeat,
        visitor_id: visitorId,
      });
      setClaimBusy(false);
      // Tri-state: real lost race → TOO SLOW; transport/server error →
      // distinct banner so players can tell "beaten to it" from "broken".
      // Both fail closed — we never enter claim mode without a server win.
      if (result.outcome === "won") {
        // handled server-side via claim_grant broadcast
      } else if (result.outcome === "error") {
        console.error("[whoop] claim errored — see claim-lock log above", result.error);
        setClaimErrAt(Date.now());
      } else {
        setTooSlowAt(Date.now());
      }
    };
    if (claimBusy) { buttonKind = "DISABLED"; buttonOnClick = undefined; }
  } else if (
    mySeat !== null &&
    (s.phase === "FLIPPING" || s.phase === "AWAITING_ROLL") &&
    s.claimBy === null &&
    isAnimating
  ) {
    // Flip animation freeze: WHOOP stays red but is inert.
    buttonKind = "WHOOP";
    buttonOnClick = undefined;
  } else if (inLastCall && mySeat !== null) {
    buttonKind = "WHOOP";
    buttonLabel = "LAST CALL!";
    buttonOnClick = undefined;
  }

  // Derive a descriptive label for the muted disabled state so players can
  // tell waiting, rolling, and another player's claim apart from a broken UI.
  if (buttonKind === "DISABLED") {
    if (claimBusy) {
      buttonLabel = "LOCKING…";
    } else if (mySeat !== null && s.claimBy !== null && s.claimBy !== mySeat) {
      buttonLabel = "CLAIMING…";
    } else if (s.rolling) {
      buttonLabel = "ROLLING…";
    } else {
      buttonLabel = "WAIT";
    }
  }

  // ROLLING presentation gate — presentation only, the server rejection is
  // the actual authority. We force the button to appear as a dimmed WHOOP
  // and strip its onClick so mashing during a roll can never register a
  // wrong-claim penalty.
  const isRolling = s.rolling;
  if (isRolling) {
    buttonKind = "WHOOP";
    buttonOnClick = undefined;
    buttonLabel = undefined;
  }


  const chips = chipsForOpponents(s, mySeat, events);

  const myScore = mySeat !== null ? (s.scores[mySeat] ?? 0) : 0;
  const rule = s.rule[0] ?? "SHAPE";




  const header = (
    <Header
      round={s.roundNum}
      onSettings={() => setShowSettings(true)}
      onClose={() => setShowLeave(true)}
    />
  );
  const opponentRow = <OpponentRow chips={chips} />;
  const scoreRow = (
    <ScoreRow
      score={myScore}
      cardsLeft={s.deckCount}
      banner={banner}
      onCancel={
        canCancelClaim && mySeat !== null
          ? () => onIntent({ type: "CANCEL_CLAIM", by: mySeat })
          : undefined
      }
    />
  );
  const bottomRow = (
    <div style={{ display: "flex", gap: 8, height: 110.94 }}>
      <DieBox rule={rule} heroActive={heroActive} homeRef={homeRef} />
      {/* Wrap the WHOOP button so ROLLING can dim it to 40% and physically
          block taps. pointerEvents:none guarantees no tap ever reaches the
          onClick — belt-and-braces on top of the cleared handler above. */}
      <div style={{
        flex: "1 1 auto", display: "flex", minWidth: 0,
        opacity: isRolling ? 0.4 : 1,
        pointerEvents: isRolling ? "none" : "auto",
        transition: "opacity 250ms ease",
      }}>
        <ActionButton
          kind={buttonKind}
          disabled={isRolling || buttonKind === "DISABLED" || (!buttonOnClick && buttonKind !== "SELECT_MATCH")}
          onClick={isRolling ? undefined : buttonOnClick}
          label={buttonLabel}
        />
      </div>
    </div>
  );
  const gameOverBtn = s.phase === "GAME_OVER" ? (
    <button
      type="button"
      onClick={onLeave}
      style={{
        all: "unset", cursor: "pointer", textAlign: "center",
        padding: 8, borderRadius: R_BOX, border: BORDER_HEAVY,
        background: SURFACE, color: INK, fontFamily: FONT_FAMILY,
        fontSize: 16,
      }}
    >
      {s.message || "Game over"} — Leave
    </button>
  ) : null;

  // Measured card sizing: compute per-card dimensions from the card area's
  // content box so 9 cards always fit both axes with padding + gaps.
  const cardAreaRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = cardAreaRef.current;
    if (!el) return;
    const applyBox = (w: number, h: number) => {
      setBox((prev) => {
        if (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5) return prev;
        return { w, h };
      });
    };
    // Initial measure: read layout once for first paint.
    const cs = getComputedStyle(el);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const rect = el.getBoundingClientRect();
    applyBox(rect.width - pl - pr, rect.height - pt - pb);
    // Subsequent updates come from contentRect (already excludes padding).
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        applyBox(cr.width, cr.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const GAP = 8;
  const RATIO = 146.07 / 104.33;
  const MIN_CARD_W = 64;
  const availW = Math.max(0, box.w);
  const availH = Math.max(0, box.h);
  const fromW = (availW - GAP * 2) / 3;
  const fromH = ((availH - GAP * 2) / 3) / RATIO;
  const rawCardW = Math.min(fromW, fromH);
  const cardW = Math.floor(Math.max(MIN_CARD_W, isFinite(rawCardW) && rawCardW > 0 ? rawCardW : MIN_CARD_W));

  const cardH = cardW * RATIO;
  const gridHeightNeeded = cardH * 3 + GAP * 2;
  const needsScroll = gridHeightNeeded > availH + 0.5;

  return (
    <div ref={rootRef} style={{
      display: "flex", flexDirection: "column", gap: 8,
      padding: 8, height: "100%", boxSizing: "border-box",
      background: SURFACE, overflow: "hidden", position: "relative",
    }}>
      <style>{HEADER_FOCUS_CSS}</style>
      {activeCommit && heroRects && (
        <RollHeroOverlay
          commit={activeCommit}
          homeRect={heroRects.home}
          targetRect={heroRects.target}
          parentRect={heroRects.parent}
          onComplete={() => { setActiveCommit(null); setHeroRects(null); }}
        />
      )}
      {/* ROLLING scrim — beneath the die overlay (z=30), above the play
          content. Pointer-events none so header controls stay reachable;
          the card grid and WHOOP button are blocked independently. */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: "rgba(35,31,32,0.6)",
          opacity: isRolling ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity 250ms ease",
          zIndex: 20,
        }}
      />
      {header}
      {opponentRow}

      {/* Card area — padding 8 (16 when overlay), measured card sizing */}
      <div
        ref={cardAreaRef}
        style={{
          position: "relative", background: PANEL, border: BORDER_HEAVY,
          borderRadius: R_BOX,
          padding: overlay ? 16 : 8,
          boxSizing: "border-box", flex: "1 1 0", minHeight: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflowY: needsScroll ? "auto" : "hidden",
          overflowX: "hidden",
          opacity: 1,
          pointerEvents: isRolling ? "none" : "auto",
          transition: "opacity 250ms ease",
        }}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(3, ${cardW}px)`,
          gridTemplateRows: `repeat(3, ${cardH}px)`,
          gap: GAP,
          margin: "auto",
        }}>
          {s.grid.map((slot, i) => {
            if (!slot.occupied) {
              return (
                <div key={`empty-${i}`} style={{
                  width: cardW, height: cardH,
                  border: `2px dashed rgba(35,31,32,0.13)`,
                  borderRadius: R_CARD, boxSizing: "border-box",
                }} />
              );
            }
            const faceUp = slot.card !== null;
            const cardForRender: Card =
              slot.card ??
              ({ id: `hidden-${i}`, shape: "circle", number: 1, color: "red", svgPath: "/cards/card-back.svg" } as Card);
            const selected = s.selectedCards.includes(i) || lastCallSel.includes(i);
            return (
              <div key={i} style={{
                width: cardW, height: cardH,
                borderRadius: R_CARD, filter: `drop-shadow(${CARD_SHADOW})`,
              }}>
                <GameCard
                  card={cardForRender}
                  faceUp={faceUp}
                  onClick={() => handleCardClick(i)}
                  highlighted={selected}
                  matched={s.matchedCards.includes(i)}
                  wrong={false}
                  wrongWash={false}
                  shaking={false}
                  fill
                />
              </div>
            );
          })}
        </div>
        {overlay && <GridOverlay kind={overlay} />}

        {import.meta.env.DEV && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              zIndex: 1000,
              background: "rgba(35,31,32,0.88)",
              color: "#F8F2E9",
              fontFamily: FONT_FAMILY,
              fontSize: 11,
              lineHeight: "14px",
              padding: "6px 8px",
              borderRadius: 4,
              maxWidth: 280,
              pointerEvents: "none",
              whiteSpace: "pre-wrap",
            }}
            aria-hidden="true"
          >
            {`contentRect: ${Math.round(box.w)}×${Math.round(box.h)}\ncard: ${cardW}×${cardH.toFixed(1)}\nfromW: ${fromW.toFixed(1)}\nfromH: ${fromH.toFixed(1)}\nminW: ${MIN_CARD_W} | scroll: ${needsScroll}\nseatCount: ${s.seatCount} | connected: ${s.seatMap.length - s.disconnectedSeats.length}/${s.seatMap.length}\nflipper: ${s.flipper ?? "-"} | roller: ${s.roller ?? "-"}\nlens scores:${s.scores.length} skip:${s.skip.length} wrongBy:${s.wrongBy.length} disc:${s.disconnectedSeats.length}\nskip:[${s.skip.map(b => b ? 1 : 0).join(",")}] scores:[${s.scores.join(",")}]`}
          </div>
        )}
      </div>

      {scoreRow}
      {bottomRow}
      {gameOverBtn}
      {showSettings && (
        <ModalShell titleId="mp-settings-title" onCancel={() => setShowSettings(false)}>
          <h2 id="mp-settings-title" style={{ margin: 0, fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: INK }}>
            Settings
          </h2>
          <p style={{ margin: 0, fontFamily: FONT_FAMILY, fontSize: 15, color: MUTED }}>
            Coming soon.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              style={{
                all: "unset", cursor: "pointer",
                padding: "8px 16px", background: INK, color: SURFACE,
                border: BORDER_HEAVY, borderRadius: R_BOX,
                fontFamily: FONT_FAMILY, fontSize: 16,
              }}
              aria-label="Close settings"
            >
              Close
            </button>
          </div>
        </ModalShell>
      )}
      {showLeave && (
        <ModalShell titleId="mp-leave-title" onCancel={() => setShowLeave(false)}>
          <h2 id="mp-leave-title" style={{ margin: 0, fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, color: INK }}>
            {isHost ? "End the game?" : "Leave the table?"}
          </h2>
          <p style={{ margin: 0, fontFamily: FONT_FAMILY, fontSize: 15, lineHeight: 1.4, color: INK }}>
            {isHost
              ? "Leaving now ends the game for everyone. All players will be returned to the lobby and the game cannot be resumed."
              : "Your seat and score stay visible to the table with your turns auto-skipped — you won't be removed."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setShowLeave(false)}
              style={{
                all: "unset", cursor: "pointer",
                padding: "8px 16px", background: SURFACE, color: INK,
                border: BORDER_HEAVY, borderRadius: R_BOX,
                fontFamily: FONT_FAMILY, fontSize: 16,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { setShowLeave(false); onLeave(); }}
              style={{
                all: "unset", cursor: "pointer",
                padding: "8px 16px", background: RED, color: SURFACE,
                border: BORDER_HEAVY, borderRadius: R_BOX,
                fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 700,
              }}
            >
              {isHost ? "End game" : "Leave"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
};


export default MultiplayerGameView;
