-- ============================================
-- UNIFIED NOTIFICATIONS SYSTEM
-- Migration: add_unified_notifications.sql
-- ============================================
-- Run this AFTER drop_old_notification_tables.sql
--
-- This creates a single, unified notifications table that handles:
-- - In-app notifications (Bell icon)
-- - Push notifications (sent to device)
-- - All alert types (system, item, transaction, budget, household, etc.)
--
-- Design principles:
-- 1. ONE table for all notifications/alerts
-- 2. Push and in-app are just delivery channels, not separate systems
-- 3. System-generated notifications (daily reminders) are normal rows
-- 4. No special treatment - everything is a notification
-- ============================================

-- ============================================
-- NOTIFICATION TYPE ENUM (simplified)
-- ============================================

DO $$ BEGIN
  CREATE TYPE notification_type_enum AS ENUM (
    -- System/Cron generated
    'daily_reminder',        -- Daily transaction logging reminder
    'weekly_summary',        -- Weekly spending summary
    'monthly_summary',       -- Monthly spending summary
    
    -- Budget related
    'budget_warning',        -- Approaching budget limit
    'budget_exceeded',       -- Over budget
    
    -- Bills/Payments
    'bill_due',              -- Recurring payment due soon
    'bill_overdue',          -- Missed payment
    
    -- Items (tasks, reminders, events)
    'item_reminder',         -- Reminder for a task/event
    'item_due',              -- Item is due now
    'item_overdue',          -- Missed item
    
    -- Goals
    'goal_milestone',        -- Goal progress milestone
    'goal_completed',        -- Goal achieved
    
    -- Household/Chat
    'chat_message',          -- New message in household chat
    'chat_mention',          -- Mentioned in chat
    
    -- Transactions
    'transaction_pending',   -- Pending transaction needs action
    
    -- General
    'info',                  -- General information
    'success',               -- Success message
    'warning',               -- Warning message
    'error'                  -- Error message
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- UNIFIED NOTIFICATIONS TABLE
-- ============================================

-- Add new columns to the renamed notifications table (was in_app_notifications)
-- This extends it to handle all notification types

-- Add notification_type column
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS notification_type notification_type_enum DEFAULT 'info';

-- Add push notification tracking
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS push_status TEXT CHECK (push_status IS NULL OR push_status IN ('pending', 'sent', 'failed', 'clicked', 'dismissed')),
ADD COLUMN IF NOT EXISTS push_error TEXT;

-- Add severity (from old hub_alerts)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'error', 'action'));

-- Add reference columns for related entities (from old hub_alerts)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS recurring_payment_id UUID REFERENCES public.recurring_payments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.user_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.household_links(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS message_id UUID; -- For chat notifications

-- Add action tracking (simplified)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS action_url TEXT,  -- Where to navigate when clicked
ADD COLUMN IF NOT EXISTS action_taken BOOLEAN DEFAULT FALSE;

-- Add snoozed_until for snooze functionality (replaces item_snoozes for notifications)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- ============================================
-- INDEXES
-- ============================================

-- Main query index: user's active notifications
CREATE INDEX IF NOT EXISTS idx_notifications_active
ON public.notifications(user_id, is_dismissed, is_read, created_at DESC)
WHERE is_dismissed = FALSE;

-- For checking existing notifications by type and date
CREATE INDEX IF NOT EXISTS idx_notifications_type_date
ON public.notifications(user_id, notification_type, created_at DESC);

-- For push notification processing
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
ON public.notifications(push_status, created_at)
WHERE push_status = 'pending';

-- For snoozed notifications
CREATE INDEX IF NOT EXISTS idx_notifications_snoozed
ON public.notifications(user_id, snoozed_until)
WHERE snoozed_until IS NOT NULL AND is_dismissed = FALSE;

-- For item-related notifications
CREATE INDEX IF NOT EXISTS idx_notifications_item
ON public.notifications(item_id)
WHERE item_id IS NOT NULL;

-- For household notifications
CREATE INDEX IF NOT EXISTS idx_notifications_household
ON public.notifications(household_id, created_at DESC)
WHERE household_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark read, dismiss, etc.)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything (for cron jobs, system notifications)
CREATE POLICY "Service role full access" ON public.notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- SIMPLIFIED NOTIFICATION PREFERENCES
-- ============================================

-- Clean up the existing notification_preferences table
-- Keep it simple: just enable/disable and preferred time

