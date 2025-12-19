-- ============================================
-- DROP OLD NOTIFICATION TABLES
-- Migration: drop_old_notification_tables.sql
-- ============================================
-- Run this FIRST before adding the new unified notifications table
-- 
-- This removes the fragmented notification system:
-- - hub_alerts (merged into notifications)
-- - notification_logs (merged into notifications)
-- - notification_templates (not needed, handled in code)
-- ============================================

-- Step 1: Drop foreign key constraints that reference these tables

-- Drop hub_alerts references
ALTER TABLE IF EXISTS public.hub_messages DROP CONSTRAINT IF EXISTS hub_messages_alert_id_fkey;
ALTER TABLE IF EXISTS public.in_app_notifications DROP CONSTRAINT IF EXISTS in_app_notifications_alert_id_fkey;

-- Step 2: Drop indexes

-- hub_alerts indexes
DROP INDEX IF EXISTS idx_hub_alerts_user;
DROP INDEX IF EXISTS idx_hub_alerts_active;
DROP INDEX IF EXISTS idx_hub_alerts_notification;

-- notification_logs indexes
DROP INDEX IF EXISTS idx_notification_logs_user;
DROP INDEX IF EXISTS idx_notification_logs_subscription;
DROP INDEX IF EXISTS idx_notification_logs_status;
DROP INDEX IF EXISTS idx_notification_logs_alert;

-- notification_templates indexes
DROP INDEX IF EXISTS idx_notification_templates_key;

-- Step 3: Drop RLS policies

-- hub_alerts policies
DROP POLICY IF EXISTS "Users can view their alerts" ON public.hub_alerts;
DROP POLICY IF EXISTS "Users can update their alerts" ON public.hub_alerts;
DROP POLICY IF EXISTS "System can insert alerts" ON public.hub_alerts;
DROP POLICY IF EXISTS "Users can view own alerts" ON public.hub_alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.hub_alerts;

-- notification_logs policies
DROP POLICY IF EXISTS "Users can view their notification logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Users can view own logs" ON public.notification_logs;
DROP POLICY IF EXISTS "System can insert logs" ON public.notification_logs;

-- Step 4: Drop the tables

DROP TABLE IF EXISTS public.notification_logs CASCADE;
DROP TABLE IF EXISTS public.notification_templates CASCADE;
DROP TABLE IF EXISTS public.hub_alerts CASCADE;

-- Step 5: Drop old enums that are no longer needed (optional, safe to keep)
-- We keep notification_action_type_enum and notification_source_enum as they're still useful

-- Step 6: Rename in_app_notifications to notifications (simpler name)
-- Note: This preserves all existing data

ALTER TABLE IF EXISTS public.in_app_notifications RENAME TO notifications;

-- Update indexes to use new table name
ALTER INDEX IF EXISTS idx_in_app_notifications_user RENAME TO idx_notifications_user;
ALTER INDEX IF EXISTS idx_in_app_notifications_unread RENAME TO idx_notifications_unread;
ALTER INDEX IF EXISTS idx_in_app_notifications_group RENAME TO idx_notifications_group;
ALTER INDEX IF EXISTS idx_in_app_notifications_pending_action RENAME TO idx_notifications_pending;

-- Update sequence if exists
ALTER SEQUENCE IF EXISTS in_app_notifications_id_seq RENAME TO notifications_id_seq;

-- Step 7: Clean up RLS policies on renamed table
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.in_app_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.in_app_notifications;
DROP POLICY IF EXISTS "Service role full access notifications" ON public.in_app_notifications;

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, verify with:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('hub_alerts', 'notification_logs', 'notification_templates', 'notifications', 'in_app_notifications');
-- 
-- Expected result: Only 'notifications' should exist
