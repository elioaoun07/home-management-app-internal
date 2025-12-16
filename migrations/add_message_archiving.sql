-- ============================================
-- MESSAGE ARCHIVING SYSTEM
-- Migration: add_message_archiving.sql
-- ============================================
-- Adds lifecycle management for hub messages with purpose-aware archiving

-- 1. Add archived_at column for soft archiving
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add archived_reason for tracking why it was archived
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS archived_reason TEXT DEFAULT NULL
CHECK (archived_reason IS NULL OR archived_reason IN (
  'shopping_cleared',    -- Shopping item checked and cleared
  'transaction_created', -- Budget message converted to transaction
  'reminder_completed',  -- Reminder date passed and marked done
  'monthly_cleanup',     -- End of month cleanup
  'manual'               -- User manually archived
));

-- 3. Create index for fast filtering of active messages
-- This is the KEY for performance - queries default to archived_at IS NULL
CREATE INDEX IF NOT EXISTS idx_hub_messages_active 
ON public.hub_messages(thread_id, created_at DESC) 
WHERE archived_at IS NULL;

-- 4. Create index for archived messages (for history view)
CREATE INDEX IF NOT EXISTS idx_hub_messages_archived 
ON public.hub_messages(thread_id, archived_at DESC) 
WHERE archived_at IS NOT NULL;

-- 5. Add shopping-specific columns for checked state
-- Moving from localStorage to database for real-time sync
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS checked_by UUID DEFAULT NULL
REFERENCES auth.users(id);

-- 6. Add shopping item URL for hyperlinks to where items can be purchased
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS item_url TEXT DEFAULT NULL;

-- 6b. Add setting to enable/disable item URLs per thread
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS enable_item_urls BOOLEAN DEFAULT FALSE;

-- 6c. Add is_private flag for threads (private = only visible to creator)
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- 6d. Add color for thread visual theming
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

-- 7. Create index for shopping list queries
CREATE INDEX IF NOT EXISTS idx_hub_messages_shopping_checked
ON public.hub_messages(thread_id, checked_at)
WHERE checked_at IS NOT NULL;

-- 8. Function to archive messages based on purpose
CREATE OR REPLACE FUNCTION archive_completed_messages()
RETURNS void AS $$
BEGIN
  -- SHOPPING: No automatic archiving - users manually clear via "Clear completed" button
  -- Open items remain forever, checked items stay until user clears them
  -- This gives full control to users over their shopping lists
  
  -- Archive budget messages with transactions from previous months
  UPDATE hub_messages m
  SET 
    archived_at = NOW(),
    archived_reason = 'transaction_created'
  FROM hub_chat_threads t
  JOIN hub_message_actions a ON a.message_id = m.id
  WHERE m.thread_id = t.id
    AND t.purpose = 'budget'
    AND a.action_type = 'transaction'
    AND m.created_at < DATE_TRUNC('month', NOW())
    AND m.archived_at IS NULL;

  -- Archive reminder messages where reminder date has passed
  UPDATE hub_messages m
  SET 
    archived_at = NOW(),
    archived_reason = 'reminder_completed'
  FROM hub_chat_threads t
  JOIN hub_message_actions a ON a.message_id = m.id
  WHERE m.thread_id = t.id
    AND t.purpose = 'reminder'
    AND a.action_type = 'reminder'
    AND a.created_at < NOW() - INTERVAL '7 days'
    AND m.archived_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 9. Function to archive deleted messages after 1 day if not undone
CREATE OR REPLACE FUNCTION archive_old_deleted_messages()
RETURNS void AS $$
BEGIN
  -- Archive messages that were deleted more than 1 day ago and haven't been undone
  UPDATE hub_messages
  SET 
    archived_at = NOW(),
    archived_reason = 'manual'
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '1 day'
    AND archived_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create scheduled jobs to run cleanup (if using pg_cron)
-- SELECT cron.schedule('archive-messages', '0 3 * * *', 'SELECT archive_completed_messages()');
-- SELECT cron.schedule('archive-deleted-messages', '0 */6 * * *', 'SELECT archive_old_deleted_messages()');
-- The deleted messages archival runs every 6 hours to archive messages that are older than 1 day

-- 10. Function to hard delete very old archived messages (6+ months)
-- Run manually or via cron - keeps database lean
CREATE OR REPLACE FUNCTION purge_old_archived_messages()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete messages archived more than 6 months ago
  -- IMPORTANT: Only deletes if no active references
  WITH deleted AS (
    DELETE FROM hub_messages
    WHERE archived_at IS NOT NULL
      AND archived_at < NOW() - INTERVAL '6 months'
      AND id NOT IN (
        -- Preserve messages with active transaction references
        SELECT message_id FROM hub_message_actions WHERE transaction_id IS NOT NULL
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10. Add RLS policy updates for archived messages
-- Users can still view their archived messages
DROP POLICY IF EXISTS "Users can view archived messages in their household" ON hub_messages;

-- 11. Comments for documentation
COMMENT ON COLUMN hub_messages.archived_at IS 'When the message was archived. NULL means active/visible.';
COMMENT ON COLUMN hub_messages.archived_reason IS 'Why the message was archived (shopping_cleared, transaction_created, etc.)';
COMMENT ON COLUMN hub_messages.checked_at IS 'For shopping lists: when the item was checked off (strikethrough).';
COMMENT ON COLUMN hub_messages.checked_by IS 'For shopping lists: who checked the item. Only checked items can be archived via "Clear completed".';
COMMENT ON FUNCTION archive_completed_messages() IS 'Archives messages based on their thread purpose lifecycle. Shopping items are NOT auto-archived.';
COMMENT ON FUNCTION purge_old_archived_messages() IS 'Hard deletes very old archived messages to keep database lean.';
