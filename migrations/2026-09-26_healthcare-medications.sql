-- migrations/2026-09-26_healthcare-medications.sql
--
-- WHAT: Healthcare medications (HLTH-24, first slice of HLTH-8/9/11):
--       1. health_medications — per-profile medicine: name, dosage, mode
--          (full course | as needed), food timing, wall-clock dose times,
--          first-dose instant, optional end instant.
--       2. health_medication_logs — taken doses. Course doses are keyed by
--          their slot (medication_id, scheduled_at) → exactly one row per dose.
--          As-needed doses have scheduled_at NULL and a client-supplied id.
--       3. items.source_medication_id — links the generated reminder items.
--       4. health_rebuild_medication_reminders() — one urgent recurring
--          reminder item per dose time (existing item recurrence + item_alerts
--          + item-reminders cron; NO new alert engine).
--       5. health_save_medication() / health_set_medication_deleted() /
--          health_set_dose() — atomic write RPCs (medication + reminders +
--          occurrence mirror commit together).
--       6. Mirror trigger: completing / un-completing a medication reminder
--          occurrence in Schedule marks / un-marks the dose in Healthcare.
--       7. get_health_bundle() now also returns medications + medication_logs.
-- WHY:  Owner is sick and needs: medicine list, when/how to take each one,
--       a taken/not-taken checklist, and a reminder for the next pill.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (idempotent guards).
--
-- NOTES:
--   * Access model identical to the healthcare core (2026-07-17): owner-only
--     RLS on managing_user_id (denormalized by trigger); partner visibility
--     only through get_health_bundle() when the profile is shared.
--   * Write RPCs are SECURITY INVOKER — they run under the caller's RLS on
--     items / item_* / health_* tables. Only the mirror trigger is SECURITY
--     DEFINER (a responsible user completing the reminder must still log it).
--   * Reminders are REPLACED, never appended: every save deletes the
--     medication's reminder items (children cascade) and recreates them, then
--     re-marks already-taken past doses as completed occurrences. The
--     app.health_mirror_off flag stops that cascade from deleting dose logs.
--   * Dose times are wall-clock in health_medications.timezone. Known engine
--     limit (not introduced here): the item-reminders cron re-arms recurring
--     alerts with a UTC-fixed RRULE, so a course crossing a DST change can
--     push one hour off until the next save.

-- ── 1. Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.health_medications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  managing_user_id uuid NOT NULL,         -- denormalized from profile (trigger)
  name text NOT NULL,
  dosage text,                            -- free text: "1 pill", "500 mg", "5 ml"
  mode text NOT NULL DEFAULT 'course',    -- course = fixed times until done; as_needed = based on symptoms
  food_timing text NOT NULL DEFAULT 'any',
  dose_times text[] NOT NULL DEFAULT '{}',-- wall-clock "HH:MM" in `timezone`
  timezone text NOT NULL DEFAULT 'UTC',   -- IANA zone the dose times are in
  starts_at timestamptz NOT NULL DEFAULT now(), -- first dose; earlier slots don't exist
  ends_at timestamptz,                    -- exclusive; NULL = ongoing
  min_hours_between numeric(4,1),         -- as_needed only
  max_per_day integer,                    -- as_needed only
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT health_medications_pkey PRIMARY KEY (id),
  CONSTRAINT health_medications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.health_profiles(id) ON DELETE CASCADE,
  CONSTRAINT health_medications_managing_user_id_fkey FOREIGN KEY (managing_user_id) REFERENCES auth.users(id),
  CONSTRAINT health_medications_mode_check CHECK (mode IN ('course','as_needed')),
  CONSTRAINT health_medications_food_timing_check CHECK (food_timing IN ('any','empty_stomach','with_food')),
  CONSTRAINT health_medications_dose_times_check CHECK (
    array_to_string(dose_times, ',') ~ '^((([01][0-9]|2[0-3]):[0-5][0-9])(,([01][0-9]|2[0-3]):[0-5][0-9])*)?$'
  ),
  CONSTRAINT health_medications_course_times_check CHECK (mode <> 'course' OR cardinality(dose_times) > 0),
  CONSTRAINT health_medications_window_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT health_medications_min_hours_check CHECK (min_hours_between IS NULL OR min_hours_between > 0),
  CONSTRAINT health_medications_max_per_day_check CHECK (max_per_day IS NULL OR max_per_day > 0)
);

