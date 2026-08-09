import AdminBackupBanner, { type BackupStatus } from "@/components/AdminBackupBanner";
const nights = Array.from({ length: 7 }, (_, i) => ({ day: `2026-08-0${3 + i}`, tables: 4, failed: 0, status: "ok" as const }));
const base: BackupStatus = { latest_day: "2026-08-09", latest_at: "2026-08-09T03:17:00Z", latest_bytes: 22732, last_ok_at: "2026-08-09T03:17:00Z", hours_since_ok: 3, stale: false, nights, tables: [{ table: "daily_results", rows: 3, bytes: 900, status: "ok", prev_rows: 1, delta: 2 }], failures: [] };
const bad: BackupStatus = { ...base, stale: true, hours_since_ok: 41, nights: nights.map((n, i) => (i === 6 ? { ...n, status: "failed" as const, failed: 1 } : n)), failures: [{ day: "2026-08-09", table: "daily_events", error: "storage upload timeout" }] };
export default function BannerPreview() {
  return <div style={{ padding: 16, display: "grid", gap: 24, background: "var(--ww-surface)" }}>
    <div id="healthy"><AdminBackupBanner status={base} /></div>
    <div id="failed"><AdminBackupBanner status={bad} /></div>
  </div>;
}
