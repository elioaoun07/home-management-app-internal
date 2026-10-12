-- migrations/2026-10-12_fitness-module.sql
--
-- WHAT: Fitness module (HLTH-28) + Healthcare body measurements.
--       1. health_measurements — timestamped weight/height history (owner-private,
--          Healthcare-owned; Fitness reads/writes the same rows).
--       2. fitness_* tables — versioned imported PT plans, weekly slots (one
--          flexible Schedule routine per workout_order entry), pauses, sessions,
--          set logs, reward events, preferences and durable operation receipts.
--       3. Write RPCs (import, version, review, activate, pause/resume/archive,
--          start, log/delete set, finish, reopen, delete/restore session) — each
--          one transaction, replay-safe through fitness_operations receipts.
--       4. fitness_mirror_occurrence_action — Schedule completion of a Fitness
--          slot creates/completes that slot's session; un-completing reverts it.
--       5. get_fitness_bundle() / get_fitness_shared_summary() hot reads.
-- WHY:  Imported PT plans, workout logging and deterministic rewards (temp.md).
-- RUN:  manually in Supabase SQL Editor AFTER migrations/2026-10-11_atomic-item-create.sql
--       (SCH-24). The prerequisite check below aborts with a clear message
--       otherwise. Safe to re-run (idempotent guards).
--
-- ACCESS MODEL
--   * Every fitness table carries user_id; RLS = SELECT own rows only (Hard
--     Rule 20 — no EXISTS-subquery policies). All writes go through the
--     SECURITY DEFINER RPCs below, which check auth.uid() ownership explicitly,
--     so XP/records/badges cannot be written directly by a client.
--   * fitness_preferences is owner read/write (cosmetic + sharing flags only).
--   * health_measurements: owner-only (managing_user_id = auth.uid()) FOR ALL.
--     Deliberately NOT added to get_health_bundle(): measurements stay private
--     even when the profile is shared with the household.
--   * The partner sees ONLY rank, badges and weekly completion/target, and only
--     while the owner's fitness_preferences.share_summary = true
--     (get_fitness_shared_summary). Turning it off removes access immediately.
--
-- SCHEDULE CONTRACT (no new recurrence engine, no cron)
--   * Activation calls create_item_complete() once per workout_order entry:
--     a private reminder item with a weekly flexible recurrence rule
--     (item_recurrence_rules.is_flexible, flexible_period = 'weekly').
--     Placement uses item_flexible_schedules (Schedule's own slot table).
--   * Completion identity = (slot, ISO week of the plan's timezone). The
--     week matches Schedule's Monday-start flexible period.
--   * fitness_finish_session writes the Schedule completion itself; the mirror
--     trigger handles completions made in Schedule. app.fitness_mirror_off
--     stops the RPCs' own writes from echoing.
--   * Pause/archive hide the slot items from Schedule via items.archived_at
--     (the flexible engine does not read recurrence_pauses); history is kept.

BEGIN;

-- ── 0. Deployment prerequisites ─────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.create_item_complete(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Fitness needs migrations/2026-10-11_atomic-item-create.sql (SCH-24). Run it first.';
  END IF;
  IF to_regprocedure('public.is_household_partner(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Fitness needs public.is_household_partner(uuid).';
  END IF;
  IF to_regprocedure('public.health_child_sync_managing_user()') IS NULL
     OR to_regclass('public.health_profiles') IS NULL THEN
    RAISE EXCEPTION 'Fitness needs the Healthcare core migration (health_profiles).';
  END IF;
  IF to_regclass('public.item_flexible_schedules') IS NULL
     OR to_regclass('public.item_occurrence_actions') IS NULL THEN
    RAISE EXCEPTION 'Fitness needs Schedule flexible routines and occurrence actions.';
  END IF;
END $$;

-- ── 1. Healthcare: body measurements ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  managing_user_id uuid NOT NULL,          -- denormalized from profile (trigger)
  measured_at timestamptz NOT NULL,
  weight_kg numeric(5,2),                  -- canonical kg
  height_cm numeric(5,1),                  -- canonical cm
  source text NOT NULL DEFAULT 'healthcare',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_measurements_pkey PRIMARY KEY (id),
  CONSTRAINT health_measurements_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT health_measurements_managing_user_id_fkey FOREIGN KEY (managing_user_id) REFERENCES auth.users(id),
  CONSTRAINT health_measurements_value_check CHECK (weight_kg IS NOT NULL OR height_cm IS NOT NULL),
  CONSTRAINT health_measurements_weight_check CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 700)),
  CONSTRAINT health_measurements_height_check CHECK (height_cm IS NULL OR (height_cm > 30 AND height_cm < 300)),
  CONSTRAINT health_measurements_source_check CHECK (source IN ('healthcare','fitness'))
);
CREATE INDEX IF NOT EXISTS health_measurements_profile_time_idx ON public.health_measurements (profile_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS health_measurements_managing_user_idx ON public.health_measurements (managing_user_id);

DROP TRIGGER IF EXISTS health_measurements_sync_owner ON public.health_measurements;
CREATE TRIGGER health_measurements_sync_owner
  BEFORE INSERT OR UPDATE OF profile_id ON public.health_measurements
  FOR EACH ROW EXECUTE FUNCTION public.health_child_sync_managing_user();

ALTER TABLE public.health_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS health_measurements_owner_all ON public.health_measurements;
CREATE POLICY health_measurements_owner_all ON public.health_measurements
  FOR ALL USING (managing_user_id = auth.uid()) WITH CHECK (managing_user_id = auth.uid());

-- ── 2. Fitness tables ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fitness_preferences (
  user_id uuid NOT NULL,
  share_summary boolean NOT NULL DEFAULT false,
  effects_enabled boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT false,
  cosmetic text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT fitness_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_preferences_cosmetic_check CHECK (cosmetic IS NULL OR cosmetic IN ('initiate','momentum','vanguard','apex'))
);

CREATE TABLE IF NOT EXISTS public.fitness_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  content_fingerprint text NOT NULL,
  current_version integer NOT NULL DEFAULT 1,
  timezone text,
  activated_week date,
  ends_week date,                          -- exclusive Monday; NULL = open-ended
  archived_from text,
  activated_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_plans_pkey PRIMARY KEY (id),
  CONSTRAINT fitness_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_plans_status_check CHECK (status IN ('draft','ready','active','paused','archived')),
  CONSTRAINT fitness_plans_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX IF NOT EXISTS fitness_plans_fingerprint_key ON public.fitness_plans (user_id, content_fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS fitness_plans_one_live_key ON public.fitness_plans (user_id) WHERE status IN ('active','paused');

CREATE TABLE IF NOT EXISTS public.fitness_plan_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  content jsonb NOT NULL,                  -- PTPlanV1 (validated server-side)
  source_text text,                        -- original pasted text, for review
  fingerprint text NOT NULL,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  acknowledged text[] NOT NULL DEFAULT '{}'::text[],
  slot_count integer NOT NULL,
  training_target integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_plan_versions_pkey PRIMARY KEY (id),
  CONSTRAINT fitness_plan_versions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.fitness_plans(id) ON DELETE CASCADE,
  CONSTRAINT fitness_plan_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_plan_versions_unique UNIQUE (plan_id, version),
  CONSTRAINT fitness_plan_versions_slots_check CHECK (slot_count >= 1 AND training_target >= 0 AND training_target <= slot_count)
);
CREATE INDEX IF NOT EXISTS fitness_plan_versions_user_idx ON public.fitness_plan_versions (user_id);

CREATE TABLE IF NOT EXISTS public.fitness_plan_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  slot_index integer NOT NULL,
  item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_plan_slots_pkey PRIMARY KEY (id),
  CONSTRAINT fitness_plan_slots_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.fitness_plans(id) ON DELETE CASCADE,
  CONSTRAINT fitness_plan_slots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_plan_slots_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL,
  CONSTRAINT fitness_plan_slots_unique UNIQUE (plan_id, slot_index),
  CONSTRAINT fitness_plan_slots_index_check CHECK (slot_index >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS fitness_plan_slots_item_key ON public.fitness_plan_slots (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fitness_plan_slots_user_idx ON public.fitness_plan_slots (user_id);

CREATE TABLE IF NOT EXISTS public.fitness_plan_pauses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  paused_on date NOT NULL,
  resumed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_plan_pauses_pkey PRIMARY KEY (id),
  CONSTRAINT fitness_plan_pauses_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.fitness_plans(id) ON DELETE CASCADE,
  CONSTRAINT fitness_plan_pauses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_plan_pauses_range_check CHECK (resumed_on IS NULL OR resumed_on >= paused_on)
);
CREATE INDEX IF NOT EXISTS fitness_plan_pauses_plan_idx ON public.fitness_plan_pauses (plan_id);
CREATE INDEX IF NOT EXISTS fitness_plan_pauses_user_idx ON public.fitness_plan_pauses (user_id);

CREATE TABLE IF NOT EXISTS public.fitness_sessions (
  id uuid NOT NULL,                        -- client-generated (idempotent start)
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  version integer NOT NULL,
  slot_id uuid,
  period_start date,                       -- Monday of the plan-timezone week
  workout_id text NOT NULL,
  workout_name text NOT NULL,
  kind text NOT NULL,
  snapshot jsonb NOT NULL,                 -- prescription snapshot (never rewritten)
  training_target integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  source text NOT NULL DEFAULT 'fitness',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  local_date date,                         -- completion day in the user's zone
  has_sets boolean NOT NULL DEFAULT false,
  fully_logged boolean NOT NULL DEFAULT false,
  notes text,
  revision integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT fitness_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.fitness_plans(id) ON DELETE CASCADE,
  CONSTRAINT fitness_sessions_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.fitness_plan_slots(id) ON DELETE SET NULL,
  CONSTRAINT fitness_sessions_kind_check CHECK (kind IN ('strength','cardio','mobility','recovery')),
  CONSTRAINT fitness_sessions_status_check CHECK (status IN ('in_progress','completed','abandoned')),
  CONSTRAINT fitness_sessions_source_check CHECK (source IN ('fitness','schedule')),
  CONSTRAINT fitness_sessions_finished_check CHECK (status <> 'completed' OR (finished_at IS NOT NULL AND local_date IS NOT NULL))
);
-- One unfinished workout per user.
CREATE UNIQUE INDEX IF NOT EXISTS fitness_sessions_one_open_key ON public.fitness_sessions (user_id)
  WHERE status = 'in_progress' AND deleted_at IS NULL;
-- One completion per weekly slot.
CREATE UNIQUE INDEX IF NOT EXISTS fitness_sessions_slot_week_key ON public.fitness_sessions (slot_id, period_start)
  WHERE status = 'completed' AND deleted_at IS NULL AND slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fitness_sessions_user_finished_idx ON public.fitness_sessions (user_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS fitness_sessions_plan_idx ON public.fitness_sessions (plan_id);

CREATE TABLE IF NOT EXISTS public.fitness_set_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  exercise_id text NOT NULL,
  set_index integer NOT NULL,
  exercise_name text NOT NULL,
  equipment text,
  load_kind text NOT NULL DEFAULT 'unspecified',
  substitution text,
  status text NOT NULL DEFAULT 'done',
  reps integer,
  load_kg numeric(6,2),
  duration_seconds integer,
  distance_m numeric(8,1),
  rpe numeric(3,1),
  rir integer,
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_set_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fitness_set_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.fitness_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fitness_set_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_set_logs_unique UNIQUE (session_id, exercise_id, set_index),
  CONSTRAINT fitness_set_logs_status_check CHECK (status IN ('done','skipped')),
  CONSTRAINT fitness_set_logs_load_kind_check CHECK (load_kind IN ('external','bodyweight','assisted','unspecified')),
  CONSTRAINT fitness_set_logs_index_check CHECK (set_index BETWEEN 0 AND 49),
  CONSTRAINT fitness_set_logs_values_check CHECK (
    (reps IS NULL OR reps BETWEEN 0 AND 1000) AND (load_kg IS NULL OR load_kg BETWEEN 0 AND 1000)
    AND (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400)
    AND (distance_m IS NULL OR distance_m BETWEEN 0 AND 1000000)
    AND (rpe IS NULL OR rpe BETWEEN 0 AND 10) AND (rir IS NULL OR rir BETWEEN 0 AND 10))
);
CREATE INDEX IF NOT EXISTS fitness_set_logs_user_idx ON public.fitness_set_logs (user_id);

CREATE TABLE IF NOT EXISTS public.fitness_reward_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_key text NOT NULL,                -- deterministic reward identity
  kind text NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  session_id uuid,
  earned_on date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  celebrated_at timestamptz,               -- shown once, on any device
  revoked_at timestamptz,                  -- Undo/correction; re-grant keeps celebrated_at
  CONSTRAINT fitness_reward_events_pkey PRIMARY KEY (id),
  CONSTRAINT fitness_reward_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fitness_reward_events_unique UNIQUE (user_id, source_key),
  CONSTRAINT fitness_reward_events_kind_check CHECK (kind IN ('xp','badge','record','rank')),
  CONSTRAINT fitness_reward_events_xp_check CHECK (xp >= 0)
);
CREATE INDEX IF NOT EXISTS fitness_reward_events_user_time_idx ON public.fitness_reward_events (user_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS public.fitness_operations (
  op_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  target_id uuid,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_operations_pkey PRIMARY KEY (op_id),
  CONSTRAINT fitness_operations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS fitness_operations_user_time_idx ON public.fitness_operations (user_id, created_at DESC);

-- ── 3. RLS — read own rows; writes only through the RPCs ────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fitness_plans','fitness_plan_versions','fitness_plan_slots','fitness_plan_pauses',
                           'fitness_sessions','fitness_set_logs','fitness_reward_events','fitness_operations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (user_id = auth.uid())', t || '_select_own', t);
  END LOOP;
END $$;

ALTER TABLE public.fitness_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fitness_preferences_owner_all ON public.fitness_preferences;
CREATE POLICY fitness_preferences_owner_all ON public.fitness_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 4. Rules (the one place for tunable constants) ──────────────────────────
CREATE OR REPLACE FUNCTION public.fitness_rules()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'xp_training', 100,          -- completed strength/cardio, max one award per local day
    'xp_recovery', 25,           -- completed mobility/recovery, max one award per local day
    'quest_training', 150,       -- weekly: plan's training target met
    'quest_recovery', 50,        -- weekly: one recovery session
    'quest_full_log', 50,        -- weekly: one fully logged workout
    'xp_per_level', 500,         -- level = 1 + floor(xp / 500)
    'ranks', jsonb_build_array(
      jsonb_build_object('id','initiate','level',1),
      jsonb_build_object('id','momentum','level',5),
      jsonb_build_object('id','vanguard','level',10),
      jsonb_build_object('id','apex','level',20)),
    'badges', jsonb_build_array(
      jsonb_build_object('id','first-workout','threshold',1),
      jsonb_build_object('id','ten-workouts','threshold',10),
      jsonb_build_object('id','first-record','threshold',1),
      jsonb_build_object('id','four-weeks','threshold',4))
  );
$$;

CREATE OR REPLACE FUNCTION public.fitness_level_rank(p_xp integer)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  WITH r AS (SELECT public.fitness_rules() AS v),
  lvl AS (SELECT 1 + floor(greatest(p_xp,0)::numeric / (v->>'xp_per_level')::int)::int AS level FROM r)
  SELECT jsonb_build_object(
    'level', lvl.level,
    'rank', (SELECT x->>'id' FROM r, jsonb_array_elements(r.v->'ranks') x
              WHERE (x->>'level')::int <= lvl.level ORDER BY (x->>'level')::int DESC LIMIT 1))
  FROM lvl;
$$;

-- ── 5. Internal helpers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fitness_require_uid()
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  RETURN auth.uid();
END $$;

-- Receipts: a replayed operation id returns its stored result. The advisory
-- lock serializes concurrent duplicates (double-tap + queue replay) so the
-- second one reads the first one's committed receipt instead of re-running.
-- VOLATILE on purpose: the read after the lock must see a fresh snapshot.
CREATE OR REPLACE FUNCTION public.fitness_receipt_get(p_op uuid, p_kind text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE o public.fitness_operations;
BEGIN
  IF p_op IS NULL THEN RAISE EXCEPTION 'op_id required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fitness-op:' || p_op::text, 0));
  SELECT * INTO o FROM public.fitness_operations WHERE op_id = p_op;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF o.user_id <> auth.uid() OR o.kind <> p_kind THEN
    RAISE EXCEPTION 'Operation id reused' USING ERRCODE = '22023';
  END IF;
  RETURN o.result || jsonb_build_object('replayed', true);
END $$;

CREATE OR REPLACE FUNCTION public.fitness_receipt_put(p_op uuid, p_kind text, p_target uuid, p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.fitness_operations(op_id, user_id, kind, target_id, result)
  VALUES (p_op, auth.uid(), p_kind, p_target, p_result);
  RETURN p_result || jsonb_build_object('replayed', false);
END $$;

-- Activation-ready: no blocking issue that needs a fix or is unacknowledged.
CREATE OR REPLACE FUNCTION public.fitness_version_ready(p_issues jsonb, p_ack text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_issues,'[]'::jsonb)) i
     WHERE coalesce((i->>'blocking')::boolean, false)
       AND (coalesce((i->>'fix')::boolean, false) OR NOT ((i->>'id') = ANY (coalesce(p_ack,'{}'::text[])))));
