import { useState, useCallback, useRef, useEffect } from "react";
import { Card, createDeck, ATTRIBUTES } from "@/cardData";
import { createOpponentMemory } from "@/lib/opponentMemory";

type MessageType = "info" | "success" | "error" | "warning";

const PLAYERS = ["you", "opponent"] as const;
export const OPPONENT_TUNING = {
  reactionMinMs: 2500,
  reactionMaxMs: 5500,
  confidenceThreshold: 0.55,
  thinkDelayMs: 1400,
} as const;
const REVEAL_MS = 2000;

function rollRandomAttributes(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)]);
  }
  return result;
}

// v6.1 Single-Die Core: always roll exactly one die.
function getDieCount(): number {
  return 1;
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
  const allRules: string[][] = [["SHAPE"], ["NUMBER"], ["COLOR"]];
  return allRules.some((rule) => hasValidPair(grid, rule));
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function computeRule(values: string[]): { rule: string[] } {
  // Single-die core: rule is always a single-attribute array.
  return { rule: [values[0]] };
}

export function useGameState(gridSize: "3x2" | "3x3" = "3x2") {
  const slotCount = gridSize === "3x3" ? 9 : 6;
  const [deck, setDeck] = useState<Card[]>([]);
  const [grid, setGrid] = useState<(Card | null)[]>(Array(slotCount).fill(null));
  const [matchRule, setMatchRule] = useState<string[]>([]);
  const [dieValues, setDieValues] = useState<string[]>([]);
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
  const [opponentClaiming, setOpponentClaiming] = useState<{ indices: [number, number] } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [rolling, setRolling] = useState(false);
  const [rollPhase, setRollPhase] = useState(true);
  const [drawEmpty, setDrawEmpty] = useState(false);
  const [roundsSinceClaim, setRoundsSinceClaim] = useState(0);
  const [lastCall, setLastCall] = useState(false);
  const [allFaceUp, setAllFaceUp] = useState(false);
  const [claimPending, setClaimPending] = useState(false);

  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oppDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoryRef = useRef(createOpponentMemory());
  const prevPeekingRef = useRef<number | null>(null);
  const prevGridRef = useRef<(Card | null)[]>([]);
  const oppClaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const claimedThisRoundRef = useRef(false);
  const drawEmptyRef = useRef(false);
  const lastCallRef = useRef(false);
  // Flip opportunities used (flip OR consumed skip) since last correct claim.
  const flippedSinceClaimRef = useRef<Set<number>>(new Set());
  // Guards the winner-rolls transition from double-firing.
  const roundTransitionRef = useRef(false);
  // Mirrors flipperIndex synchronously for use inside imperative helpers.
  const flipperRef = useRef(0);
  // Mirrors rollerIndex synchronously for use inside imperative helpers.
  const rollerRef = useRef(0);
  // Mirrors claim-related state synchronously so passFlipper can bail out.
  const claimModeRef = useRef(false);
  const opponentClaimingRef = useRef<{ indices: [number, number] } | null>(null);
  const claimPendingRef = useRef(false);
  const rollPhaseRef = useRef(rollPhase);



  const doRollDice = useCallback((): Promise<string[]> => {
    const count = getDieCount();
    const finalValues = rollRandomAttributes(count);
    const { rule } = computeRule(finalValues);

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
        setTimeout(() => {
          setRolling(false);
          resolve(rule);
        }, 300);
      }, 800);
    });
  }, []);

  const doRollDiceSync = useCallback((): string[] => {
    const count = getDieCount();
    const values = rollRandomAttributes(count);
    const { rule } = computeRule(values);
    setDieValues(values);
    setMatchRule(rule);
    return rule;
  }, []);
  void doRollDiceSync;

  const checkGameOver = useCallback(
    (currentDeck: Card[], currentGrid: (Card | null)[], rule: string[]) => {
      const hasCards = currentGrid.some((c) => c !== null);
      if (!hasCards && currentDeck.length === 0) {
        setGameOver(true);
        return true;
      }
      if (lastCallRef.current && hasCards && !hasValidPair(currentGrid, rule)) {
        setGameOver(true);
        return true;
      }
      return false;
    },
    []
  );

  // Track draw pile empty
  useEffect(() => {
    if (deck.length === 0 && !drawEmptyRef.current) {
      drawEmptyRef.current = true;
      setDrawEmpty(true);
    }
  }, [deck.length]);


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
    setOpponentClaiming(null);
    memoryRef.current.reset();
    prevPeekingRef.current = null;
    prevGridRef.current = newGrid;
    
    if (oppClaimTimerRef.current) { clearTimeout(oppClaimTimerRef.current); oppClaimTimerRef.current = null; }
    claimedThisRoundRef.current = false;
    drawEmptyRef.current = false;
    lastCallRef.current = false;
    flippedSinceClaimRef.current = new Set();
    roundTransitionRef.current = false;
    flipperRef.current = 0;
    rollerRef.current = 0;
    setDrawEmpty(false);
    setRoundsSinceClaim(0);
    setLastCall(false);
    setAllFaceUp(false);
    setMessage("");
    rollPhaseRef.current = true;
    setRollPhase(true);

    const values = rollRandomAttributes(getDieCount());
    const { rule } = computeRule(values);
    setDieValues(values);
    setMatchRule(rule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotCount]);

  // Dead-grid safety valve: if NO possible pair exists for any rule, swap 2 cards from deck.
  useEffect(() => {
    if (gameOver || rolling || claimMode) return;
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
  }, [grid, deck, gameOver, rolling, claimMode]);


  // Sync flipperIndex → flipperRef for imperative helpers.
  useEffect(() => { flipperRef.current = flipperIndex; }, [flipperIndex]);
  useEffect(() => { rollerRef.current = rollerIndex; }, [rollerIndex]);
  useEffect(() => { claimModeRef.current = claimMode; }, [claimMode]);
  useEffect(() => { opponentClaimingRef.current = opponentClaiming; }, [opponentClaiming]);
  useEffect(() => { claimPendingRef.current = claimPending; }, [claimPending]);
  useEffect(() => { rollPhaseRef.current = rollPhase; }, [rollPhase]);


  // Start a new round. If winnerIndex is provided (correct claim), that player
  // becomes Roller and first Flipper. If null (flip-cycle completed with no
  // claim), the roll passes clockwise from the current roller.
  const startNewRound = useCallback((winnerIndex: number | null) => {
    if (roundTransitionRef.current) return;
    roundTransitionRef.current = true;
    const nextRoller =
      winnerIndex !== null
        ? winnerIndex
        : (rollerRef.current + 1) % PLAYERS.length;
    flippedSinceClaimRef.current = new Set();
    claimedThisRoundRef.current = false;
    if (winnerIndex !== null) setRoundsSinceClaim(0);
    setRoundNum((r) => r + 1);
    setRollerIndex(nextRoller);
    setFlipperIndex(nextRoller);
    flipperRef.current = nextRoller;
    rollerRef.current = nextRoller;
    setWrongCards(new Set());
    setSkipNextFlip([false, false]);
    setClaimMode(false);
    setSelectedCards([]);
    // In Last Call, no rolling — otherwise the roller rolls to start the round.
    rollPhaseRef.current = !lastCallRef.current;
    setRollPhase(!lastCallRef.current);
    setTimeout(() => { roundTransitionRef.current = false; }, 0);
  }, []);

  // Rotate flipper clockwise within the ongoing round. When the flip-cycle
  // completes (every player has had one flip opportunity since the last correct
  // claim), the round ends: either enter Last Call (draw pile empty, no claim
  // this cycle) or start a new round with the roll passing clockwise.
  const passFlipper = useCallback(() => {
    // Never advance while a claim is active or pending — the round pauses
    // until the claim resolves.
    if (claimModeRef.current || opponentClaimingRef.current || claimPendingRef.current) return;
    const prev = flipperRef.current;
    flippedSinceClaimRef.current.add(prev);


    if (flippedSinceClaimRef.current.size >= PLAYERS.length) {
      const noClaim = !claimedThisRoundRef.current;
      flippedSinceClaimRef.current = new Set();

      if (drawEmptyRef.current && noClaim && !lastCallRef.current) {
        setRoundsSinceClaim((rsc) => rsc + 1);
        lastCallRef.current = true;
        setLastCall(true);
        setAllFaceUp(true);
        setWrongCards(new Set());
        setSkipNextFlip([false, false]);
        const value = ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)];
        setDieValues([value]);
        setMatchRule([value]);
        rollPhaseRef.current = false;
        setRollPhase(false);
        return;
      }
      if (lastCallRef.current) {
        const next = (prev + 1) % PLAYERS.length;
        flipperRef.current = next;
        setFlipperIndex(next);
        return;
      }
      // No-claim round completed: roll passes clockwise.
      startNewRound(null);
      return;
    }

    const next = (prev + 1) % PLAYERS.length;
    flipperRef.current = next;
    setFlipperIndex(next);
  }, [startNewRound]);

  const skipRef = useRef(skipNextFlip);
  useEffect(() => { skipRef.current = skipNextFlip; }, [skipNextFlip]);
  const prevFlipperRef = useRef(flipperIndex);
  useEffect(() => {
    if (prevFlipperRef.current === flipperIndex) return;
    prevFlipperRef.current = flipperIndex;
    if (gameOver || rolling || claimMode || rollPhase) return;
    if (peekingCard !== null) return;
    if (!skipRef.current[flipperIndex]) return;
    const idx = flipperIndex;
    setSkipNextFlip((s) => {
      const n = [...s];
      n[idx] = false;
      return n;
    });
    skipRef.current = skipRef.current.map((v, i) => (i === idx ? false : v));
    // Consumed skip counts as a flip opportunity used this round.
    passFlipper();
  }, [flipperIndex, gameOver, rolling, claimMode, rollPhase, peekingCard, passFlipper]);

  const peekCard = useCallback((index: number) => {
    if (flipperIndex !== 0) return;
    if (rollPhase) return;
    if (claimMode || rolling || gameOver) return;
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
  }, [flipperIndex, rollPhase, claimMode, rolling, gameOver, opponentClaiming, wrongCards, grid, peekingCard, passFlipper]);

  // Opponent auto-flip when it's their turn
  useEffect(() => {
    if (flipperIndex !== 1) return;
    if (rollPhase) return;
    if (gameOver || rolling || claimMode) return;
    if (peekingCard !== null) return;

    if (oppDelayRef.current) clearTimeout(oppDelayRef.current);
    oppDelayRef.current = setTimeout(() => {
      if (
        rollPhaseRef.current ||
        gameOver ||
        claimModeRef.current ||
        opponentClaimingRef.current ||
        flipperRef.current !== 1
      ) {
        if (oppDelayRef.current) {
          clearTimeout(oppDelayRef.current);
          oppDelayRef.current = null;
        }
        return;
      }
      oppDelayRef.current = null;
      const candidates = grid
        .map((c, i) => (c !== null && !wrongCards.has(i) ? i : -1))
        .filter((i) => i !== -1);
      if (candidates.length === 0) {
        passFlipper();
        return;
      }
      const unknown = candidates.filter((i) => memoryRef.current.recall(i) === null);
      const pool = unknown.length > 0 ? unknown : candidates;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      setPeekingCard(pick);
      if (oppRevealRef.current) clearTimeout(oppRevealRef.current);
      oppRevealRef.current = setTimeout(() => {
        if (
          rollPhaseRef.current ||
          roundTransitionRef.current ||
          gameOver ||
          claimModeRef.current ||
          opponentClaimingRef.current ||
          flipperRef.current !== 1
        ) {
          if (oppRevealRef.current) {
            clearTimeout(oppRevealRef.current);
            oppRevealRef.current = null;
          }
          return;
        }
        oppRevealRef.current = null;
        setPeekingCard(null);
        passFlipper();
      }, REVEAL_MS);
    }, OPPONENT_TUNING.thinkDelayMs);

    return () => {
      if (oppDelayRef.current) {
        clearTimeout(oppDelayRef.current);
        oppDelayRef.current = null;
      }
      if (oppRevealRef.current) {
        clearTimeout(oppRevealRef.current);
        oppRevealRef.current = null;
      }
    };
  }, [flipperIndex, rollPhase, gameOver, rolling, claimMode, peekingCard, grid, wrongCards, passFlipper]);

  const enterClaimMode = useCallback(() => {
    if (opponentClaiming || claimMode || gameOver) return;
    if (rolling) return;
    // Cancel any in-flight peek timer so the auto passFlipper() doesn't fire
    // once the player has committed to claiming. Their flip is "held" by the
    // claim; flippedSinceClaimRef still records it below so the cycle count
    // stays correct for Last Call detection.
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    setPeekingCard(null);
    if (rollPhase) {
      if (rollerIndex !== 0) return;
      if (claimPending) return;
      claimPendingRef.current = true;
      setClaimPending(true);
      (async () => {
        try {
          await doRollDice();
          rollPhaseRef.current = false;
          setRollPhase(false);
          claimModeRef.current = true;
          setClaimMode(true);
          setSelectedCards([]);
          setMatchedCards(new Set());
          setMessage("Select 2 cards that match the rule.");
          setMessageType("info");
        } catch {
          rollPhaseRef.current = false;
          setRollPhase(false);
        } finally {
          claimPendingRef.current = false;
          setClaimPending(false);
        }
      })();
      return;
    }
    // Held flip counts toward the cycle even though passFlipper was canceled.
    flippedSinceClaimRef.current.add(flipperRef.current);
    claimModeRef.current = true;
    setClaimMode(true);
    setSelectedCards([]);
    setMatchedCards(new Set());
    setMessage("Select 2 cards that match the rule.");
    setMessageType("info");
  }, [opponentClaiming, claimMode, gameOver, rolling, rollPhase, rollerIndex, claimPending, doRollDice]);



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
    if (claimMode || rolling || gameOver) return;
    if (rollPhase) return;
    if (opponentClaiming) return;
    if (a === b) return;
    if (grid[a] === null || grid[b] === null) return;
    if (wrongCards.has(a) || wrongCards.has(b)) return;
    setOpponentClaiming({ indices: [a, b] });
  }, [claimMode, rolling, gameOver, rollPhase, opponentClaiming, grid, wrongCards]);

  const rollDice = useCallback(async () => {
    if (!rollPhase) return;
    if (rollerIndex !== 0) return;
    if (rolling || gameOver) return;
    await doRollDice();
    rollPhaseRef.current = false;
    setRollPhase(false);
  }, [rollPhase, rollerIndex, rolling, gameOver, doRollDice]);


  const resolveOpponentClaim = useCallback(() => {
    if (!opponentClaiming) return;
    const [a, b] = opponentClaiming.indices;
    const cardA = grid[a];
    const cardB = grid[b];
    if (cardA && cardB && cardsMatchRule(cardA, cardB, matchRule)) {
      claimedThisRoundRef.current = true;
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
      setOpponentClaiming(null);
      const ended = checkGameOver(newDeck, newGrid, matchRule);
      // Winner rolls: opponent becomes next Roller and Flipper.
      if (!ended) startNewRound(1);
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
      setOpponentClaiming(null);
    }
  }, [opponentClaiming, grid, matchRule, deck, refillGrid, checkGameOver, startNewRound]);

  const selectCard = useCallback(
    (index: number) => {
      if (!claimMode) return;
      if (wrongCards.has(index)) return;
      if (selectedCards.includes(index)) return;
      if (grid[index] === null) return;
      if (selectedCards.length >= 2) return;
      setSelectedCards([...selectedCards, index]);
    },
    [claimMode, selectedCards, grid, wrongCards]
  );

  const resolveMatch = useCallback(() => {
    if (selectedCards.length !== 2) return;

    const a = grid[selectedCards[0]];
    const b = grid[selectedCards[1]];

    if (a && b && cardsMatchRule(a, b, matchRule)) {
      claimedThisRoundRef.current = true;
      setMatchedCards(new Set(selectedCards));

      setScores((s) => {
        const next = [...s];
        next[0] += 2;
        return next;
      });
      const { newGrid, newDeck } = refillGrid(grid, deck, selectedCards);
      setGrid(newGrid);
      setDeck(newDeck);
      setClaimMode(false);
      setSelectedCards([]);
      setMatchedCards(new Set());
      setMessage("Correct! +2 points.");
      setMessageType("success");
      const ended = checkGameOver(newDeck, newGrid, matchRule);
      // Winner rolls: human becomes next Roller and Flipper.
      if (!ended) startNewRound(0);
    } else {
      setWrongCards(new Set(selectedCards));
      setSkipNextFlip((s) => {
        const n = [...s];
        n[0] = true;
        return n;
      });
      setSelectedCards([]);
      claimModeRef.current = false;
      setClaimMode(false);
      setMessage("No match! You lose your next flip.");
      setMessageType("error");
      // Claim is over; resume the cycle. The claimant's flip was already
      // recorded in flippedSinceClaimRef when they entered claim mode, so
      // passFlipper will correctly end the round if the cycle is complete.
      passFlipper();
    }

  }, [selectedCards, grid, matchRule, deck, refillGrid, checkGameOver, startNewRound, passFlipper]);

  const removeMatchedFromGrid = useCallback(() => {
    setGrid((prev) => {
      const next = [...prev];
      matchedCards.forEach((idx) => { next[idx] = null; });
      return next;
    });
  }, [matchedCards]);

  // Memory: forget slots whose card changed or emptied
  useEffect(() => {
    const prev = prevGridRef.current;
    for (let i = 0; i < grid.length; i++) {
      const pc = prev[i] ?? null;
      const cc = grid[i] ?? null;
      if ((pc?.id ?? null) !== (cc?.id ?? null)) {
        memoryRef.current.forget(i);
      }
    }
    prevGridRef.current = grid;
  }, [grid]);

  // Memory: observe on completed reveal + schedule opponent claim check
  useEffect(() => {
    const prev = prevPeekingRef.current;
    prevPeekingRef.current = peekingCard;
    if (prev === null || peekingCard !== null) return;
    const card = grid[prev];
    memoryRef.current.decayAll();
    if (card) memoryRef.current.observe(prev, card);

    if (claimMode || opponentClaiming || gameOver || rollPhase) return;
    const excluded = new Set<number>(wrongCards);
    grid.forEach((c, i) => { if (c === null) excluded.add(i); });
    const best = memoryRef.current.bestPair(matchRule, excluded);
    if (!best || best.confidence < OPPONENT_TUNING.confidenceThreshold) return;
    const span = OPPONENT_TUNING.reactionMaxMs - OPPONENT_TUNING.reactionMinMs;
    const t = Math.max(
      0,
      Math.min(
        1,
        (best.confidence - OPPONENT_TUNING.confidenceThreshold) /
          (2 - OPPONENT_TUNING.confidenceThreshold)
      )
    );
    const delay = OPPONENT_TUNING.reactionMaxMs - t * span;
    if (oppClaimTimerRef.current) clearTimeout(oppClaimTimerRef.current);
    oppClaimTimerRef.current = setTimeout(() => {
      oppClaimTimerRef.current = null;
      opponentClaim(best.a, best.b);
    }, delay);
  }, [peekingCard, grid, claimMode, opponentClaiming, gameOver, rollPhase, wrongCards, matchRule, opponentClaim]);

  useEffect(() => {
    if (oppClaimTimerRef.current) {
      clearTimeout(oppClaimTimerRef.current);
      oppClaimTimerRef.current = null;
    }
  }, [claimMode, roundNum]);

  useEffect(() => {
    if (!opponentClaiming) return;
    const t = setTimeout(() => {
      resolveOpponentClaim();
    }, 1600);
    return () => clearTimeout(t);
  }, [opponentClaiming, resolveOpponentClaim]);

  // Auto-roll for opponent roller during rollPhase
  useEffect(() => {
    if (!rollPhase) return;
    if (rollerIndex !== 1) return;
    if (rolling || gameOver) return;
    const t = setTimeout(() => {
      doRollDice().then(() => { rollPhaseRef.current = false; setRollPhase(false); });
    }, OPPONENT_TUNING.thinkDelayMs);
    return () => clearTimeout(t);
  }, [rollPhase, rollerIndex, rolling, gameOver, doRollDice]);


  const claimLastCall = useCallback(
    (a: number, b: number) => {
      if (!lastCallRef.current || gameOver) return;
      if (a === b) return;
      const cardA = grid[a];
      const cardB = grid[b];
      if (!cardA || !cardB) return;
      if (!cardsMatchRule(cardA, cardB, matchRule)) return;
      const newGrid = [...grid];
      newGrid[a] = null;
      newGrid[b] = null;
      setGrid(newGrid);
      setScores((s) => {
        const next = [...s];
        next[0] += 2;
        return next;
      });
      setMessage("Last Call — you claimed! +2");
      setMessageType("success");
      const hasCards = newGrid.some((c) => c !== null);
      if (!hasCards || !hasValidPair(newGrid, matchRule)) {
        setGameOver(true);
      }
    },
    [grid, matchRule, gameOver]
  );

  // Opponent Last Call scanner
  useEffect(() => {
    if (!lastCall || gameOver) return;
    const delay = 1200 + Math.random() * 1600;
    const t = setTimeout(() => {
      if (!lastCallRef.current || gameOver) return;
      const cards = grid
        .map((c, i) => ({ c, i }))
        .filter((x): x is { c: Card; i: number } => x.c !== null);
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          if (cardsMatchRule(cards[i].c, cards[j].c, matchRule)) {
            pairs.push([cards[i].i, cards[j].i]);
          }
        }
      }
      if (pairs.length === 0) return;
      const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
      const newGrid = [...grid];
      newGrid[a] = null;
      newGrid[b] = null;
      setGrid(newGrid);
      setScores((s) => {
        const next = [...s];
        next[1] += 2;
        return next;
      });
      setMessage("Last Call — Auntie O. claimed! +2");
      setMessageType("warning");
      const hasCards = newGrid.some((c) => c !== null);
      if (!hasCards || !hasValidPair(newGrid, matchRule)) {
        setGameOver(true);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [lastCall, gameOver, grid, matchRule, scores]);


  return {
    deck,
    grid,
    matchRule,
    dieValues,
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
    gameOver,
    message,
    messageType,
    rolling,
    peekCard,
    enterClaimMode,
    selectCard,
    removeMatchedFromGrid,
    resolveMatch,
    doRollDice,
    opponentClaiming,
    opponentClaim,
    resolveOpponentClaim,
    rollPhase,
    rollDice,
    lastCall,
    allFaceUp,
    drawEmpty,
    roundsSinceClaim,
    claimLastCall,
    claimPending,
  };
}
