-- Plan My Day merges into /reminders; timed "checkpoints" become an untimed, ordered "checklist".
-- Run manually in Supabase SQL Editor.

ALTER TABLE public.day_plans RENAME COLUMN checkpoints TO checklist;

-- Transform existing rows: drop "time", add "sort_order" (preserve time-sorted order as the
-- initial sort_order so any in-flight plans keep their relative ordering).
UPDATE public.day_plans
SET checklist = (
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', elem->>'id',
      'label', elem->>'label',
      'done_at', elem->'done_at',
      'sort_order', idx - 1
    ) ORDER BY idx
  ), '[]'::jsonb)
  FROM jsonb_array_elements(checklist) WITH ORDINALITY AS t(elem, idx)
)
WHERE jsonb_array_length(checklist) > 0;
