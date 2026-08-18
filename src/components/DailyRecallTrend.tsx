// ============================================================================
// DailyRecallTrend — one line on the results screen, plus one tooltip.
//
// The line sits directly under today's numbers, beside the percentile: the
// percentile says how you did against the crowd today, this says how your own
// recall is moving. Same block, same voice, no new section.
//
// Blue (#0072B2) carries the number and the arrow because blue already means
// "solved" in the result circles. There is no green in the palette.
// The tooltip opens on TAP, never hover — most traffic is a phone.
// ============================================================================

import React from "react";
import { ArrowUp, Info } from "lucide-react";
import { COLORS, RADIUS, SPACE, BORDER, textStyle } from "@/lib/tokens";
import { formatRecallLine, RECALL_TOOLTIP, type RecallTrend } from "@/lib/dailyRecall";
import useDismiss from "@/hooks/useDismiss";

/** Mounted only while open, so `useDismiss` captures the icon as the opener. */
const Tip: React.FC<{ onClose: () => void; mobile: boolean }> = ({ onClose, mobile }) => {
  useDismiss(onClose, { escape: true, returnFocus: true });
  return (
    <span
      role="tooltip"
      id="ww-recall-tip"
      data-testid="recall-tooltip"
      style={{
        ...textStyle("caption", mobile),
        display: "block",
        position: "absolute",
        zIndex: 3,
        left: "50%",
        transform: "translateX(-50%)",
        top: "100%",
        marginTop: SPACE[2],
        width: "min(280px, 78vw)",
        padding: SPACE[3],
        background: COLORS.panel,
        color: COLORS.ink,
        border: BORDER.heavy,
        borderRadius: RADIUS.sm,
        textAlign: "left",
      }}
    >
      {RECALL_TOOLTIP}
    </span>
  );
};

const DailyRecallTrend: React.FC<{ trend: RecallTrend; mobile: boolean }> = ({
  trend,
  mobile,
}) => {
  const [open, setOpen] = React.useState(false);
  const line = formatRecallLine(trend);
  // The percentage (and the arrow) are the only blue parts of the sentence.
  const pct = `${trend.latePct}%`;
  const [before, after] = line.split(pct);

  return (
    <p
      data-testid="recall-line"
      style={{
        ...textStyle("body", mobile),
        color: COLORS.inkMuted,
        textAlign: "center",
        margin: 0,
        position: "relative",
      }}
    >
      {trend.upPoints !== null && (
        <ArrowUp
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          style={{ color: COLORS.blue, verticalAlign: "-2px", marginRight: 2 }}
        />
      )}
      {before}
      <span style={{ color: COLORS.blue }}>{pct}</span>
      {after}
      <button
        type="button"
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
      {open && <Tip mobile={mobile} onClose={() => setOpen(false)} />}
    </p>
  );
};

export default DailyRecallTrend;
