-- Medication as-needed dose opportunities and server-side dose limits.
-- Run manually in the Supabase SQL Editor after 2026-09-26_healthcare-medications.sql.
-- Safe to rerun. Existing as-needed medicines keep unrestricted opportunities.

ALTER TABLE public.health_medications
  ADD COLUMN IF NOT EXISTS prn_slots text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.health_medication_logs
  ADD COLUMN IF NOT EXISTS prn_slot text,
  ADD COLUMN IF NOT EXISTS prn_day date;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'health_medications_prn_slots_check') THEN
    ALTER TABLE public.health_medications ADD CONSTRAINT health_medications_prn_slots_check
      CHECK (prn_slots <@ ARRAY['morning','evening']::text[] AND
             (mode = 'as_needed' OR cardinality(prn_slots) = 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'health_medication_logs_prn_slot_check') THEN
    ALTER TABLE public.health_medication_logs ADD CONSTRAINT health_medication_logs_prn_slot_check
      CHECK ((prn_slot IS NULL AND prn_day IS NULL) OR
             (prn_slot IN ('morning','noon','evening') AND prn_day IS NOT NULL AND scheduled_at IS NULL));
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS health_medication_logs_prn_slot_unique
  ON public.health_medication_logs (medication_id, prn_day, prn_slot)
  WHERE prn_slot IS NOT NULL;

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
  v_slots text[] := ARRAY(
    SELECT slot FROM (
      SELECT DISTINCT value AS slot
      FROM jsonb_array_elements_text(COALESCE(p->'prn_slots', '[]'::jsonb)) AS value
    ) selected
    ORDER BY CASE slot WHEN 'morning' THEN 0 WHEN 'evening' THEN 1 ELSE 2 END
  );
  v_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM now() AT TIME ZONE (p->>'timezone');

  IF p_id IS NULL THEN
    INSERT INTO public.health_medications (
      profile_id, managing_user_id, name, dosage, mode, food_timing, dose_times,
      timezone, starts_at, ends_at, min_hours_between, max_per_day, prn_slots, notes
    ) VALUES (
      (p->>'profile_id')::uuid, uid, p->>'name', NULLIF(p->>'dosage', ''),
      COALESCE(p->>'mode', 'course'), COALESCE(p->>'food_timing', 'any'), v_times,
      p->>'timezone', COALESCE((p->>'starts_at')::timestamptz, now()),
      (p->>'ends_at')::timestamptz, (p->>'min_hours_between')::numeric,
      COALESCE((p->>'max_per_day')::int, NULLIF(cardinality(v_slots), 0)),
      v_slots, NULLIF(p->>'notes', '')
    ) RETURNING * INTO v_row;
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
      max_per_day = COALESCE((p->>'max_per_day')::int, NULLIF(cardinality(v_slots), 0)),
      prn_slots = v_slots,
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

-- For an as-needed medicine, p_scheduled_at identifies a named opportunity:
-- 08:00 in the medication zone = morning; 20:00 = evening. These are identity
-- keys only, not scheduled reminders or a clinical time-of-day boundary.
-- The actual time is stored in taken_at. A per-medication row lock serializes
-- checks so simultaneous taps cannot bypass the gap, daily max, or slot limit.
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
  v_slot text;
  v_day date;
  v_now timestamptz := now();
  v_last timestamptz;
  v_count integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_scheduled_at IS NULL AND p_log_id IS NULL THEN
    RAISE EXCEPTION 'scheduled_at or log_id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO m FROM public.health_medications
   WHERE id = p_medication_id AND managing_user_id = uid AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medication not found' USING ERRCODE = 'P0002';
  END IF;

  IF m.mode = 'as_needed' THEN
    v_day := (v_now AT TIME ZONE m.timezone)::date;
    IF p_scheduled_at IS NOT NULL THEN
      v_slot := CASE to_char(p_scheduled_at AT TIME ZONE m.timezone, 'HH24:MI')
        WHEN '08:00' THEN 'morning'
        WHEN '20:00' THEN 'evening'
        ELSE NULL END;
      IF v_slot IS NULL OR NOT (v_slot = ANY(m.prn_slots)) OR
         (p_scheduled_at AT TIME ZONE m.timezone)::date <> v_day THEN
        RAISE EXCEPTION 'Invalid as-needed dose opportunity' USING ERRCODE = '22023';
      END IF;
    ELSIF cardinality(m.prn_slots) > 0 AND p_taken THEN
      RAISE EXCEPTION 'Choose a dose opportunity' USING ERRCODE = '22023';
    END IF;

    IF p_taken THEN
      -- Same request replay, including one that arrives after a newer dose.
      SELECT * INTO v_log FROM public.health_medication_logs
       WHERE id = v_log_id AND medication_id = m.id;
      IF FOUND THEN
        RETURN jsonb_build_object('log', to_jsonb(v_log));
      END IF;
      IF v_slot IS NOT NULL THEN
        SELECT * INTO v_log FROM public.health_medication_logs
         WHERE medication_id = m.id AND prn_day = v_day AND prn_slot = v_slot;
        IF FOUND THEN
          RETURN jsonb_build_object('log', to_jsonb(v_log));
        END IF;
      END IF;

      SELECT max(taken_at) INTO v_last FROM public.health_medication_logs
       WHERE medication_id = m.id AND scheduled_at IS NULL;
      IF m.min_hours_between IS NOT NULL AND v_last IS NOT NULL AND
         v_now < v_last + m.min_hours_between * interval '1 hour' THEN
        RAISE EXCEPTION 'Minimum hours between doses not reached' USING ERRCODE = '22023';
      END IF;
      IF m.max_per_day IS NOT NULL THEN
        SELECT count(*) INTO v_count FROM public.health_medication_logs
         WHERE medication_id = m.id AND scheduled_at IS NULL
           AND (taken_at AT TIME ZONE m.timezone)::date = v_day;
        IF v_count >= m.max_per_day THEN
          RAISE EXCEPTION 'Daily dose maximum reached' USING ERRCODE = '22023';
        END IF;
      END IF;

      INSERT INTO public.health_medication_logs
        (id, medication_id, managing_user_id, scheduled_at, taken_at, prn_slot, prn_day)
      VALUES (v_log_id, m.id, uid, NULL, v_now, v_slot,
              CASE WHEN v_slot IS NULL THEN NULL ELSE v_day END)
      RETURNING * INTO v_log;
      RETURN jsonb_build_object('log', to_jsonb(v_log));
    END IF;

    DELETE FROM public.health_medication_logs
     WHERE id = p_log_id AND medication_id = m.id;
    RETURN jsonb_build_object('log', NULL);
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Course dose time required' USING ERRCODE = '22023';
  END IF;
  SELECT i.id INTO v_item_id FROM public.items i
   WHERE i.source_medication_id = m.id AND i.deleted_at IS NULL
     AND i.metadata_json->>'medication_dose_time'
         = to_char(p_scheduled_at AT TIME ZONE m.timezone, 'HH24:MI')
   LIMIT 1;

  PERFORM set_config('app.health_mirror_off', 'on', true);
  IF p_taken THEN
    INSERT INTO public.health_medication_logs
      (id, medication_id, managing_user_id, scheduled_at, taken_at)
    VALUES (v_log_id, m.id, uid, p_scheduled_at, COALESCE(p_taken_at, v_now))
    ON CONFLICT DO NOTHING;
    IF v_item_id IS NOT NULL THEN
      INSERT INTO public.item_occurrence_actions
        (item_id, occurrence_date, action_type, created_by)
      VALUES (v_item_id, p_scheduled_at, 'completed', uid)
      ON CONFLICT (item_id, occurrence_date, action_type) DO NOTHING;
    END IF;
    SELECT * INTO v_log FROM public.health_medication_logs
     WHERE medication_id = m.id AND scheduled_at = p_scheduled_at;
    PERFORM set_config('app.health_mirror_off', 'off', true);
    RETURN jsonb_build_object('log', to_jsonb(v_log));
  END IF;

  DELETE FROM public.health_medication_logs
   WHERE medication_id = m.id AND scheduled_at = p_scheduled_at;
  IF v_item_id IS NOT NULL THEN
    DELETE FROM public.item_occurrence_actions
     WHERE item_id = v_item_id AND action_type = 'completed'
       AND occurrence_date > p_scheduled_at - interval '12 hours'
       AND occurrence_date < p_scheduled_at + interval '12 hours';
  END IF;
  PERFORM set_config('app.health_mirror_off', 'off', true);
  RETURN jsonb_build_object('log', NULL);
END;
$function$;
