-- ============================================
-- RESET AND SETUP NOTIFICATIONS
-- Run Date: December 19, 2025
-- ============================================
-- This script:
-- 1. Clears all notification-related data for a fresh start
-- 2. Creates default notification preferences for all users
-- 3. Optionally inserts initial daily reminder notifications
-- ============================================

-- ============================================
-- STEP 1: CLEAR ALL NOTIFICATION DATA
-- ============================================

-- Clear notifications table (in-app + push tracking)
TRUNCATE TABLE public.notifications CASCADE;

-- Clear notification preferences (user settings)
TRUNCATE TABLE public.notification_preferences CASCADE;

-- Clear push subscriptions (device registrations)
-- Note: Users will need to re-enable push notifications
TRUNCATE TABLE public.push_subscriptions CASCADE;

-- Clear notification logs (legacy, if exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_logs') THEN
    TRUNCATE TABLE public.notification_logs CASCADE;
  END IF;
END $$;

-- Clear item_snoozes (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'item_snoozes') THEN
    TRUNCATE TABLE public.item_snoozes CASCADE;
  END IF;
END $$;

-- ============================================
-- STEP 2: CREATE DEFAULT PREFERENCES FOR ALL USERS
-- ============================================

-- Insert default daily_transaction_reminder preference for all users
-- Only create preferences for the two target emails
INSERT INTO public.notification_preferences (
  user_id,
  preference_key,
  enabled,
  frequency,
  preferred_time,
  timezone,
  days_of_week,
  metadata
)
SELECT 
  u.id AS user_id,
  'daily_transaction_reminder' AS preference_key,
  true AS enabled,
  'daily' AS frequency,
  '20:00:00'::time AS preferred_time,  -- Default 8 PM
  'UTC' AS timezone,
  ARRAY[1,2,3,4,5,6,7] AS days_of_week,  -- All days
  jsonb_build_object(
    'title', 'Daily Transaction Reminder',
    'description', 'Remind me to log my spending each day',
    'icon', '📝',
    'push_enabled', true,
    'in_app_enabled', true
  ) AS metadata
FROM auth.users u
WHERE u.email IN ('aounelio@gmail.com','rachatouma@gmail.com')
  AND NOT EXISTS (
    SELECT 1 FROM public.notification_preferences np 
    WHERE np.user_id = u.id 
    AND np.preference_key = 'daily_transaction_reminder'
  );

-- Also add weekly_summary preference (disabled by default)
-- Weekly summary preference only for the two target users (optional)
INSERT INTO public.notification_preferences (
  user_id,
  preference_key,
  enabled,
  frequency,
  preferred_time,
  timezone,
  days_of_week,
  metadata
)
SELECT 
  u.id AS user_id,
  'weekly_summary' AS preference_key,
  false AS enabled,  -- Disabled by default
  'weekly' AS frequency,
  '10:00:00'::time AS preferred_time,  -- Sunday 10 AM
  'UTC' AS timezone,
  ARRAY[7] AS days_of_week,  -- Sunday only
  jsonb_build_object(
    'title', 'Weekly Summary',
    'description', 'Get a weekly overview of your spending',
    'icon', '📊',
    'push_enabled', true,
    'in_app_enabled', true
  ) AS metadata
FROM auth.users u
WHERE u.email IN ('aounelio@gmail.com','rachatouma@gmail.com')
  AND NOT EXISTS (
    SELECT 1 FROM public.notification_preferences np 
    WHERE np.user_id = u.id 
    AND np.preference_key = 'weekly_summary'
  );

-- ============================================
-- STEP 3: INSERT INITIAL DAILY REMINDER FOR ALL USERS
-- (Optional - can be triggered by cron instead)
-- ============================================

-- Insert today's daily reminder for all enabled users
-- This gives them an immediate notification to test the system

-- Insert today's daily reminder ONLY for the two target users (via their preferences)
INSERT INTO public.notifications (
  user_id,
  notification_type,
  title,
  message,
  icon,
  severity,
  source,
  priority,
  action_type,
  action_url,
  action_data,
  group_key,
  expires_at
)
SELECT 
  np.user_id,
  'daily_reminder'::notification_type_enum,
  'Did you log all your spending today?' AS title,
  'Take a moment to log your spending. It helps you stay on budget!' AS message,
  '📝' AS icon,
  'info' AS severity,
  'system' AS source,
  'normal'::item_priority_enum AS priority,
  'log_transaction' AS action_type,
  '/expense' AS action_url,
  jsonb_build_object(
    'date', CURRENT_DATE::text,
    'route', '/expense',
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'log', 'label', 'Log Expense', 'route', '/expense'),
      jsonb_build_object('type', 'snooze', 'label', 'Snooze', 'options', ARRAY['1h', '3h', 'tomorrow']),
      jsonb_build_object('type', 'settings', 'label', 'Change Time', 'route', '/settings/notifications')
    )
  ) AS action_data,
  'daily_reminder_' || CURRENT_DATE::text AS group_key,
  (NOW() + INTERVAL '24 hours')::timestamptz AS expires_at
FROM public.notification_preferences np
JOIN auth.users u ON u.id = np.user_id
WHERE np.preference_key = 'daily_transaction_reminder'
  AND np.enabled = true
  AND u.email IN ('aounelio@gmail.com','rachatouma@gmail.com')
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = np.user_id
      AND n.notification_type = 'daily_reminder'
      AND n.group_key = 'daily_reminder_' || CURRENT_DATE::text
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check counts
SELECT 'notifications' as table_name, COUNT(*) as count FROM public.notifications
UNION ALL
SELECT 'notification_preferences', COUNT(*) FROM public.notification_preferences
UNION ALL
SELECT 'push_subscriptions', COUNT(*) FROM public.push_subscriptions;

-- Show created preferences per user
SELECT 
  u.email as user_email,
  np.preference_key,
  np.enabled,
  np.preferred_time,
  np.timezone
FROM public.notification_preferences np
JOIN auth.users u ON u.id = np.user_id
ORDER BY u.email, np.preference_key;
