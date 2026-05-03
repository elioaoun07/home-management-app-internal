-- ===========================================================================
-- ERA Persistence Layer (Phase 0.5)
-- ===========================================================================
-- Two append-only tables that back the ERA assistant transcript.
--
-- Design:
--   - era_conversations: one row per session (auto-rolled every 6 hours).
--   - era_messages:      append-only chat log, 1:N to conversations.
--   - Per-user RLS (private by default, NOT household-shared).
--   - intent_payload jsonb stores the parsed Intent discriminated union as-is
--     so Phase 2 can extend it without migrations.
--   - draft_transaction_id FK lets ERA messages link back to the drafts they
--     created. ON DELETE SET NULL so trashing a draft doesn't break history.
--
-- IMPORTANT: run this manually in the Supabase SQL Editor.
-- ===========================================================================

BEGIN;

-- 1. era_conversations -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.era_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  active_face_key text NOT NULL DEFAULT 'budget'
    CHECK (active_face_key IN ('budget', 'schedule', 'chef', 'brain')),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS era_conversations_user_updated_idx
  ON public.era_conversations (user_id, updated_at DESC)
  WHERE is_archived = false;

-- 2. era_messages ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.era_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.era_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  intent_kind text,
  intent_face text,
  intent_payload jsonb,
  draft_transaction_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS era_messages_conversation_created_idx
  ON public.era_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS era_messages_user_created_idx
  ON public.era_messages (user_id, created_at DESC);

-- 3. updated_at trigger for conversations -----------------------------------
CREATE OR REPLACE FUNCTION public.era_conversations_touch()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.era_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS era_messages_touch_conversation ON public.era_messages;
CREATE TRIGGER era_messages_touch_conversation
  AFTER INSERT ON public.era_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.era_conversations_touch();

-- 4. RLS ---------------------------------------------------------------------
ALTER TABLE public.era_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.era_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS era_conversations_self ON public.era_conversations;
CREATE POLICY era_conversations_self ON public.era_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS era_messages_self ON public.era_messages;
CREATE POLICY era_messages_self ON public.era_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Realtime publication ---------------------------------------------------
-- Enables Supabase Realtime broadcasts for INSERTs into era_messages so
-- multi-device transcripts stay in sync.
ALTER PUBLICATION supabase_realtime ADD TABLE public.era_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.era_conversations;

COMMIT;
