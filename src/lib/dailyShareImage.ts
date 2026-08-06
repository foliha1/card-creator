// ============================================================================
// Daily share image — a 1080x1350 PNG drawn with the Canvas 2D API.
//
// Marks and counts only: never a card face, a grid position, or anything else
// that could spoil the day's puzzle for someone who has not played it.
// ============================================================================

import { DAILY_ROUNDS } from "@/lib/dailyEngine";
import { DAILY_SHARE_URL, type DailyResult } from "@/lib/daily";
import { COLORS, FONT_FAMILY } from "@/lib/tokens";

export const SHARE_IMAGE_W = 1080;
export const SHARE_IMAGE_H = 1350;

const LOGO_SRC = "/WhoopWhoop_Dark_Logo.svg";

const ATTR_LABEL: Record<string, string> = {
  SHAPE: "Match the shape",
  NUMBER: "Match the number",
  COLOR: "Match the colour",
};

/** Streaks only make the card at 3+ days — below that it's clutter. */
const SHARE_STREAK_MIN = 3;

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
};

/**
 * The brand shape rule: triangle (warm black), square (orange), inverted
 * triangle (blue), square (red), repeating on a fixed pitch.
 */
const drawShapeRule = (
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  size: number
) => {
  const pitch = size * 1.5;
  // Whole shapes only, centred — nothing is ever clipped at either edge.
  const count = Math.floor(width / pitch);
  const startX = (width - count * pitch) / 2 + pitch / 2;


  for (let i = 0; i < count; i++) {
    const cx = startX + i * pitch;
    const kind = i % 4;
    const half = size / 2;

    if (kind === 1 || kind === 3) {
      ctx.fillStyle = kind === 1 ? COLORS.orange : COLORS.red;
      ctx.fillRect(cx - half, y, size, size);
      continue;
    }

    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    if (kind === 0) {
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + half, y + size);
      ctx.lineTo(cx - half, y + size);
    } else {
      ctx.fillStyle = COLORS.blue;
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.lineTo(cx, y + size);
    }
    ctx.closePath();
    ctx.fill();
  }
};
/** A drawn pair of eyes — the peek marker, in place of an emoji glyph. */
const drawEyes = (ctx: CanvasRenderingContext2D, x: number, cy: number) => {
  const r = 13;
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.ink;
  for (const dx of [0, r * 2 + 8]) {
    ctx.fillStyle = COLORS.surface;
    ctx.beginPath();
    ctx.arc(x + r + dx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(x + r + dx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
};


const drawMark = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  solved: boolean
) => {
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.ink;
  if (solved) {
    ctx.fillStyle = COLORS.ink;
    roundRect(ctx, x, y, size, size, 6);
  } else {
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
};

/** The score line, matching the wording used in the share text. */
export function scoreLine(result: DailyResult, streak?: number | null): string {
  const solved = result.roundsSolved ?? 0;
  const misses = result.totalMisses ?? 0;
  const base =
    solved === 0
      ? "Whooped! Better luck tomorrow."
      : `${solved} of ${DAILY_ROUNDS} · ${misses === 0 ? "Clean" : `${misses} misses`}`;
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

  const RULE = 44;
  drawShapeRule(ctx, 72, SHARE_IMAGE_W, RULE);
  drawShapeRule(ctx, SHARE_IMAGE_H - 72 - RULE, SHARE_IMAGE_W, RULE);

  // --- Wordmark -------------------------------------------------------------
  const logoW = 420;
  const logoH = logoW * (logo.naturalHeight / logo.naturalWidth || 132 / 167);
  ctx.drawImage(logo, (SHARE_IMAGE_W - logoW) / 2, 210, logoW, logoH);

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.ink;
  ctx.font = `64px ${FONT_FAMILY}`;
  ctx.fillText(`DAILY #${result.puzzleNumber}`, SHARE_IMAGE_W / 2, 210 + logoH + 96);

  // --- Round rows -----------------------------------------------------------
  const rows = result.roundEvents ?? [];
  const rowH = 96;
  const left = 140;
  const right = SHARE_IMAGE_W - 140;
  let y = 210 + logoH + 190;

  rows.forEach((events, i) => {
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = `40px ${FONT_FAMILY}`;
    ctx.fillText(`R${i + 1}`, left, y + 40);

    ctx.fillStyle = COLORS.ink;
    ctx.font = `40px ${FONT_FAMILY}`;
    const attr = result.attributes?.[i];
    const label = attr ? ATTR_LABEL[attr] ?? "" : "";
    ctx.fillText(label, left + 86, y + 40);

    // The peek marker: a drawn pair of eyes (emoji fonts aren't guaranteed).
    if (result.peekUsed && result.peekRound === i + 1) {
      const labelW = ctx.measureText(label).width;
      drawEyes(ctx, left + 86 + labelW + 24, y + 26);
    }


    // Marks, right-aligned.
    const markSize = 38;
    const gap = 14;
    const total = events.length * markSize + Math.max(0, events.length - 1) * gap;
    let mx = right - total;
    if (events.length === 0) {
      ctx.globalAlpha = 0.3;
      drawMark(ctx, right - markSize, y + 6, markSize, false);
      ctx.globalAlpha = 1;
    }
    events.forEach((m) => {
      drawMark(ctx, mx, y + 6, markSize, m === "SOLVE");
      mx += markSize + gap;
    });

    // Hairline divider.
    ctx.strokeStyle = COLORS.ink;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y + rowH - 8);
    ctx.lineTo(right, y + rowH - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    y += rowH;
  });

  // --- Score + footer -------------------------------------------------------
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.ink;
  ctx.font = `56px ${FONT_FAMILY}`;
  ctx.fillText(scoreLine(result, streak), SHARE_IMAGE_W / 2, y + 96);

  ctx.fillStyle = COLORS.inkMuted;
  ctx.font = `36px ${FONT_FAMILY}`;
  ctx.fillText(DAILY_SHARE_URL, SHARE_IMAGE_W / 2, SHARE_IMAGE_H - 160);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas toBlob failed"));
    }, "image/png");
  });
}
