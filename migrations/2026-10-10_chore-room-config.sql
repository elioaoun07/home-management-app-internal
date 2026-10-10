-- migrations/2026-10-10_chore-room-config.sql
--
-- WHAT: Per-room settings on a chore template: catalogue_items.room_config jsonb
--       { "<home_rooms.id>": { "checklist": "- line\n- line" } }
-- WHY:  "Tidy & Organize" is ONE template tagged with many rooms, but each room has
--       its own steps (Master Bedroom: organize dresser / wardrobes). Placing the
--       chore for a room copies that room's checklist into the instance's subtasks.
--       Room-specific text stays out of the template's own checklist.
-- RUN:  manually in the Supabase SQL Editor (after 2026-10-10_home-rooms.sql).
--       Idempotent, additive, no RLS change (column on an existing table).

ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS room_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- VERIFY
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'catalogue_items' and column_name = 'room_config';

-- ROLLBACK (drops any per-room checklists):
-- ALTER TABLE public.catalogue_items DROP COLUMN IF EXISTS room_config;
