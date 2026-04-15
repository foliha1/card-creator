import React from "react";

const PreOrderWindow: React.FC = () => {
  return (
    <div
      style={{
        background: "#f8f2e9",
        padding: 28,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: '"Friend", serif', fontStyle: "italic", fontSize: 22, color: "#231f20" }}>
        Get the physical game
      </div>
      <div style={{ fontSize: 13, color: "#231f20", opacity: 0.55, maxWidth: 280, marginTop: 10, lineHeight: 1.5 }}>
        48 cards, 2 match dice, and enough competition to ruin your family dinner.
      </div>
      <button
        style={{
          marginTop: 28,
          background: "#d72229",
          color: "#f8f2e9",
          fontFamily: '"Friend", serif',
          fontStyle: "italic",
          fontSize: 16,
          padding: "12px 28px",
          borderRadius: 4,
          border: "none",
          cursor: "pointer",
        }}
      >
        Pre-Order Now
      </button>
      <div style={{ fontSize: 11, color: "#231f20", opacity: 0.35, marginTop: 14 }}>
        Coming soon — Oleeha &amp; Co
      </div>
    </div>
  );
};

export default PreOrderWindow;
