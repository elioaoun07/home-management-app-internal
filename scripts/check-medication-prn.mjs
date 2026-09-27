import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const stubSchema = `
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT '11111111-1111-4111-8111-111111111111'::uuid
    $$;
    CREATE TABLE public.health_medications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL,
      managing_user_id uuid NOT NULL, name text NOT NULL, dosage text, mode text NOT NULL,
      food_timing text NOT NULL, dose_times text[] NOT NULL DEFAULT '{}', timezone text NOT NULL,
      starts_at timestamptz NOT NULL, ends_at timestamptz, min_hours_between numeric,
      max_per_day integer, notes text, updated_at timestamptz DEFAULT now(), deleted_at timestamptz
    );
    CREATE TABLE public.health_medication_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), medication_id uuid NOT NULL,
      managing_user_id uuid NOT NULL, scheduled_at timestamptz, taken_at timestamptz NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE UNIQUE INDEX health_medication_logs_course_unique
      ON public.health_medication_logs (medication_id, scheduled_at)
      WHERE scheduled_at IS NOT NULL;
    CREATE TABLE public.items (
      id uuid PRIMARY KEY, source_medication_id uuid, deleted_at timestamptz,
      metadata_json jsonb NOT NULL DEFAULT '{}'
    );
    CREATE TABLE public.item_occurrence_actions (
      item_id uuid, occurrence_date timestamptz, action_type text, created_by uuid,
      UNIQUE (item_id, occurrence_date, action_type)
    );
    CREATE FUNCTION public.health_rebuild_medication_reminders(uuid)
      RETURNS uuid[] LANGUAGE sql AS $$ SELECT '{}'::uuid[] $$;
  `;
