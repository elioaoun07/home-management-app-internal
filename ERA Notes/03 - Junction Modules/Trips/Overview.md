---
created: 2026-05-28
type: feature-doc
module: trips
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/trips
related:
  - "[[Common Patterns]]"
  - "[[Cache Invalidation]]"
---

# Trips / Travel Module

> **Module:** `src/features/trips/` | **API:** `src/app/api/trips/` | **Pages:** `src/app/trips/`, `src/app/trips/[id]/`
> **Components:** `src/components/trips/`
> **DB Tables:** `trips`, `trip_places`, `trip_packing_items`, `trip_side_effects`
> **Type:** Junction (bridges Budget + Items/Chores/Recurring + Meal Planning + Catalogue)
> **Status:** Active

## Overview

A Trip is a lifecycle-driven record. When **activated**, it fires reversible side effects across Budget (auto-creates a dedicated expense account), the schedule (skips/pauses/reassigns items and chores), and Meal Planning. When **completed**, every side effect is reversed. The trip account is kept for records.

**Interaction model:**
- Draft/Upcoming trips are planning-only — no side effects.
- Active trips hold the live state. One active trip at a time is expected.
- Completion is deterministic via the `trip_side_effects` ledger — all changes are reversed in reverse-chronological order.

## Architecture

### Lifecycle
```
draft → upcoming → active → completed → archived
```

- `draft` / `upcoming`: editing only; activate button enabled if `start_date` and `end_date` are set.
- `active`: side effects fired; trip account created; locked from editing dates/scope.
- `completed`: all side effects reversed; account kept.
- `archived`: soft-hidden from list; not deleted.

### Activation flow (`POST /api/trips/[id]/activate`)
1. Auth check + load trip (verify `user_id` ownership).
2. Create expense account via direct Supabase insert (mirrors `accounts/route.ts:243-314`); seed `DEFAULT_EXPENSE_CATEGORIES`; create zero `account_balances` row.
3. Call `activate_trip(p_trip_id)` SECURITY DEFINER RPC — handles all schedule mutations in a single DB round-trip.
4. Update trip: `account_id`, `status='active'`, `activated_at`.

**Why SECURITY DEFINER RPC:** The activation touches many rows across multiple child tables (items, occurrence_actions, alert_suppressions, recurrence_pauses, meal_plans). Per Hard Rules #20/#21, a single RPC avoids per-row RLS re-evaluation and N×~170ms PostgREST round-trips.

### Household vs. Solo scope

| Scope | Chores | Recurring events | One-time events | Meal plans |
|---|---|---|---|---|
| household | Skipped (reason: `trip`) for both users | Paused via `recurrence_pauses` for both | Skipped + cancelled for both | `status='skipped'` for both |
| solo | `responsible_user_id` flipped to partner | Reassigned to partner | Reassigned to partner | Untouched (partner home) |

### Completion (`POST /api/trips/[id]/complete`)
Calls `complete_trip(p_trip_id)` RPC which iterates `trip_side_effects` in reverse order and undoes each:
- `chore_skip` → delete `item_occurrence_actions` + `item_alert_suppressions` for reason=`trip`
- `recurrence_pause` → delete matching `recurrence_pauses` row
- `event_skip` → restore `items.status`, reactivate `item_alerts`, delete skip action
- `meal_skip` → restore `meal_plans.status`
- `item_reassign` → restore `items.responsible_user_id`

**Caveat:** Reversal is blind — if the user manually changed something mid-trip that overlaps a side effect, the reversal may overwrite it. This is acceptable for v1.

## Database

### `trips`
Core record. Key constraint: `status IN ('draft','upcoming','active','completed','archived')`, `scope IN ('solo','household')`. `account_id` is null until activation.

### Visibility & access (app-layer — no RLS on trips tables)
No RLS is enabled on `trips`/`trip_places`/`trip_packing_items`/`trip_side_effects`; access is enforced entirely in the API routes via `getAccessibleTrip()` (`src/lib/tripAccess.ts`), mirroring the `is_public` account pattern (`getAccessibleAccount()` in `src/lib/accountAccess.ts`):
- **Solo-scope trips are private** — only the creator can see or touch them at all (list, detail, places, packing).
- **Household-scope trips are visible to the active household partner** — `GET /api/trips` includes them (`scope=household AND user_id=partner`), and `GET /api/trips/[id]` + places/packing routes resolve access via `getAccessibleTrip()` instead of a hard `user_id` filter.
- **Places & packing are collaborative** on an accessible household trip — both partners can read AND write (add/edit/delete places, check off packing items), regardless of which partner created the row. This matches the account `canWrite` precedent for shared resources.
- **The trip record itself stays owner-only** for PATCH/DELETE/activate/complete/clone — only the creator can edit trip fields, activate, complete, or delete the trip. The partner's detail view hides the edit pencil and activate/complete buttons (`trip.is_owner === false` in `TripDetail.tsx`).
- Every trip returned by the API carries a computed `is_owner` boolean (not a DB column) so the client can gate owner-only UI without knowing its own user id.

