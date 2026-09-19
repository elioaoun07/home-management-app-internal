-- migrations/2026-09-12_pm-v2-relay.sql
--
-- WHAT: Command Center Phase 4 phone relay (Delivery DLV-104, PM Tooling R63; Apply DLV-105).
--   1. pm_commands.type   — allow the six Delivery V2 command types the laptop bridge relays
--                           (v2-deliver, v2-decision, v2-answer, v2-message, v2-control, v2-apply).
--   2. pm_commands.status — allow 'unknown': the bridge could not establish whether an effect happened.
--   3. pm_commands RLS    — the phone may insert only a pending, receipt-free command and read its own.
--                           Receipts (status, result, error, claimed_at, completed_at) are written only
--                           by the bridge, which uses the service role and bypasses RLS.
--   4. pm_live RLS        — the phone reads its own rows; only the bridge writes them.
--   5. pm_live index      — installation-scoped reads (`id like 'cc:%'`) per owner.
--
-- WHY: durable command and receipt recovery. With the current policies a phone session can UPDATE its
--   own command rows (reset a claimed command to pending, which would be claimed and run again, or write
--   a forged receipt) and can INSERT/UPDATE/DELETE pm_live rows (forge a heartbeat or a snapshot). The
--   app never does either; the database should not allow it. No application code writes these through
--   the anon/authenticated role after this change (verified by grep: src/ only selects pm_live and
--   inserts pm_commands).
--
-- RUN: manually in the Supabase SQL Editor, in order. Run section 0 first and keep its UNTRUNCATED output.
--   Sections 1–5 are one transaction and safe to re-run. Agents never apply this (Hard Rule 26).
--   Until it runs, the bridge still works: a V2 command insert is refused by the old type CHECK (the phone
--   shows the refusal), and an 'unknown' receipt falls back to status 'claimed' with
--   result.outcome_unknown = true.
--
-- ROLLBACK: section 9.

-- ---------------------------------------------------------------------------------------------------------
-- 0. INSPECT (read-only). Paste the full output into Delivery DLV-77 / DLV-104 before running section 1.
-- ---------------------------------------------------------------------------------------------------------
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.pm_commands'::regclass and contype = 'c'
 order by conname;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('pm_live', 'pm_commands');

select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename in ('pm_live', 'pm_commands')
 order by tablename, policyname;

select type, status, count(*) from public.pm_commands group by type, status order by type, status;

select pubname, tablename from pg_publication_tables where tablename in ('pm_live', 'pm_commands');

-- STOP and report back if:
--   * the CHECK constraints are not named pm_commands_type_check / pm_commands_status_check;
--   * any existing row has a type or status outside the lists in sections 1 and 2;
--   * either table is missing from the supabase_realtime publication (the phone needs both).

begin;

-- ---------------------------------------------------------------------------------------------------------
-- 1. Command types
-- ---------------------------------------------------------------------------------------------------------
alter table public.pm_commands drop constraint if exists pm_commands_type_check;
alter table public.pm_commands add constraint pm_commands_type_check check (type = any (array[
  'capture', 'undo', 'preflight', 'launch', 'pause', 'abort-turn', 'resume', 'cancel', 'answer', 'ask',
  'approve', 'accept', 'legacy-tick',
  'v2-deliver', 'v2-decision', 'v2-answer', 'v2-message', 'v2-control', 'v2-apply'
]::text[]));

-- ---------------------------------------------------------------------------------------------------------
-- 2. Status
-- ---------------------------------------------------------------------------------------------------------
alter table public.pm_commands drop constraint if exists pm_commands_status_check;
alter table public.pm_commands add constraint pm_commands_status_check check (status = any (array[
  'pending', 'claimed', 'done', 'failed', 'expired', 'unknown'
]::text[]));

-- ---------------------------------------------------------------------------------------------------------
-- 3. pm_commands: insert a pending command, read your own. No client UPDATE or DELETE.
-- ---------------------------------------------------------------------------------------------------------
alter table public.pm_commands enable row level security;

