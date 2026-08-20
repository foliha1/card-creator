// ============================================================================
// DailyGroupsLine — the results screen's single group line.
//
// One line, deliberately: the results screen had a spacing pass and a board
// here would undo it. In no groups it renders NOTHING — no prompt, no empty
// state — so the screen's height is unchanged for anyone without a group.
// ============================================================================

import React from "react";
import { Link } from "react-router-dom";
import { bestStanding } from "@/lib/dailyGroups";
import { useMyGroups } from "@/hooks/useMyGroups";
import { useGroupAuth } from "@/hooks/useGroupAuth";
import { COLORS, FONT_FAMILY_UI, FONT_WEIGHT_UI, SPACE, textStyle } from "@/lib/tokens";

const DailyGroupsLine: React.FC<{
  puzzleNumber: number;
  /** Passed so a member who switched devices resolves to one membership. */
  email?: string | null;
  mobile: boolean;
}> = ({ puzzleNumber, email = null, mobile }) => {
  const { session, ready } = useGroupAuth();
  const signedIn = session !== null;
  const { groups, loading } = useMyGroups(
    signedIn ? puzzleNumber : null,
    signedIn ? email : null,
    signedIn ? 1 : 0
  );
  const best = bestStanding(groups);
  // Signed out renders nothing at all — no prompt, no nudge — exactly as the
  // no-groups case does, so the results screen's height never changes.
  if (!ready || !signedIn || loading) return null;



  return (
    <Link
      to="/groups"
      data-testid="results-groups-line"
      style={{
        ...textStyle("caption", mobile),
        fontFamily: FONT_FAMILY_UI,
        fontWeight: FONT_WEIGHT_UI,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: COLORS.blue,
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        minHeight: 44,
        gap: SPACE[2],
      }}
    >
      {best ? `Your groups → ${best.standing} in ${best.group.name}` : "Play with your people →"}
    </Link>
  );
};

export default DailyGroupsLine;
