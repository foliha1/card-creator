interface GameOverScreenProps {
  score: number;
  onRestart: () => void;
}

const GameOverScreen = ({ score, onRestart }: GameOverScreenProps) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#231f20",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <h1
        style={{
          color: "#f8f2e9",
          fontStyle: "italic",
          fontSize: "clamp(36px, 8vw, 64px)",
          fontWeight: 700,
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        Game Over!
      </h1>

      <p style={{ color: "#e79024", fontSize: 20, marginTop: 8 }}>
        You collected {score} of 48 cards
      </p>

      <button
        onClick={onRestart}
        style={{
          background: "#d72229",
          color: "#f8f2e9",
          fontStyle: "italic",
          fontSize: 18,
          fontWeight: 700,
          border: "none",
          borderRadius: 10,
          padding: "16px 40px",
          marginTop: 40,
          cursor: "pointer",
        }}
      >
        Play Again
      </button>

      <div
        style={{
          marginTop: 40,
          display: "flex",
          justifyContent: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <a
          href="#preorder"
          style={{
            color: "#e79024",
            fontSize: 16,
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          Pre-order the physical game →
        </a>
        <a
          href="#learn"
          style={{
            color: "#0072b2",
            fontSize: 16,
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          Learn more about WHOOP! WHOOP! →
        </a>
      </div>
    </div>
  );
};

export default GameOverScreen;
