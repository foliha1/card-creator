import { useEffect, useRef, useState, useCallback } from "react";
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

  const [peekedCount, setPeekedCount] = useState(0);
  const [peekLocked, setPeekLocked] = useState(false);
  const peekUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation states
  const [shrinkingCards, setShrinkingCards] = useState<Set<number>>(new Set());
  const [enteringCards, setEnteringCards] = useState<Set<number>>(new Set());
  const [shakingCards, setShakingCards] = useState<Set<number>>(new Set());
  const [wrongFlashCards, setWrongFlashCards] = useState<Set<number>>(new Set());
  const [wrongWashCards, setWrongWashCards] = useState<Set<number>>(new Set());
  const [scoreBounce, setScoreBounce] = useState(false);
  const [diceHidden, setDiceHidden] = useState(false);
  const [processingMatch, setProcessingMatch] = useState(false);

  // Score bounce
  const prevScoreRef = useRef(g.score);
  useEffect(() => {
    if (g.score !== prevScoreRef.current) {
      prevScoreRef.current = g.score;
      setScoreBounce(true);
      setTimeout(() => setScoreBounce(false), 300);
    }
  }, [g.score]);

  // Reset peekedCount on round change
  const prevRoundRef = useRef(g.roundNum);
  useEffect(() => {
    if (g.roundNum !== prevRoundRef.current) {
      prevRoundRef.current = g.roundNum;
      setPeekedCount(0);
      setPeekLocked(false);
      setWrongWashCards(new Set());
      setWrongFlashCards(new Set());
    }
  }, [g.roundNum]);

  // Reset peekedCount when claimMode exits
  const prevClaimRef = useRef(g.claimMode);
  useEffect(() => {
    if (prevClaimRef.current && !g.claimMode) {
      setPeekedCount(0);
    }
    prevClaimRef.current = g.claimMode;
  }, [g.claimMode]);

  // Message animation
  useEffect(() => {
    if (g.message) {
      setVisibleMsg(g.message);
      setVisibleMsgType(g.messageType);
      setMsgVisible(true);
      if (msgTimer.current) clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setMsgVisible(false), 2500);
    }
  }, [g.message, g.messageType, g.roundNum, g.score]);

  // Intercept wrong guess from hook
  useEffect(() => {
    if (g.wrongCards.size === 2 && !processingMatch) {
      const indices = Array.from(g.wrongCards);
      // Flash + shake
      setWrongFlashCards(new Set(indices));
      setShakingCards(new Set(indices));
      setTimeout(() => {
        setShakingCards(new Set());
        setWrongFlashCards(new Set());
        // Leave wash
        setWrongWashCards((prev) => new Set([...prev, ...indices]));
      }, 300);
    }
  }, [g.wrongCards, processingMatch]);

  const handleCardClick = useCallback(
    (index: number) => {
      if (g.gameOver || processingMatch) return;

      if (g.bonusPicking) {
        g.pickBonus(index);
        return;
      }

      if (g.claimMode) {
        g.selectCard(index);
        return;
      }

      // Peek mode
      if (peekLocked) return;
      if (g.grid[index] === null) return;

      setPeekLocked(true);
      setPeekedCount((c) => c + 1);
      g.peekCard(index);

      if (peekUnlockTimer.current) clearTimeout(peekUnlockTimer.current);
      peekUnlockTimer.current = setTimeout(() => setPeekLocked(false), 2100);
    },
    [g, peekLocked, processingMatch]
  );

  // Watch for correct match (matchedCards populated) to run animation sequence
  useEffect(() => {
    if (g.matchedCards.size === 2 && !g.bonusPicking) {
      // This means a correct single match just resolved in the hook
      // The hook already updated grid/deck/round, so we animate the entering cards
      const indices = Array.from(g.matchedCards);
      setEnteringCards(new Set(indices));
      setTimeout(() => setEnteringCards(new Set()), 600);
    }
  }, [g.matchedCards, g.bonusPicking, g.roundNum]);

  const whoopReady = peekedCount >= 2 && !g.claimMode && !g.bonusPicking && !g.gameOver;

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
      <style>{`
        @keyframes whoop-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes card-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes card-enter {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes score-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>

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
            <DieDisplay key={i} value={v} rolling={diceHidden} />
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
          <span
            style={{
              display: "inline-block",
              animation: scoreBounce ? "score-bounce 0.3s ease" : "none",
            }}
          >
            Score: {g.score}
          </span>
          {" · Deck: "}{g.deck.length}{" · Round: "}{g.roundNum}
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
              <div
                key={card.id}
                style={{
                  animation: enteringCards.has(i) ? `card-enter 0.3s ease ${(i % 3) * 100}ms both` : undefined,
                }}
              >
                <GameCard
                  card={card}
                  faceUp={
                    g.peekingCard === i ||
                    (g.claimMode && g.selectedCards.includes(i)) ||
                    g.bonusPicking ||
                    wrongWashCards.has(i) ||
                    wrongFlashCards.has(i)
                  }
                  onClick={() => handleCardClick(i)}
                  highlighted={g.selectedCards.includes(i) || g.bonusPicks.includes(i)}
                  matched={g.matchedCards.has(i)}
                  wrong={wrongFlashCards.has(i)}
                  wrongWash={wrongWashCards.has(i)}
                  shaking={shakingCards.has(i)}
                />
              </div>
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
        {!g.gameOver && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginTop: 16,
            }}
          >
            {!g.bonusPicking && (
              <button
                onClick={() => whoopReady && g.enterClaimMode()}
                style={{
                  background: "#d72229",
                  color: "#f8f2e9",
                  border: "none",
                  borderRadius: 999,
                  padding: 14,
                  fontSize: 20,
                  fontWeight: 700,
                  fontStyle: "italic",
                  width: "100%",
                  maxWidth: 320,
                  cursor: whoopReady ? "pointer" : "default",
                  opacity: g.claimMode ? 1 : whoopReady ? 1 : 0.4,
                  pointerEvents: g.claimMode ? "none" : whoopReady ? "auto" : "none",
                  animation: whoopReady && !g.claimMode ? "whoop-pulse 2s infinite" : "none",
                  boxShadow: g.claimMode ? "0 0 24px rgba(215,34,41,0.7)" : "none",
                }}
              >
                WHOOP! WHOOP!
              </button>
            )}

            {!g.claimMode && !g.bonusPicking && (
              <button
                onClick={g.skipRound}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#231f20",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  padding: 0,
                }}
              >
                Skip Round →
              </button>
            )}
          </div>
        )}

        {g.gameOver && (
          <div
            style={{
              textAlign: "center",
              marginTop: 24,
              fontSize: 22,
              fontWeight: 800,
              color: "#231f20",
            }}
          >
            Game Over! Final Score: {g.score}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameScreen;