$$;

-- Structural facts derived from content (never trusted from the client).
CREATE OR REPLACE FUNCTION public.fitness_content_shape(p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE n int; t int; missing int;
BEGIN
  IF p_content->>'schema_version' IS DISTINCT FROM 'era.fitness.pt-plan.v1' THEN
    RAISE EXCEPTION 'Unsupported plan version' USING ERRCODE = '22023';
  END IF;
  n := coalesce(jsonb_array_length(p_content->'workout_order'), 0);
  IF n < 1 OR n > 21 THEN RAISE EXCEPTION 'workout_order must hold 1-21 entries' USING ERRCODE = '22023'; END IF;
  SELECT count(*) FILTER (WHERE w IS NULL),
         count(*) FILTER (WHERE w->>'kind' IN ('strength','cardio'))
    INTO missing, t
    FROM jsonb_array_elements_text(p_content->'workout_order') o(ref)
    LEFT JOIN LATERAL (SELECT x AS w FROM jsonb_array_elements(p_content->'workouts') x WHERE x->>'id' = o.ref LIMIT 1) l ON true;
  IF missing > 0 THEN RAISE EXCEPTION 'workout_order references an unknown workout' USING ERRCODE = '22023'; END IF;
  RETURN jsonb_build_object('slot_count', n, 'training_target', t);
END $$;

CREATE OR REPLACE FUNCTION public.fitness_workout(p_content jsonb, p_workout_id text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT x FROM jsonb_array_elements(p_content->'workouts') x WHERE x->>'id' = p_workout_id LIMIT 1;
$$;

-- "Upper", "Lower", "Upper · 2": repeated references stay distinct in Schedule.
CREATE OR REPLACE FUNCTION public.fitness_slot_title(p_content jsonb, p_index int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  WITH o AS (SELECT ref, (ord - 1)::int AS idx FROM jsonb_array_elements_text(p_content->'workout_order') WITH ORDINALITY a(ref, ord)),
  me AS (SELECT ref FROM o WHERE idx = p_index),
  nth AS (SELECT count(*) AS n FROM o, me WHERE o.ref = me.ref AND o.idx <= p_index)
  SELECT coalesce(public.fitness_workout(p_content, me.ref)->>'name', me.ref)
         || CASE WHEN nth.n > 1 THEN ' · ' || nth.n ELSE '' END
  FROM me, nth;
$$;

-- Local day of a Schedule occurrence action (planned_for wins, like the flexible engine).
CREATE OR REPLACE FUNCTION public.fitness_action_local_date(p_occurrence timestamptz, p_metadata jsonb, p_tz text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE pf text := p_metadata->>'planned_for';
BEGIN
  IF pf ~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN pf::date; END IF;
  IF pf IS NOT NULL THEN
    BEGIN RETURN (pf::timestamptz AT TIME ZONE coalesce(p_tz,'UTC'))::date;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  RETURN (p_occurrence AT TIME ZONE coalesce(p_tz,'UTC'))::date;
END $$;

CREATE OR REPLACE FUNCTION public.fitness_check_timezone(p_tz text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM now() AT TIME ZONE p_tz;
  RETURN p_tz;
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'Invalid timezone' USING ERRCODE = '22023';
END $$;

CREATE OR REPLACE FUNCTION public.fitness_refresh_session(p_session uuid)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  UPDATE public.fitness_sessions s SET
    has_sets = EXISTS (SELECT 1 FROM public.fitness_set_logs l WHERE l.session_id = s.id AND l.status = 'done'),
    fully_logged = EXISTS (SELECT 1 FROM public.fitness_set_logs l WHERE l.session_id = s.id AND l.status = 'done')
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.snapshot->'exercises') e
        CROSS JOIN LATERAL generate_series(0, jsonb_array_length(coalesce(e->'sets','[]'::jsonb)) - 1) i
         WHERE NOT EXISTS (SELECT 1 FROM public.fitness_set_logs l
                            WHERE l.session_id = s.id AND l.exercise_id = e->>'id' AND l.set_index = i)),
    revision = s.revision + 1,
    updated_at = now()
  WHERE s.id = p_session;
$$;

-- Remove the Schedule completion(s) of a slot's week (caller sets mirror off).
CREATE OR REPLACE FUNCTION public.fitness_unwrite_completion(p_item uuid, p_week date, p_tz text)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  DELETE FROM public.item_occurrence_actions a
   WHERE a.item_id = p_item AND a.action_type = 'completed'
     AND date_trunc('week', public.fitness_action_local_date(a.occurrence_date, a.metadata_json, p_tz))::date = p_week;
$$;

CREATE OR REPLACE FUNCTION public.fitness_write_completion(p_item uuid, p_session uuid, p_at timestamptz)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  INSERT INTO public.item_occurrence_actions(item_id, occurrence_date, action_type, created_by, metadata_json)
  VALUES (p_item, p_at, 'completed', auth.uid(),
          jsonb_build_object('planned_for', to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                             'fitness_session_id', p_session))
  ON CONFLICT (item_id, occurrence_date, action_type) DO NOTHING;
$$;

-- ── 6. Deterministic rewards ────────────────────────────────────────────────
-- Recomputes the full reward set for one user from completed sessions + set
-- logs. Identity = source_key, so retries/replays cannot award twice; Undo or
-- correction revokes (keeps celebrated_at so re-grants never replay).
CREATE OR REPLACE FUNCTION public.fitness_recompute_rewards_for(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r jsonb := public.fitness_rules();
  desired jsonb;
  total int;
  lr jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('fitness-rewards:' || p_user::text, 0));

  WITH done AS (
    SELECT s.id, s.kind, s.local_date, s.finished_at, s.training_target, s.fully_logged,
           date_trunc('week', s.local_date)::date AS wk,
           CASE WHEN s.kind IN ('strength','cardio') THEN 'training' ELSE 'recovery' END AS cls
      FROM public.fitness_sessions s
     WHERE s.user_id = p_user AND s.status = 'completed' AND s.deleted_at IS NULL AND s.local_date IS NOT NULL
  ),
  days AS (
    SELECT CASE cls WHEN 'training' THEN 'train:' ELSE 'recover:' END || local_date AS source_key,
           'xp' AS kind,
           CASE cls WHEN 'training' THEN (r->>'xp_training')::int ELSE (r->>'xp_recovery')::int END AS xp,
           (array_agg(id ORDER BY finished_at, id))[1] AS session_id,
           local_date AS earned_on,
           jsonb_build_object('rule', cls) AS payload
      FROM done GROUP BY cls, local_date
  ),
  weeks AS (
    SELECT wk, max(training_target) AS target,
           array_agg(id ORDER BY finished_at, id) FILTER (WHERE cls = 'training') AS t_ids,
           array_agg(id ORDER BY finished_at, id) FILTER (WHERE cls = 'recovery') AS r_ids,
           array_agg(id ORDER BY finished_at, id) FILTER (WHERE fully_logged) AS f_ids,
           array_agg(local_date ORDER BY finished_at, id) FILTER (WHERE cls = 'training') AS t_days
      FROM done GROUP BY wk
  ),
  met AS (
    SELECT wk, target, t_ids[target] AS session_id, t_days[target] AS earned_on,
           row_number() OVER (ORDER BY wk) AS n
      FROM weeks WHERE target > 0 AND coalesce(array_length(t_ids, 1), 0) >= target
  ),
  quests AS (
    SELECT 'quest-train:' || wk AS source_key, 'xp' AS kind, (r->>'quest_training')::int AS xp,
           session_id, earned_on, jsonb_build_object('rule','training-target','week',wk,'target',target) AS payload
      FROM met
    UNION ALL
    SELECT 'quest-recover:' || wk, 'xp', (r->>'quest_recovery')::int, r_ids[1],
           (SELECT d.local_date FROM done d WHERE d.id = r_ids[1]), jsonb_build_object('rule','recovery','week',wk)
      FROM weeks WHERE r_ids IS NOT NULL
    UNION ALL
    SELECT 'quest-log:' || wk, 'xp', (r->>'quest_full_log')::int, f_ids[1],
           (SELECT d.local_date FROM done d WHERE d.id = f_ids[1]), jsonb_build_object('rule','full-log','week',wk)
      FROM weeks WHERE f_ids IS NOT NULL
  ),
  sets AS (
    SELECT d.id AS session_id, d.finished_at, d.local_date, l.load_kind,
           lower(btrim(coalesce(nullif(btrim(l.substitution),''), l.exercise_name))) || '|' ||
             lower(btrim(coalesce(l.equipment,''))) || '|' || l.load_kind AS ekey,
           coalesce(nullif(btrim(l.substitution),''), l.exercise_name) AS ename,
           l.equipment, l.load_kg, l.reps, l.duration_seconds, l.distance_m
      FROM done d JOIN public.fitness_set_logs l ON l.session_id = d.id
     WHERE l.status = 'done'
  ),
  metric AS (
    SELECT session_id, finished_at, local_date, ekey, min(ename) AS ename, min(equipment) AS equipment, min(load_kind) AS load_kind, 'load' AS metric, max(load_kg)::numeric AS val
      FROM sets WHERE load_kind = 'external' AND load_kg > 0 AND coalesce(reps,0) >= 1 GROUP BY 1,2,3,4
    UNION ALL
    SELECT session_id, finished_at, local_date, ekey, min(ename), min(equipment), min(load_kind), 'reps', max(reps)::numeric
      FROM sets WHERE load_kind = 'bodyweight' AND reps > 0 GROUP BY 1,2,3,4
    UNION ALL
    SELECT session_id, finished_at, local_date, ekey, min(ename), min(equipment), min(load_kind), 'duration', max(duration_seconds)::numeric
      FROM sets WHERE duration_seconds > 0 GROUP BY 1,2,3,4
    UNION ALL
    SELECT session_id, finished_at, local_date, ekey, min(ename), min(equipment), min(load_kind), 'distance', max(distance_m)::numeric
      FROM sets WHERE distance_m > 0 GROUP BY 1,2,3,4
  ),
  ranked AS (
    SELECT m.*, max(val) OVER (PARTITION BY ekey, metric ORDER BY finished_at, session_id
                               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev
      FROM metric m
  ),
  records AS (
    SELECT 'pr:' || session_id || ':' || md5(ekey) || ':' || metric AS source_key, 'record' AS kind, 0 AS xp,
           session_id, local_date AS earned_on,
           jsonb_build_object('exercise', ename, 'equipment', equipment, 'load_kind', load_kind,
                              'metric', metric, 'value', val, 'previous', prev) AS payload,
           finished_at
      FROM ranked WHERE prev IS NOT NULL AND val > prev
  ),
  counts AS (SELECT count(*) AS n FROM done),
  nth AS (SELECT id, local_date, row_number() OVER (ORDER BY finished_at, id) AS n FROM done),
  badges AS (
    SELECT 'badge:first-workout' AS source_key, 'badge' AS kind, 0 AS xp, nth.id AS session_id, nth.local_date AS earned_on,
           jsonb_build_object('badge','first-workout') AS payload
      FROM nth WHERE nth.n = 1
    UNION ALL
    SELECT 'badge:ten-workouts', 'badge', 0, nth.id, nth.local_date, jsonb_build_object('badge','ten-workouts')
      FROM nth WHERE nth.n = (SELECT (x->>'threshold')::int FROM jsonb_array_elements(r->'badges') x WHERE x->>'id' = 'ten-workouts')
    UNION ALL
    SELECT 'badge:four-weeks', 'badge', 0, met.session_id, met.earned_on, jsonb_build_object('badge','four-weeks')
      FROM met WHERE met.n = (SELECT (x->>'threshold')::int FROM jsonb_array_elements(r->'badges') x WHERE x->>'id' = 'four-weeks')
    UNION ALL
    SELECT 'badge:first-record', 'badge', 0, rc.session_id, rc.earned_on, jsonb_build_object('badge','first-record')
      FROM (SELECT * FROM records ORDER BY finished_at, session_id LIMIT 1) rc
  ),
  xp_rows AS (SELECT * FROM days UNION ALL SELECT * FROM quests)
  SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb), coalesce((SELECT sum(xp) FROM xp_rows), 0)
    INTO desired, total
    FROM (
      SELECT source_key, kind, xp, session_id, earned_on, payload FROM xp_rows
      UNION ALL SELECT source_key, kind, xp, session_id, earned_on, payload FROM records
      UNION ALL SELECT source_key, kind, xp, session_id, earned_on, payload FROM badges
    ) a;

  lr := public.fitness_level_rank(total);
  SELECT desired || coalesce(jsonb_agg(jsonb_build_object(
           'source_key', 'rank:' || (x->>'id'), 'kind', 'rank', 'xp', 0, 'session_id', NULL,
           'earned_on', NULL, 'payload', jsonb_build_object('rank', x->>'id', 'level', (x->>'level')::int))), '[]'::jsonb)
    INTO desired
    FROM jsonb_array_elements(r->'ranks') x
   WHERE (x->>'level')::int > 1 AND (x->>'level')::int <= (lr->>'level')::int;

  UPDATE public.fitness_reward_events e SET revoked_at = now()
   WHERE e.user_id = p_user AND e.revoked_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(desired) d(source_key text) WHERE d.source_key = e.source_key);

  INSERT INTO public.fitness_reward_events(user_id, source_key, kind, xp, session_id, earned_on, payload)
  SELECT p_user, d.source_key, d.kind, d.xp, d.session_id, d.earned_on, coalesce(d.payload, '{}'::jsonb)
    FROM jsonb_to_recordset(desired) AS d(source_key text, kind text, xp int, session_id uuid, earned_on date, payload jsonb)
  ON CONFLICT (user_id, source_key) DO UPDATE
     SET kind = EXCLUDED.kind, xp = EXCLUDED.xp, session_id = EXCLUDED.session_id,
         earned_on = EXCLUDED.earned_on, payload = EXCLUDED.payload, revoked_at = NULL
   WHERE fitness_reward_events.revoked_at IS NOT NULL
      OR (fitness_reward_events.kind, fitness_reward_events.xp, fitness_reward_events.session_id,
          fitness_reward_events.earned_on, fitness_reward_events.payload)
         IS DISTINCT FROM (EXCLUDED.kind, EXCLUDED.xp, EXCLUDED.session_id, EXCLUDED.earned_on, EXCLUDED.payload);
END $$;

-- Callable by a signed-in user for themselves only (harmless: deterministic).
CREATE OR REPLACE FUNCTION public.fitness_recompute_rewards()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.fitness_recompute_rewards_for(public.fitness_require_uid());
END $$;

CREATE OR REPLACE FUNCTION public.fitness_reward_totals(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH t AS (SELECT coalesce(sum(xp), 0)::int AS xp FROM public.fitness_reward_events
              WHERE user_id = p_user AND revoked_at IS NULL)
  SELECT jsonb_build_object('xp', t.xp) || public.fitness_level_rank(t.xp) FROM t;
$$;

-- Events a session earned (for the Finish receipt) + any uncelebrated rank-up.
CREATE OR REPLACE FUNCTION public.fitness_session_rewards(p_user uuid, p_session uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.awarded_at, e.source_key)
                          FROM public.fitness_reward_events e
                         WHERE e.user_id = p_user AND e.revoked_at IS NULL
                           AND (e.session_id = p_session OR (e.kind = 'rank' AND e.celebrated_at IS NULL))), '[]'::jsonb),
    'totals', public.fitness_reward_totals(p_user));
