import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
const RUN = "44444444-4444-4444-8444-444444444444";
const migration = readFileSync(
  "migrations/2026-10-10_era-execution-journal.sql",
  "utf8",
);
const schema = readFileSync("migrations/schema.sql", "utf8");
let db: PGlite;
async function identity(owner = A) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [
    owner,
  ]);
  await db.exec("SET ROLE authenticated");
}
async function save(
  version: number,
  state = { schemaVersion: 1 },
  artifacts: unknown[] = [],
) {
  const { rows } = await db.query<{
    run: { id: string; version: number; user_id: string; state: unknown };
  }>("SELECT public.save_era_run($1,$2,$3,$4,$5) AS run", [
    RUN,
    CONV,
    version,
    JSON.stringify(state),
    JSON.stringify(artifacts),
  ]);
  return rows[0].run;
}
beforeAll(async () => {
  db = new PGlite();
  // Existing source tables/columns come from the authoritative snapshot;
  // only this migration's RLS/RPC are asserted, never production's state.
  const source = ["era_conversations", "household_links", "era_actions"]
    .map((table) => {
      const ddl = schema.match(
        new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`),
      )?.[0];
      if (!ddl) throw new Error(`Missing fixture ${table}`);
      return ddl;
    })
    .join("\n");
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    ${source}`);
  await db.exec(migration);
}, 30_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "RESET ROLE; TRUNCATE public.era_runs, public.era_actions, public.era_conversations, public.household_links, auth.users CASCADE",
  );
  await db.query("INSERT INTO auth.users VALUES ($1),($2)", [A, B]);
  await db.query(
    "INSERT INTO public.era_conversations(id,user_id) VALUES ($1,$2)",
    [CONV, A],
  );
  await identity();
});
describe("ERA execution journal in isolated PostgreSQL", () => {
  it("installs idempotently and has owner-only RLS and no direct write privilege", async () => {
    await db.exec("RESET ROLE");
    await db.exec(migration);
    await identity();
    const saved = await save(-1);
    expect(saved.user_id).toBe(A);
    expect(saved.version).toBe(0);
    await expect(
      db.query(
        "INSERT INTO public.era_runs(id,user_id,conversation_id,state) VALUES ($1,$2,$3,'{}')",
        [RUN, A, CONV],
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
    await identity(B);
    expect((await db.query("SELECT * FROM public.era_runs")).rows).toHaveLength(
      0,
    );
    await expect(save(0)).rejects.toThrow(/Not found/);
    await expect(save(-1)).rejects.toThrow(/Not found/);
  });
  it("compare-and-swap selects one executor and rejects stale receipts", async () => {
    await save(-1);
    const attempts = await Promise.allSettled([
      save(0, { schemaVersion: 1 }),
      save(0, { schemaVersion: 1 }),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(1);
    await expect(save(0)).rejects.toThrow(/Execution changed/);
    expect((await save(1)).version).toBe(2);
  });
  it("a duplicate create cannot reset progress", async () => {
    await save(-1);
    await save(0, { schemaVersion: 2 });
    await expect(save(-1)).rejects.toThrow(/duplicate key/);
    expect(
      (
        await db.query<{ version: number }>(
          "SELECT version FROM public.era_runs",
        )
      ).rows[0].version,
    ).toBe(1);
  });
  it("projects artifacts atomically once across checkpoints and resumption", async () => {
    const artifact = {
      key: "shopping:shopping_item:milk:created",
      action: "created",
      entity: "shopping_item",
      id: RUN,
      title: "Milk",
      route: "/chat",
    };
    await save(-1);
    await save(0, { schemaVersion: 1 }, [artifact]);
    await save(1, { schemaVersion: 1 }, [artifact]);
    await db.exec("RESET ROLE");
    const { rows } = await db.query<{ user_id: string; route: string }>(
      "SELECT * FROM public.era_actions",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: A, route: "/chat" });
  });
  it("an artifact projection failure rolls back the progress update too", async () => {
    await save(-1);
    await expect(
      save(0, { schemaVersion: 1 }, [
        {
          key: "bad",
          action: "not-an-action",
          entity: "shopping_item",
          title: "Milk",
          route: "/chat",
        },
      ]),
    ).rejects.toThrow(/check constraint/);
    expect(
      (
        await db.query<{ version: number }>(
          "SELECT version FROM public.era_runs",
        )
      ).rows[0].version,
    ).toBe(0);
  });
  it("anonymous sessions cannot invoke the privileged function", async () => {
    await db.exec("RESET ROLE; SET ROLE anon");
    await expect(save(-1)).rejects.toThrow(/permission denied/);
  });
});
