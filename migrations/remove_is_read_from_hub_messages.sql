-- Remove the redundant is_read column from hub_messages
-- We now use hub_message_receipts for tracking read status per user

ALTER TABLE public.hub_messages DROP COLUMN IF EXISTS is_read;
