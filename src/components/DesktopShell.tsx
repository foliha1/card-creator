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

const WINDOW_SIZES: Record<WindowId, { width: number; height: number }> = {
  game: { width: 420, height: 620 },
  howtoplay: { width: 400, height: 500 },
  preorder: { width: 380, height: 480 },
  about: { width: 360, height: 400 },
};

const WINDOW_TITLES: Record<WindowId, string> = {
  game: "Whoop! Whoop!",
  howtoplay: "How to Play",
  preorder: "Pre-Order",
  about: "About",
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
      {(Array.from(openWindows) as WindowId[]).map((id) => (
        <Window
          key={id}
          id={id}
          title={WINDOW_TITLES[id]}
          defaultPosition={DEFAULT_POSITIONS[id]}
          width={WINDOW_SIZES[id].width}
          height={WINDOW_SIZES[id].height}
          zIndex={10 + windowOrder.indexOf(id)}
          onClose={() => closeWindow(id)}
          onFocus={focusWindow}
        >
          {id === "game" ? (
            <GameWindow />
          ) : id === "howtoplay" ? (
            <HowToPlayWindow onClose={() => closeWindow("howtoplay")} />
          ) : id === "preorder" ? (
            <PreOrderWindow />
          ) : id === "about" ? (
            <AboutWindow />
          ) : null}
        </Window>
      ))}

      <Taskbar openWindows={openWindows} onOpen={openWindow} onFocus={focusWindow} />
    </div>
  );
};

export default DesktopShell;
