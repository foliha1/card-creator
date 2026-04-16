import React, { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Music, Palette } from "lucide-react";
import { setMuted, isMuted } from "@/lib/sounds";
import { COLORS, BORDER, RADIUS, SHADOW, MOTION, FONT_FAMILY, THEME_SWATCHES } from "@/lib/tokens";
import { useTheme } from "@/lib/theme-context";

type WindowId = "game" | "howtoplay" | "preorder" | "about" | "music";

interface TaskbarProps {
  openWindows: Set<string>;
  onOpen: (id: WindowId) => void;
  onFocus: (id: string) => void;
  activeWindow?: string;
  mobile?: boolean;
}

const BUTTONS: { label: string; id: WindowId }[] = [
  { label: "Play Whoop! Whoop!", id: "game" },
  { label: "How to Play", id: "howtoplay" },
  { label: "Pre-Order", id: "preorder" },
  { label: "About", id: "about" },
];

interface ThemeSwatchProps {
  color: string;
  label: string;
  isActive: boolean;
  onSelect: (color: string) => void;
}

const ThemeSwatch = React.memo<ThemeSwatchProps>(({ color, label, isActive, onSelect }) => {
  const handleEnter = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(1.1)";
  }, []);
  const handleLeave = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(1)";
  }, []);
  const handleClick = React.useCallback(() => onSelect(color), [color, onSelect]);
  return (
    <button
      aria-label={label}
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: color,
        border: isActive ? BORDER.heavy : BORDER.standard,
        boxShadow: isActive ? `inset 0 0 0 4px ${COLORS.surface}` : "none",
        cursor: "pointer",
        transition: `transform ${MOTION.fast}`,
        padding: 0,
        flexShrink: 0,
      }}
    />
  );
});
ThemeSwatch.displayName = "ThemeSwatch";

const Taskbar: React.FC<TaskbarProps> = ({ openWindows, onOpen, onFocus, activeWindow, mobile = false }) => {
  const { bgTheme, setTheme } = useTheme();
  const [muted, setMutedState] = useState(isMuted());
  const [themeOpen, setThemeOpen] = useState(false);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const themePanelRef = useRef<HTMLDivElement>(null);

  const handleSelectTheme = React.useCallback((color: string) => {
    setTheme(color);
    setThemeOpen(false);
  }, [setTheme]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // Close theme panel on outside click or ESC
  useEffect(() => {
    if (!themeOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setThemeOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (
        themePanelRef.current && !themePanelRef.current.contains(e.target as Node) &&
        themeBtnRef.current && !themeBtnRef.current.contains(e.target as Node)
      ) {
        setThemeOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [themeOpen]);

  const handleClick = (id: WindowId) => {
    if (openWindows.has(id)) {
      onFocus(id);
    } else {
      onOpen(id);
    }
  };

  const isGame = (id: WindowId) => id === "game";

  const btnStyle = (id: WindowId): React.CSSProperties => {
    const active = activeWindow === id;
    const game = isGame(id);
    const baseBg = game ? COLORS.ink : COLORS.panelMuted;
    return {
      background: active ? (game ? COLORS.inkSoft : COLORS.panelMutedHover) : baseBg,
      color: COLORS.inverse,
      fontFamily: FONT_FAMILY,
      fontStyle: "normal",
      fontSize: mobile ? 14 : "clamp(16px, 2vw, 24px)",
      padding: mobile ? "10px 14px" : "16px",
      borderRadius: RADIUS.lg,
      border: BORDER.heavy,
      cursor: "pointer",
      transition: `background ${MOTION.fast}, transform ${MOTION.fast}`,
      whiteSpace: "nowrap" as const,
      textAlign: "center" as const,
      flexShrink: 0,
    };
  };

  const iconBtnStyle: React.CSSProperties = {
    background: "transparent",
    color: COLORS.ink,
    border: "none",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
    transition: `opacity ${MOTION.fast}`,
    flexShrink: 0,
  };

  const iconHoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.opacity = "1"; },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.opacity = "0.5"; },
  };

  const labeledHoverHandlers = (id: WindowId) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "translateY(-1px)";
      e.currentTarget.style.background = isGame(id) ? COLORS.inkSoft : COLORS.panelMutedHover;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "translateY(0)";
      const active = activeWindow === id;
      const baseBg = isGame(id) ? COLORS.ink : COLORS.panelMuted;
      e.currentTarget.style.background = active ? (isGame(id) ? COLORS.inkSoft : COLORS.panelMutedHover) : baseBg;
    },
  });

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: mobile ? 6 : 8,
        zIndex: 100,
        background: COLORS.surface,
        border: BORDER.heavy,
        borderRadius: RADIUS.lg,
        padding: mobile ? 8 : 12,
        overflowX: mobile ? "auto" : undefined,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {BUTTONS.map(({ label, id }) => (
        <button
          key={id}
          style={btnStyle(id)}
          onClick={() => handleClick(id)}
          {...labeledHoverHandlers(id)}
        >
          {label}
        </button>
      ))}

      {/* Theme switcher */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          ref={themeBtnRef}
          style={iconBtnStyle}
          onClick={() => setThemeOpen((v) => !v)}
          {...iconHoverHandlers}
        >
          <Palette size={18} />
        </button>

        {themeOpen && (
          <div
            ref={themePanelRef}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              right: 0,
              width: 260,
              background: COLORS.surface,
              border: BORDER.standard,
              borderRadius: RADIUS.md,
              padding: 10,
              boxShadow: SHADOW.windowFocused,
              zIndex: 200,
              display: "flex",
              flexDirection: "column" as const,
              gap: 10,
            }}
          >
            <div style={{ height: 26, padding: "0 4px", display: "flex", flexDirection: "row" as const, alignItems: "center" }}>
              <div style={{ fontFamily: FONT_FAMILY, fontStyle: "normal", fontSize: 20, color: COLORS.ink, lineHeight: 1, textAlign: "right" as const, flex: 1 }}>
                APPEARANCE
              </div>
            </div>
            <div style={{ background: COLORS.panel, border: BORDER.standard, borderRadius: RADIUS.md, padding: 12 }}>
              <div
                style={{
                  fontFamily: FONT_FAMILY,
                  fontStyle: "normal",
                  fontSize: 10,
                  color: COLORS.inkMuted,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                BACKGROUND
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {THEME_SWATCHES.map(({ color, label }) => (
                  <ThemeSwatch
                    key={color}
                    color={color}
                    label={label}
                    isActive={bgTheme === color}
                    onSelect={handleSelectTheme}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Music */}
      <button
        style={iconBtnStyle}
        onClick={() => handleClick("music")}
        {...iconHoverHandlers}
      >
        <Music size={18} />
      </button>

      {/* Mute */}
      <button
        style={iconBtnStyle}
        onClick={toggleMute}
        {...iconHoverHandlers}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
};

export default Taskbar;
