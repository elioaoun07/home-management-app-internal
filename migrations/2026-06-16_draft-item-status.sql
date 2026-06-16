-- migrations/2026-06-16_draft-item-status.sql
-- Adds a 'draft' status to items, for the Hub Chat bulk-convert flow: messages
-- converted in bulk that are unconfirmed, or confirmed but missing required
-- fields, are saved as draft schedule items instead of being lost or forced
-- through incomplete. Mirrors transactions.is_draft (see src/features/drafts/).
--
-- get_schedule_bundle is taught to exclude draft items by default (same
-- pattern as the existing include_archived param), so drafts stay out of the
-- normal Reminders/Schedule views until reviewed in the new Draft Reminders
-- drawer (status='draft', include_drafts=true).
--
-- Run this whole file once in the Supabase SQL Editor.

-- 1. Add 'draft' to whatever enum backs items.status. Resolved dynamically
--    because schema.sql's visualizer export does not capture enum type names
--    for columns without a DEFAULT (items.status has none).
DO $$
DECLARE
  v_enum_type regtype;
BEGIN
  SELECT atttypid::regtype INTO v_enum_type
  FROM pg_attribute
  WHERE attrelid = 'public.items'::regclass
    AND attname = 'status'
    AND NOT attisdropped;

  IF v_enum_type IS NULL THEN
    RAISE EXCEPTION 'Could not resolve items.status column type';
  END IF;

  EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', v_enum_type, 'draft');
END $$;

-- 2. get_schedule_bundle gains a new parameter, so the old 1-arg overload
--    must be dropped first or PostgREST calls with only include_archived
--    become ambiguous between the two signatures.
DROP FUNCTION IF EXISTS public.get_schedule_bundle(boolean);

CREATE OR REPLACE FUNCTION public.get_schedule_bundle(
  include_archived boolean DEFAULT false,
  include_drafts boolean DEFAULT false
)
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

  -- Resolve active household partner (if any)
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

  WITH visible_items AS (
    SELECT i.*
      FROM public.items i
     WHERE i.deleted_at IS NULL
       AND (include_archived OR i.archived_at IS NULL)
       AND (include_drafts OR i.status IS DISTINCT FROM 'draft')
       AND (
            i.user_id = uid
         OR (partner_id IS NOT NULL AND i.user_id = partner_id AND i.is_public = true)
       )
  ),
  rd AS (
    SELECT r.*
      FROM public.reminder_details r
      JOIN visible_items v ON v.id = r.item_id
  ),
  ed AS (
    SELECT e.*
      FROM public.event_details e
      JOIN visible_items v ON v.id = e.item_id
  ),
  sub AS (
    SELECT s.*
      FROM public.item_subtasks s
      JOIN visible_items v ON v.id = s.parent_item_id
  ),
  al AS (
    SELECT a.*
      FROM public.item_alerts a
      JOIN visible_items v ON v.id = a.item_id
  ),
  rr AS (
    SELECT r.*,
           COALESCE(
             (SELECT jsonb_agg(to_jsonb(ex))
                FROM public.item_recurrence_exceptions ex
               WHERE ex.rule_id = r.id),
             '[]'::jsonb
           ) AS exceptions
      FROM public.item_recurrence_rules r
      JOIN visible_items v ON v.id = r.item_id
  ),
  rp AS (
    SELECT p.*
      FROM public.recurrence_pauses p
      JOIN visible_items v ON v.id = p.item_id
  )
  SELECT jsonb_build_object(
    'partner_id', partner_id,
    'items', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(v)
        || jsonb_build_object(
             'reminder_details', (SELECT to_jsonb(rd.*) FROM rd WHERE rd.item_id = v.id LIMIT 1),
             'event_details',    (SELECT to_jsonb(ed.*) FROM ed WHERE ed.item_id = v.id LIMIT 1),
             'subtasks',         COALESCE((SELECT jsonb_agg(to_jsonb(sub.*)) FROM sub WHERE sub.parent_item_id = v.id), '[]'::jsonb),
             'alerts',           COALESCE((SELECT jsonb_agg(to_jsonb(al.*))  FROM al  WHERE al.item_id = v.id),        '[]'::jsonb),
             'pauses',           COALESCE((SELECT jsonb_agg(to_jsonb(rp.*))  FROM rp  WHERE rp.item_id = v.id),        '[]'::jsonb),
             'recurrence_rule',  (SELECT to_jsonb(rr.*) FROM rr WHERE rr.item_id = v.id LIMIT 1)
           )
        ORDER BY v.created_at DESC
      )
      FROM visible_items v
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$function$;
