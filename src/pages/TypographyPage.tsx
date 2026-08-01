import React from "react";
import { Helmet } from "react-helmet-async";
import SiteHeader, { SITE_HEADER_OFFSET } from "@/components/SiteHeader";
import {
  COLORS,
  SPACE,
  RADIUS,
  BORDER,
  TEXT,
  TEXT_ROLES,
  FONT_SIZE,
  type TextRole,
} from "@/lib/tokens";

const SAMPLE = "WHOOP! WHOOP! deals a fast hand.";

const roleOrder: TextRole[] = [
  "display",
  "heading",
  "subhead",
  "label",
  "body",
  "caption",
  "captionItalic",
];

const TypographyPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Typography – WHOOP! WHOOP!</title>
        <meta name="description" content="Preview of every text role in the WHOOP! WHOOP! design system." />
      </Helmet>
      <div
        style={{
          minHeight: "100dvh",
          background: COLORS.ink,
          color: COLORS.surface,
          paddingTop: SITE_HEADER_OFFSET,
        }}
      >
        <SiteHeader />
        <main
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: `${SPACE[12]}px ${SPACE[6]}px`,
            display: "flex",
            flexDirection: "column",
            gap: SPACE[12],
          }}
        >
          <header>
            <h1
              style={{
                fontFamily: '"Friend", Georgia, serif',
                fontSize: FONT_SIZE["3xl"],
                fontWeight: 900,
                lineHeight: 1.1,
                margin: `0 0 ${SPACE[4]}px`,
              }}
            >
              Typography
            </h1>
            <p
              style={{
                fontFamily: '"Friend", Georgia, serif',
                fontSize: FONT_SIZE.md,
                lineHeight: 1.4,
                color: COLORS.panelMuted,
                margin: 0,
              }}
            >
              Every TEXT role rendered at desktop and mobile sizes.
            </p>
          </header>

          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE[6],
            }}
          >
            {roleOrder.map((role) => {
              const def = TEXT[role];
              const meta = TEXT_ROLES[role];
              return (
                <article
                  key={role}
                  style={{
                    background: COLORS.surface,
                    color: COLORS.ink,
                    border: BORDER.heavy,
                    borderRadius: RADIUS.md,
                    padding: SPACE[8],
                    display: "flex",
                    flexDirection: "column",
                    gap: SPACE[6],
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: SPACE[4],
                      flexWrap: "wrap",
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: '"Friend", Georgia, serif',
                        fontSize: FONT_SIZE.lg,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        margin: 0,
                      }}
                    >
                      {role}
                    </h2>
                    <div
                      style={{
                        fontFamily: '"Friend", Georgia, serif',
                        fontSize: FONT_SIZE.xs,
                        color: COLORS.inkMuted,
                        display: "flex",
                        gap: SPACE[6],
                        flexWrap: "wrap",
                      }}
                    >
                      <span>desktop {def.size}px</span>
                      <span>mobile {def.mobileSize}px</span>
                      <span>weight {def.weight}</span>
                      <span>line-height {def.lineHeight}</span>
                      {meta.italic && <span>italic</span>}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: SPACE[4],
                    }}
                  >
                    <div
                      style={{
                        fontFamily: '"Friend", Georgia, serif',
                        fontSize: def.size,
                        fontWeight: def.weight,
                        fontStyle: def.italic ? "italic" : "normal",
                        lineHeight: def.lineHeight,
                        color: COLORS.ink,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: FONT_SIZE["2xs"],
                          fontWeight: 400,
                          color: COLORS.inkMuted,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: SPACE[2],
                        }}
                      >
                        Desktop
                      </span>
                      <div>{SAMPLE}</div>
                    </div>

                    <div
                      style={{
                        fontFamily: '"Friend", Georgia, serif',
                        fontSize: def.mobileSize,
                        fontWeight: def.weight,
                        fontStyle: def.italic ? "italic" : "normal",
                        lineHeight: def.lineHeight,
                        color: COLORS.ink,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: FONT_SIZE["2xs"],
                          fontWeight: 400,
                          color: COLORS.inkMuted,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: SPACE[2],
                        }}
                      >
                        Mobile
                      </span>
                      <div>{SAMPLE}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </main>
      </div>
    </>
  );
};

export default TypographyPage;
