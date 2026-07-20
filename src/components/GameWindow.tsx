import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX } from "lucide-react";
import { useGameState } from "@/hooks/useGameState";
import GameCard from "@/components/GameCard";
import DieDisplay from "@/components/DieDisplay";
import { playFlip, playCorrect, playWrong, playDiceRoll, playDeal, playWhoopCall, isMuted, setMuted } from "@/lib/sounds";
import { ALL_CARDS, Card } from "@/cardData";
import { COLORS, BORDER, RADIUS, MOTION, FONT_FAMILY, SPACE, TYPE, MOBILE_TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { IconButton } from "@/components/ui/IconButton";
import { pickLine, OPPONENT_NAME } from "@/lib/auntieO";


interface GameWindowProps {
  mobile?: boolean;
  viewW?: number;
}

const GameWindow: React.FC<GameWindowProps> = ({ mobile = false, viewW }) => {
  const [gameKey, setGameKey] = useState(0);

  return (
    <>
      <GamePlayArea
        key={gameKey}
        tier="standard"
        gridSize="3x2"
        onNewGame={() => setGameKey((k) => k + 1)}
        mobile={mobile}
        viewW={viewW}
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
  viewW?: number;
}

const GamePlayArea: React.FC<GamePlayAreaProps> = ({ tier, gridSize, onNewGame, mobile = false, viewW }) => {
  void tier;
  const g = useGameState(gridSize);
  const [muted, setMutedState] = useState(isMuted());
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // --- Animation state ---
  const [peekLocked, setPeekLocked] = useState(false);
  const peekUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enteringCards, setEnteringCards] = useState<Set<number>>(new Set());
  const [shakingCards, setShakingCards] = useState<Set<number>>(new Set());
  const [wrongFlashCards, setWrongFlashCards] = useState<Set<number>>(new Set());
  const [wrongWashCards, setWrongWashCards] = useState<Set<number>>(new Set());
  const [scoreBounce, setScoreBounce] = useState(false);
  const [diceLanded, setDiceLanded] = useState(false);
  const [whoopFeedback, setWhoopFeedback] = useState<{ text: string; tone: "success" | "red" } | null>(null);
  const whoopFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auntie O. speech bubble
  const [bubble, setBubble] = useState<{ text: string; red: boolean } | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBubble = useCallback((text: string, opts: { red?: boolean; sticky?: boolean } = {}) => {
    if (bubbleTimerRef.current) { clearTimeout(bubbleTimerRef.current); bubbleTimerRef.current = null; }
    setBubble({ text, red: !!opts.red });
    if (!opts.sticky) {
      bubbleTimerRef.current = setTimeout(() => setBubble(null), 2500);
    }
  }, []);
  const [gameOverLine, setGameOverLine] = useState<string>("");
  const chipRefCurrent = useRef<HTMLDivElement>(null);

  // Last Call local state
  const [lastCallSel, setLastCallSel] = useState<number[]>([]);
  const [lastCallShake, setLastCallShake] = useState<Set<number>>(new Set());


  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const scorePileRef = useRef<HTMLDivElement | null>(null);
  const gridCellRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  interface FlyingCard {
    id: string;
    index: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    fromW: number;
    fromH: number;
    toW: number;
    toH: number;
    delay: number;
    card?: Card;
  }
  const [lastCallFlyers, setLastCallFlyers] = useState<FlyingCard[]>([]);
  const prevGridRef = useRef(g.grid);


  const prevScoreRef = useRef(g.scores[0]);
  const prevRoundRef = useRef(g.roundNum);
  const prevClaimRef = useRef(g.claimMode);
  
  

  const showWhoopFeedback = useCallback((text: string, tone: "success" | "red") => {
    setWhoopFeedback({ text, tone });
    if (whoopFeedbackTimer.current) clearTimeout(whoopFeedbackTimer.current);
    whoopFeedbackTimer.current = setTimeout(() => setWhoopFeedback(null), 1800);
  }, []);

  // Auntie O. bubble drivers
  const oppClaimStateRef = useRef(g.opponentClaiming);
  const prevOppScoreRef = useRef(g.scores[1]);
  const prevPlayerScoreForBubbleRef = useRef(g.scores[0]);
  const prevSkipFlipRef = useRef(g.skipNextFlip);
  const gameStartedRef = useRef(false);

  useEffect(() => {
    if (gameStartedRef.current) return;
    gameStartedRef.current = true;
    showBubble(pickLine("gameStart"));
  }, [showBubble]);

  useEffect(() => {
    const wasClaiming = oppClaimStateRef.current !== null;
    const isClaiming = g.opponentClaiming !== null;
    if (!wasClaiming && isClaiming) {
      showBubble("WHOOP! WHOOP!", { red: true, sticky: true });
    } else if (wasClaiming && !isClaiming) {
      if (g.scores[1] > prevOppScoreRef.current) showBubble(pickLine("oppCorrect"));
      else showBubble(pickLine("oppWrong"));
    }
    oppClaimStateRef.current = g.opponentClaiming;
    prevOppScoreRef.current = g.scores[1];
  }, [g.opponentClaiming, g.scores[1], showBubble]);

  useEffect(() => {
    if (g.scores[0] > prevPlayerScoreForBubbleRef.current) {
      showBubble(pickLine("playerCorrect"));
    }
    prevPlayerScoreForBubbleRef.current = g.scores[0];
  }, [g.scores[0], showBubble]);

  useEffect(() => {
    if (!prevSkipFlipRef.current[0] && g.skipNextFlip[0]) {
      showBubble(pickLine("playerWrong"));
    }
    prevSkipFlipRef.current = g.skipNextFlip;
  }, [g.skipNextFlip, showBubble]);

  useEffect(() => {
    if (g.gameOver && !gameOverLine) {
      const line = pickLine(g.scores[1] > g.scores[0] ? "win" : "lose");
      setGameOverLine(line);
      showBubble(line, { sticky: true });
    }
  }, [g.gameOver, g.scores, gameOverLine, showBubble]);

  // Last Call opening
  const prevLastCallRef = useRef(false);
  useEffect(() => {
    if (g.lastCall && !prevLastCallRef.current) {
      showBubble(pickLine("lastCallStart"), { red: true });
    }
    prevLastCallRef.current = g.lastCall;
  }, [g.lastCall, showBubble]);

  // Opponent grabs during Last Call (opponentClaiming isn't used in Last Call)
  const prevLastCallOppScoreRef = useRef(g.scores[1]);
  useEffect(() => {
    if (g.lastCall && g.scores[1] > prevLastCallOppScoreRef.current) {
      showBubble(pickLine("lastCallGrab"), { red: true });
    }
    prevLastCallOppScoreRef.current = g.scores[1];
  }, [g.scores, g.lastCall, showBubble]);





  useEffect(() => {
    if (g.scores[0] !== prevScoreRef.current) {
      if (g.scores[0] > prevScoreRef.current) {
        playCorrect();
        showWhoopFeedback("Good Match!", "success");
      }
      prevScoreRef.current = g.scores[0];
      setScoreBounce(true);
      setTimeout(() => setScoreBounce(false), 300);
    }
  }, [g.scores[0], showWhoopFeedback]);

  useEffect(() => {
    if (g.roundNum !== prevRoundRef.current) {
      prevRoundRef.current = g.roundNum;
      setPeekLocked(false);
      setWrongWashCards(new Set());
      setWrongFlashCards(new Set());
    }
  }, [g.roundNum]);

  useEffect(() => {
    prevClaimRef.current = g.claimMode;
  }, [g.claimMode]);

  useEffect(() => {
    if (g.message) {
      // no-op: toast removed, feedback handled by WHOOP button
    }
  }, [g.message, g.messageType, g.roundNum, g.scores[0]]);

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



  // Detect newly filled slots (null -> filled) and fly cards in from the draw pile
  useEffect(() => {
    const prev = prevGridRef.current;
    if (prev !== g.grid) {
      const newSlots: number[] = [];
      g.grid.forEach((c, i) => {
        if (c && !prev[i]) newSlots.push(i);
      });
      if (newSlots.length > 0) {
        setEnteringCards(new Set(newSlots));
        playDeal(newSlots.length);
        setTimeout(() => setEnteringCards(new Set()), 800);
      }
    }
    prevGridRef.current = g.grid;
  }, [g.grid]);

  // Play flip sound for opponent auto-flips (human flips already play on click)
  const prevPeekRef = useRef<number | null>(g.peekingCard);
  useEffect(() => {
    if (g.peekingCard !== null && prevPeekRef.current === null && g.flipperIndex === 1) {
      playFlip();
    }
    prevPeekRef.current = g.peekingCard;
  }, [g.peekingCard, g.flipperIndex]);


  useEffect(() => {
    if (g.selectedCards.length === 2 && g.claimMode) {
      const timer = setTimeout(() => g.resolveMatch(), 1000);
      return () => clearTimeout(timer);
    }
  }, [g.selectedCards.length, g.claimMode, g.resolveMatch]);

  // Detect rolling transitions to animate dice landing + play dice sound once per roll cycle
  const prevRollingRef = useRef(g.rolling);
  const rollSoundCycleRef = useRef<number | null>(null);
  useEffect(() => {
    if (g.rolling && !prevRollingRef.current) {
      // Guard: play at most once per round's roll cycle, regardless of who triggered it
      if (rollSoundCycleRef.current !== g.roundNum) {
        rollSoundCycleRef.current = g.roundNum;
        playDiceRoll();
      }
      setDiceLanded(false);
    } else if (!g.rolling && prevRollingRef.current) {
      setDiceLanded(true);
      setTimeout(() => setDiceLanded(false), 400);
    }
    prevRollingRef.current = g.rolling;
  }, [g.rolling, g.roundNum]);

  // Opponent's roll phase → speech bubble
  const prevOppRollPhaseRef = useRef(false);
  useEffect(() => {
    const oppRolling = g.rollPhase && g.rollerIndex === 1;
    if (oppRolling && !prevOppRollPhaseRef.current) {
      showBubble(pickLine("oppRoll"));
    }
    prevOppRollPhaseRef.current = oppRolling;
  }, [g.rollPhase, g.rollerIndex, showBubble]);


  const handleLastCallClick = useCallback(
    (index: number) => {
      if (g.grid[index] === null) return;
      if (lastCallShake.size > 0) return;
      setLastCallSel((prev) => {
        if (prev.includes(index)) return prev.filter((x) => x !== index);
        if (prev.length >= 2) return prev;
        const next = [...prev, index];
        if (next.length === 2) {
          const [a, b] = next;
          const cardA = g.grid[a];
          const cardB = g.grid[b];
          const isMatch =
            !!cardA && !!cardB &&
            g.matchRule.every((attr) => {
              if (attr === "SHAPE") return cardA.shape === cardB.shape;
              if (attr === "NUMBER") return cardA.number === cardB.number;
              if (attr === "COLOR") return cardA.color === cardB.color;
              return false;
            });
          if (isMatch && cardA && cardB) {
            const scoreRect = scorePileRef.current?.getBoundingClientRect();
            const flyers: FlyingCard[] = [];
            [a, b].forEach((idx, k) => {
              const cellEl = gridCellRefs.current.get(idx);
              if (!cellEl || !scoreRect) return;
              const cellRect = cellEl.getBoundingClientRect();
              flyers.push({
                id: `lc-fly-${idx}-${Date.now()}-${k}`,
                index: idx,
                fromX: cellRect.left,
                fromY: cellRect.top,
                toX: scoreRect.left + scoreRect.width / 2 - cellRect.width / 2,
                toY: scoreRect.top + scoreRect.height / 2 - cellRect.height / 2,
                fromW: cellRect.width,
                fromH: cellRect.height,
                toW: cellRect.width,
                toH: cellRect.height,
                delay: k * 80,
                card: g.grid[idx] ?? undefined,
              });
            });
            setLastCallFlyers(flyers);
            playCorrect();
            g.claimLastCall(a, b);
            setTimeout(() => setLastCallFlyers([]), 700);
          } else {
            setLastCallShake(new Set(next));
            setTimeout(() => setLastCallShake(new Set()), 250);
          }
          return [];
        }
        return next;
      });
    },
    [g, lastCallShake]
  );

  const handleCardClick = useCallback(
    (index: number) => {
      if (g.gameOver || g.rolling) return;
      if (g.lastCall) { handleLastCallClick(index); return; }
      if (g.claimMode) { g.selectCard(index); return; }
      if (peekLocked || g.grid[index] === null) return;
      if (g.wrongCards.has(index)) return;
      setPeekLocked(true);
      playFlip();
      g.peekCard(index);
      if (peekUnlockTimer.current) clearTimeout(peekUnlockTimer.current);
      peekUnlockTimer.current = setTimeout(() => setPeekLocked(false), 1100);
    },
    [g, peekLocked, handleLastCallClick]
  );

  const whoopEnabled = !g.claimMode && !g.gameOver && !g.rolling && !g.lastCall;


  const isSmall = mobile && (viewW ?? 9999) < 480;
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
          You {g.scores[0]} — {OPPONENT_NAME} {g.scores[1]}
        </div>
        {gameOverLine && (
          <div style={{
            fontSize: TYPE.body,
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            color: COLORS.ink,
            background: COLORS.surface,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: `${SPACE[4]}px ${SPACE[8]}px`,
          }}>
            {OPPONENT_NAME} “{gameOverLine}”
          </div>
        )}
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

  // Design-system audit: mobile and desktop share the same COLORS/BORDER/RADIUS tokens.
  // Only dimensions (font-size, padding, min-height, gap) vary by device.
  // Intentional non-token exceptions kept below (all decorative, not surface theming):
  //   - lastCallBanner border: 1.5px solid COLORS.red (red variant of BORDER.standard weight)
  //   - empty grid slot + empty draw-pile slot: `2px dashed rgba(35,31,32,0.13)` — ghost placeholder,
  //     ink at 13% for a subtle dashed outline; no equivalent token exists.
  //   - highlight halos: boxShadow using COLORS.orange/blue plus an rgba glow at ~60% — decorative.
  //   - dice + draw-pile drop-shadows — decorative shadows.
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: mobile ? "hidden" : undefined }}>


      {/* Mute toggle — desktop only */}
      {!mobile && (
        <div style={{ position: "absolute", top: SPACE[4], right: SPACE[4], zIndex: 10 }}>
          <IconButton tone="default" onClick={toggleMute} aria-label={muted ? "Unmute game sounds" : "Mute game sounds"}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconButton>
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
            {[`Score: ${g.scores[0]}`, `Round: ${g.roundNum}`, `Cards Left: ${g.deck.length}`].map((label) => (
              <div
                key={label}
                ref={(el) => { if (label.startsWith("Score")) scorePileRef.current = el; }}

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
            disabled={!whoopEnabled && !g.claimMode && !whoopFeedback}
            onClick={() => {
              if (whoopEnabled && !g.claimMode) {
                playWhoopCall();
                g.enterClaimMode();
              }
            }}
            style={{
              // Only dimensions (font-size, padding, min-height) differ by device.
              // Border, radius, and colors come from AppButton tokens on both.
              flex: 1,
              fontSize: mobile ? "clamp(20px, 5vw, 26px)" : 26,
              padding: `${SPACE[6]}px ${SPACE[4]}px`,
              minHeight: mobile ? 64 : undefined,
              transition: `background ${MOTION.base}, color ${MOTION.base}`,
            }}
          >
            {whoopFeedback ? whoopFeedback.text : g.claimMode ? "Select the Match" : "WHOOP! WHOOP!"}
          </AppButton>
        );

        const showRollButton = g.rollPhase && g.rollerIndex === 0 && !g.rolling;
        const dimDice = g.rollPhase || g.rolling;
        const diceDisplay = g.rolling && g.dieValues.length ? g.dieValues : g.matchRule;
        const diceTray = (
          <div style={{
            position: "relative",
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
            <div style={{
              display: "flex",
              flexDirection: mobile ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              gap: mobile ? SPACE[4] : SPACE[6],
              opacity: dimDice ? 0.4 : 1,
              transition: "opacity 200ms ease",
            }}>
              {diceDisplay.map((attr, i) => (
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
                    transformStyle: "preserve-3d",
                    animation: g.rolling
                      ? `dice-tumble 260ms ease-in-out ${i * 80}ms infinite`
                      : diceLanded
                      ? `dice-land-flip 400ms cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms both`
                      : undefined,
                  }}
                >
                  <span style={{ fontSize: mobile ? MOBILE_TYPE.caption : TYPE.caption, fontFamily: FONT_FAMILY, fontStyle: "italic" }}>Match the</span>
                  <span style={{ fontSize: mobile ? MOBILE_TYPE.body : TYPE.subhead, fontWeight: 700, textTransform: "uppercase", fontFamily: FONT_FAMILY }}>{attr}</span>
                </div>
              ))}
            </div>
            {showRollButton && (
              <AppButton
                variant="primary"
                tone="red"
                size={mobile ? "md" : "lg"}
                onClick={() => { g.rollDice(); }}
                style={{
                  position: "absolute",
                  inset: mobile ? 3 : 6,
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  fontSize: mobile ? "clamp(12px, 3.8vw, 15px)" : "clamp(14px, 1.6vw, 20px)",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  lineHeight: mobile ? 1.05 : 1,
                  padding: mobile ? `0 ${SPACE[2]}px` : 0,
                  minHeight: "unset",
                  whiteSpace: mobile ? "normal" : "nowrap",
                  overflow: "hidden",
                }}
              >
                {g.roundNum === 1 ? "PLAY" : "ROLL"}
              </AppButton>
            )}
          </div>
        );


        const chipMaxBubbleW = Math.min(220, Math.max(160, (viewW ?? 360) - 32));
        const chipRect = mobile && bubble ? chipRefCurrent.current?.getBoundingClientRect() : null;
        let mobileBubbleLeft = 0;
        let mobileBubbleTop = 0;
        let mobileArrowLeft = chipMaxBubbleW / 2;
        if (chipRect) {
          const vw = viewW ?? window.innerWidth;
          const chipCenter = chipRect.left + chipRect.width / 2;
          mobileBubbleLeft = Math.max(16, Math.min(chipCenter - chipMaxBubbleW / 2, vw - chipMaxBubbleW - 16));
          mobileBubbleTop = chipRect.bottom + 8;
          mobileArrowLeft = chipCenter - mobileBubbleLeft;
        }

        const opponentChip = (
          <div ref={chipRefCurrent} style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: SPACE[3],
            background: COLORS.surface,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: `${SPACE[3]}px ${mobile ? SPACE[4] : SPACE[5]}px`,
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: mobile ? MOBILE_TYPE.caption : TYPE.ui,
            color: COLORS.ink,
            whiteSpace: "nowrap",
            flexShrink: mobile ? 0 : 1,
            minWidth: mobile ? undefined : 0,
            alignSelf: mobile ? "stretch" : "center",
            width: mobile ? "100%" : undefined,
            boxSizing: mobile ? "border-box" : undefined,
            justifyContent: mobile ? "space-between" : undefined,
          }}>
            <span style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}>{OPPONENT_NAME}</span>
            <span style={{ fontStyle: "normal", fontWeight: 700, flexShrink: 0, color: COLORS.red }}>{g.scores[1]}</span>
            {bubble && !mobile && (
              <div style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: COLORS.surface,
                border: BORDER.standard,
                borderRadius: RADIUS.md,
                padding: `${SPACE[3]}px ${SPACE[5]}px`,
                fontFamily: FONT_FAMILY,
                fontStyle: "italic",
                fontSize: TYPE.caption,
                color: bubble.red ? COLORS.red : COLORS.ink,
                fontWeight: bubble.red ? 700 : 400,
                whiteSpace: "nowrap",
                zIndex: 30,
                pointerEvents: "none",
              }}>
                <div style={{
                  position: "absolute",
                  bottom: -6,
                  left: "50%",
                  width: 10,
                  height: 10,
                  transform: "translateX(-50%) rotate(45deg)",
                  background: COLORS.surface,
                  borderRight: BORDER.standard,
                  borderBottom: BORDER.standard,
                }} />
                {bubble.text}
              </div>
            )}
          </div>
        );

        const mobileBubblePortal = mobile && bubble && chipRect ? createPortal(
          <div style={{
            position: "fixed",
            top: mobileBubbleTop,
            left: mobileBubbleLeft,
            width: chipMaxBubbleW,
            maxWidth: chipMaxBubbleW,
            background: COLORS.surface,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: MOBILE_TYPE.caption,
            color: bubble.red ? COLORS.red : COLORS.ink,
            fontWeight: bubble.red ? 700 : 400,
            whiteSpace: "normal",
            wordBreak: "break-word",
            zIndex: 9999,
            pointerEvents: "none",
            textAlign: "center",
          }}>
            <div style={{
              position: "absolute",
              top: -6,
              left: Math.max(10, Math.min(mobileArrowLeft - 5, chipMaxBubbleW - 20)),
              width: 10,
              height: 10,
              transform: "rotate(45deg)",
              background: COLORS.surface,
              borderLeft: BORDER.standard,
              borderTop: BORDER.standard,
            }} />
            {bubble.text}
          </div>,
          document.body
        ) : null;


        const statusText = g.lastCall
          ? "LAST CALL — tap any matching pair!"
          : g.opponentClaiming
          ? "Auntie O. is claiming!"
          : g.claimPending
            ? "Rolling — get ready to claim!"
            : g.claimMode
              ? "Tap two cards to claim"
              : g.rollPhase && g.rollerIndex === 0
                ? "Your roll — tap the dice"
                : g.rollPhase && g.rollerIndex === 1
                  ? "Auntie O. is rolling…"
                  : g.flipperIndex === 0
                    ? "Your flip — tap a card"
                    : "Auntie O. is thinking…";
        const statusStrip = (
          <div style={{
            padding: `${SPACE[3]}px ${SPACE[6]}px`,
            textAlign: "center",
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontSize: mobile ? MOBILE_TYPE.caption : TYPE.caption,
            color: g.lastCall ? COLORS.red : COLORS.ink,
            fontWeight: g.lastCall ? 700 : undefined,
          }}>
            {statusText}
          </div>
        );

        const lastCallBanner = g.lastCall ? (
          <div style={{
            margin: `${SPACE[3]}px ${SPACE[6]}px 0`,
            padding: `${SPACE[4]}px ${SPACE[6]}px`,
            background: COLORS.surface,
            border: `1.5px solid ${COLORS.red}`,
            borderRadius: RADIUS.md,
            textAlign: "center",
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontWeight: 700,
            color: COLORS.red,
            fontSize: mobile ? MOBILE_TYPE.body : TYPE.subhead,
            letterSpacing: 0.3,
          }}>
            LAST CALL — grab every pair you can!
          </div>
        ) : null;


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
                    visibility: lastCallFlyers.some((f) => f.index === i) ? "hidden" : "visible",
                    animation: enteringCards.has(i)
                      ? `card-enter 0.3s ease ${(i % 3) * 100}ms both`
                      : (shakingCards.has(i) || lastCallShake.has(i))
                      ? "card-shake 0.2s ease"
                      : g.lastCall
                      ? "red-pulse-border 1.6s infinite"
                      : undefined,
                    borderRadius: RADIUS.md,
                    ...(g.wrongCards.has(i)
                      ? { opacity: 0.55, cursor: "default" }
                      : {}),
                    ...(g.opponentClaiming && g.opponentClaiming.indices.includes(i)
                      ? { boxShadow: `0 0 0 3px ${COLORS.blue}, 0 0 16px rgba(0,114,178,0.6)` }
                      : {}),
                    ...(g.lastCall && lastCallSel.includes(i)
                      ? { boxShadow: `0 0 0 3px ${COLORS.blue}, 0 0 16px rgba(0,114,178,0.6)` }
                      : {}),
                  }}
                >
                  <GameCard
                    card={card}
                    faceUp={
                      g.allFaceUp ||
                      g.peekingCard === i ||
                      (g.claimMode && g.selectedCards.includes(i)) ||
                      (g.opponentClaiming?.indices.includes(i) ?? false) ||
                      wrongWashCards.has(i) ||
                      wrongFlashCards.has(i)
                    }
                    onClick={() => handleCardClick(i)}
                    highlighted={g.selectedCards.includes(i) || (g.opponentClaiming?.indices.includes(i) ?? false) || (g.lastCall && lastCallSel.includes(i))}
                    matched={g.matchedCards.has(i)}
                    wrong={wrongFlashCards.has(i)}
                    wrongWash={wrongWashCards.has(i)}
                    shaking={shakingCards.has(i) || lastCallShake.has(i)}
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
              {/* Top HUD: two rows */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE[3],
                padding: `${SPACE[4]}px ${isSmall ? SPACE[4] : SPACE[6]}px`,
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: isSmall ? SPACE[4] : SPACE[5],
                  alignItems: "stretch",
                }}>
                  {newGameButton}
                  {scoreBadges}
                </div>
                {opponentChip}
              </div>
              {mobileBubblePortal}

              {lastCallBanner}


              {/* Main area: card grid in panel */}
              <div style={{
                display: "flex",
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                margin: `0 ${isSmall ? SPACE[4] : SPACE[6]}px`,
                padding: isSmall ? SPACE[4] : SPACE[5],
                background: COLORS.panelMuted,
                border: BORDER.standard,
                borderRadius: RADIUS.md,
              }}>
                {cardGrid}
              </div>


              {statusStrip}

              {/* Bottom bar: dice + WHOOP */}
              <div style={{
                display: "flex",
                flexDirection: "row",
                gap: isSmall ? SPACE[4] : SPACE[5],
                padding: `${SPACE[4]}px ${isSmall ? SPACE[4] : SPACE[6]}px`,
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
            {lastCallBanner}
            {/* Main area */}
            <div style={{

              display: "flex",
              flexDirection: "row",
              gap: (viewW ?? 1200) < 1100 ? SPACE[10] : 38,
              flex: 1,
              padding: (viewW ?? 1200) < 1100 ? "24px 16px" : "50px 40px",
              minHeight: 0,
              alignItems: "center",
              justifyContent: "center",
            }}>
              {drawPile}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
                {cardGrid}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE[4], flexShrink: 0 }}>
                {opponentChip}
                {diceTray}
              </div>
            </div>


            {statusStrip}

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

      {/* Last Call flyers — face-up cards flying to the score pile */}
      {createPortal(
        <>
          {lastCallFlyers.map((fc) => (
            <img
              key={fc.id}
              src={fc.card?.svgPath ?? "/cards/card-back.svg"}
              alt=""
              style={{
                position: "fixed",
                left: fc.fromX,
                top: fc.fromY,
                width: fc.toW,
                height: fc.toH,
                borderRadius: RADIUS.md,
                pointerEvents: "none",
                zIndex: 50,
                filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.3))",
                transformOrigin: "top left",
                ["--fly-to-x" as any]: `${fc.toX - fc.fromX}px`,
                ["--fly-to-y" as any]: `${fc.toY - fc.fromY}px`,
                ["--fly-scale-x" as any]: `1`,
                ["--fly-scale-y" as any]: `1`,
                animation: `fly-to-grid 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${fc.delay}ms both`,
              }}
            />
          ))}
        </>,
        document.body
      )}
    </div>

  );
};

export default GameWindow;

