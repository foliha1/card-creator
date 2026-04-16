import { useState } from "react";
import { Card, CARD_BACK_PATH } from "@/cardData";
import { COLORS } from "@/lib/tokens";

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
  const baseShadow = "0 6px 14px rgba(0,0,0,0.25)";
  const boxShadow = matched
    ? `0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.5), ${baseShadow}`
    : highlighted
    ? `0 0 0 3px #231f20, 0 0 16px rgba(35,31,32,0.3), ${baseShadow}`
    : baseShadow;

  let outerTransform = "";
  let outerTransition = "transform 0.4s ease, opacity 0.4s ease";
  let outerOpacity = 1;

  if (shrinking) {
    outerTransform = "scale(0.5)";
    outerOpacity = 0;
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
        width: "100%",
        aspectRatio: "5/7",
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
            borderRadius: 6,
            overflow: "hidden",
            boxShadow,
          }}
        >
          <img
            src={card.svgPath}
            alt={card.id}
            style={{ width: "100%", height: "100%", display: "block" }}
            draggable={false}
          />
          {/* Red overlay for wrong */}
          {(wrong || wrongWash) && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: wrong
                  ? "rgba(215,34,41,0.3)"
                  : "rgba(215,34,41,0.1)",
                transition: "background-color 0.3s",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* Back */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            borderRadius: 6,
            overflow: "hidden",
            boxShadow,
            transform: "rotateY(180deg)",
          }}
        >
          <img
            src={CARD_BACK_PATH}
            alt="card back"
            style={{ width: "100%", height: "100%", display: "block" }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default GameCard;
