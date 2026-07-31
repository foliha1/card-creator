import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Global hue themes.
 *
 * Paper (#F8F2E9) and ink (#231F20) are FIXED across every theme. A theme only
 * swaps the three shape hues — the ones the game uses as the COLOR matching
 * attribute — everywhere they appear: UI chrome, card art, dice art and the
 * intro Lottie.
 */

/** Fixed, never themed. */
export const PAPER = "#f8f2e9";
export const INK = "#231f20";

/** The three hue slots, in their Classic (source-art) values. */
export const SOURCE_HUES = {
  hue1: "#d72229", // "red"    slot
  hue2: "#0072b2", // "blue"   slot
  hue3: "#e79024", // "yellow" slot
} as const;

export interface Palette {
  id: string;
  label: string;
  hue1: string;
  hue2: string;
  hue3: string;
  /** Hover/pressed variants for UI surfaces. */
  hue1Hover: string;
  hue2Hover: string;
  hue3Hover: string;
}

/** Darken a hex by `amount` (0..1) for hover states. */
function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function makePalette(id: string, label: string, hue1: string, hue2: string, hue3: string, hovers?: Partial<Pick<Palette, "hue1Hover" | "hue2Hover" | "hue3Hover">>): Palette {
  return {
    id,
    label,
    hue1,
    hue2,
    hue3,
    hue1Hover: hovers?.hue1Hover ?? shade(hue1, 0.15),
    hue2Hover: hovers?.hue2Hover ?? shade(hue2, 0.2),
    hue3Hover: hovers?.hue3Hover ?? shade(hue3, 0.15),
  };
}

export const PALETTES: Palette[] = [
  makePalette("classic", "Classic", SOURCE_HUES.hue1, SOURCE_HUES.hue2, SOURCE_HUES.hue3, {
    hue1Hover: "#b81b20",
    hue2Hover: "#005a8f",
    hue3Hover: "#c47618",
  }),
  makePalette("neon", "Neon", "#ff47da", "#46237a", "#3ddc97"),
];

export const DEFAULT_PALETTE_ID = "classic";
const STORAGE_KEY = "ww_palette";

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Map from source-art hex (lowercase) → themed hex, for the three hues only. */
export function hueMap(p: Palette): Record<string, string> {
  return {
    [SOURCE_HUES.hue1]: p.hue1.toLowerCase(),
    [SOURCE_HUES.hue2]: p.hue2.toLowerCase(),
    [SOURCE_HUES.hue3]: p.hue3.toLowerCase(),
  };
}

/** Push the active palette onto :root as CSS custom properties. */
export function applyPaletteVars(p: Palette): void {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  s.setProperty("--ww-hue-1", p.hue1);
  s.setProperty("--ww-hue-2", p.hue2);
  s.setProperty("--ww-hue-3", p.hue3);
  s.setProperty("--ww-hue-1-hover", p.hue1Hover);
  s.setProperty("--ww-hue-2-hover", p.hue2Hover);
  s.setProperty("--ww-hue-3-hover", p.hue3Hover);
}

interface PaletteContextValue {
  palette: Palette;
  paletteId: string;
  setPaletteId: (id: string) => void;
  palettes: Palette[];
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

const readStored = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PALETTE_ID;
  } catch {
    return DEFAULT_PALETTE_ID;
  }
};

export const PaletteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [paletteId, setId] = useState<string>(() => (typeof window === "undefined" ? DEFAULT_PALETTE_ID : readStored()));
  const palette = useMemo(() => getPalette(paletteId), [paletteId]);

  // Apply synchronously on first render too, so no frame paints with the
  // fallback hues after a reload with a stored theme.
  useMemo(() => applyPaletteVars(palette), [palette]);
  useEffect(() => {
    applyPaletteVars(palette);
  }, [palette]);

  const setPaletteId = useCallback((id: string) => {
    setId(getPalette(id).id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ palette, paletteId: palette.id, setPaletteId, palettes: PALETTES }),
    [palette, setPaletteId],
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
};

export function usePalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) {
    // Tests / isolated renders: behave as Classic.
    const palette = PALETTES[0];
    return { palette, paletteId: palette.id, setPaletteId: () => {}, palettes: PALETTES };
  }
  return ctx;
}
