---
name: data-repair
description: "Safe workflow for production data fixes: SQL cleanup/backfill runbooks, browser-console scripts for stale localStorage/IndexedDB/cached state, and bad-row repairs. Rules: inspect + count first, dry-run, backup, idempotent, verification query after, rollback plan. Use whenever the user asks for 'a script to fix/clean/backfill X' or when a bug's cause is bad data rather than bad code."
---

# /data-repair — Production Data Fixes

> **Contract:** you are operating on the user's real household data with no staging environment. Every repair follows the same shape: **SEE IT → COUNT IT → BACK IT UP → FIX IT → VERIFY IT → know how to UNDO IT.** A repair script that starts with `UPDATE` or `DELETE` on line 1 is wrong by construction. Destructive operations (DELETE, dropping data) require the user's explicit go-ahead on the counted rows first.

## Step 0 — Classify the repair

| Bad data lives in… | Vehicle | Section |
|---|---|---|
| Supabase tables (wrong values, orphans, backfill after migration) | SQL runbook file, run manually in Supabase SQL Editor | A |
| Browser storage (localStorage, IndexedDB queue, persisted query cache, stale matches) | Browser-console script or an in-app one-time cleanup | B |
| Stored balances that drifted | **STOP** — special rules | C |

Before writing anything: verify every table/column in `migrations/schema.sql`, and find what code writes the bad value (`Grep`) — if code is still producing bad rows, fix the producer first (fix-bug skill) or the repair is a treadmill.

## Section A — SQL repairs

Deliver as `migrations/YYYY-MM-DD_repair-<desc>.sql`, clearly marked **DATA-ONLY** (no schema change ⇒ no `schema.sql` update needed). Structure every runbook exactly like this:

```sql
-- migrations/2026-07-04_repair-example.sql  (DATA-ONLY repair, no schema change)
-- WHAT: <one line>   WHY: <bug/cause>   EXPECTED ROWS: <n, from step 1>

-- 1. INSPECT — run first, confirm the rows and the count match expectations
SELECT id, user_id, <relevant cols>
FROM public.things
WHERE <precise criteria>;

-- 2. BACKUP — snapshot exactly what you're about to touch
CREATE TABLE IF NOT EXISTS public._backup_things_20260704 AS
SELECT * FROM public.things WHERE <same criteria>;

-- 3. REPAIR — same WHERE clause as the inspect query, verbatim
UPDATE public.things SET <fix>
WHERE <same criteria>;

-- 4. VERIFY — must return 0 rows / expected new state
SELECT count(*) FROM public.things WHERE <bad-state criteria>;

-- 5. ROLLBACK (if needed):
--    UPDATE public.things t SET <cols> = b.<cols> FROM public._backup_things_20260704 b WHERE t.id = b.id;
--    Drop the backup table only after the user confirms all is well.
```

Rules:
- The REPAIR `WHERE` is copy-pasted from the INSPECT `WHERE` — never retyped.
- Idempotent where possible (safe to re-run; state the fact either way).
- Household data: scope by `user_id` explicitly — decide with the user whether the partner's rows are in scope.
- Backfills after a schema change live in the migration file itself (db-migration skill), not a separate repair.
- Tell the user the expected row count and wait for confirmation **before** they run step 3 if the repair deletes anything.

## Section B — Browser-storage repairs

Known storage surfaces in this app (verified):
- **localStorage keys**: `LOCAL_STORAGE_KEYS` in `src/lib/queryConfig.ts` (`user_preferences`, `balance_cache_<accountId>`, `hm-theme`, `hm-view-mode`) plus the analytics cache prefix `analytics-v2` (`src/lib/queryInvalidation.ts` — it feeds React Query `initialData`, so stale entries resurrect stale UI after reload).
- **IndexedDB**: the offline mutation queue (`src/lib/offlineQueue.ts`).
- **Persisted React Query cache**: the app ships `@tanstack/react-query-persist-client` — cached query data can survive reloads; check where the persister is configured before assuming a refetch fixed anything.

Console-script pattern — log before removing, never `localStorage.clear()` (it nukes theme/preferences too):

```js
// 1. SEE IT
const hits = Object.keys(localStorage).filter(k => k.startsWith("analytics-v2"));
console.log("Will remove", hits.length, "keys:", hits);
// 2. FIX IT (run after reviewing the log)
hits.forEach(k => localStorage.removeItem(k));
```

If the same cleanup will be needed by other users/devices, don't hand out a console script — ship a one-time in-app cleanup (guarded by a versioned localStorage flag) and note it in the vault doc.

## Section C — Balance repairs (special rules)

Stored balances are guarded by design (see `money-rules`): read paths never mutate, auto-reconciliation is deliberately disabled, and all writes go through `adjustAccountBalance()`.

- **Never script a silent balance write-back.** The sanctioned repair path is the user-facing reconciliation flow (`POST /api/accounts/[id]/balance` with `is_reconciliation`/`discrepancy_explanation`) — it stamps the checkpoint and leaves an audit row in `account_balance_history`.
- If a systemic drift needs SQL anyway: repair the **cause rows** (transactions/transfers), let the balance formula re-derive — and only touch `account_balances` directly with the user's explicit sign-off, with a history entry explaining it.

## Checklist before leaving this skill

- [ ] Producer of the bad data found (fixed, or consciously deferred with a note)
- [ ] Inspect query + row count shown to the user; explicit OK obtained for anything destructive
- [ ] Backup step included; rollback written; verification query returns the expected state
- [ ] Runbook file delivered (`migrations/YYYY-MM-DD_repair-*.sql`) or console script with a SEE-IT log
- [ ] Balances only via the sanctioned path; PM note if this repairs a logged bug (finish-task)
