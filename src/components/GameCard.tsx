import { Card, COLORS } from "@/cardData";

interface GameCardProps {
  card: Card;
  faceUp: boolean;
  onClick?: () => void;
  highlighted?: boolean;
  matched?: boolean;
}

const GameCard = ({ card, faceUp, onClick, highlighted, matched }: GameCardProps) => {
  const boxShadow = matched
    ? "0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.5)"
    : highlighted
    ? "0 0 0 3px #f8f2e9, 0 0 20px rgba(255,255,255,0.5)"
    : "0 2px 8px rgba(0,0,0,0.25)";

  return (
    <div
      style={{ perspective: 600, width: 110, height: 154, cursor: "pointer" }}
      onClick={onClick}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
          transform: faceUp ? "rotateY(0deg)" : "rotateY(180deg)",
        }}
      >
        {/* Front */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            borderRadius: 8,
            backgroundColor: COLORS[card.color],
            boxShadow,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span style={{ color: "#fff", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
            {card.number}
          </span>
          <span style={{ color: "#fff", fontSize: 14, lineHeight: 1 }}>
            {card.shape}
          </span>
        </div>

        {/* Back */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            borderRadius: 8,
            backgroundColor: "#231f20",
            boxShadow,
            transform: "rotateY(180deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#f8f2e9", fontSize: 20, fontWeight: 700 }}>
            W!W!
          </span>
        </div>
      </div>
    </div>
  );
};

export default GameCard;
