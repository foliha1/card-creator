import React, { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useGameState } from "@/hooks/useGameState";
import GameCard from "@/components/GameCard";
import DieDisplay from "@/components/DieDisplay";
import { playFlip, playCorrect, playWrong, playDoubleMatch, playDiceRoll, isMuted, setMuted } from "@/lib/sounds";
import { ALL_CARDS } from "@/cardData";
import { COLORS, BORDER, RADIUS, MOTION, FONT_FAMILY, SPACE, TYPE, MOBILE_TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { IconButton } from "@/components/ui/IconButton";

interface GameWindowProps {
  mobile?: boolean;
}

const GameWindow: React.FC<GameWindowProps> = ({ mobile = false }) => {
  const [gameKey, setGameKey] = useState(0);

  return (
    <>
      <GamePlayArea
        key={gameKey}
        tier="standard"
        gridSize="3x2"
        onNewGame={() => setGameKey((k) => k + 1)}
        mobile={mobile}
      />
      {/* Preload card images */}
      <div style={{ display: "none" }}>
        {ALL_CARDS.map((c) => (
          <img key={c.id} src={c.svgPath} alt="" width={0} height={0} />
        ))}
      </div>
    </>
  );
};

interface GamePlayAreaProps {
  tier: "easy" | "standard";
  gridSize: "3x2" | "3x3";
  onNewGame: () => void;
  mobile?: boolean;
}

const GamePlayArea: React.FC<GamePlayAreaProps> = ({ tier, gridSize, onNewGame, mobile = false }) => {
  const g = useGameState(tier, gridSize);
  const [muted, setMutedState] = useState(isMuted());
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

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
  const [whoopFeedback, setWhoopFeedback] = useState<{ text: string; tone: "success" | "red" } | null>(null);
  const whoopFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const gridCellRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  interface FlyingCard {
    id: string;
    index: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    toW: number;
    toH: number;
    delay: number;
  }
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const prevGridRef = useRef(g.grid);
  const initialDealDone = useRef(false);

  const launchFlyers = useCallback((targetIndices: number[]) => {
    if (!drawPileRef.current || targetIndices.length === 0) {
      setEnteringCards(new Set(targetIndices));
      setTimeout(() => setEnteringCards(new Set()), 800);
      return;
    }
    const pileRect = drawPileRef.current.getBoundingClientRect();
    const flyers: FlyingCard[] = [];
    targetIndices.forEach((idx, i) => {
      const cellEl = gridCellRefs.current.get(idx);
      if (!cellEl) return;
      const cellRect = cellEl.getBoundingClientRect();
      flyers.push({
        id: `fly-${idx}-${Date.now()}`,
        index: idx,
      fromX: pileRect.left + pileRect.width / 2 - 36,
        fromY: pileRect.top + pileRect.height / 2 - 50,
        toX: cellRect.left,
        toY: cellRect.top,
        toW: cellRect.width,
        toH: cellRect.height,
        delay: i * 100,
      });
    });
    setFlyingCards(flyers);
    setTimeout(() => {
      setFlyingCards([]);
      setEnteringCards(new Set(targetIndices));
      setTimeout(() => setEnteringCards(new Set()), 400);
    }, 400 + targetIndices.length * 100);
  }, []);

  const prevScoreRef = useRef(g.score);
  const prevRoundRef = useRef(g.roundNum);
  const prevClaimRef = useRef(g.claimMode);
  const prevBonusRef = useRef(g.bonusPicking);
  const prevRoundForDice = useRef(g.roundNum);

  const showWhoopFeedback = useCallback((text: string, tone: "success" | "red") => {
    setWhoopFeedback({ text, tone });
    if (whoopFeedbackTimer.current) clearTimeout(whoopFeedbackTimer.current);
    whoopFeedbackTimer.current = setTimeout(() => setWhoopFeedback(null), 1800);
  }, []);

  useEffect(() => {
    if (g.score !== prevScoreRef.current) {
      if (g.score > prevScoreRef.current) {
        playCorrect();
        showWhoopFeedback("Good Match!", "success");
      }
      prevScoreRef.current = g.score;
      setScoreBounce(true);
      setTimeout(() => setScoreBounce(false), 300);
    }
  }, [g.score, showWhoopFeedback]);

  useEffect(() => {
    if (g.roundNum !== prevRoundRef.current) {
      prevRoundRef.current = g.roundNum;
      setPeekedCount(0);
      setPeekLocked(false);
      setWrongWashCards(new Set());
      setWrongFlashCards(new Set());
      setShowDoubleTitle(false);
      setDoublePhase("idle");
      setOrangePulseCards(new Set());
      setBonusHighlighted(new Set());
    }
  }, [g.roundNum]);

  useEffect(() => {
    if (prevClaimRef.current && !g.claimMode) setPeekedCount(0);
    prevClaimRef.current = g.claimMode;
  }, [g.claimMode]);

  useEffect(() => {
    if (g.message) {
      // no-op: toast removed, feedback handled by WHOOP button
    }
  }, [g.message, g.messageType, g.roundNum, g.score]);

  useEffect(() => {
    if (g.wrongCards.size === 2) {
      playWrong();
      showWhoopFeedback("Wrong Match!", "red");
      const indices = Array.from(g.wrongCards);
      setWrongFlashCards(new Set(indices));
      setShakingCards(new Set(indices));
      setTimeout(() => {
        setShakingCards(new Set());
        setWrongFlashCards(new Set());
        setWrongWashCards((prev) => new Set([...prev, ...indices]));
      }, 300);
    }
  }, [g.wrongCards, showWhoopFeedback]);

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

  // Detect newly filled slots (null -> filled) and fly cards in from the draw pile
  useEffect(() => {
    const prev = prevGridRef.current;
    if (prev !== g.grid) {
      const newSlots: number[] = [];
      g.grid.forEach((c, i) => {
        if (c && !prev[i]) newSlots.push(i);
      });
      if (newSlots.length > 0) {
        if (!initialDealDone.current) {
          initialDealDone.current = true;
          launchFlyers(newSlots);
        } else {
          setEnteringCards(new Set(newSlots));
          setTimeout(() => setEnteringCards(new Set()), 800);
        }
      }
    }
    prevGridRef.current = g.grid;
  }, [g.grid, launchFlyers]);

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
        <div style={{ fontSize: TYPE.display, fontWeight: 700, fontStyle: "italic", fontFamily: FONT_FAMILY }}>
          Game Over!
        </div>
        <div style={{ fontSize: TYPE.body, color: COLORS.inkSubtle }}>
          You collected {collected} of {totalCards} cards
        </div>
        <div style={{ fontSize: TYPE.head, fontWeight: 700, fontFamily: FONT_FAMILY }}>
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: mobile ? "hidden" : undefined }}>

      {/* Mute toggle — desktop only */}
      {!mobile && (
        <div style={{ position: "absolute", top: SPACE[4], right: SPACE[4], zIndex: 10 }}>
          <IconButton tone="default" onClick={toggleMute}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconButton>
        </div>
      )}

      {showDoubleTitle && (
        <div style={{
          position: "absolute",
          top: "40%",
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          animation: doublePhase === "idle"
            ? "double-title-out 0.3s ease forwards"
            : "double-title-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          <span style={{
            color: COLORS.orange,
            fontSize: TYPE.display,
            fontWeight: 700,
            fontStyle: "italic",
            fontFamily: FONT_FAMILY,
            textShadow: `0 2px 8px rgba(0,0,0,0.2)`,
          }}>
            DOUBLE MATCH!
          </span>
        </div>
      )}


      {/* Bonus pick pill */}
      {doublePhase === "pick" && (
        <div style={{
          position: "absolute",
          top: SPACE[6],
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{
            display: "inline-block",
            background: COLORS.orange,
            color: COLORS.ink,
            fontSize: TYPE.ui,
            fontWeight: 700,
            fontStyle: "italic",
            fontFamily: FONT_FAMILY,
            borderRadius: 999,
            padding: `${SPACE[3]}px ${SPACE[8]}px`,
            animation: "pill-pulse 1.5s infinite",
            pointerEvents: "auto",
          }}>
            Choose 2 bonus cards!
          </span>
        </div>
      )}

      {/* Claim mode instruction */}

      {(() => {
        const newGameButton = (
          <AppButton
            variant="primary"
            tone="blue"
            size="md"
            onClick={onNewGame}
            style={{
              fontSize: mobile ? MOBILE_TYPE.body : TYPE.subhead,
              padding: mobile ? `${SPACE[3]}px ${SPACE[5]}px` : `${SPACE[6]}px ${SPACE[8]}px`,
              flexShrink: 0,
              whiteSpace: mobile ? "normal" : undefined,
              lineHeight: mobile ? 1.2 : undefined,
              width: mobile ? 64 : undefined,
              textAlign: "center",
            }}
          >
            New Game
          </AppButton>
        );

        const scoreBadges = (
          <div style={{
            display: "flex",
            flexDirection: "row",
            gap: SPACE[3],
            alignItems: "stretch",
            background: COLORS.panelMuted,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: SPACE[3],
            flexGrow: mobile ? 1 : undefined,
            flexShrink: 0,
            justifyContent: mobile ? "space-around" : undefined,
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
                  fontSize: mobile ? MOBILE_TYPE.caption : TYPE.ui,
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
        );

        const whoopButton = (
          <AppButton
            variant="primary"
            tone={whoopFeedback ? whoopFeedback.tone : g.claimMode ? "orange" : "red"}
            size="lg"
            disabled={!whoopReady && !g.claimMode && !whoopFeedback}
            onClick={() => {
              if (whoopReady && !g.claimMode) {
                g.enterClaimMode();
              }
            }}
            style={{
              flex: 1,
              fontSize: mobile ? "clamp(18px, 4vw, 24px)" : 26,
              padding: `${SPACE[6]}px ${SPACE[4]}px`,
              minHeight: mobile ? 48 : undefined,
              transition: `background ${MOTION.base}, color ${MOTION.base}`,
            }}
          >
            {whoopFeedback ? whoopFeedback.text : g.claimMode ? "Select the Match" : "WHOOP! WHOOP!"}
          </AppButton>
        );

        const diceTray = (
          <div style={{
            display: "flex",
            flexDirection: mobile ? "row" : "column",
            alignItems: "center",
            justifyContent: "center",
            gap: mobile ? SPACE[4] : SPACE[6],
            flexShrink: 0,
            background: COLORS.panelMuted,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: mobile ? SPACE[4] : SPACE[8],
          }}>
            {g.matchRule.map((attr, i) => (
              <div
                key={i}
                style={{
                  width: mobile ? 52 : 89,
                  height: mobile ? 52 : 89,
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
                <span style={{ fontSize: mobile ? MOBILE_TYPE.caption : TYPE.caption, fontFamily: FONT_FAMILY, fontStyle: "italic" }}>Match the</span>
                <span style={{ fontSize: mobile ? MOBILE_TYPE.body : TYPE.subhead, fontWeight: 700, textTransform: "uppercase", fontFamily: FONT_FAMILY }}>{attr}</span>
              </div>
            ))}
          </div>
        );

        const cardGrid = (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: isSmall ? SPACE[3] : SPACE[5],
              width: "100%",
              maxWidth: mobile ? undefined : undefined,
              justifyContent: "center",
            }}
          >
            {g.grid.map((card, i) =>
              card ? (
                <div
                  key={card.id}
                  ref={(el) => {
                    if (el) gridCellRefs.current.set(i, el);
                    else gridCellRefs.current.delete(i);
                  }}
                  style={{
                    visibility: flyingCards.some((f) => f.index === i) ? "hidden" : "visible",
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
        );

        const drawPile = (
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
            <div ref={drawPileRef} style={{ position: "relative", width: 80, height: 112 }}>
              {g.deck.length === 0 ? (
                <div style={{ width: 72, height: 101, borderRadius: RADIUS.md, border: "2px dashed rgba(35,31,32,0.13)" }} />
              ) : (
                [-3.81, 0, 4.63].map((rot, i) => (
                  <img
                    key={i}
                    src="/cards/card-back.svg"
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
          </div>
        );

        if (mobile) {
          return (
            <>
              {/* Top HUD bar */}
              <div style={{
                display: "flex",
                flexDirection: "row",
                gap: SPACE[5],
                padding: `${SPACE[4]}px ${SPACE[6]}px`,
                alignItems: "stretch",
              }}>
                {newGameButton}
                {scoreBadges}
              </div>

              {/* Main area: card grid in panel */}
              <div style={{
                display: "flex",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                margin: `0 ${SPACE[6]}px`,
                padding: SPACE[5],
                background: COLORS.panel,
                border: BORDER.standard,
                borderRadius: RADIUS.md,
              }}>
                {cardGrid}
              </div>

              {/* Bottom bar: dice + WHOOP */}
              <div style={{
                display: "flex",
                flexDirection: "row",
                gap: SPACE[5],
                padding: `${SPACE[4]}px ${SPACE[6]}px`,
                alignItems: "stretch",
              }}>
                {diceTray}
                {whoopButton}
              </div>
            </>
          );
        }

        return (
          <>
            {/* Main area */}
            <div style={{
              display: "flex",
              flexDirection: "row",
              gap: (typeof window !== 'undefined' && window.innerWidth < 1100) ? SPACE[10] : 38,
              flex: 1,
              padding: (typeof window !== 'undefined' && window.innerWidth < 1100) ? "24px 16px" : "50px 40px",
              minHeight: 0,
              alignItems: "center",
              justifyContent: "center",
            }}>
              {drawPile}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
                {cardGrid}
              </div>
              {diceTray}
            </div>

            {/* Bottom HUD bar */}
            <div style={{
              display: "flex",
              flexDirection: "row",
              gap: SPACE[5],
              padding: `${SPACE[4]}px ${SPACE[6]}px`,
              alignItems: "stretch",
            }}>
              {newGameButton}
              {scoreBadges}
              {whoopButton}
            </div>
          </>
        );
      })()}

      {/* Flying card overlays (mid-round refills) */}
      {flyingCards.map((fc) => (
        <img
          key={fc.id}
          src="/cards/card-back.svg"
          alt=""
          style={{
            position: "fixed",
            left: fc.fromX,
            top: fc.fromY,
            width: 72,
            height: 101,
            borderRadius: RADIUS.md,
            pointerEvents: "none",
            zIndex: 50,
            filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.3))",
            transformOrigin: "top left",
            ["--fly-to-x" as any]: `${fc.toX - fc.fromX}px`,
            ["--fly-to-y" as any]: `${fc.toY - fc.fromY}px`,
            ["--fly-scale-x" as any]: `${fc.toW / 72}`,
            ["--fly-scale-y" as any]: `${fc.toH / 101}`,
            animation: `fly-to-grid 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${fc.delay}ms both`,
          }}
        />
      ))}
    </div>
  );
};

export default GameWindow;
