-- Cleanup script: Remove transaction_reminder_settings table
-- Run this if you accidentally created the transaction_reminder_settings table
-- This is NOT needed since we use the existing notification_preferences table

-- Drop the table if it exists (cascades to drop indexes, triggers, policies)
DROP TABLE IF EXISTS public.transaction_reminder_settings CASCADE;

-- Drop the helper functions if they exist
DROP FUNCTION IF EXISTS increment_transaction_reminder_confirmations(uuid);
DROP FUNCTION IF EXISTS increment_transaction_reminder_sent(uuid);
DROP FUNCTION IF EXISTS update_transaction_reminder_settings_updated_at();
