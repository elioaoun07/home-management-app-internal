-- AI Chat Logs Table
-- Stores all AI assistant conversations for history and token usage tracking

CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Message content
  user_message TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  
  -- Token tracking for usage monitoring
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Context included flag
  included_budget_context BOOLEAN DEFAULT true,
  
  -- Session tracking (for grouping conversations) - TEXT to allow flexible session IDs
  session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Response metadata
  response_time_ms INTEGER, -- How long the API took to respond
  model_used TEXT DEFAULT 'gemini-2.0-flash'
);

-- Index for efficient user queries
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user_id ON ai_chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_created_at ON ai_chat_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_session_id ON ai_chat_logs(session_id);

-- Index for monthly usage aggregation
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user_month ON ai_chat_logs(user_id, created_at);

-- RLS Policies
ALTER TABLE ai_chat_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own chat logs
CREATE POLICY "Users can view own chat logs"
  ON ai_chat_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own chat logs
CREATE POLICY "Users can insert own chat logs"
  ON ai_chat_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chat logs
CREATE POLICY "Users can delete own chat logs"
  ON ai_chat_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Monthly Usage Summary View (optional, for quick queries)
CREATE OR REPLACE VIEW ai_monthly_usage AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_conversations,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(input_tokens + output_tokens) AS total_tokens,
  AVG(response_time_ms) AS avg_response_time_ms
FROM ai_chat_logs
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- Grant access to the view
GRANT SELECT ON ai_monthly_usage TO authenticated;

COMMENT ON TABLE ai_chat_logs IS 'Stores AI assistant chat history and token usage for monitoring';
COMMENT ON COLUMN ai_chat_logs.input_tokens IS 'Estimated tokens used for the request (system + context + user message)';
COMMENT ON COLUMN ai_chat_logs.output_tokens IS 'Estimated tokens in the AI response';
COMMENT ON COLUMN ai_chat_logs.session_id IS 'Groups messages in the same chat session';
