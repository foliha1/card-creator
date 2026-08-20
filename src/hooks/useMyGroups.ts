// ============================================================================
// useMyGroups — the player's groups, read through `get_my_groups`.
//
// Keyed to the local puzzle number, so a member abroad never sees a board for a
// puzzle they have not played. `email` is passed so a player who switched
// devices resolves to one membership, exactly as `daily_rows_for` does.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { fetchMyGroups, type MyGroup } from "@/lib/dailyGroups";
import { getVisitorId } from "@/lib/visitor";

export function useMyGroups(
  puzzleNumber: number | null,
  email: string | null,
  /** Bumped after create/join/leave to re-read. */
  refreshKey = 0
): { groups: MyGroup[]; loading: boolean; reload: () => void } {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [localKey, setLocalKey] = useState(0);
  const reload = useCallback(() => setLocalKey((k) => k + 1), []);

  useEffect(() => {
    let live = true;
    // A null puzzle number means "no signed-in reader": nothing to ask for.
    if (puzzleNumber === null) {
      setGroups([]);
      setLoading(false);
      return () => {
        live = false;
      };
    }
    setLoading(true);
    void fetchMyGroups(getVisitorId(), email, puzzleNumber)

        if (!live) return;
        setGroups(rows);
      })
      .catch(() => {
        if (live) setGroups([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [puzzleNumber, email, refreshKey, localKey]);

  return { groups, loading, reload };
}

export default useMyGroups;
