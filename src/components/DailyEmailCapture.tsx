import React, { useState } from "react";
import { isValidEmail, subscribeDaily } from "@/lib/dailySubscribe";
import { hapticError, hapticSuccess, hapticTap } from "@/lib/haptics";
import { BORDER, COLORS, FONT_FAMILY, RADIUS, SPACE } from "@/lib/tokens";

const GEIST = '"Geist", "Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

const bodyStyle: React.CSSProperties = {
  fontFamily: GEIST,
  fontSize: 14,
  lineHeight: 1.45,
  color: COLORS.ink,
  margin: 0,
};

/**
 * Email capture on the daily result screen. Additive by design — it never
 * blocks or gates the result, and a duplicate signup reads as a success.
 */
const DailyEmailCapture: React.FC = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    hapticTap();
    if (!isValidEmail(email)) {
      setStatus("error");
      hapticError();
      return;
    }
    setStatus("sending");
    const ok = await subscribeDaily(email);
    if (ok) {
      setStatus("done");
      hapticSuccess();
    } else {
      setStatus("error");
      hapticError();
    }
  };

  if (status === "done") {
    return (
      <p
        style={{
          alignSelf: "stretch",
          margin: 0,
          fontFamily: FONT_FAMILY,
          fontSize: 20,
          lineHeight: 1.2,
          color: COLORS.ink,
          textAlign: "center",
        }}
      >
        You're in. See you tomorrow.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        gap: SPACE[4],
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: FONT_FAMILY,
          fontSize: 20,
          lineHeight: 1.2,
          color: COLORS.ink,
        }}
      >
        Get tomorrow's grid.
      </h2>
      <p style={bodyStyle}>A new puzzle every morning. Nothing else.</p>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={255}
        aria-label="Email address"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        style={{
          ...bodyStyle,
          width: "100%",
          boxSizing: "border-box",
          minHeight: 44,
          padding: `0 ${SPACE[8]}px`,
          border: BORDER.heavy,
          borderRadius: RADIUS.sm,
          background: COLORS.surface,
        }}
      />
      <button
        type="submit"
        className="ww-press"
        disabled={status === "sending"}
        style={{
          width: "100%",
          minHeight: 44,
          border: BORDER.heavy,
          borderRadius: RADIUS.sm,
          background: COLORS.red,
          color: COLORS.surface,
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontSize: 20,
          lineHeight: 1,
          cursor: status === "sending" ? "default" : "pointer",
          opacity: status === "sending" ? 0.7 : 1,
        }}
      >
        Sign me up
      </button>
      {status === "error" && (
        <p role="alert" style={{ ...bodyStyle, color: COLORS.red }}>
          That didn't send. Try again.
        </p>
      )}
    </form>
  );
};

export default DailyEmailCapture;
