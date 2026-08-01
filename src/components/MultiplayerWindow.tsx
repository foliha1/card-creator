import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { COLORS, SPACE, BORDER, RADIUS, textStyle, TEXT, FONT_FAMILY } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { getVisitorId, getDisplayName, setDisplayName } from "@/lib/visitor";
import { trackEvent } from "@/lib/analytics";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import { useMultiplayerHost, useMultiplayerJoiner, useTransientEvents, type SeatMapEntry } from "@/hooks/useMultiplayerGame";
import { useHeartbeatSender, useHeartbeatMonitor } from "@/hooks/useHeartbeat";
import SiteHeader, { SITE_HEADER_OFFSET } from "@/components/SiteHeader";
import MultiplayerGameView from "@/components/MultiplayerGameView";
import { useSoloGame } from "@/hooks/useSoloGame";
import GridSizeOption, { GRID_OPTIONS, type GridSizeKey } from "@/components/GridSizeOption";

const SoloView: React.FC<{ onLeave: () => void; mobile: boolean; gridSize: GridSizeKey }> = ({ onLeave, mobile, gridSize }) => {
  const solo = useSoloGame(gridSize);
  return (
    <MultiplayerGameView
      publicState={solo.publicState}
      mySeat={solo.mySeat}
      events={solo.events}
      rollCommit={solo.rollCommit}
      onIntent={solo.onIntent}
      onLeave={onLeave}
      mobile={mobile}
      roomId={solo.roomId}
      visitorId={solo.visitorId}
      isHost={true}
      soloMode={true}
    />
  );
};

import { toPublicState } from "@/lib/publicState";
import {
  createRoom,
  findRoomByCode,
  isValidRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RoomRow,
} from "@/lib/rooms";

import { unlockAudio } from "@/lib/sounds";


interface MultiplayerWindowProps {
  initialRoomCode?: string;
  introStatus?: "running" | "skipped" | "complete" | "timeout" | "none";
}

const ROOM_CAPACITY = 6;

type PendingAction =
  | { kind: "create" }
  | { kind: "join-code"; code: string }
  | { kind: "join-link"; code: string };

type View =
  | { kind: "idle"; error?: string }
  | { kind: "solo"; gridSize: GridSizeKey }
  | { kind: "solo-setup" }
  | { kind: "name-prompt"; pending: PendingAction; error?: string }
  | { kind: "host"; room: RoomRow }
  | { kind: "joiner"; room: RoomRow }
  | { kind: "full"; code: string }
  | { kind: "host-left" };

const sanitizeCodeInput = (raw: string): string => {
  const upper = raw.toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (ROOM_CODE_ALPHABET.includes(ch)) out += ch;
    if (out.length >= ROOM_CODE_LENGTH) break;
  }
  return out;
};

