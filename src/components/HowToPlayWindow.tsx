import React, { useState } from "react";
import { COLORS, RADIUS, FONT_FAMILY, SPACE, TYPE, MOBILE_TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface HowToPlayWindowProps {
  onClose: () => void;
}

const PeekDemo: React.FC = () => {
  const [flipped, setFlipped] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = () => {
    if (flipped) return;
    setFlipped(true);
    timerRef.current = setTimeout(() => setFlipped(false), 2000);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE[4] }}>
      <div
        onClick={handleTap}
        style={{
          width: 100,
          aspectRatio: "5/7",
          perspective: 600,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            transformStyle: "preserve-3d",
            transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              borderRadius: RADIUS.md,
              overflow: "hidden",
              boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
            }}
          >
            <img
              src="/cards/3-star-red.svg"
              alt="Red Star 3"
              style={{ width: "100%", height: "100%", display: "block" }}
              draggable={false}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              borderRadius: RADIUS.md,
              overflow: "hidden",
              boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
              transform: "rotateY(180deg)",
            }}
          >
            <img
              src="/cards/card-back.svg"
              alt="Card back"
              style={{ width: "100%", height: "100%", display: "block" }}
              draggable={false}
            />
          </div>
        </div>
      </div>
      <span
        style={{
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontSize: TYPE.caption,
          color: COLORS.inkMuted,
        }}
      >
        {flipped ? "Memorize it!" : "Tap to peek"}
      </span>
    </div>
  );
};

const HowToPlayWindow: React.FC<HowToPlayWindowProps> = ({ onClose }) => {
  const [slide, setSlide] = useState(0);
  const mobile = useIsMobile();

  const headlineStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontStyle: "normal",
    fontWeight: 700,
    fontSize: mobile ? MOBILE_TYPE.subhead : TYPE.subhead,
    color: COLORS.ink,
    marginBottom: SPACE[4],
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontStyle: "normal",
    fontSize: mobile ? MOBILE_TYPE.body : TYPE.body,
    color: COLORS.inkMuted,
    maxWidth: 280,
    lineHeight: 1.5,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: mobile ? SPACE[6] : SPACE[12],
        gap: mobile ? SPACE[6] : SPACE[12],
      }}
    >
      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: SPACE[8] }}>
        {slide === 0 && (
          <>
            <div style={headlineStyle}>Peek & Memorize</div>
            <div style={bodyStyle}>
              Tap a card to peek at it. Remember its shape, number, and color — you'll need it later.
            </div>
            <PeekDemo />
          </>
        )}

        {slide === 1 && (
          <>
            <div style={headlineStyle}>Roll the Dice</div>
            <div style={bodyStyle}>
              Each round, the match dice roll to decide what counts as a pair. Match by SHAPE, NUMBER, or COLOR — or two at once for a Double Match!
            </div>
            <div style={{ display: "flex", gap: SPACE[6], justifyContent: "center", alignItems: "center" }}>
              {["SHAPE", "COLOR"].map((label, i) => (
                <div
                  key={label}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    border: `4px solid ${COLORS.ink}`,
                    background: COLORS.surface,
                    color: COLORS.ink,
                    fontFamily: FONT_FAMILY,
                    fontStyle: "italic",
                    fontWeight: 900,
                    fontSize: TYPE.body,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "2px 4px 8px rgba(0,0,0,0.3)",
                    transform: i === 0 ? "rotate(-4deg)" : "rotate(6deg)",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div
              style={{
                fontFamily: FONT_FAMILY,
                fontStyle: "italic",
                fontSize: TYPE.caption,
                color: COLORS.inkMuted,
                marginTop: SPACE[2],
              }}
            >
              These two? Match by shape AND color.
            </div>
          </>
        )}

        {slide === 2 && (
          <>
            <div style={headlineStyle}>Claim Your Match</div>
            <div style={bodyStyle}>
              Spot a pair? Hit WHOOP! WHOOP!, then tap the two matching cards. Get it right and they're yours!
            </div>
            <div style={{ display: "flex", gap: SPACE[5], justifyContent: "center", alignItems: "center" }}>
              <img
                src="/cards/2-circle-blue.svg"
                alt="Blue Circle 2"
                style={{
                  width: 72,
                  height: 101,
                  borderRadius: RADIUS.md,
                  boxShadow: `0 0 0 3px ${COLORS.success}, 0 0 16px rgba(89,205,144,0.5)`,
                }}
              />
              <img
                src="/cards/4-circle-red.svg"
                alt="Red Circle 4"
                style={{
                  width: 72,
                  height: 101,
                  borderRadius: RADIUS.md,
                  boxShadow: `0 0 0 3px ${COLORS.success}, 0 0 16px rgba(89,205,144,0.5)`,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONT_FAMILY,
                fontStyle: "italic",
                fontSize: TYPE.caption,
                color: COLORS.inkMuted,
                marginTop: SPACE[2],
              }}
            >
              Both circles — that's a SHAPE match!
            </div>
          </>
        )}
      </div>

      {/* Nav dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: SPACE[3] }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: COLORS.ink,
              opacity: slide === i ? 1 : 0.25,
              transition: "opacity 0.2s",
            }}
          />
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: SPACE[5] }}>
        <AppButton
          variant="secondary"
          tone="neutral"
          size="md"
          fullWidth
          disabled={slide === 0}
          onClick={() => setSlide((s) => s - 1)}
          style={{ flex: 1, fontSize: TYPE.ui, padding: SPACE[6] }}
        >
          Back
        </AppButton>
        <AppButton
          variant="secondary"
          tone="neutral"
          size="md"
          fullWidth
          onClick={() => {
            if (slide === 2) {
              onClose();
            } else {
              setSlide((s) => s + 1);
            }
          }}
          style={{ flex: 1, fontSize: TYPE.ui, padding: SPACE[6] }}
        >
          {slide === 2 ? "Got it!" : "Next"}
        </AppButton>
      </div>
    </div>
  );
};

export default HowToPlayWindow;