-- Migration: Add previous_kanban_stage to track where subtask came from before "Later"
-- This allows restoring subtasks to their previous stage when moving back from "Later"

ALTER TABLE public.item_subtasks
ADD COLUMN IF NOT EXISTS previous_kanban_stage text;

COMMENT ON COLUMN public.item_subtasks.previous_kanban_stage IS 'Stores the previous kanban stage when moved to Later, for undo functionality';
