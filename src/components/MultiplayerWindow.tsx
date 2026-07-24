import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { COLORS, SPACE, BORDER, RADIUS, textStyle, TEXT, FONT_FAMILY } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { getVisitorId, getDisplayName, setDisplayName } from "@/lib/visitor";
import { trackEvent } from "@/lib/analytics";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import { useMultiplayerHost, useMultiplayerJoiner, useTransientEvents, type SeatMapEntry } from "@/hooks/useMultiplayerGame";
import MultiplayerGameView from "@/components/MultiplayerGameView";
import { toPublicState } from "@/lib/publicState";
import {
  createRoom,
  findRoomByCode,
  isValidRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RoomRow,
} from "@/lib/rooms";

interface MultiplayerWindowProps {
  initialRoomCode?: string;
}

const ROOM_CAPACITY = 6;

type PendingAction =
  | { kind: "create" }
  | { kind: "join-code"; code: string }
  | { kind: "join-link"; code: string };

type View =
  | { kind: "idle"; error?: string }
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

const MultiplayerWindow: React.FC<MultiplayerWindowProps> = ({ initialRoomCode }) => {
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

  // Compute disconnected seats: seats in frozenSeats whose visitor_id is no
  // longer present in the room. Skipped before game start (frozenSeats null).
  const disconnectedSeats = useMemo(() => {
    if (!frozenSeats) return [] as number[];
    const present = new Set(participants.map((p) => p.visitor_id));
    return frozenSeats.filter((e) => !present.has(e.visitor_id)).map((e) => e.seat);
  }, [frozenSeats, participants]);

  // Host: game controller.
  const gameEnabled = isHostView && frozenSeats !== null;
  const host = useMultiplayerHost({
    channel,
    onBroadcast,
    seatMap: frozenSeats ?? [],
    hostVisitorId: visitorId,
    enabled: gameEnabled,
    gameId,
    disconnectedSeats,
  });
  const hostEvents = useTransientEvents(channel, onBroadcast, gameEnabled);

  // Track claimWindow on the host in parallel to what useMultiplayerHost
  // broadcasts, so the local toPublicState render matches the wire payload.
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
                ? `Room "${code}" doesn't exist or has ended.`
                : `Room "${code}" doesn't exist.`,
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
        setView({ kind: "idle", error: "Couldn't reach the room. Check your connection and try again." });
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
    if (!isHostView || participants.length < 2) return;
    const seatMap: SeatMapEntry[] = participants.slice(0, ROOM_CAPACITY).map((p, i) => ({
      seat: i,
      visitor_id: p.visitor_id,
      display_name: p.display_name,
    }));
    setGameId(crypto.randomUUID());
    setFrozenSeats(seatMap);
    completedFiredRef.current = false;
    trackEvent("game_started", {
      roomCode: activeRoom?.room_code,
      metadata: { player_count: seatMap.length },
    });
  }, [isHostView, participants, activeRoom]);

  const shareUrl = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : `/play/${code}`;

  const handleCopy = useCallback(async (code: string) => {
    const url = shareUrl(code);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
        return;
      }
      throw new Error("no clipboard");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success("Link copied");
      } catch {
        toast.error("Copy failed — select the link manually.");
      }
    }
  }, []);

  const leaveToIdle = useCallback(() => {
    setCodeInput("");
    setFrozenSeats(null);
    setGameId("");
    setView({ kind: "idle" });
  }, []);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: mobile ? SPACE[5] : SPACE[6],
    padding: mobile ? SPACE[6] : SPACE[10],
    height: "100%",
    boxSizing: "border-box",
    overflow: "auto",
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

  // ---------- GAME IN PROGRESS: HOST ----------
  if (isHostView && frozenSeats !== null && activeRoom) {
    const publicState = toPublicState(
      host.state,
      frozenSeats,
      hostClaimWindowRef.current,
      gameId,
      disconnectedSeats,
    );
    return (
      <MultiplayerGameView
        publicState={publicState}
        mySeat={0}
        events={hostEvents}
        onIntent={(action) => {
          if (action.type === "REQUEST_ROLL") {
            void host.doRollDice();
            return;
          }
          if (action.type === "PLAYER_ENTER_CLAIM" || action.type === "PLAYER_ENTER_CLAIM_DURING_ROLL") {
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
          } else if (action.type === "LAST_CALL_CLAIM") {
            host.dispatch({ type: "LAST_CALL_CLAIM", by: 0, a: action.a, b: action.b });
          }
        }}
        onLeave={leaveToIdle}
        mobile={mobile}
        roomId={activeRoom.id}
        visitorId={visitorId}
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
        onIntent={joiner.sendIntent}
        onLeave={leaveToIdle}
        mobile={mobile}
        roomId={activeRoom.id}
        visitorId={visitorId}
      />
    );
  }

  if (view.kind === "host-left") {
    return (
      <div style={containerStyle}>
        <div style={{ ...textStyle("subhead", mobile), fontStyle: "italic", color: COLORS.ink }}>
          The host left the game.
        </div>
        <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted }}>
          Games end when the host leaves. Start your own room to play again.
        </div>
        <AppButton variant="primary" tone="red" size="md" onClick={leaveToIdle} fullWidth>
          Back to lobby
        </AppButton>
      </div>
    );
  }

  if (view.kind === "name-prompt") {
    const pendingLabel =
      view.pending.kind === "create" ? "Starting a room" : `Joining ${view.pending.code}`;
    return (
      <div style={containerStyle}>
        <div>
          <div style={{ ...textStyle("subhead", mobile), fontStyle: "italic", color: COLORS.ink }}>
            Pick a nickname
          </div>
          <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted, marginTop: SPACE[3] }}>
            {pendingLabel}. Up to 8 characters so it fits on the chip.
          </div>
        </div>

        {view.error && (
          <div role="alert" style={{
            ...textStyle("caption", mobile),
            color: COLORS.red,
            border: `1.5px solid ${COLORS.red}`,
            borderRadius: RADIUS.md,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            background: COLORS.surface,
          }}>
            {view.error}
          </div>
        )}

        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value.slice(0, 8))}
          onKeyDown={(e) => { if (e.key === "Enter") handleConfirmName(); }}
          placeholder="Nickname"
          maxLength={8}
          autoFocus
          aria-label="Nickname"
          style={{ ...inputStyle, textTransform: "none", letterSpacing: 0 }}
        />

        <div style={{ display: "flex", gap: SPACE[3], flexDirection: mobile ? "column" : "row" }}>
          <AppButton
            variant="primary"
            tone="red"
            size={mobile ? "md" : "lg"}
            onClick={handleConfirmName}
            disabled={busy || !nameInput.trim()}
            fullWidth
          >
            {busy ? "Connecting…" : "Continue"}
          </AppButton>
          <AppButton
            variant="secondary"
            tone="ink"
            size={mobile ? "md" : "lg"}
            onClick={leaveToIdle}
            disabled={busy}
            fullWidth={mobile}
          >
            Cancel
          </AppButton>
        </div>
      </div>
    );
  }

  if (view.kind === "full") {
    return (
      <div style={containerStyle}>
        <div style={{ ...textStyle("subhead", mobile), fontStyle: "italic", color: COLORS.ink }}>
          Room "{view.code}" is full.
        </div>
        <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted }}>
          Rooms hold up to {ROOM_CAPACITY} players.
        </div>
        <AppButton variant="secondary" tone="ink" size="md" onClick={leaveToIdle} fullWidth>
          Back
        </AppButton>
      </div>
    );
  }

  if (view.kind === "idle") {
    return (
      <div style={containerStyle}>
        <div>
          <div style={{ ...textStyle("subhead", mobile), fontStyle: "italic", color: COLORS.ink }}>
            Play with friends.
          </div>
          <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted, marginTop: SPACE[3] }}>
            Start a room and share the link, or type a code someone gave you.
          </div>
        </div>

        {view.error && (
          <div role="alert" style={{
            ...textStyle("caption", mobile),
            color: COLORS.red,
            border: `1.5px solid ${COLORS.red}`,
            borderRadius: RADIUS.md,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            background: COLORS.surface,
          }}>
            {view.error}
          </div>
        )}

        <AppButton
          variant="primary"
          tone="red"
          size={mobile ? "md" : "lg"}
          onClick={handleStartRoom}
          disabled={busy}
          fullWidth
        >
          Start a room
        </AppButton>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
          <div style={{ ...textStyle("label", mobile), color: COLORS.ink }}>Got a code?</div>
          <div style={{ display: "flex", gap: SPACE[3], flexDirection: mobile ? "column" : "row" }}>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(sanitizeCodeInput(e.target.value))}
              placeholder="ABC234"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={ROOM_CODE_LENGTH}
              aria-label="Room code"
              style={{ ...inputStyle, letterSpacing: 4, textTransform: "uppercase" }}
            />
            <AppButton
              variant="primary"
              tone="ink"
              size="md"
              onClick={handleJoinByCode}
              disabled={busy || codeInput.length !== ROOM_CODE_LENGTH}
            >
              Join
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  // Host/Joiner LOBBY view (game not yet started).
  const room = (view as { room: RoomRow }).room;
  const isHost = view.kind === "host";
  const visibleParticipants = participants;
  const canStart = visibleParticipants.length >= 2;

  const statusLabel =
    presenceStatus === "connected"
      ? null
      : presenceStatus === "connecting"
      ? "Connecting…"
      : "Connection lost — retrying";

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
        <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted, textTransform: "uppercase", letterSpacing: 2 }}>
          Room code
        </div>
        <div style={{
          ...textStyle("display", mobile),
          color: COLORS.ink,
          letterSpacing: mobile ? 6 : 10,
          fontVariantNumeric: "tabular-nums",
          padding: `${SPACE[5]}px ${SPACE[6]}px`,
          border: BORDER.heavy,
          borderRadius: RADIUS.md,
          background: COLORS.surface,
          textAlign: "center",
          userSelect: "all",
        }}>
          {room.room_code}
        </div>
      </div>

      {isHost && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
          <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted }}>Share this link:</div>
          <div style={{
            ...textStyle("caption", mobile),
            color: COLORS.ink,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            border: BORDER.standard,
            borderRadius: RADIUS.sm,
            background: COLORS.surface,
            wordBreak: "break-all",
            userSelect: "all",
          }}>
            {shareUrl(room.room_code)}
          </div>
          <AppButton variant="primary" tone="blue" size="md" onClick={() => handleCopy(room.room_code)}>
            Copy link
          </AppButton>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: SPACE[3] }}>
          <div style={{ ...textStyle("label", mobile), color: COLORS.ink }}>
            Players ({visibleParticipants.length}/{ROOM_CAPACITY})
          </div>
          {statusLabel && (
            <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted, fontStyle: "italic" }}>
              {statusLabel}
            </div>
          )}
        </div>
        <div style={{
          border: BORDER.standard,
          borderRadius: RADIUS.md,
          background: COLORS.surface,
          padding: SPACE[5],
          minHeight: 72,
          display: "flex",
          flexDirection: "column",
          gap: SPACE[3],
        }}>
          {visibleParticipants.length === 0 ? (
            <div style={{ ...textStyle("captionItalic", mobile), color: COLORS.inkMuted }}>
              Waiting for players…
            </div>
          ) : (
            visibleParticipants.map((p, i) => {
              const isYou = p.visitor_id === visitorId;
              const seatLabel = p.is_host ? "Host" : `Seat ${i + 1}`;
              return (
                <div key={p.visitor_id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: SPACE[3],
                }}>
                  <div style={{ ...textStyle("body", mobile), color: COLORS.ink }}>
                    {p.display_name || p.visitor_id.slice(0, 6)}
                    {isYou && (
                      <span style={{
                        ...textStyle("caption", mobile),
                        color: COLORS.inkMuted,
                        marginLeft: SPACE[2],
                        fontStyle: "italic",
                      }}>(you)</span>
                    )}
                  </div>
                  <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted }}>
                    {seatLabel}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
          <AppButton
            variant="primary"
            tone="red"
            size={mobile ? "md" : "lg"}
            onClick={handleStartGame}
            disabled={!canStart}
            fullWidth
          >
            Start game
          </AppButton>
          {!canStart && (
            <div style={{ ...textStyle("captionItalic", mobile), color: COLORS.inkMuted, textAlign: "center" }}>
              Needs at least 2 players.
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...textStyle("captionItalic", mobile), color: COLORS.inkMuted, textAlign: "center" }}>
          The host will start the game.
        </div>
      )}

      <AppButton variant="secondary" tone="ink" size="md" onClick={leaveToIdle} fullWidth>
        Leave room
      </AppButton>
    </div>
  );
};

export default MultiplayerWindow;
