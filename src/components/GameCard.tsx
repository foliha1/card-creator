import { useEffect, useRef, useState } from "react";
import { Card, CARD_BACK_PATH } from "@/cardData";
import { COLORS } from "@/lib/tokens";

interface GameCardProps {
  card: Card;
  faceUp: boolean;
  onClick?: () => void;
  highlighted?: boolean;
  matched?: boolean;
  wrong?: boolean;
  shrinking?: boolean;
  entering?: boolean;
  enterDelay?: number;
  shaking?: boolean;
  fill?: boolean;
}

const GameCard = ({
  card,
  faceUp,
  onClick,
  highlighted,
  matched,
  wrong,
  shrinking,
  entering,
  enterDelay = 0,
  shaking,
  fill,
}: GameCardProps) => {
  const [focusVis, setFocusVis] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setCardW(w);
    });
    ro.observe(el);
    setCardW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const k = cardW > 0 ? cardW / 104.333 : 0;

  const baseShadow = "0 6px 14px rgba(0,0,0,0.25)";
  const boxShadow = matched
    ? `0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.5), ${baseShadow}`
    : baseShadow;

  let outerTransform = "";
  let outerTransition = "transform 0.4s ease, opacity 0.4s ease";
  let outerOpacity = 1;

  if (shrinking) {
    outerTransform = "scale(0.5)";
    outerOpacity = 0;
  }

  // The wrong animation wins over the highlight pulse on the same card.
  const showHighlight = !!highlighted && !wrong;

  const animStyle = wrong
    ? undefined
    : entering
    ? `card-enter-${card.id} 0.3s ease ${enterDelay}ms both`
    : showHighlight
    ? "ww-card-pulse 1.6s linear infinite"
    : "none";

  const shapeLabel = card.shape === "tri" ? "triangle" : card.shape;
  const ariaLabel = faceUp
    ? `${card.color} ${shapeLabel}, ${card.number}`
    : `Card ${card.id}, face down`;

  return (
    <div
      ref={wrapperRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={wrong ? "ww-wrong" : showHighlight ? "ww-card-pulse" : undefined}
      style={{
        perspective: 600,
        width: "100%",
        height: fill ? "100%" : undefined,
        aspectRatio: fill ? undefined : "5/7",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        borderRadius: 6,
        transformOrigin: "center",
        ["--ww-k" as string]: String(k),
        transform: shrinking ? outerTransform : undefined,
        opacity: shrinking ? outerOpacity : undefined,
        transition: shrinking ? outerTransition : undefined,
        animation: animStyle,
        outline: focusVis ? `2px solid ${COLORS.blue}` : "none",
        outlineOffset: 2,
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setFocusVis(true); }}
      onBlur={() => setFocusVis(false)}
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

      {showHighlight && (
        <>
          <div
            className="ww-card-shine"
            style={{
              position: "absolute",
              background: "#F8F2E9",
              pointerEvents: "none",
              transformOrigin: "0 0",
              width: "calc(28.1111px * var(--ww-k))",
              height: "calc(228.331px * var(--ww-k))",
              left: "calc(33.665px * var(--ww-k))",
              top: "calc(-114.962px * var(--ww-k))",
              animation: "ww-card-shine 1.6s linear infinite",
              zIndex: 2,
            }}
          />
          <div
            className="ww-card-ring"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 6,
              opacity: 0,
              pointerEvents: "none",
              boxShadow: "inset 0 0 0 calc(2px * var(--ww-k)) #0072B2",
              animation: "ww-card-ring 1.6s linear infinite",
              zIndex: 3,
            }}
          />
        </>
      )}

      {wrong && (
        <>
          <div className="ww-wrong-wash" style={{ zIndex: 4 }} />
          <div className="ww-wrong-ring" style={{ zIndex: 5 }} />
        </>
      )}
    </div>
  );
};

export default GameCard;
