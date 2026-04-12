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
  return roundNum % 2 === 0 ? 1 : 2;
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

export function useGameState(tier: Tier = "standard") {
  const [deck, setDeck] = useState<Card[]>([]);
  const [grid, setGrid] = useState<(Card | null)[]>(Array(6).fill(null));
  const [matchRule, setMatchRule] = useState<string[]>([]);
  const [dieValues, setDieValues] = useState<string[]>([]);
  const [isDouble, setIsDouble] = useState(false);
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

  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRollDice = useCallback(
    (currentRound: number) => {
      const count = getDieCount(tier, currentRound);
      const values = rollRandomAttributes(count);
      let rule: string[];
      let double = false;

      if (values.length === 2 && values[0] === values[1]) {
        rule = [values[0]];
        double = true;
      } else {
        rule = values;
        double = false;
      }

      setDieValues(values);
      setMatchRule(rule);
      setIsDouble(double);
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
      if (hasCards && !hasValidPair(currentGrid, rule)) {
        if (currentDeck.length === 0) {
          setGameOver(true);
          setMessage("Game over! No valid pairs left.");
          setMessageType("info");
          return true;
        }
      }
      return false;
    },
    []
  );

  // Init
  useEffect(() => {
    const newDeck = createDeck();
    const dealt = newDeck.splice(0, 6);
    const newGrid = dealt.concat(Array(6 - dealt.length).fill(null));
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
    // Roll dice after init - need to do it inline
    const count = getDieCount(tier, 1);
    const values = rollRandomAttributes(count);
    let rule: string[];
    let double = false;
    if (values.length === 2 && values[0] === values[1]) {
      rule = [values[0]];
      double = true;
    } else {
      rule = values;
      double = false;
    }
    setDieValues(values);
    setMatchRule(rule);
    setIsDouble(double);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  const peekCard = useCallback((index: number) => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    setPeekingCard(index);
    peekTimerRef.current = setTimeout(() => setPeekingCard(null), 2000);
  }, []);

  const enterClaimMode = useCallback(() => {
    setClaimMode(true);
    setSelectedCards([]);
    setWrongCards(new Set());
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

      const next = [...selectedCards, index];
      setSelectedCards(next);

      if (next.length === 2) {
        const a = grid[next[0]];
        const b = grid[next[1]];
        if (a && b && cardsMatchRule(a, b, matchRule)) {
          // Correct match
          setMatchedCards(new Set(next));
          if (isDouble) {
            setScore((s) => s + 2);
            setBonusPicking(true);
            setBonusPicks([]);
            setMessage("Double! Pick 2 bonus cards.");
            setMessageType("success");
          } else {
            setScore((s) => s + 2);
            const nextRound = roundNum + 1;
            setRoundNum(nextRound);

            const { newGrid, newDeck } = refillGrid(grid, deck, next);
            setGrid(newGrid);
            setDeck(newDeck);

            const rule = doRollDice(nextRound);
            setClaimMode(false);
            setSelectedCards([]);
            setMatchedCards(new Set());
            setMessage("Correct! +2 points.");
            setMessageType("success");

            checkGameOver(newDeck, newGrid, rule);
          }
        } else {
          // Wrong
          setWrongCards(new Set(next));
          setSelectedCards([]);
          setMessage("No match! Try again or skip.");
          setMessageType("error");
        }
      }
    },
    [claimMode, bonusPicking, selectedCards, grid, matchRule, isDouble, roundNum, deck, refillGrid, doRollDice, checkGameOver]
  );

  const pickBonus = useCallback(
    (index: number) => {
      if (!bonusPicking) return;
      if (bonusPicks.includes(index)) return;
      if (grid[index] === null) return;
      // Can't pick the matched cards
      if (matchedCards.has(index)) return;

      const next = [...bonusPicks, index];
      setBonusPicks(next);

      if (next.length === 2) {
        setScore((s) => s + 2); // +2 bonus on top of the 2 already added
        const nextRound = roundNum + 1;
        setRoundNum(nextRound);

        const allSlots = [...Array.from(matchedCards), ...next];
        const { newGrid, newDeck } = refillGrid(grid, deck, allSlots);
        setGrid(newGrid);
        setDeck(newDeck);

        const rule = doRollDice(nextRound);
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
    [bonusPicking, bonusPicks, grid, matchedCards, roundNum, deck, refillGrid, doRollDice, checkGameOver]
  );

  const skipRound = useCallback(() => {
    const nextRound = roundNum + 1;
    setRoundNum(nextRound);
    setClaimMode(false);
    setSelectedCards([]);
    setWrongCards(new Set());
    setMatchedCards(new Set());
    setBonusPicking(false);
    setBonusPicks([]);

    const rule = doRollDice(nextRound);
    setMessage("Round skipped.");
    setMessageType("warning");

    checkGameOver(deck, grid, rule);
  }, [roundNum, doRollDice, deck, grid, checkGameOver]);

  return {
    deck,
    grid,
    matchRule,
    dieValues,
    isDouble,
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
    peekCard,
    enterClaimMode,
    selectCard,
    pickBonus,
    skipRound,
  };
}
