// ============================================================================
// DailyGroupSignIn — the signed-out state of /groups.
//
// Not a dialog: groups is its own page, so the sign-in lives in the page. A
// short explanation, one sentence about what joining makes visible, and an
// email field. Everything is styled from tokens.
// ============================================================================

import React from "react";
import {
  BORDER,
  COLORS,
  FONT_FAMILY_UI,
  FONT_WEIGHT_UI,
  RADIUS,
  SPACE,
  buttonStyle,
  textStyle,
} from "@/lib/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const labelStyle = (mobile: boolean): React.CSSProperties => ({
  ...textStyle("caption", mobile),
  fontFamily: FONT_FAMILY_UI,
  fontWeight: FONT_WEIGHT_UI,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: COLORS.ink,
});

const DailyGroupSignIn: React.FC<{
  mobile: boolean;
  /** True when the visitor arrived on a `?join=CODE` link. */
  pendingJoin?: boolean;
  onSend: (email: string) => Promise<void>;
}> = ({ mobile, pendingJoin = false, onSend }) => {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("That email does not look right.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSend(clean);
      setSent(true);
    } catch {
      setError("Could not send the link. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="groups-signin"
      style={{ display: "flex", flexDirection: "column", gap: SPACE[6] }}
    >
      <h1 style={{ ...textStyle("title", mobile), color: COLORS.ink, margin: 0 }}>
        Your groups
      </h1>
      <p style={{ ...textStyle("body", mobile), color: COLORS.ink, margin: 0 }}>
        A group is a handful of people playing the same daily puzzle, with one board
        showing how you all did.
      </p>
      <p
        data-testid="groups-signin-visibility"
        style={{ ...textStyle("body", mobile), color: COLORS.inkMuted, margin: 0 }}
      >
        Joining makes your daily result visible to everyone in that group.
      </p>
      {pendingJoin && (
        <p style={{ ...labelStyle(mobile), margin: 0 }}>
          Your invite code is saved. Sign in to finish joining.
        </p>
      )}

      {sent ? (
        <p
          data-testid="groups-signin-sent"
          style={{ ...textStyle("body", mobile), color: COLORS.ink, margin: 0 }}
        >
          Check your email. The link brings you straight back here.
        </p>
      ) : (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: SPACE[3] }}>
            <span style={labelStyle(mobile)}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              data-testid="groups-signin-email"
              style={{
                ...textStyle("control", mobile),
                boxSizing: "border-box",
                width: "100%",
                minHeight: 44,
                padding: `0 ${SPACE[5]}px`,
                border: BORDER.heavy,
                borderRadius: RADIUS.sm,
                background: COLORS.surface,
                color: COLORS.ink,
              }}
            />
          </label>
          {error && (
            <p
              role="alert"
              data-testid="groups-signin-error"
              style={{ ...textStyle("caption", mobile), color: COLORS.red, margin: 0 }}
            >
              {error}
            </p>
          )}
          <button
            type="button"
            className="ww-press"
            onClick={submit}
            disabled={busy}
            data-testid="groups-signin-submit"
            style={{
              ...buttonStyle("primary", "lg", { mobile, disabled: busy }),
              alignSelf: "stretch",
            }}
          >
            {busy ? "SENDING…" : "EMAIL ME A LINK"}
          </button>
        </>
      )}
    </div>
  );
};

export default DailyGroupSignIn;
