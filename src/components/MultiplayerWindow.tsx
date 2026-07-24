import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { COLORS, SPACE, BORDER, RADIUS, textStyle, TEXT, FONT_FAMILY } from "@/lib/tokens";
import { AppButton } from "@/components/ui/AppButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { getVisitorId } from "@/lib/visitor";
import { trackEvent } from "@/lib/analytics";
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

type Participant = { visitorId: string; label?: string };

type View =
  | { kind: "idle"; error?: string }
  | { kind: "host"; room: RoomRow }
  | { kind: "joiner"; room: RoomRow };

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
  // Placeholder participants array — later prompt wires this from realtime presence.
  const [participants] = useState<Participant[]>([]);

  // Handle /play/:roomCode entrypoint
  useEffect(() => {
    if (!initialRoomCode) return;
    const normalized = initialRoomCode.toUpperCase();
    const visitorId = getVisitorId();
    let cancelled = false;
    setBusy(true);
    findRoomByCode(normalized, visitorId)
      .then((room) => {
        if (cancelled) return;
        const found = !!room;
        trackEvent("invite_link_clicked", {
          roomCode: normalized,
          metadata: { room_found: found },
        });
        if (room) {
          if (room.is_host) {
            setView({ kind: "host", room });
          } else {
            setView({ kind: "joiner", room });
            trackEvent("room_joined", { roomCode: room.room_code, metadata: { via: "link" } });
          }
        } else {
          setView({
            kind: "idle",
            error: `Room "${normalized}" doesn't exist or has ended.`,
          });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        trackEvent("invite_link_clicked", {
          roomCode: normalized,
          metadata: { room_found: false, error: true },
        });
        const msg = e instanceof Error ? e.message : "Couldn't reach the room. Check your connection.";
        setView({ kind: "idle", error: msg });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialRoomCode]);

  const handleStartRoom = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const visitorId = getVisitorId();
      const room = await createRoom(visitorId);
      trackEvent("room_created", { roomCode: room.room_code });
      setView({ kind: "host", room });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      setView({ kind: "idle", error: msg });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleJoinByCode = useCallback(async () => {
    if (busy) return;
    const normalized = codeInput.toUpperCase();
    if (!isValidRoomCode(normalized)) {
      setView({ kind: "idle", error: "That doesn't look like a valid code." });
      return;
    }
    setBusy(true);
    try {
      const visitorId = getVisitorId();
      const room = await findRoomByCode(normalized, visitorId);
      if (!room) {
        setView({ kind: "idle", error: `Room "${normalized}" doesn't exist.` });
        return;
      }
      if (room.is_host) {
        setView({ kind: "host", room });
      } else {
        setView({ kind: "joiner", room });
        trackEvent("room_joined", { roomCode: room.room_code, metadata: { via: "code" } });
      }
    } finally {
      setBusy(false);
    }
  }, [busy, codeInput]);

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
      // Manual-select fallback
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

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: mobile ? SPACE[5] : SPACE[6],
    padding: mobile ? SPACE[6] : SPACE[10],
    height: "100%",
    boxSizing: "border-box",
    overflow: "auto",
  };

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
          <div
            role="alert"
            style={{
              ...textStyle("caption", mobile),
              color: COLORS.red,
              border: `1.5px solid ${COLORS.red}`,
              borderRadius: RADIUS.md,
              padding: `${SPACE[3]}px ${SPACE[4]}px`,
              background: COLORS.surface,
            }}
          >
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
          {busy ? "Starting…" : "Start a room"}
        </AppButton>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
          <div style={{ ...textStyle("label", mobile), color: COLORS.ink }}>
            Got a code?
          </div>
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
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: TEXT.subhead.size,
                letterSpacing: 4,
                textTransform: "uppercase",
                padding: `${SPACE[4]}px ${SPACE[5]}px`,
                border: BORDER.heavy,
                borderRadius: RADIUS.md,
                background: COLORS.surface,
                color: COLORS.ink,
                flex: 1,
                minWidth: 0,
                outline: "none",
              }}
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

  // Host / Joiner shared body
  const isHost = view.kind === "host";
  const { room } = view;

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
        <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted, textTransform: "uppercase", letterSpacing: 2 }}>
          Room code
        </div>
        <div
          style={{
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
          }}
        >
          {room.room_code}
        </div>
      </div>

      {isHost && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
          <div style={{ ...textStyle("caption", mobile), color: COLORS.inkMuted }}>
            Share this link:
          </div>
          <div
            style={{
              ...textStyle("caption", mobile),
              color: COLORS.ink,
              padding: `${SPACE[3]}px ${SPACE[4]}px`,
              border: BORDER.standard,
              borderRadius: RADIUS.sm,
              background: COLORS.surface,
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {shareUrl(room.room_code)}
          </div>
          <AppButton variant="primary" tone="blue" size="md" onClick={() => handleCopy(room.room_code)}>
            Copy link
          </AppButton>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
        <div style={{ ...textStyle("label", mobile), color: COLORS.ink }}>
          Players
        </div>
        <div
          style={{
            border: BORDER.standard,
            borderRadius: RADIUS.md,
            background: COLORS.surface,
            padding: SPACE[5],
            minHeight: 72,
            display: "flex",
            flexDirection: "column",
            gap: SPACE[3],
          }}
        >
          {participants.length === 0 ? (
            <div style={{ ...textStyle("captionItalic", mobile), color: COLORS.inkMuted }}>
              Waiting for players…
            </div>
          ) : (
            participants.map((p) => (
              <div key={p.visitorId} style={{ ...textStyle("body", mobile), color: COLORS.ink }}>
                {p.label ?? p.visitorId.slice(0, 6)}
              </div>
            ))
          )}
        </div>
      </div>

      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
          <AppButton variant="primary" tone="red" size={mobile ? "md" : "lg"} disabled fullWidth>
            Start game
          </AppButton>
          <div style={{ ...textStyle("captionItalic", mobile), color: COLORS.inkMuted, textAlign: "center" }}>
            Activates once another player joins.
          </div>
        </div>
      ) : (
        <div style={{ ...textStyle("captionItalic", mobile), color: COLORS.inkMuted, textAlign: "center" }}>
          The host will start the game.
        </div>
      )}
    </div>
  );
};

export default MultiplayerWindow;
