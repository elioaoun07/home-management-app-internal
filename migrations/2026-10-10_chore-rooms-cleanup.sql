-- migrations/2026-10-10_chore-rooms-cleanup.sql
--
-- WHAT: Remove what the first "rooms as categories + import" attempt created.
--       (The 9 rooms are seeded by 2026-10-10_home-rooms.sql.)
-- WHY:  That attempt filed one template per chore × room ("Mop the floor · Kitchen")
--       under a "Rooms" category. The model is now ONE template tagged with room_ids.
-- RUN:  manually in the Supabase SQL Editor, AFTER 2026-10-10_home-rooms.sql.
--       Step A is read-only — run it first and look at the rows. Nothing here is
--       needed if you never ran the import (Step A returns 0 rows).
--       Deletes are soft (Recycle Bin / archived), reversible with the rollback below.

-- A. INSPECT (read-only) -------------------------------------------------------------
-- Templates the import created: chore + " · <room>" in the name, filed under "Rooms".
select ci.id, ci.name, ci.created_at, cc.name as room,
       (select count(*) from public.items i where i.source_catalogue_item_id = ci.id) as instances
  from public.catalogue_items ci
  join public.catalogue_categories cc on cc.id = ci.category_id
  join public.catalogue_categories parent on parent.id = cc.parent_id and parent.name = 'Rooms'
 where ci.is_chore and ci.deleted_at is null
 order by cc.position, ci.name;
-- ^ If `instances` > 0 for some row, you already assigned that chore on the Chores page;
--   those instances keep working (they're independent items) — only the template goes.

-- B. APPLY (run once A looks right) --------------------------------------------------
BEGIN;

-- B1. Soft-delete the import's templates (Recycle Bin semantics: deleted_at).
update public.catalogue_items ci
   set deleted_at = now()
  from public.catalogue_categories cc
  join public.catalogue_categories parent on parent.id = cc.parent_id and parent.name = 'Rooms'
 where ci.category_id = cc.id
   and ci.is_chore
   and ci.deleted_at is null;

-- B2. Archive the room categories and their "Rooms" parent.
update public.catalogue_categories cc
   set archived_at = now()
  from public.catalogue_categories parent
 where cc.parent_id = parent.id and parent.name = 'Rooms' and cc.archived_at is null;
update public.catalogue_categories
   set archived_at = now()
 where name = 'Rooms' and parent_id is null and archived_at is null;

COMMIT;

-- C. VERIFY (expect 0 live chore templates left under Rooms)
-- select count(*) from public.catalogue_items ci
--   join public.catalogue_categories cc on cc.id = ci.category_id
--   join public.catalogue_categories p on p.id = cc.parent_id and p.name = 'Rooms'
--  where ci.is_chore and ci.deleted_at is null;

-- ROLLBACK (only if B was a mistake):
-- update public.catalogue_items set deleted_at = null
--  where is_chore and deleted_at > now() - interval '1 day' and name like '% · %';
-- update public.catalogue_categories set archived_at = null
--  where archived_at > now() - interval '1 day' and (name = 'Rooms' or parent_id in
--        (select id from public.catalogue_categories where name = 'Rooms'));