$$;

-- ── 7. Plan RPCs ────────────────────────────────────────────────────────────
-- p: { name, fingerprint, source_text, content, issues }
CREATE OR REPLACE FUNCTION public.fitness_import_plan(p_op uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); rec jsonb; shape jsonb; pl public.fitness_plans; v public.fitness_plan_versions;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'import'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  shape := public.fitness_content_shape(p->'content');
  IF nullif(btrim(p->>'fingerprint'), '') IS NULL THEN RAISE EXCEPTION 'fingerprint required' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.fitness_plans(user_id, name, status, content_fingerprint)
  VALUES (uid, left(btrim(coalesce(nullif(p->>'name',''), p->'content'->>'name')), 200),
          CASE WHEN public.fitness_version_ready(p->'issues', '{}') THEN 'ready' ELSE 'draft' END,
          p->>'fingerprint')
  RETURNING * INTO pl;
  INSERT INTO public.fitness_plan_versions(plan_id, user_id, version, content, source_text, fingerprint, issues, slot_count, training_target)
  VALUES (pl.id, uid, 1, p->'content', p->>'source_text', p->>'fingerprint', coalesce(p->'issues','[]'::jsonb),
          (shape->>'slot_count')::int, (shape->>'training_target')::int)
  RETURNING * INTO v;
  RETURN public.fitness_receipt_put(p_op, 'import', pl.id, jsonb_build_object('plan', to_jsonb(pl), 'version', to_jsonb(v)));
