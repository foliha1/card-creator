import { useEffect, useState } from "react";

interface DieDisplayProps {
  value: string;
  rolling: boolean;
}

const DieDisplay = ({ value, rolling }: DieDisplayProps) => {
  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: 10,
        border: "3px solid #231f20",
        backgroundColor: rolling ? "#231f20" : "#f8f2e9",
        color: rolling ? "#f8f2e9" : "#231f20",
        fontSize: 13,
        fontWeight: 900,
        fontStyle: "italic",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "2px 4px 8px rgba(0,0,0,0.3)",
        animation: rolling ? "die-roll 150ms ease-in-out infinite" : "none",
        userSelect: "none",
      }}
    >
      {rolling ? "?" : value}
      {rolling && (
        <style>{`
          @keyframes die-roll {
            0% { transform: rotate(-8deg) scale(0.95); }
            50% { transform: rotate(8deg) scale(1.05); }
            100% { transform: rotate(-8deg) scale(0.95); }
          }
        `}</style>
      )}
    </div>
  );
};

export default DieDisplay;
