import React, { useState, useCallback, useEffect, Suspense } from "react";
import Window from "@/components/Window";
import Taskbar from "@/components/Taskbar";
import GameWindow from "@/components/GameWindow";


const HowToPlayWindow = React.lazy(() => import("@/components/HowToPlayWindow"));
const PreOrderWindow = React.lazy(() => import("@/components/PreOrderWindow"));
const AboutWindow = React.lazy(() => import("@/components/AboutWindow"));
const MusicWindow = React.lazy(() => import("@/components/MusicWindow"));
const ThemeWindow = React.lazy(() => import("@/components/ThemeWindow"));
import BootScreen from "@/components/BootScreen";
import { useIsMobile } from "@/hooks/use-mobile";
import { COLORS, MOTION, SPACE, TYPE } from "@/lib/tokens";
import { useTheme } from "@/lib/theme-context";

type WindowId = "game" | "howtoplay" | "preorder" | "about" | "music" | "theme";

const DEFAULT_POSITIONS: Record<WindowId, { x: number; y: number }> = {
  game: { x: 40, y: 20 },
  howtoplay: { x: 520, y: 80 },
  preorder: { x: 180, y: 60 },
  about: { x: 280, y: 100 },
  music: { x: 600, y: 500 },
  theme: { x: 400, y: 200 },
};

const BASE_SIZES: Record<WindowId, { width: number; height: number; title: string }> = {
  game: { width: 960, height: 700, title: "PLAY WHOOP! WHOOP!" },
  howtoplay: { width: 340, height: 580, title: "HOW TO PLAY" },
  preorder: { width: 400, height: 320, title: "PRE-ORDER" },
  about: { width: 400, height: 380, title: "ABOUT" },
  music: { width: 396, height: 340, title: "NOW PLAYING" },
  theme: { width: 380, height: 150, title: "APPEARANCE" },
};

const ALL_IDS: WindowId[] = ["game", "howtoplay", "preorder", "about", "music", "theme"];

const DesktopShell: React.FC = () => {
  const mobile = useIsMobile();
  const { bgTheme, logoColor } = useTheme();
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

  const WindowLoader = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.ink, fontFamily: '"Friend", sans-serif', fontSize: TYPE.body }}>
      Loading…
    </div>
  );

  const renderWindowContent = (id: WindowId) => {
    switch (id) {
      case "game": return <GameWindow mobile={mobile} />;
      case "howtoplay": return <Suspense fallback={<WindowLoader />}><HowToPlayWindow onClose={() => closeWindow("howtoplay")} /></Suspense>;
      case "preorder": return <Suspense fallback={<WindowLoader />}><PreOrderWindow /></Suspense>;
      case "about": return <Suspense fallback={<WindowLoader />}><AboutWindow /></Suspense>;
      case "music": return <Suspense fallback={<WindowLoader />}><MusicWindow /></Suspense>;
      case "theme": return <Suspense fallback={<WindowLoader />}><ThemeWindow /></Suspense>;
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
      role="main"
      aria-label="WHOOP! WHOOP! desktop"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: mobile ? "auto" : "hidden",
        position: "relative",
        background: bgTheme === "wild" ? COLORS.ink : bgTheme,
        transition: `background ${MOTION.slow}`,
        paddingBottom: mobile ? 100 : SPACE[0],
        paddingTop: mobile ? SPACE[8] : SPACE[0],
      }}
    >

      {/* Wallpaper overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/Whoop_Whoop_Wild.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: bgTheme === "wild" ? 1 : 0,
          transition: `opacity ${MOTION.slow}`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Noise overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: "url(/noise.png)",
          backgroundRepeat: "repeat",
          zIndex: 1,
        }}
      />

      {/* Logo watermark using CSS mask */}
      {!mobile && bgTheme === COLORS.surface && (
        <img
          src="/WhoopWhoop_Dark_Logo.svg"
          alt=""
          style={{
            position: "absolute",
            width: "55vw",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -55%)",
            pointerEvents: "none",
            zIndex: 2,
            opacity: 0.4,
            transition: `opacity ${MOTION.slow}`,
          }}
        />
      )}
      {!mobile && bgTheme !== COLORS.surface && (
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
            background: logoColor,
            transition: `background ${MOTION.slow}`,
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
