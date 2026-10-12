// Isolated PGlite fixture: runs the real SCH-24 + Fitness migrations against
// the schema.sql table shapes. No production database is touched.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import changingWeeks from "./examples/changing-weeks.json";
import upperLower from "./examples/upper-lower.json";
import { FIXTURE_RULES } from "./fixtures";
import { validatePtPlan, type PTPlanV1 } from "./ptPlan";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const atomic = readFileSync("migrations/2026-10-11_atomic-item-create.sql", "utf8");
const fitness = readFileSync("migrations/2026-10-12_fitness-module.sql", "utf8");
const schema = readFileSync("migrations/schema.sql", "utf8");
const tables = ["household_links", "items", "reminder_details", "event_details", "item_subtasks", "item_alerts",
  "item_recurrence_rules", "nfc_tags", "item_prerequisites", "item_flexible_schedules", "item_occurrence_actions", "health_profiles"];
const TZ = "Asia/Beirut";
let db: PGlite;
let n = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped SQL fixture rows
type Row = Record<string, any>;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

async function as(user: string | null) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  if (user) await db.exec("SET ROLE authenticated");
}
async function rpc<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ r: T }>(`SELECT ${sql} AS r`, params);
  return r.rows[0].r;
}
async function rows<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
async function superRows<T = Row>(sql: string, params: unknown[] = []) {
  const who = (await db.query<{ s: string }>("SELECT current_setting('request.jwt.claim.sub',true) s")).rows[0].s || null;
  await db.exec("RESET ROLE");
  const out = await rows<T>(sql, params);
  if (who) await db.exec("SET ROLE authenticated");
  return out;
}

function payload(plan: unknown) {
  const v = validatePtPlan(plan);
  if (!v.ok) throw new Error("fixture invalid");
  return { name: v.plan.name, fingerprint: `fp-${JSON.stringify(plan).length}-${(plan as PTPlanV1).name}`, source_text: "pasted", content: v.plan, issues: v.issues };
}
async function importPlan(plan: unknown = upperLower) {
  return rpc("public.fitness_import_plan($1,$2)", [uuid(), JSON.stringify(payload(plan))]);
}
// Monday of the current Beirut week (activation refuses past weeks).
async function thisWeek(): Promise<string> {
  return (await rows<{ d: string }>(`SELECT to_char(date_trunc('week', now() AT TIME ZONE '${TZ}')::date,'YYYY-MM-DD') d`))[0].d;
}
async function activePlan() {
  const imp = await importPlan();
  const week = await thisWeek();
  const act = await rpc("public.fitness_activate_plan($1,$2,$3::date,$4)", [uuid(), imp.plan.id, week, TZ]);
  return { planId: imp.plan.id as string, week, slots: act.slots as Array<{ id: string; slot_index: number; item_id: string }> };
}
async function start(planId: string, week: string, slotId: string | null, workoutId?: string) {
  return (await rpc("public.fitness_start_session($1)", [JSON.stringify({ id: uuid(), plan_id: planId, slot_id: slotId, workout_id: workoutId, week })])).session;
}
async function logSet(sessionId: string, exerciseId: string, setIndex: number, values: Record<string, unknown> = {}, base: number | null = null) {
  return rpc("public.fitness_log_set($1)", [JSON.stringify({ op_id: uuid(), session_id: sessionId, exercise_id: exerciseId, set_index: setIndex, base_revision: base, ...values })]);
}
async function finish(sessionId: string, localDate: string, at = new Date().toISOString(), op = uuid()) {
  return rpc("public.fitness_finish_session($1)", [JSON.stringify({ op_id: op, session_id: sessionId, finished_at: at, local_date: localDate })]);
}
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
async function xp(user = A) {
  return (await superRows<{ xp: number }>("SELECT coalesce(sum(xp),0)::int xp FROM fitness_reward_events WHERE user_id=$1 AND revoked_at IS NULL", [user]))[0].xp;
}

