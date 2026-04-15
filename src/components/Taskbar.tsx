import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { setMuted, isMuted } from "@/lib/sounds";

type WindowId = "game" | "howtoplay" | "preorder" | "about";

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

  const btnStyle = (id: WindowId): React.CSSProperties => {
    const isActive = mobile && activeWindow === id;
    return {
      background: isActive ? "#f8f2e9" : "#231f20",
      color: isActive ? "#231f20" : "#f8f2e9",
      fontFamily: '"Friend", serif',
      fontStyle: "italic",
      fontSize: mobile ? 13 : 15,
      padding: mobile ? "8px 14px" : "10px 20px",
      borderRadius: 6,
      border: "2px solid rgba(248,242,233,0.2)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.3)",
      cursor: "pointer",
      position: "relative" as const,
      transition: "background 0.15s, transform 0.15s",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 4,
      whiteSpace: "nowrap" as const,
      minHeight: 44,
      minWidth: 44,
      justifyContent: "center" as const,
      flexShrink: 0,
    };
  };

  const muteStyle: React.CSSProperties = {
    ...btnStyle("game" as WindowId),
    background: "#231f20",
    color: "#f8f2e9",
    padding: mobile ? "8px 12px" : "10px 12px",
    marginLeft: mobile ? 0 : 12,
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: mobile ? 52 : 56,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: mobile ? "flex-start" : "center",
        gap: mobile ? 6 : 10,
        zIndex: 100,
        background: "transparent",
        overflowX: mobile ? "auto" : undefined,
        padding: mobile ? "0 12px" : undefined,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {!mobile && (
        <img
          src="/WhoopWhoop_Stacked_Logo.svg"
          alt="Whoop Whoop"
          style={{ height: 28, marginRight: 12 }}
        />
      )}

      {BUTTONS.map(({ label, id }) => (
        <button
          key={id}
          style={btnStyle(id)}
          onClick={() => handleClick(id)}
          onMouseEnter={(e) => {
            if (!mobile || activeWindow !== id) {
              e.currentTarget.style.background = "#3a3637";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            const isActive = mobile && activeWindow === id;
            e.currentTarget.style.background = isActive ? "#f8f2e9" : "#231f20";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {label}
          {openWindows.has(id) && !mobile && (
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "#f8f2e9",
                display: "block",
              }}
            />
          )}
        </button>
      ))}

      <button
        style={muteStyle}
        onClick={toggleMute}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#3a3637";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#231f20";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
};

export default Taskbar;
