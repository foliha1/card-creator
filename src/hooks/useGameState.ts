import { useState, useCallback, useRef, useEffect } from "react";
import { Card, createDeck, ATTRIBUTES } from "@/cardData";
import { createOpponentMemory } from "@/lib/opponentMemory";

type MessageType = "info" | "success" | "error" | "warning";
type Tier = "easy" | "standard";

const PLAYERS = ["you", "opponent"] as const;
const OPPONENT_DELAY_MS = 1400;
const REVEAL_MS = 2000;

function rollRandomAttributes(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)]);
  }
  return result;
}

function getDieCount(tier: Tier, roundNum: number): number {
  if (tier === "easy") return 1;
  return roundNum % 2 === 1 ? 1 : 2;
}

function cardsMatchOnAttribute(a: Card, b: Card, attr: string): boolean {
  switch (attr) {
    case "SHAPE": return a.shape === b.shape;
    case "NUMBER": return a.number === b.number;
    case "COLOR": return a.color === b.color;
    default: return false;
  }
}

function cardsMatchRule(a: Card, b: Card, rule: string[]): boolean {
  return rule.every((attr) => cardsMatchOnAttribute(a, b, attr));
}

function hasValidPair(grid: (Card | null)[], rule: string[]): boolean {
  const cards = grid.filter((c): c is Card => c !== null);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardsMatchRule(cards[i], cards[j], rule)) return true;
    }
  }
  return false;
}

