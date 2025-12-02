-- AI Messages Table (Enhanced Structure)
-- Stores individual messages with support for branching, editing, and regeneration

-- Create new messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session/Thread grouping
  session_id TEXT NOT NULL,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- For branching: which message this is a response to
  parent_id UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
  
  -- For tracking message order within a branch
  sequence_num INTEGER NOT NULL DEFAULT 0,
  
  -- Token tracking (for assistant messages)
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  
  -- Context and metadata
  included_budget_context BOOLEAN DEFAULT false,
  model_used TEXT DEFAULT 'gemini-2.0-flash',
  response_time_ms INTEGER,
  
  -- Editing support
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  original_content TEXT, -- Store original if edited
  
  -- Active branch tracking (for regeneration)
  is_active BOOLEAN DEFAULT true, -- false for regenerated/replaced messages
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_parent_id ON ai_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_active ON ai_messages(session_id, is_active, sequence_num);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_month ON ai_messages(user_id, created_at);

-- RLS Policies
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON ai_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON ai_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
  ON ai_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON ai_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Sessions/Threads table for metadata
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY, -- session_id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Display info
  title TEXT NOT NULL DEFAULT 'New Conversation',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Archiving
  is_archived BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated_at ON ai_sessions(user_id, updated_at DESC);

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON ai_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON ai_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON ai_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON ai_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update session timestamp
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_sessions 
  SET updated_at = NOW() 
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_message_updates_session
  AFTER INSERT ON ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- Function to get the active conversation thread
CREATE OR REPLACE FUNCTION get_active_thread(p_session_id TEXT, p_user_id UUID)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  parent_id UUID,
  sequence_num INTEGER,
  created_at TIMESTAMPTZ,
  is_edited BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.role,
    m.content,
    m.parent_id,
    m.sequence_num,
    m.created_at,
    m.is_edited
  FROM ai_messages m
  WHERE m.session_id = p_session_id
    AND m.user_id = p_user_id
    AND m.is_active = true
  ORDER BY m.sequence_num ASC, m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly usage view (updated for new structure)
CREATE OR REPLACE VIEW ai_messages_monthly_usage AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) FILTER (WHERE role = 'user') AS total_user_messages,
  COUNT(*) FILTER (WHERE role = 'assistant') AS total_assistant_messages,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  AVG(response_time_ms) FILTER (WHERE role = 'assistant') AS avg_response_time_ms
FROM ai_messages
GROUP BY user_id, DATE_TRUNC('month', created_at);

GRANT SELECT ON ai_messages_monthly_usage TO authenticated;

COMMENT ON TABLE ai_messages IS 'Stores individual AI chat messages with branching support';
COMMENT ON TABLE ai_sessions IS 'Stores AI conversation session metadata';
COMMENT ON COLUMN ai_messages.parent_id IS 'References the message this is responding to (for branching)';
COMMENT ON COLUMN ai_messages.is_active IS 'False for regenerated/replaced messages in a branch';
COMMENT ON COLUMN ai_messages.sequence_num IS 'Order of message within the conversation thread';
