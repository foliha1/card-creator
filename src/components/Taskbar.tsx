import React, { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Music, Palette } from "lucide-react";
import { setMuted, isMuted } from "@/lib/sounds";

type WindowId = "game" | "howtoplay" | "preorder" | "about" | "music";

interface TaskbarProps {
  openWindows: Set<string>;
  onOpen: (id: WindowId) => void;
  onFocus: (id: string) => void;
  activeWindow?: string;
  mobile?: boolean;
  theme?: string;
  onThemeChange?: (color: string) => void;
}

const THEME_SWATCHES = [
  { color: "#d72229", label: "Red" },
  { color: "#0072b2", label: "Blue" },
  { color: "#f0e443", label: "Yellow" },
  { color: "#fef9f0", label: "Off-White" },
];

const BUTTONS: { label: string; id: WindowId }[] = [
  { label: "Play Whoop! Woop!", id: "game" },
  { label: "How to Play", id: "howtoplay" },
  { label: "Pre-Order", id: "preorder" },
  { label: "About", id: "about" },
];

const Taskbar: React.FC<TaskbarProps> = ({ openWindows, onOpen, onFocus, activeWindow, mobile = false }) => {
  const [muted, setMutedState] = useState(isMuted());

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

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
    const baseBg = game ? "#231f20" : "#ADA290";
    return {
      background: active ? (game ? "#3a3637" : "#bdb5a4") : baseBg,
      color: "#f8f2e9",
      fontFamily: '"Friend", sans-serif',
      fontStyle: "normal",
      fontSize: mobile ? 14 : "clamp(16px, 2vw, 24px)",
      padding: mobile ? "10px 14px" : "16px",
      borderRadius: 8,
      border: "2px solid #231f20",
      cursor: "pointer",
      transition: "background 0.15s, transform 0.15s",
      whiteSpace: "nowrap" as const,
      textAlign: "center" as const,
      flexShrink: 0,
    };
  };

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
        background: "#F8F2E9",
        border: "2px solid #231f20",
        borderRadius: 8,
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
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.background = isGame(id) ? "#3a3637" : "#bdb5a4";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            const active = activeWindow === id;
            const baseBg = isGame(id) ? "#231f20" : "#ADA290";
            e.currentTarget.style.background = active ? (isGame(id) ? "#3a3637" : "#bdb5a4") : baseBg;
          }}
        >
          {label}
        </button>
      ))}

      <button
        style={{
          background: "transparent",
          color: "#231f20",
          border: "none",
          cursor: "pointer",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.5,
          transition: "opacity 0.15s",
          flexShrink: 0,
        }}
        onClick={() => handleClick("music")}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
      >
        <Music size={18} />
      </button>

      <button
        style={{
          background: "transparent",
          color: "#231f20",
          border: "none",
          cursor: "pointer",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.5,
          transition: "opacity 0.15s",
          flexShrink: 0,
        }}
        onClick={toggleMute}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
};

export default Taskbar;
