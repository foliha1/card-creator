import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGameState } from "@/hooks/useGameState";
import GameCard from "@/components/GameCard";
import DieDisplay from "@/components/DieDisplay";
import { playFlip, playCorrect, playWrong, playDoubleMatch, playDiceRoll } from "@/lib/sounds";

interface GameWindowProps {
  mobile?: boolean;
}

const GameWindow: React.FC<GameWindowProps> = ({ mobile = false }) => {
  const [tier, setTier] = useState<"easy" | "standard" | "cutthroat">("standard");
  const [gridSize, setGridSize] = useState<"3x2" | "3x3">("3x2");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const pillStyle = (active: boolean, accentColor?: string): React.CSSProperties => ({
    fontFamily: '"Friend", serif',
    fontStyle: "italic",
    fontSize: 12,
    padding: "6px 12px",
    borderRadius: 999,
    border: active ? `2px solid ${accentColor || "#231f20"}` : "2px solid #231f20",
    background: active ? (accentColor || "#231f20") : "#f8f2e9",
    color: active ? "#f8f2e9" : "#231f20",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const TIERS = [
    { id: "easy" as const, label: "Easy Going", color: "#0072b2" },
    { id: "standard" as const, label: "Standard", color: "#e79024" },
    { id: "cutthroat" as const, label: "Cutthroat", color: "#d72229" },
  ];

  const GRIDS = [
    { id: "3x2" as const, label: "3×2" },
    { id: "3x3" as const, label: "3×3 Challenge" },
  ];

  if (!gameStarted) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 24,
        }}
      >
        <div style={{ fontFamily: '"Friend", serif', fontStyle: "italic", fontSize: 20, color: "#231f20", textAlign: "center", marginBottom: 24 }}>
          Choose Your Settings
        </div>

        {/* Difficulty */}
        <div style={{ width: "100%", maxWidth: 280 }}>
          <div style={{ fontSize: 11, color: "#231f20", opacity: 0.5, marginBottom: 6 }}>Difficulty</div>
          <div style={{ display: "flex", gap: 6 }}>
            {TIERS.map((t) => (
              <button key={t.id} style={pillStyle(tier === t.id, t.color)} onClick={() => setTier(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Size */}
        <div style={{ width: "100%", maxWidth: 280, marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#231f20", opacity: 0.5, marginBottom: 6 }}>Grid Size</div>
          <div style={{ display: "flex", gap: 6 }}>
            {GRIDS.map((g) => (
              <button key={g.id} style={pillStyle(gridSize === g.id)} onClick={() => setGridSize(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start */}
        <button
          onClick={() => setGameStarted(true)}
          style={{
            marginTop: 28,
            background: "#231f20",
            color: "#f8f2e9",
            fontFamily: '"Friend", serif',
            fontStyle: "italic",
            fontSize: 16,
            padding: "12px 32px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
            width: "100%",
            maxWidth: 240,
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <GamePlayArea
      key={gameKey}
      tier={tier}
      gridSize={gridSize}
      onNewGame={() => {
        setGameStarted(false);
        setGameKey((k) => k + 1);
      }}
      mobile={mobile}
    />
  );
};

interface GamePlayAreaProps {
  tier: "easy" | "standard" | "cutthroat";
  gridSize: "3x2" | "3x3";
  onNewGame: () => void;
  mobile?: boolean;
}

const GamePlayArea: React.FC<GamePlayAreaProps> = ({ tier, gridSize, onNewGame, mobile = false }) => {
  const g = useGameState(tier, gridSize);

  // --- Animation state (carried from old GameScreen) ---
  const [peekedCount, setPeekedCount] = useState(0);
  const [peekLocked, setPeekLocked] = useState(false);
  const peekUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shrinkingCards, setShrinkingCards] = useState<Set<number>>(new Set());
  const [enteringCards, setEnteringCards] = useState<Set<number>>(new Set());
  const [shakingCards, setShakingCards] = useState<Set<number>>(new Set());
  const [wrongFlashCards, setWrongFlashCards] = useState<Set<number>>(new Set());
  const [wrongWashCards, setWrongWashCards] = useState<Set<number>>(new Set());
  const [scoreBounce, setScoreBounce] = useState(false);
  const [showDoubleTitle, setShowDoubleTitle] = useState(false);
  const [doublePhase, setDoublePhase] = useState<"idle" | "title" | "shrink" | "pick" | "bonusShrink">("idle");
  const [orangePulseCards, setOrangePulseCards] = useState<Set<number>>(new Set());
  const [bonusHighlighted, setBonusHighlighted] = useState<Set<number>>(new Set());
  const [diceLanded, setDiceLanded] = useState(false);
  const [visibleMsg, setVisibleMsg] = useState("");
  const [visibleMsgType, setVisibleMsgType] = useState("info");
  const [msgVisible, setMsgVisible] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MSG_COLORS: Record<string, string> = {
    success: "#22c55e",
    error: "#d72229",
    info: "#0072b2",
    warning: "#e79024",
  };

  const prevScoreRef = useRef(g.score);
  const prevRoundRef = useRef(g.roundNum);
  const prevClaimRef = useRef(g.claimMode);
  const prevBonusRef = useRef(g.bonusPicking);
  const prevRoundForDice = useRef(g.roundNum);

  useEffect(() => {
    if (g.score !== prevScoreRef.current) {
      if (g.score > prevScoreRef.current) playCorrect();
      prevScoreRef.current = g.score;
      setScoreBounce(true);
      setTimeout(() => setScoreBounce(false), 300);
    }
  }, [g.score]);

  useEffect(() => {
    if (g.roundNum !== prevRoundRef.current) {
      prevRoundRef.current = g.roundNum;
      setPeekedCount(0);
      setPeekLocked(false);
      setWrongWashCards(new Set());
      setWrongFlashCards(new Set());
      const filledSlots = g.grid.map((c, i) => (c ? i : -1)).filter((i) => i !== -1);
      setEnteringCards(new Set(filledSlots));
      setTimeout(() => setEnteringCards(new Set()), 800);
      setShowDoubleTitle(false);
      setDoublePhase("idle");
      setOrangePulseCards(new Set());
      setBonusHighlighted(new Set());
    }
  }, [g.roundNum, g.grid]);

  useEffect(() => {
    if (prevClaimRef.current && !g.claimMode) setPeekedCount(0);
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

  useEffect(() => {
    if (g.bonusPicking && !prevBonusRef.current && g.matchedCards.size === 2) {
      playDoubleMatch();
      setDoublePhase("title");
      setShowDoubleTitle(true);
      setTimeout(() => {
        setDoublePhase("shrink");
        setShrinkingCards(new Set(g.matchedCards));
      }, 800);
      setTimeout(() => {
        setShrinkingCards(new Set());
        g.removeMatchedFromGrid();
        setDoublePhase("pick");
        const available = new Set<number>();
        g.grid.forEach((c, i) => {
          if (c && !g.matchedCards.has(i)) available.add(i);
        });
        setOrangePulseCards(available);
      }, 1400);
    }
    prevBonusRef.current = g.bonusPicking;
  }, [g.bonusPicking, g.matchedCards, g.grid, g.removeMatchedFromGrid]);

  useEffect(() => {
    if (g.bonusPicks.length > 0) setBonusHighlighted(new Set(g.bonusPicks));
  }, [g.bonusPicks]);

  useEffect(() => {
    if (g.selectedCards.length === 2 && g.claimMode) {
      const timer = setTimeout(() => g.resolveMatch(), 1000);
      return () => clearTimeout(timer);
    }
  }, [g.selectedCards.length, g.claimMode, g.resolveMatch]);

  useEffect(() => {
    if (g.roundNum !== prevRoundForDice.current) {
      prevRoundForDice.current = g.roundNum;
      playDiceRoll();
      setDiceLanded(false);
      g.doRollDice(g.roundNum).then(() => {
        setDiceLanded(true);
        setTimeout(() => setDiceLanded(false), 400);
      });
    }
  }, [g.roundNum]);

  const handleCardClick = useCallback(
    (index: number) => {
      if (g.gameOver || g.rolling) return;
      if (doublePhase === "pick" && g.bonusPicking) { g.pickBonus(index); return; }
      if (g.bonusPicking) return;
      if (g.claimMode) { g.selectCard(index); return; }
      if (peekLocked || g.grid[index] === null) return;
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

  const isSmall = mobile && window.innerWidth < 480;
  const cardW = isSmall ? 48 : 58;
  const cardH = isSmall ? 67 : 82;

  const totalCards = 48;
  const collected = totalCards - g.deck.length - g.grid.filter((c) => c !== null).length;

  if (g.gameOver) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 16,
          padding: 24,
          textAlign: "center",
          color: "#231f20",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, fontStyle: "italic", fontFamily: '"Friend", serif' }}>
          Game Over!
        </div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          You collected {collected} of {totalCards} cards
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: '"Friend", serif' }}>
          Score: {g.score}
        </div>
        <button
          onClick={onNewGame}
          style={{
            background: "#0072b2",
            color: "#f8f2e9",
            fontFamily: '"Friend", serif',
            fontStyle: "italic",
            fontSize: 16,
            padding: "10px 28px",
            borderRadius: 6,
            border: "2px solid #231f20",
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`
        @keyframes whoop-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes card-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
        @keyframes card-enter { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
        @keyframes score-bounce { 0%{transform:scale(1)} 40%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @keyframes card-shrink { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(0.5)} }
        @keyframes orange-pulse-border { 0%,100%{box-shadow:0 0 0 2px #e79024,0 0 8px rgba(231,144,36,0.3)} 50%{box-shadow:0 0 0 2px #e79024,0 0 16px rgba(231,144,36,0.6)} }
        @keyframes double-title-in { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes double-title-out { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(0.9)} }
        @keyframes pill-pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
      `}</style>

      {/* Double Match title */}
      {showDoubleTitle && (
        <div
          style={{
            textAlign: "center",
            padding: "6px 0",
            animation: doublePhase === "idle"
              ? "double-title-out 0.3s ease forwards"
              : "double-title-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <span style={{ color: "#e79024", fontSize: 20, fontWeight: 700, fontStyle: "italic", fontFamily: '"Friend", serif' }}>
            DOUBLE MATCH!
          </span>
        </div>
      )}

      {/* Message banner */}
      {visibleMsg && !showDoubleTitle && (
        <div style={{ textAlign: "center", padding: "4px 8px" }}>
          <span
            style={{
              display: "inline-block",
              background: MSG_COLORS[visibleMsgType] || MSG_COLORS.info,
              color: "#f8f2e9",
              fontSize: 12,
              fontWeight: 700,
              fontStyle: "italic",
              borderRadius: 6,
              padding: "4px 14px",
              transition: "opacity 0.3s",
              opacity: msgVisible ? 1 : 0,
            }}
          >
            {visibleMsg}
          </span>
        </div>
      )}

      {/* Bonus pick pill */}
      {doublePhase === "pick" && (
        <div style={{ textAlign: "center", padding: "2px 0" }}>
          <span
            style={{
              display: "inline-block",
              background: "#e79024",
              color: "#f8f2e9",
              fontSize: 11,
              fontWeight: 700,
              fontStyle: "italic",
              borderRadius: 999,
              padding: "3px 12px",
              animation: "pill-pulse 1.5s infinite",
            }}
          >
            Choose 2 bonus cards!
          </span>
        </div>
      )}

      {/* Claim mode instruction */}
      {g.claimMode && g.selectedCards.length < 2 && (
        <div style={{ textAlign: "center", padding: "4px 0", fontSize: 12, color: "#231f20", fontWeight: 700, fontStyle: "italic" }}>
          Tap 2 cards!
        </div>
      )}

      {/* Main area */}
      <div style={{
        display: "flex",
        flexDirection: mobile ? "column" : "row",
        gap: mobile ? 8 : 12,
        flex: 1,
        padding: 8,
        minHeight: 0,
      }}>
        {/* Dice / rule cards — horizontal row on mobile */}
        <div style={{
          width: mobile ? "100%" : 70,
          display: "flex",
          flexDirection: mobile ? "row" : "column",
          alignItems: "center",
          justifyContent: mobile ? "center" : undefined,
          gap: 6,
          flexShrink: 0,
        }}>
          {g.matchRule.map((attr, i) => (
            <div
              key={i}
              style={{
                width: cardW,
                height: cardH,
                background: "#f8f2e9",
                border: "2px solid #231f20",
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: mobile ? undefined : i === 0 ? "rotate(-5deg)" : "rotate(3deg)",
                color: "#231f20",
              }}
            >
              <span style={{ fontSize: 8, fontFamily: '"Friend", serif', fontStyle: "italic" }}>Match the</span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", fontFamily: '"Friend", serif' }}>{attr}</span>
            </div>
          ))}

          {/* Draw pile inline on mobile */}
          {mobile && (
            <span style={{ fontSize: 11, color: "#231f20", opacity: 0.5, marginLeft: 8 }}>
              {g.deck.length} left
            </span>
          )}
        </div>

        {/* Center: card grid */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: isSmall ? 6 : 8,
              width: "100%",
              maxWidth: mobile ? undefined : 300,
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
                    borderRadius: 6,
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
                    aspectRatio: "5/7",
                    borderRadius: 4,
                    border: "2px dashed rgba(35,31,32,0.13)",
                  }}
                />
              )
            )}
          </div>
        </div>

        {/* Right column: draw pile — desktop only */}
        {!mobile && (
          <div style={{ width: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", width: cardW + 6, height: cardH + 6 }}>
              {g.deck.length === 0 ? (
                <div style={{ width: cardW, height: cardH, borderRadius: 4, border: "2px dashed rgba(35,31,32,0.13)" }} />
              ) : (
                Array.from({ length: Math.min(4, Math.ceil(g.deck.length / 5)) }).map((_, i) => (
                  <img
                    key={i}
                    src="/cards/Card Back.svg"
                    alt="Draw pile"
                    style={{
                      position: "absolute",
                      top: i * 1.5,
                      left: i * 1.5,
                      width: cardW,
                      height: cardH,
                      borderRadius: 4,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  />
                ))
              )}
            </div>
            <span style={{ fontSize: 11, color: "#231f20", opacity: 0.5, textAlign: "center" }}>
              {g.deck.length} left
            </span>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 6,
          padding: "6px 8px",
          borderTop: "2px solid rgba(35,31,32,0.2)",
          alignItems: "center",
        }}
      >
        <button
          onClick={onNewGame}
          style={{
            background: "#0072b2",
            color: "#f8f2e9",
            fontFamily: '"Friend", serif',
            fontStyle: "italic",
            fontSize: 12,
            padding: "5px 12px",
            borderRadius: 4,
            border: "2px solid #231f20",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          New Game
        </button>

        {[`Score: ${g.score}`, `Round: ${g.roundNum}`, `Cards Left: ${g.deck.length}`].map((label) => (
          <div
            key={label}
            style={{
              background: "#f8f2e9",
              border: "2px solid #231f20",
              padding: "3px 8px",
              borderRadius: 4,
              fontFamily: '"Friend", serif',
              fontSize: 11,
              color: "#231f20",
              whiteSpace: "nowrap",
              ...(label.startsWith("Score") && scoreBounce
                ? { animation: "score-bounce 0.3s ease" }
                : {}),
            }}
          >
            {label}
          </div>
        ))}

        <button
          onClick={() => {
            if (whoopReady) {
              g.enterClaimMode();
            }
          }}
          style={{
            flex: 1,
            background: whoopReady ? "#d72229" : "#d7222966",
            color: "#f8f2e9",
            fontFamily: '"Friend", serif',
            fontStyle: "italic",
            fontSize: 16,
            borderRadius: 4,
            border: "2px solid #231f20",
            cursor: whoopReady ? "pointer" : "default",
            padding: "5px 8px",
            animation: whoopReady ? "whoop-pulse 1.5s infinite" : undefined,
          }}
        >
          WHOOP! WHOOP!
        </button>
      </div>
    </div>
  );
};

export default GameWindow;