CREATE TABLE IF NOT EXISTS public.health_medication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL,
  managing_user_id uuid NOT NULL,         -- denormalized from medication (trigger)
  scheduled_at timestamptz,               -- the course dose slot; NULL = as-needed dose
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_medication_logs_pkey PRIMARY KEY (id),
  CONSTRAINT health_medication_logs_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.health_medications(id) ON DELETE CASCADE,
  CONSTRAINT health_medication_logs_managing_user_id_fkey FOREIGN KEY (managing_user_id) REFERENCES auth.users(id)
);

-- ── 2. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS health_medications_profile_id_idx ON public.health_medications (profile_id);
CREATE INDEX IF NOT EXISTS health_medications_managing_user_id_idx ON public.health_medications (managing_user_id);
CREATE INDEX IF NOT EXISTS health_medication_logs_medication_id_idx ON public.health_medication_logs (medication_id);
CREATE INDEX IF NOT EXISTS health_medication_logs_managing_user_id_idx ON public.health_medication_logs (managing_user_id);
-- Exactly-once per course dose: double-tap / retry / Schedule mirror all collapse here.
CREATE UNIQUE INDEX IF NOT EXISTS health_medication_logs_slot_key
  ON public.health_medication_logs (medication_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- ── 3. Owner-sync triggers (Hard Rule 20 option B) ───────────────────────────

-- health_medications has profile_id → reuse the core trigger function.
DROP TRIGGER IF EXISTS health_medications_sync_owner ON public.health_medications;
CREATE TRIGGER health_medications_sync_owner
  BEFORE INSERT OR UPDATE OF profile_id ON public.health_medications
  FOR EACH ROW EXECUTE FUNCTION public.health_child_sync_managing_user();

CREATE OR REPLACE FUNCTION public.health_log_sync_managing_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  SELECT m.managing_user_id INTO NEW.managing_user_id
    FROM public.health_medications m
   WHERE m.id = NEW.medication_id;
  IF NEW.managing_user_id IS NULL THEN
    RAISE EXCEPTION 'medication % not found', NEW.medication_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS health_medication_logs_sync_owner ON public.health_medication_logs;
CREATE TRIGGER health_medication_logs_sync_owner
  BEFORE INSERT OR UPDATE OF medication_id ON public.health_medication_logs
  FOR EACH ROW EXECUTE FUNCTION public.health_log_sync_managing_user();

-- ── 4. RLS — owner-only (household reads go through get_health_bundle) ──────

ALTER TABLE public.health_medications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_medication_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_medications','health_medication_logs'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_owner_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL
           USING (managing_user_id = auth.uid())
           WITH CHECK (managing_user_id = auth.uid())',
        t || '_owner_all', t
      );
    END IF;
  END LOOP;
END $$;

