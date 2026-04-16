import React, { useState } from "react";
import { COLORS, RADIUS, FONT_FAMILY, SPACE, TYPE } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";

interface HowToPlayWindowProps {
  onClose: () => void;
}

const HowToPlayWindow: React.FC<HowToPlayWindowProps> = ({ onClose }) => {
  const [slide, setSlide] = useState(0);

  const headlineStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontStyle: "normal",
    fontWeight: 700,
    fontSize: TYPE.subhead,
    color: COLORS.ink,
    marginBottom: SPACE[4],
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontStyle: "normal",
    fontSize: TYPE.subhead,
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
        padding: SPACE[12],
        gap: SPACE[12],
      }}
    >
      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: SPACE[8] }}>
        {slide === 0 && (
          <>
            <div style={headlineStyle}>Peek cards to memorize</div>
            <div style={bodyStyle}>
              Tap any face-down card to peek at it for 2 seconds. Try to remember what you see!
            </div>
            <img
              src="/cards/3 tri red.svg"
              alt="Example card"
              style={{ width: "clamp(100px, 40vw, 130px)", aspectRatio: "5/7", borderRadius: RADIUS.md }}
            />
          </>
        )}

        {slide === 1 && (
          <>
            <div style={headlineStyle}>Match the dice rule</div>
            <div style={bodyStyle}>
              Each round, the dice tell you what to match. Double match rounds are harder but worth more!
            </div>
            <div style={{ display: "flex", gap: SPACE[6], justifyContent: "center" }}>
              {["SHAPE", "COLOR"].map((label) => (
                <div
                  key={label}
                  style={{
                    width: 48,
                    height: 48,
                    background: COLORS.ink,
                    borderRadius: RADIUS.lg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: COLORS.surface,
                    fontFamily: FONT_FAMILY,
                    fontStyle: "italic",
                    fontSize: TYPE.caption,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </>
        )}

        {slide === 2 && (
          <>
            <div style={headlineStyle}>Call WHOOP! WHOOP!</div>
            <div style={bodyStyle}>
              Spot a match, hit the button, tap two cards. Get it right and claim them!
            </div>
            <div style={{ display: "flex", gap: SPACE[6], justifyContent: "center" }}>
              {["1 circle blue", "2 circle red"].map((name) => (
                <img
                  key={name}
                  src={`/cards/${name}.svg`}
                  alt="Match card"
                  style={{
                    width: 80,
                    height: 112,
                    borderRadius: RADIUS.md,
                    boxShadow: "0 0 12px rgba(34,197,94,0.6), 0 0 4px rgba(34,197,94,0.3)",
                  }}
                />
              ))}
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