import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGameState } from "@/hooks/useGameState";
import GameCard from "@/components/GameCard";
import DieDisplay from "@/components/DieDisplay";
import { playFlip, playCorrect, playWrong, playDoubleMatch, playDiceRoll } from "@/lib/sounds";
import { ALL_CARDS } from "@/cardData";
import { COLORS, BORDER, RADIUS, MOTION, FONT_FAMILY, SPACE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";

interface GameWindowProps {
  mobile?: boolean;
}

const TIER_TONE_MAP: Record<string, "blue" | "orange" | "red"> = {
  [COLORS.blue]: "blue",
  [COLORS.orange]: "orange",
  [COLORS.red]: "red",
};

const GameWindow: React.FC<GameWindowProps> = ({ mobile = false }) => {
  const [tier, setTier] = useState<"easy" | "standard" | "cutthroat">("standard");
  const [gridSize, setGridSize] = useState<"3x2" | "3x3">("3x2");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const TIERS = [
    { id: "easy" as const, label: "Easy Going", color: COLORS.blue },
    { id: "standard" as const, label: "Standard", color: COLORS.orange },
    { id: "cutthroat" as const, label: "Cutthroat", color: COLORS.red },
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
          padding: SPACE[12],
        }}
      >
        <div style={{ fontFamily: FONT_FAMILY, fontStyle: "italic", fontSize: 20, color: COLORS.ink, textAlign: "center", marginBottom: SPACE[12] }}>
          Choose Your Settings
        </div>

        {/* Difficulty */}
        <div style={{ width: "100%", maxWidth: 280 }}>
          <div style={{ fontSize: 11, color: COLORS.ink, opacity: 0.5, marginBottom: SPACE[3] }}>Difficulty</div>
          <div style={{ display: "flex", gap: SPACE[3] }}>
            {TIERS.map((t) => (
              <AppButton
                key={t.id}
                variant="pill"
                size="sm"
                active={tier === t.id}
                tone={tier === t.id ? TIER_TONE_MAP[t.color] : "neutral"}
                onClick={() => setTier(t.id)}
              >
                {t.label}
              </AppButton>
            ))}
          </div>
        </div>

        {/* Grid Size */}
        <div style={{ width: "100%", maxWidth: 280, marginTop: SPACE[8] }}>
          <div style={{ fontSize: 11, color: COLORS.ink, opacity: 0.5, marginBottom: SPACE[3] }}>Grid Size</div>
          <div style={{ display: "flex", gap: SPACE[3] }}>
            {GRIDS.map((g) => (
              <AppButton
                key={g.id}
                variant="pill"
                size="sm"
                active={gridSize === g.id}
                tone="neutral"
                onClick={() => setGridSize(g.id)}
              >
                {g.label}
              </AppButton>
            ))}
          </div>
        </div>

        {/* Start */}
        <AppButton
          variant="primary"
          tone="ink"
          size="md"
          fullWidth
          onClick={() => setGameStarted(true)}
          style={{ marginTop: SPACE[14], maxWidth: 240 }}
        >
          Start Game
        </AppButton>

        {/* Preload all card images while user picks settings */}
        <div style={{ display: "none" }}>
          {ALL_CARDS.map((c) => (
            <img key={c.id} src={c.svgPath} alt="" width={0} height={0} />
          ))}
        </div>
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

  // --- Animation state ---
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
    success: COLORS.success,
    error: COLORS.red,
    info: COLORS.blue,
    warning: COLORS.orange,
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
  const cardW = isSmall ? 48 : 72;
  const cardH = isSmall ? 67 : 101;

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
          gap: SPACE[8],
          padding: SPACE[12],
          textAlign: "center",
          color: COLORS.ink,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, fontStyle: "italic", fontFamily: FONT_FAMILY }}>
          Game Over!
        </div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          You collected {collected} of {totalCards} cards
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FONT_FAMILY }}>
          Score: {g.score}
        </div>
        <AppButton
          variant="primary"
          tone="blue"
          size="md"
          onClick={onNewGame}
          style={{ marginTop: SPACE[4] }}
        >
          Play Again
        </AppButton>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Double Match title */}
      {showDoubleTitle && (
        <div
          style={{
            textAlign: "center",
            padding: `${SPACE[3]}px 0`,
            animation: doublePhase === "idle"
              ? "double-title-out 0.3s ease forwards"
              : "double-title-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <span style={{ color: COLORS.orange, fontSize: 20, fontWeight: 700, fontStyle: "italic", fontFamily: FONT_FAMILY }}>
            DOUBLE MATCH!
          </span>
        </div>
      )}

      {/* Message banner */}
      {visibleMsg && !showDoubleTitle && (
        <div style={{ textAlign: "center", padding: `${SPACE[2]}px ${SPACE[4]}px` }}>
          <span
            style={{
              display: "inline-block",
              background: MSG_COLORS[visibleMsgType] || MSG_COLORS.info,
              color: COLORS.surface,
              fontSize: 12,
              fontWeight: 700,
              fontStyle: "italic",
              borderRadius: RADIUS.md,
              padding: `${SPACE[2]}px ${SPACE[7]}px`,
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
        <div style={{ textAlign: "center", padding: `${SPACE[1]}px 0` }}>
          <span
            style={{
              display: "inline-block",
              background: COLORS.orange,
              color: COLORS.surface,
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
        <div style={{ textAlign: "center", padding: `${SPACE[2]}px 0`, fontSize: 12, color: COLORS.ink, fontWeight: 700, fontStyle: "italic" }}>
          Tap 2 cards!
        </div>
      )}

      {/* Main area */}
      <div style={{
        display: "flex",
        flexDirection: mobile ? "column" : "row",
        gap: mobile ? SPACE[4] : (typeof window !== 'undefined' && !mobile && window.innerWidth < 1100) ? SPACE[10] : 38,
        flex: 1,
        padding: mobile ? SPACE[6] : (typeof window !== 'undefined' && !mobile && window.innerWidth < 1100) ? "24px 16px" : "50px 40px",
        minHeight: 0,
        alignItems: "center",
        justifyContent: "center",
      }}>
        {/* Dice / rule cards */}
        <div style={{
          display: "flex",
          flexDirection: mobile ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: mobile ? SPACE[4] : SPACE[6],
          flexShrink: 0,
          ...(mobile ? {} : {
            background: COLORS.panelMuted,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: SPACE[8],
          }),
        }}>
          {g.matchRule.map((attr, i) => (
            <div
              key={i}
              style={{
                width: mobile ? 60 : 89,
                height: mobile ? 60 : 89,
                background: COLORS.surface,
                borderRadius: RADIUS.md,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: mobile ? undefined : i === 0 ? "rotate(-3.65deg)" : "rotate(8.59deg)",
                color: COLORS.ink,
                filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.25))",
              }}
            >
              <span style={{ fontSize: 10, fontFamily: FONT_FAMILY, fontStyle: "italic" }}>Match the</span>
              <span style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", fontFamily: FONT_FAMILY }}>{attr}</span>
            </div>
          ))}

          {/* Draw pile inline on mobile */}
          {mobile && (
            <span style={{ fontSize: 11, color: COLORS.ink, opacity: 0.5, marginLeft: SPACE[4] }}>
              {g.deck.length} left
            </span>
          )}
        </div>

        {/* Center: card grid */}
        <div style={{ flex: mobile ? undefined : 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0, width: mobile ? "100%" : undefined }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: isSmall ? SPACE[3] : SPACE[5],
              width: "100%",
              maxWidth: mobile ? 360 : undefined,
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
                    borderRadius: RADIUS.md,
                    ...(orangePulseCards.has(i) && doublePhase === "pick" && !bonusHighlighted.has(i)
                      ? { animation: "orange-pulse-border 1.5s infinite" }
                      : {}),
                    ...(bonusHighlighted.has(i)
                      ? { boxShadow: `0 0 0 3px ${COLORS.orange}, 0 0 16px rgba(231,144,36,0.6)` }
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
                    borderRadius: RADIUS.sm,
                    border: `2px dashed rgba(35,31,32,0.13)`,
                  }}
                />
              )
            )}
          </div>
        </div>

        {/* Right column: draw pile — desktop only */}
        {!mobile && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE[4],
            flexShrink: 0,
            background: COLORS.panelMuted,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: SPACE[8],
          }}>
            <div style={{ position: "relative", width: 80, height: 112 }}>
              {g.deck.length === 0 ? (
                <div style={{ width: 72, height: 101, borderRadius: RADIUS.md, border: "2px dashed rgba(35,31,32,0.13)" }} />
              ) : (
                [-3.81, 0, 4.63].map((rot, i) => (
                  <img
                    key={i}
                    src="/cards/Card Back.svg"
                    alt="Draw pile"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: 72,
                      height: 101,
                      borderRadius: RADIUS.md,
                      transform: `translate(-50%, -50%) rotate(${rot}deg) translateX(${(i - 1) * 3}px)`,
                      filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.25))",
                    }}
                  />
                ))
              )}
            </div>
            <span style={{ fontSize: 11, color: COLORS.ink, opacity: 0.7, textAlign: "center" }}>
              {g.deck.length} left
            </span>
          </div>
        )}
      </div>

      {/* Bottom HUD bar */}
      <div
        style={{
          display: "flex",
          flexDirection: isSmall ? "column" : "row",
          gap: SPACE[5],
          padding: `${SPACE[4]}px ${SPACE[6]}px`,
          alignItems: "stretch",
        }}
      >
        {/* New Game button */}
        <AppButton
          variant="primary"
          tone="blue"
          size="md"
          onClick={onNewGame}
          style={{
            fontSize: mobile ? 14 : 18,
            padding: `${SPACE[6]}px ${SPACE[8]}px`,
            flexShrink: 0,
            width: isSmall ? "100%" : undefined,
          }}
        >
          New Game
        </AppButton>

        {/* Game info section */}
        <div style={{
          display: "flex",
          flexDirection: "row",
          gap: SPACE[3],
          alignItems: "stretch",
          background: COLORS.panelMuted,
          border: BORDER.standard,
          borderRadius: RADIUS.md,
          padding: SPACE[3],
          flexShrink: 0,
          flexWrap: isSmall ? "wrap" : undefined,
          width: isSmall ? "100%" : undefined,
        }}>
          {[`Score: ${g.score}`, `Round: ${g.roundNum}`, `Cards Left: ${g.deck.length}`].map((label) => (
            <div
              key={label}
              style={{
                background: COLORS.surface,
                border: BORDER.standard,
                padding: `${SPACE[4]}px ${SPACE[6]}px`,
                borderRadius: RADIUS.md,
                fontFamily: FONT_FAMILY,
                fontStyle: "normal",
                fontSize: mobile ? 12 : 16,
                color: COLORS.ink,
                whiteSpace: "nowrap",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                ...(label.startsWith("Score") && scoreBounce
                  ? { animation: "score-bounce 0.3s ease" }
                  : {}),
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* WHOOP button */}
        <AppButton
          variant="primary"
          tone="red"
          size="lg"
          disabled={!whoopReady}
          onClick={() => {
            if (whoopReady) {
              g.enterClaimMode();
            }
          }}
          style={{
            flex: isSmall ? undefined : 1,
            width: isSmall ? "100%" : undefined,
            fontSize: isSmall ? "clamp(18px, 4vw, 24px)" : 26,
            padding: `${SPACE[6]}px ${SPACE[4]}px`,
            minHeight: mobile ? 48 : undefined,
            animation: whoopReady ? "whoop-pulse 1.5s infinite" : undefined,
          }}
        >
          WHOOP! WHOOP!
        </AppButton>
      </div>
    </div>
  );
};

export default GameWindow;