drop policy if exists pm_commands_update_own on public.pm_commands;
drop policy if exists pm_commands_delete_own on public.pm_commands;

drop policy if exists pm_commands_insert_own on public.pm_commands;
create policy pm_commands_insert_own on public.pm_commands
  for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and result is null
    and error is null
    and claimed_at is null
    and completed_at is null
  );

drop policy if exists pm_commands_select_own on public.pm_commands;
create policy pm_commands_select_own on public.pm_commands
  for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------
-- 4. pm_live: read your own. Only the bridge (service role) writes.
-- ---------------------------------------------------------------------------------------------------------
alter table public.pm_live enable row level security;

drop policy if exists pm_live_insert_own on public.pm_live;
drop policy if exists pm_live_update_own on public.pm_live;
drop policy if exists pm_live_delete_own on public.pm_live;

drop policy if exists pm_live_select_own on public.pm_live;
create policy pm_live_select_own on public.pm_live
  for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------
-- 5. Installation-scoped reads
-- ---------------------------------------------------------------------------------------------------------
create index if not exists pm_live_user_id_pattern_idx on public.pm_live (user_id, id text_pattern_ops);

commit;

-- ---------------------------------------------------------------------------------------------------------
-- 6. VERIFY (read-only). Expected:
--    pm_commands_status_check lists 'unknown'; pm_commands_type_check lists the six v2-* types;
--    policies: pm_commands_insert_own (INSERT, with_check includes status = 'pending'),
--              pm_commands_select_own (SELECT), pm_live_select_own (SELECT);
--    no UPDATE or DELETE policy on either table; both tables relrowsecurity = true.
-- ---------------------------------------------------------------------------------------------------------
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.pm_commands'::regclass and contype = 'c'
 order by conname;

select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename in ('pm_live', 'pm_commands')
 order by tablename, policyname;

-- ---------------------------------------------------------------------------------------------------------
-- 7. ACCESS EVIDENCE (owner, on the phone, signed in as the owner) — record the observations in DLV-104:
--    a. /pm/live opens and shows work (SELECT on pm_live allowed).
--    b. A V2 command (e.g. Approve) reaches the laptop: its row moves pending → claimed → done.
--    c. The same account cannot change a command's status from the client (UPDATE now affects 0 rows).
--    d. Signed in as a second account, /pm/live shows none of the owner's rows.
-- ---------------------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------------------
-- 9. ROLLBACK — restores the constraints and policies recorded in migrations/db-state.json (2026-08-04).
--    Before running it, decide what to do with rows the old constraints reject:
--      select id, type, status from public.pm_commands where type like 'v2-%' or status = 'unknown';
--    The old CHECKs cannot be re-added while such rows exist. Choosing to delete or re-status them is an
--    owner decision; nothing below does it for you.
-- ---------------------------------------------------------------------------------------------------------
-- begin;
-- alter table public.pm_commands drop constraint if exists pm_commands_type_check;
-- alter table public.pm_commands add constraint pm_commands_type_check check (type = any (array[
--   'capture', 'undo', 'preflight', 'launch', 'pause', 'abort-turn', 'resume', 'cancel', 'answer', 'ask',
--   'approve', 'accept', 'legacy-tick'
-- ]::text[]));
-- alter table public.pm_commands drop constraint if exists pm_commands_status_check;
-- alter table public.pm_commands add constraint pm_commands_status_check check (status = any (array[
--   'pending', 'claimed', 'done', 'failed', 'expired'
-- ]::text[]));
-- drop policy if exists pm_commands_insert_own on public.pm_commands;
-- create policy pm_commands_insert_own on public.pm_commands for insert with check (user_id = auth.uid());
-- create policy pm_commands_update_own on public.pm_commands for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy pm_commands_delete_own on public.pm_commands for delete using (user_id = auth.uid());
-- create policy pm_live_insert_own on public.pm_live for insert with check (user_id = auth.uid());
-- create policy pm_live_update_own on public.pm_live for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- create policy pm_live_delete_own on public.pm_live for delete using (user_id = auth.uid());
-- drop index if exists public.pm_live_user_id_pattern_idx;
-- commit;
