import { useSyncExternalStore } from "react";
import { ALL_CARDS, CARD_BACK_PATH } from "@/cardData";
import { hueMap, SOURCE_HUES, type Palette } from "@/lib/palette";

/**
 * Runtime recoloring of the static art (card SVGs, dice SVGs, intro Lottie).
 *
 * Only the three hue values are swapped — paper and ink are left exactly as
 * authored. SVGs are recolored as text and served as blob URLs so they keep
 * rendering through plain <img>, leaving layout, flip and deal animations
 * untouched.
 */

export const DICE_ART = [
  "/dice/match-shape.svg",
  "/dice/match-number.svg",
  "/dice/match-color.svg",
];

export const ALL_ART_PATHS = [
  CARD_BACK_PATH,
  ...ALL_CARDS.map((c) => c.svgPath),
  ...DICE_ART,
];

const HUE_SOURCES = Object.values(SOURCE_HUES);

/** Whole-token, case-insensitive replace of the three source hues. */
export function recolorSvgText(svg: string, palette: Palette): string {
  const map = hueMap(palette);
  let out = svg;
  for (const src of HUE_SOURCES) {
    const themed = map[src];
    if (!themed || themed === src) continue;
    out = out.replace(new RegExp(src.replace("#", "#"), "gi"), themed);
  }
  return out;
}

// ---- blob cache --------------------------------------------------------

type PaletteCache = { urls: Map<string, string>; ready: boolean };

const caches = new Map<string, PaletteCache>();
const order: string[] = [];
const MAX_CACHED_PALETTES = 2;

const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

function evictIfNeeded(keep: string) {
  while (order.length > MAX_CACHED_PALETTES) {
    const id = order.find((x) => x !== keep);
    if (!id) break;
    order.splice(order.indexOf(id), 1);
    const c = caches.get(id);
    if (c) {
      c.urls.forEach((u) => URL.revokeObjectURL(u));
      caches.delete(id);
    }
  }
}

/** Fetch + recolor every art asset for `palette`. No-op for the source palette. */
export async function prepareArt(palette: Palette): Promise<void> {
  if (isSourcePalette(palette)) return;
  if (caches.has(palette.id)) return;
  const cache: PaletteCache = { urls: new Map(), ready: false };
  caches.set(palette.id, cache);
  order.push(palette.id);
  evictIfNeeded(palette.id);

  await Promise.all(
    ALL_ART_PATHS.map(async (path) => {
      try {
        const res = await fetch(path);
        if (!res.ok) return;
        const text = await res.text();
        const url = URL.createObjectURL(
          new Blob([recolorSvgText(text, palette)], { type: "image/svg+xml" }),
        );
        cache.urls.set(path, url);
        // Warm the decode so a themed face never paints late.
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      } catch {
        /* fall back to the original path */
      }
    }),
  );

  cache.ready = true;
  bump();
}

export function isSourcePalette(palette: Palette): boolean {
  return (
    palette.hue1.toLowerCase() === SOURCE_HUES.hue1 &&
    palette.hue2.toLowerCase() === SOURCE_HUES.hue2 &&
    palette.hue3.toLowerCase() === SOURCE_HUES.hue3
  );
}

/** Synchronous lookup: themed URL when ready, otherwise the original path. */
export function themedSrc(path: string, palette: Palette): string {
  if (!path) return path;
  if (isSourcePalette(palette)) return path;
  return caches.get(palette.id)?.urls.get(path) ?? path;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => version;

/** Re-renders when the themed art for the active palette becomes available. */
export function useArtVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---- Lottie ------------------------------------------------------------

const rgbOf = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};

const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

/**
 * Deep-clone the Lottie JSON with every color array matching one of the three
 * source hues remapped. Paper/ink arrays are left alone.
 */
export function recolorLottie(data: unknown, palette: Palette): unknown {
  if (!data || isSourcePalette(palette)) return data;
  const map = hueMap(palette);
  const targets = HUE_SOURCES.map((src) => ({ from: rgbOf(src), to: rgbOf(map[src]) }));

  const remap = (arr: number[]): number[] => {
    for (const t of targets) {
      if (near(arr[0], t.from[0]) && near(arr[1], t.from[1]) && near(arr[2], t.from[2])) {
        return arr.length > 3 ? [...t.to, arr[3]] : [...t.to];
      }
    }
    return arr;
  };

  const isColorArray = (v: unknown): v is number[] =>
    Array.isArray(v) &&
    (v.length === 3 || v.length === 4) &&
    v.every((x) => typeof x === "number" && x >= 0 && x <= 1);

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (key === "k" && isColorArray(val)) out[key] = remap(val);
        else out[key] = walk(val);
      }
      return out;
    }
    return node;
  };

  return walk(data);
}

const lottieCache = new Map<string, unknown>();

export function themedLottie(data: unknown, palette: Palette): unknown {
  if (!data || isSourcePalette(palette)) return data;
  const hit = lottieCache.get(palette.id);
  if (hit) return hit;
  const themed = recolorLottie(data, palette);
  lottieCache.set(palette.id, themed);
  return themed;
}
