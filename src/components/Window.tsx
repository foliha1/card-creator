import React, { useState, useRef, useCallback, useEffect } from "react";

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
        background: "#F8F2E9",
        border: "1.5px solid #231f20",
        borderRadius: 6,
        padding: 10,
        boxShadow: "4px 6px 0 rgba(0,0,0,0.3)",
        zIndex,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 300,
        maxHeight: "calc(100vh - 120px)",
      }
    : {
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width,
        height,
        background: "#F8F2E9",
        border: "1.5px solid #231f20",
        borderRadius: 6,
        padding: 10,
        boxShadow: focused ? "4px 6px 0 rgba(0,0,0,0.3)" : "3px 4px 0 rgba(0,0,0,0.15)",
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
            color: "#231f20",
            transition: "color 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#d72229";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#231f20";
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
            fontFamily: '"Friend", sans-serif',
            fontStyle: "normal",
            fontSize: 20,
            color: "#231f20",
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
          overflow: "hidden",
          background: "#D0C3AF",
          border: "1.5px solid #231f20",
          borderRadius: 6,
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
