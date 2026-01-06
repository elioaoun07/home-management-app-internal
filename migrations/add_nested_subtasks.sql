-- Migration: Add nested subtasks support
-- Allows subtasks to have child subtasks (parent_subtask_id)

-- Add parent_subtask_id column to item_subtasks
ALTER TABLE public.item_subtasks
ADD COLUMN parent_subtask_id uuid REFERENCES public.item_subtasks(id) ON DELETE CASCADE;

-- Create index for efficient nested queries
CREATE INDEX item_subtasks_parent_subtask_idx ON public.item_subtasks(parent_subtask_id);

-- Add comment
COMMENT ON COLUMN public.item_subtasks.parent_subtask_id IS 'Reference to parent subtask for nested subtasks. NULL means top-level subtask.';

-- Create recursive function to get all descendants of a subtask
CREATE OR REPLACE FUNCTION public.get_subtask_descendants(root_subtask_id uuid)
RETURNS TABLE(id uuid, parent_subtask_id uuid, depth integer) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE descendants AS (
    -- Base case: direct children of the root
    SELECT s.id, s.parent_subtask_id, 1 as depth
    FROM public.item_subtasks s
    WHERE s.parent_subtask_id = root_subtask_id
    
    UNION ALL
    
    -- Recursive case: children of children
    SELECT s.id, s.parent_subtask_id, d.depth + 1
    FROM public.item_subtasks s
    INNER JOIN descendants d ON s.parent_subtask_id = d.id
    WHERE d.depth < 10  -- Max depth limit to prevent infinite recursion
  )
  SELECT * FROM descendants;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_subtask_descendants(uuid) TO authenticated;

-- Note: When a parent subtask is completed, the application layer will handle
-- cascading completion to all children. This is done in the frontend for 
-- optimistic updates and better UX with toast notifications.
