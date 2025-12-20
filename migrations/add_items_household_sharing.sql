-- Migration: Allow viewing partner's public items
-- This migration adds RLS policies to allow household partners to view each other's public items

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view own items" ON public.items;

-- Create new SELECT policy that allows:
-- 1. Users to view their own items (both public and private)
-- 2. Users to view their partner's PUBLIC items
CREATE POLICY "Users can view own and partner public items" ON public.items
  FOR SELECT USING (
    -- User's own items
    auth.uid() = user_id
    OR
    -- Partner's public items
    (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
          OR
          (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
        )
      )
    )
  );

-- Also update policies for related tables to allow viewing data for partner's public items

-- reminder_details
DROP POLICY IF EXISTS "Users can view own reminder details" ON public.reminder_details;
CREATE POLICY "Users can view own and partner public reminder details" ON public.reminder_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = reminder_details.item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );

-- event_details
DROP POLICY IF EXISTS "Users can view own event details" ON public.event_details;
CREATE POLICY "Users can view own and partner public event details" ON public.event_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = event_details.item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );

-- item_subtasks
DROP POLICY IF EXISTS "Users can view own item subtasks" ON public.item_subtasks;
CREATE POLICY "Users can view own and partner public item subtasks" ON public.item_subtasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_subtasks.parent_item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );

-- item_alerts
DROP POLICY IF EXISTS "Users can view own item alerts" ON public.item_alerts;
CREATE POLICY "Users can view own and partner public item alerts" ON public.item_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_alerts.item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );

-- item_recurrence_rules
DROP POLICY IF EXISTS "Users can view own item recurrence rules" ON public.item_recurrence_rules;
CREATE POLICY "Users can view own and partner public recurrence rules" ON public.item_recurrence_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_recurrence_rules.item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );

-- item_attachments
DROP POLICY IF EXISTS "Users can view own item attachments" ON public.item_attachments;
CREATE POLICY "Users can view own and partner public item attachments" ON public.item_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_attachments.item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );

-- item_occurrence_actions
DROP POLICY IF EXISTS "Users can view own item occurrence actions" ON public.item_occurrence_actions;
CREATE POLICY "Users can view own and partner public item occurrence actions" ON public.item_occurrence_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_occurrence_actions.item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );

-- item_snoozes
DROP POLICY IF EXISTS "Users can view own item snoozes" ON public.item_snoozes;
CREATE POLICY "Users can view own and partner public item snoozes" ON public.item_snoozes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_snoozes.item_id
      AND (
        items.user_id = auth.uid()
        OR (
          items.is_public = true
          AND EXISTS (
            SELECT 1 FROM public.household_links
            WHERE active = true
            AND (
              (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
              OR
              (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
            )
          )
        )
      )
    )
  );
