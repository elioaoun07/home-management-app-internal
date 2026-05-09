// Benchmark the Journal/Items query path against Supabase.
// Runs the same shape of queries that src/features/items/useItems.ts -> fetchItems() runs.
// Uses service role to bypass RLS (baseline) and anon (RLS path) for comparison.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const USER_ID = process.env.DEV_USER_ID;

if (!URL || !SERVICE || !ANON || !USER_ID) {
  console.error("Missing env vars");
  process.exit(1);
}

const ms = () => performance.now();
const fmt = (t) => `${t.toFixed(0)}ms`;

async function runWith(client, label) {
  console.log(`\n===== ${label} =====`);

  const t0 = ms();
  const { data: link } = await client
    .from("household_links")
    .select("owner_user_id, partner_user_id")
    .or(`owner_user_id.eq.${USER_ID},partner_user_id.eq.${USER_ID}`)
    .eq("active", true)
    .maybeSingle();
  console.log(`household_links:           ${fmt(ms() - t0)}`);

  const partnerId = link
    ? link.owner_user_id === USER_ID
      ? link.partner_user_id
      : link.owner_user_id
    : null;

  const t1 = ms();
  let q = client
    .from("items")
    .select("*")
    .is("archived_at", null)
    .is("deleted_at", null);
  if (partnerId) {
    q = q.or(`user_id.eq.${USER_ID},user_id.eq.${partnerId}`);
  } else {
    q = q.eq("user_id", USER_ID);
  }
  q = q.order("created_at", { ascending: false });
  const { data: items, error } = await q;
  console.log(
    `items (${items?.length ?? 0}):${" ".repeat(Math.max(0, 19 - String(items?.length ?? 0).length))}${fmt(ms() - t1)}`,
  );
  if (error) {
    console.log("items error:", error.message);
    return;
  }
  if (!items || items.length === 0) return;

  const ids = items.map((i) => i.id);

  const t2 = ms();
  const [reminders, events, subtasks, alerts, rules, pauses] =
    await Promise.all([
      timed(
        client.from("reminder_details").select("*").in("item_id", ids),
        "reminder_details",
      ),
      timed(
        client.from("event_details").select("*").in("item_id", ids),
        "event_details",
      ),
      timed(
        client.from("item_subtasks").select("*").in("parent_item_id", ids),
        "item_subtasks",
      ),
      timed(
        client.from("item_alerts").select("*").in("item_id", ids),
        "item_alerts",
      ),
      timed(
        client
          .from("item_recurrence_rules")
          .select("*, item_recurrence_exceptions(*)")
          .in("item_id", ids),
        "item_recurrence_rules+exceptions",
      ),
      timed(
        client.from("recurrence_pauses").select("*").in("item_id", ids),
        "recurrence_pauses",
      ),
    ]);
  console.log(`children (parallel total): ${fmt(ms() - t2)}`);

  console.log(`TOTAL:                     ${fmt(ms() - t0)}`);
}

async function timed(builder, label) {
  const t = ms();
  const res = await builder;
  console.log(
    `  ${label}:${" ".repeat(Math.max(1, 28 - label.length))}${fmt(ms() - t)} (${res.data?.length ?? 0} rows)${res.error ? " ERR " + res.error.message : ""}`,
  );
  return res;
}

const adminClient = createClient(URL, SERVICE, {
  auth: { persistSession: false },
});
const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });

console.log(`Supabase URL: ${URL}`);
console.log(`User: ${USER_ID}`);

await runWith(adminClient, "SERVICE ROLE (no RLS, baseline DB perf)");
await runWith(anonClient, "ANON (RLS path, will return 0 — only RLS overhead)");

// Run service role twice to ignore cold start
await runWith(adminClient, "SERVICE ROLE (warm)");