-- ── 5. items.source_medication_id ────────────────────────────────────────────
-- New nullable column: existing items get NULL, existing items RLS applies
-- unchanged (verified policies in migrations/db-state.json, 2026-08-04).

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS source_medication_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'items_source_medication_fkey'
       AND conrelid = 'public.items'::regclass
  ) THEN
    -- CASCADE: a hard-deleted medication must not leave reminders firing.
    ALTER TABLE public.items
      ADD CONSTRAINT items_source_medication_fkey
      FOREIGN KEY (source_medication_id) REFERENCES public.health_medications(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS items_source_medication_idx
  ON public.items (source_medication_id)
  WHERE source_medication_id IS NOT NULL;

-- ── 6. Reminder materialization (one recurring reminder per dose time) ──────

CREATE OR REPLACE FUNCTION public.health_rebuild_medication_reminders(p_medication_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m public.health_medications%ROWTYPE;
  v_profile public.health_profiles%ROWTYPE;
  v_title text;
  v_desc text;
  v_time text;
  v_t time;
  v_day date;
  v_first timestamptz;
  v_last timestamptz;
  v_next timestamptz;
  v_item_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO m FROM public.health_medications
   WHERE id = p_medication_id AND managing_user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medication not found' USING ERRCODE = 'P0002';
  END IF;

  -- Replace, never append. Children (alerts, rules, occurrence actions)
  -- cascade; the flag keeps that cascade from un-logging taken doses.
  PERFORM set_config('app.health_mirror_off', 'on', true);
  DELETE FROM public.items WHERE source_medication_id = m.id AND user_id = uid;

  SELECT * INTO v_profile FROM public.health_profiles WHERE id = m.profile_id;

  IF m.deleted_at IS NOT NULL OR v_profile.deleted_at IS NOT NULL OR m.mode <> 'course' THEN
    PERFORM set_config('app.health_mirror_off', 'off', true);
    RETURN v_ids;
  END IF;

  v_title := m.name || COALESCE(' · ' || NULLIF(btrim(m.dosage), ''), '');
  IF v_profile.user_id IS DISTINCT FROM uid THEN
    v_title := v_title || ' — ' || v_profile.name;   -- dependent / other profile
  END IF;
  v_desc := CASE m.food_timing
              WHEN 'empty_stomach' THEN 'Empty stomach'
              WHEN 'with_food' THEN 'With food'
              ELSE NULL
            END;

  FOR v_time IN SELECT DISTINCT t FROM unnest(m.dose_times) AS t ORDER BY 1 LOOP
    v_t := v_time::time;

    -- First slot at this wall-clock time on/after the first dose.
    v_day := (m.starts_at AT TIME ZONE m.timezone)::date;
    v_first := (v_day + v_t) AT TIME ZONE m.timezone;
    IF v_first < m.starts_at THEN
      v_first := ((v_day + 1) + v_t) AT TIME ZONE m.timezone;
    END IF;

    -- Last slot strictly before ends_at (NULL = ongoing).
    v_last := NULL;
    IF m.ends_at IS NOT NULL THEN
      v_day := (m.ends_at AT TIME ZONE m.timezone)::date;
      v_last := (v_day + v_t) AT TIME ZONE m.timezone;
      IF v_last >= m.ends_at THEN
        v_last := ((v_day - 1) + v_t) AT TIME ZONE m.timezone;
      END IF;
      CONTINUE WHEN v_last < v_first;
    END IF;

    -- Next future slot → the alert the item-reminders cron fires and re-arms.
    IF v_first >= now() THEN
      v_next := v_first;
    ELSE
      v_day := (now() AT TIME ZONE m.timezone)::date;
      v_next := (v_day + v_t) AT TIME ZONE m.timezone;
      IF v_next < now() THEN
        v_next := ((v_day + 1) + v_t) AT TIME ZONE m.timezone;
      END IF;
      IF v_last IS NOT NULL AND v_next > v_last THEN
        v_next := NULL;
      END IF;
    END IF;

    INSERT INTO public.items (
      user_id, responsible_user_id, type, title, description, priority,
      status, metadata_json, source_medication_id
    ) VALUES (
      uid, uid, 'reminder', v_title, v_desc, 'urgent',
      'pending', jsonb_build_object('medication_dose_time', v_time), m.id
    )
    RETURNING id INTO v_item_id;

    INSERT INTO public.reminder_details (item_id, due_at)
    VALUES (v_item_id, v_first);

    INSERT INTO public.item_recurrence_rules (item_id, rrule, start_anchor, end_until)
    VALUES (v_item_id, 'FREQ=DAILY', v_first, v_last);

    IF v_next IS NOT NULL THEN
      INSERT INTO public.item_alerts (item_id, kind, trigger_at, occurrence_date, channel, active)
      VALUES (v_item_id, 'absolute', v_next, v_next, 'push', true);
    END IF;

    -- Doses already taken at this time → completed occurrences in Schedule.
    INSERT INTO public.item_occurrence_actions (item_id, occurrence_date, action_type, created_by)
    SELECT v_item_id, l.scheduled_at, 'completed', uid
      FROM public.health_medication_logs l
     WHERE l.medication_id = m.id
       AND l.scheduled_at IS NOT NULL
       AND l.scheduled_at >= v_first
       AND (v_last IS NULL OR l.scheduled_at <= v_last)
       AND (l.scheduled_at AT TIME ZONE m.timezone)::time = v_t
    ON CONFLICT (item_id, occurrence_date, action_type) DO NOTHING;

    v_ids := v_ids || v_item_id;
  END LOOP;

  PERFORM set_config('app.health_mirror_off', 'off', true);
  RETURN v_ids;
END;
$function$;

-- ── 7. Write RPCs ────────────────────────────────────────────────────────────

-- Create (p_id NULL) or fully replace the editable fields (p_id set), then
-- rebuild reminders — one transaction.
CREATE OR REPLACE FUNCTION public.health_save_medication(p_id uuid, p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_row public.health_medications%ROWTYPE;
  v_times text[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'dose_times', '[]'::jsonb)));
  v_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Rejects an unknown zone up front (22023) instead of mid-materialization.
  PERFORM now() AT TIME ZONE (p->>'timezone');

  IF p_id IS NULL THEN
    INSERT INTO public.health_medications (
      profile_id, managing_user_id, name, dosage, mode, food_timing, dose_times,
      timezone, starts_at, ends_at, min_hours_between, max_per_day, notes
    ) VALUES (
      (p->>'profile_id')::uuid, uid, p->>'name', NULLIF(p->>'dosage', ''),
      COALESCE(p->>'mode', 'course'), COALESCE(p->>'food_timing', 'any'), v_times,
      p->>'timezone', COALESCE((p->>'starts_at')::timestamptz, now()),
      (p->>'ends_at')::timestamptz, (p->>'min_hours_between')::numeric,
      (p->>'max_per_day')::int, NULLIF(p->>'notes', '')
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.health_medications SET
      name = p->>'name',
      dosage = NULLIF(p->>'dosage', ''),
      mode = COALESCE(p->>'mode', 'course'),
      food_timing = COALESCE(p->>'food_timing', 'any'),
      dose_times = v_times,
      timezone = p->>'timezone',
      starts_at = COALESCE((p->>'starts_at')::timestamptz, starts_at),
      ends_at = (p->>'ends_at')::timestamptz,
      min_hours_between = (p->>'min_hours_between')::numeric,
      max_per_day = (p->>'max_per_day')::int,
      notes = NULLIF(p->>'notes', ''),
      updated_at = now()
    WHERE id = p_id AND managing_user_id = uid AND deleted_at IS NULL
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Medication not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_ids := public.health_rebuild_medication_reminders(v_row.id);
  RETURN jsonb_build_object('medication', to_jsonb(v_row), 'item_ids', to_jsonb(v_ids));
END;
$function$;

-- Soft delete / restore (Undo). Logs are kept; reminders removed / recreated.
CREATE OR REPLACE FUNCTION public.health_set_medication_deleted(p_id uuid, p_deleted boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_row public.health_medications%ROWTYPE;
  v_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.health_medications
     SET deleted_at = CASE WHEN p_deleted THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_id AND managing_user_id = uid
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medication not found' USING ERRCODE = 'P0002';
  END IF;

  v_ids := public.health_rebuild_medication_reminders(v_row.id);
  RETURN jsonb_build_object('medication', to_jsonb(v_row), 'item_ids', to_jsonb(v_ids));
END;
$function$;

-- Mark / un-mark one dose. Course: p_scheduled_at = the slot. As needed:
-- p_scheduled_at NULL, p_log_id = client-generated id (idempotent replay).
CREATE OR REPLACE FUNCTION public.health_set_dose(
  p_medication_id uuid,
  p_taken boolean,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_log_id uuid DEFAULT NULL,
  p_taken_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m public.health_medications%ROWTYPE;
  v_item_id uuid;
  v_log_id uuid := COALESCE(p_log_id, gen_random_uuid());
  v_log public.health_medication_logs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_scheduled_at IS NULL AND p_log_id IS NULL THEN
    RAISE EXCEPTION 'scheduled_at or log_id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO m FROM public.health_medications
   WHERE id = p_medication_id AND managing_user_id = uid AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medication not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_scheduled_at IS NOT NULL THEN
    SELECT i.id INTO v_item_id
      FROM public.items i
     WHERE i.source_medication_id = m.id
       AND i.deleted_at IS NULL
       AND i.metadata_json->>'medication_dose_time'
           = to_char(p_scheduled_at AT TIME ZONE m.timezone, 'HH24:MI')
     LIMIT 1;
  END IF;

  PERFORM set_config('app.health_mirror_off', 'on', true);

  IF p_taken THEN
    INSERT INTO public.health_medication_logs (id, medication_id, managing_user_id, scheduled_at, taken_at)
    VALUES (v_log_id, m.id, uid, p_scheduled_at, COALESCE(p_taken_at, now()))
    ON CONFLICT DO NOTHING;

    IF v_item_id IS NOT NULL THEN
      INSERT INTO public.item_occurrence_actions (item_id, occurrence_date, action_type, created_by)
      VALUES (v_item_id, p_scheduled_at, 'completed', uid)
      ON CONFLICT (item_id, occurrence_date, action_type) DO NOTHING;
    END IF;

    IF p_scheduled_at IS NOT NULL THEN
      SELECT * INTO v_log FROM public.health_medication_logs
       WHERE medication_id = m.id AND scheduled_at = p_scheduled_at;
    ELSE
      SELECT * INTO v_log FROM public.health_medication_logs WHERE id = v_log_id;
    END IF;
    PERFORM set_config('app.health_mirror_off', 'off', true);
    RETURN jsonb_build_object('log', to_jsonb(v_log));
  END IF;

  IF p_scheduled_at IS NOT NULL THEN
    DELETE FROM public.health_medication_logs
     WHERE medication_id = m.id AND scheduled_at = p_scheduled_at;
    IF v_item_id IS NOT NULL THEN
      -- One occurrence per item per day → ±12h is exactly this dose.
      DELETE FROM public.item_occurrence_actions
       WHERE item_id = v_item_id
         AND action_type = 'completed'
         AND occurrence_date > p_scheduled_at - interval '12 hours'
         AND occurrence_date < p_scheduled_at + interval '12 hours';
    END IF;
  ELSE
    DELETE FROM public.health_medication_logs
     WHERE id = p_log_id AND medication_id = m.id;
  END IF;

  PERFORM set_config('app.health_mirror_off', 'off', true);
  RETURN jsonb_build_object('log', NULL);
END;
$function$;

-- ── 8. Mirror: Schedule occurrence actions → dose logs ──────────────────────
-- Completing a medication reminder in Schedule (or from its notification)
-- logs the dose; un-completing removes it. Skipped when the item itself is
-- being deleted (FK cascade — item row no longer visible) or when a health
-- RPC already wrote both sides (app.health_mirror_off).

CREATE OR REPLACE FUNCTION public.health_mirror_occurrence_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item_id uuid;
  v_occ timestamptz;
  v_med_id uuid;
  v_tz text;
  v_dose_time text;
  v_slot timestamptz;
BEGIN
  IF current_setting('app.health_mirror_off', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.item_id;
    v_occ := OLD.occurrence_date;
  ELSE
    v_item_id := NEW.item_id;
    v_occ := NEW.occurrence_date;
  END IF;

  SELECT m.id, m.timezone, i.metadata_json->>'medication_dose_time'
    INTO v_med_id, v_tz, v_dose_time
    FROM public.items i
    JOIN public.health_medications m ON m.id = i.source_medication_id
   WHERE i.id = v_item_id
     AND i.deleted_at IS NULL
     AND m.deleted_at IS NULL;

  IF v_med_id IS NULL OR v_dose_time IS NULL THEN
    RETURN NULL;
  END IF;

  -- Nearest dose slot to the occurrence (tolerates a DST-shifted occurrence).
  SELECT s INTO v_slot
    FROM (
      SELECT ((((v_occ AT TIME ZONE v_tz)::date + k) + v_dose_time::time) AT TIME ZONE v_tz) AS s
        FROM generate_series(-1, 1) AS k
    ) c
   ORDER BY abs(extract(epoch FROM (c.s - v_occ)))
   LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.health_medication_logs
     WHERE medication_id = v_med_id AND scheduled_at = v_slot;
  ELSE
    INSERT INTO public.health_medication_logs (medication_id, managing_user_id, scheduled_at, taken_at)
    VALUES (v_med_id, NULL, v_slot, now())   -- managing_user_id set by sync trigger
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS health_mirror_occurrence_done ON public.item_occurrence_actions;
CREATE TRIGGER health_mirror_occurrence_done
  AFTER INSERT OR UPDATE ON public.item_occurrence_actions
  FOR EACH ROW
  WHEN (NEW.action_type = 'completed')
  EXECUTE FUNCTION public.health_mirror_occurrence_action();

DROP TRIGGER IF EXISTS health_mirror_occurrence_undone ON public.item_occurrence_actions;
CREATE TRIGGER health_mirror_occurrence_undone
  AFTER DELETE ON public.item_occurrence_actions
  FOR EACH ROW
  WHEN (OLD.action_type = 'completed')
  EXECUTE FUNCTION public.health_mirror_occurrence_action();

-- ── 9. get_health_bundle — + medications + medication_logs ──────────────────
-- Same visibility as the other records: own profiles + partner's shared ones.

CREATE OR REPLACE FUNCTION public.get_health_bundle()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  partner_id uuid;
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT CASE
           WHEN owner_user_id = uid THEN partner_user_id
           ELSE owner_user_id
         END
    INTO partner_id
    FROM public.household_links
   WHERE active = true
     AND (owner_user_id = uid OR partner_user_id = uid)
   ORDER BY created_at DESC
   LIMIT 1;

  WITH visible_profiles AS (
    SELECT p.*
      FROM public.health_profiles p
     WHERE p.deleted_at IS NULL
       AND (
            p.managing_user_id = uid
         OR (partner_id IS NOT NULL AND p.managing_user_id = partner_id AND p.shared_with_household = true)
       )
  ),
  visible_meds AS (
    SELECT md.*
      FROM public.health_medications md
      JOIN visible_profiles v ON v.id = md.profile_id
     WHERE md.deleted_at IS NULL
  )
  SELECT jsonb_build_object(
    'profiles',   COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at) FROM visible_profiles v), '[]'::jsonb),
    'allergies',  COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at)
                              FROM public.health_allergies a
                              JOIN visible_profiles v ON v.id = a.profile_id), '[]'::jsonb),
    'conditions', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.occurred_on DESC NULLS LAST, c.created_at DESC)
                              FROM public.health_conditions c
                              JOIN visible_profiles v ON v.id = c.profile_id), '[]'::jsonb),
    'vaccines',   COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.administered_on DESC NULLS LAST, x.created_at DESC)
                              FROM public.health_vaccines x
                              JOIN visible_profiles v ON v.id = x.profile_id), '[]'::jsonb),
    'medications', COALESCE((SELECT jsonb_agg(to_jsonb(md) ORDER BY md.created_at DESC)
                               FROM visible_meds md), '[]'::jsonb),
    'medication_logs', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.taken_at DESC)
                                   FROM public.health_medication_logs l
                                   JOIN visible_meds md ON md.id = l.medication_id
                                  WHERE COALESCE(l.scheduled_at, l.taken_at) >= now() - interval '120 days'), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$function$;

-- ── 10. Verify (read-only) ───────────────────────────────────────────────────
-- select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and relname in ('health_medications','health_medication_logs');
-- select tablename, policyname, permissive, cmd, qual from pg_policies
--  where schemaname = 'public' and tablename in ('health_medications','health_medication_logs');
-- select tgname from pg_trigger where tgrelid = 'public.item_occurrence_actions'::regclass and tgname like 'health_%';
-- select jsonb_object_keys(get_health_bundle());   -- run as a signed-in user: includes medications, medication_logs
