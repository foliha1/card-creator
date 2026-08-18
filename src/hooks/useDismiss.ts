// ============================================================================
// useDismiss — the one place the Daily's modals learn how to be dismissed.
//
// Replaces four near-identical `window.addEventListener("keydown")` blocks.
// Focus trapping stays with each modal (they each have their own idea of what
// is focusable and when); this hook only owns:
//
//   escape       Escape closes. On for all four Daily modals.
//   backdrop     Returns an onClick for the outermost element that closes when
//                the click landed on it and not a child. Off unless asked for,
//                so each modal's current behaviour is preserved exactly.
//   returnFocus  Remembers what was focused when the modal opened and gives
//                focus back on unmount. `DailySharePreview` already did this
//                via the caller's `shareBtnRef`; now all four do it here.
// ============================================================================

import React from "react";

export type DismissOptions = {
  escape?: boolean;
  backdrop?: boolean;
  returnFocus?: boolean;
};

export function useDismiss(
  onClose: () => void,
  { escape = true, backdrop = false, returnFocus = false }: DismissOptions = {}
) {
  // Latest close handler, so the listener never needs re-binding.
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;

  React.useEffect(() => {
    if (!escape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [escape]);

  React.useEffect(() => {
    if (!returnFocus) return;
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      // After the modal has gone: hand focus back to whatever opened it, as
      // long as it is still in the document.
      if (!opener || !opener.isConnected || typeof opener.focus !== "function") return;
      window.setTimeout(() => opener.focus(), 0);
    };
  }, [returnFocus]);

  const onBackdropClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (!backdrop) return;
      if (e.target === e.currentTarget) closeRef.current();
    },
    [backdrop]
  );

  return { onBackdropClick };
}

export default useDismiss;