END $$;

-- New version for future sessions. A live plan keeps its slot identities, so
-- its slot count must not change and it must stay activation-ready.
CREATE OR REPLACE FUNCTION public.fitness_add_plan_version(p_op uuid, p_plan uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); rec jsonb; shape jsonb; pl public.fitness_plans; cur public.fitness_plan_versions; v public.fitness_plan_versions;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'version'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = p_plan AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;
  IF pl.status = 'archived' THEN RAISE EXCEPTION 'Plan is archived' USING ERRCODE = '22023'; END IF;
  shape := public.fitness_content_shape(p->'content');
  SELECT * INTO cur FROM public.fitness_plan_versions WHERE plan_id = pl.id AND version = pl.current_version;
  IF pl.status IN ('active','paused') THEN
    IF (shape->>'slot_count')::int <> cur.slot_count THEN
      RAISE EXCEPTION 'Weekly slot count changed' USING ERRCODE = 'FT422';
    END IF;
    IF NOT public.fitness_version_ready(p->'issues', '{}') THEN
      RAISE EXCEPTION 'Resolve blocking issues first' USING ERRCODE = 'FT422';
    END IF;
  END IF;
  INSERT INTO public.fitness_plan_versions(plan_id, user_id, version, content, source_text, fingerprint, issues, slot_count, training_target)
  VALUES (pl.id, uid, pl.current_version + 1, p->'content', p->>'source_text', p->>'fingerprint', coalesce(p->'issues','[]'::jsonb),
          (shape->>'slot_count')::int, (shape->>'training_target')::int)
  RETURNING * INTO v;
  UPDATE public.fitness_plans SET current_version = v.version, content_fingerprint = v.fingerprint,
         name = left(btrim(coalesce(nullif(p->>'name',''), p->'content'->>'name', name)), 200),
         status = CASE WHEN status IN ('draft','ready')
                       THEN CASE WHEN public.fitness_version_ready(v.issues, '{}') THEN 'ready' ELSE 'draft' END
                       ELSE status END,
         updated_at = now()
   WHERE id = pl.id RETURNING * INTO pl;
  UPDATE public.items i SET title = public.fitness_slot_title(v.content, s.slot_index), updated_at = now()
    FROM public.fitness_plan_slots s WHERE s.plan_id = pl.id AND s.item_id = i.id;
  RETURN public.fitness_receipt_put(p_op, 'version', pl.id, jsonb_build_object('plan', to_jsonb(pl), 'version', to_jsonb(v)));
END $$;

-- Undo of a new version: only while no session used it.
CREATE OR REPLACE FUNCTION public.fitness_revert_plan_version(p_op uuid, p_plan uuid, p_version int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); rec jsonb; pl public.fitness_plans; prev public.fitness_plan_versions;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'revert-version'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = p_plan AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;
  IF pl.current_version <> p_version OR p_version <= 1 THEN RAISE EXCEPTION 'Version is not current' USING ERRCODE = 'FT409'; END IF;
  IF EXISTS (SELECT 1 FROM public.fitness_sessions WHERE plan_id = pl.id AND version = p_version) THEN
    RAISE EXCEPTION 'Version already used' USING ERRCODE = 'FT409';
  END IF;
  DELETE FROM public.fitness_plan_versions WHERE plan_id = pl.id AND version = p_version;
  SELECT * INTO prev FROM public.fitness_plan_versions WHERE plan_id = pl.id AND version = p_version - 1;
  UPDATE public.fitness_plans SET current_version = prev.version, content_fingerprint = prev.fingerprint,
         name = left(coalesce(prev.content->>'name', name), 200),
         status = CASE WHEN status IN ('draft','ready')
                       THEN CASE WHEN public.fitness_version_ready(prev.issues, prev.acknowledged) THEN 'ready' ELSE 'draft' END
                       ELSE status END,
         updated_at = now()
   WHERE id = pl.id RETURNING * INTO pl;
  UPDATE public.items i SET title = public.fitness_slot_title(prev.content, s.slot_index), updated_at = now()
    FROM public.fitness_plan_slots s WHERE s.plan_id = pl.id AND s.item_id = i.id;
  RETURN public.fitness_receipt_put(p_op, 'revert-version', pl.id, jsonb_build_object('plan', to_jsonb(pl)));
END $$;

-- Acknowledge review-class issues (AI-reported / week-specific heuristics).
CREATE OR REPLACE FUNCTION public.fitness_review_plan(p_op uuid, p_plan uuid, p_ack text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); rec jsonb; pl public.fitness_plans; v public.fitness_plan_versions;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'review'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = p_plan AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;
  IF pl.status NOT IN ('draft','ready') THEN RAISE EXCEPTION 'Plan is already live' USING ERRCODE = '22023'; END IF;
  UPDATE public.fitness_plan_versions SET acknowledged = coalesce(p_ack, '{}')
   WHERE plan_id = pl.id AND version = pl.current_version RETURNING * INTO v;
  UPDATE public.fitness_plans SET status = CASE WHEN public.fitness_version_ready(v.issues, v.acknowledged) THEN 'ready' ELSE 'draft' END,
         updated_at = now() WHERE id = pl.id RETURNING * INTO pl;
  RETURN public.fitness_receipt_put(p_op, 'review', pl.id, jsonb_build_object('plan', to_jsonb(pl), 'version', to_jsonb(v)));
END $$;

-- Undo of an import: only a never-activated plan with no sessions.
CREATE OR REPLACE FUNCTION public.fitness_delete_plan(p_op uuid, p_plan uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); rec jsonb; pl public.fitness_plans;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'delete-plan'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = p_plan AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;
  IF pl.status NOT IN ('draft','ready') OR EXISTS (SELECT 1 FROM public.fitness_plan_slots WHERE plan_id = pl.id)
     OR EXISTS (SELECT 1 FROM public.fitness_sessions WHERE plan_id = pl.id) THEN
    RAISE EXCEPTION 'Plan has history; archive it instead' USING ERRCODE = 'FT409';
  END IF;
  DELETE FROM public.fitness_plans WHERE id = pl.id;
  RETURN public.fitness_receipt_put(p_op, 'delete-plan', pl.id, jsonb_build_object('plan_id', pl.id));
END $$;

