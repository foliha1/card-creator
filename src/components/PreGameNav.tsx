import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Settings, X } from "lucide-react";
import { COLORS, FONT_FAMILY, RADIUS, BORDER } from "@/lib/tokens";
import whoopLightLogo from "@/assets/WhoopWhoop_Light_Logo.svg.asset.json";

const TOUCH = 44;

/**
 * Pre-game nav bar. Only used on the play-style screen and the lobby — never
 * in the in-game view, which is vertically constrained.
 */
const PreGameNav: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);

  const linkStyle: React.CSSProperties = {
    minHeight: TOUCH,
    minWidth: TOUCH,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    lineHeight: 1,
    color: COLORS.surface,
    textDecoration: "none",
    border: `2px solid ${COLORS.surface}`,
    borderRadius: RADIUS.sm,
    background: "transparent",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <nav
        aria-label="Main"
        style={{
          position: "absolute",
          top: "calc(8px + env(safe-area-inset-top))",
          left: "calc(8px + env(safe-area-inset-left))",
          right: "calc(8px + env(safe-area-inset-right))",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Link
          to="/"
          aria-label="WHOOP! WHOOP! home"
          style={{
            minHeight: TOUCH,
            minWidth: TOUCH,
            display: "inline-flex",
            alignItems: "center",
            padding: "0 4px",
          }}
        >
          <img
            src={whoopLightLogo.url}
            alt="WHOOP! WHOOP!"
            style={{ height: 24, display: "block" }}
          />
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/about#how-to-play" style={linkStyle}>
            How to Play
          </a>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            style={{
              all: "unset",
              cursor: "pointer",
              width: TOUCH,
              height: TOUCH,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
              background: COLORS.blue,
              border: BORDER.heavy,
              borderRadius: RADIUS.sm,
            }}
          >
            <Settings size={24} color={COLORS.ink} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pregame-settings-title"
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(35,31,32,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              background: COLORS.surface,
              border: BORDER.heavy,
              borderRadius: RADIUS.sm,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h2
                id="pregame-settings-title"
                style={{ margin: 0, fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: COLORS.ink }}
              >
                Settings
              </h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
                style={{
                  all: "unset",
                  cursor: "pointer",
                  width: TOUCH,
                  height: TOUCH,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                }}
              >
                <X size={20} color={COLORS.ink} aria-hidden="true" />
              </button>
            </div>
            <p style={{ margin: 0, fontFamily: FONT_FAMILY, fontSize: 15, color: COLORS.inkMuted }}>
              Coming soon.
            </p>
            <a
              href="/about#how-to-play"
              style={{
                minHeight: TOUCH,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_FAMILY,
                fontSize: 16,
                color: COLORS.ink,
                textDecoration: "none",
                border: BORDER.heavy,
                borderRadius: RADIUS.sm,
                boxSizing: "border-box",
              }}
            >
              How to Play
            </a>
          </div>
        </div>
      )}
    </>
  );
};

export default PreGameNav;
