-- WHAT: permit the references-only weekly sprint command in the existing PM relay.
-- RUN: owner only, manually in the Supabase SQL Editor. No agent has applied this.
-- No tables, row data, grants or RLS policies change. Existing pending-only insert
-- and owner read policies continue to protect planning commands and receipts.

-- Inspect first. Keep the full output; stop if the existing type constraint has
-- unexpected command names or a different name. This migration preserves every
-- type from the accepted 2026-09-12 relay migration.
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.pm_commands'::regclass and contype = 'c';

begin;
alter table public.pm_commands drop constraint if exists pm_commands_type_check;
alter table public.pm_commands add constraint pm_commands_type_check check (type = any (array[
  'capture', 'undo', 'preflight', 'launch', 'pause', 'abort-turn', 'resume', 'cancel', 'answer', 'ask',
  'approve', 'accept', 'legacy-tick',
  'v2-deliver', 'v2-decision', 'v2-answer', 'v2-message', 'v2-control', 'v2-apply', 'planning'
]::text[]));
commit;

-- Verify: the definition includes planning. Only then enable
-- PM_SPRINT_RELAY=1 for the laptop PM server and restart it. Without that explicit
-- setup switch the shared phone view remains readable and Delivery launch works,
-- but sprint edits are not offered. Never infer migration success from source.
select pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.pm_commands'::regclass and conname = 'pm_commands_type_check';

-- Operational rollback: unset PM_SPRINT_RELAY and restart. Historical commands
-- remain intact; do not delete them or tighten this CHECK over existing rows.
