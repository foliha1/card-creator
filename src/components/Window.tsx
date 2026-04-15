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
}) => {
  const [pos, setPos] = useState(defaultPosition);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(0, Math.min(x, window.innerWidth - width)),
      y: Math.max(0, Math.min(y, window.innerHeight - height)),
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
        border: "2px solid #231f20",
        borderRadius: 4,
        boxShadow: "2px 3px 0 rgba(0,0,0,0.25)",
        zIndex,
        display: "flex",
        flexDirection: "column",
        minHeight: 300,
        maxHeight: "calc(100vh - 120px)",
      }
    : {
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width,
        height,
        border: "2px solid #231f20",
        borderRadius: 4,
        boxShadow: "4px 6px 0 rgba(0,0,0,0.25)",
        zIndex,
        display: "flex",
        flexDirection: "column",
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
          height: 32,
          background: "#f8f2e9",
          borderBottom: "2px solid #231f20",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          cursor: mobile ? "default" : dragging ? "grabbing" : "grab",
          borderRadius: "2px 2px 0 0",
          flexShrink: 0,
        }}
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
            width: mobile ? 28 : 16,
            height: mobile ? 28 : 16,
            minWidth: mobile ? 44 : undefined,
            minHeight: mobile ? 44 : undefined,
            border: "1px solid #231f20",
            borderRadius: 2,
            background: "#f8f2e9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            fontSize: mobile ? 14 : 11,
            lineHeight: 1,
            color: "#231f20",
            fontWeight: 700,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#d72229";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f8f2e9";
            e.currentTarget.style.color = "#231f20";
          }}
        >
          ✕
        </button>
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: '"Friend", serif',
            fontStyle: "italic",
            fontSize: 13,
            color: "#231f20",
            pointerEvents: "none",
          }}
        >
          {title}
        </span>
        <div style={{ width: mobile ? 28 : 16, flexShrink: 0 }} />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: mobile ? "auto" : "hidden",
          background: "#c4b5a0",
          boxShadow:
            "inset 3px 3px 0 rgba(0,0,0,0.12), inset -3px -3px 0 rgba(255,255,255,0.15)",
          minHeight: mobile ? 260 : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Window;