-- Activate: one flexible weekly Schedule routine per workout_order entry.
CREATE OR REPLACE FUNCTION public.fitness_activate_plan(p_op uuid, p_plan uuid, p_week date, p_tz text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := public.fitness_require_uid(); rec jsonb; pl public.fitness_plans; v public.fitness_plan_versions;
  tz text := public.fitness_check_timezone(p_tz); ends date; i int; w jsonb; created jsonb; slots jsonb := '[]'::jsonb;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'activate'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = p_plan AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;
  IF pl.status = 'draft' THEN RAISE EXCEPTION 'Resolve review issues first' USING ERRCODE = 'FT422'; END IF;
  IF pl.status <> 'ready' THEN RAISE EXCEPTION 'Plan is not ready' USING ERRCODE = '22023'; END IF;
  IF p_week IS NULL OR extract(isodow FROM p_week) <> 1 THEN RAISE EXCEPTION 'Week must start on Monday' USING ERRCODE = '22023'; END IF;
  IF p_week < date_trunc('week', (now() AT TIME ZONE tz))::date THEN RAISE EXCEPTION 'Week is in the past' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v FROM public.fitness_plan_versions WHERE plan_id = pl.id AND version = pl.current_version;
  IF NOT public.fitness_version_ready(v.issues, v.acknowledged) THEN RAISE EXCEPTION 'Resolve review issues first' USING ERRCODE = 'FT422'; END IF;
  IF (v.content->>'duration_weeks') IS NOT NULL THEN ends := p_week + 7 * (v.content->>'duration_weeks')::int; END IF;

  UPDATE public.fitness_plans SET status = 'active', timezone = tz, activated_week = p_week, ends_week = ends,
         activated_at = now(), paused_at = NULL, archived_at = NULL, archived_from = NULL, updated_at = now()
   WHERE id = pl.id RETURNING * INTO pl;     -- unique live-plan index raises 23505 first

  FOR i IN 0 .. v.slot_count - 1 LOOP
    w := public.fitness_workout(v.content, v.content->'workout_order'->>i);
    created := public.create_item_complete(jsonb_build_object(
      'type', 'reminder',
      'title', public.fitness_slot_title(v.content, i),
      'priority', 'normal',
      'is_public', false,
      'estimate_minutes', w->'estimated_minutes',
      'metadata_json', jsonb_build_object('fitness', jsonb_build_object('plan_id', pl.id, 'slot_index', i)),
      'recurrence_rule', jsonb_build_object(
        'rrule', 'FREQ=WEEKLY',
        'start_anchor', (p_week::timestamp AT TIME ZONE tz),
        'end_until', CASE WHEN ends IS NULL THEN NULL ELSE (ends::timestamp AT TIME ZONE tz) - interval '1 second' END,
        'is_flexible', true,
        'flexible_period', 'weekly')));
    IF created->'completion'->>'status' IS DISTINCT FROM 'complete' THEN
      RAISE EXCEPTION 'Schedule item was not created' USING ERRCODE = 'XX000';
    END IF;
    INSERT INTO public.fitness_plan_slots(plan_id, user_id, slot_index, item_id)
    VALUES (pl.id, uid, i, (created->'item'->>'id')::uuid);
  END LOOP;

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.slot_index), '[]'::jsonb) INTO slots
    FROM public.fitness_plan_slots s WHERE s.plan_id = pl.id;
  RETURN public.fitness_receipt_put(p_op, 'activate', pl.id, jsonb_build_object('plan', to_jsonb(pl), 'slots', slots));
END $$;

-- Undo of an activation: only while nothing was done against it.
CREATE OR REPLACE FUNCTION public.fitness_deactivate_plan(p_op uuid, p_plan uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); rec jsonb; pl public.fitness_plans;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'deactivate'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = p_plan AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;
  IF pl.status <> 'active' THEN RAISE EXCEPTION 'Plan is not active' USING ERRCODE = 'FT409'; END IF;
  IF EXISTS (SELECT 1 FROM public.fitness_sessions WHERE plan_id = pl.id AND slot_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.item_occurrence_actions a JOIN public.fitness_plan_slots s ON s.item_id = a.item_id WHERE s.plan_id = pl.id) THEN
    RAISE EXCEPTION 'Plan has history; pause or archive it' USING ERRCODE = 'FT409';
  END IF;
  PERFORM set_config('app.fitness_mirror_off', 'on', true);
  DELETE FROM public.items i USING public.fitness_plan_slots s WHERE s.plan_id = pl.id AND s.item_id = i.id AND i.user_id = uid;
  DELETE FROM public.fitness_plan_slots WHERE plan_id = pl.id;
  PERFORM set_config('app.fitness_mirror_off', 'off', true);
  UPDATE public.fitness_plans SET status = 'ready', timezone = NULL, activated_week = NULL, ends_week = NULL,
         activated_at = NULL, updated_at = now() WHERE id = pl.id RETURNING * INTO pl;
  RETURN public.fitness_receipt_put(p_op, 'deactivate', pl.id, jsonb_build_object('plan', to_jsonb(pl)));
END $$;

-- pause | resume | archive | restore. Pause/archive hide the slot items from
-- Schedule (archived_at); history (sessions, occurrence actions) is retained.
CREATE OR REPLACE FUNCTION public.fitness_set_plan_state(p_op uuid, p_plan uuid, p_action text, p_local_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); rec jsonb; pl public.fitness_plans; target text;
BEGIN
  rec := public.fitness_receipt_get(p_op, 'plan-state'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  IF p_local_date IS NULL THEN RAISE EXCEPTION 'local_date required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = p_plan AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;

  IF p_action = 'pause' THEN
    IF pl.status <> 'active' THEN RAISE EXCEPTION 'Plan is not active' USING ERRCODE = 'FT409'; END IF;
    INSERT INTO public.fitness_plan_pauses(plan_id, user_id, paused_on) VALUES (pl.id, uid, p_local_date);
    UPDATE public.items i SET archived_at = now(), updated_at = now() FROM public.fitness_plan_slots s
     WHERE s.plan_id = pl.id AND s.item_id = i.id;
    UPDATE public.fitness_plans SET status = 'paused', paused_at = now(), updated_at = now() WHERE id = pl.id RETURNING * INTO pl;
  ELSIF p_action = 'resume' THEN
    IF pl.status <> 'paused' THEN RAISE EXCEPTION 'Plan is not paused' USING ERRCODE = 'FT409'; END IF;
    UPDATE public.fitness_plan_pauses SET resumed_on = greatest(paused_on, p_local_date)
     WHERE plan_id = pl.id AND resumed_on IS NULL;
    UPDATE public.items i SET archived_at = NULL, updated_at = now() FROM public.fitness_plan_slots s
     WHERE s.plan_id = pl.id AND s.item_id = i.id;
    UPDATE public.fitness_plans SET status = 'active', paused_at = NULL, updated_at = now() WHERE id = pl.id RETURNING * INTO pl;
  ELSIF p_action = 'archive' THEN
    IF pl.status = 'archived' THEN RAISE EXCEPTION 'Plan is archived' USING ERRCODE = 'FT409'; END IF;
    IF pl.status = 'active' THEN
      INSERT INTO public.fitness_plan_pauses(plan_id, user_id, paused_on) VALUES (pl.id, uid, p_local_date);
    END IF;
    UPDATE public.items i SET archived_at = now(), updated_at = now() FROM public.fitness_plan_slots s
     WHERE s.plan_id = pl.id AND s.item_id = i.id;
    UPDATE public.fitness_plans SET archived_from = status, status = 'archived', archived_at = now(), updated_at = now()
     WHERE id = pl.id RETURNING * INTO pl;
  ELSIF p_action = 'restore' THEN
    IF pl.status <> 'archived' THEN RAISE EXCEPTION 'Plan is not archived' USING ERRCODE = 'FT409'; END IF;
    target := coalesce(pl.archived_from, 'ready');
    IF target = 'active' THEN
      UPDATE public.fitness_plan_pauses SET resumed_on = greatest(paused_on, p_local_date)
       WHERE plan_id = pl.id AND resumed_on IS NULL;
      UPDATE public.items i SET archived_at = NULL, updated_at = now() FROM public.fitness_plan_slots s
       WHERE s.plan_id = pl.id AND s.item_id = i.id;
    END IF;
    UPDATE public.fitness_plans SET status = target, archived_from = NULL, archived_at = NULL, updated_at = now()
     WHERE id = pl.id RETURNING * INTO pl;     -- unique live-plan index raises 23505 on a second live plan
  ELSE
    RAISE EXCEPTION 'Unknown action' USING ERRCODE = '22023';
  END IF;
  RETURN public.fitness_receipt_put(p_op, 'plan-state', pl.id, jsonb_build_object('plan', to_jsonb(pl)));
END $$;

-- ── 8. Session RPCs ─────────────────────────────────────────────────────────
-- p: { id, plan_id, slot_id?, workout_id?, week, started_at? }. The session id
-- is the idempotency key: a replayed start returns the existing session.
CREATE OR REPLACE FUNCTION public.fitness_start_session(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := public.fitness_require_uid(); s public.fitness_sessions; pl public.fitness_plans; v public.fitness_plan_versions;
  sl public.fitness_plan_slots; wid text := p->>'workout_id'; wk date := (p->>'week')::date; w jsonb; slot uuid := (p->>'slot_id')::uuid;
BEGIN
  IF (p->>'id') IS NULL THEN RAISE EXCEPTION 'id required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fitness-op:' || (p->>'id'), 0));
  SELECT * INTO s FROM public.fitness_sessions WHERE id = (p->>'id')::uuid;
  IF FOUND THEN
    IF s.user_id <> uid THEN RAISE EXCEPTION 'Operation id reused' USING ERRCODE = '22023'; END IF;
    RETURN jsonb_build_object('session', to_jsonb(s), 'replayed', true);
  END IF;
  IF wk IS NULL OR extract(isodow FROM wk) <> 1 THEN RAISE EXCEPTION 'Week must start on Monday' USING ERRCODE = '22023'; END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE id = (p->>'plan_id')::uuid AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v FROM public.fitness_plan_versions WHERE plan_id = pl.id AND version = pl.current_version;

  IF slot IS NOT NULL THEN
    SELECT * INTO sl FROM public.fitness_plan_slots WHERE id = slot AND plan_id = pl.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found' USING ERRCODE = 'P0002'; END IF;
    wid := v.content->'workout_order'->>sl.slot_index;
  ELSIF pl.status = 'active' AND wid IS NOT NULL THEN
    -- Out-of-order training claims the first open weekly slot of that workout.
    SELECT s2.id INTO slot FROM public.fitness_plan_slots s2
     WHERE s2.plan_id = pl.id AND v.content->'workout_order'->>s2.slot_index = wid
       AND NOT EXISTS (SELECT 1 FROM public.fitness_sessions x WHERE x.slot_id = s2.id AND x.period_start = wk
                         AND x.deleted_at IS NULL AND x.status IN ('completed','in_progress'))
     ORDER BY s2.slot_index LIMIT 1;
  END IF;
  IF slot IS NOT NULL AND EXISTS (SELECT 1 FROM public.fitness_sessions x WHERE x.slot_id = slot AND x.period_start = wk
                                    AND x.status = 'completed' AND x.deleted_at IS NULL) THEN
    slot := NULL;   -- that slot is already done this week: train it as an extra session
  END IF;

  w := public.fitness_workout(v.content, wid);
  IF w IS NULL THEN RAISE EXCEPTION 'Workout not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.fitness_sessions(id, user_id, plan_id, version, slot_id, period_start, workout_id, workout_name, kind,
                                      snapshot, training_target, status, source, started_at)
  VALUES ((p->>'id')::uuid, uid, pl.id, v.version, slot, wk, wid, w->>'name', w->>'kind', w, v.training_target,
          'in_progress', 'fitness', coalesce((p->>'started_at')::timestamptz, now()))
  RETURNING * INTO s;         -- one-open-workout index raises 23505
  RETURN jsonb_build_object('session', to_jsonb(s), 'replayed', false);
