import React, { useState } from "react";
import { COLORS, RADIUS, FONT_FAMILY, SPACE, TYPE, MOBILE_TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface HowToPlayWindowProps {
  onClose: () => void;
}


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
            <div style={headlineStyle}>What is WHOOP! WHOOP!?</div>
            <div style={bodyStyle}>
              A fast memory game where the rule keeps changing. Cards sit face-down; you flip them one at a time, remember what's where, and race to call matching pairs — but a die decides what counts as a match, and it changes every round.
            </div>
          </>
        )}

        {slide === 1 && (
          <>
            <div style={headlineStyle}>Roll · Flip · Remember</div>
            <div style={bodyStyle}>
              Each round starts with a roll — the die shows SHAPE, NUMBER, or COLOR. Then each player flips one card face-up for everyone to see. Watch every flip, yours and your opponent's — it's all information.
            </div>
            <div style={{ display: "flex", gap: SPACE[6], justifyContent: "center", alignItems: "center" }}>
              {["SHAPE", "COLOR"].map((label, i) => (
                <div
                  key={label}
                  style={{
                    width: mobile ? 48 : 64,
                    height: mobile ? 48 : 64,
                    borderRadius: 10,
                    border: `4px solid ${COLORS.ink}`,
                    background: COLORS.surface,
                    color: COLORS.ink,
                    fontFamily: FONT_FAMILY,
                    fontStyle: "italic",
                    fontWeight: 900,
                    fontSize: mobile ? MOBILE_TYPE.caption : TYPE.body,
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
              The die picks what to match this round.
            </div>
          </>
        )}

        {slide === 2 && (
          <>
            <div style={headlineStyle}>WHOOP! WHOOP!</div>
            <div style={bodyStyle}>
              Spot a matching pair? Shout WHOOP! WHOOP! and tap the two cards — anytime. Right: they're yours, and you roll next. Wrong: the cards freeze face-up and you skip your next flip. Land the most pairs to win.
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

        {slide === 3 && (
          <>
            <div style={headlineStyle}>Last Call</div>
            <div style={bodyStyle}>
              When the deck runs dry and a round passes with no match, everything flips face-up for Last Call — one die, no turns, grab every pair you can. Most cards wins.
            </div>
          </>
        )}
      </div>

      {/* Nav dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: SPACE[3] }}>
        {[0, 1, 2, 3].map((i) => (
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
          style={{ flex: 1, fontSize: mobile ? MOBILE_TYPE.ui : TYPE.ui, padding: SPACE[6] }}
        >
          Back
        </AppButton>
        <AppButton
          variant="secondary"
          tone="neutral"
          size="md"
          fullWidth
          onClick={() => {
            if (slide === 3) {
              onClose();
            } else {
              setSlide((s) => s + 1);
            }
          }}
          style={{ flex: 1, fontSize: mobile ? MOBILE_TYPE.ui : TYPE.ui, padding: SPACE[6] }}
        >
          {slide === 3 ? "Got it!" : "Next"}
        </AppButton>
      </div>
    </div>
  );
};

export default HowToPlayWindow;