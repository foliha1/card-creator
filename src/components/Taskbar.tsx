import React, { useState } from "react";
import { Music, Palette } from "lucide-react";
import { COLORS, BORDER, RADIUS, SPACE, FONT_FAMILY, TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";

type WindowId = "game" | "howtoplay" | "preorder" | "about" | "music" | "theme";

interface TaskbarProps {
  openWindows: Set<string>;
  onOpen: (id: WindowId) => void;
  onFocus: (id: string) => void;
  activeWindow?: string;
  mobile?: boolean;
}

const BUTTONS: { label: string; id: WindowId; icon?: React.ReactNode; tone?: "ink" | "muted" | "orange" | "blue" }[] = [
  { label: "Play Whoop! Whoop!", id: "game", tone: "ink" },
  { label: "How to Play", id: "howtoplay", tone: "muted" },
  { label: "Pre-Order", id: "preorder", tone: "muted" },
  { label: "About", id: "about", tone: "muted" },
  { label: "Theme", id: "theme", icon: <Palette size={16} />, tone: "orange" },
  { label: "Music", id: "music", icon: <Music size={16} />, tone: "blue" },
];

let scWidgetPreloaded = false;

const preloadSoundCloudWidget = () => {
  if (scWidgetPreloaded) return;
  if (typeof document === "undefined") return;
  scWidgetPreloaded = true;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "script";
  link.href = "https://w.soundcloud.com/player/api.js";
  document.head.appendChild(link);
};

const Taskbar: React.FC<TaskbarProps> = ({ openWindows, onOpen, onFocus, activeWindow, mobile = false }) => {
  const handleClick = (id: WindowId) => {
    if (openWindows.has(id)) {
      onFocus(id);
    } else {
      onOpen(id);
    }
  };

  return (
    <nav
      aria-label="Application navigation"
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: mobile ? SPACE[3] : SPACE[4],
        zIndex: 100,
        background: COLORS.surface,
        border: BORDER.heavy,
        borderRadius: RADIUS.lg,
        padding: mobile ? SPACE[4] : SPACE[6],
        overflowX: mobile ? "auto" : undefined,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {BUTTONS.map((btn) => (
        <AppButton
          key={btn.id}
          variant="primary"
          tone={btn.tone || "muted"}
          size="lg"
          active={activeWindow === btn.id}
          onClick={() => handleClick(btn.id)}
          onMouseEnter={btn.id === "music" ? preloadSoundCloudWidget : undefined}
          style={{
            fontStyle: "normal",
            fontSize: mobile ? TYPE.body : "clamp(16px, 2vw, 24px)",
            padding: mobile ? "10px 14px" : "16px",
            borderRadius: RADIUS.lg,
            border: BORDER.heavy,
            flexShrink: 0,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: SPACE[3] }}>
            {btn.icon}
            {btn.label}
          </span>
        </AppButton>
      ))}
    </nav>
  );
};

export default Taskbar;
