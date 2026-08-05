import React from "react";
import patternAsset from "@/assets/WhoopWhoop_Daily_Pattern.svg.asset.json";

/** The brand pattern strip that tops and tails the daily screens. */
const ROW_H = 19;

const DailyShapeRule: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <img
    src={patternAsset.url}
    alt=""
    aria-hidden="true"
    style={{
      display: "block",
      width: "100%",
      maxWidth: 354,
      height: ROW_H,
      objectFit: "contain",
      flexShrink: 0,
      ...style,
    }}
  />
);

export default DailyShapeRule;
