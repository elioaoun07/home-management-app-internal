-- Migration: Add AI rate limits table for persistent rate limiting
-- This table tracks AI API requests per user to prevent rate limit issues

CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- 'ai-chat', 'recipe-generate', etc.
  request_hash TEXT, -- For deduplication
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by user and time
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user_time 
  ON ai_rate_limits(user_id, created_at DESC);

-- Index for global rate limiting
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_time 
  ON ai_rate_limits(created_at DESC);

-- Index for deduplication
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_dedup 
  ON ai_rate_limits(user_id, request_hash, created_at DESC);

-- RLS Policies
ALTER TABLE ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limit records (not really needed but good practice)
CREATE POLICY "Users can view own rate limits"
  ON ai_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (API routes use service role)
CREATE POLICY "Service can insert rate limits"
  ON ai_rate_limits FOR INSERT
  WITH CHECK (true);

-- Service role can delete old entries
CREATE POLICY "Service can delete rate limits"
  ON ai_rate_limits FOR DELETE
  USING (true);

-- Auto-cleanup: Create a function to clean old entries (optional, can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_rate_limits WHERE created_at < now() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE ai_rate_limits IS 'Tracks AI API requests for rate limiting across serverless instances';
