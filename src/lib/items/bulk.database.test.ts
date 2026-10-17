import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { prepareItemCreate } from "./createContract";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ids = Array.from({ length: 6 }, (_, n) => `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${n}`);
const atomic = readFileSync("migrations/2026-10-11_atomic-item-create.sql", "utf8");
const migration = readFileSync("migrations/2026-10-17_items-bulk-create.sql", "utf8");
const schema = readFileSync("migrations/schema.sql", "utf8");
const tables = ["household_links", "items", "reminder_details", "event_details", "item_subtasks", "item_alerts", "item_recurrence_rules", "nfc_tags", "item_prerequisites"];
let db: PGlite;

async function identity(user = A) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET ROLE authenticated");
}
const body = (n: number, extra: Record<string, unknown> = {}) =>
  prepareItemCreate({ id: ids[n], type: "reminder", title: `Chore ${n}`, due_at: "2026-10-18T09:00:00Z", is_chore: true, ...extra });
type Receipt = { item: { id: string }; completion: { status: string; replayed: boolean; children: Record<string, string[]> } };
type Bulk = { items: { id: string }[]; failed: { index: number; code: string }[]; completion: { status: string; created: number; replayed: number } };
const create = async (b: unknown) =>
  (await db.query<{ r: Receipt }>("SELECT public.create_item_complete($1) r", [JSON.stringify(b)])).rows[0].r;
const bulk = async (bodies: unknown) =>
  (await db.query<{ r: Bulk }>("SELECT public.create_items_bulk($1) r", [JSON.stringify(bodies)])).rows[0].r;
const count = async (table: string) =>
  Number((await db.query<{ n: number }>(`SELECT count(*)::int n FROM ${table}`)).rows[0].n);

beforeAll(async () => {
  db = new PGlite();
  const ddl = tables.map((t) => {
    const source = schema.match(new RegExp(`CREATE TABLE public\\.${t} \\([\\s\\S]*?\\n\\);`))?.[0];
    if (!source) throw new Error(t);
    return source.replaceAll("USER-DEFINED", "text").replaceAll("categories ARRAY", "categories text[]").replace(/::[a-z_]+_enum/g, "::text");
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
  await db.exec(atomic);
  await db.exec(migration);
}, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("RESET ROLE");
  await db.exec("DROP TRIGGER IF EXISTS injected_failure ON item_subtasks");
  await db.exec("TRUNCATE items,household_links,auth.users CASCADE");
  await db.query("INSERT INTO auth.users VALUES ($1),($2)", [A, B]);
  await identity();
});

it("refuses to install before the atomic-create migration", async () => {
  const bare = new PGlite();
  await expect(bare.exec(migration)).rejects.toThrow("SCH-24");
  await bare.close();
}, 30_000);

it("installs repeatably", async () => {
  await db.exec("RESET ROLE"); await db.exec(migration); await identity();
  expect((await bulk([body(0)])).completion.created).toBe(1);
});

it("a create with a client id is replay-safe: the same item, never a second one", async () => {
  const first = await create(body(0, { subtasks: [{ title: "Bag" }] }));
  const again = await create(body(0, { subtasks: [{ title: "Bag" }] }));
  expect(first.completion.replayed).toBe(false);
  expect(again.completion.replayed).toBe(true);
  expect(again.item.id).toBe(first.item.id);
  expect(again.completion.children.subtasks).toEqual(first.completion.children.subtasks);
  expect(await count("items")).toBe(1); expect(await count("reminder_details")).toBe(1); expect(await count("item_subtasks")).toBe(1);
});

it("without a client id every create is new, as before", async () => {
  const a = await create(prepareItemCreate({ type: "reminder", title: "Bins" }));
  const b = await create(prepareItemCreate({ type: "reminder", title: "Bins" }));
  expect(a.item.id).not.toBe(b.item.id);
  expect(await count("items")).toBe(2);
});

it("another user's id is never replayed or exposed", async () => {
  await create(body(0));
  await identity(B);
  await expect(create(body(0))).rejects.toThrow(/duplicate key/);
  expect(await count("items")).toBe(0);
});

it("creates a batch in one call and returns every item", async () => {
  const r = await bulk([body(0), body(1, { subtasks: [{ title: "Bag" }] }), body(2)]);
  expect(r.completion).toMatchObject({ status: "complete", created: 3, replayed: 0 });
  expect(r.items.map((i) => i.id)).toEqual([ids[0], ids[1], ids[2]]);
  expect(await count("items")).toBe(3); expect(await count("reminder_details")).toBe(3); expect(await count("item_subtasks")).toBe(1);
  expect(await count("item_alerts")).toBe(3);
});

it("a retried batch returns what it already created and adds nothing", async () => {
  const batch = [body(0), body(1), body(2)];
  await bulk(batch);
  const again = await bulk(batch);
  expect(again.completion).toMatchObject({ status: "complete", created: 0, replayed: 3 });
  expect(await count("items")).toBe(3); expect(await count("item_alerts")).toBe(3);
});

it("a bad item fails alone; the others commit and the failure leaves no rows", async () => {
  await identity(B);
  const r = await bulk([body(0), body(1, { responsible_user_id: A }), body(2)]);
  expect(r.completion.status).toBe("partial");
  expect(r.failed).toEqual([{ index: 1, code: "42501" }]);
  expect(r.items.map((i) => i.id)).toEqual([ids[0], ids[2]]);
  expect(await count("items")).toBe(2);
  expect((await db.query("SELECT id FROM items WHERE id=$1", [ids[1]])).rows).toHaveLength(0);
});

it("a child write that fails rolls back only that item", async () => {
  await db.exec("RESET ROLE; CREATE TRIGGER injected_failure BEFORE INSERT ON public.item_subtasks FOR EACH ROW EXECUTE FUNCTION fail_write()");
  await identity();
  const r = await bulk([body(0), body(1, { subtasks: [{ title: "Bag" }] }), body(2)]);
  expect(r.failed).toHaveLength(1); expect(r.failed[0].index).toBe(1);
  expect(await count("items")).toBe(2); expect(await count("reminder_details")).toBe(2); expect(await count("item_subtasks")).toBe(0);
});

it("another user's id inside a batch fails that item only", async () => {
  await create(body(0));
  await identity(B);
  const r = await bulk([body(0), body(1)]);
  expect(r.failed).toEqual([{ index: 0, code: "23505" }]);
  expect(r.items.map((i) => i.id)).toEqual([ids[1]]);
});

it.each([[[]], [{}], [Array.from({ length: 51 }, (_, n) => ({ n }))]])("refuses a batch that is empty, not a list or over 50", async (bad) => {
  await expect(bulk(bad)).rejects.toThrow("Invalid batch");
});

it("denies anonymous callers", async () => {
  await db.exec("RESET ROLE; SET ROLE anon");
  await expect(db.query("SELECT public.create_items_bulk('[]')")).rejects.toThrow("permission denied");
});
