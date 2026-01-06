-- Migration: Move preferred_time to metadata.preferred_times
-- This migrates the single preferred_time column value into the metadata.preferred_times array
-- Run this ONCE to migrate existing data

-- Step 1: Update all notification_preferences that have preferred_time but no preferred_times in metadata
UPDATE notification_preferences
SET metadata = jsonb_set(
  COALESCE(metadata::jsonb, '{}'::jsonb),
  '{preferred_times}',
  to_jsonb(ARRAY[preferred_time::text])
)
WHERE preference_key = 'daily_transaction_reminder'
  AND metadata IS NOT NULL
  AND NOT (metadata::jsonb ? 'preferred_times');

-- Step 2: For records with NULL metadata, create new metadata with preferred_times
UPDATE notification_preferences
SET metadata = jsonb_build_object(
  'icon', '📝',
  'title', 'Daily Transaction Reminder',
  'description', 'Remind me to log my spending each day',
  'push_enabled', true,
  'in_app_enabled', true,
  'preferred_times', ARRAY[COALESCE(preferred_time::text, '20:00:00')]
)
WHERE preference_key = 'daily_transaction_reminder'
  AND metadata IS NULL;

-- Step 3 (OPTIONAL): If you want to remove the preferred_time column entirely
-- WARNING: Only run this after verifying the migration worked and updating all code
-- ALTER TABLE notification_preferences DROP COLUMN preferred_time;

-- Verification query - run this to check the migration worked:
-- SELECT id, user_id, preferred_time, metadata->>'preferred_times' as preferred_times_in_metadata
-- FROM notification_preferences
-- WHERE preference_key = 'daily_transaction_reminder';
