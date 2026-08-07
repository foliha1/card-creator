import { ALL_CARDS, CARD_BACK_PATH } from "@/cardData";
import { MATCH_ART_SRC } from "@/components/MatchDie";

const preloaded: HTMLImageElement[] = [];

/**
 * Preload every card face, the card back, and all die faces once per session.
 * Keeps the image elements alive so the browser cannot evict the decoded SVG
 * art; this prevents the first flip / die reveal from flickering.
 */
export function preloadGameArt(): void {
  if (preloaded.length > 0) return;
  for (const src of [
    CARD_BACK_PATH,
    ...Object.values(MATCH_ART_SRC),
    ...ALL_CARDS.map((c) => c.svgPath),
  ]) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    preloaded.push(img);
  }
}
