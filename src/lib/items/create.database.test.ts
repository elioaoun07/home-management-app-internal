import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { prepareItemCreate } from "./createContract";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const TAG = "33333333-3333-4333-8333-333333333333";
const migration = readFileSync("migrations/2026-10-11_atomic-item-create.sql", "utf8");
const schema = readFileSync("migrations/schema.sql", "utf8");
const tables = ["household_links", "items", "reminder_details", "event_details", "item_subtasks", "item_alerts", "item_recurrence_rules", "nfc_tags", "item_prerequisites"];
let db: PGlite;
const trigger = { condition_type: "nfc_state_change", condition_config: { tag_id: TAG, target_state: "arriving" } };
async function identity(user = A) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
}
async function create(body: unknown) {
  return (await db.query<{ receipt: { item: { id: string; status: string }; completion: { status: string; children: Record<string, string[]> } } }>(
    "SELECT public.create_item_complete($1) receipt", [JSON.stringify(prepareItemCreate(body))])).rows[0].receipt;
}
async function fail(table: string, event = "INSERT") {
  await db.exec(`RESET ROLE; CREATE TRIGGER injected_failure BEFORE ${event} ON public.${table} FOR EACH ROW EXECUTE FUNCTION fail_write()`);
  await identity();
}
beforeAll(async () => {
  db = new PGlite();
  // Authoritative column/constraint shapes. Enum placeholders in the snapshot
  // are represented as text here; no production enum/RLS readiness claim.
  const ddl = tables.map(t => {
    const source = schema.match(new RegExp(`CREATE TABLE public\\.${t} \\([\\s\\S]*?\\n\\);`))?.[0];
    if (!source) throw new Error(t);
    return source.replaceAll("USER-DEFINED", "text").replaceAll("categories ARRAY", "categories text[]")
      .replace(/::[a-z_]+_enum/g, "::text");
  }).join("\n");
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.catalogue_items(id uuid PRIMARY KEY);
    CREATE TABLE public.health_medications(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    ${ddl}
    CREATE FUNCTION public.is_household_partner(p_other_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM household_links WHERE active AND ((owner_user_id=auth.uid() AND partner_user_id=p_other_user_id) OR (partner_user_id=auth.uid() AND owner_user_id=p_other_user_id))) $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE items ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_items ON items TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
    CREATE FUNCTION fail_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$;`);
  await db.exec(migration);
}, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("RESET ROLE");
  for (const table of tables) await db.exec(`DROP TRIGGER IF EXISTS injected_failure ON ${table}`);
  await db.exec("TRUNCATE items,nfc_tags,household_links,auth.users CASCADE");
  await db.query("INSERT INTO auth.users VALUES ($1),($2)", [A, B]);
  await db.query("INSERT INTO nfc_tags(id,user_id,tag_slug,label,states) VALUES($1,$2,'door','Door','[\"arriving\",\"leaving\"]')", [TAG, A]);
  await identity();
});
it("installs repeatably and returns all requested child identities", async () => {
  await db.exec("RESET ROLE"); await db.exec(migration); await identity();
  const r = await create({ type: "reminder", title: "Bins", due_at: "2026-10-12T14:00:00Z", subtasks: [{ title: "Bag" }],
    recurrence_rule: { rrule: "FREQ=WEEKLY", start_anchor: "2026-10-12T14:00:00Z" }, prerequisites: [trigger] });
  expect(r.item.status).toBe("dormant"); expect(r.completion.status).toBe("complete");
  for (const ids of Object.values(r.completion.children)) expect(ids).toHaveLength(1);
});
it.each(["reminder_details", "item_subtasks", "item_alerts", "item_recurrence_rules", "item_prerequisites"])("rolls back the parent and all children after %s fails", async table => {
  await fail(table);
  await expect(create({ type: "reminder", title: "Bins", due_at: "2026-10-12T14:00:00Z", subtasks: [{ title: "Bag" }],
    recurrence_rule: { rrule: "FREQ=WEEKLY", start_anchor: "2026-10-12T14:00:00Z" }, prerequisites: [trigger] })).rejects.toThrow("injected");
  expect((await db.query("SELECT id FROM items")).rows).toHaveLength(0);
});
it("rolls back a failed event detail and keeps ordinary drafts alert-free", async () => {
  await fail("event_details");
  await expect(create({ type: "event", title: "Dentist", start_at: "2026-10-12T14:00:00Z", end_at: "2026-10-12T15:00:00Z" })).rejects.toThrow("injected");
  const r = await create({ type: "task", title: "Dentist", status: "draft", due_at: "2026-10-12T14:00:00Z" });
  expect(r.item.status).toBe("draft"); expect(r.completion.children.alerts).toEqual([]);
  expect(() => prepareItemCreate({ type: "reminder", title: "Draft", status: "draft", prerequisites: [trigger] })).toThrow("Draft triggers are unavailable");
});
it("rolls back a prerequisite insert when its dormant update fails", async () => {
  const r = await create({ type: "reminder", title: "Bins" });
  await fail("items", "UPDATE");
  await expect(db.query("SELECT add_item_prerequisite_complete($1,$2)", [r.item.id, JSON.stringify(trigger)])).rejects.toThrow("injected");
  expect((await db.query("SELECT id FROM item_prerequisites")).rows).toHaveLength(0);
  expect((await db.query<{ status: string }>("SELECT status FROM items")).rows[0].status).toBe("pending");
});
it("removes the last trigger and activates together; a failed update rolls back the delete", async () => {
  const r = await create({ type: "reminder", title: "Bins", prerequisites: [trigger] });
  const id = r.completion.children.prerequisites[0]; await fail("items", "UPDATE");
  await expect(db.query("SELECT remove_item_prerequisite_complete($1,$2)", [r.item.id, id])).rejects.toThrow("injected");
  expect((await db.query("SELECT id FROM item_prerequisites")).rows).toHaveLength(1);
  await db.exec("RESET ROLE; DROP TRIGGER injected_failure ON items"); await identity();
  await db.query("SELECT remove_item_prerequisite_complete($1,$2)", [r.item.id, id]);
  expect((await db.query<{ status: string }>("SELECT status FROM items")).rows[0].status).toBe("pending");
});
it("denies anonymous, foreign items/tags/states and foreign assignees without widening RLS", async () => {
  const r = await create({ type: "reminder", title: "Bins" }); await identity(B);
  await expect(db.query("SELECT add_item_prerequisite_complete($1,$2)", [r.item.id, JSON.stringify(trigger)])).rejects.toThrow("Item not found");
  await expect(create({ type: "reminder", title: "Bins", prerequisites: [trigger] })).rejects.toThrow("NFC tag or state unavailable");
  await expect(create({ type: "reminder", title: "Bins", responsible_user_id: A })).rejects.toThrow("Assignee unavailable");
  await identity();
  await expect(create({ type: "reminder", title: "Bins", prerequisites: [{ ...trigger, condition_config: { tag_id: TAG, target_state: "invented" } }] })).rejects.toThrow("NFC tag or state unavailable");
  await db.exec("RESET ROLE; SET ROLE anon");
  await expect(db.query("SELECT create_item_complete('{}')")).rejects.toThrow("permission denied");
});
it("permits an active partner's NFC tag and assignee while keeping the new item owned by its caller", async () => {
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO household_links(code,owner_user_id,partner_user_id) VALUES('fixture',$1,$2)", [A, B]);
  await identity(B);
  const r = await create({ type: "reminder", title: "Bins", responsible_user_id: A, prerequisites: [trigger] });
  expect(r.item.status).toBe("dormant");
  expect((await db.query<{ user_id: string }>("SELECT user_id FROM items WHERE id=$1", [r.item.id])).rows[0].user_id).toBe(B);
});
it("preserves the form's same-day custom alert at zero offset", async () => {
  const input = { type: "reminder", title: "Bins", due_at: "2026-10-12T14:00:00Z", alerts: [{ kind: "relative", offset_minutes: 0, relative_to: "due", custom_time: "09:00" }] };
  const prepared = prepareItemCreate(input);
  expect(new Date(prepared.alerts[0].trigger_at!).getHours()).toBe(9);
  const r = await create(prepared);
  expect(r.completion.children.alerts).toHaveLength(1);
});
