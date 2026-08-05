import React from "react";
import { COLORS } from "@/lib/tokens";

/**
 * The repeating shape rule that tops and tails the daily screens.
 * 15 items, 8px gap, each flex-grow so the row spans its container.
 * Sequence: triangle ink, square orange, triangle blue (flipped), square red.
 * Items 11 and 15 (1-indexed) are always flipped triangles.
 */
const SEQUENCE = [
  { kind: "tri", color: COLORS.ink },
  { kind: "sq", color: COLORS.orange },
  { kind: "tri", color: COLORS.blue, flip: true },
  { kind: "sq", color: COLORS.red },
] as const;

const COUNT = 15;
const ROW_H = 18.62;
const TRI_W = 16.13;
const SQ = 16.13;

const Shape: React.FC<{ index: number }> = ({ index }) => {
  const base = SEQUENCE[index % SEQUENCE.length];
  const flip = ("flip" in base && base.flip) || index === 10 || index === 14;
  const isTri = base.kind === "tri" || index === 10 || index === 14;

  return (
    <span
      aria-hidden="true"
      style={{
        flex: "1 1 0",
        minWidth: 0,
        height: ROW_H,
        display: "flex",
        alignItems: isTri ? "stretch" : "center",
        justifyContent: "center",
      }}
    >
      {isTri ? (
        <span
          style={{
            width: "100%",
            maxWidth: TRI_W,
            height: ROW_H,
            background: base.color,
            clipPath: flip
              ? "polygon(0% 0%, 100% 0%, 50% 100%)"
              : "polygon(50% 0%, 100% 100%, 0% 100%)",
          }}
        />
      ) : (
        <span
          style={{
            width: "100%",
            maxWidth: SQ,
            aspectRatio: "1 / 1",
            background: base.color,
          }}
        />
      )}
    </span>
  );
};

const DailyShapeRule: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div
    aria-hidden="true"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      height: ROW_H,
      flexShrink: 0,
      ...style,
    }}
  >
    {Array.from({ length: COUNT }, (_, i) => (
      <Shape key={i} index={i} />
    ))}
  </div>
);

export default DailyShapeRule;
