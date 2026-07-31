import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Settings, X } from "lucide-react";
import { COLORS, FONT_FAMILY, RADIUS, BORDER } from "@/lib/tokens";
import whoopLightLogo from "@/assets/WhoopWhoop_Light_Logo.svg.asset.json";
import ThemePicker from "@/components/ThemePicker";

const TOUCH = 44;

/** Bar height, excluding the safe-area inset that pads it from the top. */
export const SITE_HEADER_H = 44;
/** CSS length: bar height + notch inset. Use for page top offsets. */
export const SITE_HEADER_OFFSET = `calc(${SITE_HEADER_H}px + env(safe-area-inset-top))`;
/** DOM id — read by the in-game card sizer to measure the real bar height. */
export const SITE_HEADER_ID = "site-header";

export interface SiteHeaderProps {
  /** Provide to hand settings to the host screen; otherwise a built-in sheet opens. */
  onSettings?: () => void;
  /** In-game only: adds a leave control alongside settings in the right slot. */
  onLeave?: () => void;
}

/**
 * Persistent site header. Fixed to the top of the viewport, full width, on
 * every screen: support page, play-style screen, lobby and in-game. The bar
 * spans edge to edge; its contents are constrained to the 420px game column.
 */
const SiteHeader: React.FC<SiteHeaderProps> = ({ onSettings, onLeave }) => {
  const [showSettings, setShowSettings] = useState(false);
  const openSettings = onSettings ?? (() => setShowSettings(true));

  const controlBase: React.CSSProperties = {
    minHeight: TOUCH,
    minWidth: TOUCH,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 1,
    color: COLORS.surface,
    textDecoration: "none",
    background: "transparent",
    border: "none",
    padding: "0 8px",
    whiteSpace: "nowrap",
    cursor: "pointer",
  };

  return (
    <>
      <header
        id={SITE_HEADER_ID}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          height: SITE_HEADER_OFFSET,
          paddingTop: "env(safe-area-inset-top)",
          background: COLORS.ink,
          borderBottom: `2px solid ${COLORS.surface}`,
          boxSizing: "border-box",
          zIndex: 50,
        }}
      >
        <nav
          aria-label="Main"
          style={{
            maxWidth: 420,
            margin: "0 auto",
            height: SITE_HEADER_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 4,
            paddingLeft: 4,
            paddingRight: 4,
            boxSizing: "border-box",
          }}
        >
          <a href="/about#how-to-play" style={{ ...controlBase, flex: "none" }}>
            How to Play
          </a>

          <Link
            to="/"
            aria-label="WHOOP! WHOOP! home"
            style={{ ...controlBase, flex: "0 1 auto", minWidth: 0, overflow: "hidden" }}
          >
            <img
              src={whoopLightLogo.url}
              alt="WHOOP! WHOOP!"
              style={{ height: 22, display: "block", maxWidth: "100%" }}
            />
          </Link>

          <div style={{ display: "flex", alignItems: "center", flex: "none" }}>
            <button
              type="button"
              onClick={openSettings}
              aria-label="Settings"
              style={{ ...controlBase, width: TOUCH, height: TOUCH, padding: 0 }}
            >
              <Settings size={22} color={COLORS.surface} aria-hidden="true" />
            </button>
            {onLeave && (
              <button
                type="button"
                onClick={onLeave}
                aria-label="Leave game"
                style={{ ...controlBase, width: TOUCH, height: TOUCH, padding: 0 }}
              >
                <X size={22} color={COLORS.surface} aria-hidden="true" />
              </button>
            )}
          </div>
        </nav>
      </header>

      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="site-settings-title"
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
                id="site-settings-title"
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
            <ThemePicker />
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

export default SiteHeader;
