// ============================================================================
// Daily share image — a 1080x1350 PNG drawn with the Canvas 2D API.
//
// Marks and counts only: never a card face, a grid position, the rule that was
// rolled, or anything else that could spoil the day's puzzle.
// ============================================================================

import { DAILY_ROUNDS } from "@/lib/dailyEngine";
import type { DailyResult } from "@/lib/daily";
import { COLORS, FONT_FAMILY } from "@/lib/tokens";

export const SHARE_IMAGE_W = 1080;
export const SHARE_IMAGE_H = 1350;

const PAD = 80;
const CONTENT_W = SHARE_IMAGE_W - PAD * 2; // 920

const LOGO_SRC = "/WhoopWhoop_Dark_Logo.svg";

/** Streaks only make the card at 3+ days — below that it's clutter. */
const SHARE_STREAK_MIN = 3;

// --- Shape rule geometry ----------------------------------------------------
// The on-screen rule (`DailyShapeRule`) paints a pre-baked seamless SVG tile,
// so there is no shared JS sequence to import; this is the canvas-side
// expression of the same brand rhythm.
const RULE_H = 49.24;
const RULE_ITEM_W = 42.67;
const RULE_GAP = 20;
const RULE_COUNT = 15;
const SQUARE_H = 42.65;
/** Indices that break the 4-step cycle with a warm-black inverted triangle. */
const RULE_INK_DOWN = new Set([10, 14]);

type RuleItem =
  | { kind: "tri"; color: string; down: boolean }
  | { kind: "square"; color: string };

const ruleItem = (i: number): RuleItem => {
  if (RULE_INK_DOWN.has(i)) return { kind: "tri", color: COLORS.ink, down: true };
  switch (i % 4) {
    case 0:
      return { kind: "tri", color: COLORS.ink, down: false };
    case 1:
      return { kind: "square", color: COLORS.orange };
    case 2:
      return { kind: "tri", color: COLORS.blue, down: true };
    default:
      return { kind: "square", color: COLORS.red };
  }
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
};

/** The brand shape rule: 15 items on a 42.67 + 20 pitch, 920 wide. */
const drawShapeRule = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  for (let i = 0; i < RULE_COUNT; i++) {
    const ix = x + i * (RULE_ITEM_W + RULE_GAP);
    const item = ruleItem(i);
    ctx.fillStyle = item.color;

    if (item.kind === "square") {
      ctx.fillRect(ix, y + (RULE_H - SQUARE_H) / 2, RULE_ITEM_W, SQUARE_H);
      continue;
    }

    ctx.beginPath();
    if (item.down) {
      ctx.moveTo(ix, y);
      ctx.lineTo(ix + RULE_ITEM_W, y);
      ctx.lineTo(ix + RULE_ITEM_W / 2, y + RULE_H);
    } else {
      ctx.moveTo(ix + RULE_ITEM_W / 2, y);
      ctx.lineTo(ix + RULE_ITEM_W, y + RULE_H);
      ctx.lineTo(ix, y + RULE_H);
    }
    ctx.closePath();
    ctx.fill();
  }
};

/** The score line, matching the wording used in the share text. */
export function scoreLine(result: DailyResult, streak?: number | null): string {
  const solved = result.roundsSolved ?? 0;
  const misses = result.totalMisses ?? 0;
  const base =
    solved === 0
      ? "Whooped! Better luck tomorrow"
      : `${solved} of ${DAILY_ROUNDS} · ${
          misses === 0 ? "Clean" : `${misses} ${misses === 1 ? "miss" : "misses"}`
        }`;
  return typeof streak === "number" && streak >= SHARE_STREAK_MIN
    ? `${base} · ${streak} day streak`
    : base;
}

/**
 * Render the day's result as a shareable PNG. Rejects if the canvas or the
 * logo is unavailable — callers fall back to the text-only share path.
 */
