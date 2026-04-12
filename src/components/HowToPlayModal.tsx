import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import GameCard from "@/components/GameCard";
import DieDisplay from "@/components/DieDisplay";

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

const Slide1 = () => {
  const [faceUp, setFaceUp] = useState(false);

  useState(() => {
    const interval = setInterval(() => setFaceUp((v) => !v), 1500);
    return () => clearInterval(interval);
  });

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "24px 0" }}>
      <GameCard
        card={{ id: "circle-2-blue", shape: "circle", number: 2, color: "blue", svgPath: "/cards/2 circle blue.svg" }}
        faceUp={faceUp}
        onClick={() => setFaceUp((v) => !v)}
      />
    </div>
  );
};

const Slide2 = () => (
  <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "24px 0" }}>
    <DieDisplay value="SHAPE" rolling={false} />
    <DieDisplay value="COLOR" rolling={false} />
  </div>
);

const Slide3 = () => (
  <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "24px 0" }}>
    <GameCard
      card={{ id: "star-3-red", shape: "star", number: 3, color: "red", svgPath: "/cards/3 star red.svg" }}
      faceUp={true}
      matched={true}
    />
    <GameCard
      card={{ id: "star-1-red", shape: "star", number: 1, color: "red", svgPath: "/cards/1 star red.svg" }}
      faceUp={true}
      matched={true}
    />
  </div>
);

const slides = [
  { title: "Peek cards to memorize", desc: "Tap any face-down card to peek at it for 2 seconds. Try to remember what you see!", component: Slide1 },
  { title: "Roll dice to change the rules", desc: "Each round, dice determine which attributes must match — shape, number, or color.", component: Slide2 },
  { title: "Call WHOOP! WHOOP! to claim matches", desc: "When you spot a pair that matches the current rule, call it and tap both cards to score!", component: Slide3 },
];

const HowToPlayModal = ({ open, onClose }: HowToPlayModalProps) => {
  const [slide, setSlide] = useState(0);

  if (!open) return null;

  const SlideComponent = slides[slide].component;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(35,31,32,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#f8f2e9",
          borderRadius: 16,
          padding: 32,
          maxWidth: 480,
          width: "calc(100% - 32px)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#231f20",
            padding: 4,
          }}
        >
          <X size={32} />
        </button>

        {/* Content */}
        <h2
          style={{
            fontStyle: "italic",
            fontSize: 22,
            fontWeight: 700,
            color: "#231f20",
            margin: 0,
            paddingRight: 40,
          }}
        >
          {slides[slide].title}
        </h2>
        <p style={{ fontSize: 14, color: "#231f20", opacity: 0.7, marginTop: 8 }}>
          {slides[slide].desc}
        </p>

        <SlideComponent />

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <button
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            style={{
              background: "none",
              border: "none",
              cursor: slide > 0 ? "pointer" : "default",
              opacity: slide > 0 ? 0.7 : 0.2,
              color: "#231f20",
              padding: 4,
            }}
          >
            <ChevronLeft size={24} />
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {slides.map((_, i) => (
              <div
                key={i}
                onClick={() => setSlide(i)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#231f20",
                  opacity: i === slide ? 1 : 0.3,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setSlide((s) => Math.min(slides.length - 1, s + 1))}
            style={{
              background: "none",
              border: "none",
              cursor: slide < slides.length - 1 ? "pointer" : "default",
              opacity: slide < slides.length - 1 ? 0.7 : 0.2,
              color: "#231f20",
              padding: 4,
            }}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowToPlayModal;
