import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import DailyShapeRule from "@/components/DailyShapeRule";
import DailyLogoLockup from "@/components/DailyLogoLockup";
import DailyEmailCapture from "@/components/DailyEmailCapture";
import { BORDER, COLORS, FONT_FAMILY, RADIUS } from "@/lib/tokens";

const GEIST = '"Geist", "Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: FONT_FAMILY,
  lineHeight: 1.15,
  color: COLORS.ink,
};

const subheadStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: FONT_FAMILY,
  lineHeight: 1.2,
  color: COLORS.ink,
};

const bodyStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: GEIST,
  lineHeight: 1.45,
  color: COLORS.ink,
};

const fineStyle: React.CSSProperties = {
  ...bodyStyle,
  color: COLORS.inkMuted,
};

const section: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const HowItWorksItem: React.FC<{ title: string; line: string }> = ({ title, line }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <h3 style={subheadStyle}>{title}</h3>
    <p style={bodyStyle}>{line}</p>
  </div>
);

const SecondaryWay: React.FC<{ label: string; line: string; to: string }> = ({ label, line, to }) => (
  <div style={{ flex: "1 1 160px", display: "flex", flexDirection: "column", gap: 8 }}>
    <Link
      to={to}
      className="ww-press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
        border: BORDER.heavy,
        borderRadius: RADIUS.sm,
        background: "transparent",
        color: COLORS.ink,
        textDecoration: "none",
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        lineHeight: 1.15,
      }}
    >
      {label}
    </Link>
    <p className="ww-landing-fine" style={fineStyle}>{line}</p>
  </div>
);


const BOARD_CARDS: string[] = [
  "/cards/card-back.svg",
  "/cards/2-star-red.svg",
  "/cards/card-back.svg",
  "/cards/card-back.svg",
  "/cards/card-back.svg",
  "/cards/3-circle-blue.svg",
  "/cards/1-square-yellow.svg",
  "/cards/card-back.svg",
  "/cards/card-back.svg",
];

/** Decorative 3x3 board, desktop only, hidden from assistive tech. */
const DecorativeBoard: React.FC = () => (
  <div className="ww-landing-board" aria-hidden="true" role="presentation">
    {BOARD_CARDS.map((src, i) => (
      <img key={i} src={src} alt="" draggable={false} />
    ))}
  </div>
);

/**
 * Landing page at `/`. Single scrolling page that reuses the daily screen's
 * visual language: cream field, pattern strips top and tail, Friend headings,
 * Geist body copy.
 */
const LandingPage: React.FC = () => (
  <>
    <Helmet>
      <title>Whoop Whoop — Nine cards. Ten seconds. Then the rules change.</title>
      <meta
        name="description"
        content="A memory game that moves the target on you. Nine cards, ten seconds, three rounds. Play the free daily puzzle, solo, or with friends."
      />
      <meta
        property="og:title"
        content="Whoop Whoop — Nine cards. Ten seconds. Then the rules change."
      />
      <meta
        property="og:description"
        content="A memory game that moves the target on you. New puzzle every day. Free, no signup."
      />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>

    <div
      className="ww-landing-shell"
      style={
        {
          minHeight: "100dvh",
          background: COLORS.surface,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          padding: 24,
          paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          "--daily-content-max-width": "402px",
          "--daily-content-padding-x": "24px",
        } as React.CSSProperties
      }
    >
      <DailyShapeRule />

      <main className="ww-landing-main">
        {/* 1. Hero */}
        <section className="ww-landing-hero">
          <div className="ww-landing-hero-copy">
          <DailyLogoLockup />
          <h1 style={headingStyle}>Nine cards. Ten seconds. Then the rules change.</h1>
          <p style={bodyStyle}>
            A memory game that moves the target on you. New puzzle every day.
          </p>
          <Link
            to="/today"
            className="ww-press ww-landing-play"
            style={{
              height: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
              background: COLORS.red,
              border: BORDER.heavy,
              borderRadius: RADIUS.sm,
              color: COLORS.surface,
              textDecoration: "none",
              fontFamily: FONT_FAMILY,
              fontStyle: "italic",
              lineHeight: 1.15,
            }}
          >
            <span style={{ display: "block", paddingBottom: 6 }}>Play Today's Daily</span>
          </Link>

          <p className="ww-landing-fine" style={fineStyle}>
            Free. No signup. About 30 seconds.
          </p>
          </div>

          <DecorativeBoard />
        </section>

        <div className="ww-landing-below">
        {/* 2. How it works */}
        <section style={{ ...section, gap: 20 }}>
          <HowItWorksItem title="See them." line="All nine cards face up for ten seconds." />
          <HowItWorksItem title="Lose them." line="The board flips down." />
          <HowItWorksItem
            title="Find them."
            line="The die decides what a match means. Three rounds, and it changes every time."
          />
        </section>

        {/* 3. The hook */}
        <section style={section}>
          <h2 style={headingStyle}>The cards never move. What matters about them does.</h2>
          <p style={bodyStyle}>
            You spent ten seconds learning shapes. The die says color. Good luck.
          </p>
        </section>

        {/* 4. Two more ways to play */}
        <section style={{ ...section, gap: 16 }}>
          <h2 style={subheadStyle}>Two more ways to play</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <SecondaryWay
              label="Solo"
              to="/play?mode=solo"
              line="Play the full game against Felix O. He remembers. Mostly."
            />
            <SecondaryWay
              label="Multiplayer"
              to="/play?mode=multiplayer"
              line="Get four friends around one board. This is the real thing."
            />

          </div>
        </section>

        {/* 5. Email capture */}
        <section style={section}>
          <DailyEmailCapture source="landing" />
        </section>

        {/* 6. Footer */}
        <footer style={{ ...section, gap: 4 }}>
          <p style={subheadStyle}>A game from Oleeha &amp; Co.</p>
          <p className="ww-landing-fine" style={fineStyle}>
            Coming to a table near you.
          </p>
        </footer>
        </div>
      </main>

      <DailyShapeRule />
    </div>
  </>
);

export default LandingPage;
