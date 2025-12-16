-- Migration: Data Retention & Cleanup
-- This implements a tiered data retention policy:
-- 1. Soft-deleted items: Can be undone within 1 day
-- 2. Archived items: Kept for 90 days
-- 3. After 90 days: Permanently purged

-- ============================================
-- FUNCTION: Cleanup soft-deleted messages (1 day -> archive)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move soft-deleted messages to archived after 1 day (undo window expired)
  WITH archived AS (
    UPDATE hub_messages
    SET 
      archived_at = COALESCE(archived_at, NOW()),
      deleted_at = NULL,
      deleted_by = NULL
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '1 day'
    RETURNING id
  )
  SELECT COUNT(*) INTO archived_count FROM archived;
  
  RETURN archived_count;
END;
$$;

-- ============================================
-- FUNCTION: Purge old archived messages (90 days -> delete)
-- ============================================
CREATE OR REPLACE FUNCTION purge_old_archived_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  purged_count INTEGER;
BEGIN
  -- Permanently delete messages archived more than 90 days ago
  -- Excludes transaction messages (keep for audit trail)
  WITH purged AS (
    DELETE FROM hub_messages
    WHERE archived_at IS NOT NULL
      AND archived_at < NOW() - INTERVAL '90 days'
      AND message_type != 'transaction' -- Keep transaction audit trail
    RETURNING id
  )
  SELECT COUNT(*) INTO purged_count FROM purged;
  
  RETURN purged_count;
END;
$$;

-- ============================================
-- FUNCTION: Purge old hidden-for-me messages
-- ============================================
CREATE OR REPLACE FUNCTION purge_hidden_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  purged_count INTEGER;
BEGIN
  -- Permanently delete messages that have been hidden by ALL household members
  -- for more than 30 days
  WITH purged AS (
    DELETE FROM hub_messages m
    WHERE array_length(m.hidden_for, 1) >= 2 -- Hidden by at least 2 people (both partners)
      AND m.created_at < NOW() - INTERVAL '30 days'
      AND m.message_type != 'transaction'
    RETURNING id
  )
  SELECT COUNT(*) INTO purged_count FROM purged;
  
  RETURN purged_count;
END;
$$;

-- ============================================
-- FUNCTION: Purge deleted threads and their messages
-- ============================================
CREATE OR REPLACE FUNCTION purge_deleted_threads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  purged_count INTEGER;
BEGIN
  -- First delete all messages in threads past retention
  DELETE FROM hub_messages
  WHERE thread_id IN (
    SELECT id FROM hub_chat_threads
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '7 days'
  );
  
  -- Then delete the threads
  WITH purged AS (
    DELETE FROM hub_chat_threads
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO purged_count FROM purged;
  
  RETURN purged_count;
END;
$$;

-- ============================================
-- MASTER CLEANUP FUNCTION: Run all cleanups
-- ============================================
CREATE OR REPLACE FUNCTION run_data_cleanup()
RETURNS TABLE(
  soft_deleted_archived INTEGER,
  old_archived_purged INTEGER,
  hidden_purged INTEGER,
  threads_purged INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  soft_deleted_archived := cleanup_soft_deleted_messages();
  old_archived_purged := purge_old_archived_messages();
  hidden_purged := purge_hidden_messages();
  threads_purged := purge_deleted_threads();
  RETURN NEXT;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_soft_deleted_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION purge_old_archived_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION purge_hidden_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION purge_deleted_threads() TO authenticated;
GRANT EXECUTE ON FUNCTION run_data_cleanup() TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION cleanup_soft_deleted_messages() IS 'Moves soft-deleted messages to archived after 1-day undo window. Run daily.';
COMMENT ON FUNCTION purge_old_archived_messages() IS 'Permanently deletes archived messages older than 90 days. Keeps transaction messages. Run weekly.';
COMMENT ON FUNCTION purge_hidden_messages() IS 'Deletes messages hidden by all household members for 30+ days. Run weekly.';
COMMENT ON FUNCTION purge_deleted_threads() IS 'Permanently deletes soft-deleted threads and their messages after 7 days. Run daily.';
COMMENT ON FUNCTION run_data_cleanup() IS 'Master cleanup function that runs all data retention policies. Schedule via pg_cron or external scheduler.';

-- ============================================
-- OPTIONAL: Schedule with pg_cron (if available)
-- ============================================
-- To enable automatic cleanup, run these commands in Supabase SQL editor:
-- 
-- -- Enable pg_cron extension (requires Pro plan)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- -- Schedule daily cleanup at 3 AM UTC
-- SELECT cron.schedule('daily-cleanup', '0 3 * * *', 'SELECT run_data_cleanup()');
--
-- -- Check scheduled jobs
-- SELECT * FROM cron.job;
