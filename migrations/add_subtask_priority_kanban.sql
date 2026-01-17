-- Migration: Add priority and kanban stage fields to subtasks
-- This enables:
-- 1. Numeric priority ordering (priority 1 = top)
-- 2. Kanban view with customizable stages

-- Add priority field (nullable integer, null means keep current order)
ALTER TABLE public.item_subtasks
ADD COLUMN IF NOT EXISTS priority integer;

-- Add kanban stage field (text, default 'To Do' to match first stage)
ALTER TABLE public.item_subtasks
ADD COLUMN IF NOT EXISTS kanban_stage text DEFAULT 'To Do';

-- Create index for efficient priority-based queries
CREATE INDEX IF NOT EXISTS item_subtasks_priority_idx 
ON public.item_subtasks(parent_item_id, priority) 
WHERE priority IS NOT NULL;

-- Create index for kanban stage queries
CREATE INDEX IF NOT EXISTS item_subtasks_kanban_stage_idx 
ON public.item_subtasks(parent_item_id, kanban_stage);

-- Add kanban_stages to items table to store custom stage names per item
-- This stores the kanban configuration (stage names, order, etc.)
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS subtask_kanban_stages jsonb DEFAULT '["To Do", "In Progress", "Done"]'::jsonb;

-- Add kanban_enabled flag to items to toggle kanban view per item
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS subtask_kanban_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.item_subtasks.priority IS 'Numeric priority (1 = highest). NULL means use order_index. When set, items are reordered automatically.';
COMMENT ON COLUMN public.item_subtasks.kanban_stage IS 'Current kanban stage name for the subtask';
COMMENT ON COLUMN public.items.subtask_kanban_stages IS 'JSON array of kanban stage names for subtasks, e.g. ["To Do", "In Progress", "Done"]';
COMMENT ON COLUMN public.items.subtask_kanban_enabled IS 'Whether kanban view is enabled for subtasks';

-- Update existing subtasks with NULL or old 'todo' value to 'To Do'
UPDATE public.item_subtasks 
SET kanban_stage = 'To Do' 
WHERE kanban_stage IS NULL OR kanban_stage = 'todo';
