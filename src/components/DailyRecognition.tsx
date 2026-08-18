// ============================================================================
// Daily lobby recognition — one line of small text, never a button.
//
// This is a relabelling of something that already exists, not a new system:
// entering an email already unions history across visitor id and email, so a
// returning player on a fresh browser only needs a door that says "come back"
// instead of "subscribe". No accounts, no sessions, nothing server side.
//
// Two states:
//   recognized      → "Playing as f•••@gmail.com  Not you?"
//   not recognized  → "Already playing? Restore your streak."
//
// Height is the constraint on this screen, so the line is a single row of
// 11–13px text scaled by the same compression factor the rest of the ready
// screen uses, and the restore form opens in a fixed overlay rather than
// growing the frame.
// ============================================================================

import React from "react";
import DailyEmailModal from "@/components/DailyEmailModal";
import { maskEmail } from "@/lib/dailySubscribe";
import { hapticTap } from "@/lib/haptics";
import { COLORS, FONT_FAMILY_UI, FONT_WEIGHT_UI } from "@/lib/tokens";


/** Text link that keeps a 44px tap target without taking 44px of layout. */
const InlineAction: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}> = ({ onClick, children, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    style={{
      position: "relative",
      appearance: "none",
      background: "none",
      border: "none",
      padding: 0,
      margin: 0,
      font: "inherit",
      color: "inherit",
      cursor: "pointer",
      textDecoration: "underline",
      textUnderlineOffset: 2,
    }}
  >
    {children}
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: -4,
        right: -4,
        top: "50%",
        transform: "translateY(-50%)",
        height: 44,
      }}
    />
  </button>
);

/** The restore form: the subscribe capture, relabelled, in an overlay. */
const DailyRestoreOverlay: React.FC<{
  onClose: () => void;
  onSubscribed?: (email: string, restored: boolean) => void;
}> = ({ onClose, onSubscribed }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !card.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !card.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Restore your streak"
      data-testid="daily-restore"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(35, 31, 32, 0.6)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        style={{
          width: "100%",
          maxWidth: 354,
          background: RAW.khaki,
          border: BORDER.heavy,
          borderRadius: RADIUS.sm,
          boxSizing: "border-box",
          padding: `${SPACE[6]}px ${SPACE[8]}px ${SPACE[8]}px`,
          display: "flex",
          flexDirection: "column",
          gap: SPACE[4],
          maxHeight: "calc(100% - 8px)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ww-press"
            data-testid="daily-restore-close"
            style={{ ...buttonStyle("secondary", "sm"), position: "relative" }}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" style={{ pointerEvents: "none" }} />
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

        {/* Same component, same validation, same submit path — restore wording. */}
        <DailyEmailCapture
          source="restore"
          autoFocus
          heading="Restore your streak."
          body="Played before on another phone or browser? Enter the same email and your history comes back."
          note={null}
          submitLabel="Restore"
          onSubscribed={onSubscribed}
        />
      </div>
    </div>
  );
};

/**
 * The recognition line for the ready screen.
 *
 * `scale` is the shared compression factor (0 at a 480px viewport, 1 at 760px)
 * so this line shrinks with everything else instead of being the thing that
 * pushes the CTA off screen.
 */
const DailyRecognition: React.FC<{
  /** The stored address, or null when this browser does not know the player. */
  email: string | null;
  /** Clears the local email + subscribed flag. Nothing else. */
  onForget: () => void;
  /** Fired after a successful restore so the caller can re-read the streak. */
  onRestored?: (email: string, restored: boolean) => void;
  /** 0 → shortest viewport, 1 → full size. */
  scale?: number;
}> = ({ email, onForget, onRestored, scale = 1 }) => {
  const [confirming, setConfirming] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const masked = maskEmail(email);

  const lineStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: FONT_FAMILY_UI,
    fontWeight: FONT_WEIGHT_UI,
    fontSize: Math.round(11 + 2 * scale),
    lineHeight: 1.2,
    color: COLORS.inkMuted,
    textAlign: "center",
    // One row: the whole point is that it costs almost no height.
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };

  // Recognized, and asking before it forgets. Inline, never window.confirm.
  if (email && confirming) {
    return (
      <p style={lineStyle} data-testid="daily-recognition">
        <span>Forget {masked} on this device?</span>
        <InlineAction
          testId="daily-forget-confirm"
          onClick={() => {
            hapticTap();
            setConfirming(false);
            onForget();
          }}
        >
          Yes, forget
        </InlineAction>
        <span aria-hidden="true">·</span>
        <InlineAction
          testId="daily-forget-cancel"
          onClick={() => {
            hapticTap();
            setConfirming(false);
          }}
        >
          Keep
        </InlineAction>
      </p>
    );
  }

  if (email) {
    return (
      <p style={lineStyle} data-testid="daily-recognition">
        <span>
          Playing as <span data-testid="daily-recognition-email">{masked}</span>
        </span>
        <InlineAction
          testId="daily-not-you"
          onClick={() => {
            hapticTap();
            setConfirming(true);
          }}
        >
          Not you?
        </InlineAction>
      </p>
    );
  }

  return (
    <>
      <p style={lineStyle} data-testid="daily-recognition">
        <span>Already playing?</span>
        <InlineAction
          testId="daily-restore-open"
          onClick={() => {
            hapticTap();
            setRestoring(true);
          }}
        >
          Restore your streak.
        </InlineAction>
      </p>
      {restoring && (
        <DailyRestoreOverlay
          onClose={() => setRestoring(false)}
          onSubscribed={(value, restored) => {
            onRestored?.(value, restored);
          }}
        />
      )}
    </>
  );
};

export default DailyRecognition;
