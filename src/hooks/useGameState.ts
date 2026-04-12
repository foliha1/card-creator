import { useState, useCallback, useRef, useEffect } from "react";
import { Card, createDeck, ATTRIBUTES } from "@/cardData";

type MessageType = "info" | "success" | "error" | "warning";
type Tier = "easy" | "standard" | "cutthroat";

function rollRandomAttributes(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)]);
  }
  return result;
}

function getDieCount(tier: Tier, roundNum: number): number {
  if (tier === "easy") return 1;
  if (tier === "cutthroat") return 2;
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

/** isDoubleMatch = true when 2 dice show DIFFERENT attributes (genuine double match) */
function computeRule(values: string[]): { rule: string[]; isDoubleMatch: boolean } {
  if (values.length === 2 && values[0] !== values[1]) {
    return { rule: values, isDoubleMatch: true };
  }
  // Single die, or two dice showing same attribute (collapses to single match)
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
  const [score, setScore] = useState(0);
  const [roundNum, setRoundNum] = useState(1);
  const [peekingCard, setPeekingCard] = useState<number | null>(null);
  const [claimMode, setClaimMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [wrongCards, setWrongCards] = useState<Set<number>>(new Set());
  const [matchedCards, setMatchedCards] = useState<Set<number>>(new Set());
  const [bonusPicking, setBonusPicking] = useState(false);
  const [bonusPicks, setBonusPicks] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [rolling, setRolling] = useState(false);

  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    (currentDeck: Card[], currentGrid: (Card | null)[], rule: string[]) => {
      const hasCards = currentGrid.some((c) => c !== null);
      if (!hasCards && currentDeck.length === 0) {
        setGameOver(true);
        setMessage("Game over! No cards remaining.");
        setMessageType("info");
        return true;
      }
      if (hasCards && currentDeck.length === 0 && !hasValidPair(currentGrid, rule)) {
        setGameOver(true);
        setMessage("Game over! No valid pairs left.");
        setMessageType("info");
        return true;
      }
      return false;
    },
    []
  );

  // Init
  useEffect(() => {
    const newDeck = createDeck();
    const dealt = newDeck.splice(0, slotCount);
    const newGrid = dealt.concat(Array(slotCount - dealt.length).fill(null));
    setDeck(newDeck);
    setGrid(newGrid);
    setScore(0);
    setRoundNum(1);
    setGameOver(false);
    setClaimMode(false);
    setSelectedCards([]);
    setWrongCards(new Set());
    setMatchedCards(new Set());
    setBonusPicking(false);
    setBonusPicks([]);
    setMessage("");
    const count = getDieCount(tier, 1);
    const values = rollRandomAttributes(count);
    const { rule, isDoubleMatch: dm } = computeRule(values);
    setDieValues(values);
    setMatchRule(rule);
    setIsDoubleMatch(dm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, slotCount]);

  const autoRerollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [needsAutoReroll, setNeedsAutoReroll] = useState(false);

  // Effect-based auto-reroll: watches grid/matchRule and triggers when no valid pairs exist
  useEffect(() => {
    if (gameOver || rolling || claimMode || bonusPicking) return;
    if (!grid.some((c) => c !== null)) return;
    if (hasValidPair(grid, matchRule)) return;
    // No valid pairs — flag for auto-reroll
    setNeedsAutoReroll(true);
  }, [grid, matchRule, gameOver, rolling, claimMode, bonusPicking]);

  useEffect(() => {
    if (!needsAutoReroll || gameOver) return;
    if (autoRerollRef.current) return;
    setMessage("No matches available — re-rolling!");
    setMessageType("warning");
    autoRerollRef.current = setTimeout(() => {
      autoRerollRef.current = null;
      setNeedsAutoReroll(false);
      setRoundNum((prev) => {
        const nextRound = prev + 1;
        const count = getDieCount(tier, nextRound);
        const values = rollRandomAttributes(count);
        const { rule, isDoubleMatch: dm } = computeRule(values);
        setDieValues(values);
        setMatchRule(rule);
        setIsDoubleMatch(dm);
        setClaimMode(false);
        setSelectedCards([]);
        setWrongCards(new Set());
        setMatchedCards(new Set());
        setBonusPicking(false);
        setBonusPicks([]);
        return nextRound;
      });
    }, 1500);
    return () => {
      if (autoRerollRef.current) {
        clearTimeout(autoRerollRef.current);
        autoRerollRef.current = null;
      }
    };
  }, [needsAutoReroll, gameOver, tier]);

  const peekCard = useCallback((index: number) => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    setPeekingCard(index);
    peekTimerRef.current = setTimeout(() => {
      setPeekingCard(null);
      if (!hasValidPair(grid, matchRule)) {
        autoReroll();
      }
    }, 1000);
  }, [grid, matchRule, autoReroll]);

  const enterClaimMode = useCallback(() => {
    setClaimMode(true);
    setSelectedCards([]);
    setMatchedCards(new Set());
    setMessage("Select 2 cards that match the rule.");
    setMessageType("info");
  }, []);

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

  const selectCard = useCallback(
    (index: number) => {
      if (!claimMode || bonusPicking) return;
      if (selectedCards.includes(index)) return;
      if (grid[index] === null) return;
      if (selectedCards.length >= 2) return;

      setSelectedCards([...selectedCards, index]);
    },
    [claimMode, bonusPicking, selectedCards, grid]
  );

  const resolveMatch = useCallback(() => {
    if (selectedCards.length !== 2) return;

    const a = grid[selectedCards[0]];
    const b = grid[selectedCards[1]];

    if (a && b && cardsMatchRule(a, b, matchRule)) {
      setMatchedCards(new Set(selectedCards));
      setScore((s) => s + 2);
      if (isDoubleMatch) {
        setBonusPicking(true);
        setBonusPicks([]);
        setMessage("DOUBLE MATCH!");
        setMessageType("success");
      } else {
        const nextRound = roundNum + 1;
        setRoundNum(nextRound);

        const { newGrid, newDeck } = refillGrid(grid, deck, selectedCards);
        setGrid(newGrid);
        setDeck(newDeck);

        const rule = doRollDiceSync(nextRound);
        setClaimMode(false);
        setSelectedCards([]);
        setMatchedCards(new Set());
        setMessage("Correct! +2 points.");
        setMessageType("success");

        checkGameOver(newDeck, newGrid, rule);
      }
    } else {
      setWrongCards(new Set(selectedCards));
      setSelectedCards([]);
      setClaimMode(false);
      setMessage("No match! Try again.");
      setMessageType("error");
    }
  }, [selectedCards, grid, matchRule, isDoubleMatch, roundNum, deck, refillGrid, doRollDiceSync, checkGameOver]);

  const removeMatchedFromGrid = useCallback(() => {
    setGrid((prev) => {
      const next = [...prev];
      matchedCards.forEach((idx) => { next[idx] = null; });
      return next;
    });
  }, [matchedCards]);

  const pickBonus = useCallback(
    (index: number) => {
      if (!bonusPicking) return;
      if (bonusPicks.includes(index)) return;
      if (grid[index] === null) return;
      if (matchedCards.has(index)) return;

      const next = [...bonusPicks, index];
      setBonusPicks(next);

      const maxPicks = Math.min(2, grid.filter((c, i) => c !== null && !matchedCards.has(i)).length);

      if (next.length >= maxPicks) {
        setScore((s) => s + 2);
        const nextRound = roundNum + 1;
        setRoundNum(nextRound);

        const allSlots = [...Array.from(matchedCards), ...next];
        const { newGrid, newDeck } = refillGrid(grid, deck, allSlots);
        setGrid(newGrid);
        setDeck(newDeck);

        const rule = doRollDiceSync(nextRound);
        setBonusPicking(false);
        setBonusPicks([]);
        setClaimMode(false);
        setSelectedCards([]);
        setMatchedCards(new Set());
        setMessage("Bonus! +4 points total.");
        setMessageType("success");

        checkGameOver(newDeck, newGrid, rule);
      }
    },
    [bonusPicking, bonusPicks, grid, matchedCards, roundNum, deck, refillGrid, doRollDiceSync, checkGameOver]
  );

  return {
    deck,
    grid,
    matchRule,
    dieValues,
    isDoubleMatch,
    score,
    roundNum,
    peekingCard,
    claimMode,
    selectedCards,
    wrongCards,
    matchedCards,
    bonusPicking,
    bonusPicks,
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
  };
}