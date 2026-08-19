// ============================================================================
// DailyRecallTrend — one line in the All Time Results block, plus one popover.
//
// The line sits under the all-time tiles: it compares your first three games to
// your last three, so it is an all-time metric, not today's.
//
// Blue (#0072B2) carries the number and the arrow because blue already means
// "solved" in the result circles. There is no green in the palette.
// The tooltip opens on TAP, never hover — most traffic is a phone — and is
// rendered as an anchored popover in a portal so no parent's overflow can clip
// it, with its own panel chrome, a visible CLOSE, Escape and tap-outside.
// ============================================================================

import React from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Info } from "lucide-react";
import { COLORS, RADIUS, SPACE, BORDER, SHADOW, textStyle } from "@/lib/tokens";
import { formatRecallLine, RECALL_TOOLTIP, type RecallTrend } from "@/lib/dailyRecall";
import useDismiss from "@/hooks/useDismiss";
import CloseButton from "@/components/CloseButton";

/** Viewport gutter kept clear on both sides of the popover. */
const EDGE = 16;
const MAX_W = 320;

/** Mounted only while open, so `useDismiss` captures the icon as the opener. */
const Tip: React.FC<{
  onClose: () => void;
  mobile: boolean;
  anchor: HTMLElement | null;
}> = ({ onClose, mobile, anchor }) => {
  useDismiss(onClose, { escape: true, returnFocus: true });
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ left: number; top: number; width: number } | null>(
    null
  );

  React.useLayoutEffect(() => {
    const place = () => {
      const panel = panelRef.current;
      if (!panel || !anchor) return;
      const vw = window.innerWidth || 360;
      const vh = window.innerHeight || 640;
      const width = Math.min(MAX_W, vw - EDGE * 2);
      const a = anchor.getBoundingClientRect();
      const h = panel.offsetHeight;
      // Centred on the icon, then clamped inside the viewport gutters.
      let left = a.left + a.width / 2 - width / 2;
      left = Math.max(EDGE, Math.min(left, vw - EDGE - width));
      // Below the icon when it fits, flipped above when it does not.
      let top = a.bottom + SPACE[2];
      if (top + h > vh - EDGE) {
        const above = a.top - SPACE[2] - h;
        top = above >= EDGE ? above : Math.max(EDGE, vh - EDGE - h);
      }
      setBox({ left, top, width });
    };
    // Give the popover room below the icon before placing, so it never has to
    // flip up over the section heading it belongs to.
    anchor?.scrollIntoView?.({ block: "center" });
    place();
    // Re-measure once the panel has its final height at the clamped width.
    const id = window.requestAnimationFrame?.(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      if (id !== undefined) window.cancelAnimationFrame?.(id);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Tap outside closes. Transparent: this is a popover, not a modal. */}
      <div
        aria-hidden="true"
        data-testid="recall-tooltip-outside"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent" }}
      />
      <div
        ref={panelRef}
        role="tooltip"
        id="ww-recall-tip"
        data-testid="recall-tooltip-panel"
        style={{
          position: "fixed",
          zIndex: 9999,
          left: box?.left ?? EDGE,
          top: box?.top ?? EDGE,
          width: box?.width ?? Math.min(MAX_W, EDGE * 2),
          boxSizing: "border-box",
          padding: SPACE[4],
          display: "flex",
          flexDirection: "column",
          gap: SPACE[3],
          alignItems: "flex-start",
          background: COLORS.panel,
          color: COLORS.ink,
          border: BORDER.heavy,
          borderRadius: RADIUS.sm,
          boxShadow: SHADOW.windowFocused,
          visibility: box ? "visible" : "hidden",
        }}
      >
        <span
          data-testid="recall-tooltip"
          style={{ ...textStyle("body", mobile), display: "block", textAlign: "left" }}
        >
          {RECALL_TOOLTIP}
        </span>
        <CloseButton
          label="CLOSE"
          onClick={onClose}
          ariaLabel="Close first-time match explanation"
          data-testid="recall-tooltip-close"
          hitTestId="recall-tooltip-close-hit"
        />
      </div>
    </>,
    document.body
  );
};

const DailyRecallTrend: React.FC<{ trend: RecallTrend; mobile: boolean }> = ({
  trend,
  mobile,
}) => {
  const [open, setOpen] = React.useState(false);
  const iconRef = React.useRef<HTMLButtonElement | null>(null);
  const line = formatRecallLine(trend);
  // The percentage (and the arrow) are the only blue parts of the sentence.
  const pct = `${trend.latePct}%`;
  const [before, after] = line.split(pct);

  return (
    <p
      data-testid="recall-line"
      style={{
        ...textStyle("control", mobile),
        lineHeight: 1.45,
        color: COLORS.inkMuted,
        textAlign: "center",
        margin: 0,
        position: "relative",
      }}
    >
      {before}
      {trend.upPoints !== null && (
        // Inline, immediately before the percentage, sized to the text and
        // glued to it (nbsp) so it can never wrap onto a line of its own.
        <span style={{ whiteSpace: "nowrap", color: COLORS.blue }}>
          <ArrowUp
            size="1em"
            strokeWidth={2}
            aria-hidden="true"
            style={{ display: "inline-block", verticalAlign: "-0.12em", marginRight: "0.18em" }}
          />
          <span>{pct}</span>
        </span>
      )}
      {trend.upPoints === null && <span style={{ color: COLORS.blue }}>{pct}</span>}
      {after}
      <button
        type="button"
        ref={iconRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="What is a first-time match?"
        aria-expanded={open}
        aria-controls={open ? "ww-recall-tip" : undefined}
        data-testid="recall-info"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: SPACE[2],
          verticalAlign: "-3px",
          padding: 0,
          border: "none",
          background: "transparent",
          color: COLORS.inkMuted,
          cursor: "pointer",
        }}
      >
        <Info size={16} strokeWidth={2} aria-hidden="true" style={{ pointerEvents: "none" }} />
        {/* invisible 44px minimum touch target; the visible icon keeps its size */}
        <span
          aria-hidden="true"
          data-testid="recall-info-hit"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 44,
            height: 44,
          }}
        />
      </button>
      {open && <Tip mobile={mobile} anchor={iconRef.current} onClose={() => setOpen(false)} />}
    </p>
  );
};

export default DailyRecallTrend;
