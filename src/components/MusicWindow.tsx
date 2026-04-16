import React, { useEffect, useRef, useState, useCallback } from "react";
import { SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { COLORS, BORDER, RADIUS, MOTION, FONT_FAMILY } from "@/lib/tokens";

declare global {
  interface Window {
    SC?: {
      Widget: (iframe: HTMLIFrameElement) => SCWidget;
    };
  }
}

interface SCWidget {
  bind: (event: string, callback: (...args: any[]) => void) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seekTo: (ms: number) => void;
  setVolume: (vol: number) => void;
  getVolume: (cb: (vol: number) => void) => void;
  getCurrentSound: (cb: (sound: { title: string; duration: number; user: { username: string } }) => void) => void;
}

const SC_EVENTS = {
  READY: "ready",
  PLAY: "play",
  PAUSE: "pause",
  PLAY_PROGRESS: "playProgress",
  FINISH: "finish",
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};

const MusicWindow: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<SCWidget | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const volumeDragging = useRef(false);
  const prevVolumeRef = useRef(0.8);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trackTitle, setTrackTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const [playHover, setPlayHover] = useState(false);
  const [pauseHover, setPauseHover] = useState(false);
  const [prevHover, setPrevHover] = useState(false);
  const [nextHover, setNextHover] = useState(false);

  useEffect(() => {
    if (!document.getElementById("sc-widget-api")) {
      const script = document.createElement("script");
      script.id = "sc-widget-api";
      script.src = "https://w.soundcloud.com/player/api.js";
      document.body.appendChild(script);
    }
  }, []);

  const updateTrackInfo = useCallback((widget: SCWidget) => {
    widget.getCurrentSound((sound) => {
      setTrackTitle(sound.title || "");
      setArtist(sound.user?.username || "");
      if (sound.duration) setDuration(sound.duration);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.SC && iframeRef.current) {
        clearInterval(interval);
        const w = window.SC.Widget(iframeRef.current);
        widgetRef.current = w;

        w.bind(SC_EVENTS.READY, () => {
          setReady(true);
          updateTrackInfo(w);
          w.getVolume((vol) => setVolume(vol / 100));
        });
        w.bind(SC_EVENTS.PLAY, () => {
          setPlaying(true);
          updateTrackInfo(w);
        });
        w.bind(SC_EVENTS.PAUSE, () => setPlaying(false));
        w.bind(SC_EVENTS.PLAY_PROGRESS, (e: any) => {
          setProgress(e.relativePosition ?? 0);
          setCurrentTime(e.currentPosition ?? 0);
        });
        w.bind(SC_EVENTS.FINISH, () => w.next());
      }
    }, 200);
    return () => clearInterval(interval);
  }, [updateTrackInfo]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !widgetRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    widgetRef.current.seekTo(pct * duration);
  };

  // Volume drag helpers
  const calcVolumeFromEvent = useCallback((clientX: number) => {
    if (!volumeTrackRef.current) return null;
    const rect = volumeTrackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const applyVolume = useCallback((pct: number) => {
    setVolume(pct);
    widgetRef.current?.setVolume(pct * 100);
  }, []);

  const handleVolumePointerDown = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    volumeDragging.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const pct = calcVolumeFromEvent(clientX);
    if (pct !== null) applyVolume(pct);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!volumeDragging.current) return;
      const cx = "touches" in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const p = calcVolumeFromEvent(cx);
      if (p !== null) applyVolume(p);
    };
    const onUp = () => {
      volumeDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
  }, [calcVolumeFromEvent, applyVolume]);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      applyVolume(0);
    } else {
      applyVolume(prevVolumeRef.current || 0.8);
    }
  }, [volume, applyVolume]);

  const disabledStyle: React.CSSProperties = !ready ? { opacity: 0.5, pointerEvents: "none" } : {};

  const marqueeStyle = (text: string): React.CSSProperties =>
    text.length > 25
      ? { display: "inline-block", whiteSpace: "nowrap", animation: "marquee 8s linear infinite" }
      : { display: "inline-block", whiteSpace: "nowrap" };

  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 10, gap: 10 }}>
      <iframe
        ref={iframeRef}
        src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/racesmusic/sets/races-god-gaming-playlist&auto_play=false"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        allow="autoplay"
      />

      <style>{`
        @keyframes marquee {
          0%, 15% { transform: translateX(0); }
          85%, 100% { transform: translateX(calc(-100% + 280px)); }
        }
      `}</style>

      {/* ROW 1 — Track Info */}
      <div style={{
        background: COLORS.panel,
        border: BORDER.standard,
        borderRadius: RADIUS.md,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        gap: 2,
      }}>
        {ready ? (
          <>
            <div style={{ overflow: "hidden", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>
              <span style={{
                fontFamily: FONT_FAMILY,
                fontSize: "clamp(18px, 3vw, 28px)",
                lineHeight: "35px",
                color: COLORS.ink,
                fontStyle: "normal",
                ...marqueeStyle(trackTitle),
              }}>
                {trackTitle || "—"}
              </span>
            </div>
            <div style={{ overflow: "hidden", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>
              <span style={{
                fontFamily: FONT_FAMILY,
                fontSize: "clamp(13px, 2.2vw, 20px)",
                lineHeight: "24px",
                color: COLORS.ink,
                fontStyle: "italic",
                ...marqueeStyle(artist),
              }}>
                {artist || "—"}
              </span>
            </div>
          </>
        ) : (
          <div style={{
            fontFamily: FONT_FAMILY,
            fontSize: "clamp(16px, 3vw, 28px)",
            lineHeight: "35px",
            color: COLORS.ink,
          }}>Loading...</div>
        )}
      </div>

      {/* ROW 2 — Progress Bar */}
      <div style={{
        background: COLORS.panel,
        border: BORDER.standard,
        borderRadius: RADIUS.md,
        padding: "4px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 32,
        ...disabledStyle,
      }}>
        <span style={{
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: "#000000",
          flexShrink: 0,
        }}>
          {fmt(currentTime)}
        </span>
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          style={{
            flex: 1,
            height: 7,
            background: COLORS.panel,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            overflow: "hidden",
            cursor: "pointer",
          }}
        >
          <div style={{
            width: `${progress * 100}%`,
            height: 14,
            background: COLORS.ink,
            borderRadius: 0,
          }} />
        </div>
      </div>

      {/* ROW 3 — Controls */}
      <div style={{ display: "flex", gap: 4, width: "100%", ...disabledStyle }}>
        <button
          onClick={() => widgetRef.current?.play()}
          onMouseEnter={() => setPlayHover(true)}
          onMouseLeave={() => setPlayHover(false)}
          style={{
            flex: 1,
            height: 54,
            background: playHover ? "#005f94" : COLORS.blue,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: `background ${MOTION.fast}`,
            boxShadow: !playing ? "inset 0 2px 0 rgba(0,0,0,0.2)" : "none",
          }}
        >
          <div style={{
            width: 0, height: 0,
            borderLeft: `16px solid ${COLORS.ink}`,
            borderTop: "10px solid transparent",
            borderBottom: "10px solid transparent",
          }} />
        </button>

        <button
          onClick={() => widgetRef.current?.pause()}
          onMouseEnter={() => setPauseHover(true)}
          onMouseLeave={() => setPauseHover(false)}
          style={{
            flex: 1,
            height: 54,
            background: pauseHover ? "#cf7d1f" : COLORS.orange,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            gap: 6,
            transition: `background ${MOTION.fast}`,
            boxShadow: playing ? "inset 0 2px 0 rgba(0,0,0,0.2)" : "none",
          }}
        >
          <div style={{ width: 7, height: 26, background: COLORS.ink }} />
          <div style={{ width: 7, height: 26, background: COLORS.ink }} />
        </button>

        <button
          onClick={() => widgetRef.current?.prev()}
          onMouseEnter={() => setPrevHover(true)}
          onMouseLeave={() => setPrevHover(false)}
          style={{
            flex: 0.5, height: 54,
            background: prevHover ? "#e8e0d4" : COLORS.surface,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: `background ${MOTION.fast}`,
          }}
        >
          <SkipBack size={22} color={COLORS.ink} />
        </button>

        <button
          onClick={() => widgetRef.current?.next()}
          onMouseEnter={() => setNextHover(true)}
          onMouseLeave={() => setNextHover(false)}
          style={{
            flex: 0.5, height: 54,
            background: nextHover ? "#e8e0d4" : COLORS.surface,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: `background ${MOTION.fast}`,
          }}
        >
          <SkipForward size={22} color={COLORS.ink} />
        </button>
      </div>

      {/* ROW 4 — Volume */}
      <div style={{
        background: COLORS.surface,
        border: BORDER.standard,
        borderRadius: RADIUS.md,
        padding: "4px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 32,
        ...disabledStyle,
      }}>
        <VolumeIcon
          size={16}
          color={COLORS.ink}
          style={{ flexShrink: 0, cursor: "pointer" }}
          onClick={toggleMute}
        />
        {/* Volume track outer — relative, overflow visible for ball */}
        <div
          ref={volumeTrackRef}
          onMouseDown={handleVolumePointerDown}
          onTouchStart={handleVolumePointerDown}
          style={{
            flex: 1,
            height: 14,
            position: "relative",
            display: "flex",
            alignItems: "center",
            cursor: volumeDragging.current ? "grabbing" : "grab",
          }}
        >
          {/* Inner track */}
          <div style={{
            width: "100%",
            height: 7,
            background: COLORS.surface,
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            overflow: "hidden",
            position: "relative",
          }}>
            {/* Fill */}
            <div style={{
              width: `${volume * 100}%`,
              height: "100%",
               background: COLORS.red,
              transition: volumeDragging.current ? "none" : "width 0.1s",
            }} />
          </div>
          {/* Drag handle ball */}
          <div style={{
            position: "absolute",
            width: 14,
            height: 14,
            background: COLORS.red,
            border: BORDER.standard,
            borderLeft: "none",
            borderRadius: "50%",
            top: "50%",
            left: `calc(${volume * 100}% - 7px)`,
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }} />
        </div>
      </div>
    </div>
  );
};

export default MusicWindow;
