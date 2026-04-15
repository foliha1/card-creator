import React, { useState } from "react";

interface HowToPlayWindowProps {
  onClose: () => void;
}

const HowToPlayWindow: React.FC<HowToPlayWindowProps> = ({ onClose }) => {
  const [slide, setSlide] = useState(0);

  const headlineStyle: React.CSSProperties = {
    fontFamily: '"Friend", sans-serif',
    fontStyle: "normal",
    fontWeight: 700,
    fontSize: 20,
    color: "#000000",
    marginBottom: 8,
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily: '"Friend", sans-serif',
    fontStyle: "normal",
    fontSize: 18,
    color: "#000000",
    opacity: 0.6,
    maxWidth: 280,
    lineHeight: 1.5,
  };

  const btnStyle = (disabled?: boolean): React.CSSProperties => ({
    flex: 1,
    background: "#F8F2E9",
    border: "1.5px solid #231f20",
    fontFamily: '"Friend", serif',
    fontStyle: "italic",
    fontSize: 17,
    padding: 12,
    borderRadius: 6,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.3 : 1,
    color: "#231f20",
    textAlign: "center",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: 24,
        gap: 24,
      }}
    >
      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16 }}>
        {slide === 0 && (
          <>
            <div style={headlineStyle}>Peek cards to memorize</div>
            <div style={bodyStyle}>
              Tap any face-down card to peek at it for 2 seconds. Try to remember what you see!
            </div>
            <img
              src="/cards/3 tri red.svg"
              alt="Example card"
              style={{ width: 167, height: 234, borderRadius: 6 }}
            />
          </>
        )}

        {slide === 1 && (
          <>
            <div style={headlineStyle}>Match the dice rule</div>
            <div style={bodyStyle}>
              Each round, the dice tell you what to match. Double match rounds are harder but worth more!
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {["SHAPE", "COLOR"].map((label) => (
                <div
                  key={label}
                  style={{
                    width: 48,
                    height: 48,
                    background: "#231f20",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#f8f2e9",
                    fontFamily: '"Friend", serif',
                    fontStyle: "italic",
                    fontSize: 9,
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
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {["1 circle blue", "2 circle red"].map((name) => (
                <img
                  key={name}
                  src={`/cards/${name}.svg`}
                  alt="Match card"
                  style={{
                    width: 80,
                    height: 112,
                    borderRadius: 6,
                    boxShadow: "0 0 12px rgba(34,197,94,0.6), 0 0 4px rgba(34,197,94,0.3)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Nav dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#231f20",
              opacity: slide === i ? 1 : 0.25,
              transition: "opacity 0.2s",
            }}
          />
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={btnStyle(slide === 0)}
          disabled={slide === 0}
          onClick={() => setSlide((s) => s - 1)}
        >
          Back
        </button>
        <button
          style={btnStyle()}
          onClick={() => {
            if (slide === 2) {
              onClose();
            } else {
              setSlide((s) => s + 1);
            }
          }}
        >
          {slide === 2 ? "Got it!" : "Next"}
        </button>
      </div>
    </div>
  );
};

export default HowToPlayWindow;
