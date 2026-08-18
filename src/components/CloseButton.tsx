// ============================================================================
// CloseButton — the one dismiss pill used by every Daily modal.
//
// This is not a redesign. It is `DailyEmailModal`'s close control, lifted
// verbatim: the `buttonStyle("secondary","sm")` pill, the word, the 16px lucide
// X, and the invisible absolutely-positioned span that guarantees a 44px
// minimum hit area without the visible pill growing.
//
// Every caller keeps its own `aria-label` and `data-testid` strings — those are
// contract, not implementation, so they are passed in rather than derived.
// ============================================================================

import React from "react";
import { X } from "lucide-react";
import { buttonStyle } from "@/lib/tokens";

export type CloseButtonProps = {
  /** The word on the pill: CLOSE, SKIP, … */
  label: string;
  onClick: () => void;
  /** Required: the pill's word alone is not always the whole action. */
  ariaLabel: string;
  iconSize?: number;
  "data-testid"?: string;
  /** Passed through for the callers that tag the invisible hit span too. */
  hitTestId?: string;
  /** Merged over the pill style; used only for stacking context today. */
  style?: React.CSSProperties;
};

const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
  ({ label, onClick, ariaLabel, iconSize = 16, hitTestId, style, ...rest }, ref) => (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      aria-label={ariaLabel}
      className="ww-press"
      data-testid={rest["data-testid"]}
      style={{ ...buttonStyle("secondary", "sm"), gap: 4, position: "relative", ...style }}
    >
      {label}
      <X size={iconSize} strokeWidth={2} aria-hidden="true" style={{ pointerEvents: "none" }} />
      {/* invisible 44px minimum touch target; the visible pill keeps its size */}
      <span
        aria-hidden="true"
        data-testid={hitTestId}
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
  )
);
CloseButton.displayName = "CloseButton";

export default CloseButton;
