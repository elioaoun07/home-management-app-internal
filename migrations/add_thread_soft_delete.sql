-- Migration: Add soft delete support for hub_chat_threads
-- This allows deleting chats with a 1-day undo window

-- Add deleted_at column to hub_chat_threads
ALTER TABLE hub_chat_threads
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of non-deleted threads
CREATE INDEX IF NOT EXISTS idx_hub_chat_threads_deleted_at 
ON hub_chat_threads (deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN hub_chat_threads.deleted_at IS 'Timestamp when the thread was soft deleted. Can be undone within 1 day. NULL means not deleted.';

-- Function to permanently delete threads after undo window expires
-- This can be called by a cron job or scheduled task
CREATE OR REPLACE FUNCTION cleanup_deleted_threads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- First, delete all messages in threads that are past the undo window
  DELETE FROM hub_messages
  WHERE thread_id IN (
    SELECT id FROM hub_chat_threads
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '1 day'
  );
  
  -- Then delete the threads themselves
  WITH deleted AS (
    DELETE FROM hub_chat_threads
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '1 day'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_deleted_threads() TO authenticated;

-- Function to archive deleted messages after undo window expires
-- This moves soft-deleted messages to archived state instead of permanent deletion
CREATE OR REPLACE FUNCTION cleanup_deleted_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Archive messages that have been soft-deleted for more than 1 day
  WITH archived AS (
    UPDATE hub_messages
    SET 
      archived_at = NOW(),
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_deleted_messages() TO authenticated;

-- Add comments
COMMENT ON FUNCTION cleanup_deleted_threads() IS 'Permanently deletes threads that have been soft-deleted for more than 1 day. Should be run by a scheduled task.';
COMMENT ON FUNCTION cleanup_deleted_messages() IS 'Archives messages that have been soft-deleted for more than 1 day. Should be run by a scheduled task.';
