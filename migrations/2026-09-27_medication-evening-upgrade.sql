-- Upgrade an already-applied morning/noon PRN migration to morning/evening.
-- Run manually in the Supabase SQL Editor after 2026-09-27_medication-prn-slots.sql.
-- Historical noon dose logs remain noon; only current medication options change.
-- Transactional and safe to rerun.

BEGIN;

ALTER TABLE public.health_medications
  DROP CONSTRAINT IF EXISTS health_medications_prn_slots_check;

UPDATE public.health_medications
   SET prn_slots = array_replace(prn_slots, 'noon', 'evening'),
       updated_at = now()
 WHERE 'noon' = ANY(prn_slots);

ALTER TABLE public.health_medications
  ADD CONSTRAINT health_medications_prn_slots_check
  CHECK (prn_slots <@ ARRAY['morning','evening']::text[] AND
         (mode = 'as_needed' OR cardinality(prn_slots) = 0));

ALTER TABLE public.health_medication_logs
  DROP CONSTRAINT IF EXISTS health_medication_logs_prn_slot_check;

ALTER TABLE public.health_medication_logs
  ADD CONSTRAINT health_medication_logs_prn_slot_check
  CHECK ((prn_slot IS NULL AND prn_day IS NULL) OR
         (prn_slot IN ('morning','noon','evening') AND
          prn_day IS NOT NULL AND scheduled_at IS NULL));

-- Preserve the existing RPC body and its permissions; change only the
-- as-needed identity mapping. Abort safely if the expected version differs.
DO $upgrade$
DECLARE
  function_sql text;
  old_mapping text := 'WHEN ''13:00'' THEN ''noon''';
  new_mapping text := 'WHEN ''20:00'' THEN ''evening''';
BEGIN
  SELECT pg_get_functiondef(
    'public.health_set_dose(uuid,boolean,timestamptz,uuid,timestamptz)'::regprocedure
  ) INTO function_sql;

  IF position(new_mapping IN function_sql) > 0 THEN
    RETURN;
  END IF;
  IF position(old_mapping IN function_sql) = 0 THEN
    RAISE EXCEPTION 'Unexpected health_set_dose version; no changes applied';
  END IF;

  EXECUTE replace(function_sql, old_mapping, new_mapping);
END;
$upgrade$;

COMMIT;
