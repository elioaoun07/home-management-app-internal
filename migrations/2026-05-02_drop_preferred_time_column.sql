-- Drop the redundant `preferred_time` column from notification_preferences.
-- Reminder times are now stored exclusively in `metadata.preferred_times`
-- (an array of HH:MM:SS strings, interpreted in the user's `timezone`).
--
-- Safe to run after deploying the code that no longer reads/writes this column:
--   - src/app/api/notifications/preferences/route.ts (no longer writes it)
--   - src/components/settings/NotificationSettings.tsx (no longer reads fallback)
--   - cron routes only ever read `metadata.preferred_times`

ALTER TABLE public.notification_preferences
  DROP COLUMN IF EXISTS preferred_time;
