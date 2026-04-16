import React, { useState, useRef, useCallback, useEffect } from "react";
import { COLORS, BORDER, RADIUS, SHADOW, MOTION, FONT_FAMILY } from "@/lib/tokens";

interface WindowProps {
  title: string;
  id: string;
  defaultPosition: { x: number; y: number };
  width: number;
  height: number;
  onClose: () => void;
  onFocus: (id: string) => void;
  zIndex: number;
  children: React.ReactNode;
  mobile?: boolean;
  focused?: boolean;
}

const Window: React.FC<WindowProps> = ({
  title,
  id,
  defaultPosition,
  width,
  height,
  onClose,
  onFocus,
  zIndex,
  children,
  mobile = false,
  focused = false,
}) => {
  const [pos, setPos] = useState(defaultPosition);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(0, Math.min(x, Math.max(0, window.innerWidth - width))),
      y: Math.max(0, Math.min(y, Math.max(0, window.innerHeight - height))),
    }),
    [width, height]
  );

  const onDragStart = useCallback(
    (clientX: number, clientY: number) => {
      if (mobile) return;
      offsetRef.current = { x: clientX - pos.x, y: clientY - pos.y };
      setDragging(true);
    },
    [pos, mobile]
  );

  useEffect(() => {
    if (!dragging || mobile) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setPos(clamp(clientX - offsetRef.current.x, clientY - offsetRef.current.y));
    };

    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, clamp, mobile]);

  const outerStyle: React.CSSProperties = mobile
    ? {
        position: "relative",
        width: "calc(100vw - 32px)",
        margin: "0 auto",
        height: "auto",
        background: COLORS.surface,
        border: BORDER.standard,
        borderRadius: RADIUS.md,
        padding: 10,
        boxShadow: SHADOW.windowFocused,
        zIndex,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: "calc(100dvh - 80px)",
        overflow: "auto",
      }
    : {
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width,
        height,
        background: COLORS.surface,
        border: BORDER.standard,
        borderRadius: RADIUS.md,
        padding: 10,
        boxShadow: focused ? SHADOW.windowFocused : SHADOW.windowUnfocused,
        zIndex,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        userSelect: dragging ? "none" : undefined,
      };

  return (
    <div
      style={outerStyle}
      onMouseDown={() => onFocus(id)}
      onTouchStart={() => onFocus(id)}
    >
      {/* Title bar */}
      <div
        style={{
          height: 26,
          display: "flex",
          alignItems: "center",
          padding: "0 4px",
          cursor: mobile ? "default" : dragging ? "grabbing" : "grab",
          flexShrink: 0,
        }}
        onDoubleClick={(e) => e.preventDefault()}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-close-btn]")) return;
          onDragStart(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest("[data-close-btn]")) return;
          const t = e.touches[0];
          onDragStart(t.clientX, t.clientY);
        }}
      >
        <button
          data-close-btn
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: mobile ? 44 : 24,
            height: mobile ? 44 : 24,
            color: COLORS.ink,
            transition: `color ${MOTION.fast}`,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = COLORS.red;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = COLORS.ink;
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="2" x2="13" y2="13" />
            <line x1="13" y1="2" x2="2" y2="13" />
          </svg>
        </button>
        <span
          style={{
            flex: 1,
            fontFamily: FONT_FAMILY,
            fontStyle: "normal",
            fontSize: 20,
            color: COLORS.ink,
            pointerEvents: "none",
            lineHeight: 1,
            textAlign: "right",
          }}
        >
          {title}
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          background: COLORS.panel,
          border: BORDER.standard,
          borderRadius: RADIUS.md,
          minHeight: mobile ? 260 : undefined,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Window;
