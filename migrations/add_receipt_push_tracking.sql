-- Migration: Add push notification tracking to hub_message_receipts
-- This allows immediate push on message send + cron fallback for failures

-- Add push tracking columns
ALTER TABLE public.hub_message_receipts
ADD COLUMN IF NOT EXISTS push_status text CHECK (push_status IS NULL OR push_status IN ('pending', 'sent', 'failed')),
ADD COLUMN IF NOT EXISTS push_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS push_error text;

-- Index for cron job to find failed/pending push notifications
CREATE INDEX IF NOT EXISTS idx_receipts_push_pending 
ON public.hub_message_receipts(push_status) 
WHERE push_status IN ('pending', 'failed') OR push_status IS NULL;

-- Comment
COMMENT ON COLUMN public.hub_message_receipts.push_status IS 'Push notification status: null=not attempted, pending=queued, sent=delivered, failed=error';
COMMENT ON COLUMN public.hub_message_receipts.push_sent_at IS 'When push notification was attempted';
COMMENT ON COLUMN public.hub_message_receipts.push_error IS 'Error message if push failed';
