-- 2026-05-05 — Schedule coherence
-- 1. CASCADE deletes from items so alerts/details/subtasks/recurrence/notifications cleanup properly.
-- 2. Promote location_context + location_text to items (drop location_text from event_details).
-- 3. Track actual completion time on reminder_details.
-- 4. Fix RLS policies on items that referenced non-existent notify_all_household column.
-- 5. Fix item_occurrence_actions RLS (same notify_all_household reference).

BEGIN;

-- ===========================================================================
-- 1. ON DELETE CASCADE — child tables of items
-- ===========================================================================
ALTER TABLE public.reminder_details
  DROP CONSTRAINT IF EXISTS reminder_details_item_id_fkey,
  ADD  CONSTRAINT reminder_details_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.event_details
  DROP CONSTRAINT IF EXISTS event_details_item_id_fkey,
  ADD  CONSTRAINT event_details_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_subtasks
  DROP CONSTRAINT IF EXISTS item_subtasks_parent_item_id_fkey,
  ADD  CONSTRAINT item_subtasks_parent_item_id_fkey
    FOREIGN KEY (parent_item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_subtasks
  DROP CONSTRAINT IF EXISTS item_subtasks_parent_subtask_id_fkey,
  ADD  CONSTRAINT item_subtasks_parent_subtask_id_fkey
    FOREIGN KEY (parent_subtask_id) REFERENCES public.item_subtasks(id) ON DELETE CASCADE;

ALTER TABLE public.item_alerts
  DROP CONSTRAINT IF EXISTS item_alerts_item_id_fkey,
  ADD  CONSTRAINT item_alerts_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_recurrence_rules
  DROP CONSTRAINT IF EXISTS item_recurrence_rules_item_id_fkey,
  ADD  CONSTRAINT item_recurrence_rules_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_recurrence_exceptions
  DROP CONSTRAINT IF EXISTS item_recurrence_exceptions_rule_id_fkey,
  ADD  CONSTRAINT item_recurrence_exceptions_rule_id_fkey
    FOREIGN KEY (rule_id) REFERENCES public.item_recurrence_rules(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS in_app_notifications_item_id_fkey,
  ADD  CONSTRAINT in_app_notifications_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_occurrence_actions
  DROP CONSTRAINT IF EXISTS item_occurrence_actions_item_id_fkey,
  ADD  CONSTRAINT item_occurrence_actions_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_attachments
  DROP CONSTRAINT IF EXISTS item_attachments_item_id_fkey,
  ADD  CONSTRAINT item_attachments_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_snoozes
  DROP CONSTRAINT IF EXISTS item_snoozes_item_id_fkey,
  ADD  CONSTRAINT item_snoozes_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.item_snoozes
  DROP CONSTRAINT IF EXISTS item_snoozes_alert_id_fkey,
  ADD  CONSTRAINT item_snoozes_alert_id_fkey
    FOREIGN KEY (alert_id) REFERENCES public.item_alerts(id) ON DELETE CASCADE;

ALTER TABLE public.item_subtask_completions
  DROP CONSTRAINT IF EXISTS item_subtask_completions_subtask_id_fkey,
  ADD  CONSTRAINT item_subtask_completions_subtask_id_fkey
    FOREIGN KEY (subtask_id) REFERENCES public.item_subtasks(id) ON DELETE CASCADE;

-- ===========================================================================
-- 2. Promote location_context + location_text to items (universal)
--    NOTE: event_details.location_text is kept for backward compatibility.
--    For events, write to BOTH items.location_text AND event_details.location_text
--    until consumers migrate to items.location_text as the single source of truth.
-- ===========================================================================
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS location_context text
    CHECK (location_context IS NULL OR location_context = ANY (ARRAY['home'::text, 'outside'::text, 'anywhere'::text])),
  ADD COLUMN IF NOT EXISTS location_text text;

-- Backfill items.location_text from event_details for existing events
UPDATE public.items i
   SET location_text = ed.location_text
  FROM public.event_details ed
 WHERE ed.item_id = i.id
   AND ed.location_text IS NOT NULL
   AND i.location_text IS NULL;

-- ===========================================================================
-- 3. Track actual completion time on reminder_details
-- ===========================================================================
ALTER TABLE public.reminder_details
  ADD COLUMN IF NOT EXISTS actual_minutes integer
    CHECK (actual_minutes IS NULL OR actual_minutes >= 0);

-- ===========================================================================
-- 4. Fix items RLS — remove notify_all_household reference (column doesn't exist)
--    Effect: any household partner can update/delete public items (matches spec).
-- ===========================================================================
DROP POLICY IF EXISTS "items_update" ON public.items;
DROP POLICY IF EXISTS "items_delete" ON public.items;

CREATE POLICY "items_update" ON public.items FOR UPDATE USING (
  user_id = auth.uid()
  OR responsible_user_id = auth.uid()
  OR (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
      )
    )
  )
);

CREATE POLICY "items_delete" ON public.items FOR DELETE USING (
  user_id = auth.uid()
  OR (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
      )
    )
  )
);

-- ===========================================================================
-- 5. Fix item_occurrence_actions INSERT policy — same notify_all_household issue
-- ===========================================================================
DROP POLICY IF EXISTS "item_occurrence_actions_insert" ON public.item_occurrence_actions;

CREATE POLICY "item_occurrence_actions_insert" ON public.item_occurrence_actions FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_occurrence_actions.item_id
    AND (
      i.user_id = auth.uid()
      OR i.responsible_user_id = auth.uid()
      OR (
        i.is_public = true
        AND EXISTS (
          SELECT 1 FROM public.household_links
          WHERE active = true
          AND (
            (owner_user_id = auth.uid() AND partner_user_id = i.user_id)
            OR (partner_user_id = auth.uid() AND owner_user_id = i.user_id)
          )
        )
      )
    )
  )
);

COMMIT;
