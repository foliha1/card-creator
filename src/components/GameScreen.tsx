import { useEffect, useRef, useState, useCallback } from "react";
import { useGameState } from "@/hooks/useGameState";
import GameCard from "@/components/GameCard";
import DieDisplay from "@/components/DieDisplay";
import { playFlip, playCorrect, playWrong, playDoubleJeopardy, playDiceRoll } from "@/lib/sounds";

interface GameScreenProps {
  tier: "easy" | "standard" | "cutthroat";
  gridSize?: "3x2" | "3x3";
  onChangeTier?: (tier: string) => void;
  onChangeGridSize?: (size: string) => void;
  onGameOver?: (score: number) => void;
}

const MSG_COLORS: Record<string, string> = {
  success: "#22c55e",
  error: "#d72229",
  info: "#0072b2",
  warning: "#e79024",
};

const GameScreen = ({ tier, gridSize = "3x2", onChangeTier, onChangeGridSize, onGameOver }: GameScreenProps) => {
  const g = useGameState(tier, gridSize);

  const [visibleMsg, setVisibleMsg] = useState("");
  const [visibleMsgType, setVisibleMsgType] = useState("info");
  const [msgVisible, setMsgVisible] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Peek
  const [peekedCount, setPeekedCount] = useState(0);
  const [peekLocked, setPeekLocked] = useState(false);
  const peekUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Card animations
  const [shrinkingCards, setShrinkingCards] = useState<Set<number>>(new Set());
  const [enteringCards, setEnteringCards] = useState<Set<number>>(new Set());
  const [shakingCards, setShakingCards] = useState<Set<number>>(new Set());
  const [wrongFlashCards, setWrongFlashCards] = useState<Set<number>>(new Set());
  const [wrongWashCards, setWrongWashCards] = useState<Set<number>>(new Set());
  const [scoreBounce, setScoreBounce] = useState(false);

  // Double Jeopardy UI state
  const [showDoubleTitle, setShowDoubleTitle] = useState(false);
  const [doublePhase, setDoublePhase] = useState<"idle" | "title" | "shrink" | "pick" | "bonusShrink">("idle");
  const [orangePulseCards, setOrangePulseCards] = useState<Set<number>>(new Set());
  const [bonusHighlighted, setBonusHighlighted] = useState<Set<number>>(new Set());

  // Score bounce
  const prevScoreRef = useRef(g.score);
  useEffect(() => {
    if (g.score !== prevScoreRef.current) {
      if (g.score > prevScoreRef.current) playCorrect();
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
      // New cards entering after refill
      const filledSlots = g.grid.map((c, i) => (c ? i : -1)).filter((i) => i !== -1);
      setEnteringCards(new Set(filledSlots));
      setTimeout(() => setEnteringCards(new Set()), 800);
      // Reset double state
      setShowDoubleTitle(false);
      setDoublePhase("idle");
      setOrangePulseCards(new Set());
      setBonusHighlighted(new Set());
    }
  }, [g.roundNum, g.grid]);

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

  // Wrong guess animation
  useEffect(() => {
    if (g.wrongCards.size === 2) {
      playWrong();
      const indices = Array.from(g.wrongCards);
      setWrongFlashCards(new Set(indices));
      setShakingCards(new Set(indices));
      setTimeout(() => {
        setShakingCards(new Set());
        setWrongFlashCards(new Set());
        setWrongWashCards((prev) => new Set([...prev, ...indices]));
      }, 300);
    }
  }, [g.wrongCards]);

  // Double Jeopardy flow: triggered when bonusPicking becomes true
  const prevBonusRef = useRef(g.bonusPicking);
  useEffect(() => {
    if (g.bonusPicking && !prevBonusRef.current && g.matchedCards.size === 2) {
      playDoubleJeopardy();
      // Step 1: Show title
      setDoublePhase("title");
      setShowDoubleTitle(true);

      // Step 2: After 800ms, shrink matched cards
      setTimeout(() => {
        setDoublePhase("shrink");
        setShrinkingCards(new Set(g.matchedCards));
      }, 800);

      // Step 3: After shrink completes (900ms total from title), remove from grid and enter pick phase
      setTimeout(() => {
        setShrinkingCards(new Set());
        g.removeMatchedFromGrid();
        setDoublePhase("pick");
        // Calculate which cards are available for bonus picking
        const available = new Set<number>();
        g.grid.forEach((c, i) => {
          if (c && !g.matchedCards.has(i)) available.add(i);
        });
        setOrangePulseCards(available);
      }, 1400);
    }
    prevBonusRef.current = g.bonusPicking;
  }, [g.bonusPicking, g.matchedCards, g.grid, g.removeMatchedFromGrid]);

  // Track bonus picks for highlight
  useEffect(() => {
    if (g.bonusPicks.length > 0) {
      setBonusHighlighted(new Set(g.bonusPicks));
    }
  }, [g.bonusPicks]);

  // Auto-resolve match after 1000ms reveal window
  useEffect(() => {
    if (g.selectedCards.length === 2 && g.claimMode) {
      const timer = setTimeout(() => g.resolveMatch(), 1000);
      return () => clearTimeout(timer);
    }
  }, [g.selectedCards.length, g.claimMode, g.resolveMatch]);

  // Trigger animated dice roll on round change
  const [diceLanded, setDiceLanded] = useState(false);
  const prevRoundForDice = useRef(g.roundNum);
  useEffect(() => {
    if (g.roundNum !== prevRoundForDice.current) {
      prevRoundForDice.current = g.roundNum;
      playDiceRoll();
      setDiceLanded(false);
      // doRollDice is async — it sets rolling=true, cycles values, then resolves
      g.doRollDice(g.roundNum).then(() => {
        setDiceLanded(true);
        setTimeout(() => setDiceLanded(false), 400);
      });
    }
  }, [g.roundNum]);

  const handleCardClick = useCallback(
    (index: number) => {
      if (g.gameOver || g.rolling) return;

      // During double jeopardy pick phase
      if (doublePhase === "pick" && g.bonusPicking) {
        g.pickBonus(index);
        return;
      }

      if (g.bonusPicking) return; // block during other double phases

      if (g.claimMode) {
        g.selectCard(index);
        return;
      }

      // Peek mode
      if (peekLocked) return;
      if (g.grid[index] === null) return;

      setPeekLocked(true);
      setPeekedCount((c) => c + 1);
      playFlip();
      g.peekCard(index);

      if (peekUnlockTimer.current) clearTimeout(peekUnlockTimer.current);
      peekUnlockTimer.current = setTimeout(() => setPeekLocked(false), 1100);
    },
    [g, peekLocked, doublePhase]
  );

  const whoopReady = peekedCount >= 2 && !g.claimMode && !g.bonusPicking && !g.gameOver && !g.rolling;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f2e9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 72,
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
        @keyframes card-shrink {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.5); }
        }
        @keyframes double-title-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes double-title-out {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.9); }
        }
        @keyframes orange-pulse-border {
          0%, 100% { box-shadow: 0 0 0 2px #e79024, 0 0 8px rgba(231,144,36,0.3); }
          50% { box-shadow: 0 0 0 2px #e79024, 0 0 16px rgba(231,144,36,0.6); }
        }
        @keyframes pill-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: 560, padding: "0 16px" }}>
        {/* Dice bar */}
        <div
          style={{
            background: "#231f20",
            borderRadius: 14,
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {g.dieValues.map((v, i) => (
            <DieDisplay key={i} value={v} rolling={g.rolling} landed={diceLanded} />
          ))}
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ color: "#f8f2e9", fontSize: 14, opacity: 0.5, fontStyle: "italic" }}>
              {g.isDouble ? "Double Match" : "Match"}
            </div>
            <div style={{ color: "#f8f2e9", fontSize: 22, fontWeight: 700, fontStyle: "italic" }}>
              {g.matchRule.join(" + ")}
            </div>
          </div>
        </div>

        {/* Settings bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            margin: "10px 0 4px",
          }}
        >
          {/* Difficulty toggle */}
          <div style={{ display: "flex", gap: 0 }}>
            {(["easy", "standard", "cutthroat"] as const).map((t) => {
              const active = t === tier;
              return (
                <button
                  key={t}
                  onClick={() => onChangeTier?.(t)}
                  style={{
                    background: active ? TIER_COLORS[t] : "transparent",
                    color: active ? "#f8f2e9" : "rgba(35,31,32,0.4)",
                    border: "none",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    fontStyle: "italic",
                    cursor: "pointer",
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Grid size toggle */}
          <div style={{ display: "flex", gap: 0 }}>
            {(["3x2", "3x3"] as const).map((s) => {
              const active = s === gridSize;
              return (
                <button
                  key={s}
                  onClick={() => onChangeGridSize?.(s)}
                  style={{
                    background: active ? "#231f20" : "transparent",
                    color: active ? "#f8f2e9" : "rgba(35,31,32,0.4)",
                    border: "none",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    fontStyle: "italic",
                    cursor: "pointer",
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  {s === "3x2" ? "3×2" : "⚡ 3×3"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Score row */}
        <div style={{ textAlign: "center", fontSize: 18, color: "#231f20", opacity: 0.5, margin: "4px 0 12px" }}>
          <span
            style={{
              display: "inline-block",
              animation: scoreBounce ? "score-bounce 0.3s ease" : "none",
            }}
          >
            Score: {g.score}
          </span>
          {" · Round: "}{g.roundNum}
        </div>

        {/* Double Jeopardy title */}
        {showDoubleTitle && (
          <div
            style={{
              textAlign: "center",
              marginBottom: 12,
              animation: doublePhase === "idle"
                ? "double-title-out 0.3s ease forwards"
                : "double-title-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <span style={{ color: "#e79024", fontSize: 30, fontWeight: 700, fontStyle: "italic" }}>
              DOUBLE JEOPARDY!
            </span>
          </div>
        )}

        {/* Message banner */}
        <div style={{ height: 40, display: "flex", justifyContent: "center", marginBottom: 8 }}>
          {visibleMsg && !showDoubleTitle && (
            <div
              style={{
                background: MSG_COLORS[visibleMsgType] || MSG_COLORS.info,
                color: "#f8f2e9",
                fontSize: 18,
                fontWeight: 700,
                fontStyle: "italic",
                borderRadius: 8,
                padding: "8px 22px",
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
            gridTemplateColumns: "repeat(3, 160px)",
            gap: "clamp(8px, 2vw, 16px)",
            justifyContent: "center",
          }}
        >
          {g.grid.map((card, i) =>
            card ? (
              <div
                key={card.id}
                style={{
                  animation: shrinkingCards.has(i)
                    ? "card-shrink 0.4s ease forwards"
                    : enteringCards.has(i)
                    ? `card-enter 0.3s ease ${(i % 3) * 100}ms both`
                    : shakingCards.has(i)
                    ? "card-shake 0.2s ease"
                    : undefined,
                  borderRadius: 10,
                  ...(orangePulseCards.has(i) && doublePhase === "pick" && !bonusHighlighted.has(i)
                    ? { animation: "orange-pulse-border 1.5s infinite" }
                    : {}),
                  ...(bonusHighlighted.has(i)
                    ? { boxShadow: "0 0 0 3px #e79024, 0 0 16px rgba(231,144,36,0.6)" }
                    : {}),
                }}
              >
                <GameCard
                  card={card}
                  faceUp={
                    g.peekingCard === i ||
                    (g.claimMode && g.selectedCards.includes(i)) ||
                    doublePhase === "pick" ||
                    doublePhase === "shrink" ||
                    wrongWashCards.has(i) ||
                    wrongFlashCards.has(i)
                  }
                  onClick={() => handleCardClick(i)}
                  highlighted={g.selectedCards.includes(i) || bonusHighlighted.has(i)}
                  matched={g.matchedCards.has(i) || shrinkingCards.has(i)}
                  wrong={wrongFlashCards.has(i)}
                  wrongWash={wrongWashCards.has(i)}
                  shaking={shakingCards.has(i)}
                />
              </div>
            ) : (
              <div
                key={`empty-${i}`}
                style={{
                  width: 160,
                  height: 224,
                  borderRadius: 8,
                  border: "2px dashed #231f2022",
                  animation: enteringCards.has(i) ? `card-enter 0.3s ease ${(i % 3) * 100}ms both` : undefined,
                }}
              />
            )
          )}
        </div>

        {/* Instruction text / bonus pill */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          {doublePhase === "pick" ? (
            <span
              style={{
                display: "inline-block",
                background: "#e79024",
                color: "#f8f2e9",
                fontSize: 14,
                fontWeight: 700,
                fontStyle: "italic",
                borderRadius: 999,
                padding: "6px 18px",
                animation: "pill-pulse 1.5s infinite",
              }}
            >
              Choose 2 bonus cards from the grid!
            </span>
          ) : (
            <span style={{ fontSize: 16, color: "#231f20", opacity: 0.5 }}>
              {g.bonusPicking
                ? "Pick 2 bonus cards!"
                : g.claimMode
                ? "Tap 2 cards you think match!"
                : "Tap a card to peek · Then call WHOOP! WHOOP!"}
            </span>
          )}
        </div>

        {/* Action buttons */}
        {!g.gameOver && !g.bonusPicking && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginTop: 16,
            }}
          >
            <button
              onClick={() => whoopReady && g.enterClaimMode()}
              style={{
                background: "#d72229",
                color: "#f8f2e9",
                border: "none",
                borderRadius: 999,
                padding: 20,
                fontSize: 28,
                fontWeight: 700,
                fontStyle: "italic",
                width: "100%",
                maxWidth: 440,
                cursor: whoopReady ? "pointer" : "default",
                opacity: g.claimMode ? 1 : whoopReady ? 1 : 0.4,
                pointerEvents: g.claimMode ? "none" : whoopReady ? "auto" : "none",
                animation: whoopReady && !g.claimMode ? "whoop-pulse 2s infinite" : "none",
                boxShadow: g.claimMode ? "0 0 24px rgba(215,34,41,0.7)" : "none",
              }}
            >
              WHOOP! WHOOP!
            </button>
          </div>
        )}

        {g.gameOver && onGameOver && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button
              onClick={() => onGameOver(g.score)}
              style={{
                background: "#231f20",
                color: "#f8f2e9",
                fontStyle: "italic",
                fontSize: 18,
                fontWeight: 700,
                border: "none",
                borderRadius: 10,
                padding: "14px 36px",
                cursor: "pointer",
              }}
            >
              See Results →
            </button>
          </div>
        )}
        {g.gameOver && !onGameOver && (
          <div style={{ textAlign: "center", marginTop: 24, fontSize: 22, fontWeight: 800, fontStyle: "italic", color: "#231f20" }}>
            Game Over! Final Score: {g.score}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameScreen;
