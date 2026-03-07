-- Migration: Add custom shopping groups for shopping list threads
-- Allows users to create custom grouping sections (e.g., Groceries, Utilities, House, Car)

-- Create shopping_groups table
CREATE TABLE IF NOT EXISTS public.shopping_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.hub_chat_threads(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.household_links(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shopping_groups_pkey PRIMARY KEY (id)
);

-- Add shopping_group_id to hub_messages
ALTER TABLE public.hub_messages
  ADD COLUMN IF NOT EXISTS shopping_group_id uuid REFERENCES public.shopping_groups(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_shopping_groups_thread_id ON public.shopping_groups(thread_id);
CREATE INDEX IF NOT EXISTS idx_hub_messages_shopping_group_id ON public.hub_messages(shopping_group_id);

-- RLS policies for shopping_groups
ALTER TABLE public.shopping_groups ENABLE ROW LEVEL SECURITY;

-- Users can view groups for their household's threads
CREATE POLICY "Users can view shopping groups for their household"
  ON public.shopping_groups FOR SELECT
  USING (
    household_id IN (
      SELECT id FROM public.household_links
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Users can create groups for their household's threads
CREATE POLICY "Users can create shopping groups for their household"
  ON public.shopping_groups FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT id FROM public.household_links
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Users can update groups for their household's threads
CREATE POLICY "Users can update shopping groups for their household"
  ON public.shopping_groups FOR UPDATE
  USING (
    household_id IN (
      SELECT id FROM public.household_links
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Users can delete groups for their household's threads
CREATE POLICY "Users can delete shopping groups for their household"
  ON public.shopping_groups FOR DELETE
  USING (
    household_id IN (
      SELECT id FROM public.household_links
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );
