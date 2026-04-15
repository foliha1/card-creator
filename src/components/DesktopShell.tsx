import React, { useState, useCallback, useEffect } from "react";
import Window from "@/components/Window";
import Taskbar from "@/components/Taskbar";
import GameWindow from "@/components/GameWindow";
import HowToPlayWindow from "@/components/HowToPlayWindow";
import PreOrderWindow from "@/components/PreOrderWindow";
import AboutWindow from "@/components/AboutWindow";
import BootScreen from "@/components/BootScreen";
import { useIsMobile } from "@/hooks/use-mobile";

type WindowId = "game" | "howtoplay" | "preorder" | "about";

const DEFAULT_POSITIONS: Record<WindowId, { x: number; y: number }> = {
  game: { x: 40, y: 20 },
  howtoplay: { x: 520, y: 80 },
  preorder: { x: 180, y: 60 },
  about: { x: 280, y: 100 },
};

const WINDOW_CONFIGS: Record<WindowId, { width: number; height: number; title: string }> = {
  game: { width: 820, height: 620, title: "PLAY WHOOP! WHOOP!" },
  howtoplay: { width: 340, height: 420, title: "HOW TO PLAY" },
  preorder: { width: 400, height: 320, title: "PRE-ORDER" },
  about: { width: 400, height: 380, title: "ABOUT" },
};

const ALL_IDS: WindowId[] = ["game", "howtoplay", "preorder", "about"];

const DesktopShell: React.FC = () => {
  const mobile = useIsMobile();
  const [booted, setBooted] = useState(false);
  const [openWindows, setOpenWindows] = useState<Set<WindowId>>(new Set());
  const [windowOrder, setWindowOrder] = useState<WindowId[]>([]);

  const openWindow = useCallback((id: WindowId) => {
    setOpenWindows((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setWindowOrder((prev) => (prev.includes(id) ? [...prev.filter((w) => w !== id), id] : [...prev, id]));
  }, []);

  const closeWindow = useCallback((id: WindowId) => {
    setOpenWindows((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindowOrder((prev) => {
      const wid = id as WindowId;
      if (!prev.includes(wid)) return prev;
      return [...prev.filter((w) => w !== wid), wid];
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => openWindow("game"), 300);
    return () => clearTimeout(t);
  }, [openWindow]);

  // On mobile, the active (visible) window is the last in windowOrder that's open
  const activeWindow = mobile
    ? [...windowOrder].reverse().find((id) => openWindows.has(id))
    : undefined;

  const renderWindowContent = (id: WindowId) => {
    switch (id) {
      case "game": return <GameWindow mobile={mobile} />;
      case "howtoplay": return <HowToPlayWindow onClose={() => closeWindow("howtoplay")} />;
      case "preorder": return <PreOrderWindow />;
      case "about": return <AboutWindow />;
    }
  };

  const isFocused = (id: WindowId) => {
    if (mobile) return activeWindow === id;
    return windowOrder[windowOrder.length - 1] === id;
  };

  const renderWindow = (id: WindowId) => {
    if (!openWindows.has(id)) return null;
    if (mobile && activeWindow !== id) return null;

    const cfg = WINDOW_CONFIGS[id];
    return (
      <div key={id} style={{ animation: "win-open 0.2s ease-out" }}>
        <Window
          id={id}
          title={cfg.title}
          defaultPosition={DEFAULT_POSITIONS[id]}
          width={cfg.width}
          height={cfg.height}
          zIndex={10 + windowOrder.indexOf(id)}
          onClose={() => closeWindow(id)}
          onFocus={focusWindow}
          mobile={mobile}
          focused={isFocused(id)}
        >
          {renderWindowContent(id)}
        </Window>
      </div>
    );
  };

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: mobile ? "auto" : "hidden",
        position: "relative",
        background: "#0072B2",
        paddingBottom: mobile ? 60 : 0,
        paddingTop: mobile ? 16 : 0,
      }}
    >
      <style>{`
        @keyframes win-open {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Inline SVG noise filter */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={4} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      {/* Noise overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          filter: "url(#noise)",
          opacity: 0.12,
          zIndex: 1,
        }}
      />

      {/* Logo watermark using CSS mask */}
      {!mobile && (
        <div
          style={{
            position: "absolute",
            width: "55vw",
            aspectRatio: "1 / 1",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -55%)",
            pointerEvents: "none",
            zIndex: 2,
            background: "#01527F",
            WebkitMaskImage: "url(/WhoopWhoop_Stacked_Logo.svg)",
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskImage: "url(/WhoopWhoop_Stacked_Logo.svg)",
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            opacity: 0.7,
          } as React.CSSProperties}
        />
      )}

      {ALL_IDS.map(renderWindow)}

      <Taskbar
        openWindows={openWindows}
        onOpen={openWindow}
        onFocus={focusWindow}
        activeWindow={activeWindow}
        mobile={mobile}
      />
    </div>
  );
};

export default DesktopShell;