const MultiplayerWindow: React.FC<MultiplayerWindowProps> = ({ initialRoomCode, introStatus = "none" }) => {
  const mobile = useIsMobile();
  const [view, setView] = useState<View>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState<string>(() => getDisplayName());
  // Game-started state — seat freeze lives here on the HOST. Joiners learn
  // seats from the wire via PublicState.seatMap.
  const [frozenSeats, setFrozenSeats] = useState<SeatMapEntry[] | null>(null);
  // Host-minted game id. Scopes the arbiter's UNIQUE (room, game, window)
  // constraint so consecutive games in the same room don't collide.
  const [gameId, setGameId] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);
  const [codeFlash, setCodeFlash] = useState(false);
  const [lobbyGrid, setLobbyGrid] = useState<"3x2" | "3x3">("3x2");
  const [soloGrid, setSoloGrid] = useState<GridSizeKey>("3x2");
  const shareFlashTimerRef = useRef<number | null>(null);
  const codeFlashTimerRef = useRef<number | null>(null);



  const visitorId = useMemo(() => getVisitorId(), []);
  const activeRoom = view.kind === "host" || view.kind === "joiner" ? view.room : null;
  const isHostView = view.kind === "host";
  const displayName = getDisplayName();
  const { participants, status: presenceStatus, channel, onBroadcast } = useRoomPresence(
    activeRoom ? activeRoom.id : null,
    visitorId,
    displayName,
    isHostView,
  );


  const hostVisitorId = useMemo(() => {
    if (isHostView) return visitorId;
    const hostP = participants.find((p) => p.is_host);
    return hostP?.visitor_id ?? null;
  }, [isHostView, visitorId, participants]);

  // Heartbeat: EVERY client (host + joiner) sends. The host also monitors
  // inbound heartbeats to detect crashed/slept peers that presence never
  // reports as gone. Merged into disconnectedSeats below via UNION with the
  // presence-derived set — either signal is sufficient.
  useHeartbeatSender(channel, visitorId, !!activeRoom);
  const watchedVisitorIds = useMemo(
    () => (frozenSeats ? frozenSeats.map((e) => e.visitor_id) : []),
    [frozenSeats],
  );
  const {
    staleVisitors: heartbeatStaleVisitors,
    awayVisitors: heartbeatAwayVisitors,
    awaySkipVisitors: heartbeatAwaySkipVisitors,
    endGameVisitors: heartbeatEndGameVisitors,
    lastSeenSpreadMs,
  } = useHeartbeatMonitor({
    channel,
    onBroadcast,
    enabled: isHostView && frozenSeats !== null,
    watchedVisitorIds,
    hostVisitorId: visitorId,
  });

  // Compute disconnected seats: union of
  //   (a) seats whose visitor_id is no longer in the presence roster, and
  //   (b) seats whose heartbeat has gone stale past its applicable threshold,
  //       and
  //   (c) seats that have been reporting hidden for longer than the AWAY
  //       skip dwell (AWAY_SKIP_MS). The AWAY chip appears immediately on
  //       the first hidden heartbeat (see awaySeats below), but the reducer
  //       only sees a seat as skippable AFTER the dwell — this keeps a
  //       momentary tab switch from silently forfeiting a turn while still
  //       skipping a genuinely backgrounded player on the same 15s budget
  //       as a silent seat.
  // All three signals feed SET_DISCONNECTED, which uses REPLACE semantics —
  // resuming heartbeats or presence rejoin automatically un-marks a seat.
  // The stricter end-game set below is unchanged and still excludes AWAY.
  const disconnectedSeats = useMemo(() => {
    if (!frozenSeats) return [] as number[];
    const present = new Set(participants.map((p) => p.visitor_id));
    const stale = new Set(heartbeatStaleVisitors);
    const awaySkip = new Set(heartbeatAwaySkipVisitors);
    return frozenSeats
      .filter((e) => !present.has(e.visitor_id) || stale.has(e.visitor_id) || awaySkip.has(e.visitor_id))
      .map((e) => e.seat);
  }, [frozenSeats, participants, heartbeatStaleVisitors, heartbeatAwaySkipVisitors]);

  const awaySeats = useMemo(() => {
    if (!frozenSeats) return [] as number[];
    const away = new Set(heartbeatAwayVisitors);
    return frozenSeats
      .filter((e) => away.has(e.visitor_id))
      .map((e) => e.seat);
  }, [frozenSeats, heartbeatAwayVisitors]);

  // Diagnostic-only seat-number mirrors of the visitor-id sets the heartbeat
  // hook returns. Passed to the debug overlay so testers can see the
  // breakdown between presence-only absence, stale heartbeat, and away-skip
  // dwell before comparing with reducer.disconnected.
  const heartbeatStaleSeats = useMemo(() => {
    if (!frozenSeats) return [] as number[];
    const stale = new Set(heartbeatStaleVisitors);
    return frozenSeats.filter((e) => stale.has(e.visitor_id)).map((e) => e.seat);
  }, [frozenSeats, heartbeatStaleVisitors]);

  const awaySkipSeats = useMemo(() => {
    if (!frozenSeats) return [] as number[];
    const away = new Set(heartbeatAwaySkipVisitors);
    return frozenSeats.filter((e) => away.has(e.visitor_id)).map((e) => e.seat);
  }, [frozenSeats, heartbeatAwaySkipVisitors]);


  // Stricter set for the IRREVERSIBLE end-game guard. A seat is in here only
  // when we've heard NOTHING (visible or hidden) from it for the long window.
  // Presence-absent alone is NOT sufficient — presence has been observed to
  // hold ghost keys for over a minute, so relying on it to trigger a game
  // end would reproduce the very false-positive this fix exists to prevent.
  const endGameDisconnectedSeats = useMemo(() => {
    if (!frozenSeats) return [] as number[];
    const dead = new Set(heartbeatEndGameVisitors);
    return frozenSeats.filter((e) => dead.has(e.visitor_id)).map((e) => e.seat);
  }, [frozenSeats, heartbeatEndGameVisitors]);

  // Host: game controller.
  const gameEnabled = isHostView && frozenSeats !== null;
  const host = useMultiplayerHost({
    channel,
    onBroadcast,
    seatMap: frozenSeats ?? [],
    hostVisitorId: visitorId,
    enabled: gameEnabled,
    gameId,
    roomId: activeRoom?.id ?? "",
    disconnectedSeats,
    awaySeats,
    endGameDisconnectedSeats,
    presenceStatus,
    lastSeenSpreadMs,
  });
  const hostEvents = useTransientEvents(channel, onBroadcast, gameEnabled);

  // Track claimWindow on the host in parallel to what useMultiplayerHost
  // broadcasts, so the local toPublicState render matches the wire payload.
  const hiddenNameInputRef = useRef<HTMLInputElement | null>(null);
  const hostClaimWindowRef = useRef(0);
  const hostPrevClaimByRef = useRef<number | null>(null);
  const hostPrevRoundRef = useRef<number>(host.state.roundNum);
  const hostPrevGameIdRef = useRef<string>(gameId);
  if (hostPrevGameIdRef.current !== gameId) {
    hostPrevGameIdRef.current = gameId;
    hostClaimWindowRef.current = 0;
    hostPrevRoundRef.current = host.state.roundNum;
    hostPrevClaimByRef.current = null;
  }
  if (host.state.roundNum !== hostPrevRoundRef.current) {
    hostPrevRoundRef.current = host.state.roundNum;
    hostClaimWindowRef.current += 1;
  }
  if (hostPrevClaimByRef.current !== null && host.state.claimBy === null) {
    hostClaimWindowRef.current += 1;
  }
  hostPrevClaimByRef.current = host.state.claimBy;

  // Joiner: pure receiver.
  const joinerEnabled = view.kind === "joiner" && !!channel;
  const joiner = useMultiplayerJoiner({
    channel,
    onBroadcast,
    mySeat: null, // resolved from seatMap after first state msg
    visitorId,
    enabled: joinerEnabled,
  });

  const joinerPublicState = joiner.publicState;
  const joinerSeat = useMemo(() => {
    if (!joinerPublicState) return null;
    const me = joinerPublicState.seatMap.find((e) => e.visitor_id === visitorId);
    return me?.seat ?? null;
  }, [joinerPublicState, visitorId]);

  // Watch for host departure once a game is in progress.
  useEffect(() => {
    if (view.kind !== "joiner") return;
    if (!joinerPublicState) return; // game hasn't started
    if (!hostVisitorId) {
      setView({ kind: "host-left" });
      return;
    }
    const hostStillHere = participants.some((p) => p.visitor_id === hostVisitorId);
    if (!hostStillHere) {
      setView({ kind: "host-left" });
    }
  }, [view.kind, joinerPublicState, participants, hostVisitorId]);

  // Fire game_completed once when host reaches GAME_OVER normally (not on
  // host departure).
  const completedFiredRef = useRef(false);
  useEffect(() => {
    if (!gameEnabled) return;
    if (host.state.phase !== "GAME_OVER") return;
    if (completedFiredRef.current) return;
    completedFiredRef.current = true;
    const top = Math.max(...host.state.scores);
    const winners = host.state.scores
      .map((v, i) => (v === top ? i : -1))
      .filter((i) => i !== -1);
    trackEvent("game_completed", {
      roomCode: activeRoom?.room_code,
      metadata: {
        round_count: host.state.roundNum,
        winner_seat: winners.length === 1 ? winners[0] : null,
      },
    });
  }, [gameEnabled, host.state.phase, host.state.scores, host.state.roundNum, activeRoom]);

  useEffect(() => {
    if (!initialRoomCode) return;
    const normalized = initialRoomCode.toUpperCase();
    setView({ kind: "name-prompt", pending: { kind: "join-link", code: normalized } });
  }, [initialRoomCode]);

  const enterRoom = useCallback(
    async (action: PendingAction) => {
      setBusy(true);
      try {
        if (action.kind === "create") {
          const room = await createRoom(visitorId);
          trackEvent("room_created", { roomCode: room.room_code });
          setView({ kind: "host", room });
          return;
        }
        const code = action.code;
        const room = await findRoomByCode(code, visitorId);
        if (!room) {
          setView({
            kind: "idle",
            error:
              action.kind === "join-link"
                ? `Table "${code}" doesn't exist or has ended.`
                : `Table "${code}" doesn't exist.`,
          });
          if (action.kind === "join-link") {
            trackEvent("invite_link_clicked", { roomCode: code, metadata: { room_found: false } });
          }
          return;
        }
        if (action.kind === "join-link") {
          trackEvent("invite_link_clicked", { roomCode: code, metadata: { room_found: true } });
        }
        if (room.is_host) {
          setView({ kind: "host", room });
        } else {
          setView({ kind: "joiner", room });
          trackEvent("room_joined", {
            roomCode: room.room_code,
            metadata: { via: action.kind === "join-link" ? "link" : "code" },
          });
        }
      } catch (e) {
        console.error("[multiplayer] enterRoom failed", e);
        if (action.kind === "join-link") {
          trackEvent("invite_link_clicked", { roomCode: action.code, metadata: { room_found: false, error: true } });
        }
        setView({ kind: "idle", error: "Couldn't reach the table. Check your connection and try again." });
      } finally {
        setBusy(false);
      }
    },
    [visitorId],
  );

  const handleStartRoom = useCallback(() => {
    if (busy) return;
    setNameInput(getDisplayName());
    setView({ kind: "name-prompt", pending: { kind: "create" } });
  }, [busy]);

  const handlePlaySolo = useCallback(() => {
    if (busy) return;
    unlockAudio();
    setView({ kind: "solo-setup" });
  }, [busy]);


  const handleJoinByCode = useCallback(() => {
    if (busy) return;
    const normalized = codeInput.toUpperCase();
    if (!isValidRoomCode(normalized)) {
      setView({ kind: "idle", error: "That doesn't look like a valid code." });
      return;
    }
    setNameInput(getDisplayName());
    setView({ kind: "name-prompt", pending: { kind: "join-code", code: normalized } });
  }, [busy, codeInput]);

  const handleConfirmName = useCallback(() => {
    if (view.kind !== "name-prompt" || busy) return;
    unlockAudio();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setView({ ...view, error: "Enter a name so others can see who you are." });
      return;
    }
    const stored = setDisplayName(trimmed);
    setNameInput(stored);
    void enterRoom(view.pending);
  }, [view, nameInput, busy, enterRoom]);

  // Capacity guard — fixed to `>=` per spec so the "full" state matches
  // rather than admitting a 7th before flipping. (See: prompt 8.1.)
  useEffect(() => {
    if (!activeRoom) return;
    if (view.kind !== "joiner") return;
    if (participants.length >= ROOM_CAPACITY + 1) {
      setView({ kind: "full", code: activeRoom.room_code });
    }
  }, [participants.length, activeRoom, view]);

  const handleStartGame = useCallback(() => {
    if (!isHostView || participants.length < 2 || starting) return;
    unlockAudio();
    const seatMap: SeatMapEntry[] = participants.slice(0, ROOM_CAPACITY).map((p, i) => ({
      seat: i,
      visitor_id: p.visitor_id,
      display_name: p.display_name,
    }));
    setStarting(true);
    // Notify joiners so they can show a loading state immediately.
    try {
      channel?.send({ type: "broadcast", event: "msg", payload: { kind: "game_starting" } });
    } catch {
      /* non-fatal */
    }
    setGameId(crypto.randomUUID());
    setFrozenSeats(seatMap);
    completedFiredRef.current = false;
    trackEvent("game_started", {
      roomCode: activeRoom?.room_code,
      metadata: { player_count: seatMap.length },
    });
  }, [isHostView, participants, activeRoom, starting, channel]);

  // Joiner: listen for host's game_starting notice + lobby grid selection.
  useEffect(() => {
    if (view.kind !== "joiner") return;
    const unsub = onBroadcast(({ payload }) => {
      if (!payload || typeof payload !== "object") return;
      const kind = (payload as { kind?: string }).kind;
      if (kind === "game_starting") {
        setStarting(true);
      } else if (kind === "lobby_grid") {
        const size = (payload as { size?: string }).size;
        if (size === "3x2" || size === "3x3") setLobbyGrid(size);
      }
    });
    return unsub;
  }, [view.kind, onBroadcast]);

  // Host: broadcast the current lobby grid selection whenever it changes,
  // and once when a joiner arrives (roster growth) so late joiners sync.
  useEffect(() => {
    if (view.kind !== "host" || !channel) return;
    try {
      channel.send({ type: "broadcast", event: "msg", payload: { kind: "lobby_grid", size: lobbyGrid } });
    } catch {
      /* non-fatal */
    }
  }, [view.kind, channel, lobbyGrid, participants.length]);

  const shareUrl = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : `/play/${code}`;

  const flashShare = useCallback(() => {
    setShareFlash(true);
    if (shareFlashTimerRef.current) window.clearTimeout(shareFlashTimerRef.current);
    shareFlashTimerRef.current = window.setTimeout(() => setShareFlash(false), 1200);
  }, []);

  const flashCode = useCallback(() => {
    setCodeFlash(true);
    if (codeFlashTimerRef.current) window.clearTimeout(codeFlashTimerRef.current);
    codeFlashTimerRef.current = window.setTimeout(() => setCodeFlash(false), 1200);
  }, []);

  const copyText = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      throw new Error("no clipboard");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const handleShare = useCallback(async (code: string) => {
    const url = shareUrl(code);
    const shareData = {
      title: "Whoop Whoop",
      text: `Join my Whoop Whoop table — code ${code}`,
      url,
    };
    // Feature-detect Web Share API.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled: don't fall back or toast.
        const name = (err as { name?: string })?.name;
        if (name === "AbortError") return;
        // Other error (e.g. share failed) — fall through to clipboard.
      }
    }
    const ok = await copyText(url);
    if (ok) {
      toast.success("Link copied");
      flashShare();
    } else {
      toast.error("Share failed — select the link manually.");
    }
  }, [copyText, flashShare]);

  const handleCopyCode = useCallback(async (code: string) => {
    const ok = await copyText(code);
    if (ok) {
      flashCode();
    } else {
      toast.error("Copy failed");
    }
  }, [copyText, flashCode]);

  useEffect(() => () => {
    if (shareFlashTimerRef.current) window.clearTimeout(shareFlashTimerRef.current);
    if (codeFlashTimerRef.current) window.clearTimeout(codeFlashTimerRef.current);
  }, []);

  const leaveToIdle = useCallback(() => {
    setCodeInput("");
    setFrozenSeats(null);
    setGameId("");
    setStarting(false);
    setShowLeaveConfirm(false);
    setView({ kind: "idle" });
  }, []);


  const shellStyle: React.CSSProperties = {
    position: "relative",
    minHeight: mobile ? "100dvh" : "100%",
    height: mobile ? "100dvh" : "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: mobile ? 16 : 8,
    paddingTop: mobile ? `calc(16px + ${SITE_HEADER_OFFSET})` : `calc(20px + ${SITE_HEADER_OFFSET})`,
    paddingBottom: mobile ? "calc(16px + env(safe-area-inset-bottom))" : "calc(8px + env(safe-area-inset-bottom))",
    paddingLeft: mobile ? "calc(16px + env(safe-area-inset-left))" : "calc(8px + env(safe-area-inset-left))",
    paddingRight: mobile ? "calc(16px + env(safe-area-inset-right))" : "calc(8px + env(safe-area-inset-right))",
    boxSizing: "border-box",
    overflowY: "auto",
    background: mobile ? COLORS.surface : "transparent",
  };

  const innerColStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 390,
    height: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const cardStyle: React.CSSProperties = {
    alignSelf: "stretch",
    background: "#F8F2E9",
    border: "2px solid #231F20",
    borderRadius: 4,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    height: "auto",
    boxSizing: "border-box",
  };

  // Legacy card wrapper used by views not yet redesigned in this prompt
  // (name-prompt, full, host-left, host/joiner lobby). Kept inside the shell.
  const containerStyle: React.CSSProperties = {
    ...cardStyle,
    gap: mobile ? SPACE[5] : SPACE[6],
    padding: mobile ? SPACE[6] : SPACE[10],
    justifyContent: "center",
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: TEXT.subhead.size,
    padding: `${SPACE[4]}px ${SPACE[5]}px`,
    border: BORDER.heavy,
    borderRadius: RADIUS.md,
    background: COLORS.surface,
    color: COLORS.ink,
    flex: 1,
    minWidth: 0,
    outline: "none",
  };

  const wrapInShell = (
    content: React.ReactNode,
    opts?: { above?: React.ReactNode; gap?: number; nav?: boolean },
  ) => (
    <div className="mp-shell" style={shellStyle}>
      <style>{`
        .mp-shell button:not(.ww-grid-option) { transition: filter 120ms ease, background 120ms ease; }
        .mp-shell button:not(:disabled):hover { filter: brightness(1.15); }
        .mp-shell button:not(:disabled):active { filter: brightness(0.95); }
        .mp-shell [role="textbox"]:focus { box-shadow: 0 0 0 2px #0072B2 inset; }
      `}</style>
      {opts?.nav !== false && <SiteHeader />}
      <div style={{ ...innerColStyle, gap: opts?.gap ?? 0 }}>
        {opts?.above}
        {content}
      </div>
    </div>
  );


  // ---------- SOLO ----------
  if (view.kind === "solo") {
    return <SoloView onLeave={leaveToIdle} mobile={mobile} gridSize={view.gridSize} />;
  }

  // ---------- SOLO SETUP (grid-size choice) ----------
  if (view.kind === "solo-setup") {
    const titleStyle: React.CSSProperties = {
      fontFamily: FONT_FAMILY,
      fontWeight: 400,
      fontSize: 24,
      lineHeight: "29px",
      textAlign: "center",
      color: "#231F20",
    };
    return wrapInShell(
      <div style={{
        alignSelf: "stretch",
        background: "#F8F2E9",
        border: "1.58px solid #231F20",
        borderRadius: 6.33,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        height: "auto",
        boxSizing: "border-box",
        justifyContent: "center",
      }}>
        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={titleStyle}>Choose your grid size</div>
            <div style={{ display: "flex", gap: 16, alignSelf: "stretch", alignItems: "stretch" }}>
              {GRID_OPTIONS.map((opt) => (
                <GridSizeOption
                  key={opt.key}
                  option={opt}
                  selected={soloGrid === opt.key}
                  onSelect={setSoloGrid}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, height: 80, alignSelf: "stretch" }}>
            <button
              type="button"
              onClick={() => setView({ kind: "idle" })}
              style={{
                flex: "0 0 100px",
                width: 100,
                background: "#231F20",
                border: "2px solid #231F20",
                borderRadius: 4,
                boxSizing: "border-box",
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 20,
                lineHeight: 1,
                color: "#F8F2E9",
                cursor: "pointer",
                padding: 0,
              }}
            >
              BACK
            </button>
            <button
              type="button"
              onClick={() => setView({ kind: "solo", gridSize: soloGrid })}
              style={{
                position: "relative",
                overflow: "hidden",
                flex: "1 1 0",
                minWidth: 0,
                background: "#D72229",
                border: "2px solid #231F20",
                borderRadius: 4,
                boxSizing: "border-box",
                fontFamily: FONT_FAMILY,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 32,
                lineHeight: 1,
                color: "#FFC1C3",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span className="ww-play-ring" aria-hidden="true" />
              <span className="ww-play-shine" aria-hidden="true" />
              Let's Play!
            </button>
          </div>
        </div>
      </div>,
    );
  }


  // ---------- GAME IN PROGRESS: HOST ----------
  if (isHostView && frozenSeats !== null && activeRoom) {
    const publicState = toPublicState(
      host.state,
      frozenSeats,
      hostClaimWindowRef.current,
      gameId,
      disconnectedSeats,
      awaySeats,
    );
    return (
      <MultiplayerGameView
        publicState={publicState}
        mySeat={0}
        events={hostEvents}
        rollCommit={host.rollCommit ?? null}
        lastClaimReject={host.lastClaimReject ?? null}
        onIntent={(action) => {
          if (action.type === "REQUEST_ROLL") {
            host.commitAndRoll();
            return;
          }
          if (action.type === "PLAYER_ENTER_CLAIM") {
            return;
          }
          // Debug-only controls. Host-local: they never travel the wire.
          // The reducer re-checks ?debug=1, so without the flag these are
          // no-ops even if a button somehow renders.
          if (action.type === "DEBUG_DRAIN_DECK") {
            host.dispatch({ type: "DEBUG_DRAIN_DECK" });
            return;
          }
          if (action.type === "DEBUG_FORCE_END_GAME") {
            host.dispatch({ type: "DEBUG_FORCE_END_GAME" });
            return;
          }
          if (action.type === "NEW_GAME") {
            // Rematch: same seats, same grid size, scores reset to zero.
            host.dispatch({
              type: "INIT",
              slotCount: host.state.slotCount,
              seatCount: host.state.seatCount,
              names: host.state.names,
            });
            return;
          }
          if (action.type === "CANCEL_CLAIM") {
            host.dispatch({ type: "CANCEL_CLAIM", by: 0 });
          } else if (action.type === "PLAYER_SELECT_CARD") {
            host.dispatch({ type: "PLAYER_SELECT_CARD", by: 0, idx: action.idx });
          } else if (action.type === "PLAYER_RESOLVE_MATCH") {
            host.dispatch({ type: "PLAYER_RESOLVE_MATCH", by: 0 });
          } else if (action.type === "FLIP_START") {
            host.dispatch({ type: "FLIP_START", by: 0, idx: action.idx, token: action.token });
            setTimeout(() => {
              host.dispatch({ type: "FLIP_COMPLETE", token: action.token });
            }, 2000);
          }
        }}
        onLeave={leaveToIdle}
        mobile={mobile}
        roomId={activeRoom.id}
        visitorId={visitorId}
        isHost={true}
        presenceVisitorIds={participants.map((p) => p.visitor_id)}
        heartbeatStale={heartbeatStaleSeats}
        awaySkip={awaySkipSeats}
        hostDisconnectedSeats={disconnectedSeats}
        presenceStatus={presenceStatus}
      />
    );
  }

  // ---------- GAME IN PROGRESS: JOINER ----------
  if (view.kind === "joiner" && joinerPublicState && activeRoom) {
    return (
      <MultiplayerGameView
        publicState={joinerPublicState}
        mySeat={joinerSeat}
        events={joiner.events}
        rollCommit={joiner.rollCommit ?? null}
        lastClaimReject={joiner.lastClaimReject ?? null}
        onIntent={joiner.sendIntent}
        onLeave={leaveToIdle}
        mobile={mobile}
        roomId={activeRoom.id}
        visitorId={visitorId}
        isHost={false}
        presenceVisitorIds={participants.map((p) => p.visitor_id)}
        presenceStatus={presenceStatus}
      />
    );
  }

  if (view.kind === "host-left") {
    return wrapInShell(
      <div style={containerStyle}>
        <div style={{ ...textStyle("subhead", mobile), fontStyle: "italic", color: COLORS.ink }}>
          The host left the game.
        </div>
        <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted }}>
          Games end when the host leaves. Start your own table to play again.
        </div>
        <AppButton variant="primary" tone="red" size="md" onClick={leaveToIdle} fullWidth>
          Back to lobby
        </AppButton>
      </div>,
    );
  }

  if (view.kind === "name-prompt") {
    const NAME_CAP = 6;
    const chars = nameInput.slice(0, NAME_CAP).split("");
    const boxes = Array.from({ length: NAME_CAP }, (_, i) => chars[i] ?? "");
    const canContinue = !busy && nameInput.trim().length > 0;

    const focusHiddenInput = () => {
      hiddenNameInputRef.current?.focus();
    };

    const nameCard = (
      <div style={{
        alignSelf: "stretch",
        background: "#F8F2E9",
        border: "2px solid #231F20",
        borderRadius: 4,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 24,
        height: "auto",
        boxSizing: "border-box",
        justifyContent: "center",
      }}>
        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 36,
            lineHeight: "44px",
            color: "#231F20",
          }}>
            Pick a nickname
          </div>
          <div style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: "17px",
            color: "#231F20",
          }}>
            Your nickname will be shown during game play. Up to 6 characters.
          </div>
        </div>

        {view.error && (
          <div role="alert" style={{
            alignSelf: "stretch",
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: "20px",
            color: "#D72229",
            border: "1.5px solid #D72229",
            borderRadius: 4,
            padding: "8px 12px",
            background: "#F8F2E9",
          }}>
            {view.error}
          </div>
        )}

        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Character display row — single overlaid input for real keyboard/paste/autofill */}
          <div
            onMouseDown={(e) => { e.preventDefault(); focusHiddenInput(); }}
            onTouchStart={() => { focusHiddenInput(); }}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 8,
              height: 72,
              background: "#D0C3AF",
              border: "2px solid #231F20",
              borderRadius: 4,
              boxSizing: "border-box",
              cursor: "text",
            }}
          >
            {boxes.map((ch, i) => (
              <div
                key={i}
                style={{
                  flexGrow: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  height: 56,
                  background: "#F8F2E9",
                  border: "2px solid #231F20",
                  borderRadius: 6.33043,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  fontFamily: FONT_FAMILY,
                  fontWeight: 400,
                  fontSize: 20,
                  lineHeight: "24px",
                  color: ch ? "#231F20" : "#D0C3AF",
                  textAlign: "center",
                }}
              >
                {ch || "•"}
              </div>
            ))}
            <input
              ref={hiddenNameInputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value.slice(0, NAME_CAP))}
              onKeyDown={(e) => { if (e.key === "Enter" && canContinue) handleConfirmName(); }}
              maxLength={NAME_CAP}
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Nickname"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                border: 0,
                padding: 0,
                margin: 0,
                background: "transparent",
                color: "transparent",
                caretColor: "transparent",
                outline: "none",
                fontSize: 16, // prevents iOS zoom on focus
                cursor: "text",
              }}
            />
          </div>

          {/* Button row */}
          <div style={{ alignSelf: "stretch", display: "flex", gap: 10, height: 71 }}>
            <button
              type="button"
              onClick={leaveToIdle}
              disabled={busy}
              style={{
                width: 87,
                height: 71,
                flexShrink: 0,
                background: "#231F20",
                border: "2px solid #231F20",
                borderRadius: 4,
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 20,
                lineHeight: "24px",
                color: "#F8F2E9",
                cursor: busy ? "default" : "pointer",
                padding: 0,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmName}
              disabled={!canContinue}
              style={{
                flexGrow: 1,
                height: 71,
                background: "#D72229",
                border: "2px solid #231F20",
                borderRadius: 4,
                fontFamily: FONT_FAMILY,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 32,
                lineHeight: "39px",
                color: "#F8F2E9",
                cursor: canContinue ? "pointer" : "default",
                opacity: canContinue ? 1 : 0.7,
                padding: 0,
              }}
            >
              {busy ? "Connecting…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );

    return wrapInShell(nameCard);
  }

  if (view.kind === "full") {
    return wrapInShell(
      <div style={containerStyle}>
        <div style={{ ...textStyle("subhead", mobile), fontStyle: "italic", color: COLORS.ink }}>
          Table "{view.code}" is full.
        </div>
        <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted }}>
          Tables hold up to {ROOM_CAPACITY} players.
        </div>
        <AppButton variant="secondary" tone="ink" size="md" onClick={leaveToIdle} fullWidth>
          Back
        </AppButton>
      </div>,
    );
  }

  if (view.kind === "idle") {
    const codeEnabled = codeInput.length === ROOM_CODE_LENGTH;
    const introRunning = introStatus === "running";
    const introComplete = introStatus === "complete";
    // The lobby logo has been removed from this screen — the intro's final
    // frame masks the logo so the container itself takes that space, centred
    // on screen. Only the container fades in; nothing else animates.
    const cardStyleIntro: React.CSSProperties = introRunning
      ? { opacity: 0, pointerEvents: "none" }
      : introComplete
      ? { opacity: 1, transition: "opacity 300ms ease 120ms" }
      : { opacity: 1 };
    // Single wrapper: the reveal target IS the intro-hide target. The idle
    // view intentionally skips wrapInShell's extra inner column so there is
    // exactly one element sized like the card, and that element carries the
    // opacity/pointer-events driven by introStatus. See fix note in commit.
    const idleCard = (
      <div style={{
        width: "100%",
        maxWidth: 390,
        background: COLORS.surface,
        border: "2px solid " + COLORS.ink,
        borderRadius: 4,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        gap: 16,
        height: "auto",
        boxSizing: "border-box",
        ...cardStyleIntro,
      }}>
        {view.error && (
          <div role="alert" style={{
            alignSelf: "stretch",
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: "20px",
            color: COLORS.red,
            border: `1.5px solid ${COLORS.red}`,
            borderRadius: 4,
            padding: "8px 12px",
            background: COLORS.surface,
          }}>
            {view.error}
          </div>
        )}

        <div style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          fontSize: 36,
          lineHeight: "44px",
          color: COLORS.ink,
          textAlign: "center",
        }}>
          How do you want to play?
        </div>

        <div style={{ alignSelf: "stretch", display: "flex", gap: 16 }}>
          <button
            type="button"
            onClick={handlePlaySolo}
            disabled={busy}
            style={{
              flex: 1,
              height: 101,
              background: COLORS.blue,
              border: "2px solid " + COLORS.ink,
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              gap: 8,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
            aria-label="Play Solo"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="11" r="5" fill="none" stroke={COLORS.soloTint} strokeWidth="2.5" />
              <path d="M6 27c2-5 6-7 10-7s8 2 10 7" fill="none" stroke={COLORS.soloTint} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 400,
              fontSize: 24,
              lineHeight: "29px",
              color: COLORS.soloTint,
              textAlign: "center",
            }}>
              Play Solo
            </div>
          </button>

          <button
            type="button"
            onClick={handleStartRoom}
            disabled={busy}
            style={{
              flex: 1,
              height: 101,
              background: COLORS.red,
              border: "2px solid " + COLORS.ink,
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              gap: 8,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
            aria-label="Play with Peeps"
          >
            <svg width="64" height="32" viewBox="0 0 64 32" aria-hidden="true">
              <circle cx="16" cy="12" r="5" fill="none" stroke={COLORS.peepsTint} strokeWidth="2.5" />
              <path d="M6 28c2-5 5-7 10-7s8 2 10 7" fill="none" stroke={COLORS.peepsTint} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="48" cy="12" r="5" fill="none" stroke={COLORS.peepsTint} strokeWidth="2.5" />
              <path d="M38 28c2-5 5-7 10-7s8 2 10 7" fill="none" stroke={COLORS.peepsTint} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 400,
              fontSize: 24,
              lineHeight: "29px",
              color: COLORS.peepsTint,
              textAlign: "center",
            }}>
              Play with Peeps
            </div>
          </button>
        </div>

        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 20,
            lineHeight: "24px",
            color: COLORS.ink,
            textAlign: "left",
          }}>
            Already have a table code?
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 8,
            background: COLORS.panel,
            border: "2px solid " + COLORS.ink,
            borderRadius: 4,
            boxSizing: "border-box",
          }}>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(sanitizeCodeInput(e.target.value))}
              placeholder="ABC123"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={ROOM_CODE_LENGTH}
              aria-label="Table code"
              style={{
                flexGrow: 1,
                minWidth: 0,
                padding: "8px 16px",
                background: COLORS.surface,
                border: "2px solid " + COLORS.ink,
                borderRadius: 4,
                boxSizing: "border-box",
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 20,
                lineHeight: "24px",
                letterSpacing: "0.1em",
                color: COLORS.ink,
                textTransform: "uppercase",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleJoinByCode}
              disabled={busy || !codeEnabled}
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                border: "2px solid " + COLORS.ink,
                borderRadius: 4,
                fontFamily: FONT_FAMILY,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 20,
                lineHeight: "24px",
                background: COLORS.inkMuted,
                color: COLORS.panel,
                cursor: codeEnabled && !busy ? "pointer" : "default",
                opacity: codeEnabled && !busy ? 1 : 0.7,
              }}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );


    return (
      <div className="mp-shell" style={shellStyle}>
        <style>{`
          .mp-shell button:not(.ww-grid-option) { transition: filter 120ms ease, background 120ms ease; }
          .mp-shell button:not(:disabled):hover { filter: brightness(1.15); }
          .mp-shell button:not(:disabled):active { filter: brightness(0.95); }
          .mp-shell [role="textbox"]:focus { box-shadow: 0 0 0 2px #0072B2 inset; }
          .mp-shell input::placeholder { color: ${COLORS.panel}; opacity: 1; }
        `}</style>
        <SiteHeader />
        {idleCard}
      </div>
    );
  }


  // Host/Joiner LOBBY view (game not yet started).
  const room = (view as { room: RoomRow }).room;
  const isHost = view.kind === "host";
  const visibleParticipants = participants;
  const canStart = visibleParticipants.length >= 2;
  const link = shareUrl(room.room_code);

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontWeight: 400,
    fontSize: 24,
    lineHeight: "29px",
    textAlign: "center",
    color: "#231F20",
  };

  const wrapperBase: React.CSSProperties = {
    background: "#D0C3AF",
    border: "2px solid #231F20",
    borderRadius: 4,
    boxSizing: "border-box",
  };

  const sectionStyle: React.CSSProperties = {
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  // ---- Section 1: Your Table Info ----
  const codeTileLabel = codeFlash ? "Copied" : `Tap to copy code ${room.room_code}`;
  const tableInfoSection = (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Your Table Info</div>
      <div style={{ display: "flex", gap: 10, height: 80, alignSelf: "stretch" }}>
        <button
          type="button"
          onClick={() => handleCopyCode(room.room_code)}
          aria-label={codeTileLabel}
          aria-live="polite"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            background: "#E79024",
            border: "2px solid #231F20",
            borderRadius: 4,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxSizing: "border-box",
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 32,
            lineHeight: 1,
            letterSpacing: "0.08em",
            color: "#231F20",
            userSelect: "none",
          }}
        >
          {codeFlash ? "Copied" : room.room_code}
        </button>
        {isHost ? (
          <button
            type="button"
            onClick={() => handleShare(room.room_code)}
            aria-live="polite"
            style={{
              flex: "0 0 100px",
              width: 100,
              background: shareFlash ? "#231F20" : "#0072B2",
              border: "2px solid #231F20",
              borderRadius: 4,
              boxSizing: "border-box",
              padding: 0,
              fontFamily: FONT_FAMILY,
              fontWeight: 400,
              fontSize: 20,
              lineHeight: 1,
              color: "#F8F2E9",
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
          >
            {shareFlash ? "Copied!" : "SHARE"}
          </button>
        ) : null}
      </div>
    </div>
  );

  // ---- Section 2: Choose your grid size ----
  const gridPickerSection = (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Choose your grid size</div>
      <div style={{ display: "flex", gap: 16, alignSelf: "stretch", alignItems: "stretch" }}>
        {GRID_OPTIONS.map((opt) => (
          <GridSizeOption
            key={opt.key}
            option={opt}
            selected={lobbyGrid === opt.key}
            interactive={isHost && !starting}
            onSelect={setLobbyGrid}
          />
        ))}
      </div>
    </div>
  );

  // ---- Section 3: Players ----
  const seatSlots = Array.from({ length: ROOM_CAPACITY }, (_, i) => visibleParticipants[i] ?? null);

  const playersSection = (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Players (must have at least 2)</div>
      <div style={{
        ...wrapperBase,
        padding: 8,
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
      }}>
        {seatSlots.map((p, i) => {
          const isYou = !!p && p.visitor_id === visitorId;
          const name = p ? (p.display_name || p.visitor_id.slice(0, 6)) : "---";
          const label = p ? (isYou ? `${name} (you)` : name) : "---";
          return (
            <div key={i} style={{
              height: 36,
              padding: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#F8F2E9",
              border: "2px solid #231F20",
              borderRadius: 4,
              boxSizing: "border-box",
              minWidth: 0,
            }}>
              <div style={{
                width: 20,
                height: 20,
                background: "#231F20",
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1,
                letterSpacing: "0.02em",
                color: "#D0C3AF",
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1,
                letterSpacing: "0.04em",
                color: "#231F20",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
                flex: 1,
              }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---- Section 4: Buttons ----
  const startDisabled = !canStart || starting;
  const buttonsSection = (
    <div style={{ display: "flex", gap: 8, height: 80, alignSelf: "stretch" }}>
      <button
        type="button"
        onClick={() => setShowLeaveConfirm(true)}
        disabled={starting}
        style={{
          flex: "0 0 100px",
          width: 100,
          background: "#231F20",
          border: "2px solid #231F20",
          borderRadius: 4,
          boxSizing: "border-box",
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          fontSize: 20,
          lineHeight: 1,
          color: "#F8F2E9",
          cursor: starting ? "default" : "pointer",
          opacity: starting ? 0.6 : 1,
          padding: 0,
        }}
      >
        BACK
      </button>
      {isHost ? (
        <button
          type="button"
          onClick={handleStartGame}
          disabled={startDisabled}
          aria-busy={starting}
          style={{
            position: "relative",
            overflow: "hidden",
            flex: "1 1 0",
            minWidth: 0,
            background: startDisabled ? "#544C4A" : "#D72229",
            border: "2px solid #231F20",
            borderRadius: 4,
            boxSizing: "border-box",
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 32,
            lineHeight: 1,
            color: startDisabled ? "#D0C3AF" : "#FFC1C3",
            cursor: startDisabled ? "default" : "pointer",
            padding: 0,
          }}
        >
          {!startDisabled ? (
            <>
              <span className="ww-play-ring" aria-hidden="true" />
              <span className="ww-play-shine" aria-hidden="true" />
            </>
          ) : null}
          {starting ? "Starting…" : "Let's Play!"}
        </button>
      ) : null}
    </div>
  );

  const startingBanner = starting ? (
    <div
      role="status"
      aria-live="polite"
      style={{
        alignSelf: "stretch",
        padding: 16,
        background: "#D0C3AF",
        border: "2px solid #231F20",
        borderRadius: 4,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontFamily: FONT_FAMILY,
        fontStyle: "italic",
        fontWeight: 400,
        fontSize: 20,
        lineHeight: "24px",
        color: "#231F20",
        textAlign: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid #231F20",
          borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite",
          display: "inline-block",
        }}
      />
      Starting game…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ) : null;

  const leaveConfirmDialog = showLeaveConfirm ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-confirm-title"
      onClick={(e) => { if (e.target === e.currentTarget) setShowLeaveConfirm(false); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(35, 31, 32, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div style={{
        width: "100%",
        maxWidth: 340,
        background: "#F8F2E9",
        border: "2px solid #231F20",
        borderRadius: 4,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxSizing: "border-box",
      }}>
        <div
          id="leave-confirm-title"
          style={{
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 24,
            lineHeight: "30px",
            color: "#231F20",
          }}
        >
          Leave the table?
        </div>
        <div style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: "20px",
          color: "#231F20",
        }}>
          {isHost
            ? "The table will end for everyone if you leave."
            : "You'll drop out of this lobby."}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(false)}
            autoFocus
            style={{
              flexGrow: 1,
              height: 56,
              background: "#F8F2E9",
              border: "2px solid #231F20",
              borderRadius: 4,
              fontFamily: FONT_FAMILY,
              fontWeight: 400,
              fontSize: 20,
              lineHeight: "24px",
              color: "#231F20",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Stay
          </button>
          <button
            type="button"
            onClick={leaveToIdle}
            style={{
              flexGrow: 1,
              height: 56,
              background: "#D72229",
              border: "2px solid #231F20",
              borderRadius: 4,
              fontFamily: FONT_FAMILY,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 20,
              lineHeight: "24px",
              color: "#F8F2E9",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  ) : null;


  const joinerStatusBar = !isHost ? (
    <div style={{
      alignSelf: "stretch",
      padding: 16,
      height: 56,
      background: "#D0C3AF",
      border: "2px solid #231F20",
      borderRadius: 4,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT_FAMILY,
      fontStyle: "italic",
      fontWeight: 400,
      fontSize: 20,
      lineHeight: "24px",
      color: "#231F20",
      textAlign: "center",
    }}>
      Your host will start the game soon.
    </div>
  ) : null;

  const lobbyCard = (
    <div style={{
      alignSelf: "stretch",
      background: "#F8F2E9",
      border: "1.58px solid #231F20",
      borderRadius: 6.33,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 16,
      height: "auto",
      boxSizing: "border-box",
      justifyContent: "center",
    }}>
      {joinerStatusBar}
      {startingBanner}
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 16 }}>
        {tableInfoSection}
        {gridPickerSection}
        {playersSection}
        {buttonsSection}
      </div>
    </div>
  );

  return wrapInShell(
    <>
      {lobbyCard}
      {leaveConfirmDialog}
    </>,
  );

};

export default MultiplayerWindow;
