// ============================================================================
// ac-subscribe — the only endpoint the client calls for the daily email signup.
//
// Order of operations is deliberate:
//   1. validate the address
//   2. write it to our own database (this decides success/failure)
//   3. best-effort push to ActiveCampaign; a failure there is logged and
//      swallowed so we never lose an address because a third party was down.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// --- Rate limit -------------------------------------------------------------
// Database-backed so it holds across instances: a shared per-day counter keyed
// on the caller's IP. A real person signs up once; the cap only stops stuffing.
const MAX_PER_IP_PER_DAY = 20;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/** True when the caller has exceeded today's cap. Failures never block signup. */
async function rateLimited(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ip: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("rl_hit", {
      p_bucket: "ac_subscribe_ip",
      p_key: ip,
      p_max: MAX_PER_IP_PER_DAY,
    });
    if (error) {
      console.error("ac-subscribe: rl_hit failed", error.message);
      return false;
    }
    return data === false;
  } catch (err) {
    console.error("ac-subscribe: rl_hit threw", err);
    return false;
  }
}


// --- ActiveCampaign ---------------------------------------------------------

/**
 * Creates (or finds) the contact and adds it to the configured list.
 * Returns true only when the contact is on the list.
 */
async function syncToActiveCampaign(email: string): Promise<boolean> {
  const base = (Deno.env.get("AC_API_URL") ?? "").replace(/\/+$/, "");
  const key = Deno.env.get("AC_API_KEY") ?? "";
  const listId = Deno.env.get("AC_LIST_ID") ?? "";
  if (!base || !key || !listId) {
    console.error("ac-subscribe: ActiveCampaign env vars missing");
    return false;
  }

  const headers = { "Api-Token": key, "Content-Type": "application/json" };

  let contactId: string | null = null;

  const created = await fetch(`${base}/api/3/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ contact: { email } }),
  });
  const createdBody = await created.text();

  if (created.ok) {
    try {
      contactId = JSON.parse(createdBody)?.contact?.id ?? null;
    } catch {
      contactId = null;
    }
  } else {
    // Duplicate email is the expected non-ok case — look the contact up instead.
    console.error("ac-subscribe: contact create failed", created.status, createdBody);
    const found = await fetch(
      `${base}/api/3/contacts?email=${encodeURIComponent(email)}`,
      { headers },
    );
    const foundBody = await found.text();
    if (!found.ok) {
      console.error("ac-subscribe: contact lookup failed", found.status, foundBody);
      return false;
    }
    try {
      contactId = JSON.parse(foundBody)?.contacts?.[0]?.id ?? null;
    } catch {
      contactId = null;
    }
  }

  if (!contactId) {
    console.error("ac-subscribe: no contact id resolved for", email);
    return false;
  }

  const listed = await fetch(`${base}/api/3/contactLists`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contactList: { list: Number(listId), contact: Number(contactId), status: 1 },
    }),
  });
  const listedBody = await listed.text();
  if (!listed.ok) {
    console.error("ac-subscribe: list add failed", listed.status, listedBody);
    return false;
  }
  return true;
}

// --- Handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (rateLimited(clientIp(req))) {
    return json({ error: "Too many requests" }, 429);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();
  const visitorId =
    typeof body.visitorId === "string" && body.visitorId.trim().length > 0
      ? body.visitorId.trim().slice(0, 128)
      : null;
  const source =
    body.source === "landing" || body.source === "prelaunch"
      ? body.source
      : "daily_result";

  if (email.length === 0 || email.length > 255 || !EMAIL_RE.test(email)) {
    return json({ error: "Invalid email address" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1. Our database is the source of truth and decides the outcome.
  const { data: saved, error: saveError } = await supabase.rpc("subscribe_daily", {
    p_email: email,
    p_visitor_id: visitorId,
    p_source: source,
  });

  if (saveError || saved !== true) {
    console.error("ac-subscribe: subscribe_daily failed", saveError?.message ?? saved);
    return json({ ok: false, error: "Could not save subscription" }, 500);
  }

  // 2. Best effort from here on: the address is already safe.
  let syncedToAc = false;
  try {
    syncedToAc = await syncToActiveCampaign(email);
  } catch (err) {
    console.error("ac-subscribe: ActiveCampaign threw", err);
  }

  if (syncedToAc) {
    const { error: markError } = await supabase
      .from("daily_subscribers")
      .update({ synced_to_ac: true })
      .eq("email", email);
    if (markError) {
      console.error("ac-subscribe: could not mark synced_to_ac", markError.message);
    }
  }

  return json({ ok: true, syncedToAc });
});
