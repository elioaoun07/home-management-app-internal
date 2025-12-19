-- ============================================
-- ADD LAST_SENT_AT TO NOTIFICATION PREFERENCES
-- ============================================
-- This is a more optimal approach than creating 
-- notification entries for deduplication.
-- ============================================

-- Add last_sent_at column to track when notification was last sent
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

-- Add index for efficient date queries
CREATE INDEX IF NOT EXISTS idx_notification_preferences_last_sent 
ON notification_preferences(user_id, preference_key, last_sent_at);

-- Comment for clarity
COMMENT ON COLUMN notification_preferences.last_sent_at IS 
  'Timestamp of when this notification was last sent. Used for deduplication.';
