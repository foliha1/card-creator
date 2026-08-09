// ============================================================================
// backup-restore-drill — proves a dump can be loaded back.
//
// Reads one .jsonl dump from the private bucket and inserts it into a scratch
// table, then reports the line count in the file and the row count landed.
// It never writes to a live table. Same shared secret as the nightly job.
//
// POST body: { "date": "2026-08-09", "table": "daily_results" }
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "daily-backups";
const SCRATCH: Record<string, string> = {
  daily_results: "daily_results_scratch",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("BACKUP_CRON_SECRET") ?? "";
  if (expected.length === 0 || (req.headers.get("x-backup-secret") ?? "") !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const date = String(body.date ?? "");
  const table = String(body.table ?? "daily_results");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Bad date" }, 400);
  const scratch = SCRATCH[table];
  if (!scratch) return json({ error: "No scratch table for that table" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const path = `${date}/${table}.jsonl`;
  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
  if (dlErr || !file) return json({ error: `download failed: ${dlErr?.message}` }, 404);

  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const rows = lines.map((l) => JSON.parse(l));

  // Start clean so the count is unambiguous.
  await supabase.from(scratch).delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from(scratch).insert(chunk);
    if (error) return json({ error: `insert failed: ${error.message}`, inserted }, 500);
    inserted += chunk.length;
  }

  const { count } = await supabase.from(scratch).select("id", { count: "exact", head: true });

  console.log(`backup-restore-drill: ${path} lines=${lines.length} scratch_rows=${count}`);
  return json({
    ok: lines.length === (count ?? -1),
    path,
    lines_in_file: lines.length,
    rows_inserted: inserted,
    scratch_rows: count,
    scratch_table: scratch,
  });
});