END $$;

-- p: { op_id, session_id, exercise_id, set_index, base_revision, status, reps,
--      load_kg, duration_seconds, distance_m, rpe, rir, notes, substitution }
-- base_revision NULL = new row. A stale base raises FT409 (reviewable conflict).
CREATE OR REPLACE FUNCTION public.fitness_log_set(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := public.fitness_require_uid(); op uuid := (p->>'op_id')::uuid; rec jsonb; s public.fitness_sessions;
  e jsonb; ps jsonb; cur public.fitness_set_logs; l public.fitness_set_logs; idx int := (p->>'set_index')::int;
  skipped boolean := coalesce(p->>'status', 'done') = 'skipped';
BEGIN
  rec := public.fitness_receipt_get(op, 'log-set'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO s FROM public.fitness_sessions WHERE id = (p->>'session_id')::uuid AND user_id = uid AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF s.status = 'abandoned' THEN RAISE EXCEPTION 'Session is closed' USING ERRCODE = '22023'; END IF;
  SELECT x INTO e FROM jsonb_array_elements(s.snapshot->'exercises') x WHERE x->>'id' = p->>'exercise_id' LIMIT 1;
  IF e IS NULL THEN RAISE EXCEPTION 'Exercise not in this workout' USING ERRCODE = '22023'; END IF;
  ps := coalesce(e->'sets'->idx, e->'sets'->(jsonb_array_length(coalesce(e->'sets','[]'::jsonb)) - 1));
  SELECT * INTO cur FROM public.fitness_set_logs WHERE session_id = s.id AND exercise_id = e->>'id' AND set_index = idx FOR UPDATE;
  IF FOUND AND (p->>'base_revision') IS DISTINCT FROM cur.revision::text THEN
    RAISE EXCEPTION 'Set changed on another device' USING ERRCODE = 'FT409', DETAIL = to_jsonb(cur)::text;
  END IF;
  IF NOT FOUND AND (p->>'base_revision') IS NOT NULL THEN
    RAISE EXCEPTION 'Set was removed on another device' USING ERRCODE = 'FT409';
  END IF;
  INSERT INTO public.fitness_set_logs AS t (session_id, user_id, exercise_id, set_index, exercise_name, equipment, load_kind,
         substitution, status, reps, load_kg, duration_seconds, distance_m, rpe, rir, notes, logged_at)
  VALUES (s.id, uid, e->>'id', idx, e->>'name', e->>'equipment', coalesce(ps->>'load_kind', 'unspecified'),
          nullif(btrim(p->>'substitution'), ''), CASE WHEN skipped THEN 'skipped' ELSE 'done' END,
          CASE WHEN skipped THEN NULL ELSE (p->>'reps')::int END,
          CASE WHEN skipped THEN NULL ELSE (p->>'load_kg')::numeric END,
          CASE WHEN skipped THEN NULL ELSE (p->>'duration_seconds')::int END,
          CASE WHEN skipped THEN NULL ELSE (p->>'distance_m')::numeric END,
          CASE WHEN skipped THEN NULL ELSE (p->>'rpe')::numeric END,
          CASE WHEN skipped THEN NULL ELSE (p->>'rir')::int END,
          nullif(p->>'notes', ''), coalesce((p->>'logged_at')::timestamptz, now()))
  ON CONFLICT (session_id, exercise_id, set_index) DO UPDATE SET
    substitution = EXCLUDED.substitution, status = EXCLUDED.status, reps = EXCLUDED.reps, load_kg = EXCLUDED.load_kg,
    duration_seconds = EXCLUDED.duration_seconds, distance_m = EXCLUDED.distance_m, rpe = EXCLUDED.rpe, rir = EXCLUDED.rir,
    notes = EXCLUDED.notes, logged_at = EXCLUDED.logged_at, revision = t.revision + 1, updated_at = now()
  RETURNING * INTO l;
  PERFORM public.fitness_refresh_session(s.id);
  IF s.status = 'completed' THEN PERFORM public.fitness_recompute_rewards_for(uid); END IF;
  SELECT * INTO s FROM public.fitness_sessions WHERE id = s.id;
  RETURN public.fitness_receipt_put(op, 'log-set', s.id, jsonb_build_object('set', to_jsonb(l), 'session', to_jsonb(s)));
END $$;

-- p: { op_id, session_id, exercise_id, set_index, base_revision }
CREATE OR REPLACE FUNCTION public.fitness_delete_set(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); op uuid := (p->>'op_id')::uuid; rec jsonb; s public.fitness_sessions; cur public.fitness_set_logs;
BEGIN
  rec := public.fitness_receipt_get(op, 'delete-set'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO s FROM public.fitness_sessions WHERE id = (p->>'session_id')::uuid AND user_id = uid AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO cur FROM public.fitness_set_logs
   WHERE session_id = s.id AND exercise_id = p->>'exercise_id' AND set_index = (p->>'set_index')::int FOR UPDATE;
  IF FOUND THEN
    IF (p->>'base_revision') IS DISTINCT FROM cur.revision::text THEN
      RAISE EXCEPTION 'Set changed on another device' USING ERRCODE = 'FT409', DETAIL = to_jsonb(cur)::text;
    END IF;
    DELETE FROM public.fitness_set_logs WHERE id = cur.id;
    PERFORM public.fitness_refresh_session(s.id);
    IF s.status = 'completed' THEN PERFORM public.fitness_recompute_rewards_for(uid); END IF;
  END IF;
  SELECT * INTO s FROM public.fitness_sessions WHERE id = s.id;
  RETURN public.fitness_receipt_put(op, 'delete-set', s.id, jsonb_build_object('removed', to_jsonb(cur), 'session', to_jsonb(s)));
END $$;

-- p: { op_id, session_id, finished_at, local_date, notes? } — the one
-- authoritative completion: session + Schedule occurrence + rewards together.
CREATE OR REPLACE FUNCTION public.fitness_finish_session(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := public.fitness_require_uid(); op uuid := (p->>'op_id')::uuid; rec jsonb; s public.fitness_sessions;
  at timestamptz := coalesce((p->>'finished_at')::timestamptz, now()); ld date := (p->>'local_date')::date; item uuid;
BEGIN
  rec := public.fitness_receipt_get(op, 'finish'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO s FROM public.fitness_sessions WHERE id = (p->>'session_id')::uuid AND user_id = uid AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF s.status = 'completed' THEN     -- completed elsewhere (e.g. from Schedule): same result, no second award
    RETURN public.fitness_receipt_put(op, 'finish', s.id, jsonb_build_object('session', to_jsonb(s))
             || jsonb_build_object('rewards', public.fitness_session_rewards(uid, s.id)));
  END IF;
  IF s.status <> 'in_progress' THEN RAISE EXCEPTION 'Session is closed' USING ERRCODE = '22023'; END IF;
  IF ld IS NULL OR abs(ld - (at AT TIME ZONE 'UTC')::date) > 1 THEN RAISE EXCEPTION 'Invalid local date' USING ERRCODE = '22023'; END IF;
  UPDATE public.fitness_sessions SET status = 'completed', finished_at = at, local_date = ld,
         notes = coalesce(nullif(p->>'notes',''), notes), revision = revision + 1, updated_at = now()
   WHERE id = s.id RETURNING * INTO s;
  IF s.slot_id IS NOT NULL THEN
    SELECT sl.item_id INTO item FROM public.fitness_plan_slots sl JOIN public.items i ON i.id = sl.item_id
     WHERE sl.id = s.slot_id AND i.deleted_at IS NULL;
    IF item IS NOT NULL THEN
      PERFORM set_config('app.fitness_mirror_off', 'on', true);
      PERFORM public.fitness_write_completion(item, s.id, at);
      PERFORM set_config('app.fitness_mirror_off', 'off', true);
    END IF;
  END IF;
  PERFORM public.fitness_recompute_rewards_for(uid);
  RETURN public.fitness_receipt_put(op, 'finish', s.id, jsonb_build_object('session', to_jsonb(s))
           || jsonb_build_object('rewards', public.fitness_session_rewards(uid, s.id)));
END $$;

-- Undo of Finish: back to in progress; Schedule completion and rewards revert.
CREATE OR REPLACE FUNCTION public.fitness_reopen_session(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); op uuid := (p->>'op_id')::uuid; rec jsonb; s public.fitness_sessions;
        item uuid; tz text;
BEGIN
  rec := public.fitness_receipt_get(op, 'reopen'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO s FROM public.fitness_sessions WHERE id = (p->>'session_id')::uuid AND user_id = uid AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF s.status <> 'completed' THEN RAISE EXCEPTION 'Session is not finished' USING ERRCODE = 'FT409'; END IF;
  UPDATE public.fitness_sessions SET status = 'in_progress', finished_at = NULL, local_date = NULL,
         revision = revision + 1, updated_at = now()
   WHERE id = s.id RETURNING * INTO s;        -- one-open-workout index raises 23505
  IF s.slot_id IS NOT NULL THEN
    SELECT sl.item_id, pl.timezone INTO item, tz FROM public.fitness_plan_slots sl JOIN public.fitness_plans pl ON pl.id = sl.plan_id
     WHERE sl.id = s.slot_id;
    IF item IS NOT NULL THEN
      PERFORM set_config('app.fitness_mirror_off', 'on', true);
      PERFORM public.fitness_unwrite_completion(item, s.period_start, tz);
      PERFORM set_config('app.fitness_mirror_off', 'off', true);
    END IF;
  END IF;
  PERFORM public.fitness_recompute_rewards_for(uid);
  RETURN public.fitness_receipt_put(op, 'reopen', s.id, jsonb_build_object('session', to_jsonb(s),
           'totals', public.fitness_reward_totals(uid)));
END $$;

-- p: { op_id, session_id, deleted } — discard/delete (and Undo). Completed
-- sessions take their Schedule completion and rewards with them.
CREATE OR REPLACE FUNCTION public.fitness_set_session_deleted(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); op uuid := (p->>'op_id')::uuid; rec jsonb; s public.fitness_sessions;
        del boolean := coalesce((p->>'deleted')::boolean, true); item uuid; tz text;
BEGIN
  rec := public.fitness_receipt_get(op, 'session-deleted'); IF rec IS NOT NULL THEN RETURN rec; END IF;
  SELECT * INTO s FROM public.fitness_sessions WHERE id = (p->>'session_id')::uuid AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF del = (s.deleted_at IS NOT NULL) THEN
    RETURN public.fitness_receipt_put(op, 'session-deleted', s.id, jsonb_build_object('session', to_jsonb(s)));
  END IF;
  IF s.slot_id IS NOT NULL THEN
    SELECT sl.item_id, pl.timezone INTO item, tz FROM public.fitness_plan_slots sl JOIN public.fitness_plans pl ON pl.id = sl.plan_id
     WHERE sl.id = s.slot_id;
  END IF;
  PERFORM set_config('app.fitness_mirror_off', 'on', true);
  IF del THEN
    UPDATE public.fitness_sessions SET deleted_at = now(), revision = revision + 1, updated_at = now() WHERE id = s.id RETURNING * INTO s;
    IF s.status = 'completed' AND item IS NOT NULL THEN PERFORM public.fitness_unwrite_completion(item, s.period_start, tz); END IF;
  ELSE
    IF s.status = 'completed' AND s.slot_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.fitness_sessions x WHERE x.slot_id = s.slot_id AND x.period_start = s.period_start
            AND x.status = 'completed' AND x.deleted_at IS NULL AND x.id <> s.id) THEN
      UPDATE public.fitness_sessions SET slot_id = NULL WHERE id = s.id;   -- slot re-done meanwhile: keep as extra
      item := NULL;
    END IF;
    UPDATE public.fitness_sessions SET deleted_at = NULL, revision = revision + 1, updated_at = now() WHERE id = s.id RETURNING * INTO s;
    IF s.status = 'completed' AND item IS NOT NULL THEN PERFORM public.fitness_write_completion(item, s.id, s.finished_at); END IF;
  END IF;
  PERFORM set_config('app.fitness_mirror_off', 'off', true);
  PERFORM public.fitness_recompute_rewards_for(uid);
  RETURN public.fitness_receipt_put(op, 'session-deleted', s.id, jsonb_build_object('session', to_jsonb(s),
           'totals', public.fitness_reward_totals(uid)));
END $$;

CREATE OR REPLACE FUNCTION public.fitness_mark_celebrated(p_keys text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); n int;
BEGIN
  UPDATE public.fitness_reward_events SET celebrated_at = now()
   WHERE user_id = uid AND source_key = ANY (coalesce(p_keys, '{}')) AND celebrated_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ── 9. Mirror: Schedule completion → Fitness session ────────────────────────
-- Completing a Fitness slot in Schedule (or its notification) completes that
-- week's open session or records a minimal completed session with no sets;
-- later detailed logging enriches the same session. Un-completing reverts it.
-- Skip/cancel never reach here (completed only) and earn nothing.
CREATE OR REPLACE FUNCTION public.fitness_mirror_occurrence_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  a public.item_occurrence_actions; sl public.fitness_plan_slots; pl public.fitness_plans; v public.fitness_plan_versions;
  ld date; wk date; s public.fitness_sessions; w jsonb; at timestamptz;
BEGIN
  IF current_setting('app.fitness_mirror_off', true) = 'on' THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN a := OLD; ELSE a := NEW; END IF;
  SELECT s2.* INTO sl FROM public.fitness_plan_slots s2 JOIN public.items i ON i.id = s2.item_id
   WHERE s2.item_id = a.item_id AND i.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;       -- not a Fitness slot, or the item itself is being deleted
  SELECT * INTO pl FROM public.fitness_plans WHERE id = sl.plan_id;
  ld := public.fitness_action_local_date(a.occurrence_date, a.metadata_json, pl.timezone);
  wk := date_trunc('week', ld)::date;
  at := least(coalesce(a.occurrence_date, now()), now());

  IF TG_OP = 'DELETE' THEN
    SELECT * INTO s FROM public.fitness_sessions
     WHERE slot_id = sl.id AND period_start = wk AND status = 'completed' AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF s.source = 'schedule' AND NOT s.has_sets AND NOT EXISTS (SELECT 1 FROM public.fitness_set_logs WHERE session_id = s.id) THEN
      DELETE FROM public.fitness_sessions WHERE id = s.id;
    ELSIF EXISTS (SELECT 1 FROM public.fitness_sessions WHERE user_id = s.user_id AND status = 'in_progress' AND deleted_at IS NULL) THEN
      UPDATE public.fitness_sessions SET status = 'abandoned', finished_at = NULL, local_date = NULL,
             revision = revision + 1, updated_at = now() WHERE id = s.id;
    ELSE
      UPDATE public.fitness_sessions SET status = 'in_progress', finished_at = NULL, local_date = NULL,
             revision = revision + 1, updated_at = now() WHERE id = s.id;
    END IF;
    PERFORM public.fitness_recompute_rewards_for(pl.user_id);
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.fitness_sessions WHERE slot_id = sl.id AND period_start = wk
               AND status = 'completed' AND deleted_at IS NULL) THEN
    RETURN NULL;                               -- already completed (replay / upsert UPDATE)
  END IF;
  SELECT * INTO s FROM public.fitness_sessions
   WHERE user_id = pl.user_id AND slot_id = sl.id AND period_start = wk AND status = 'in_progress' AND deleted_at IS NULL FOR UPDATE;
  IF FOUND THEN
    UPDATE public.fitness_sessions SET status = 'completed', finished_at = at, local_date = ld,
           revision = revision + 1, updated_at = now() WHERE id = s.id;
  ELSE
    SELECT * INTO v FROM public.fitness_plan_versions WHERE plan_id = pl.id AND version = pl.current_version;
    w := public.fitness_workout(v.content, v.content->'workout_order'->>sl.slot_index);
    IF w IS NULL THEN RETURN NULL; END IF;
    INSERT INTO public.fitness_sessions(id, user_id, plan_id, version, slot_id, period_start, workout_id, workout_name, kind,
                                        snapshot, training_target, status, source, started_at, finished_at, local_date)
    VALUES (gen_random_uuid(), pl.user_id, pl.id, v.version, sl.id, wk, w->>'id', w->>'name', w->>'kind',
            w, v.training_target, 'completed', 'schedule', at, at, ld);
  END IF;
  PERFORM public.fitness_recompute_rewards_for(pl.user_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS fitness_mirror_occurrence_done ON public.item_occurrence_actions;
CREATE TRIGGER fitness_mirror_occurrence_done
  AFTER INSERT OR UPDATE ON public.item_occurrence_actions
  FOR EACH ROW WHEN (NEW.action_type = 'completed')
  EXECUTE FUNCTION public.fitness_mirror_occurrence_action();

DROP TRIGGER IF EXISTS fitness_mirror_occurrence_undone ON public.item_occurrence_actions;
CREATE TRIGGER fitness_mirror_occurrence_undone
  AFTER DELETE ON public.item_occurrence_actions
  FOR EACH ROW WHEN (OLD.action_type = 'completed')
  EXECUTE FUNCTION public.fitness_mirror_occurrence_action();

-- ── 10. Reads ───────────────────────────────────────────────────────────────
-- Partner view: rank, badges, weekly completion/target — only while shared.
CREATE OR REPLACE FUNCTION public.get_fitness_shared_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); partner uuid; pl public.fitness_plans; tz text; wk date; target int := 0; done int := 0;
BEGIN
  SELECT CASE WHEN owner_user_id = uid THEN partner_user_id ELSE owner_user_id END INTO partner
    FROM public.household_links
   WHERE active = true AND (owner_user_id = uid OR partner_user_id = uid)
   ORDER BY created_at DESC LIMIT 1;
  IF partner IS NULL OR NOT EXISTS (SELECT 1 FROM public.fitness_preferences WHERE user_id = partner AND share_summary) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO pl FROM public.fitness_plans WHERE user_id = partner AND status IN ('active','paused') LIMIT 1;
  tz := coalesce(pl.timezone, 'UTC');
  wk := date_trunc('week', (now() AT TIME ZONE tz))::date;
  IF pl.id IS NOT NULL THEN
    SELECT training_target INTO target FROM public.fitness_plan_versions WHERE plan_id = pl.id AND version = pl.current_version;
  END IF;
  SELECT count(*) INTO done FROM public.fitness_sessions
   WHERE user_id = partner AND status = 'completed' AND deleted_at IS NULL AND kind IN ('strength','cardio')
     AND date_trunc('week', local_date)::date = wk;
  RETURN jsonb_build_object(
    'user_id', partner,
    'rank', public.fitness_reward_totals(partner)->>'rank',
    'badges', coalesce((SELECT jsonb_agg(payload->>'badge' ORDER BY awarded_at) FROM public.fitness_reward_events
                         WHERE user_id = partner AND kind = 'badge' AND revoked_at IS NULL), '[]'::jsonb),
    'week', jsonb_build_object('week_start', wk, 'done', done, 'target', coalesce(target, 0)));
END $$;

-- Hot read for the Fitness page (Hard Rule 21). Bounded history; paginated
-- detail lives behind /api/fitness/sessions.
CREATE OR REPLACE FUNCTION public.get_fitness_bundle()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := public.fitness_require_uid(); live public.fitness_plans; open_s public.fitness_sessions; result jsonb;
BEGIN
  SELECT * INTO live FROM public.fitness_plans WHERE user_id = uid AND status IN ('active','paused') LIMIT 1;
  SELECT * INTO open_s FROM public.fitness_sessions WHERE user_id = uid AND status = 'in_progress' AND deleted_at IS NULL LIMIT 1;

  SELECT jsonb_build_object(
    'rules', public.fitness_rules(),
    'preferences', coalesce((SELECT to_jsonb(fp) FROM public.fitness_preferences fp WHERE fp.user_id = uid),
                            jsonb_build_object('user_id', uid, 'share_summary', false, 'effects_enabled', true,
                                               'sound_enabled', false, 'cosmetic', NULL)),
    'plans', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
                SELECT p.id, p.name, p.status, p.current_version, p.activated_week, p.ends_week, p.timezone,
                       p.created_at, p.updated_at, p.archived_at, p.archived_from,
                       v.issues, v.acknowledged, v.slot_count, v.training_target,
                       v.content->>'trainer' AS trainer, v.content->>'goal' AS goal,
                       (v.content->>'duration_weeks')::int AS duration_weeks
                  FROM public.fitness_plans p
                  JOIN public.fitness_plan_versions v ON v.plan_id = p.id AND v.version = p.current_version
                 WHERE p.user_id = uid ORDER BY p.created_at DESC LIMIT 30) x), '[]'::jsonb),
    'live_plan', CASE WHEN live.id IS NULL THEN NULL ELSE (
       SELECT jsonb_build_object(
         'plan', to_jsonb(live),
         'version', (SELECT to_jsonb(v) - 'source_text' FROM public.fitness_plan_versions v WHERE v.plan_id = live.id AND v.version = live.current_version),
         'pauses', coalesce((SELECT jsonb_agg(to_jsonb(pp) ORDER BY pp.paused_on) FROM public.fitness_plan_pauses pp WHERE pp.plan_id = live.id), '[]'::jsonb),
         'slots', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'id', s.id, 'slot_index', s.slot_index, 'item_id', s.item_id,
              'placements', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.period_start_date)
                                        FROM public.item_flexible_schedules f
                                       WHERE f.item_id = s.item_id
                                         AND f.period_start_date >= date_trunc('week', (now() AT TIME ZONE coalesce(live.timezone,'UTC')))::date - 7), '[]'::jsonb),
              'actions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'action_type', a.action_type,
                                        'occurrence_date', a.occurrence_date, 'metadata_json', a.metadata_json))
                                     FROM public.item_occurrence_actions a
                                    WHERE a.item_id = s.item_id AND a.occurrence_date >= now() - interval '21 days'), '[]'::jsonb))
            ORDER BY s.slot_index) FROM public.fitness_plan_slots s WHERE s.plan_id = live.id), '[]'::jsonb))
       ) END,
    'open_session', CASE WHEN open_s.id IS NULL THEN NULL ELSE
       to_jsonb(open_s) || jsonb_build_object('sets', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.exercise_id, l.set_index)
                                                               FROM public.fitness_set_logs l WHERE l.session_id = open_s.id), '[]'::jsonb)) END,
    -- Previous performance: the last logged sets of each live-plan workout,
    -- cached with the bundle so a workout started offline still shows them.
    'previous_sets', coalesce((SELECT jsonb_agg(to_jsonb(l) || jsonb_build_object('workout_id', ls.workout_id, 'finished_at', ls.finished_at)
                                                ORDER BY ls.workout_id, l.exercise_id, l.set_index)
         FROM (SELECT DISTINCT ON (s.workout_id) s.id, s.workout_id, s.finished_at
                 FROM public.fitness_sessions s
                WHERE s.user_id = uid AND s.plan_id = live.id AND s.status = 'completed'
                  AND s.deleted_at IS NULL AND s.has_sets
                ORDER BY s.workout_id, s.finished_at DESC) ls
         JOIN public.fitness_set_logs l ON l.session_id = ls.id), '[]'::jsonb),
    'recent_sessions', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'finished_at') DESC NULLS LAST) FROM (
         SELECT (to_jsonb(s) - 'snapshot') || jsonb_build_object(
                  'sets_done', (SELECT count(*) FROM public.fitness_set_logs l WHERE l.session_id = s.id AND l.status = 'done'),
                  'volume_kg', (SELECT sum(l.load_kg * l.reps) FROM public.fitness_set_logs l
                                 WHERE l.session_id = s.id AND l.status = 'done' AND l.load_kind = 'external'
                                   AND l.load_kg IS NOT NULL AND l.reps IS NOT NULL)) AS x
           FROM public.fitness_sessions s
          WHERE s.user_id = uid AND s.deleted_at IS NULL AND s.status <> 'in_progress'
            AND coalesce(s.finished_at, s.updated_at) >= now() - interval '180 days'
          ORDER BY coalesce(s.finished_at, s.updated_at) DESC LIMIT 60) q), '[]'::jsonb),
    'weeks', coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.week_start DESC) FROM (
         SELECT date_trunc('week', s.local_date)::date AS week_start,
                count(*) FILTER (WHERE s.kind IN ('strength','cardio')) AS training_done,
                count(*) FILTER (WHERE s.kind IN ('mobility','recovery')) AS recovery_done,
                max(s.training_target) AS target,
                bool_or(s.fully_logged) AS any_full_log
           FROM public.fitness_sessions s
          WHERE s.user_id = uid AND s.status = 'completed' AND s.deleted_at IS NULL
            AND s.local_date >= (now() AT TIME ZONE 'UTC')::date - 7 * 27
          GROUP BY 1) w), '[]'::jsonb),
    'rewards', jsonb_build_object(
       'totals', public.fitness_reward_totals(uid),
       'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.awarded_at DESC) FROM (
            SELECT * FROM public.fitness_reward_events WHERE user_id = uid AND revoked_at IS NULL
             ORDER BY awarded_at DESC LIMIT 120) e), '[]'::jsonb),
       'badges', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.awarded_at) FROM public.fitness_reward_events e
                             WHERE e.user_id = uid AND e.kind IN ('badge','rank') AND e.revoked_at IS NULL), '[]'::jsonb)),
    'records', coalesce((SELECT jsonb_agg(x ORDER BY x->>'exercise') FROM (
         SELECT jsonb_build_object('exercise', min(coalesce(nullif(btrim(l.substitution),''), l.exercise_name)),
                  'equipment', min(l.equipment), 'load_kind', l.load_kind,
                  'best_load_kg', max(l.load_kg) FILTER (WHERE l.load_kind = 'external' AND coalesce(l.reps,0) >= 1),
                  'best_reps', max(l.reps) FILTER (WHERE l.load_kind = 'bodyweight'),
                  'best_duration_seconds', max(l.duration_seconds), 'best_distance_m', max(l.distance_m),
                  'last_at', max(s.finished_at)) AS x
           FROM public.fitness_set_logs l JOIN public.fitness_sessions s ON s.id = l.session_id
          WHERE l.user_id = uid AND l.status = 'done' AND s.status = 'completed' AND s.deleted_at IS NULL
          GROUP BY lower(btrim(coalesce(nullif(btrim(l.substitution),''), l.exercise_name))), lower(btrim(coalesce(l.equipment,''))), l.load_kind
          ORDER BY max(s.finished_at) DESC LIMIT 60) r), '[]'::jsonb),
    'health_profile', (SELECT jsonb_build_object('id', hp.id, 'name', hp.name) FROM public.health_profiles hp
                        WHERE hp.user_id = uid AND hp.managing_user_id = uid AND hp.deleted_at IS NULL
                        ORDER BY hp.created_at LIMIT 1),
    'partner', public.get_fitness_shared_summary()
  ) INTO result;
  RETURN result;
