import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import HowToPlayModal from "@/components/HowToPlayModal";
import { setMuted, isMuted } from "@/lib/sounds";

interface NavBarProps {
  visible: boolean;
}

const NavBar = ({ visible }: NavBarProps) => {
  const [howToOpen, setHowToOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: 56,
          zIndex: 50,
          background: "#231f20ee",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img
            src="/WhoopWhoop_Stacked_Logo.svg"
            alt="WHOOP! WHOOP!"
            style={{ height: 40, width: "auto" }}
            draggable={false}
          />
          <button
            onClick={() => setHowToOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "#f8f2e9",
              fontSize: 15,
              fontStyle: "italic",
              fontWeight: 700,
              cursor: "pointer",
              opacity: 0.7,
              transition: "opacity 0.2s",
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            How to Play
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {[
            { label: "Pre-order", href: "#preorder" },
            { label: "Learn More", href: "#learn" },
            { label: "About", href: "#about" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                color: "#f8f2e9",
                fontSize: 15,
                textDecoration: "none",
                opacity: 0.7,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={toggleMute}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#f8f2e9",
              opacity: 0.7,
              transition: "opacity 0.2s",
              padding: 0,
              display: "flex",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </nav>

      <HowToPlayModal open={howToOpen} onClose={() => setHowToOpen(false)} />
    </>
  );
};

export default NavBar;
