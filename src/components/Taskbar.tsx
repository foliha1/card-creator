import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { setMuted, isMuted } from "@/lib/sounds";

type WindowId = "game" | "howtoplay" | "preorder" | "about";

interface TaskbarProps {
  openWindows: Set<string>;
  onOpen: (id: WindowId) => void;
  onFocus: (id: string) => void;
}

const BUTTONS: { label: string; id: WindowId }[] = [
  { label: "Play Whoop! Whoop!", id: "game" },
  { label: "How to Play", id: "howtoplay" },
  { label: "Pre-Order", id: "preorder" },
  { label: "About", id: "about" },
];

const btnBase: React.CSSProperties = {
  background: "#231f20",
  color: "#f8f2e9",
  fontFamily: '"Friend", serif',
  fontStyle: "italic",
  fontSize: 15,
  padding: "10px 20px",
  borderRadius: 6,
  border: "2px solid rgba(248,242,233,0.2)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.3)",
  cursor: "pointer",
  position: "relative",
  transition: "background 0.15s, transform 0.15s",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
};

const Taskbar: React.FC<TaskbarProps> = ({ openWindows, onOpen, onFocus }) => {
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

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: 56,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        zIndex: 100,
        background: "transparent",
      }}
    >
      <img
        src="/WhoopWhoop_Stacked_Logo.svg"
        alt="Whoop Whoop"
        style={{ height: 28, marginRight: 12 }}
      />

      {BUTTONS.map(({ label, id }) => (
        <button
          key={id}
          style={btnBase}
          onClick={() => handleClick(id)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#3a3637";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#231f20";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {label}
          {openWindows.has(id) && (
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
        style={{ ...btnBase, padding: "10px 12px", marginLeft: 12 }}
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
