import React from "react";
import patternAsset from "@/assets/WhoopWhoop_Daily_Pattern.svg.asset.json";

/** The brand pattern strip that tops and tails the daily screens. */
const DailyShapeRule: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div
    className="daily-shape-rule"
    aria-hidden="true"
    style={{
      "--daily-rule-bg": `url(${patternAsset.url})`,
      ...style,
    } as React.CSSProperties}
  />
);

export default DailyShapeRule;
