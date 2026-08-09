// ============================================================================
// weekly-backup-report — the heartbeat email.
//
// Reads the backup log, not the data. It never touches row contents, so no
// subscriber address ever leaves the database. If any of the last seven
// nightly runs failed, that is the first line of the message.
//
// Delivery: Lovable's own email queue (enqueue_email) when a sender domain is
// configured. Until then the report is still written to the private bucket
// under reports/ and logged in full, so nothing is lost.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "daily-backups";
const TO = "hello@whoop-whoop.com";
const TABLES = ["daily_results", "daily_events", "daily_subscribers", "admin_allowlist"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// deno-lint-ignore no-explicit-any
type Client = any;

function dayString(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10);
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function liveCount(supabase: Client, table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) return -1;
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("BACKUP_CRON_SECRET") ?? "";
  if (expected.length === 0 || (req.headers.get("x-backup-secret") ?? "") !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const days = Array.from({ length: 7 }, (_, i) => dayString(i));
  const weekAgo = dayString(7);

  const { data: runs } = await supabase
    .from("backup_runs")
    .select("run_date, table_name, row_count, bytes, status, error")
    .eq("kind", "nightly")
    .gte("run_date", weekAgo)
    .order("run_date", { ascending: false });

  const rows = runs ?? [];

  // Did each of the last seven nights complete every table without error?
  const nightly = days.map((day) => {
    const forDay = rows.filter((r: { run_date: string }) => r.run_date === day);
    if (forDay.length === 0) return { day, status: "missing" as const };
    const bad = forDay.filter((r: { status: string }) => r.status !== "ok");
    return {
      day,
      status: bad.length > 0 ? ("failed" as const) : ("ok" as const),
      tables: forDay.length,
    };
  });
  const problems = nightly.filter((n) => n.status !== "ok");

  // Counts now, versus what last week's dump recorded.
  const { data: lastWeekRuns } = await supabase
    .from("backup_runs")
    .select("table_name, row_count")
    .eq("kind", "nightly")
    .eq("status", "ok")
    .eq("run_date", weekAgo);

  const counts: Array<{ table: string; now: number; then: number | null; delta: number | null }> = [];
  for (const table of TABLES) {
    const now = await liveCount(supabase, table);
    const prev = (lastWeekRuns ?? []).find(
      (r: { table_name: string }) => r.table_name === table,
    );
    const then = prev ? (prev.row_count as number) : null;
    counts.push({ table, now, then, delta: then === null ? null : now - then });
  }

  const latestDay = days.find((d) => rows.some((r: { run_date: string }) => r.run_date === d));
  const latestBytes = latestDay
    ? rows
        .filter((r: { run_date: string }) => r.run_date === latestDay)
        .reduce((sum: number, r: { bytes: number }) => sum + (r.bytes ?? 0), 0)
    : 0;

  const headline =
    problems.length > 0
      ? `BACKUP PROBLEM: ${problems.map((p) => `${p.day} ${p.status}`).join(", ")}`
      : "All 7 nightly backups succeeded.";

  const lines: string[] = [
    headline,
    "",
    "Row counts (now vs 7 days ago):",
    ...counts.map(
      (c) =>
        `  ${c.table}: ${c.now}` +
        (c.delta === null
          ? " (no backup from 7 days ago to compare)"
          : ` (${c.delta >= 0 ? "+" : ""}${c.delta} since last week)`),
    ),
    "",
    "Nightly runs:",
    ...nightly.map((n) => `  ${n.day}: ${n.status}`),
    "",
    `Latest dump (${latestDay ?? "none"}): ${humanBytes(latestBytes)}`,
    "",
    "No data is attached. Files live in the private daily-backups bucket.",
  ];
  const text = lines.join("\n");
  const subject =
    problems.length > 0
      ? "WHOOP! backups — ACTION NEEDED"
      : "WHOOP! backups — all good";

  console.log(`weekly-backup-report:\n${text}`);

  // Keep a copy next to the dumps regardless of whether email is available.
  await supabase.storage
    .from(BUCKET)
    .upload(
      `reports/${dayString(0)}.txt`,
      new Blob([text], { type: "text/plain" }),
      { upsert: true, contentType: "text/plain" },
    );

  let emailed = false;
  let emailNote = "";
  try {
    const { error } = await supabase.rpc("enqueue_email", {
      p_queue: "transactional_emails",
      p_payload: {
        to: TO,
        subject,
        text,
        html: `<pre style="font:14px/1.5 monospace">${text.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</pre>`,
      },
    });
    if (error) throw new Error(error.message);
    emailed = true;
  } catch (err) {
    emailNote = err instanceof Error ? err.message : String(err);
    console.error("weekly-backup-report: email not sent —", emailNote);
  }

  await supabase.from("backup_runs").insert({
    run_date: dayString(0),
    kind: "weekly_report",
    table_name: "-",
    row_count: counts.reduce((s, c) => s + Math.max(c.now, 0), 0),
    object_path: `reports/${dayString(0)}.txt`,
    bytes: new TextEncoder().encode(text).length,
    status: problems.length > 0 ? "error" : "ok",
    error: problems.length > 0 ? headline.slice(0, 500) : null,
  });

  return json({ ok: true, emailed, emailNote, subject, text });
});
