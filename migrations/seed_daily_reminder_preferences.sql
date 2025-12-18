-- Migration: Seed default daily_transaction_reminder preference for specific users
-- This creates a notification_preferences entry for each user so the reminder works

-- Insert a daily_transaction_reminder preference for specific users
INSERT INTO public.notification_preferences (user_id, preference_key, enabled, preferred_time, timezone, frequency)
VALUES 
  ('1cb9c50a-2a41-4fb3-8e90-2e270ca28830'::uuid, 'daily_transaction_reminder', true, '18:00:00'::time, 'UTC', 'daily'),
  ('c23cd730-b468-4b2f-8db0-8c8100f79f4b'::uuid, 'daily_transaction_reminder', true, '18:00:00'::time, 'UTC', 'daily')
ON CONFLICT (user_id, preference_key) DO NOTHING;

-- Note: To auto-create preferences for new users, add this to your signup/auth handler:
-- INSERT INTO notification_preferences (user_id, preference_key, enabled, preferred_time, timezone, frequency)
-- VALUES (newUserId, 'daily_transaction_reminder', true, '18:00:00', 'UTC', 'daily');

