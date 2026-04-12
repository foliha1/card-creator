import { Card, COLORS } from "@/cardData";

interface GameCardProps {
  card: Card;
  faceUp: boolean;
  onClick?: () => void;
  highlighted?: boolean;
  matched?: boolean;
  wrong?: boolean;
  wrongWash?: boolean;
  shrinking?: boolean;
  entering?: boolean;
  enterDelay?: number;
  shaking?: boolean;
}

const GameCard = ({
  card,
  faceUp,
  onClick,
  highlighted,
  matched,
  wrong,
  wrongWash,
  shrinking,
  entering,
  enterDelay = 0,
  shaking,
}: GameCardProps) => {
  const boxShadow = matched
    ? "0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.5)"
    : highlighted
    ? "0 0 0 3px #f8f2e9, 0 0 20px rgba(255,255,255,0.5)"
    : "0 2px 8px rgba(0,0,0,0.25)";

  let outerTransform = "";
  let outerTransition = "transform 0.4s ease, opacity 0.4s ease";
  let outerOpacity = 1;

  if (shrinking) {
    outerTransform = "scale(0.5)";
    outerOpacity = 0;
  } else if (entering) {
    outerTransform = "scale(1)";
    outerOpacity = 1;
  }

  const animStyle = entering
    ? `card-enter-${card.id} 0.3s ease ${enterDelay}ms both`
    : shaking
    ? "card-shake 0.2s ease"
    : "none";

  return (
    <div
      style={{
        perspective: 600,
        width: 110,
        height: 154,
        cursor: "pointer",
        transform: shrinking ? outerTransform : undefined,
        opacity: shrinking ? outerOpacity : undefined,
        transition: shrinking ? outerTransition : undefined,
        animation: animStyle,
      }}
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
            overflow: "hidden",
          }}
        >
          {/* Red overlay for wrong */}
          {(wrong || wrongWash) && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 8,
                backgroundColor: wrong
                  ? "rgba(215,34,41,0.3)"
                  : "rgba(215,34,41,0.1)",
                transition: "background-color 0.3s",
                pointerEvents: "none",
              }}
            />
          )}
          <span style={{ color: "#fff", fontSize: 32, fontWeight: 700, lineHeight: 1, position: "relative" }}>
            {card.number}
          </span>
          <span style={{ color: "#fff", fontSize: 14, lineHeight: 1, position: "relative" }}>
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
