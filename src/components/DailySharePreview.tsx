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

const DailySharePreview: React.FC<{
  /** Object URL of the rendered PNG; null while it is still rendering. */
  imageUrl: string | null;
  puzzleNumber: number;
  /** Label swaps to a working state while the share sheet is being prepared. */
  working?: boolean;
  mobile: boolean;
  onSend: () => void;
  onClose: () => void;
}> = ({ imageUrl, puzzleNumber, working = false, mobile, onSend, onClose }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sendRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

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

  return (
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
              justifyContent: "flex-end",
            }}
          >
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

          {/* The card. Space is reserved at 4:5 up front, so the placeholder and
              the finished PNG occupy exactly the same box. */}
          <div
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
                height: "100%",
                maxWidth: "100%",
                aspectRatio: "4 / 5",
                flex: "0 0 auto",
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
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
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
    </div>
  );
};

export default DailySharePreview;