function hasAnyValidPair(grid: (Card | null)[]): boolean {
  const allRules: string[][] = [
    ["SHAPE"], ["NUMBER"], ["COLOR"],
    ["SHAPE", "NUMBER"], ["SHAPE", "COLOR"], ["NUMBER", "COLOR"],
  ];
  return allRules.some((rule) => hasValidPair(grid, rule));
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function computeRule(values: string[]): { rule: string[]; isDoubleMatch: boolean } {
  if (values.length === 2 && values[0] !== values[1]) {
    return { rule: values, isDoubleMatch: true };
  }
  if (values.length === 2 && values[0] === values[1]) {
    return { rule: [values[0]], isDoubleMatch: false };
  }
  return { rule: values, isDoubleMatch: false };
}

export function useGameState(tier: Tier = "standard", gridSize: "3x2" | "3x3" = "3x2") {
  const slotCount = gridSize === "3x3" ? 9 : 6;
  const [deck, setDeck] = useState<Card[]>([]);
  const [grid, setGrid] = useState<(Card | null)[]>(Array(slotCount).fill(null));
  const [matchRule, setMatchRule] = useState<string[]>([]);
  const [dieValues, setDieValues] = useState<string[]>([]);
  const [isDoubleMatch, setIsDoubleMatch] = useState(false);
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [roundNum, setRoundNum] = useState(1);
  const [rollerIndex, setRollerIndex] = useState(0);
  const [flipperIndex, setFlipperIndex] = useState(0);
  const [skipNextFlip, setSkipNextFlip] = useState<boolean[]>([false, false]);
  const [peekingCard, setPeekingCard] = useState<number | null>(null);
  const [claimMode, setClaimMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [wrongCards, setWrongCards] = useState<Set<number>>(new Set());
  const [matchedCards, setMatchedCards] = useState<Set<number>>(new Set());
  const [bonusPicking, setBonusPicking] = useState(false);
  const [bonusPicks, setBonusPicks] = useState<number[]>([]);
  const [bonusRevealing, setBonusRevealing] = useState(false);
  const [opponentClaiming, setOpponentClaiming] = useState<{ indices: [number, number] } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [rolling, setRolling] = useState(false);

  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oppDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoryRef = useRef(createOpponentMemory());
  const prevPeekingRef = useRef<number | null>(null);
  const prevGridRef = useRef<(Card | null)[]>([]);
  const oppClaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOppPicksRef = useRef<number[] | null>(null);

  const doRollDice = useCallback(
    (currentRound: number): Promise<string[]> => {
      const count = getDieCount(tier, currentRound);
      const finalValues = rollRandomAttributes(count);
      const { rule, isDoubleMatch: dm } = computeRule(finalValues);

      setRolling(true);
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = setInterval(() => {
        setDieValues(rollRandomAttributes(count));
      }, 100);

      return new Promise((resolve) => {
        setTimeout(() => {
          if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
          setDieValues(finalValues);
          setMatchRule(rule);
          setIsDoubleMatch(dm);
          setTimeout(() => {
            setRolling(false);
            resolve(rule);
          }, 300);
        }, 800);
      });
    },
    [tier]
  );

  const doRollDiceSync = useCallback(
    (currentRound: number): string[] => {
      const count = getDieCount(tier, currentRound);
      const values = rollRandomAttributes(count);
      const { rule, isDoubleMatch: dm } = computeRule(values);
      setDieValues(values);
      setMatchRule(rule);
      setIsDoubleMatch(dm);
      return rule;
    },
    [tier]
  );

  const checkGameOver = useCallback(
    (currentDeck: Card[], currentGrid: (Card | null)[], _rule: string[]) => {
      const hasCards = currentGrid.some((c) => c !== null);
      if (!hasCards && currentDeck.length === 0) {
        setGameOver(true);
        return true;
      }
      if (hasCards && currentDeck.length === 0 && !hasAnyValidPair(currentGrid)) {
        setGameOver(true);
        return true;
      }
      return false;
    },
    []
  );

  // Announce winner when game ends (reads latest scores)
  useEffect(() => {
    if (!gameOver) return;
    const [you, opp] = scores;
    const outcome =
      you > opp ? `You win! ${you}–${opp}`
      : opp > you ? `Opponent wins! ${opp}–${you}`
      : `Tie ${you}–${opp}`;
    setMessage(`Game over — ${outcome}`);
    setMessageType("info");
  }, [gameOver, scores]);

  // Init
  useEffect(() => {
    const newDeck = createDeck();
    const dealt = newDeck.splice(0, slotCount);
    const newGrid = dealt.concat(Array(slotCount - dealt.length).fill(null));
    setDeck(newDeck);
    setGrid(newGrid);
    setScores([0, 0]);
    setRoundNum(1);
    setRollerIndex(0);
    setFlipperIndex(0);
    setSkipNextFlip([false, false]);
    setGameOver(false);
    setClaimMode(false);
    setSelectedCards([]);
    setWrongCards(new Set());
    setMatchedCards(new Set());
    setBonusPicking(false);
    setBonusPicks([]);
    setBonusRevealing(false);
    setOpponentClaiming(null);
    setMessage("");
    const count = getDieCount(tier, 1);
    const values = rollRandomAttributes(count);
    const { rule, isDoubleMatch: dm } = computeRule(values);
    setDieValues(values);
    setMatchRule(rule);
    setIsDoubleMatch(dm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, slotCount]);

  // Dead-grid safety valve: if NO possible pair exists for any rule, swap 2 cards from deck.
  useEffect(() => {
    if (gameOver || rolling || claimMode || bonusPicking || bonusRevealing) return;
    if (!grid.some((c) => c !== null)) return;
    if (deck.length === 0) return;
    if (hasAnyValidPair(grid)) return;
    const filledIndices = grid
      .map((c, i) => (c !== null ? i : -1))
      .filter((i) => i !== -1);
    if (filledIndices.length < 2 || deck.length < 2) return;
    const swapIndices = shuffleArray([...filledIndices]).slice(0, 2);
    const newDeck = [...deck];
    const newGrid = [...grid];
    for (const idx of swapIndices) {
      if (newGrid[idx]) newDeck.push(newGrid[idx]!);
    }
    shuffleArray(newDeck);
    for (const idx of swapIndices) {
      newGrid[idx] = newDeck.length > 0 ? newDeck.shift()! : null;
    }
    setGrid(newGrid);
    setDeck(newDeck);
    setMessage("Refreshing grid — no possible matches!");
    setMessageType("warning");
  }, [grid, deck, gameOver, rolling, claimMode, bonusPicking, bonusRevealing]);


  // Pass the flipper turn; if rotation completes, advance round + rotate roller
  const passFlipper = useCallback(() => {
    setFlipperIndex((prev) => {
      const next = (prev + 1) % PLAYERS.length;
      if (next === rollerIndex) {
        // Rotation complete → advance round, rotate roller, clear wrongCards
        const newRoller = (rollerIndex + 1) % PLAYERS.length;
        setRollerIndex(newRoller);
        setRoundNum((r) => r + 1);
        setWrongCards(new Set());
        return newRoller;
      }
      return next;
    });
  }, [rollerIndex]);

  // Forfeit-flip effect: when the rotation reaches a player with skipNextFlip true,
  // clear their flag and pass immediately. Depends only on flipperIndex so setting
  // the flag mid-turn does NOT retroactively skip the current player.
  const skipRef = useRef(skipNextFlip);
  useEffect(() => { skipRef.current = skipNextFlip; }, [skipNextFlip]);
  const prevFlipperRef = useRef(flipperIndex);
  useEffect(() => {
    if (prevFlipperRef.current === flipperIndex) return;
    prevFlipperRef.current = flipperIndex;
    if (gameOver || rolling || claimMode || bonusPicking || bonusRevealing) return;
    if (peekingCard !== null) return;
    if (!skipRef.current[flipperIndex]) return;
    const idx = flipperIndex;
    setSkipNextFlip((s) => {
      const n = [...s];
      n[idx] = false;
      return n;
    });
    skipRef.current = skipRef.current.map((v, i) => (i === idx ? false : v));
    passFlipper();
  }, [flipperIndex, gameOver, rolling, claimMode, bonusPicking, bonusRevealing, peekingCard, passFlipper]);

  const peekCard = useCallback((index: number) => {
    if (flipperIndex !== 0) return;
    if (claimMode || bonusPicking || bonusRevealing || rolling || gameOver) return;
    if (opponentClaiming) return;
    if (wrongCards.has(index)) return;
    if (grid[index] === null) return;
    if (peekingCard !== null) return;
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    setPeekingCard(index);
    peekTimerRef.current = setTimeout(() => {
      setPeekingCard(null);
      passFlipper();
    }, REVEAL_MS);
  }, [flipperIndex, claimMode, bonusPicking, bonusRevealing, rolling, gameOver, opponentClaiming, wrongCards, grid, peekingCard, passFlipper]);

  // Opponent auto-flip when it's their turn
  useEffect(() => {
    if (flipperIndex !== 1) return;
    if (gameOver || rolling || claimMode || bonusPicking || bonusRevealing) return;
    if (peekingCard !== null) return;

    if (oppDelayRef.current) clearTimeout(oppDelayRef.current);
    oppDelayRef.current = setTimeout(() => {
      oppDelayRef.current = null;
      const candidates = grid
        .map((c, i) => (c !== null && !wrongCards.has(i) ? i : -1))
        .filter((i) => i !== -1);
      if (candidates.length === 0) {
        passFlipper();
        return;
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setPeekingCard(pick);
      if (oppRevealRef.current) clearTimeout(oppRevealRef.current);
      oppRevealRef.current = setTimeout(() => {
        oppRevealRef.current = null;
        setPeekingCard(null);
        passFlipper();
      }, REVEAL_MS);
    }, OPPONENT_DELAY_MS);

    return () => {
      if (oppDelayRef.current) {
        clearTimeout(oppDelayRef.current);
        oppDelayRef.current = null;
      }
    };
  }, [flipperIndex, gameOver, rolling, claimMode, bonusPicking, bonusRevealing, peekingCard, grid, wrongCards, passFlipper]);

  const enterClaimMode = useCallback(() => {
    if (opponentClaiming) return;
    setClaimMode(true);
    setSelectedCards([]);
    setMatchedCards(new Set());
    setMessage("Select 2 cards that match the rule.");
    setMessageType("info");
  }, [opponentClaiming]);


  const refillGrid = useCallback(
    (
      currentGrid: (Card | null)[],
      currentDeck: Card[],
      slotsToFill: number[]
    ): { newGrid: (Card | null)[]; newDeck: Card[] } => {
      const newGrid = [...currentGrid];
      const newDeck = [...currentDeck];
      for (const idx of slotsToFill) {
        if (newDeck.length > 0) {
          newGrid[idx] = newDeck.shift()!;
        } else {
          newGrid[idx] = null;
        }
      }
      return { newGrid, newDeck };
    },
    []
  );

  const opponentClaim = useCallback((a: number, b: number) => {
    if (claimMode || bonusPicking || bonusRevealing || rolling || gameOver) return;
    if (opponentClaiming) return;
    if (a === b) return;
    if (grid[a] === null || grid[b] === null) return;
    if (wrongCards.has(a) || wrongCards.has(b)) return;
    setOpponentClaiming({ indices: [a, b] });
  }, [claimMode, bonusPicking, bonusRevealing, rolling, gameOver, opponentClaiming, grid, wrongCards]);

  const resolveOpponentClaim = useCallback((picks?: number[]) => {
    if (!opponentClaiming) return;
    const [a, b] = opponentClaiming.indices;
    const cardA = grid[a];
    const cardB = grid[b];
    if (cardA && cardB && cardsMatchRule(cardA, cardB, matchRule)) {
      if (isDoubleMatch) {
        const extra = (picks ?? [])
          .filter((i) => i !== a && i !== b && grid[i] !== null && !wrongCards.has(i))
          .slice(0, 2);
        const allSlots = [a, b, ...extra];
        const { newGrid, newDeck } = refillGrid(grid, deck, allSlots);
        setGrid(newGrid);
        setDeck(newDeck);
        setScores((s) => {
          const next = [...s];
          next[1] += 4;
          return next;
        });
        setMessage("Opponent claim — DOUBLE MATCH! +4");
        setMessageType("warning");
        checkGameOver(newDeck, newGrid, matchRule);
      } else {
        const { newGrid, newDeck } = refillGrid(grid, deck, [a, b]);
        setGrid(newGrid);
        setDeck(newDeck);
        setScores((s) => {
          const next = [...s];
          next[1] += 2;
          return next;
        });
        setMessage("Opponent claim — correct! +2");
        setMessageType("warning");
        checkGameOver(newDeck, newGrid, matchRule);
      }
    } else {
      setWrongCards((prev) => {
        const n = new Set(prev);
        n.add(a);
        n.add(b);
        return n;
      });
      setSkipNextFlip((s) => {
        const n = [...s];
        n[1] = true;
        return n;
      });
      setMessage("Opponent claim — wrong! They lose their next flip.");
      setMessageType("info");
    }
    setOpponentClaiming(null);
  }, [opponentClaiming, grid, matchRule, isDoubleMatch, deck, refillGrid, checkGameOver, wrongCards]);

  const selectCard = useCallback(
    (index: number) => {
      if (!claimMode || bonusPicking) return;
      if (wrongCards.has(index)) return;
      if (selectedCards.includes(index)) return;
      if (grid[index] === null) return;
      if (selectedCards.length >= 2) return;
      setSelectedCards([...selectedCards, index]);
    },
    [claimMode, bonusPicking, selectedCards, grid, wrongCards]
  );

  const resolveMatch = useCallback(() => {
    if (selectedCards.length !== 2) return;

    const a = grid[selectedCards[0]];
    const b = grid[selectedCards[1]];

    if (a && b && cardsMatchRule(a, b, matchRule)) {
      setMatchedCards(new Set(selectedCards));
      setScores((s) => {
        const next = [...s];
        next[0] += 2;
        return next;
      });
      if (isDoubleMatch) {
        setBonusPicking(true);
        setBonusPicks([]);
        setMessage("DOUBLE MATCH!");
        setMessageType("success");
      } else {
        // Refill grid, but do NOT advance round or re-roll dice
        const { newGrid, newDeck } = refillGrid(grid, deck, selectedCards);
        setGrid(newGrid);
        setDeck(newDeck);
        setClaimMode(false);
        setSelectedCards([]);
        setMatchedCards(new Set());
        setMessage("Correct! +2 points.");
        setMessageType("success");
        checkGameOver(newDeck, newGrid, matchRule);
      }
    } else {
      // Wrong claim → claimant (human = 0) loses their next flip
      setWrongCards(new Set(selectedCards));
      setSkipNextFlip((s) => {
        const n = [...s];
        n[0] = true;
        return n;
      });
      setSelectedCards([]);
      setClaimMode(false);
      setMessage("No match! You lose your next flip.");
      setMessageType("error");
    }
  }, [selectedCards, grid, matchRule, isDoubleMatch, deck, refillGrid, checkGameOver]);

  const removeMatchedFromGrid = useCallback(() => {
    setGrid((prev) => {
      const next = [...prev];
      matchedCards.forEach((idx) => { next[idx] = null; });
      return next;
    });
  }, [matchedCards]);

  const finalizeBonus = useCallback(() => {
    setScores((s) => {
      const next = [...s];
      next[0] += 2;
      return next;
    });
    const allSlots = [...Array.from(matchedCards), ...bonusPicks];
    const { newGrid, newDeck } = refillGrid(grid, deck, allSlots);
    setGrid(newGrid);
    setDeck(newDeck);
    setBonusPicking(false);
    setBonusPicks([]);
    setBonusRevealing(false);
    setClaimMode(false);
    setSelectedCards([]);
    setMatchedCards(new Set());
    setMessage("Bonus! +4 points total.");
    setMessageType("success");
    checkGameOver(newDeck, newGrid, matchRule);
  }, [matchedCards, bonusPicks, grid, deck, refillGrid, checkGameOver, matchRule]);

  const pickBonus = useCallback(
    (index: number) => {
      if (!bonusPicking || bonusRevealing) return;
      if (wrongCards.has(index)) return;
      if (bonusPicks.includes(index)) return;
      if (grid[index] === null) return;
      if (matchedCards.has(index)) return;

      const maxPicks = Math.min(
        2,
        grid.filter((c, i) => c !== null && !matchedCards.has(i) && !wrongCards.has(i)).length
      );

      if (maxPicks === 0) {
        finalizeBonus();
        return;
      }

      const next = [...bonusPicks, index];
      setBonusPicks(next);

      if (next.length >= maxPicks) {
        setBonusRevealing(true);
      }
    },
    [bonusPicking, bonusRevealing, bonusPicks, grid, matchedCards, wrongCards, finalizeBonus]
  );

  return {
    deck,
    grid,
    matchRule,
    dieValues,
    isDoubleMatch,
    scores,
    roundNum,
    players: PLAYERS as unknown as string[],
    rollerIndex,
    flipperIndex,
    skipNextFlip,
    peekingCard,
    claimMode,
    selectedCards,
    wrongCards,
    matchedCards,
    bonusPicking,
    bonusPicks,
    bonusRevealing,
    gameOver,
    message,
    messageType,
    rolling,
    peekCard,
    enterClaimMode,
    selectCard,
    pickBonus,
    removeMatchedFromGrid,
    resolveMatch,
    doRollDice,
    finalizeBonus,
    opponentClaiming,
    opponentClaim,
    resolveOpponentClaim,
  };
}
