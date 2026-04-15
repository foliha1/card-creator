import React, { useState, useCallback, useEffect, useMemo } from "react";
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

const BASE_SIZES: Record<WindowId, { width: number; height: number; title: string }> = {
  game: { width: 960, height: 700, title: "PLAY WHOOP! WHOOP!" },
  howtoplay: { width: 340, height: 580, title: "HOW TO PLAY" },
  preorder: { width: 400, height: 320, title: "PRE-ORDER" },
  about: { width: 400, height: 380, title: "ABOUT" },
};

const ALL_IDS: WindowId[] = ["game", "howtoplay", "preorder", "about"];

const DesktopShell: React.FC = () => {
  const mobile = useIsMobile();
  const noiseUrl = useMemo(() => {
    if (typeof document === "undefined") return "";
    const canvas = document.createElement("canvas");
    const w = 200, h = 200;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.random() < 0.6) {
        d[i] = 35; d[i+1] = 31; d[i+2] = 32;
        d[i+3] = Math.floor(Math.random() * 50 + 10);
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  }, []);
  const [booted, setBooted] = useState(false);
  const [openWindows, setOpenWindows] = useState<Set<WindowId>>(new Set());
  const [windowOrder, setWindowOrder] = useState<WindowId[]>([]);
  const [viewW, setViewW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [viewH, setViewH] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  useEffect(() => {
    const onResize = () => { setViewW(window.innerWidth); setViewH(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const getWindowSize = useCallback((id: WindowId) => {
    const base = BASE_SIZES[id];
    return {
      ...base,
      width: Math.min(base.width, viewW - 40),
      height: Math.min(base.height, viewH - 120),
    };
  }, [viewW, viewH]);

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

    const cfg = getWindowSize(id);
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

      {/* Noise overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: noiseUrl ? `url(${noiseUrl})` : undefined,
          backgroundRepeat: "repeat",
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
