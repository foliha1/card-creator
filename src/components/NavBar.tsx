import { useState } from "react";
import { Volume2, VolumeX, Menu, X } from "lucide-react";
import HowToPlayModal from "@/components/HowToPlayModal";
import { setMuted, isMuted } from "@/lib/sounds";

interface NavBarProps {
  visible: boolean;
}

const NAV_LINKS = [
  { label: "Pre-order", href: "#preorder" },
  { label: "Learn More", href: "#learn" },
  { label: "About", href: "#about" },
];

const NavBar = ({ visible }: NavBarProps) => {
  const [howToOpen, setHowToOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  return (
    <>
      <style>{`
        @media (min-width: 481px) {
          .nav-desktop-links { display: flex !important; }
          .nav-hamburger { display: none !important; }
        }
        @media (max-width: 480px) {
          .nav-desktop-links { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
        @keyframes drawer-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes drawer-slide-out {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        @keyframes drawer-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

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
              padding: "12px 4px",
              minHeight: 44,
              minWidth: 44,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            How to Play
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Desktop links */}
          <div className="nav-desktop-links" style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {NAV_LINKS.map((link) => (
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
          </div>

          {/* Mute button */}
          <button
            onClick={toggleMute}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#f8f2e9",
              opacity: 0.7,
              transition: "opacity 0.2s",
              padding: "12px 4px",
              minHeight: 44,
              minWidth: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Hamburger (mobile only) */}
          <button
            className="nav-hamburger"
            onClick={() => setDrawerOpen(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#f8f2e9",
              padding: "12px 4px",
              minHeight: 44,
              minWidth: 44,
              display: "none",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            animation: "drawer-fade-in 0.2s ease",
          }}
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(35,31,32,0.5)" }} />

          {/* Drawer panel */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 240,
              height: "100%",
              background: "#231f20",
              padding: "20px 24px",
              animation: "drawer-slide-in 0.3s ease-out",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f8f2e9",
                  cursor: "pointer",
                  padding: 8,
                  minHeight: 44,
                  minWidth: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={22} />
              </button>
            </div>
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
                style={{
                  color: "#f8f2e9",
                  fontSize: 18,
                  fontWeight: 700,
                  fontStyle: "italic",
                  textDecoration: "none",
                  padding: "12px 0",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  opacity: 0.8,
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}

      <HowToPlayModal open={howToOpen} onClose={() => setHowToOpen(false)} />
    </>
  );
};

export default NavBar;
