import React, { useRef } from "react";
import { Music, Palette, ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS, BORDER, RADIUS, SPACE, FONT_FAMILY, TYPE, MOBILE_TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";

type WindowId = "game" | "howtoplay" | "preorder" | "about" | "music" | "theme";

interface TaskbarProps {
  openWindows: Set<string>;
  onOpen: (id: WindowId) => void;
  onFocus: (id: string) => void;
  activeWindow?: string;
  mobile?: boolean;
}

const BUTTONS: { label: string; id: WindowId; icon?: React.ReactNode; tone?: "ink" | "muted" | "orange" | "blue" | "red" }[] = [
  { label: "Play Whoop! Whoop!", id: "game", tone: "red" },
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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleClick = (id: WindowId) => {
    if (openWindows.has(id)) {
      onFocus(id);
    } else {
      onOpen(id);
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const step = 160;
    if (direction === "left") {
      const amount = Math.min(step, el.scrollLeft);
      el.scrollBy({ left: -amount, behavior: "smooth" });
    } else {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const remaining = maxScroll - el.scrollLeft;
      const amount = Math.min(step, remaining);
      el.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  if (mobile) {
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
          alignItems: "stretch",
          zIndex: 100,
          background: COLORS.surface,
          border: BORDER.heavy,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
          maxWidth: "calc(100vw - 24px)",
        }}
      >
        <button
          aria-label="Scroll left"
          onClick={() => scroll("left")}
          style={{
            background: COLORS.ink,
            border: "none",
            color: COLORS.surface,
            cursor: "pointer",
            padding: `${SPACE[5]}px ${SPACE[3]}px`,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            borderRight: BORDER.heavy,
          }}
        >
          <ChevronLeft size={20} />
        </button>

        <div
          ref={scrollRef}
          data-scroll-strip
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE[3],
            padding: SPACE[4],
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
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
                fontSize: MOBILE_TYPE.body,
                padding: `${SPACE[4]}px ${SPACE[6]}px`,
                borderRadius: RADIUS.lg,
                border: BORDER.heavy,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: SPACE[3] }}>
                {btn.icon}
                {btn.label}
              </span>
            </AppButton>
          ))}
        </div>

        <button
          aria-label="Scroll right"
          onClick={() => scroll("right")}
          style={{
            background: COLORS.ink,
            border: "none",
            color: COLORS.surface,
            cursor: "pointer",
            padding: `${SPACE[5]}px ${SPACE[3]}px`,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            borderLeft: BORDER.heavy,
          }}
        >
          <ChevronRight size={20} />
        </button>

        <style>{`[data-scroll-strip]::-webkit-scrollbar { display: none; }`}</style>
      </nav>
    );
  }

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
        gap: SPACE[4],
        zIndex: 100,
        background: COLORS.surface,
        border: BORDER.heavy,
        borderRadius: RADIUS.lg,
        padding: SPACE[6],
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
            fontSize: "clamp(16px, 2vw, 24px)",
            padding: "16px",
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