-- Ensure unique constraint exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_preference'
    AND conrelid = 'public.notification_preferences'::regclass
  ) THEN
    ALTER TABLE public.notification_preferences 
    ADD CONSTRAINT unique_user_preference UNIQUE (user_id, preference_key);
  END IF;
END $$;

-- Add index for looking up preferences by time (for cron)
CREATE INDEX IF NOT EXISTS idx_notification_prefs_time
ON public.notification_preferences(preference_key, enabled, preferred_time)
WHERE enabled = TRUE;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.notifications
    WHERE user_id = p_user_id
      AND is_dismissed = FALSE
      AND is_read = FALSE
      AND (snoozed_until IS NULL OR snoozed_until <= NOW())
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a notification (helper for cron jobs and system)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type_enum,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT 'bell',
  p_severity TEXT DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL,
  p_group_key TEXT DEFAULT NULL,
  p_expires_in_hours INTEGER DEFAULT NULL,
  p_item_id UUID DEFAULT NULL,
  p_transaction_id UUID DEFAULT NULL,
  p_recurring_payment_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_household_id UUID DEFAULT NULL,
  p_send_push BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration if provided
  IF p_expires_in_hours IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_hours || ' hours')::INTERVAL;
  END IF;

  -- Check for duplicate if group_key provided
  IF p_group_key IS NOT NULL THEN
    SELECT id INTO v_notification_id
    FROM public.notifications
    WHERE user_id = p_user_id 
      AND group_key = p_group_key
      AND is_dismissed = FALSE;
    
    IF v_notification_id IS NOT NULL THEN
      -- Already exists, return existing
      RETURN v_notification_id;
    END IF;
  END IF;

  -- Insert notification
  INSERT INTO public.notifications (
    user_id,
    notification_type,
    title,
    message,
    icon,
    severity,
    action_url,
    group_key,
    expires_at,
    item_id,
    transaction_id,
    recurring_payment_id,
    category_id,
    household_id,
    source,
    priority,
    push_status
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_icon,
    p_severity,
    p_action_url,
    p_group_key,
    v_expires_at,
    p_item_id,
    p_transaction_id,
    p_recurring_payment_id,
    p_category_id,
    p_household_id,
    'system',
    CASE p_severity 
      WHEN 'error' THEN 'urgent'::item_priority_enum
      WHEN 'warning' THEN 'high'::item_priority_enum
      WHEN 'action' THEN 'high'::item_priority_enum
      ELSE 'normal'::item_priority_enum
    END,
    CASE WHEN p_send_push THEN 'pending' ELSE NULL END
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Check if notification already exists for today (useful for daily reminders)
CREATE OR REPLACE FUNCTION notification_exists_today(
  p_user_id UUID,
  p_type notification_type_enum
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = p_user_id
      AND notification_type = p_type
      AND created_at >= CURRENT_DATE
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.notifications IS 'Unified notifications/alerts table. Handles both in-app (bell icon) and push notifications.';
COMMENT ON COLUMN public.notifications.notification_type IS 'The type/category of notification. Used for filtering and grouping.';
COMMENT ON COLUMN public.notifications.push_status IS 'Status of push notification delivery: pending, sent, failed, clicked, dismissed';
COMMENT ON COLUMN public.notifications.severity IS 'Visual severity: info (blue), success (green), warning (yellow), error (red), action (requires action)';
COMMENT ON COLUMN public.notifications.snoozed_until IS 'If set, notification is hidden until this time';
COMMENT ON COLUMN public.notifications.group_key IS 'Used to prevent duplicate notifications (e.g., daily_reminder_2024-12-19)';

-- ============================================
-- MIGRATE EXISTING DATA (if hub_alerts had data)
-- ============================================
-- Note: The drop migration runs first, so hub_alerts data would need to be 
-- migrated BEFORE running drop. If you need to preserve hub_alerts data,
-- run this migration FIRST, then migrate data, then drop.

-- Example migration (run manually if needed before drop):
-- INSERT INTO public.notifications (user_id, notification_type, title, message, severity, ...)
-- SELECT user_id, 
--   CASE alert_type 
--     WHEN 'bill_due' THEN 'bill_due'::notification_type_enum
--     WHEN 'budget_warning' THEN 'budget_warning'::notification_type_enum
--     ...
--   END,
--   title, message, severity, ...
-- FROM public.hub_alerts;
