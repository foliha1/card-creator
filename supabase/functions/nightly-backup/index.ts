// ============================================================================
// nightly-backup — exports the irreplaceable tables to a private Storage
// bucket, once a night.
//
// Format: JSON Lines (one JSON object per line, .jsonl). Chosen over CSV
// because two of these tables hold jsonb columns (round_events, props) and
// nullable text; CSV would flatten nulls into empty strings and force quoting
// rules on the JSON, so a restore would need hand-repair. JSONL round-trips
// exactly, and it is line-oriented so it can be written and read in pages.
//
// Auth: cron and manual runs must send the shared secret. No public access.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "daily-backups";
const PAGE = 1000;
const KEEP_DAYS = 30;

const TABLES = [
  { name: "daily_results", order: "created_at" },
  { name: "daily_events", order: "created_at" },
  { name: "daily_subscribers", order: "created_at" },
  { name: "admin_allowlist", order: "created_at" },
] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function utcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// deno-lint-ignore no-explicit-any
type Client = any;

/** Reads one table in pages and returns the JSONL body plus the row count. */
async function dumpTable(
  supabase: Client,
  table: string,
  orderCol: string,
): Promise<{ body: string; rows: number }> {
  const parts: string[] = [];
  let rows = 0;
  let from = 0;

  // Page rather than select-all so a big table never has to fit in one read.
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderCol, { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    const page = data ?? [];
    if (page.length === 0) break;

    for (const row of page) parts.push(JSON.stringify(row));
    rows += page.length;
    if (page.length < PAGE) break;
    from += PAGE;
  }

  return { body: parts.length > 0 ? parts.join("\n") + "\n" : "", rows };
}

/** Deletes any dated folder older than the retention window. */
async function prune(supabase: Client): Promise<string[]> {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: folders, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  if (error) throw new Error(`list: ${error.message}`);

  const removed: string[] = [];
  for (const folder of folders ?? []) {
    const name = folder.name as string;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
    if (name >= cutoff) continue;

    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(name, { limit: 1000 });
    const paths = (files ?? []).map((f: { name: string }) => `${name}/${f.name}`);
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
      removed.push(...paths);
    }
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("BACKUP_CRON_SECRET") ?? "";
  const provided = req.headers.get("x-backup-secret") ?? "";
  if (expected.length === 0 || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const runDate = utcDate();
  const results: Array<{
    table: string;
    rows: number;
    bytes: number;
    path: string | null;
    status: string;
    error?: string;
  }> = [];

  for (const t of TABLES) {
    const path = `${runDate}/${t.name}.jsonl`;
    try {
      const { body, rows } = await dumpTable(supabase, t.name, t.order);
      const bytes = new TextEncoder().encode(body).length;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([body], { type: "application/x-ndjson" }), {
          upsert: true,
          contentType: "application/x-ndjson",
        });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      // Row counts are logged so a silently empty dump is visible.
      console.log(`nightly-backup: ${t.name} rows=${rows} bytes=${bytes} path=${path}`);
      results.push({ table: t.name, rows, bytes, path, status: "ok" });
      await supabase.from("backup_runs").insert({
        run_date: runDate,
        kind: "nightly",
        table_name: t.name,
        row_count: rows,
        object_path: path,
        bytes,
        status: "ok",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`nightly-backup: ${t.name} FAILED ${message}`);
      results.push({ table: t.name, rows: 0, bytes: 0, path: null, status: "error", error: message });
      await supabase.from("backup_runs").insert({
        run_date: runDate,
        kind: "nightly",
        table_name: t.name,
        row_count: 0,
        object_path: null,
        bytes: 0,
        status: "error",
        error: message.slice(0, 500),
      });
    }
  }

  // A manifest makes a restore self-describing: what was taken, when, how much.
  const manifest = {
    run_date: runDate,
    generated_at: new Date().toISOString(),
    format: "jsonl",
    tables: results,
  };
  await supabase.storage
    .from(BUCKET)
    .upload(
      `${runDate}/manifest.json`,
      new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
      { upsert: true, contentType: "application/json" },
    );

  let pruned: string[] = [];
  try {
    pruned = await prune(supabase);
    if (pruned.length > 0) console.log(`nightly-backup: pruned ${pruned.length} old files`);
  } catch (err) {
    console.error("nightly-backup: prune failed", err);
  }

  const failed = results.filter((r) => r.status !== "ok");
  return json({
    ok: failed.length === 0,
    run_date: runDate,
    tables: results,
    pruned: pruned.length,
  });
});
