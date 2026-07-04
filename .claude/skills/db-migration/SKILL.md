---
name: db-migration
description: "Database change workflow: verify against migrations/schema.sql, write the migration runbook file FIRST, update schema.sql to end state, choose a safe RLS pattern (never EXISTS-subqueries on hot child tables). Use for ANY DB change: CREATE/ALTER TABLE, ADD COLUMN, INDEX, POLICY, RPC, enum value."
---

# /db-migration — Database Change Workflow

> **Contract:** no SQL leaves your hands without (1) the columns you reference verified in `migrations/schema.sql`, (2) a migration file created BEFORE `schema.sql` is touched, and (3) an RLS decision made from the tree below. Migrations here are run **manually** by the user in the Supabase SQL Editor — your migration file is their runbook, so it must be complete, ordered, and safe to re-run.

## Step 1 — Establish ground truth

1. Read the relevant tables in `migrations/schema.sql`. It is **authoritative for tables/columns/constraints**.
2. **Known blind spot:** the schema export captures tables only — **RLS policies and function bodies are NOT in the repo**, and tables may have RLS even though `schema.sql` shows none (verified 2026-05-31 for the items tables). For any auth/RLS-sensitive work, treat the live DB as truth; verification queries live in `migrations/_verify_schedule_rls.md`.
3. `Grep` the codebase for the table name — list which routes/hooks read or write it. A column change without updating all of them is an incomplete change.

## Step 2 — Write the migration file FIRST (Hard Rule 24)

Path: `migrations/YYYY-MM-DD_short-description.sql` (today's date, kebab-case). One file per session even if it holds several unrelated changes. Template:

```sql
-- migrations/YYYY-MM-DD_short-description.sql
--
-- WHAT: <one line per change>
-- WHY:  <the feature/bug driving it>
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (idempotent guards below).

-- 1. <change>
ALTER TABLE public.things
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2. <index — always name it explicitly>
CREATE INDEX IF NOT EXISTS things_user_id_idx ON public.things (user_id);
```

Rules:
- Prefer idempotent forms (`IF NOT EXISTS`, `DO $$ ... $$` guards for policies/constraints) so a partial run can be safely repeated.
- Order statements by dependency (table → columns → indexes → policies → RPCs → backfills).
- Backfills that touch many rows: state the expected row count and keep them as separate, clearly-marked statements.
- **DROP/DELETE/destructive changes: STOP and get explicit user confirmation first.**

## Step 3 — Update `migrations/schema.sql` to the final end state

Same session, after the migration file exists (the `check-migration` hook enforces the pairing). `schema.sql` is a snapshot, not a log — it must read as if the table was always in its final shape.

## Step 4 — RLS decision tree (for new tables or new policies)

Every new table needs RLS. Choose the pattern by table shape:

```
Is the table user-owned with its own user_id column?
├─ YES → enable RLS + direct policies: USING (user_id = auth.uid()) for
│        SELECT/INSERT/UPDATE/DELETE. Done.
└─ NO — it's a child table (item_*, *_details, rows keyed by parent id)
   │
   ├─ NEVER write: EXISTS (SELECT 1 FROM parent WHERE parent.id = child.parent_id
   │               AND parent.user_id = auth.uid())
   │   That join re-evaluates PER ROW SCANNED → ~500 ms/table at 50 rows
   │   (Hard Rule 20 — this took down the schedule page once already).
   │
   ├─ Option A (preferred): SECURITY DEFINER RPC owns the access check;
   │   reads/writes go through the function, per-table RLS bypassed.
   │   Canonical: migrations/2026-05-11_schedule_bundle_rpc.sql
   │   + ERA Notes/05 - Performance/Performance Optimizations.md
   └─ Option B: denormalize user_id onto the child + direct
       user_id = auth.uid() policy + a trigger keeping it in sync with the parent.
```

Additionally: any hot read path fetching a parent + N child tables gets ONE `get_*_bundle()` RPC returning JSON aggregates — never N separate PostgREST calls (Hard Rule 21).

## Step 5 — Cascade the change through the stack (same session)

A DB change is not done at the SQL layer. Walk this checklist for every column/enum you touched:

- [ ] TS domain type (`src/types/` or feature `types.ts`)
- [ ] Zod schema in the API route(s) (`z.enum` values, new fields)
- [ ] API route select/insert/update statements
- [ ] Hooks / UI that render or edit the field
- [ ] Utilities (e.g. account `type` interacts with balance direction — `src/lib/balance-utils.ts` and the CHECK constraints in `schema.sql`)

`Grep` for the table name and old enum values to prove you caught every consumer.

## Step 6 — Gate

- [ ] Migration file exists and reads as a complete, ordered, re-runnable runbook
- [ ] `schema.sql` matches the migration's end state exactly (names, types, defaults)
- [ ] RLS pattern chosen from the tree; no `EXISTS`-subquery policies anywhere
- [ ] Every code reference to changed columns updated; `pnpm typecheck` clean
- [ ] Tell the user explicitly: **"Run `migrations/<file>.sql` in the Supabase SQL Editor before testing."** The app will 500 on missing columns until they do.

Then proceed to your calling playbook, and eventually `finish-task`.
