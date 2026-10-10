-- migrations/2026-10-10_chore-default-assignee.sql
--
-- WHAT: catalogue_items.default_assignee_id — who a chore template belongs to by default.
-- WHY:  Chores page pre-assigns the template's to-dos to that person (coloured outline);
--       they only pick the day. NULL = anyone (household).
-- RUN:  manually in the Supabase SQL Editor. Idempotent, additive, no RLS change.

ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS default_assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- VERIFY
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'catalogue_items' and column_name = 'default_assignee_id';

-- ROLLBACK:
-- ALTER TABLE public.catalogue_items DROP COLUMN IF EXISTS default_assignee_id;
