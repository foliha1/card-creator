import { describe, expect, it } from "vitest";
import {
  bannerHeadline,
  bannerState,
  humanAge,
  humanBytes,
  type BackupStatus,
} from "@/components/AdminBackupBanner";

const healthy = (over: Partial<BackupStatus> = {}): BackupStatus => ({
  latest_day: "2026-08-09",
  latest_at: "2026-08-09T03:17:00Z",
  latest_bytes: 22732,
  last_ok_at: "2026-08-09T03:17:00Z",
  hours_since_ok: 3,
  stale: false,
  nights: Array.from({ length: 7 }, (_, i) => ({
    day: `2026-08-0${3 + i}`,
    tables: 4,
    failed: 0,
    status: "ok" as const,
  })),
  tables: [
    { table: "daily_results", rows: 3, bytes: 900, status: "ok", prev_rows: 1, delta: 2 },
  ],
  failures: [],
  ...over,
});

describe("backup status banner", () => {
  it("is quiet when every night succeeded", () => {
    const s = healthy();
    expect(bannerState(s)).toBe("ok");
    expect(bannerHeadline(s)).toBe("Backups healthy. Last run 3 hours ago.");
  });

  it("is loud when a table failed, naming what and when", () => {
    const s = healthy({
      failures: [{ day: "2026-08-09", table: "daily_events", error: "timeout" }],
    });
    expect(bannerState(s)).toBe("bad");
    expect(bannerHeadline(s)).toBe("Backup failed: daily_events on 2026-08-09.");
  });

  it("treats a stale run as a failure", () => {
    const s = healthy({ stale: true, hours_since_ok: 40 });
    expect(bannerState(s)).toBe("bad");
    expect(bannerHeadline(s)).toContain("stale");
  });

  it("flags a missing night even when nothing errored", () => {
    const nights = healthy().nights.map((n, i) =>
      i === 6 ? { ...n, status: "missing" as const, tables: 0 } : n,
    );
    const s = healthy({ nights });
    expect(bannerState(s)).toBe("bad");
    expect(bannerHeadline(s)).toContain("did not run");
  });

  it("formats sizes and ages", () => {
    expect(humanBytes(22732)).toBe("22.2 KB");
    expect(humanAge(null)).toBe("never");
    expect(humanAge(1)).toBe("1 hour ago");
    expect(humanAge(72)).toBe("3 days ago");
  });
});
