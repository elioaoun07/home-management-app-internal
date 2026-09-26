import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ActivityPage } from "./types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const LINK = "44444444-4444-4444-8444-444444444444";
const TX = "55555555-5555-4555-8555-555555555555";
const THREAD = "66666666-6666-4666-8666-666666666666";
const CHILD = "77777777-7777-4777-8777-777777777777";
const migration = readFileSync(
  "migrations/2026-09-26_household-activity-log.sql",
  "utf8",
);
const schema = readFileSync("migrations/schema.sql", "utf8");
let db: PGlite;

// Build an isolated, empty source-schema fixture from the checked-in column
// names/types. Source-business constraints/RLS are not simulated: this suite
// exercises the actual new migration, triggers, ACL and RPC under real PG.
// No connection string, environment credential or network is used.
function sourceFixture() {
  const tables: string[] = [];
  for (const match of schema.matchAll(
    /CREATE TABLE public\.(\w+) \(\r?\n([\s\S]*?)\r?\n\);/g,
  )) {
    if (["household_activity", "activity_log_sources"].includes(match[1]))
      continue;
    const columns = [
      ...match[2].matchAll(
        /^  (\w+) (timestamp with time zone|time without time zone|double precision|uuid|text|numeric|integer|bigint|boolean|jsonb|json|date|ARRAY|USER-DEFINED)(.*)$/gm,
      ),
    ].map((column) => {
      const [, name, rawType, rest] = column;
      const type =
        rawType === "USER-DEFINED"
          ? "text"
          : rawType === "ARRAY"
            ? rest.includes("uuid[]")
              ? "uuid[]"
              : "text[]"
            : rawType;
      const defaultValue =
        name === "id" && type === "uuid"
          ? " DEFAULT gen_random_uuid()"
          : rest.includes("now()")
            ? " DEFAULT now()"
            : "";
      return `"${name}" ${type}${defaultValue}`;
    });
    const primaryKey = match[2].match(/PRIMARY KEY \(([^)]+)\)/)?.[1];
    if (primaryKey) columns.push(`PRIMARY KEY (${primaryKey})`);
    tables.push(`CREATE TABLE public.${match[1]} (${columns.join(",")});`);
  }
  return tables.join("\n");
}

async function identity(id: string | null) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    id ?? "",
  ]);
}
async function insert(table: string, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  // Table/key identifiers originate only in these static test fixtures.
  await db.query(
    `INSERT INTO public.${table} (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(row),
  );
}
async function read(
  viewer = A,
  options: {
    module?: string;
    feature?: string;
    actor?: string;
    before?: string | null;
    limit?: number;
    from?: string;
    until?: string;
  } = {},
) {
  await identity(viewer);
  await db.exec("SET ROLE authenticated");
  try {
    const result = await db.query<{ result: ActivityPage }>(
      "SELECT public.get_household_activity($1,$2,$3,$4,$5,$6,$7) AS result",
      [
        options.module ?? null,
        options.feature ?? null,
        options.actor ?? null,
        options.from ?? null,
        options.until ?? null,
        options.before ?? null,
        options.limit ?? 50,
      ],
    );
    return result.rows[0].result;
  } finally {
    await db.exec("RESET ROLE");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    ${sourceFixture()}`);
  await db.exec(migration);
}, 30_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("RESET ROLE");
  const { rows } = await db.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'activity_log_sources'",
  );
  await db.exec(
    `TRUNCATE ${rows.map((r) => `public.${r.tablename}`).join(",")} RESTART IDENTITY CASCADE`,
  );
  await insert("household_links", {
    id: LINK,
    owner_user_id: A,
    partner_user_id: B,
    active: true,
  });
  await identity(A);
});

