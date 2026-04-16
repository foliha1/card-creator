import React, { useEffect, useRef, useState, useCallback } from "react";
import { SkipBack, SkipForward, Play, Pause } from "lucide-react";

declare global {
  interface Window {
    SC?: {
      Widget: (iframe: HTMLIFrameElement) => SCWidget;
    };
  }
}

interface SCWidget {
  bind: (event: string, callback: (...args: any[]) => void) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seekTo: (ms: number) => void;
  getCurrentSound: (cb: (sound: { title: string; duration: number; user: { username: string } }) => void) => void;
  getDuration: (cb: (d: number) => void) => void;
}

const SC_EVENTS = {
  READY: "ready",
  PLAY: "play",
  PAUSE: "pause",
  PLAY_PROGRESS: "playProgress",
  FINISH: "finish",
};

const MusicWindow: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<SCWidget | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trackTitle, setTrackTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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
        });
        w.bind(SC_EVENTS.PLAY, () => {
          setPlaying(true);
          updateTrackInfo(w);
        });
        w.bind(SC_EVENTS.PAUSE, () => setPlaying(false));
        w.bind(SC_EVENTS.PLAY_PROGRESS, (e: any) => {
          setProgress(e.relativePosition ?? 0);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 16, gap: 12, height: "100%" }}>
      <iframe
        ref={iframeRef}
        src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/racesmusic/sets/races-god-gaming-playlist&auto_play=false"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        allow="autoplay"
      />

      {!ready ? (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: '"Friend", sans-serif',
          fontStyle: "italic",
          fontSize: 14,
          color: "#231f20",
          opacity: 0.5,
        }}>
          Loading...
        </div>
      ) : (
        <>
          <div style={{ minWidth: 0, maxWidth: "100%" }}>
            <div style={{
              fontFamily: '"Friend", sans-serif',
              fontStyle: "normal",
              fontSize: 10,
              color: "#231f20",
              opacity: 0.5,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 4,
            }}>
              Now Playing
            </div>
            <div style={{
              fontFamily: '"Friend", sans-serif',
              fontStyle: "italic",
              fontSize: 16,
              color: "#231f20",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}>
              {trackTitle || "—"}
            </div>
            <div style={{
              fontFamily: '"Friend", sans-serif',
              fontStyle: "normal",
              fontSize: 12,
              color: "#231f20",
              opacity: 0.6,
              marginTop: 2,
            }}>
              {artist || "—"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <button
              onClick={() => widgetRef.current?.prev()}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#231f20", display: "flex", opacity: 0.7, transition: "opacity 0.15s" }}
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={() => widgetRef.current?.toggle()}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#3a3637"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#231f20"; }}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#231f20",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
              }}
            >
              {playing ? <Pause size={18} color="#f8f2e9" /> : <Play size={18} color="#f8f2e9" style={{ marginLeft: 2 }} />}
            </button>
            <button
              onClick={() => widgetRef.current?.next()}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#231f20", display: "flex", opacity: 0.7, transition: "opacity 0.15s" }}
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div
            ref={progressBarRef}
            onClick={handleSeek}
            style={{ width: "100%", height: 4, background: "#ADA290", borderRadius: 2, cursor: "pointer", marginTop: "auto" }}
          >
            <div style={{ width: `${progress * 100}%`, height: "100%", background: "#d72229", borderRadius: 2, transition: "width 0.2s" }} />
          </div>
        </>
      )}
    </div>
  );
};

export default MusicWindow;
