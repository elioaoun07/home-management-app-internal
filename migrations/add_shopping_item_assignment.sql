-- Migration: Add assigned_to for shopping list items
-- Allows assigning shopping items to specific household members via swipe gesture

-- Add assigned_to column to hub_messages (nullable uuid referencing the assigned user)
ALTER TABLE public.hub_messages
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for filtering by assigned user
CREATE INDEX IF NOT EXISTS idx_hub_messages_assigned_to ON public.hub_messages(assigned_to)
  WHERE assigned_to IS NOT NULL;
