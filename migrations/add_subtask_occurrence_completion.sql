-- Migration: Add occurrence-specific subtask completion tracking
-- For recurring items, subtasks need to be tracked per occurrence

-- Create a table to track subtask completions per occurrence
CREATE TABLE IF NOT EXISTS public.item_subtask_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subtask_id uuid NOT NULL,
  occurrence_date timestamp with time zone NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_subtask_completions_pkey PRIMARY KEY (id),
  CONSTRAINT item_subtask_completions_subtask_id_fkey FOREIGN KEY (subtask_id) REFERENCES public.item_subtasks(id) ON DELETE CASCADE,
  CONSTRAINT item_subtask_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id),
  CONSTRAINT item_subtask_completions_unique UNIQUE (subtask_id, occurrence_date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS item_subtask_completions_subtask_idx ON public.item_subtask_completions(subtask_id);
CREATE INDEX IF NOT EXISTS item_subtask_completions_occurrence_idx ON public.item_subtask_completions(occurrence_date);

-- Enable RLS
ALTER TABLE public.item_subtask_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own subtask completions (via item ownership chain)
CREATE POLICY "Users can manage subtask completions" ON public.item_subtask_completions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.item_subtasks st
      JOIN public.items i ON i.id = st.parent_item_id
      WHERE st.id = item_subtask_completions.subtask_id
      AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.item_subtasks st
      JOIN public.items i ON i.id = st.parent_item_id
      WHERE st.id = item_subtask_completions.subtask_id
      AND i.user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE public.item_subtask_completions IS 'Tracks subtask completions per occurrence for recurring items';
