---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/trips
---

# Trips · FABLED 1 — Current Implementation

> **FABLED:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Verified against `main` 2026-06-10. The vault doc ([Trips / Overview](<../../../03 - Junction Modules/Trips/Overview.md>)) is the read-before-touching source; this is the X-ray with the load-bearing facts pinned.

---

## 1 · Identity & shape

The app's **context-switch engine** — the only junction that reaches into every other module *and reverses itself*. Shipped `e058192` (2026-05-30). Clean, small surface:

```
src/features/trips/      hooks.ts (18 KB — all client state) + queryKeys
src/app/trips/           /trips list + /trips/[id] detail (thin pages)
src/components/trips/    TripsView · TripCard · TripDetail · TripFormSheet
                         TripActivateSheet · TripCompleteSheet · TripStatusBadge
                         TripPlacesList (10 KB) · TripPackingList (32 KB — the big one)
src/app/api/trips/       CRUD + [id]/activate · complete · clone · packing(+[itemId]) · places(+[placeId])
```

**DB (all four confirmed in `schema.sql`):** `trips` (FK → `accounts`), `trip_places`, `trip_packing_items`, `trip_side_effects`.

## 2 · The lifecycle — where the logic actually lives

⚠️ **The brains are NOT in the repo.** `api/trips/[id]/activate/route.ts` is only 4 KB and `complete/route.ts` 2 KB because the real work happens in two **SECURITY DEFINER RPCs in the live database**: `activate_trip()` and `complete_trip()`. The migrations folder retains **no dated migration files** (verified 2026-06-10 — only `schema.sql` + README + the RLS verification doc), so the RPC bodies are **unrecoverable from the repo**. Before any cascade change: dump the current function bodies from Supabase first (see [file 3 · O1](<3 - FABLED — Optimization Plan.md>)).

**Activation** (one DB round-trip, `timeoutMs: 30_000` on the hook):
- Logs every mutation into `trip_side_effects` — the reversal ledger.
- **Household trip:** chores skipped · recurring events paused via `recurrence_pauses` (Schedule's table) · one-time events cancelled · meal plans skipped.
- **Solo trip:** traveler's items reassigned to partner (`responsible_user_id` flip); meal planning untouched.
- **Deliberate rule:** `recurring_payments` are **NOT paused** — bills are still due while travelling. (A well-meaning "pause everything" change would break this decision.)
- Trip **account** created via **direct Supabase inserts that mirror the accounts-route logic** — *not* through `api/accounts`. Kept after completion (by design).

**Completion:** `complete_trip()` walks `trip_side_effects` and reverses everything logged. The ledger is therefore a **single point of correctness**: a cascade that fires without logging can never be reversed.

## 3 · Templates

`is_template = true` trips, cloned via `api/trips/[id]/clone` (3 KB). Expected semantics: clone copies places + packing, never side-effects — flagged for confirmation in [file 1](<../1 - Feature State — Current Reality.md>).

## 4 · Cross-module blast radius (what to re-read before touching)

| Touches | Via | Doc to read first |
|---|---|---|
| Schedule | `recurrence_pauses`, item cancel/reassign | Items & Reminders Overview (+ [Schedule FABLED 1](<../../Schedule/FABLED/1 - FABLED — Current Implementation.md>) §2 — pauses interact with occurrence expansion) |
| Chores | skip records | Chores (no vault doc yet — global gap) |
| Meal Planning | plan skips | Meal Planning Overview |
| Budget | trip account creation | Accounts & Balance Overview (+ [Budget FABLED 2 · G6](<../../Budget/FABLED/2 - FABLED — Gaps & Missing.md>) — the duplicated account-creation logic) |
| Layout | `/trips` registered in `ConditionalHeader` + `MobileNav` | layout-and-nav Feature Map file |

## 5 · Test & verification reality

**Nothing is verified end-to-end.** No unit tests, no integration run, and the activate→complete round-trip has never been exercised deliberately (deferred by choice, 2026-05-30 — still open 2026-06-10). The module is the riskiest combination in the app: widest blast radius + newest code + logic stored outside the repo.
