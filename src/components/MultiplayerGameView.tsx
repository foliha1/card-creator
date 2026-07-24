// ============================================================================
// MultiplayerGameView — a compact, functional rendering of a game round from
// PublicState. Used identically by host and joiner. Correctness over polish
// per prompt 8; the polished chip-row UI lands in prompt 10.
//
// Actions are dispatched via `onIntent` for both host (who validates via
// reducer guards locally) and joiner (who sends the intent over the wire).
// ============================================================================

import React from "react";
import GameCard from "@/components/GameCard";
import { AppButton } from "@/components/ui/AppButton";
import { COLORS, BORDER, RADIUS, SPACE, FONT_FAMILY, TEXT, textStyle } from "@/lib/tokens";
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
  // Arbiter context — the view calls the claim-lock function directly on WHOOP.
  roomId: string;
  visitorId: string;
}

const MultiplayerGameView: React.FC<Props> = ({ publicState: s, mySeat, events, onIntent, onLeave, mobile = false, roomId, visitorId }) => {
  void events; // Chip-row consumer wires this in a follow-up; keep the transient event surface here so the wire is verified.
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
  React.useEffect(() => {
    if (!inLastCall) setLastCallSel([]);
  }, [inLastCall]);
  // Clear TOO SLOW when the claim window rotates (a new opportunity opens).
  React.useEffect(() => {
    setTooSlowAt(null);
  }, [s.claimWindow]);

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

  React.useEffect(() => {
    if (!inClaimMode) return;
    if (s.selectedCards.length === 2 && mySeat !== null) {
      const t = setTimeout(() => {
        onIntent({ type: "PLAYER_RESOLVE_MATCH", by: mySeat });
      }, 800);
      return () => clearTimeout(t);
    }
  }, [inClaimMode, s.selectedCards.length, mySeat, onIntent]);

  const statusText = (() => {
    if (s.phase === "GAME_OVER") return s.message || "Game over";
    if (inLastCall) return "LAST CALL — grab every matching pair!";
    if (s.phase === "CLAIM_SELECTING") {
      const who = s.seatMap[s.claimBy ?? -1];
      return who ? `${who.display_name} is claiming — pick two cards` : "Claim in progress";
    }
    if (s.phase === "AWAITING_ROLL") {
      const who = s.seatMap[s.roller];
      return who ? `${who.display_name}'s roll` : "Rolling…";
    }
    if (s.phase === "FLIPPING") {
      const who = s.seatMap[s.flipper];
      return who ? `${who.display_name}'s flip` : "Flipping…";
    }
    return s.message ?? "";
  })();

  const renderScore = () => (
    <div style={{ display: "flex", gap: SPACE[3], flexWrap: "wrap" }}>
      {s.seatMap.map((e) => (
        <div
          key={e.seat}
          style={{
            background: COLORS.surface,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: `${SPACE[2]}px ${SPACE[4]}px`,
            fontFamily: FONT_FAMILY,
            fontSize: TEXT.caption.size,
            color: COLORS.ink,
            fontWeight: e.seat === mySeat ? 700 : 400,
            fontStyle: "italic",
          }}
        >
          {e.display_name}
          {e.seat === mySeat ? " (you)" : ""}: {s.scores[e.seat] ?? 0}
        </div>
      ))}
    </div>
  );

  const dieAttr = s.dieValues[0] ?? s.rule[0] ?? "SHAPE";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: SPACE[5],
      padding: mobile ? SPACE[5] : SPACE[8],
      height: "100%",
      boxSizing: "border-box",
      overflow: "auto",
    }}>
      {renderScore()}

      <div style={{ ...textStyle("body", mobile), color: COLORS.ink, fontStyle: "italic" }}>
        {statusText}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: SPACE[4] }}>
        <div style={{
          width: 68,
          height: 68,
          background: COLORS.surface,
          border: BORDER.heavy,
          borderRadius: RADIUS.md,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_FAMILY,
          color: COLORS.ink,
          opacity: s.rolling ? 0.5 : 1,
        }}>
          <span style={{ fontSize: TEXT.caption.mobileSize, fontStyle: "italic" }}>Match</span>
          <span style={{ fontSize: TEXT.subhead.mobileSize, fontWeight: 700 }}>{dieAttr}</span>
        </div>
        {isMyTurnToRoll && (
          <AppButton
            variant="primary"
            tone="red"
            size="md"
            onClick={() => onIntent({ type: "REQUEST_ROLL" })}
          >
            {s.roundNum === 1 ? "PLAY" : "ROLL"}
          </AppButton>
        )}
        {canClaim && !inClaimMode && !inLastCall && s.phase !== "GAME_OVER" && (
          <AppButton
            variant="primary"
            tone={tooSlowAt !== null ? "ink" : "red"}
            size="md"
            disabled={claimBusy}
            onClick={async () => {
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
              if (!result.won) {
                // Local-only signal. The arbiter's response IS the signal
                // — no broadcast, no event channel.
                setTooSlowAt(Date.now());
              }
              // If won: the host will dispatch PLAYER_ENTER_CLAIM on the
              // server-side claim_grant broadcast. We just wait for state.
            }}
          >
            {claimBusy ? "…" : tooSlowAt !== null ? "TOO SLOW!" : "WHOOP!"}
          </AppButton>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: SPACE[4],
      }}>
        {s.grid.map((slot, i) => {
          if (!slot.occupied) {
            return (
              <div
                key={`empty-${i}`}
                style={{
                  aspectRatio: "5/7",
                  border: `2px dashed rgba(35,31,32,0.13)`,
                  borderRadius: RADIUS.sm,
                }}
              />
            );
          }
          const faceUp = slot.card !== null;
          // Placeholder card for a face-down slot — never rendered face-up.
          const cardForRender: Card =
            slot.card ??
            ({ id: `hidden-${i}`, shape: "circle", number: 1, color: "red", svgPath: "/cards/card-back.svg" } as Card);
          const selected = s.selectedCards.includes(i) || lastCallSel.includes(i);
          return (
            <div
              key={i}
              style={{
                boxShadow: selected ? `0 0 0 3px ${COLORS.blue}` : undefined,
                borderRadius: RADIUS.md,
              }}
            >
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

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
        <AppButton variant="secondary" tone="ink" size="md" onClick={onLeave}>
          Leave
        </AppButton>
      </div>
    </div>
  );
};

export default MultiplayerGameView;
