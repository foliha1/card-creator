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
  const [starting, setStarting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const linkBoxRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<number | null>(null);



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
    if (!isHostView || participants.length < 2 || starting) return;
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

  // Joiner: listen for host's game_starting notice to show loading state.
  useEffect(() => {
    if (view.kind !== "joiner") return;
    const unsub = onBroadcast(({ payload }) => {
      if (
        payload &&
        typeof payload === "object" &&
        (payload as { kind?: string }).kind === "game_starting"
      ) {
        setStarting(true);
      }
    });
    return unsub;
  }, [view.kind, onBroadcast]);

  const shareUrl = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : `/play/${code}`;

  const flashCopied = useCallback(() => {
    setCopiedFlash(true);
    // Keep URL box focused so keyboard users stay put.
    const el = linkBoxRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      // Select the visible text for quick manual re-copy.
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        /* non-fatal */
      }
    }
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopiedFlash(false), 2000);
  }, []);

  const handleCopy = useCallback(async (code: string) => {
    const url = shareUrl(code);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
        flashCopied();
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
        flashCopied();
      } catch {
        toast.error("Copy failed — select the link manually.");
      }
    }
  }, [flashCopied]);

  useEffect(() => () => {
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
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
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    paddingTop: "calc(8px + env(safe-area-inset-top))",
    paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
    paddingLeft: "calc(8px + env(safe-area-inset-left))",
    paddingRight: "calc(8px + env(safe-area-inset-right))",
    boxSizing: "border-box",
    overflowY: "auto",
    background: "#0072B2",
  };

  const innerColStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 390,
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
    opts?: { above?: React.ReactNode; gap?: number },
  ) => (
    <div style={shellStyle}>
      <div style={{ ...innerColStyle, gap: opts?.gap ?? 0 }}>
        {opts?.above}
        {content}
      </div>
    </div>
  );

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
    return wrapInShell(
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
          Room "{view.code}" is full.
        </div>
        <div style={{ ...textStyle("body", mobile), color: COLORS.inkMuted }}>
          Rooms hold up to {ROOM_CAPACITY} players.
        </div>
        <AppButton variant="secondary" tone="ink" size="md" onClick={leaveToIdle} fullWidth>
          Back
        </AppButton>
      </div>,
    );
  }

  if (view.kind === "idle") {
    const codeEnabled = codeInput.length === ROOM_CODE_LENGTH;
    const idleCard = (
      <div style={{
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
      }}>
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

        <button
          type="button"
          onClick={handleStartRoom}
          disabled={busy}
          style={{
            alignSelf: "stretch",
            height: 71,
            background: "#D72229",
            border: "2px solid #231F20",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_FAMILY,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 32,
            lineHeight: "39px",
            color: "#F8F2E9",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
            padding: 0,
          }}
        >
          Start a Table
        </button>

        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 20,
            lineHeight: "24px",
            color: "#231F20",
          }}>
            Already have a code?
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 8,
            height: 56,
            background: "#D0C3AF",
            border: "2px solid #231F20",
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
              aria-label="Room code"
              style={{
                flexGrow: 1,
                minWidth: 0,
                height: 40,
                padding: "8px 16px",
                background: "#F8F2E9",
                border: "2px solid #231F20",
                borderRadius: 4,
                boxSizing: "border-box",
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 20,
                lineHeight: "24px",
                letterSpacing: "0.1em",
                color: "#231F20",
                textTransform: "uppercase",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleJoinByCode}
              disabled={busy || !codeEnabled}
              style={{
                width: 95,
                height: 40,
                flexShrink: 0,
                border: "2px solid #231F20",
                borderRadius: 4,
                fontFamily: FONT_FAMILY,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 20,
                lineHeight: "24px",
                background: codeEnabled ? "#231F20" : "#544C4A",
                color: codeEnabled ? "#F8F2E9" : "#D0C3AF",
                cursor: codeEnabled && !busy ? "pointer" : "default",
                padding: 0,
              }}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );

    return wrapInShell(idleCard, {
      gap: 72,
      above: (
        <img
          src="/WhoopWhoop_Dark_Logo.svg"
          alt="WHOOP! WHOOP!"
          width={210}
          height={166}
          style={{ width: 210, height: 166, display: "block" }}
        />
      ),
    });
  }


  // Host/Joiner LOBBY view (game not yet started).
  const room = (view as { room: RoomRow }).room;
  const isHost = view.kind === "host";
  const visibleParticipants = participants;
  const canStart = visibleParticipants.length >= 2;
  const link = shareUrl(room.room_code);

  const sectionLabelStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontWeight: 400,
    fontSize: 20,
    lineHeight: "24px",
    color: "#231F20",
  };

  const wrapperBase: React.CSSProperties = {
    background: "#D0C3AF",
    border: "2px solid #231F20",
    borderRadius: 4,
    boxSizing: "border-box",
  };

  const codeSection = (
    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={sectionLabelStyle}>Your room code</div>
      <div style={{
        ...wrapperBase,
        display: "flex",
        alignItems: "center",
        padding: 8,
        height: 71,
      }}>
        <div style={{
          flexGrow: 1,
          height: 55,
          padding: "8px 16px",
          background: "#F8F2E9",
          border: "2px solid #231F20",
          borderRadius: 4,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          fontSize: 32,
          lineHeight: "39px",
          letterSpacing: "0.1em",
          color: "#231F20",
          userSelect: "all",
        }}>
          {room.room_code}
        </div>
      </div>
    </div>
  );

  const linkSection = isHost ? (
    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={sectionLabelStyle}>Your room link</div>
      <div style={{
        ...wrapperBase,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
      }}>
        <div
          ref={linkBoxRef}
          tabIndex={0}
          role="textbox"
          aria-readonly="true"
          aria-label="Room link"
          style={{
            alignSelf: "stretch",
            height: 40,
            padding: "8px 16px",
            background: "#F8F2E9",
            border: "2px solid #231F20",
            borderRadius: 4,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 20,
            lineHeight: "24px",
            color: "#231F20",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            userSelect: "all",
            outline: "none",
          }}
          title={link}
        >
          {link}
        </div>
        <button
          type="button"
          onClick={() => handleCopy(room.room_code)}
          aria-live="polite"
          style={{
            alignSelf: "stretch",
            height: 40,
            background: copiedFlash ? "#231F20" : "#0072B2",
            border: "2px solid #231F20",
            borderRadius: 4,
            fontFamily: FONT_FAMILY,
            fontWeight: 400,
            fontSize: 20,
            lineHeight: "24px",
            color: "#F8F2E9",
            cursor: "pointer",
            padding: 0,
            transition: "background 150ms ease",
          }}
        >
          {copiedFlash ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  ) : null;


  const seatSlots = Array.from({ length: ROOM_CAPACITY }, (_, i) => visibleParticipants[i] ?? null);

  const playersSection = (
    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={sectionLabelStyle}>Players (must have at least 2)</div>
      <div style={{
        ...wrapperBase,
        padding: 8,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "repeat(3, auto)",
        gap: 10,
      }}>
        {seatSlots.map((p, i) => {
          const isYou = !!p && p.visitor_id === visitorId;
          const name = p ? (p.display_name || p.visitor_id.slice(0, 6)) : "---";
          const label = p ? (isYou ? `${name} (you)` : name) : "---";
          return (
            <div key={i} style={{
              height: 32,
              padding: 4,
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
                width: 16,
                alignSelf: "stretch",
                background: "#231F20",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 14,
                lineHeight: "17px",
                color: "#D0C3AF",
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{
                fontFamily: FONT_FAMILY,
                fontWeight: 400,
                fontSize: 20,
                lineHeight: "24px",
                letterSpacing: "0.02em",
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

  const leaveButton = (
    <button
      type="button"
      onClick={() => setShowLeaveConfirm(true)}
      disabled={starting}
      style={{
        alignSelf: "stretch",
        height: 40,
        background: "#231F20",
        border: "2px solid #231F20",
        borderRadius: 4,
        fontFamily: FONT_FAMILY,
        fontWeight: 400,
        fontSize: 20,
        lineHeight: "24px",
        color: "#F8F2E9",
        cursor: starting ? "default" : "pointer",
        opacity: starting ? 0.6 : 1,
        padding: 0,
      }}
    >
      Leave the Room
    </button>
  );

  const startDisabled = !canStart || starting;
  const startButton = isHost ? (
    <button
      type="button"
      onClick={handleStartGame}
      disabled={startDisabled}
      aria-busy={starting}
      style={{
        alignSelf: "stretch",
        height: 80,
        background: startDisabled ? "#544C4A" : "#D72229",
        border: "2px solid #231F20",
        borderRadius: 4,
        fontFamily: FONT_FAMILY,
        fontStyle: "italic",
        fontWeight: 400,
        fontSize: 32,
        lineHeight: "39px",
        color: startDisabled ? "#D0C3AF" : "#F8F2E9",
        cursor: startDisabled ? "default" : "pointer",
        padding: 0,
      }}
    >
      {starting ? "Starting…" : "Lets do it!"}
    </button>
  ) : null;

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
          Leave the room?
        </div>
        <div style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: "20px",
          color: "#231F20",
        }}>
          {isHost
            ? "The room will end for everyone if you leave."
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
      border: "2px solid #231F20",
      borderRadius: 4,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 24,
      height: "auto",
      boxSizing: "border-box",
    }}>
      {joinerStatusBar}
      {startingBanner}
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 16 }}>
        {codeSection}
        {linkSection}
        {playersSection}
        {startButton}
        {leaveButton}
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
