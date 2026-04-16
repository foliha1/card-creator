interface DieDisplayProps {
  value: string;
  rolling: boolean;
  landed?: boolean;
}

const DieDisplay = ({ value, rolling, landed }: DieDisplayProps) => {
  const isAnimating = rolling && !landed;

  return (
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: 10,
        border: "4px solid #231f20",
        backgroundColor: isAnimating ? "#f8f2e9" : "#f8f2e9",
        color: "#231f20",
        fontSize: TYPE.body,
        fontWeight: 900,
        fontStyle: "italic",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: isAnimating
          ? "0 0 0 2px #e79024, 0 0 12px rgba(231,144,36,0.4)"
          : "2px 4px 8px rgba(0,0,0,0.3)",
        animation: isAnimating
          ? "die-roll 150ms ease-in-out infinite"
          : landed
          ? "die-land 0.3s cubic-bezier(0.34,1.56,0.64,1)"
          : "none",
        userSelect: "none",
        transition: isAnimating ? "none" : "background-color 0.2s, color 0.15s, box-shadow 0.3s",
      }}
    >
      {isAnimating ? "?" : value}
      <style>{`
        @keyframes die-roll {
          0% { transform: rotate(-8deg) scale(0.95); }
          50% { transform: rotate(8deg) scale(1.05); }
          100% { transform: rotate(-8deg) scale(0.95); }
        }
        @keyframes die-land {
          0% { transform: scale(1.15); background-color: #e79024; }
          60% { background-color: #e79024; }
          100% { transform: scale(1); background-color: #f8f2e9; }
        }
      `}</style>
    </div>
  );
};

export default DieDisplay;
