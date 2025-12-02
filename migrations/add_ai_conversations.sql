-- AI Conversations Table
-- Stores conversation metadata for the history sidebar

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session ID that links to ai_chat_logs
  session_id TEXT NOT NULL UNIQUE,
  
  -- Conversation metadata
  title TEXT NOT NULL DEFAULT 'New Conversation',
  
  -- Message count for quick display
  message_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional: archived conversations
  is_archived BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON ai_conversations(user_id, updated_at DESC);

-- RLS Policies
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-generate title from first message
CREATE OR REPLACE FUNCTION generate_conversation_title(first_message TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Truncate to first 50 chars or first sentence
  RETURN CASE 
    WHEN LENGTH(first_message) <= 50 THEN first_message
    ELSE LEFT(first_message, 47) || '...'
  END;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on conversation changes
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

COMMENT ON TABLE ai_conversations IS 'Stores AI conversation metadata for history sidebar';
