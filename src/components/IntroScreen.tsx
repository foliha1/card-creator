import { useEffect, useState } from "react";

interface IntroScreenProps {
  onComplete: () => void;
}

const WhoopText = ({ visible }: { visible: boolean }) => (
  <div
    style={{
      fontFamily: '"Friend", Georgia, "Times New Roman", serif',
      fontStyle: "italic",
      fontWeight: 700,
      fontSize: "clamp(48px, 12vw, 96px)",
      lineHeight: 1,
      transform: visible ? "scale(1) rotate(-12deg)" : "scale(0.3) rotate(-12deg)",
      opacity: visible ? 1 : 0,
      transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
      whiteSpace: "nowrap",
    }}
  >
    <span style={{ color: "#f8f2e9" }}>WH</span>
    <span style={{ color: "#e79024" }}>OO</span>
    <span style={{ color: "#0072b2" }}>P</span>
    <span style={{ color: "#d72229" }}>!</span>
  </div>
);

const IntroScreen = ({ onComplete }: IntroScreenProps) => {
  const [showFirst, setShowFirst] = useState(false);
  const [showSecond, setShowSecond] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowFirst(true), 300);
    const t2 = setTimeout(() => setShowSecond(true), 1000);
    const t3 = setTimeout(() => setShowTagline(true), 1800);
    const t4 = setTimeout(() => setFadeOut(true), 2600);
    const t5 = setTimeout(() => onComplete(), 3400);

    return () => {
      [t1, t2, t3, t4, t5].forEach(clearTimeout);
    };
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#231f20",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.8s ease",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <WhoopText visible={showFirst} />
        <div style={{ marginTop: -8 }}>
          <WhoopText visible={showSecond} />
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          color: "#f8f2e9",
          fontFamily: '"Friend", Georgia, "Times New Roman", serif',
          fontStyle: "normal",
          fontSize: "clamp(12px, 2.5vw, 18px)",
          textAlign: "center",
          maxWidth: 420,
          padding: "0 24px",
          opacity: showTagline ? 0.7 : 0,
          transition: "opacity 0.8s ease",
          lineHeight: 1.4,
        }}
      >
        A card game about memory, luck, and just enough competition to ruin your family dinner.
      </div>
    </div>
  );
};

export default IntroScreen;
