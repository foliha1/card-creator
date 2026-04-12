import { useState } from "react";

interface TierScreenProps {
  onSelect: (tierId: string, gridSize: string) => void;
}

const tiers = [
  {
    id: "easy",
    name: "Easy Going",
    badge: "1 Die",
    desc: "Always single-attribute matching. Relaxed and accessible.",
    hover: "#0072b2",
  },
  {
    id: "standard",
    name: "Standard",
    badge: "Alternating 1 ↔ 2",
    desc: "The core WHOOP! WHOOP! experience. Double Match enabled.",
    hover: "#e79024",
  },
  {
    id: "cutthroat",
    name: "Cutthroat",
    badge: "Always 2 Dice",
    desc: "Every round is a double match. Brutally rewarding.",
    hover: "#d72229",
  },
];

const TierButton = ({
  tier,
  index,
  onSelect,
}: {
  tier: (typeof tiers)[0];
  index: number;
  onSelect: (id: string) => void;
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onSelect(tier.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        background: hovered ? tier.hover : "#231f20",
        color: "#f8f2e9",
        border: "none",
        borderRadius: 12,
        padding: "20px 24px",
        textAlign: "left",
        cursor: "pointer",
        transform: hovered ? "scale(1.02)" : "scale(1)",
        transition: "background 0.25s ease, transform 0.2s ease",
        animation: `tier-fade-in 0.5s ease-out ${index * 0.15}s both`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontStyle: "italic", fontSize: 22, fontWeight: 700 }}>
          {tier.name}
        </span>
        <span
          style={{
            background: "rgba(255,255,255,0.15)",
            fontSize: 13,
            borderRadius: 20,
            padding: "4px 10px",
          }}
        >
          {tier.badge}
        </span>
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
        {tier.desc}
      </div>
    </button>
  );
};

const TierScreen = ({ onSelect }: TierScreenProps) => {
  const [gridSize, setGridSize] = useState<"3x2" | "3x3">("3x2");

  const handleTierSelect = (tierId: string) => {
    onSelect(tierId, gridSize);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f2e9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 72,
      }}
    >
      <style>{`
        @keyframes tier-fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420, padding: "0 16px" }}>
        <h1
          style={{
            color: "#231f20",
            fontStyle: "italic",
            fontSize: "clamp(28px, 6vw, 48px)",
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Choose Your Difficulty
        </h1>
        <p
          style={{
            color: "#231f20",
            opacity: 0.5,
            fontSize: 14,
            margin: "8px 0 0",
          }}
        >
          Same game, same rules. Just more dice.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 36,
          }}
        >
          {tiers.map((tier, i) => (
            <TierButton key={tier.id} tier={tier} index={i} onSelect={handleTierSelect} />
          ))}
        </div>

        {/* Grid size toggle */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, color: "#231f20", opacity: 0.5 }}>Grid Size</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {(["3x2", "3x3"] as const).map((s) => {
              const active = s === gridSize;
              return (
                <button
                  key={s}
                  onClick={() => setGridSize(s)}
                  style={{
                    background: active ? "#231f20" : "transparent",
                    color: active ? "#f8f2e9" : "rgba(35,31,32,0.4)",
                    border: "none",
                    borderRadius: 999,
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 700,
                    fontStyle: "italic",
                    cursor: "pointer",
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  {s === "3x2" ? "3×2" : "⚡ 3×3 Challenge"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierScreen;
