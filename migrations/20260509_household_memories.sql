-- Migration: household_memories
-- ERA Brain face — shared household memory store (contacts, notes, codes)
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.household_memories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.household_links(id) ON DELETE CASCADE,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        text NOT NULL,
  value        text NOT NULL,
  tags         text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS household_memories_label_unique
  ON public.household_memories (household_id, lower(label));

CREATE INDEX IF NOT EXISTS household_memories_household_idx
  ON public.household_memories (household_id, updated_at DESC);

ALTER TABLE public.household_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY household_memories_select ON public.household_memories
  FOR SELECT USING (
    household_id IN (
      SELECT id FROM public.household_links
      WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
        AND active = true
    )
  );

CREATE POLICY household_memories_insert ON public.household_memories
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    household_id IN (
      SELECT id FROM public.household_links
      WHERE (owner_user_id = auth.uid() OR partner_user_id = auth.uid())
        AND active = true
    )
  );

CREATE POLICY household_memories_update ON public.household_memories
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY household_memories_delete ON public.household_memories
  FOR DELETE USING (created_by = auth.uid());
