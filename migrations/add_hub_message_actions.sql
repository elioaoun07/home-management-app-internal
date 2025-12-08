-- ============================================
-- HUB MESSAGE ACTIONS - Track actions taken on messages
-- Migration: add_hub_message_actions.sql
-- ============================================

-- 1. Create hub_message_actions table (junction table for 1-to-many)
CREATE TABLE IF NOT EXISTS public.hub_message_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.hub_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Action type (extensible for future actions)
  action_type TEXT NOT NULL CHECK (action_type IN ('transaction', 'reminder', 'forward', 'pin')),
  
  -- Reference to created resource (nullable for different action types)
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Action metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate actions of same type by same user
  UNIQUE(message_id, user_id, action_type)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hub_message_actions_message ON public.hub_message_actions(message_id);
CREATE INDEX IF NOT EXISTS idx_hub_message_actions_user ON public.hub_message_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_message_actions_type ON public.hub_message_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_hub_message_actions_transaction ON public.hub_message_actions(transaction_id) WHERE transaction_id IS NOT NULL;

-- 3. RLS Policies
ALTER TABLE public.hub_message_actions ENABLE ROW LEVEL SECURITY;

-- Users can view actions on messages they have access to
CREATE POLICY "Users can view actions on their messages"
  ON public.hub_message_actions FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    message_id IN (
      SELECT m.id FROM public.hub_messages m
      JOIN public.hub_chat_threads t ON m.thread_id = t.id
      JOIN public.household_links h ON t.household_id = h.id
      WHERE (h.owner_user_id = auth.uid() OR h.partner_user_id = auth.uid())
      AND h.active = TRUE
    )
  );

-- Users can create actions on messages they have access to
CREATE POLICY "Users can create actions on accessible messages"
  ON public.hub_message_actions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND
    message_id IN (
      SELECT m.id FROM public.hub_messages m
      JOIN public.hub_chat_threads t ON m.thread_id = t.id
      JOIN public.household_links h ON t.household_id = h.id
      WHERE (h.owner_user_id = auth.uid() OR h.partner_user_id = auth.uid())
      AND h.active = TRUE
    )
  );

-- Users can delete their own actions
CREATE POLICY "Users can delete their own actions"
  ON public.hub_message_actions FOR DELETE
  USING (user_id = auth.uid());

-- 4. Update timestamp trigger
CREATE OR REPLACE FUNCTION update_hub_message_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hub_message_actions_timestamp
  BEFORE UPDATE ON public.hub_message_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_hub_message_actions_updated_at();

-- 5. Comments for documentation
COMMENT ON TABLE public.hub_message_actions IS 'Tracks actions taken on hub messages (transactions, reminders, etc.)';
COMMENT ON COLUMN public.hub_message_actions.action_type IS 'Type of action: transaction, reminder, forward, pin';
COMMENT ON COLUMN public.hub_message_actions.transaction_id IS 'Reference to created transaction (if action_type = transaction)';
COMMENT ON COLUMN public.hub_message_actions.metadata IS 'Flexible JSON field for action-specific data';