END $$;

-- ── 11. Grants ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION
  public.fitness_recompute_rewards_for(uuid), public.fitness_mirror_occurrence_action(),
  public.fitness_receipt_get(uuid, text), public.fitness_receipt_put(uuid, text, uuid, jsonb),
  public.fitness_refresh_session(uuid), public.fitness_unwrite_completion(uuid, date, text),
  public.fitness_write_completion(uuid, uuid, timestamptz), public.fitness_reward_totals(uuid),
  public.fitness_session_rewards(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.fitness_import_plan(uuid, jsonb), public.fitness_add_plan_version(uuid, uuid, jsonb),
  public.fitness_revert_plan_version(uuid, uuid, int), public.fitness_review_plan(uuid, uuid, text[]),
  public.fitness_delete_plan(uuid, uuid), public.fitness_activate_plan(uuid, uuid, date, text),
  public.fitness_deactivate_plan(uuid, uuid), public.fitness_set_plan_state(uuid, uuid, text, date),
  public.fitness_start_session(jsonb), public.fitness_log_set(jsonb), public.fitness_delete_set(jsonb),
  public.fitness_finish_session(jsonb), public.fitness_reopen_session(jsonb), public.fitness_set_session_deleted(jsonb),
  public.fitness_mark_celebrated(text[]), public.fitness_recompute_rewards(),
  public.get_fitness_bundle(), public.get_fitness_shared_summary()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.fitness_import_plan(uuid, jsonb), public.fitness_add_plan_version(uuid, uuid, jsonb),
  public.fitness_revert_plan_version(uuid, uuid, int), public.fitness_review_plan(uuid, uuid, text[]),
  public.fitness_delete_plan(uuid, uuid), public.fitness_activate_plan(uuid, uuid, date, text),
  public.fitness_deactivate_plan(uuid, uuid), public.fitness_set_plan_state(uuid, uuid, text, date),
  public.fitness_start_session(jsonb), public.fitness_log_set(jsonb), public.fitness_delete_set(jsonb),
  public.fitness_finish_session(jsonb), public.fitness_reopen_session(jsonb), public.fitness_set_session_deleted(jsonb),
  public.fitness_mark_celebrated(text[]), public.fitness_recompute_rewards(),
  public.get_fitness_bundle(), public.get_fitness_shared_summary()
  TO authenticated;

COMMIT;

-- ── 12. Verify (read-only, run as the SQL Editor role) ──────────────────────
-- select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and (relname like 'fitness_%' or relname = 'health_measurements');
-- select tablename, policyname, cmd, qual from pg_policies
--  where schemaname = 'public' and (tablename like 'fitness_%' or tablename = 'health_measurements');
-- select tgname from pg_trigger where tgrelid = 'public.item_occurrence_actions'::regclass and tgname like 'fitness_%';
-- select proname, prosecdef from pg_proc where proname like 'fitness_%' or proname like 'get_fitness_%';
-- Then regenerate migrations/db-state.json (migrations/db-state.sql) and run `pnpm db:verify-rls`.
