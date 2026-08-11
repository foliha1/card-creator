// ============================================================================
// DailySharePreview — "see it before you post it".
//
// A sibling of the How to Play modal by design: same full-bleed cream overlay
// inside the 24px DailyFrame gutter, same shape rules top and bottom, the same
// khaki card, the same top-right close control, Escape to dismiss, focus moved
// in on open and trapped while open.
//
// It is purely presentational: it shows the PNG that `useDailyShareImage`
// already rendered and hands the Send press back to the caller, which owns the
// whole share/fallback chain.
// ============================================================================

import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import DailyShapeRule from "@/components/DailyShapeRule";
import {
  BORDER,
  COLORS,
  RADIUS,
  RAW,
  SPACE,
  buttonStyle,
  textStyle,
} from "@/lib/tokens";

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The card composition's own pixel size — it never scales up beyond this. */
const CARD_MAX_W = 1080;

const DailySharePreview: React.FC<{
  /** Object URL of the rendered PNG; null while it is still rendering. */
  imageUrl: string | null;
  puzzleNumber: number;
  /** Which version of the card is on screen. Per-share, never persisted. */
  imageTheme: "light" | "night";
  onSetTheme: (theme: "light" | "night") => void;
  /** Label swaps to a working state while the share sheet is being prepared. */
  working?: boolean;
  mobile: boolean;
  onSend: () => void;
  onClose: () => void;
}> = ({
  imageUrl,
  puzzleNumber,
  imageTheme,
  onSetTheme,
  working = false,
  mobile,
  onSend,
  onClose,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sendRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

  /** Derive the largest 4:5 box that fits the slot, so the ratio is exact. */
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const measure = () => {
      const { width, height } = slot.getBoundingClientRect();
      // 4:5, fits both axes, and never grows past the composition itself.
      const w = Math.max(0, Math.min(width, height * (4 / 5), CARD_MAX_W));
      setBox({ w: Math.floor(w), h: Math.floor(w * (5 / 4)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    return () => ro.disconnect();
  }, []);

  // Focus moves in on open: the Send button when it is live, the close control
  // while the image is still rendering.
  useEffect(() => {
    const t = window.setTimeout(() => {
      (sendRef.current && !sendRef.current.disabled
        ? sendRef.current
        : closeRef.current
      )?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [imageUrl]);

  const trap = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const host = hostRef.current;
      if (!host) return;
      const items = Array.from(
        host.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !host.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", trap, true);
    return () => window.removeEventListener("keydown", trap, true);
  }, [trap]);

  return createPortal(
    <div
      ref={hostRef}
      role="dialog"
      aria-modal="true"
      aria-label="Your share card"
      data-testid="share-preview"
      style={
        {
          position: "fixed",
          inset: 0,
          // In-app browsers over-report the layout viewport; `--ww-vh` resolves
          // to dvh where available and falls back to vh.
          height: "var(--ww-vh)",
          zIndex: 1000,
          background: COLORS.surface,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          overflow: "hidden",
          // The same 24px frame as DailyFrame, so the shape rules measure the
          // identical band and nothing appears to shift when this opens.
          gap: 24,
          padding: 24,
          paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
          "--daily-content-max-width": "402px",
          "--daily-content-padding-x": "24px",
        } as React.CSSProperties
      }
    >
      <DailyShapeRule />

      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          width: "100%",
          maxWidth: 402,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            minHeight: 0,
            background: RAW.khaki,
            borderRadius: RADIUS.sm,
            boxSizing: "border-box",
            padding: "min(24px, 3.5vh) clamp(16px, 9%, 32px) min(24px, 4vh)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0,
          }}
        >
          {/* top row: close control, in the How to Play position */}
          <div
            style={{
              width: "100%",
              flex: "0 0 auto",
              marginBottom: SPACE[4],
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            {/* Theme toggle: a slideable two-position switch.
                The whole left/right half is tappable, and the blue ring slides
                to the active circle so the state is obvious at a glance. */}
            <div
              role="group"
              aria-label="Card theme"
              style={{
                position: "relative",
                width: 128,
                height: 44,
                borderRadius: 22,
                boxSizing: "border-box",
                border: `1.5px solid ${RAW.warmGrey}`,
                background: RAW.cream,
                display: "flex",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => onSetTheme("light")}
                className="ww-press"
                aria-pressed={imageTheme === "light"}
                aria-label="Use the light card"
                data-testid="share-preview-theme-light"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: RAW.cream,
                    border: `1.5px solid ${RAW.warmGrey}`,
                    boxSizing: "border-box",
                  }}
                />
              </button>
              <button
                type="button"
                onClick={() => onSetTheme("night")}
                className="ww-press"
                aria-pressed={imageTheme === "night"}
                aria-label="Use the night card"
                data-testid="share-preview-theme-night"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: RAW.warmBlack,
                    border: `1.5px solid ${RAW.warmGrey}`,
                    boxSizing: "border-box",
                  }}
                />
              </button>
              {/* Sliding selection ring — purely decorative. */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 5,
                  left: imageTheme === "light" ? 5 : 89,
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  boxSizing: "border-box",
                  border: `2.5px solid ${RAW.blue}`,
                  transition: "left 200ms ease",
                  pointerEvents: "none",
                }}
              />
            </div>

            <button
              type="button"
              ref={closeRef}
              onClick={onClose}
              aria-label="Close share card"
              className="ww-press"
              data-testid="share-preview-close"
              style={{ ...buttonStyle("secondary", "sm"), gap: 4, position: "relative" }}
            >
              CLOSE
              <X size={16} strokeWidth={2} aria-hidden="true" style={{ pointerEvents: "none" }} />
              {/* invisible 44px minimum touch target */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: 44,
                  minWidth: 44,
                }}
              />
            </button>
          </div>

          {/* The card. The slot is measured and the box derived from it, so the
              placeholder and the finished PNG occupy the exact same 4:5 space. */}
          <div
            ref={slotRef}
            style={{
              flex: "1 1 0",
              minHeight: 0,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: box.w,
                height: box.h,
                flex: "0 0 auto",
                boxSizing: "border-box",
                border: BORDER.heavy,
                borderRadius: RADIUS.sm,
                background: COLORS.panel,
                overflow: "hidden",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Your WHOOP! WHOOP! Daily #${puzzleNumber} share card`}
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...textStyle("caption", mobile),
                    color: COLORS.inkMuted,
                    textAlign: "center",
                  }}
                >
                  Making your card…
          </div>
              )}
            </div>
          </div>

          <button
            type="button"
            ref={sendRef}
            className="ww-press"
            onClick={onSend}
            disabled={!imageUrl || working}
            data-testid="share-preview-send"
            style={{
              ...buttonStyle("primary", "lg", { mobile }),
              alignSelf: "stretch",
              flex: "0 0 auto",
              marginTop: SPACE[4],
              opacity: !imageUrl || working ? 0.6 : 1,
            }}
          >
            {working ? "SENDING…" : "SEND"}
          </button>
        </div>
      </div>

      <DailyShapeRule />
    </div>,
    document.body
  );
};

export default DailySharePreview;
