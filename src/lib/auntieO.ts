export const OPPONENT_NAME = "Auntie O.";

export const LINES: Record<string, string[]> = {
  gameStart: [
    "Sit down, sweetheart.",
    "I hope you stretched.",
    "Shuffle up. I'll wait.",
  ],
  oppCorrect: [
    "That's how it's done, baby.",
    "Some things you just don't forget.",
    "Write that one down.",
  ],
  oppWrong: [
    "...I meant to do that.",
    "Who moved my cards?",
    "Hm. New glasses Monday.",
  ],
  playerCorrect: [
    "Mm. Lucky.",
    "Okay, I see you.",
    "Don't get comfortable.",
  ],
  playerWrong: [
    "Bless your heart.",
    "Close. Not really.",
    "Memory's a muscle, baby.",
  ],
  oppDouble: [
    "Double? Don't mind if I do.",
    "I'll take those. And those.",
  ],
  win: [
    "Dinner's ruined. You're welcome.",
    "Same time next week?",
  ],
  lose: [
    "I let you win. Tell everyone.",
    "Rematch. Now.",
  ],
  oppRoll: [
    "My roll.",
    "Let's see here…",
    "Dice, be nice.",
  ],
  lastCallStart: [
    "Oh, NOW we're playing.",
    "Grab what you can, baby.",
    "Last call! Move.",
  ],
  lastCallGrab: [
    "Mine.",
    "Too slow.",
    "Snooze, you lose.",
  ],
};


const lastIndexByEvent: Record<string, number> = {};

export function pickLine(event: string): string {
  const lines = LINES[event];
  if (!lines || lines.length === 0) return "";
  if (lines.length === 1) return lines[0];

  const lastIndex = lastIndexByEvent[event];
  let nextIndex: number;
  do {
    nextIndex = Math.floor(Math.random() * lines.length);
  } while (nextIndex === lastIndex);

  lastIndexByEvent[event] = nextIndex;
  return lines[nextIndex];
}
