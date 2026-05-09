-- 2026-05-11_schedule_bundle_rpc.sql
-- Single-round-trip bundle for the Schedule / Items / Journal page.
--
-- Why
-- ----
-- After 2026-05-09 enabled RLS on every items child table, the client's
-- 7-round-trip fan-out (items + 6 children, each paying an EXISTS-on-items
-- RLS predicate) became the dominant cost on /reminders and Activity > Journal.
-- Benchmark (50 items): ~1.3s cold, ~930ms warm even with RLS bypassed —
-- because PostgREST round-trip cost alone is ~170-200ms × 7.
--
-- This migration introduces a SECURITY DEFINER RPC that:
--   1. Resolves the active household partner once.
--   2. Selects items + all children in a SINGLE query using JSON aggregation.
--   3. Enforces ownership inside the function (so it's safe to be definer).
--
-- Result: 7 round-trips → 1 round-trip, ~5–10× faster end to end.
--
-- Idempotent: safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- Drop any prior version so signature changes apply cleanly
-- ───────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_schedule_bundle(boolean);
DROP FUNCTION IF EXISTS public.get_schedule_bundle();

-- ───────────────────────────────────────────────────────────────────────────
-- get_schedule_bundle(include_archived bool default false)
--   Returns: jsonb { items: [...], partner_id: uuid|null }
--   Each item has all children embedded:
--     reminder_details, event_details, subtasks, alerts,
--     recurrence_rule (with exceptions), pauses
--
-- Security model:
--   - SECURITY DEFINER → bypasses per-table RLS for performance.
--   - WHERE clause inside the function enforces ownership:
--       * items owned by auth.uid(), OR
--       * items owned by the partner AND is_public = true.
--   - Children are joined to the already-filtered items CTE, so they
--     inherit the same ownership window.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_schedule_bundle(
  include_archived boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
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
$$;

-- Allow authenticated users to call it. RLS bypass is intentional and gated
-- by the WHERE clause inside the function.
REVOKE ALL ON FUNCTION public.get_schedule_bundle(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_schedule_bundle(boolean) TO authenticated;

-- Supporting indexes for the joins (idempotent)
CREATE INDEX IF NOT EXISTS idx_items_user_archived_deleted
  ON public.items (user_id, archived_at, deleted_at);
CREATE INDEX IF NOT EXISTS idx_items_partner_lookup
  ON public.items (user_id, is_public)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminder_details_item_id
  ON public.reminder_details (item_id);
CREATE INDEX IF NOT EXISTS idx_event_details_item_id
  ON public.event_details (item_id);
CREATE INDEX IF NOT EXISTS idx_item_subtasks_parent_item_id
  ON public.item_subtasks (parent_item_id);
CREATE INDEX IF NOT EXISTS idx_item_alerts_item_id
  ON public.item_alerts (item_id);
CREATE INDEX IF NOT EXISTS idx_item_recurrence_rules_item_id
  ON public.item_recurrence_rules (item_id);
CREATE INDEX IF NOT EXISTS idx_item_recurrence_exceptions_rule_id
  ON public.item_recurrence_exceptions (rule_id);
CREATE INDEX IF NOT EXISTS idx_recurrence_pauses_item_id
  ON public.recurrence_pauses (item_id);
