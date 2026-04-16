import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/tokens";

interface BootScreenProps {
  onComplete: () => void;
}

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<"black" | "logo" | "loading" | "fadeout">("black");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"), 400);
    const t2 = setTimeout(() => setPhase("loading"), 1200);
    const t3 = setTimeout(() => setPhase("fadeout"), 2400);
    const t4 = setTimeout(() => onComplete(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        transition: "opacity 400ms ease",
        opacity: phase === "fadeout" ? 0 : 1,
      }}
    >
      <style>{`
        @keyframes boot-logo-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes boot-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      <img
        src="/WhoopWhoop_Stacked_Logo.svg"
        alt="Whoop Whoop"
        style={{
          width: 200,
          filter: "brightness(10)",
          opacity: phase === "black" ? 0 : 1,
          animation: phase !== "black" ? "boot-logo-in 400ms ease both" : undefined,
        }}
      />

      {(phase === "loading" || phase === "fadeout") && (
        <div
          style={{
            width: 200,
            height: 4,
            border: `1px solid ${COLORS.surface}`,
            borderRadius: 2,
            marginTop: 24,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: COLORS.red,
              animation: "boot-fill 1200ms ease-out forwards",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default BootScreen;