### `trip_places`
Saved hotels/activities/restaurants/etc. `priority IN ('mandatory','flexible','wishlist')`. `scheduled_date` + `scheduled_time` place the item in the day-by-day itinerary. Child of `trips` with `ON DELETE CASCADE`. Denormalized `user_id` for direct RLS policy.

### `trip_packing_items`
Packing list. `is_packed` toggled optimistically. Optional `catalogue_item_id` links to a Catalogue `documents`-type item (passport, visa). Child of `trips` with `ON DELETE CASCADE`. Denormalized `user_id`.

### `trip_side_effects`
Reversal ledger. One row per side effect fired at activation. `previous_value jsonb` stores what was overwritten. Deleted on trip completion. DO NOT query this table for display — it is an internal rollback log only.

### RPCs
- `activate_trip(p_trip_id uuid)` — SECURITY DEFINER, returns jsonb with effect counts
- `complete_trip(p_trip_id uuid)` — SECURITY DEFINER, returns jsonb with reversed count

## Key Files

- `src/features/trips/hooks.ts` — all TanStack Query hooks; `useActivateTrip` / `useCompleteTrip` use `timeoutMs: 30_000` (slow operations)
- `src/features/trips/queryKeys.ts` — hierarchical key factory (`tripKeys`)
- `src/types/trips.ts` — all interfaces + display metadata (status labels/colors, place type/priority labels)
- `src/app/api/trips/[id]/activate/route.ts` — account creation + RPC call
- `src/app/api/trips/[id]/complete/route.ts` — RPC call + status update
- `src/components/trips/TripDetail.tsx` — tabbed detail view (Overview / Places / Packing)
- `src/components/trips/TripsView.tsx` — list page, grouped by status

## Cache invalidation on activation/completion

`useActivateTrip` and `useCompleteTrip` invalidate:
- `tripKeys.lists()` — trips list
- `invalidateAccountData(qc)` — accounts + analytics
- `itemsKeys.all` — schedule/items
- `flexibleRoutinesKeys.all` — chores
- `mealPlanKeys.all` — meal planning

## Gotchas

1. **Two recurring systems**: `recurring_payments` (rent/bills) and recurring `items` (gym/schedule). Only recurring **items** are paused — financial recurring payments are intentionally left running.
2. **RPC must run with service role**: The activate/complete routes use `supabaseAdmin()` to call the RPCs. The RPCs are SECURITY DEFINER so `auth.uid()` is resolved from the caller at the time the RPC is invoked; the API route sets up the context by passing the trip ID only.
3. **Account creation can't be undone** via the completion flow — the trip account is kept after completion. If you need to delete the account, do it manually from the Accounts page.
4. **Templates**: `is_template=true` trips are excluded from the default list (pass `?templates=true` to include). Cloning via `POST /api/trips/[id]/clone` strips dates, resets status to `draft`, and clears `is_packed` on packing items.
5. **Solo trip reassignment**: `responsible_user_id` is flipped to the partner. If there is no partner (no active `household_links`), the solo path has no schedule side effects — only the account is created.
6. **`trip_side_effects` ledger**: Only actions created by `activate_trip()` are in the ledger. Manual user changes during the trip are NOT tracked. The blind reversal in `complete_trip()` is intentional for simplicity.
7. **Visibility is app-layer, not RLS**: don't assume `trips`/`trip_places`/`trip_packing_items` are protected at the DB level — every route must call `getAccessibleTrip()` (or filter to `user_id = auth uid` for owner-only routes). A raw Supabase query without that check is an open read/write on any trip ID.

## Out of scope (deferred)

- Multi-currency / FX tracking (no per-account currency exists yet)
- Push notification when trip starts/ends
- Trip sharing with non-household members
- Budget allocation per trip (envelope budgeting)
- Shopping list generation from packing items
