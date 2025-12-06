-- ============================================
-- HUB CHAT THREADS - Add threads/conversations support
-- Migration: add_hub_chat_threads.sql
-- ============================================

-- 1. Create Chat Threads Table
CREATE TABLE IF NOT EXISTS public.hub_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.household_links(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Thread details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Thread icon/emoji (optional)
  icon TEXT DEFAULT '💬',
  
  -- Status
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_threads_household ON public.hub_chat_threads(household_id, is_archived, last_message_at DESC);

-- 2. Add thread_id column to hub_messages
ALTER TABLE public.hub_messages 
ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.hub_chat_threads(id) ON DELETE CASCADE;

-- 3. Create index for messages by thread
CREATE INDEX IF NOT EXISTS idx_hub_messages_thread ON public.hub_messages(thread_id, created_at ASC);

-- 4. RLS Policies for chat threads
ALTER TABLE public.hub_chat_threads ENABLE ROW LEVEL SECURITY;

-- Users can view threads in their household
CREATE POLICY "Users can view their household threads"
  ON public.hub_chat_threads FOR SELECT
  USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
      AND active = TRUE
    )
  );

-- Users can create threads in their household
CREATE POLICY "Users can create threads in their household"
  ON public.hub_chat_threads FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
      AND active = TRUE
    )
    AND created_by = auth.uid()
  );

-- Users can update threads they created or in their household
CREATE POLICY "Users can update their household threads"
  ON public.hub_chat_threads FOR UPDATE
  USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
      AND active = TRUE
    )
  );

-- Users can delete threads they created
CREATE POLICY "Users can delete threads they created"
  ON public.hub_chat_threads FOR DELETE
  USING (created_by = auth.uid());

-- 5. Function to update last_message_at when a message is sent
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE public.hub_chat_threads 
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to auto-update thread timestamp
DROP TRIGGER IF EXISTS trigger_update_thread_last_message ON public.hub_messages;
CREATE TRIGGER trigger_update_thread_last_message
  AFTER INSERT ON public.hub_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_last_message();
