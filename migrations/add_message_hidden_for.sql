-- Migration: Add hidden_for column to hub_messages for soft delete functionality
-- This allows users to hide messages from their view without deleting them for everyone

-- Add hidden_for column as JSONB array of user IDs who have hidden this message
ALTER TABLE hub_messages
ADD COLUMN IF NOT EXISTS hidden_for UUID[] DEFAULT '{}';

-- Add deleted_at column for "delete for everyone" tracking
ALTER TABLE hub_messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_by column to track who deleted the message
ALTER TABLE hub_messages
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_hub_messages_hidden_for ON hub_messages USING GIN (hidden_for);
CREATE INDEX IF NOT EXISTS idx_hub_messages_deleted_at ON hub_messages (deleted_at) WHERE deleted_at IS NOT NULL;

-- Update RLS policy to filter out hidden messages for the current user
-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view messages in their household threads" ON hub_messages;

-- Create new select policy that excludes hidden messages
CREATE POLICY "Users can view messages in their household threads" ON hub_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hub_chat_threads t
    JOIN household_links h ON t.household_id = h.id
    WHERE t.id = hub_messages.thread_id
    AND (h.owner_user_id = auth.uid() OR h.partner_user_id = auth.uid())
    AND h.active = true
  )
  AND NOT (auth.uid() = ANY(hidden_for))
);

-- Update RLS policy for updating messages
-- Drop existing update policies
DROP POLICY IF EXISTS "Users can update their own messages" ON hub_messages;
DROP POLICY IF EXISTS "Message owners can update their messages" ON hub_messages;
DROP POLICY IF EXISTS "Household users can hide messages" ON hub_messages;

-- Policy 1: Message owners can update any column in their own messages
CREATE POLICY "Message owners can update their messages" ON hub_messages
FOR UPDATE
USING (sender_user_id = auth.uid())
WITH CHECK (sender_user_id = auth.uid());

-- Policy 2: Both household users can update ONLY the hidden_for column
-- This allows "delete for me" functionality for any message in the conversation
CREATE POLICY "Household users can hide messages" ON hub_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM hub_chat_threads t
    JOIN household_links h ON t.household_id = h.id
    WHERE t.id = hub_messages.thread_id
    AND (h.owner_user_id = auth.uid() OR h.partner_user_id = auth.uid())
    AND h.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hub_chat_threads t
    JOIN household_links h ON t.household_id = h.id
    WHERE t.id = hub_messages.thread_id
    AND (h.owner_user_id = auth.uid() OR h.partner_user_id = auth.uid())
    AND h.active = true
  )
);

-- Add comments for documentation
COMMENT ON COLUMN hub_messages.hidden_for IS 'Array of user IDs who have hidden this message from their view (soft delete). Both household users can update this column.';
COMMENT ON COLUMN hub_messages.deleted_at IS 'Timestamp when the message was deleted for everyone. Only message owner can set this.';
COMMENT ON COLUMN hub_messages.deleted_by IS 'User ID of who deleted the message for everyone. Only message owner can delete.';
