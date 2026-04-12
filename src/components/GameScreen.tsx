import { useEffect, useRef, useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import GameCard from "@/components/GameCard";
import DieDisplay from "@/components/DieDisplay";

interface GameScreenProps {
  tier: "easy" | "standard" | "cutthroat";
}

const MSG_COLORS: Record<string, string> = {
  success: "#22c55e",
  error: "#d72229",
  info: "#0072b2",
  warning: "#e79024",
};

const GameScreen = ({ tier }: GameScreenProps) => {
  const g = useGameState(tier);
  const [visibleMsg, setVisibleMsg] = useState("");
  const [visibleMsgType, setVisibleMsgType] = useState("info");
  const [msgVisible, setMsgVisible] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (g.message) {
      setVisibleMsg(g.message);
      setVisibleMsgType(g.messageType);
      setMsgVisible(true);
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setMsgVisible(false), 2500);
    }
  }, [g.message, g.messageType, g.roundNum, g.score]);

  const handleCardClick = (index: number) => {
    if (g.gameOver) return;
    if (g.bonusPicking) {
      g.pickBonus(index);
    } else if (g.claimMode) {
      g.selectCard(index);
    } else {
      g.peekCard(index);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f2e9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 64,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, padding: "0 16px" }}>
        {/* Dice bar */}
        <div
          style={{
            background: "#231f20",
            borderRadius: 12,
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {g.dieValues.map((v, i) => (
            <DieDisplay key={i} value={v} rolling={false} />
          ))}
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ color: "#f8f2e9", fontSize: 11, opacity: 0.5 }}>
              {g.isDouble ? "Double Match" : "Match"}
            </div>
            <div
              style={{
                color: "#f8f2e9",
                fontSize: 16,
                fontWeight: 700,
                fontStyle: "italic",
              }}
            >
              {g.matchRule.join(" + ")}
            </div>
          </div>
        </div>

        {/* Score row */}
        <div
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#231f20",
            opacity: 0.5,
            margin: "12px 0",
          }}
        >
          Score: {g.score} · Deck: {g.deck.length} · Round: {g.roundNum}
        </div>

        {/* Message banner */}
        <div style={{ height: 40, display: "flex", justifyContent: "center", marginBottom: 8 }}>
          {visibleMsg && (
            <div
              style={{
                background: MSG_COLORS[visibleMsgType] || MSG_COLORS.info,
                color: "#f8f2e9",
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 8,
                padding: "6px 18px",
                transition: "opacity 0.3s, transform 0.3s",
                opacity: msgVisible ? 1 : 0,
                transform: msgVisible ? "translateY(0)" : "translateY(-8px)",
              }}
            >
              {visibleMsg}
            </div>
          )}
        </div>

        {/* Card grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 110px)",
            gap: "clamp(8px, 2vw, 16px)",
            justifyContent: "center",
          }}
        >
          {g.grid.map((card, i) =>
            card ? (
              <GameCard
                key={card.id}
                card={card}
                faceUp={g.peekingCard === i || g.claimMode || g.bonusPicking}
                onClick={() => handleCardClick(i)}
                highlighted={g.selectedCards.includes(i) || g.bonusPicks.includes(i)}
                matched={g.matchedCards.has(i)}
              />
            ) : (
              <div
                key={`empty-${i}`}
                style={{
                  width: 110,
                  height: 154,
                  borderRadius: 8,
                  border: "2px dashed #231f2022",
                }}
              />
            )
          )}
        </div>

        {/* Instruction text */}
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "#231f20",
            opacity: 0.5,
            marginTop: 16,
          }}
        >
          {g.bonusPicking
            ? "Pick 2 bonus cards!"
            : g.claimMode
            ? "Tap 2 cards you think match!"
            : "Tap a card to peek · Then call WHOOP! WHOOP!"}
        </div>

        {/* Action buttons */}
        {!g.gameOver && !g.bonusPicking && (
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
            {!g.claimMode ? (
              <button
                onClick={g.enterClaimMode}
                style={{
                  background: "#231f20",
                  color: "#f8f2e9",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                WHOOP! WHOOP!
              </button>
            ) : (
              <button
                onClick={g.skipRound}
                style={{
                  background: "transparent",
                  color: "#231f20",
                  border: "2px solid #231f20",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: 0.6,
                }}
              >
                Skip Round
              </button>
            )}
          </div>
        )}

        {g.gameOver && (
          <div style={{ textAlign: "center", marginTop: 24, fontSize: 22, fontWeight: 800, color: "#231f20" }}>
            Game Over! Final Score: {g.score}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameScreen;
