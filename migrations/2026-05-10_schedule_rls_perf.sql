-- Schedule RLS Performance Hotfix — 2026-05-10
--
-- Follow-up to 2026-05-09_schedule_hardening.sql.
-- That migration enabled RLS on 12 item child tables. The policies use
-- `auth.uid()` directly, which Postgres re-evaluates per row. Combined with
-- embedded selects in useItems() (item_alerts + item_recurrence_rules +
-- item_recurrence_exceptions + item_subtasks + recurrence_pauses +
-- reminder_details + event_details), this caused /reminders and
-- /activity > Journal to take "forever" to load.
--
-- Fix:
--  1. Wrap `auth.uid()` in `(SELECT auth.uid())` so it becomes a cached
--     InitPlan (Supabase's documented optimization for RLS at scale).
--  2. Add the missing supporting indexes on items + household_links so the
--     EXISTS subqueries inside the policies don't fall back to seq scans.
--
-- This migration is idempotent. Safe to run more than once.

-- ============================================================================
-- 1. SUPPORTING INDEXES (no-op if already present)
-- ============================================================================

-- items: filtered constantly by user_id / responsible_user_id / is_public
CREATE INDEX IF NOT EXISTS idx_items_user_id
  ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_responsible_user_id
  ON public.items(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_items_is_public_user_id
  ON public.items(user_id) WHERE is_public = true;
-- The list query also filters out soft-deleted/archived; partial index helps
CREATE INDEX IF NOT EXISTS idx_items_active_user_id
  ON public.items(user_id)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

-- household_links: hit on every RLS evaluation of every items child row
CREATE INDEX IF NOT EXISTS idx_household_links_owner_active
  ON public.household_links(owner_user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_household_links_partner_active
  ON public.household_links(partner_user_id) WHERE active = true;

-- ============================================================================
-- 2. REWRITE CHILD-TABLE RLS POLICIES WITH (SELECT auth.uid())
--
-- Identical predicate to 2026-05-09, but auth.uid() is wrapped in a subselect
-- so Postgres evaluates it once per query (InitPlan) instead of once per row.
-- This is the official Supabase guidance and typically yields 10-100×
-- speed-ups on tables with many rows visible per request.
-- ============================================================================

-- ---- item_alerts ----------------------------------------------------------
DROP POLICY IF EXISTS "item_alerts_via_parent" ON public.item_alerts;
CREATE POLICY "item_alerts_via_parent" ON public.item_alerts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_alerts.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_recurrence_rules ------------------------------------------------
DROP POLICY IF EXISTS "item_recurrence_rules_via_parent" ON public.item_recurrence_rules;
CREATE POLICY "item_recurrence_rules_via_parent" ON public.item_recurrence_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_recurrence_rules.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_recurrence_exceptions -------------------------------------------
DROP POLICY IF EXISTS "item_recurrence_exceptions_via_parent" ON public.item_recurrence_exceptions;
CREATE POLICY "item_recurrence_exceptions_via_parent" ON public.item_recurrence_exceptions FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.item_recurrence_rules r
    JOIN public.items i ON i.id = r.item_id
    WHERE r.id = item_recurrence_exceptions.rule_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_flexible_schedules ----------------------------------------------
DROP POLICY IF EXISTS "item_flexible_schedules_via_parent" ON public.item_flexible_schedules;
CREATE POLICY "item_flexible_schedules_via_parent" ON public.item_flexible_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_flexible_schedules.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- reminder_details ------------------------------------------------------
DROP POLICY IF EXISTS "reminder_details_via_parent" ON public.reminder_details;
CREATE POLICY "reminder_details_via_parent" ON public.reminder_details FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = reminder_details.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- event_details --------------------------------------------------------
DROP POLICY IF EXISTS "event_details_via_parent" ON public.event_details;
CREATE POLICY "event_details_via_parent" ON public.event_details FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = event_details.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_subtasks --------------------------------------------------------
DROP POLICY IF EXISTS "item_subtasks_via_parent" ON public.item_subtasks;
CREATE POLICY "item_subtasks_via_parent" ON public.item_subtasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_subtasks.parent_item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_attachments -----------------------------------------------------
DROP POLICY IF EXISTS "item_attachments_via_parent" ON public.item_attachments;
CREATE POLICY "item_attachments_via_parent" ON public.item_attachments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_attachments.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_snoozes ---------------------------------------------------------
DROP POLICY IF EXISTS "item_snoozes_via_parent" ON public.item_snoozes;
CREATE POLICY "item_snoozes_via_parent" ON public.item_snoozes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_snoozes.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- recurrence_pauses ----------------------------------------------------
DROP POLICY IF EXISTS "recurrence_pauses_via_parent" ON public.recurrence_pauses;
CREATE POLICY "recurrence_pauses_via_parent" ON public.recurrence_pauses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = recurrence_pauses.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_subtask_completions ---------------------------------------------
DROP POLICY IF EXISTS "item_subtask_completions_via_parent" ON public.item_subtask_completions;
CREATE POLICY "item_subtask_completions_via_parent" ON public.item_subtask_completions FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.item_subtasks st
    JOIN public.items i ON i.id = st.parent_item_id
    WHERE st.id = item_subtask_completions.subtask_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_alert_suppressions ----------------------------------------------
DROP POLICY IF EXISTS "item_alert_suppressions_via_parent" ON public.item_alert_suppressions;
CREATE POLICY "item_alert_suppressions_via_parent" ON public.item_alert_suppressions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_alert_suppressions.item_id AND (
      i.user_id = (SELECT auth.uid())
      OR i.responsible_user_id = (SELECT auth.uid())
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = (SELECT auth.uid()) AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = (SELECT auth.uid()) AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ============================================================================
-- 3. ANALYZE so the planner picks up the new indexes immediately
-- ============================================================================

ANALYZE public.items;
ANALYZE public.household_links;
ANALYZE public.item_alerts;
ANALYZE public.item_recurrence_rules;
ANALYZE public.item_recurrence_exceptions;
ANALYZE public.item_subtasks;
ANALYZE public.recurrence_pauses;
ANALYZE public.reminder_details;
ANALYZE public.event_details;