beforeAll(async () => {
  db = new PGlite();
  const ddl = tables.map((t) => {
    const source = schema.match(new RegExp(`CREATE TABLE public\\.${t} \\([\\s\\S]*?\\n\\);`))?.[0];
    if (!source) throw new Error(t);
    return source.replaceAll("USER-DEFINED", "text").replaceAll("categories ARRAY", "categories text[]").replace(/::[a-z_]+_enum/g, "::text")
      // db-state.json: every child FK to items is ON DELETE CASCADE in production.
      .replaceAll("REFERENCES public.items(id)", "REFERENCES public.items(id) ON DELETE CASCADE");
  }).join("\n");
  await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.catalogue_items(id uuid PRIMARY KEY);
    CREATE TABLE public.health_medications(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    ${ddl}
    -- Present in production (db-state.json), absent from the table snapshot.
    CREATE UNIQUE INDEX ON item_occurrence_actions(item_id, occurrence_date, action_type);
    CREATE UNIQUE INDEX ON item_flexible_schedules(item_id, period_start_date, occurrence_index);
    CREATE FUNCTION public.is_household_partner(p_other_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM household_links WHERE active AND ((owner_user_id=auth.uid() AND partner_user_id=p_other_user_id) OR (partner_user_id=auth.uid() AND owner_user_id=p_other_user_id))) $$;
    CREATE FUNCTION public.health_child_sync_managing_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN SELECT p.managing_user_id INTO NEW.managing_user_id FROM public.health_profiles p WHERE p.id = NEW.profile_id;
        IF NEW.managing_user_id IS NULL THEN RAISE EXCEPTION 'health profile % not found', NEW.profile_id; END IF; RETURN NEW; END $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    ALTER TABLE items ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_items ON items TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
    ALTER TABLE item_occurrence_actions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_actions ON item_occurrence_actions TO authenticated
      USING (EXISTS (SELECT 1 FROM items i WHERE i.id = item_id AND i.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM items i WHERE i.id = item_id AND i.user_id = auth.uid()));
    ALTER TABLE health_profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profiles ON health_profiles TO authenticated USING (managing_user_id=auth.uid()) WITH CHECK (managing_user_id=auth.uid());`);
  await db.exec(atomic);
  await db.exec(fitness);
  await db.exec("GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated");
}, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await as(null);
  await db.exec("TRUNCATE items, household_links, health_profiles, fitness_plans, fitness_operations, fitness_reward_events, fitness_preferences, auth.users CASCADE");
  await db.query("INSERT INTO auth.users VALUES ($1),($2)", [A, B]);
  await as(A);
});

describe("deployment", () => {
  it("re-runs idempotently and refuses to install without SCH-24", async () => {
    await as(null);
    await db.exec(fitness);
    const bare = new PGlite();
    await bare.exec("CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;");
    await expect(bare.exec(fitness)).rejects.toThrow("2026-10-11_atomic-item-create.sql");
    await bare.close();
  });
});

describe("plans", () => {
  it("imports atomically, replays by op id, and rejects a duplicate fingerprint", async () => {
    const op = uuid();
    const body = JSON.stringify(payload(upperLower));
    const first = await rpc("public.fitness_import_plan($1,$2)", [op, body]);
    const again = await rpc("public.fitness_import_plan($1,$2)", [op, body]);
    expect(first.replayed).toBe(false);
    expect(again).toMatchObject({ replayed: true, plan: { id: first.plan.id } });
    expect(first.plan.status).toBe("ready");
    expect(first.version).toMatchObject({ slot_count: 4, training_target: 3 });
    await expect(rpc("public.fitness_import_plan($1,$2)", [uuid(), body])).rejects.toThrow(/fitness_plans_fingerprint_key/);
    expect(await rows("SELECT id FROM items")).toHaveLength(0);   // import never creates Schedule items
  });

  it("keeps a review draft out of activation until its issues are acknowledged", async () => {
    const imp = await importPlan(changingWeeks);
    expect(imp.plan.status).toBe("draft");
    const week = await thisWeek();
    await expect(rpc("public.fitness_activate_plan($1,$2,$3::date,$4)", [uuid(), imp.plan.id, week, TZ])).rejects.toThrow("Resolve review issues first");
    const ids = (imp.version.issues as Array<{ id: string; blocking: boolean }>).filter((i) => i.blocking).map((i) => i.id);
    const rev = await rpc("public.fitness_review_plan($1,$2,$3)", [uuid(), imp.plan.id, ids]);
    expect(rev.plan.status).toBe("ready");
    await rpc("public.fitness_activate_plan($1,$2,$3::date,$4)", [uuid(), imp.plan.id, week, TZ]);
  });

  it("activates one weekly flexible routine per workout_order entry, bounded by duration", async () => {
    const { planId, week, slots } = await activePlan();
    expect(slots.map((s) => s.slot_index)).toEqual([0, 1, 2, 3]);
    const items = await rows<{ title: string; is_public: boolean; rrule: string; is_flexible: boolean; flexible_period: string; end_until: string; start_anchor: string }>(
      `SELECT i.title, i.is_public, r.rrule, r.is_flexible, r.flexible_period, r.end_until::text, r.start_anchor::text
         FROM items i JOIN item_recurrence_rules r ON r.item_id = i.id JOIN fitness_plan_slots s ON s.item_id = i.id ORDER BY s.slot_index`);
    expect(items.map((i) => i.title)).toEqual(["Upper", "Lower", "Upper · 2", "Mobility"]);
    expect(items.every((i) => !i.is_public && i.is_flexible && i.flexible_period === "weekly" && i.rrule === "FREQ=WEEKLY")).toBe(true);
    const bound = await rows<{ ok: boolean }>(`SELECT ($1::date + 56 - interval '1 second') AT TIME ZONE '${TZ}' = $2::timestamptz ok`, [week, items[0].end_until]);
    expect(bound[0].ok).toBe(true);
    await expect(rpc("public.fitness_activate_plan($1,$2,$3::date,$4)", [uuid(), planId, week, TZ])).rejects.toThrow("Plan is not ready");
    const second = await importPlan({ ...upperLower, name: "Other plan" });
    await rpc("public.fitness_review_plan($1,$2,$3)", [uuid(), second.plan.id, []]);
    await expect(rpc("public.fitness_activate_plan($1,$2,$3::date,$4)", [uuid(), second.plan.id, week, TZ])).rejects.toThrow(/fitness_plans_one_live_key/);
  });

  it("undoes an untouched activation, and pause/resume/archive hide and restore Schedule items", async () => {
    const { planId } = await activePlan();
    const undo = await rpc("public.fitness_deactivate_plan($1,$2)", [uuid(), planId]);
    expect(undo.plan.status).toBe("ready");
    expect(await rows("SELECT id FROM items")).toHaveLength(0);

    const week = await thisWeek();
    await rpc("public.fitness_activate_plan($1,$2,$3::date,$4)", [uuid(), planId, week, TZ]);
    await rpc("public.fitness_set_plan_state($1,$2,'pause',$3::date)", [uuid(), planId, today()]);
    expect((await rows<{ n: number }>("SELECT count(*)::int n FROM items WHERE archived_at IS NULL"))[0].n).toBe(0);
    await rpc("public.fitness_set_plan_state($1,$2,'resume',$3::date)", [uuid(), planId, today()]);
    expect((await rows<{ n: number }>("SELECT count(*)::int n FROM items WHERE archived_at IS NULL"))[0].n).toBe(4);
    const arch = await rpc("public.fitness_set_plan_state($1,$2,'archive',$3::date)", [uuid(), planId, today()]);
    expect(arch.plan).toMatchObject({ status: "archived", archived_from: "active" });
    const restored = await rpc("public.fitness_set_plan_state($1,$2,'restore',$3::date)", [uuid(), planId, today()]);
    expect(restored.plan.status).toBe("active");
    expect((await rows("SELECT id FROM fitness_plan_pauses WHERE resumed_on IS NULL"))).toHaveLength(0);
  });

  it("versions future sessions without rewriting history, keeping slot identity", async () => {
    const { planId, week, slots } = await activePlan();
    const s = await start(planId, week, slots[0].id);
    const v2 = JSON.parse(JSON.stringify(upperLower)) as PTPlanV1;
    v2.workouts[0].name = "Upper A";
    v2.workouts[0].exercises[1].sets[1].reps_max = 10;
    const p = { ...payload(v2), fingerprint: "fp-v2" };
    const added = await rpc("public.fitness_add_plan_version($1,$2,$3)", [uuid(), planId, JSON.stringify(p)]);
    expect(added.plan.current_version).toBe(2);
    expect((await rows<{ title: string }>("SELECT title FROM items ORDER BY title")).map((r) => r.title)).toContain("Upper A · 2");
    const kept = await rows<{ v: number; reps: number }>("SELECT version v, (snapshot->'exercises'->1->'sets'->1->>'reps_max')::int reps FROM fitness_sessions WHERE id=$1", [s.id]);
    expect(kept[0]).toEqual({ v: 1, reps: 12 });
    const fewer = { ...v2, workout_order: ["upper", "lower"] };
    await expect(rpc("public.fitness_add_plan_version($1,$2,$3)", [uuid(), planId, JSON.stringify({ ...payload(fewer), fingerprint: "fp-v3" })])).rejects.toThrow("Weekly slot count changed");
  });
});

describe("sessions, Schedule and rewards", () => {
  it("finishes once across Fitness and Schedule, awards once, and Undo reverts both", async () => {
    const { planId, week, slots } = await activePlan();
    const s = await start(planId, week, slots[0].id);
    await expect(start(planId, week, slots[1].id)).rejects.toThrow(/fitness_sessions_one_open_key/);
    await logSet(s.id, "bench-press", 1, { reps: 10, load_kg: 60 });
    const op = uuid();
    const done = await finish(s.id, today(), undefined, op);
    const replay = await finish(s.id, today(), undefined, op);
    expect(replay.replayed).toBe(true);
    expect(done.session.status).toBe("completed");
    const actions = await rows<{ metadata_json: { fitness_session_id: string } }>("SELECT metadata_json FROM item_occurrence_actions WHERE action_type='completed'");
    expect(actions).toHaveLength(1);
    expect(actions[0].metadata_json.fitness_session_id).toBe(s.id);
    expect(await xp()).toBe(100);
    expect((done.rewards.events as Array<{ source_key: string }>).map((e) => e.source_key)).toEqual(
      expect.arrayContaining([`train:${today()}`, "badge:first-workout"]));
    expect(await superRows("SELECT id FROM fitness_sessions WHERE source='schedule'")).toHaveLength(0);   // mirror stayed silent

    await rpc("public.fitness_mark_celebrated($1)", [["badge:first-workout"]]);
    const undo = await rpc("public.fitness_reopen_session($1)", [JSON.stringify({ op_id: uuid(), session_id: s.id })]);
    expect(undo.session.status).toBe("in_progress");
    expect(await rows("SELECT id FROM item_occurrence_actions")).toHaveLength(0);
    expect(await xp()).toBe(0);
    await finish(s.id, today());
    const badge = await superRows<{ celebrated_at: string | null; revoked_at: string | null }>(
      "SELECT celebrated_at, revoked_at FROM fitness_reward_events WHERE source_key='badge:first-workout'");
    expect(badge[0].revoked_at).toBeNull();
    expect(badge[0].celebrated_at).not.toBeNull();     // re-grant never replays the reveal
  });

  it("caps training XP at one award per local day and keeps recovery separate", async () => {
    const { planId, week, slots } = await activePlan();
    for (const slot of [slots[0], slots[1]]) {
      const s = await start(planId, week, slot.id);
      await finish(s.id, today());
    }
    const m = await start(planId, week, slots[3].id);
    await finish(m.id, today());
    expect(await xp()).toBe(100 + 25 + 50);   // training day + recovery day + recovery quest
  });

  it("awards weekly quests for the plan target and a fully logged workout", async () => {
    const { planId, week, slots } = await activePlan();
    const days = [0, 1, 2].map((d) => new Date(Date.parse(week + "T09:00:00Z") + d * 86400_000));
    for (const [i, slot] of [slots[0], slots[1], slots[2]].entries()) {
      const s = await start(planId, week, slot.id);
      if (i === 1) {
        const snap = s.snapshot as PTPlanV1["workouts"][number];
        for (const e of snap.exercises) for (const [si] of e.sets.entries()) await logSet(s.id, e.id, si, { reps: 5 });
      }
      await finish(s.id, days[i].toISOString().slice(0, 10), days[i].toISOString());
    }
    const keys = (await superRows<{ source_key: string }>("SELECT source_key FROM fitness_reward_events WHERE revoked_at IS NULL")).map((r) => r.source_key);
    expect(keys).toEqual(expect.arrayContaining([`quest-train:${week}`, `quest-log:${week}`]));
    expect(await xp()).toBe(3 * 100 + 150 + 50);
  });

  it("creates a minimal session from a Schedule completion, enriches it, and reverts on uncomplete", async () => {
    const { week, slots } = await activePlan();
    const at = new Date(Date.parse(week + "T10:00:00Z")).toISOString();
    await db.query("INSERT INTO item_occurrence_actions(item_id, occurrence_date, action_type, created_by) VALUES ($1,$2,'completed',$3)", [slots[1].item_id, at, A]);
    const [s] = await rows<{ id: string; source: string; has_sets: boolean; status: string; period_start: string }>("SELECT id, source, has_sets, status, period_start::text FROM fitness_sessions");
    expect(s).toMatchObject({ source: "schedule", has_sets: false, status: "completed", period_start: week });
    expect(await rows("SELECT id FROM fitness_set_logs")).toHaveLength(0);   // no invented sets
    expect(await xp()).toBe(100);

    await db.query("INSERT INTO item_occurrence_actions(item_id, occurrence_date, action_type, created_by) VALUES ($1,$2,'skipped',$3)", [slots[2].item_id, at, A]);
    expect(await rows("SELECT id FROM fitness_sessions")).toHaveLength(1);   // skip earns nothing

    await db.query("DELETE FROM item_occurrence_actions WHERE item_id=$1", [slots[1].item_id]);
    expect(await rows("SELECT id FROM fitness_sessions")).toHaveLength(0);
    expect(await xp()).toBe(0);

    await db.query("INSERT INTO item_occurrence_actions(item_id, occurrence_date, action_type, created_by) VALUES ($1,$2,'completed',$3)", [slots[1].item_id, at, A]);
    const [again] = await rows<{ id: string }>("SELECT id FROM fitness_sessions");
    await logSet(again.id, "squat", 0, { reps: 5, load_kg: 100 });
    const [enriched] = await rows<{ has_sets: boolean; n: number }>("SELECT has_sets, (SELECT count(*)::int FROM fitness_sessions) n FROM fitness_sessions WHERE id=$1", [again.id]);
    expect(enriched).toEqual({ has_sets: true, n: 1 });
    await db.query("DELETE FROM item_occurrence_actions WHERE item_id=$1", [slots[1].item_id]);
    expect((await rows<{ status: string }>("SELECT status FROM fitness_sessions WHERE id=$1", [again.id]))[0].status).toBe("in_progress");
  });

  it("completes an open session when Schedule completes its slot", async () => {
    const { planId, week, slots } = await activePlan();
    const s = await start(planId, week, slots[0].id);
    await db.query("INSERT INTO item_occurrence_actions(item_id, occurrence_date, action_type, created_by) VALUES ($1,now(),'completed',$2)", [slots[0].item_id, A]);
    expect((await rows<{ status: string; source: string }>("SELECT status, source FROM fitness_sessions WHERE id=$1", [s.id]))[0]).toEqual({ status: "completed", source: "fitness" });
    const again = await finish(s.id, today());
    expect(again.session.status).toBe("completed");
    expect(await xp()).toBe(100);
  });

  it("returns a reviewable conflict instead of overwriting another device's set", async () => {
    const { planId, week, slots } = await activePlan();
    const s = await start(planId, week, slots[0].id);
    const first = await logSet(s.id, "bench-press", 1, { reps: 10 });
    await logSet(s.id, "bench-press", 1, { reps: 11 }, first.set.revision);
    await expect(logSet(s.id, "bench-press", 1, { reps: 12 }, first.set.revision)).rejects.toThrow("Set changed on another device");
    await expect(logSet(s.id, "bench-press", 1, { reps: 12 })).rejects.toThrow("Set changed on another device");
    expect((await rows<{ reps: number }>("SELECT reps FROM fitness_set_logs"))[0].reps).toBe(11);
  });

  it("detects improved records by exercise, equipment and load type, and revokes them with the session", async () => {
    const { planId, week, slots } = await activePlan();
    const s1 = await start(planId, week, slots[0].id);
    await logSet(s1.id, "bench-press", 1, { reps: 8, load_kg: 60 });
    await logSet(s1.id, "push-up", 0, { reps: 15 });
    await finish(s1.id, today(), new Date(Date.now() - 3600_000).toISOString());
    const s2 = await start(planId, week, slots[2].id);
    await logSet(s2.id, "bench-press", 1, { reps: 8, load_kg: 62.5 });
    await logSet(s2.id, "push-up", 0, { reps: 12 });
    await finish(s2.id, today());
    const prev = (await rpc("public.get_fitness_bundle()")).previous_sets as Array<{ workout_id: string; session_id: string }>;
    expect(new Set(prev.map((p) => p.session_id))).toEqual(new Set([s2.id]));   // latest "upper" session only
    const recs = await superRows<{ payload: { exercise: string; metric: string; value: number; previous: number } }>(
      "SELECT payload FROM fitness_reward_events WHERE kind='record' AND revoked_at IS NULL");
    expect(recs.map((r) => r.payload)).toEqual([expect.objectContaining({ exercise: "Bench press", metric: "load", value: 62.5, previous: 60 })]);
    expect(await superRows("SELECT id FROM fitness_reward_events WHERE source_key='badge:first-record' AND revoked_at IS NULL")).toHaveLength(1);
    expect(await xp()).toBe(100);   // records earn a reveal, never extra XP

    await rpc("public.fitness_set_session_deleted($1)", [JSON.stringify({ op_id: uuid(), session_id: s2.id, deleted: true })]);
    expect(await superRows("SELECT id FROM fitness_reward_events WHERE kind='record' AND revoked_at IS NULL")).toHaveLength(0);
    expect(await rows("SELECT id FROM item_occurrence_actions")).toHaveLength(1);
    await rpc("public.fitness_set_session_deleted($1)", [JSON.stringify({ op_id: uuid(), session_id: s2.id, deleted: false })]);
    expect(await rows("SELECT id FROM item_occurrence_actions")).toHaveLength(2);
  });

  it("maps Schedule occurrences to plan-timezone weeks across the October DST change", async () => {
    // Beirut leaves DST on Sun 2026-10-25. 21:30Z that night is Sunday 23:30
    // local (still week of the 19th); 22:30Z is Monday 00:30 (week of the 26th).
    const week = await rows<{ a: string; b: string; c: string }>(`SELECT
      date_trunc('week', public.fitness_action_local_date('2026-10-25T21:30:00Z', NULL, '${TZ}'))::date::text a,
      date_trunc('week', public.fitness_action_local_date('2026-10-25T22:30:00Z', NULL, '${TZ}'))::date::text b,
      public.fitness_action_local_date('2026-10-25T22:30:00Z', '{"planned_for":"2026-10-25"}', '${TZ}')::text c`);
    expect(week[0]).toEqual({ a: "2026-10-19", b: "2026-10-26", c: "2026-10-25" });
  });
});

describe("privacy", () => {
  it("keeps plans, sessions and measurements private; shares only rank, badges and the week when opted in", async () => {
    const { planId, week, slots } = await activePlan();
    const s = await start(planId, week, slots[0].id);
    await finish(s.id, today());
    const [profile] = await rows<{ id: string }>("INSERT INTO health_profiles(managing_user_id, user_id, name, shared_with_household) VALUES ($1,$1,'A',true) RETURNING id", [A]);
    await db.query("INSERT INTO health_measurements(profile_id, managing_user_id, measured_at, weight_kg) VALUES ($1,$2,now(),80)", [profile.id, A]);
    await as(null);
    await db.query("INSERT INTO household_links(code, owner_user_id, partner_user_id) VALUES ('fixture',$1,$2)", [A, B]);

    await as(B);
    for (const t of ["fitness_plans", "fitness_sessions", "fitness_set_logs", "fitness_reward_events", "health_measurements"])
      expect(await rows(`SELECT * FROM ${t}`)).toHaveLength(0);
    await expect(db.query("INSERT INTO fitness_reward_events(user_id, source_key, kind, xp) VALUES ($1,'x','xp',1000)", [B])).rejects.toThrow(/row-level security/);
    expect((await rpc("public.get_fitness_bundle()")).partner).toBeNull();

    await as(A);
    await db.query("INSERT INTO fitness_preferences(user_id, share_summary) VALUES ($1,true)", [A]);
    await as(B);
    const shared = (await rpc("public.get_fitness_bundle()")).partner;
    expect(Object.keys(shared).sort()).toEqual(["badges", "rank", "user_id", "week"]);
    expect(shared).toMatchObject({ rank: "initiate", badges: ["first-workout"], week: { done: 1, target: 3 } });

    await as(A);
    await db.query("UPDATE fitness_preferences SET share_summary=false WHERE user_id=$1", [A]);
    await as(B);
    expect((await rpc("public.get_fitness_bundle()")).partner).toBeNull();
  });

  it("returns the owner's bundle with the open workout and Healthcare self-profile link only", async () => {
    const { planId, week, slots } = await activePlan();
    await start(planId, week, slots[0].id);
    let bundle = await rpc("public.get_fitness_bundle()");
    expect(bundle.health_profile).toBeNull();     // opening Fitness never creates one
    expect(bundle.open_session.status).toBe("in_progress");
    expect(bundle.live_plan.slots).toHaveLength(4);
    expect(bundle.rules).toEqual(FIXTURE_RULES);   // SQL fitness_rules() is the source; fixtures mirror it
    expect(bundle.previous_sets).toEqual([]);
    await db.query("INSERT INTO health_profiles(managing_user_id, user_id, name) VALUES ($1,$1,'Me')", [A]);
    bundle = await rpc("public.get_fitness_bundle()");
    expect(bundle.health_profile.name).toBe("Me");
  });
});
