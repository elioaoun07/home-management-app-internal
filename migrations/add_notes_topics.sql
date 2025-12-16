-- ============================================
-- NOTES TOPICS - Add topics/sections within notes threads
-- Migration: add_notes_topics.sql
-- ============================================
-- Topics allow organizing notes into separate pages/sections
-- Think of them as sub-notebooks within a notes thread

-- 1. Create Topics Table
CREATE TABLE IF NOT EXISTS public.hub_notes_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.hub_chat_threads(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Topic details
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT DEFAULT '📄',
  color TEXT DEFAULT '#3b82f6', -- Default blue
  
  -- Position for ordering
  position INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_notes_topics_thread ON public.hub_notes_topics(thread_id, position ASC);

-- 3. Add topic_id column to hub_messages for topic association
ALTER TABLE public.hub_messages 
ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.hub_notes_topics(id) ON DELETE SET NULL;

-- 4. Create index for messages by topic
CREATE INDEX IF NOT EXISTS idx_hub_messages_topic ON public.hub_messages(topic_id) WHERE topic_id IS NOT NULL;

-- 5. RLS Policies for topics
ALTER TABLE public.hub_notes_topics ENABLE ROW LEVEL SECURITY;

-- Users can view topics in threads they have access to
CREATE POLICY "Users can view topics in their household threads"
  ON public.hub_notes_topics FOR SELECT
  USING (
    thread_id IN (
      SELECT t.id FROM public.hub_chat_threads t
      WHERE t.household_id IN (
        SELECT id FROM public.household_links 
        WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
        AND active = TRUE
      )
    )
  );

-- Users can create topics in threads they have access to
CREATE POLICY "Users can create topics in their household threads"
  ON public.hub_notes_topics FOR INSERT
  WITH CHECK (
    thread_id IN (
      SELECT t.id FROM public.hub_chat_threads t
      WHERE t.household_id IN (
        SELECT id FROM public.household_links 
        WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
        AND active = TRUE
      )
    )
    AND created_by = auth.uid()
  );

-- Users can update topics in threads they have access to
CREATE POLICY "Users can update topics in their household threads"
  ON public.hub_notes_topics FOR UPDATE
  USING (
    thread_id IN (
      SELECT t.id FROM public.hub_chat_threads t
      WHERE t.household_id IN (
        SELECT id FROM public.household_links 
        WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
        AND active = TRUE
      )
    )
  );

-- Users can delete topics they created
CREATE POLICY "Users can delete topics they created"
  ON public.hub_notes_topics FOR DELETE
  USING (created_by = auth.uid());

-- 6. Function to auto-update topic timestamp
CREATE OR REPLACE FUNCTION update_topic_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger for topic updates
DROP TRIGGER IF EXISTS topic_updated_at ON public.hub_notes_topics;
CREATE TRIGGER topic_updated_at
  BEFORE UPDATE ON public.hub_notes_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_topic_timestamp();

-- 8. Comments for documentation
COMMENT ON TABLE public.hub_notes_topics IS 'Topics/sections within notes threads for organizing notes into separate pages';
COMMENT ON COLUMN public.hub_notes_topics.thread_id IS 'The parent notes thread this topic belongs to';
COMMENT ON COLUMN public.hub_notes_topics.position IS 'Order position for sorting topics in the sidebar';
COMMENT ON COLUMN public.hub_messages.topic_id IS 'Optional topic/section this message belongs to within a notes thread';
