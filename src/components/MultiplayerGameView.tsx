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
import GameCard from "@/components/GameCard";
import { COLORS, FONT_FAMILY } from "@/lib/tokens";
import type { PublicState } from "@/lib/publicState";
import type { IntentAction, TransientEvent } from "@/lib/multiplayer";
import type { Card } from "@/cardData";
import { callClaimLock } from "@/lib/claimLock";

interface Props {
  publicState: PublicState;
  mySeat: number | null; // null = spectator
  events?: TransientEvent[];
  onIntent: (a: IntentAction) => void;
  onLeave: () => void;
  mobile?: boolean;
  roomId: string;
  visitorId: string;
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
    else if (s.phase === "AWAITING_ROLL" && s.roller === seat) kind = "ROLLING";
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

const RoundBar: React.FC<{ round: number }> = ({ round }) => (
  <div style={{
    height: 40, background: INK, border: BORDER_HEAVY, borderRadius: R_BOX,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxSizing: "border-box",
  }}>
    <span style={{ fontFamily: FONT_FAMILY, fontSize: 20, lineHeight: "24px", color: SURFACE }}>
      Round: {round}
    </span>
  </div>
);

type BannerKind = "YOUR_FLIP" | "TOO_SLOW" | "PENALTY" | "CANCEL" | null;

const BannerStyles: Record<Exclude<BannerKind, null>, { bg: string; text: string; label: string; icon?: boolean }> = {
  YOUR_FLIP: { bg: BLUE,    text: SURFACE, label: "YOUR FLIP!" },
  TOO_SLOW:  { bg: INK,     text: SURFACE, label: "TOO SLOW!" },
  PENALTY:   { bg: MUTED,   text: SURFACE, label: "PENALTY" },
  CANCEL:    { bg: SURFACE, text: RED,     label: "Cancel Match Selection", icon: true },
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
  DISABLED:     { bg: PANEL,  text: MUTED,   label: "…" },
};

const DieBox: React.FC<{ rule: string }> = ({ rule }) => (
  <div style={{
    width: 111.07, height: 110.94, background: ORANGE,
    border: BORDER_HEAVY, borderRadius: R_BOX, padding: 8, gap: 16,
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", boxSizing: "border-box", flex: "0 0 auto",
  }}>
    <div style={{
      width: 89.42, height: 89.42, background: SURFACE, borderRadius: 8,
      transform: "rotate(-3.65deg)", boxShadow: CARD_SHADOW,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 4, boxSizing: "border-box",
    }}>
      <span style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: INK, fontStyle: "italic" }}>
        Match the
      </span>
      <span style={{ fontFamily: FONT_FAMILY, fontSize: 20, color: INK, fontWeight: 700 }}>
        {rule}
      </span>
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
  publicState: s, mySeat, events = [], onIntent, onLeave, mobile: _mobile = false, roomId, visitorId,
}) => {
  void _mobile;
  const isMyTurnToRoll = mySeat !== null && s.roller === mySeat && s.phase === "AWAITING_ROLL" && !s.rolling;
  const isMyTurnToFlip = mySeat !== null && s.flipper === mySeat && s.phase === "FLIPPING" && s.peekingCard === null;
  const canClaim =
    mySeat !== null &&
    (s.phase === "FLIPPING" || s.phase === "AWAITING_ROLL") &&
    s.claimBy === null;
  const inClaimMode = s.phase === "CLAIM_SELECTING" && s.claimBy === mySeat;
  const inLastCall = s.phase === "LAST_CALL";
  const [lastCallSel, setLastCallSel] = React.useState<number[]>([]);
  const [claimBusy, setClaimBusy] = React.useState(false);
  const [tooSlowAt, setTooSlowAt] = React.useState<number | null>(null);
  React.useEffect(() => { if (!inLastCall) setLastCallSel([]); }, [inLastCall]);
  // Clear TOO SLOW when the claim window rotates (a new opportunity opens).
  React.useEffect(() => { setTooSlowAt(null); }, [s.claimWindow]);
  // Auto-clear TOO SLOW after a short interval so the banner doesn't stick.
  React.useEffect(() => {
    if (tooSlowAt === null) return;
    const t = setTimeout(() => setTooSlowAt(null), 1400);
    return () => clearTimeout(t);
  }, [tooSlowAt]);

  // Detect self outcome events (last ~1.4s) for the grid overlay.
  const myGreat = mySeat !== null && events.some((e) => e.kind === "GREAT_MATCH" && e.seat === mySeat);
  const myNope = mySeat !== null && events.some((e) => e.kind === "NOPE" && e.seat === mySeat);
  const overlay: "GREAT_MATCH" | "NOPE" | null = myGreat ? "GREAT_MATCH" : myNope ? "NOPE" : null;

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
  const firstTouched = inClaimMode && s.selectedCards.length >= 1;
  const canCancelClaim = inClaimMode && s.selectedCards.length === 0;
  if (canCancelClaim) banner = "CANCEL";
  else if (mySeat !== null && s.skip[mySeat] && s.phase === "FLIPPING" && s.flipper === mySeat) banner = "PENALTY";
  else if (tooSlowAt !== null) banner = "TOO_SLOW";
  else if (isMyTurnToFlip) banner = "YOUR_FLIP";

  // Button state.
  let buttonKind: ButtonKind = "DISABLED";
  let buttonOnClick: (() => void) | undefined;
  let buttonLabel: string | undefined;
  if (inClaimMode) {
    // Whether the second touch has locked in (button becomes a passive label).
    buttonKind = "SELECT_MATCH";
    if (firstTouched) {
      // No cancel; buttons become passive per rulebook — no take-backs.
      buttonOnClick = undefined;
    }
  } else if (isMyTurnToRoll) {
    buttonKind = "YOUR_ROLL";
    buttonOnClick = () => onIntent({ type: "REQUEST_ROLL" });
    buttonLabel = s.roundNum === 1 ? "PLAY!" : "YOUR ROLL!";
  } else if (canClaim && !inLastCall && s.phase !== "GAME_OVER") {
    buttonKind = "WHOOP";
    buttonOnClick = async () => {
      if (mySeat === null || claimBusy) return;
      setClaimBusy(true);
      const result = await callClaimLock({
        room_id: roomId,
        game_id: s.gameId,
        claim_window: s.claimWindow,
        player_seat: mySeat,
        visitor_id: visitorId,
      });
      setClaimBusy(false);
      if (!result.won) setTooSlowAt(Date.now());
    };
    if (claimBusy) buttonLabel = "…";
  } else if (inLastCall && mySeat !== null) {
    buttonKind = "WHOOP";
    buttonLabel = "LAST CALL!";
    buttonOnClick = undefined;
  }

  const chips = chipsForOpponents(s, mySeat, events);
  const myScore = mySeat !== null ? (s.scores[mySeat] ?? 0) : 0;
  const rule = s.rule[0] ?? "SHAPE";

  const cardAreaPadding = overlay ? 16 : `0px 16px`;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
      padding: 8, height: "100%", boxSizing: "border-box",
      background: SURFACE, overflow: "hidden",
    }}>
      <RoundBar round={s.roundNum} />
      <OpponentRow chips={chips} />

      {/* Card area */}
      <div style={{
        position: "relative", background: PANEL, border: BORDER_HEAVY,
        borderRadius: R_BOX,
        padding: typeof cardAreaPadding === "string" ? cardAreaPadding : cardAreaPadding,
        paddingTop: overlay ? 16 : 12, paddingBottom: overlay ? 16 : 12,
        boxSizing: "border-box", flex: "1 1 auto", minHeight: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
          width: "100%", maxHeight: "100%",
        }}>
          {s.grid.map((slot, i) => {
            if (!slot.occupied) {
              return (
                <div key={`empty-${i}`} style={{
                  aspectRatio: "104.33 / 146.07",
                  border: `2px dashed rgba(35,31,32,0.13)`,
                  borderRadius: R_CARD,
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
                />
              </div>
            );
          })}
        </div>
        {overlay && <GridOverlay kind={overlay} />}
      </div>

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

      <div style={{ display: "flex", gap: 8, height: 110.94 }}>
        <DieBox rule={rule} />
        <ActionButton
          kind={buttonKind}
          disabled={buttonKind === "DISABLED" || (!buttonOnClick && buttonKind !== "SELECT_MATCH" && buttonKind !== "WHOOP")}
          onClick={buttonOnClick}
          label={buttonLabel}
        />
      </div>

      {s.phase === "GAME_OVER" && (
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
      )}
    </div>
  );
};

export default MultiplayerGameView;
