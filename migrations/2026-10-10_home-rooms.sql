-- migrations/2026-10-10_home-rooms.sql
--
-- WHAT: 1. home_rooms table (the rooms of the home: name, order, shared with the household)
--       2. catalogue_items.room_ids uuid[] — the rooms a chore template applies to
--       3. seed: the 9 rooms from temp.md
-- WHY:  Chores: one template ("Mop the floor") tagged with every room it applies to; the
--       Chores page offers it once per room. Instances remember their room in
--       items.metadata_json.room_id (no change to the items table).
-- RUN:  manually in the Supabase SQL Editor, BEFORE testing. Safe to re-run.
--       The app tolerates the column missing only until a chore is saved with rooms.
--
-- RLS (Hard Rule #20): home_rooms has its own user_id and a plain is_public flag, so the
-- policies are direct column checks — no join to a parent table. Same audience rule as
-- catalogue_sub_items: owner, or the active household partner when is_public. Writes are
-- owner-only.

BEGIN;

-- 1. Rooms ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.home_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  position integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT home_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT home_rooms_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- One live room per name per owner (case-insensitive); archived rooms free the name.
CREATE UNIQUE INDEX IF NOT EXISTS home_rooms_user_name_uidx
  ON public.home_rooms (user_id, lower(btrim(name)))
  WHERE archived_at IS NULL;

ALTER TABLE public.home_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS home_rooms_select_policy ON public.home_rooms;
DROP POLICY IF EXISTS home_rooms_insert_policy ON public.home_rooms;
DROP POLICY IF EXISTS home_rooms_update_policy ON public.home_rooms;
DROP POLICY IF EXISTS home_rooms_delete_policy ON public.home_rooms;

CREATE POLICY home_rooms_select_policy ON public.home_rooms
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.household_links hl
         WHERE hl.active = true
           AND (
             (hl.owner_user_id = auth.uid() AND hl.partner_user_id = home_rooms.user_id)
             OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = home_rooms.user_id)
           )
      )
    )
  );

CREATE POLICY home_rooms_insert_policy ON public.home_rooms
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY home_rooms_update_policy ON public.home_rooms
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY home_rooms_delete_policy ON public.home_rooms
  FOR DELETE USING (user_id = auth.uid());

-- 2. Rooms a chore template applies to (ids of home_rooms; same array pattern as
--    item_category_ids / tags). Ids of archived rooms are ignored by the app.
ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS room_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- 3. Seed the 9 rooms from temp.md (order = position). Skips names that already exist,
--    so re-running adds nothing. Owner = the account with this email.
INSERT INTO public.home_rooms (user_id, name, position)
SELECT u.id, r.name, r.position
  FROM auth.users u
  CROSS JOIN (VALUES
    ('Corridor', 0), ('Entrance', 1), ('Salon', 2), ('Balcony', 3),
    ('Toilet / Bathroom', 4), ('Master Bedroom', 5), ('Living Room', 6),
    ('Elio''s Room', 7), ('Kitchen', 8)
  ) AS r(name, position)
 WHERE u.email = 'aounelio@gmail.com'
   AND NOT EXISTS (
     SELECT 1 FROM public.home_rooms h
      WHERE h.user_id = u.id
        AND lower(btrim(h.name)) = lower(r.name)
        AND h.archived_at IS NULL
   );

COMMIT;

-- Verify (expect: table has RLS on, 4 policies, column exists):
-- select relrowsecurity from pg_class where oid = 'public.home_rooms'::regclass;
-- select policyname, cmd from pg_policies where tablename = 'home_rooms' order by 1;
-- select name, position from public.home_rooms where archived_at is null order by position; -- 9 rows
-- select column_name, data_type, column_default from information_schema.columns
--  where table_name = 'catalogue_items' and column_name = 'room_ids';