describe("household activity recording and authorization", () => {
  it("skips missing optional sources and captures them after installation and reapplication", async () => {
    await db.exec("DROP TABLE guest_feedback");
    try {
      await db.exec(migration);
      expect(
        (await read()).sources.some(
          (source) => source.table === "guest_feedback",
        ),
      ).toBe(false);
      await insert("transactions", { user_id: A, description: "Still works" });
      expect((await read()).events).toHaveLength(1);
    } finally {
      const create = sourceFixture()
        .split("\n")
        .find((statement) =>
          statement.startsWith("CREATE TABLE public.guest_feedback "),
        );
      if (!create) throw new Error("Missing guest feedback fixture");
      await db.exec(create);
      await db.exec(migration);
    }
    expect(
      (await read()).sources.some(
        (source) => source.table === "guest_feedback",
      ),
    ).toBe(true);
  });

  it("rejects incompatible source keys atomically during migration", async () => {
    await db.exec(
      "ALTER TABLE guest_feedback RENAME COLUMN tag_id TO old_tag_id",
    );
    try {
      await expect(db.exec(migration)).rejects.toThrow(
        "Incompatible activity source: guest_feedback",
      );
    } finally {
      await db.exec("ROLLBACK");
      await db.exec(
        "ALTER TABLE guest_feedback RENAME COLUMN old_tag_id TO tag_id",
      );
    }
    await insert("guest_portal_tags", { id: TX, user_id: A });
    await insert("guest_feedback", { tag_id: TX });
    expect((await read(A, { feature: "feedback" })).events).toHaveLength(1);
  });

  it("preserves legitimate unattached categories and legacy messages as personal history", async () => {
    await insert("user_categories", {
      user_id: A,
      name: "Unattached category",
      account_id: null,
    });
    await insert("hub_messages", {
      sender_user_id: A,
      household_id: LINK,
      content: "Legacy personal message",
      thread_id: null,
    });
    expect((await read(A)).events).toHaveLength(2);
    expect((await read(B)).events).toHaveLength(0);
  });

  it("registers only real schema identifiers, including child primary keys", async () => {
    const { rows } = await db.query<{
      table_name: string;
      id_column: string;
      parent_key: string | null;
    }>("SELECT * FROM activity_log_sources");
    for (const source of rows) {
      const columns = await db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [source.table_name],
      );
      const names = columns.rows.map((c) => c.column_name);
      expect(names, source.table_name).toContain(source.id_column);
      if (source.parent_key)
        expect(names, source.table_name).toContain(source.parent_key);
    }
    expect((await read()).sources.length).toBe(rows.length);
  });

  it("logs manual writes, edits and deletes without changing the source values", async () => {
    await insert("transactions", {
      id: TX,
      user_id: A,
      amount: 25,
      description: "Groceries",
      is_private: false,
      is_draft: false,
    });
    await db.query("UPDATE transactions SET amount=30 WHERE id=$1", [TX]);
    expect(
      (
        await db.query<{ amount: string }>(
          "SELECT amount FROM transactions WHERE id=$1",
          [TX],
        )
      ).rows[0].amount,
    ).toBe("30");
    await db.query("DELETE FROM transactions WHERE id=$1", [TX]);
    const feed = await read(B);
    expect(feed.events.map((e) => e.action)).toEqual([
      "deleted",
      "updated",
      "created",
    ]);
    expect(feed.events[1].changed_fields).toEqual(["amount"]);
    expect(feed.events.every((e) => e.available === false)).toBe(true);
  });

  it("records every registered source through its actual ownership and parent columns", async () => {
    const { rows: sources } = await db.query<{
      table_name: string;
      id_column: string;
      parent_table: string | null;
      parent_key: string | null;
    }>("SELECT * FROM activity_log_sources ORDER BY table_name");
    const inserted = new Map<string, string>();
    const pending = [...sources];
    while (pending.length) {
      const index = pending.findIndex(
        (source) => !source.parent_table || inserted.has(source.parent_table),
      );
      expect(index, "registry must be acyclic").toBeGreaterThanOrEqual(0);
      const source = pending.splice(index, 1)[0];
      const columns = (
        await db.query<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
          [source.table_name],
        )
      ).rows.map((c) => c.column_name);
      const id =
        source.id_column === "user_id"
          ? A
          : `88888888-8888-4888-8888-${String(inserted.size + 1).padStart(12, "0")}`;
      const row: Record<string, unknown> = { [source.id_column]: id };
      for (const ownerKey of [
        "user_id",
        "managing_user_id",
        "created_by",
        "sender_user_id",
      ])
        if (columns.includes(ownerKey)) row[ownerKey] = A;
      if (source.parent_table && source.parent_key)
        row[source.parent_key] = inserted.get(source.parent_table);
      if (columns.includes("household_id")) row.household_id = LINK;
      await insert(source.table_name, row);
      inserted.set(source.table_name, String(row[source.id_column]));
    }
    const activity = await read(A, { limit: 100 });
    expect(new Set(activity.events.map((event) => event.source_table))).toEqual(
      new Set(sources.map((source) => source.table_name)),
    );
  });

  it("uses inclusive from and exclusive until boundaries with local UTC offsets", async () => {
    await insert("transactions", { id: TX, user_id: A, is_private: false });
    await db.exec(
      "UPDATE household_activity SET occurred_at='2026-09-25T21:00:00Z'",
    );
    expect(
      (
        await read(A, {
          from: "2026-09-26T00:00:00+03:00",
          until: "2026-09-27T00:00:00+03:00",
        })
      ).events,
    ).toHaveLength(1);
    expect(
      (await read(A, { until: "2026-09-26T00:00:00+03:00" })).events,
    ).toHaveLength(0);
  });

  it("records guest activity for its host without retaining guest data or portal credentials", async () => {
    await insert("guest_portal_tags", {
      id: TX,
      user_id: A,
      tag_slug: "private-tag",
      wifi_password: "WIFI_SECRET",
      label: "Private portal label",
    });
    await identity(null);
    await insert("guest_chat_messages", {
      tag_id: TX,
      message: "GUEST_SECRET",
      guest_name: "GUEST_NAME",
    });
    const own = await read(A, { module: "guests" });
    expect(own.events.map((event) => event.title)).toEqual([
      "Guest message",
      "Guest portal",
    ]);
    expect(own.events[0].actor_name).toBe("Guest portal");
    expect((await read(B, { module: "guests" })).events).toHaveLength(0);
    const ledger = JSON.stringify(
      (await db.query("SELECT * FROM household_activity")).rows,
    );
    for (const secret of [
      "WIFI_SECRET",
      "GUEST_SECRET",
      "GUEST_NAME",
      "private-tag",
      "Private portal label",
    ])
      expect(ledger).not.toContain(secret);
  });

  it("never exposes partner-private transactions, even through paging or filters", async () => {
    await insert("transactions", {
      user_id: A,
      description: "PRIVATE_SECRET",
      is_private: true,
    });
    await insert("transactions", {
      user_id: A,
      description: "Shared groceries",
      is_private: false,
    });
    expect((await read(A)).events).toHaveLength(2);
    const partner = await read(B, {
      module: "budget",
      feature: "transactions",
      limit: 1,
    });
    expect(partner.events.map((e) => e.title)).toEqual(["Shared groceries"]);
    expect(partner.next_cursor).toBeNull();
    expect(JSON.stringify(partner)).not.toContain("PRIVATE_SECRET");
    expect((await read(C)).events).toHaveLength(0);
  });

  it("does not record phantom creates for ignored or updated upserts", async () => {
    await insert("transactions", {
      id: TX,
      user_id: A,
      description: "Original",
      is_private: false,
    });
    await db.query(
      "INSERT INTO transactions (id,user_id,description,is_private) VALUES ($1,$2,'Ignored',false) ON CONFLICT (id) DO NOTHING",
      [TX, A],
    );
    expect((await read()).events.map((event) => event.action)).toEqual([
      "created",
    ]);
    await db.query(
      "INSERT INTO transactions (id,user_id,description,is_private) VALUES ($1,$2,'Changed',false) ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description",
      [TX, A],
    );
    expect(
      (await read()).events.map((event) => [event.action, event.title]),
    ).toEqual([
      ["updated", "Changed"],
      ["created", "Original"],
    ]);
  });

  it("revokes old public history when made private, including after physical deletion", async () => {
    await insert("transactions", {
      id: TX,
      user_id: A,
      description: "Now private",
      is_private: false,
    });
    expect((await read(B)).events).toHaveLength(1);
    await identity(A);
    await db.query("UPDATE transactions SET is_private=true WHERE id=$1", [TX]);
    expect((await read(B)).events).toHaveLength(0);
    await db.query("DELETE FROM transactions WHERE id=$1", [TX]);
    expect((await read(B)).events).toHaveLength(0);
    expect((await read(A)).events).toHaveLength(3);
  });

  it("does not publish previously private snapshots when later shared", async () => {
    await insert("transactions", {
      id: TX,
      user_id: A,
      description: "Old secret",
      is_private: true,
    });
    await db.query(
      "UPDATE transactions SET description='Now shared',is_private=false WHERE id=$1",
      [TX],
    );
    const partner = await read(B);
    expect(partner.events.map((e) => e.title)).toEqual(["Now shared"]);
  });

  it("applies chat-thread privacy and hidden-for rules to every historical message", async () => {
    await insert("hub_chat_threads", {
      id: THREAD,
      household_id: LINK,
      created_by: A,
      title: "Home",
      is_private: false,
      purpose: "general",
    });
    await insert("hub_messages", {
      id: CHILD,
      thread_id: THREAD,
      sender_user_id: B,
      household_id: LINK,
      content: "Hello",
    });
    expect((await read(B, { feature: "messages" })).events[0].action).toBe(
      "sent",
    );
    await identity(A);
    await db.query("UPDATE hub_messages SET hidden_for=$1 WHERE id=$2", [
      [B],
      CHILD,
    ]);
    expect((await read(B, { feature: "messages" })).events).toHaveLength(0);
    await db.query("UPDATE hub_chat_threads SET is_private=true WHERE id=$1", [
      THREAD,
    ]);
    expect((await read(B)).events).toHaveLength(0);
    expect(
      (await read(A, { feature: "messages" })).events.length,
    ).toBeGreaterThan(0);
  });

  it("handles reminder details and occurrence actions through the item's sharing rule", async () => {
    await insert("items", {
      id: TX,
      user_id: A,
      title: "Dentist",
      is_public: false,
      responsible_user_id: B,
    });
    await insert("reminder_details", {
      item_id: TX,
      due_at: "2026-09-27T07:00:00Z",
    });
    await identity(B);
    await insert("item_occurrence_actions", {
      item_id: TX,
      action_type: "completed",
      created_by: B,
    });
    const partner = await read(B, { module: "schedule" });
    expect(partner.events.map((e) => e.action)).toEqual([
      "completed",
      "created",
      "created",
    ]);
    expect(partner.events[0].actor_id).toBe(B);
    await db.query("UPDATE items SET responsible_user_id=$1 WHERE id=$2", [
      A,
      TX,
    ]);
    expect((await read(B)).events).toHaveLength(0);
  });

  it("rechecks parent trip/health privacy and keeps Outfits personal", async () => {
    await insert("trips", {
      id: TX,
      user_id: A,
      name: "Trip",
      scope: "household",
    });
    await insert("trip_packing_items", {
      trip_id: TX,
      user_id: B,
      name: "Passport",
    });
    await insert("health_profiles", {
      id: THREAD,
      managing_user_id: A,
      name: "Sensitive name",
      shared_with_household: true,
    });
    await insert("health_conditions", {
      profile_id: THREAD,
      managing_user_id: A,
      title: "Sensitive diagnosis",
      notes: "SECRET_MEDICAL_NOTES",
    });
    await insert("wardrobe_items", { user_id: A, name: "Personal garment" });
    const partner = await read(B);
    expect(
      partner.events.filter((e) => e.module === "healthcare"),
    ).toHaveLength(2);
    expect(JSON.stringify(partner)).not.toMatch(
      /Sensitive|SECRET_MEDICAL|Personal garment/,
    );
    await identity(A);
    await db.query("UPDATE trips SET scope='solo' WHERE id=$1", [TX]);
    await db.query(
      "UPDATE health_profiles SET shared_with_household=false WHERE id=$1",
      [THREAD],
    );
    expect((await read(B)).events).toHaveLength(0);
  });

  it("revokes access on unlink and does not give a new partner old snapshots", async () => {
    await insert("transactions", {
      user_id: A,
      description: "Old household",
      is_private: false,
    });
    expect((await read(B)).events).toHaveLength(1);
    await db.exec("UPDATE household_links SET active=false");
    expect((await read(B)).events).toHaveLength(0);
    await insert("household_links", {
      owner_user_id: A,
      partner_user_id: C,
      active: true,
    });
    expect((await read(C)).events).toHaveLength(0);
    expect((await read(A)).events).toHaveLength(1);
  });

  it("records system actions honestly and rolls events back with failed writes", async () => {
    await identity(null);
    await insert("transactions", {
      user_id: A,
      description: "Scheduled",
      is_private: false,
    });
    expect((await read(A, { actor: "system" })).events[0].actor_name).toBe(
      "System",
    );
    await identity(A);
    await db.exec("BEGIN");
    await insert("transactions", {
      user_id: A,
      description: "Rolled back",
      is_private: false,
    });
    await db.exec("ROLLBACK");
    expect((await read(A)).events).toHaveLength(1);
  });

  it("ignores timestamp-only writes and provides stable non-overlapping cursors", async () => {
    for (let i = 0; i < 5; i++)
      await insert("items", {
        user_id: A,
        title: `Task ${i}`,
        is_public: true,
      });
    await db.exec("UPDATE items SET updated_at=clock_timestamp()");
    const first = await read(A, { limit: 2 });
    await insert("items", { user_id: A, title: "New", is_public: true });
    const second = await read(A, { limit: 2, before: first.next_cursor });
    const third = await read(A, { limit: 2, before: second.next_cursor });
    expect(
      [...first.events, ...second.events, ...third.events].map((e) => e.title),
    ).toEqual(["Task 4", "Task 3", "Task 2", "Task 1", "Task 0"]);
    expect(third.next_cursor).toBeNull();
  });

  it("denies raw ledger/config access, helper execution, and unauthenticated RPCs", async () => {
    await db.exec("SET ROLE authenticated");
    await expect(db.exec("SELECT * FROM household_activity")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.exec("INSERT INTO activity_log_sources (table_name) VALUES ('evil')"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("SELECT activity_log_current('transactions',$1)", [TX]),
    ).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
    await identity(null);
    await expect(db.exec("SELECT get_household_activity()")).rejects.toThrow(
      /Unauthorized/,
    );
    await db.exec("SET ROLE anon");
    await expect(db.exec("SELECT get_household_activity()")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("can be reapplied without deleting history or duplicating triggers", async () => {
    await insert("transactions", {
      user_id: A,
      description: "Before",
      is_private: false,
    });
    await db.exec(migration);
    await insert("transactions", {
      user_id: A,
      description: "After",
      is_private: false,
    });
    expect((await read(A)).events.map((e) => e.title)).toEqual([
      "After",
      "Before",
    ]);
  });
});
