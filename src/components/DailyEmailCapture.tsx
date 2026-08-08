import React, { useState } from "react";
import { emailHasHistory, isValidEmail, subscribeDaily } from "@/lib/dailySubscribe";
import { hapticError, hapticSuccess, hapticTap } from "@/lib/haptics";
import { playSubscribed } from "@/lib/sounds";
import { BORDER, COLORS, RAW, FONT_FAMILY, RADIUS, SPACE } from "@/lib/tokens";

const GEIST = '"Geist", "Geist Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

const bodyStyle: React.CSSProperties = {
  fontFamily: GEIST,
  fontWeight: 500,
  fontSize: 14,
  lineHeight: 1.45,
  color: RAW.warmBlack,
  margin: 0,
};

/**
 * Email capture on the daily result screen. Additive by design — it never
 * blocks or gates the result, and a duplicate signup reads as a success.
 */
const DailyEmailCapture: React.FC<{
  source?: "daily_result" | "landing";
  /** Fired after a successful signup so the caller can re-read streak/stats. */
  onSubscribed?: () => void;
}> = ({ source, onSubscribed }) => {

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const fail = (message: string) => {
    setStatus("error");
    setErrorMessage(message);
    hapticError();
    inputRef.current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    hapticTap();
    if (email.trim().length === 0) {
      fail("Add your email first.");
      return;
    }
    if (!isValidEmail(email)) {
      fail("That doesn't look like an email.");
      return;
    }
    setStatus("sending");
    setErrorMessage(null);
    const ok = await subscribeDaily(email, undefined, source);
    if (ok) {
      setStatus("done");
      hapticSuccess();
      playSubscribed();
      onSubscribed?.();
    } else {

      setStatus("error");
      setErrorMessage("That didn't send. Try again.");
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
          color: RAW.warmBlack,
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
      noValidate
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
          color: RAW.warmBlack,
        }}
      >
        Get tomorrow's grid.
      </h2>
      <p style={bodyStyle}>A new game every morning. Nothing else.</p>
      <input
        ref={inputRef}
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={255}
        aria-label="Email address"
        aria-invalid={status === "error" ? true : undefined}
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "error") {
            setStatus("idle");
            setErrorMessage(null);
          }
        }}

        style={{
          ...bodyStyle,
          fontSize: 16,
          width: "100%",
          boxSizing: "border-box",
          minHeight: 44,
          padding: `0 ${SPACE[8]}px`,
          border: BORDER.heavy,
          borderRadius: RADIUS.sm,
          background: RAW.cream,
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
          background: COLORS.blue,
          color: RAW.cream,
          fontFamily: FONT_FAMILY,
          fontStyle: "italic",
          fontSize: 20,
          lineHeight: 1.15,
          cursor: status === "sending" ? "default" : "pointer",
          opacity: status === "sending" ? 0.7 : 1,
        }}
      >
        Sign me up
      </button>
      {status === "error" && errorMessage && (
        <p role="alert" style={{ ...bodyStyle, color: RAW.warmBlack, fontStyle: "italic" }}>
          {errorMessage}
        </p>
      )}
    </form>
  );
};

export default DailyEmailCapture;
