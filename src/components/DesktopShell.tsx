import React, { useState, useCallback, useEffect } from "react";
import Window from "@/components/Window";
import Taskbar from "@/components/Taskbar";
import GameWindow from "@/components/GameWindow";
import HowToPlayWindow from "@/components/HowToPlayWindow";
import PreOrderWindow from "@/components/PreOrderWindow";
import AboutWindow from "@/components/AboutWindow";

type WindowId = "game" | "howtoplay" | "preorder" | "about";

const DEFAULT_POSITIONS: Record<WindowId, { x: number; y: number }> = {
  game: { x: 60, y: 30 },
  howtoplay: { x: 520, y: 80 },
  preorder: { x: 180, y: 60 },
  about: { x: 280, y: 100 },
};

const WINDOW_CONFIGS: Record<WindowId, { width: number; height: number; title: string }> = {
  game: { width: 700, height: 540, title: "PLAY WHOOP! WHOOP!" },
  howtoplay: { width: 340, height: 420, title: "HOW TO PLAY" },
  preorder: { width: 400, height: 320, title: "PRE-ORDER" },
  about: { width: 400, height: 380, title: "ABOUT" },
};

const DesktopShell: React.FC = () => {
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

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        background: "#2568B0",
      }}
    >
      <style>{`
        @keyframes win-open {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Watermark */}
      <img
        src="/WhoopWhoop_Stacked_Logo.svg"
        alt=""
        style={{
          position: "absolute",
          width: "55vw",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -55%)",
          opacity: 0.1,
          pointerEvents: "none",
        }}
      />

      {/* Windows */}
      {openWindows.has("game") && (
        <div style={{ animation: "win-open 0.2s ease-out" }}>
          <Window id="game" title={WINDOW_CONFIGS.game.title} defaultPosition={DEFAULT_POSITIONS.game} width={WINDOW_CONFIGS.game.width} height={WINDOW_CONFIGS.game.height} zIndex={10 + windowOrder.indexOf("game")} onClose={() => closeWindow("game")} onFocus={focusWindow}>
            <GameWindow />
          </Window>
        </div>
      )}
      {openWindows.has("howtoplay") && (
        <div style={{ animation: "win-open 0.2s ease-out" }}>
          <Window id="howtoplay" title={WINDOW_CONFIGS.howtoplay.title} defaultPosition={DEFAULT_POSITIONS.howtoplay} width={WINDOW_CONFIGS.howtoplay.width} height={WINDOW_CONFIGS.howtoplay.height} zIndex={10 + windowOrder.indexOf("howtoplay")} onClose={() => closeWindow("howtoplay")} onFocus={focusWindow}>
            <HowToPlayWindow onClose={() => closeWindow("howtoplay")} />
          </Window>
        </div>
      )}
      {openWindows.has("preorder") && (
        <div style={{ animation: "win-open 0.2s ease-out" }}>
          <Window id="preorder" title={WINDOW_CONFIGS.preorder.title} defaultPosition={DEFAULT_POSITIONS.preorder} width={WINDOW_CONFIGS.preorder.width} height={WINDOW_CONFIGS.preorder.height} zIndex={10 + windowOrder.indexOf("preorder")} onClose={() => closeWindow("preorder")} onFocus={focusWindow}>
            <PreOrderWindow />
          </Window>
        </div>
      )}
      {openWindows.has("about") && (
        <div style={{ animation: "win-open 0.2s ease-out" }}>
          <Window id="about" title={WINDOW_CONFIGS.about.title} defaultPosition={DEFAULT_POSITIONS.about} width={WINDOW_CONFIGS.about.width} height={WINDOW_CONFIGS.about.height} zIndex={10 + windowOrder.indexOf("about")} onClose={() => closeWindow("about")} onFocus={focusWindow}>
            <AboutWindow />
          </Window>
        </div>
      )}

      <Taskbar openWindows={openWindows} onOpen={openWindow} onFocus={focusWindow} />
    </div>
  );
};

export default DesktopShell;