const db = new PGlite();
try {
  await db.exec(stubSchema);
  const migration = readFileSync("migrations/2026-09-27_medication-prn-slots.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);

  const profile = "22222222-2222-4222-8222-222222222222";
  const payload = (extra) => JSON.stringify({
    profile_id: profile, name: "Test med", dosage: "1 pill", mode: "as_needed",
    food_timing: "with_food", dose_times: [], timezone: "UTC",
    starts_at: "2026-01-01T00:00:00Z", ends_at: null,
    min_hours_between: null, max_per_day: null, prn_slots: [], notes: null,
    ...extra,
  });
  const save = async (extra) => {
    const result = await db.query("SELECT health_save_medication(NULL, $1::jsonb) AS value", [payload(extra)]);
    return result.rows[0].value.medication.id;
  };
  const take = async (id, logId, anchor = null) => {
    const result = await db.query(
      "SELECT health_set_dose($1::uuid, true, $2::timestamptz, $3::uuid, NULL) AS value",
      [id, anchor, logId],
    );
    return result.rows[0].value.log;
  };
  const anchor = async (hour) => {
    const result = await db.query(
      "SELECT ((date_trunc('day', now() AT TIME ZONE 'UTC') + $1::int * interval '1 hour') AT TIME ZONE 'UTC')::text AS value",
      [hour],
    );
    return result.rows[0].value;
  };

  const intervalId = await save({ min_hours_between: 8 });
  const first = await take(intervalId, "33333333-3333-4333-8333-333333333333");
  assert.equal((await take(intervalId, first.id)).id, first.id, "retry is idempotent");
  await assert.rejects(
    take(intervalId, "44444444-4444-4444-8444-444444444444"),
    /Minimum hours between doses not reached/,
  );

  const slotId = await save({ prn_slots: ["morning", "evening"] });
  const slotLimit = await db.query(
    "SELECT max_per_day, prn_slots FROM health_medications WHERE id = $1::uuid",
    [slotId],
  );
  assert.equal(slotLimit.rows[0].max_per_day, 2, "two opportunities default to two doses per day");
  assert.deepEqual(slotLimit.rows[0].prn_slots, ["morning", "evening"]);
  const morning = await take(slotId, "55555555-5555-4555-8555-555555555555", await anchor(8));
  assert.equal(morning.prn_slot, "morning");
  assert.equal(morning.scheduled_at, null, "as-needed dose does not become a course dose");
  const repeat = await take(slotId, "66666666-6666-4666-8666-666666666666", await anchor(8));
  assert.equal(repeat.id, morning.id, "one morning dose per day");
  assert.equal((await take(slotId, "77777777-7777-4777-8777-777777777777", await anchor(20))).prn_slot, "evening");
  await assert.rejects(
    take(slotId, "88888888-8888-4888-8888-888888888888"),
    /Choose a dose opportunity/,
  );
  await db.query(
    "SELECT health_set_dose($1::uuid, false, $2::timestamptz, $3::uuid, NULL)",
    [slotId, await anchor(8), morning.id],
  );
  assert.equal(
    (await take(slotId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", await anchor(8))).prn_slot,
    "morning",
    "Undo reopens the morning opportunity",
  );

  const cappedId = await save({ max_per_day: 1 });
  await take(cappedId, "99999999-9999-4999-8999-999999999999");
  await assert.rejects(
    take(cappedId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    /Daily dose maximum reached/,
  );

  const courseId = await save({ mode: "course", dose_times: ["08:00"], prn_slots: [] });
  const courseLog = await take(courseId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", await anchor(8));
  assert.ok(courseLog.scheduled_at, "course still records its scheduled instant");

  // Simulate the version already applied by the owner, including a Noon log.
  const earlierMigration = migration
    .replace("ARRAY['morning','evening']", "ARRAY['morning','noon']")
    .replace("prn_slot IN ('morning','noon','evening')", "prn_slot IN ('morning','noon')")
    .replace("WHEN '20:00' THEN 'evening'", "WHEN '13:00' THEN 'noon'");
  const earlier = new PGlite();
  try {
    await earlier.exec(stubSchema);
    await earlier.exec(earlierMigration);
    const saved = await earlier.query(
      "SELECT health_save_medication(NULL, $1::jsonb) AS value",
      [payload({ prn_slots: ["morning", "noon"] })],
    );
    const previousId = saved.rows[0].value.medication.id;
    const oldNoon = await earlier.query(
      "SELECT ((date_trunc('day', now() AT TIME ZONE 'UTC') + interval '13 hours') AT TIME ZONE 'UTC')::text AS value",
    );
    await earlier.query(
      "SELECT health_set_dose($1::uuid, true, $2::timestamptz, $3::uuid, NULL)",
      [previousId, oldNoon.rows[0].value, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
    );

    const upgrade = readFileSync("migrations/2026-09-27_medication-evening-upgrade.sql", "utf8");
    await earlier.exec(upgrade);
    await earlier.exec(upgrade);
    const converted = await earlier.query(
      "SELECT prn_slots FROM health_medications WHERE id = $1::uuid",
      [previousId],
    );
    assert.deepEqual(new Set(converted.rows[0].prn_slots), new Set(["morning", "evening"]));
    const logs = await earlier.query(
      "SELECT prn_slot FROM health_medication_logs WHERE medication_id = $1::uuid",
      [previousId],
    );
    assert.deepEqual(logs.rows.map((row) => row.prn_slot), ["noon"]);
    const eveningAt = await earlier.query(
      "SELECT ((date_trunc('day', now() AT TIME ZONE 'UTC') + interval '20 hours') AT TIME ZONE 'UTC')::text AS value",
    );
    const eveningDose = await earlier.query(
      "SELECT health_set_dose($1::uuid, true, $2::timestamptz, $3::uuid, NULL) AS value",
      [previousId, eveningAt.rows[0].value, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
    );
    assert.equal(eveningDose.rows[0].value.log.prn_slot, "evening");
  } finally {
    await earlier.close();
  }

  console.info("Medication SQL checks passed: replay, gap, slots, Undo, daily max, course, Noon upgrade");
} finally {
  await db.close();
}
