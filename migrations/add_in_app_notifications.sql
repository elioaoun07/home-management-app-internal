-- ============================================
-- IN-APP NOTIFICATIONS SYSTEM
-- Migration: add_in_app_notifications.sql
-- ============================================
-- This migration adds:
-- 1. In-app notifications table for bell icon notifications
-- 2. Notification preferences for customization
-- 3. Extends hub_alerts with action types

-- ============================================
-- NOTIFICATION ACTION TYPES
-- ============================================

-- Action type enum for notifications that require user interaction
DO $$ BEGIN
  CREATE TYPE notification_action_type_enum AS ENUM (
    'confirm',           -- Simple acknowledgment
    'complete_task',     -- Mark a task as done
    'log_transaction',   -- Prompt to log today's transactions
    'view_details',      -- Navigate to details page
    'snooze',            -- Snooze for later
    'dismiss'            -- Dismiss notification
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Notification source enum
DO $$ BEGIN
  CREATE TYPE notification_source_enum AS ENUM (
    'system',            -- System-generated (daily reminders, etc.)
    'cron',              -- Cron job generated (task reminders, etc.)
    'alert',             -- From hub_alerts
    'item',              -- From items/reminders
    'transaction',       -- Transaction-related
    'budget',            -- Budget warnings/exceeded
    'household'          -- Household/partner related
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- IN-APP NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  message TEXT,
  icon TEXT DEFAULT 'bell', -- Icon identifier or emoji
  
  -- Classification
  source notification_source_enum NOT NULL DEFAULT 'system',
  priority item_priority_enum NOT NULL DEFAULT 'normal',
  
  -- Action configuration
  action_type notification_action_type_enum,
  action_data JSONB, -- Custom data for the action (e.g., redirect URL, item_id, etc.)
  action_completed_at TIMESTAMPTZ,
  
  -- References to related entities
  alert_id UUID REFERENCES public.hub_alerts(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Status tracking
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  
  -- For grouping similar notifications
  group_key TEXT -- e.g., 'daily_log_2024-12-18' to prevent duplicates
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user 
  ON public.in_app_notifications(user_id, is_dismissed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread 
  ON public.in_app_notifications(user_id, is_read, is_dismissed) 
  WHERE is_dismissed = FALSE AND is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_group 
  ON public.in_app_notifications(user_id, group_key) 
  WHERE group_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_pending_action 
  ON public.in_app_notifications(user_id, action_type, action_completed_at) 
  WHERE action_type IS NOT NULL AND action_completed_at IS NULL;

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Preference key (e.g., 'daily_transaction_reminder')
  preference_key TEXT NOT NULL,
  
  -- Enable/disable
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Frequency settings
  frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'custom'
  custom_cron TEXT, -- For custom frequencies (e.g., '0 20 * * *' for 8 PM daily)
  
  -- Time preferences
  preferred_time TIME DEFAULT '20:00:00', -- Default 8 PM
  timezone TEXT DEFAULT 'UTC',
  
  -- Days of week (for weekly frequency)
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- 1=Mon, 7=Sun
  
  -- Quiet hours
  quiet_start TIME,
  quiet_end TIME,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per user per preference
  CONSTRAINT unique_user_preference UNIQUE (user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user 
  ON public.notification_preferences(user_id);

-- ============================================
-- SYSTEM NOTIFICATION TEMPLATES
-- ============================================

-- Store templates for system-generated notifications
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template identification
  template_key TEXT NOT NULL UNIQUE, -- e.g., 'daily_transaction_reminder'
  
  -- Content
  title TEXT NOT NULL,
  message_template TEXT, -- Can include placeholders like {{date}}, {{count}}
  icon TEXT DEFAULT 'bell',
  
  -- Defaults
  default_action_type notification_action_type_enum,
  default_priority item_priority_enum DEFAULT 'normal',
  
  -- Scheduling defaults
  default_frequency TEXT DEFAULT 'daily',
  default_time TIME DEFAULT '20:00:00',
  
  -- Is this a core system notification?
  is_system BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system templates
INSERT INTO public.notification_templates (template_key, title, message_template, icon, default_action_type, default_priority, is_system)
VALUES 
  ('daily_transaction_reminder', 'Log Your Transactions', 'Don''t forget to log your transactions for today! Keeping track helps you stay on budget.', '📝', 'log_transaction', 'normal', TRUE),
  ('weekly_summary', 'Weekly Spending Summary', 'Your weekly spending summary is ready. Tap to view your progress.', '📊', 'view_details', 'low', TRUE),
  ('budget_warning', 'Budget Alert', 'You''re approaching your budget limit for {{category}}.', '⚠️', 'view_details', 'high', TRUE),
  ('budget_exceeded', 'Budget Exceeded', 'You''ve exceeded your budget for {{category}}.', '🚨', 'view_details', 'urgent', TRUE)
ON CONFLICT (template_key) DO NOTHING;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.in_app_notifications
    WHERE user_id = p_user_id
      AND is_dismissed = FALSE
      AND is_read = FALSE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if daily notification already exists
CREATE OR REPLACE FUNCTION has_daily_notification(p_user_id UUID, p_template_key TEXT, p_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.in_app_notifications
    WHERE user_id = p_user_id
      AND group_key = p_template_key || '_' || p_date::TEXT
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can only access their own
CREATE POLICY "Users can view own notifications" ON public.in_app_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.in_app_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" ON public.in_app_notifications
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can delete own notifications" ON public.in_app_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Preferences: Users can manage their own
CREATE POLICY "Users can manage own preferences" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Templates: Anyone can read templates
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view templates" ON public.notification_templates
  FOR SELECT USING (TRUE);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for preferences
CREATE OR REPLACE FUNCTION update_notification_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_preferences_updated ON public.notification_preferences;
CREATE TRIGGER trigger_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_timestamp();
