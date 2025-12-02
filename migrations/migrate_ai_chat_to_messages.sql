-- Migration: Transfer data from ai_chat_logs to ai_messages + ai_sessions
-- Run this AFTER creating the ai_messages and ai_sessions tables

-- Step 1: Create sessions from existing chat logs
INSERT INTO ai_sessions (id, user_id, title, created_at, updated_at, is_archived)
SELECT DISTINCT ON (session_id)
  session_id as id,
  user_id,
  CASE 
    WHEN LENGTH(user_message) > 50 THEN LEFT(user_message, 47) || '...'
    ELSE user_message
  END as title,
  MIN(created_at) OVER (PARTITION BY session_id) as created_at,
  MAX(created_at) OVER (PARTITION BY session_id) as updated_at,
  false as is_archived
FROM ai_chat_logs
WHERE session_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Step 2: Migrate messages (each ai_chat_logs row becomes 2 ai_messages rows)
-- First, create a temp table with sequence numbers
WITH numbered_logs AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) as row_num
  FROM ai_chat_logs
  WHERE session_id IS NOT NULL
)
-- Insert user messages
INSERT INTO ai_messages (
  user_id, session_id, role, content, sequence_num, 
  input_tokens, created_at, is_active
)
SELECT 
  user_id,
  session_id,
  'user' as role,
  user_message as content,
  (row_num * 2) - 1 as sequence_num,
  input_tokens,
  created_at,
  true as is_active
FROM numbered_logs;

-- Insert assistant messages
WITH numbered_logs AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at) as row_num
  FROM ai_chat_logs
  WHERE session_id IS NOT NULL
)
INSERT INTO ai_messages (
  user_id, session_id, role, content, sequence_num,
  output_tokens, included_budget_context, model_used, response_time_ms,
  created_at, is_active
)
SELECT 
  user_id,
  session_id,
  'assistant' as role,
  assistant_response as content,
  (row_num * 2) as sequence_num,
  output_tokens,
  included_budget_context,
  model_used,
  response_time_ms,
  created_at,
  true as is_active
FROM numbered_logs;

-- Step 3: Link parent_ids (assistant message points to its user message)
-- This creates the parent-child relationship
WITH message_pairs AS (
  SELECT 
    m1.id as assistant_id,
    m2.id as user_id
  FROM ai_messages m1
  JOIN ai_messages m2 ON m1.session_id = m2.session_id 
    AND m1.sequence_num = m2.sequence_num + 1
    AND m1.role = 'assistant'
    AND m2.role = 'user'
)
UPDATE ai_messages
SET parent_id = message_pairs.user_id
FROM message_pairs
WHERE ai_messages.id = message_pairs.assistant_id;

-- Step 4: Verify migration (run these to check)
-- SELECT COUNT(*) as old_count FROM ai_chat_logs WHERE session_id IS NOT NULL;
-- SELECT COUNT(*) / 2 as new_pairs FROM ai_messages;
-- SELECT COUNT(*) as sessions FROM ai_sessions;

-- Step 5: After verifying, you can drop the old tables and views
-- UNCOMMENT THESE LINES ONLY AFTER VERIFYING THE MIGRATION WORKED:

-- Drop old view first (depends on ai_chat_logs)
-- DROP VIEW IF EXISTS ai_monthly_usage;

-- Drop old tables
-- DROP TABLE IF EXISTS ai_conversations;
-- DROP TABLE IF EXISTS ai_chat_logs;

-- The new view 'ai_messages_monthly_usage' replaces 'ai_monthly_usage'
-- It's created by add_ai_messages.sql migration

-- Note: The ai_chat_logs table had a total_tokens generated column, 
-- which is now calculated on-the-fly if needed from input_tokens + output_tokens