export async function renderDailyShareImage(
  result: DailyResult,
  streak?: number | null
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_IMAGE_W;
  canvas.height = SHARE_IMAGE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts API flaked — draw with whatever is loaded */
    }
  }

  const logo = await loadImage(LOGO_SRC);

  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, 0, SHARE_IMAGE_W, SHARE_IMAGE_H);

  // --- Vertical rhythm: space-between between the five stacked blocks -------
  const HEADER_H = 331.4;
  const PANEL_W = 484;
  const PANEL_H = 446;
  const SCORE_H = 90;
  const blocks = [RULE_H, HEADER_H, PANEL_H, SCORE_H, RULE_H];
  const free =
    SHARE_IMAGE_H - PAD * 2 - blocks.reduce((a, b) => a + b, 0);
  const gap = free / (blocks.length - 1);

  let y = PAD;
  const advance = (h: number) => {
    const top = y;
    y += h + gap;
    return top;
  };

  // --- 1. Top shape rule ----------------------------------------------------
  drawShapeRule(ctx, PAD, advance(RULE_H));

  // --- 2. Header row: logo lockup + puzzle-number badge ---------------------
  const headerTop = advance(HEADER_H);
  const LOGO_BLOCK_W = 394.22;
  const BADGE_D = 204.56;
  const HEADER_GAP = 25.1;
  const rowW = LOGO_BLOCK_W + HEADER_GAP + BADGE_D;
  const rowX = (SHARE_IMAGE_W - rowW) / 2;

  // Logo, anchored top-left of its block.
  ctx.drawImage(logo, rowX, headerTop, LOGO_BLOCK_W, 312.55);

  // "Daily" badge.
  const badgeW = 122.51;
  const badgeH = 67.54;
  const badgeX = rowX + 271.71;
  const badgeY = headerTop + 263.68;
  ctx.fillStyle = COLORS.red;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fillStyle = COLORS.surface;
  ctx.font = `40px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Daily", badgeX + badgeW / 2, badgeY + badgeH / 2 + 2);

  // Puzzle-number badge: tilted orange disc.
  const discCx = rowX + LOGO_BLOCK_W + HEADER_GAP + BADGE_D / 2;
  const discCy = headerTop + HEADER_H / 2;
  ctx.save();
  ctx.translate(discCx, discCy);
  ctx.rotate((15.06 * Math.PI) / 180);
  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.arc(0, 0, BADGE_D / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.font = `100px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`#${result.puzzleNumber}`, 0, 4);
  ctx.restore();

  // --- 3. Rounds panel ------------------------------------------------------
  const panelTop = advance(PANEL_H);
  const panelX = (SHARE_IMAGE_W - PANEL_W) / 2;
  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, panelX, panelTop, PANEL_W, PANEL_H, 16);

  const P_PAD = 48;
  const ROW_W = PANEL_W - P_PAD * 2; // 388
  const ROW_H = 96;
  const ROW_GAP = 31;
  const rowsX = panelX + P_PAD;

  const events = result.roundEvents ?? [];

  for (let i = 0; i < DAILY_ROUNDS; i++) {
    const rowY = panelTop + P_PAD + i * (ROW_H + ROW_GAP);
    const midY = rowY + ROW_H / 2;

    // Label.
    ctx.fillStyle = COLORS.ink;
    ctx.font = `72px ${FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`R${i + 1}`, rowsX, midY - 4);

    // Marks: exactly two slots, right-aligned.
    const MARK = 64;
    const MARK_GAP = 20;
    const groupW = MARK * 2 + MARK_GAP; // 148
    const groupX = rowsX + ROW_W - groupW;
    const roundEvents = events[i] ?? [];
    for (let s = 0; s < 2; s++) {
      const ev = roundEvents[s];
      ctx.fillStyle =
        ev === "SOLVE" ? COLORS.blue : ev ? COLORS.red : COLORS.panel;
      ctx.beginPath();
      ctx.arc(groupX + s * (MARK + MARK_GAP) + MARK / 2, midY, MARK / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Peek pill, between the label and the marks.
    if (result.peekUsed && result.peekRound === i + 1) {
      const pillW = 87;
      const pillH = 44;
      const pillX = groupX - 24 - pillW;
      const pillY = midY - pillH / 2;
      ctx.fillStyle = COLORS.ink;
      roundRect(ctx, pillX, pillY, pillW, pillH, 4);
      ctx.fillStyle = COLORS.surface;
      ctx.font = `40px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PEEK", pillX + pillW / 2, pillY + pillH / 2 + 1);
    }

    // Bottom border.
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rowsX, rowY + ROW_H);
    ctx.lineTo(rowsX + ROW_W, rowY + ROW_H);
    ctx.stroke();
  }

  // --- 4. Score line --------------------------------------------------------
  const scoreTop = advance(SCORE_H);
  ctx.fillStyle = COLORS.blue;
  ctx.font = `72px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(scoreLine(result, streak), SHARE_IMAGE_W / 2, scoreTop + SCORE_H / 2);

  // --- 5. Bottom shape rule -------------------------------------------------
  drawShapeRule(ctx, PAD, advance(RULE_H));

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas toBlob failed"));
    }, "image/png");
  });
}
