-- Schedule Module Hardening — 2026-05-09
--
-- Bug fixes:
--  1. Alerts could fire for soft-deleted/archived items because the cron didn't
--     filter, and there was no per-occurrence alert suppression for cancelled
--     or skipped occurrences of recurring items.
--  2. Child tables (item_alerts, item_recurrence_rules, item_recurrence_exceptions,
--     item_flexible_schedules, reminder_details, event_details, item_subtasks,
--     item_attachments, item_snoozes, recurrence_pauses) lacked RLS — protected
--     only by API routes, exposed under direct PostgREST access.
--
-- This migration is idempotent (safe to run more than once).

-- ============================================================================
-- 1. PER-OCCURRENCE LINKAGE FOR ALERTS
-- ============================================================================

ALTER TABLE public.item_alerts
  ADD COLUMN IF NOT EXISTS occurrence_date timestamp with time zone;

COMMENT ON COLUMN public.item_alerts.occurrence_date IS
  'For recurring items, the specific occurrence this alert is firing for. '
  'NULL for one-shot alerts. Cron checks (item_id, occurrence_date) against '
  'item_occurrence_actions and item_alert_suppressions to decide whether to fire.';

-- ============================================================================
-- 2. ALERT SUPPRESSIONS (cancel/skip recurring occurrences mute alerts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.item_alert_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  occurrence_date timestamp with time zone NOT NULL,
  reason text NOT NULL CHECK (reason IN ('cancelled','skipped','deleted','archived','manual')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT item_alert_suppressions_unique UNIQUE (item_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_item_alert_suppressions_item_occ
  ON public.item_alert_suppressions(item_id, occurrence_date);

-- ============================================================================
-- 3. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_item_alerts_item_id
  ON public.item_alerts(item_id);

CREATE INDEX IF NOT EXISTS idx_item_alerts_active_trigger
  ON public.item_alerts(active, trigger_at) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_item_occurrence_actions_item_occ
  ON public.item_occurrence_actions(item_id, occurrence_date);

CREATE INDEX IF NOT EXISTS idx_item_recurrence_rules_item_id
  ON public.item_recurrence_rules(item_id);

CREATE INDEX IF NOT EXISTS idx_item_flexible_schedules_item_period
  ON public.item_flexible_schedules(item_id, period_start_date);

CREATE INDEX IF NOT EXISTS idx_reminder_details_due_at
  ON public.reminder_details(due_at);

CREATE INDEX IF NOT EXISTS idx_event_details_start_at
  ON public.event_details(start_at);

-- ============================================================================
-- 4. CONSTRAINT HARDENING
-- ============================================================================

-- Ensure 'postponed' actions always carry a postponed_to date.
-- Back-fill any dirty historical rows first (postponed_to was never required
-- before this migration — best fallback is the occurrence_date itself).
UPDATE public.item_occurrence_actions
  SET postponed_to = occurrence_date
WHERE action_type = 'postponed' AND postponed_to IS NULL;

-- Drop any pre-existing variant of the constraint, then re-add.
ALTER TABLE public.item_occurrence_actions
  DROP CONSTRAINT IF EXISTS check_postponed_to;
ALTER TABLE public.item_occurrence_actions
  ADD CONSTRAINT check_postponed_to
  CHECK (action_type <> 'postponed' OR postponed_to IS NOT NULL);

-- ============================================================================
-- 5. ROW LEVEL SECURITY ON CHILD TABLES
--
-- Pattern: each child table mirrors items_select via parent join.
-- Items access predicate: own item OR responsible OR (public AND linked household).
-- ============================================================================

-- Helper macro inlined per-table because Postgres doesn't have policy templates.

-- ---- item_alerts ----------------------------------------------------------
ALTER TABLE public.item_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_alerts_via_parent" ON public.item_alerts;
CREATE POLICY "item_alerts_via_parent" ON public.item_alerts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_alerts.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_recurrence_rules ------------------------------------------------
ALTER TABLE public.item_recurrence_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_recurrence_rules_via_parent" ON public.item_recurrence_rules;
CREATE POLICY "item_recurrence_rules_via_parent" ON public.item_recurrence_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_recurrence_rules.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_recurrence_exceptions (joins through rule -> item) -------------
ALTER TABLE public.item_recurrence_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_recurrence_exceptions_via_parent" ON public.item_recurrence_exceptions;
CREATE POLICY "item_recurrence_exceptions_via_parent" ON public.item_recurrence_exceptions FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.item_recurrence_rules r
    JOIN public.items i ON i.id = r.item_id
    WHERE r.id = item_recurrence_exceptions.rule_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_flexible_schedules ----------------------------------------------
ALTER TABLE public.item_flexible_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_flexible_schedules_via_parent" ON public.item_flexible_schedules;
CREATE POLICY "item_flexible_schedules_via_parent" ON public.item_flexible_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_flexible_schedules.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- reminder_details ------------------------------------------------------
ALTER TABLE public.reminder_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminder_details_via_parent" ON public.reminder_details;
CREATE POLICY "reminder_details_via_parent" ON public.reminder_details FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = reminder_details.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- event_details --------------------------------------------------------
ALTER TABLE public.event_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_details_via_parent" ON public.event_details;
CREATE POLICY "event_details_via_parent" ON public.event_details FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = event_details.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_subtasks --------------------------------------------------------
ALTER TABLE public.item_subtasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_subtasks_via_parent" ON public.item_subtasks;
CREATE POLICY "item_subtasks_via_parent" ON public.item_subtasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_subtasks.parent_item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_attachments -----------------------------------------------------
ALTER TABLE public.item_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_attachments_via_parent" ON public.item_attachments;
CREATE POLICY "item_attachments_via_parent" ON public.item_attachments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_attachments.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_snoozes ---------------------------------------------------------
ALTER TABLE public.item_snoozes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_snoozes_via_parent" ON public.item_snoozes;
CREATE POLICY "item_snoozes_via_parent" ON public.item_snoozes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_snoozes.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- recurrence_pauses ----------------------------------------------------
ALTER TABLE public.recurrence_pauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurrence_pauses_via_parent" ON public.recurrence_pauses;
CREATE POLICY "recurrence_pauses_via_parent" ON public.recurrence_pauses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = recurrence_pauses.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_subtask_completions (joins through subtask -> item) -------------
ALTER TABLE public.item_subtask_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_subtask_completions_via_parent" ON public.item_subtask_completions;
CREATE POLICY "item_subtask_completions_via_parent" ON public.item_subtask_completions FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.item_subtasks st
    JOIN public.items i ON i.id = st.parent_item_id
    WHERE st.id = item_subtask_completions.subtask_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));

-- ---- item_alert_suppressions (new table) ----------------------------------
ALTER TABLE public.item_alert_suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_alert_suppressions_via_parent" ON public.item_alert_suppressions;
CREATE POLICY "item_alert_suppressions_via_parent" ON public.item_alert_suppressions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i WHERE i.id = item_alert_suppressions.item_id AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (i.is_public = true AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      ))
    )
  ));
