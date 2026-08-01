import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Shrink-to-fit text for buttons.
 *
 * Renders the label on a single line and scales the font size down (never up
 * past the inherited size) until it fits the available width. Measurement is
 * driven by a ResizeObserver on the parent, so it re-fits on breakpoint
 * changes, orientation changes and label swaps — no per-call-site clamp() math.
 *
 * `minScale` guards legibility: below it the text simply stays at that size
 * (which practically never happens for real labels).
 */
interface AutoFitTextProps {
  children: React.ReactNode;
  /** Lowest allowed fraction of the inherited font size. */
  minScale?: number;
  className?: string;
  style?: React.CSSProperties;
}

const AutoFitText: React.FC<AutoFitTextProps> = ({
  children,
  minScale = 0.6,
  className,
  style,
}) => {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const [scale, setScale] = useState(1);

  const fit = useCallback(() => {
    const el = spanRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    // Available inner width: parent content box minus its padding minus any
    // in-flow siblings (icons, dividers, badges). Absolutely positioned
    // siblings (shine sweeps, washes) take no space and are ignored.
    const cs = window.getComputedStyle(parent);
    const padX = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
    let siblings = 0;
    for (const node of Array.from(parent.children)) {
      if (node === el) continue;
      const s = window.getComputedStyle(node);
      if (s.position === "absolute" || s.position === "fixed" || s.display === "none") continue;
      siblings += (node as HTMLElement).offsetWidth
        + parseFloat(s.marginLeft || "0") + parseFloat(s.marginRight || "0");
    }
    const available = parent.clientWidth - padX - siblings;
    if (available <= 0) return;

    // Measure at full size, then derive the scale in one pass.
    el.style.fontSize = "";
    const natural = el.scrollWidth;
    if (natural <= 0) return;


    const next = natural <= available ? 1 : Math.max(minScale, available / natural);
    setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  }, [minScale]);

  useLayoutEffect(fit, [fit, children]);

  useEffect(() => {
    const parent = spanRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [fit]);

  // Re-fit once webfonts land: metrics change after the swap.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) return;
    let cancelled = false;
    fonts.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
    };
  }, [fit]);

  return (
    <span
      ref={spanRef}
      className={className}
      style={{
        display: "block",
        whiteSpace: "nowrap",
        maxWidth: "100%",
        fontSize: scale === 1 ? undefined : `${(scale * 100).toFixed(2)}%`,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export default AutoFitText;
