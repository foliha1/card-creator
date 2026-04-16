import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { COLORS } from "@/lib/tokens";

export function deriveLogoColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  let l = (max + min) / 2;
  let s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  l = Math.max(l * 0.42, 0.12);
  s = Math.min(s + 0.08, 1);
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return `#${f(0).toString(16).padStart(2, "0")}${f(8).toString(16).padStart(2, "0")}${f(4).toString(16).padStart(2, "0")}`;
}

const DEFAULT_THEME = COLORS.offWhite;

interface ThemeContextValue {
  bgTheme: string;
  logoColor: string;
  setTheme: (color: string) => void;
  themeInk: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bgTheme, setBgTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("whoop-theme") || DEFAULT_THEME;
    }
    return DEFAULT_THEME;
  });

  const setTheme = useCallback((color: string) => {
    setBgTheme(color);
    localStorage.setItem("whoop-theme", color);
  }, []);

  const logoColor = useMemo(() => {
    if (bgTheme === COLORS.offWhite || bgTheme === COLORS.surface) return COLORS.panelMuted;
    return deriveLogoColor(bgTheme);
  }, [bgTheme]);
  const themeInk = useMemo(() => (bgTheme === COLORS.red || bgTheme === COLORS.blue) ? COLORS.surface : COLORS.ink, [bgTheme]);

  const value = useMemo(() => ({ bgTheme, logoColor, setTheme, themeInk }), [bgTheme, logoColor, setTheme, themeInk]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
