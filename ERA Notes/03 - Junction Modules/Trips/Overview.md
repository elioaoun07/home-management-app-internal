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
> **DB Tables:** `trips`, `trip_places`, `trip_packing_items`, `trip_documents`, `trip_side_effects`
> **Type:** Junction (bridges Budget + Items/Chores/Recurring + Meal Planning + Catalogue)
> **Status:** Active

## Overview

A Trip is a lifecycle-driven record. When **activated**, it fires reversible side effects across Budget (auto-creates a dedicated expense account), the schedule (skips/pauses/reassigns items and chores), and Meal Planning. When **completed**, every side effect is reversed. The trip account is kept for records.

**Interaction model:**
- Draft/Upcoming trips are planning-only — no side effects.
- Active trips hold the live state. One active trip at a time is expected.
- Completion is deterministic via the `trip_side_effects` ledger — all changes are reversed in reverse-chronological order.

### Planner mode vs. Live mode *(added 2026-08-03)*

The module splits cleanly into two halves with very different risk profiles — read [[Trips — Master Book]] before touching either:

- **Planner mode** — dates, itinerary (places with times), packing, documents. Reads/writes only the four `trip*` tables, nothing else. Verified via `pnpm test` + typecheck, safe for any-model work, and **works with the trip permanently in `draft`** — a trip does not need to be activated to be useful. `getTripPhase()`/`tripCountdown()` (`src/features/trips/tripPhase.ts`) derive a `planning/soon/travelling/home` phase from dates alone, independent of `status`, precisely so the badge/countdown/list-ordering stay meaningful for a trip that is never activated.
- **Live mode** — `activate_trip()`/`complete_trip()`/`trip_side_effects`. Unverified end-to-end (TRIP-1/2/3 still open), RPC bodies not in the repo, human-first per the Successor Briefing. **Untouched by the 2026-08-03 planner-mode upgrade** — every itinerary/packing/documents feature below reads only `trip_places`/`trip_packing_items`/`trip_documents`/`trips`, never `trip_side_effects`, and none of it calls `activate_trip`/`complete_trip`.

`TripActivateSheet` carries an explicit warning that the cascade is unverified, so a user can knowingly choose to keep using a trip as a planner instead of activating it.

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
No RLS is enabled on `trips`/`trip_places`/`trip_packing_items`/`trip_side_effects`/`trip_documents` *(5th table added 2026-08-03, same pattern — see Master Book Pain Inventory)*; access is enforced entirely in the API routes via `getAccessibleTrip()` (`src/lib/tripAccess.ts`), mirroring the `is_public` account pattern (`getAccessibleAccount()` in `src/lib/accountAccess.ts`):
- **Solo-scope trips are private** — only the creator can see or touch them at all (list, detail, places, packing).
- **Household-scope trips are visible to the active household partner** — `GET /api/trips` includes them (`scope=household AND user_id=partner`), and `GET /api/trips/[id]` + places/packing routes resolve access via `getAccessibleTrip()` instead of a hard `user_id` filter.
- **Places & packing are collaborative** on an accessible household trip — both partners can read AND write (add/edit/delete places, check off packing items), regardless of which partner created the row. This matches the account `canWrite` precedent for shared resources.
- **The trip record itself stays owner-only** for PATCH/DELETE/activate/complete/clone — only the creator can edit trip fields, activate, complete, or delete the trip. The partner's detail view hides the edit pencil and activate/complete buttons (`trip.is_owner === false` in `TripDetail.tsx`). **One deliberate exception** *(2026-08-03)*: `trips.custom_packing_categories` is collaborative like packing items, even though it's a column on the owner-only `trips` row — `PATCH /api/trips/[id]/packing/categories` is its own route using `getAccessibleTrip()` (not the owner-only trip PATCH route) so either partner can add a packing category.
- Every trip returned by the API carries a computed `is_owner` boolean (not a DB column) so the client can gate owner-only UI without knowing its own user id.

`custom_packing_categories jsonb` *(added 2026-08-03)*: user-added packing category names for this trip. The 8 built-in categories (Documents, Clothes, Electronics, Toiletries, Health, Money, Accessories, Other) are a code constant (`src/constants/packingCategories.ts`) and are never stored — only categories beyond those live here. Written via the collaborative `PATCH /api/trips/[id]/packing/categories` route (not the owner-only trip PATCH route — see Visibility note below).

### `trip_places`
Saved hotels/activities/restaurants/etc. `priority IN ('mandatory','flexible','wishlist')`. `scheduled_date` + `scheduled_time` + `end_time` place the item in the day-by-day itinerary (`src/components/trips/itinerary/ItineraryView.tsx`); a `null` `scheduled_date` puts it in the "Ideas" bucket. `confirmation_code` and `address` *(added 2026-08-03)* back the copy-to-clipboard and "Directions" (Google Maps deep link) affordances on the itinerary row. Child of `trips` with `ON DELETE CASCADE`. Denormalized `user_id` for direct RLS policy. `position` is honored for the untimed "anytime" items on a day (drag-reorder via dnd-kit + `POST .../places/reorder`); timed items are always time-sorted.

### `trip_packing_items`
Packing list. `is_packed` toggled optimistically. Optional `catalogue_item_id` links to a Catalogue `documents`-type item (passport, visa) — accepted by the API but **no picker UI exists yet** (junction work, deferred). `assigned_to uuid` *(added 2026-08-03)* — optional household-member assignment ("Mine"/partner's name filter chips), person-absolute color identity per Hard Rule #14. `position` supports drag-reorder (`POST .../packing/reorder`) for items with no natural sort order.

### `trip_documents` *(added 2026-08-03)*
Passport/visa/tickets/insurance vault. `doc_type IN ('passport','visa','ticket','booking','insurance','other')`. `storage_path` (never a signed URL — see Storage below) points into the private `trip-documents` bucket. `expires_on` drives the Overview tab's expiry warning: red if it expires before `trips.end_date` ("expires before you're back home"), amber if within 90 days. Child of `trips`, **no `ON DELETE CASCADE` stated** (matches the other three trip tables' schema.sql definitions, which also omit it despite this doc's earlier claim for `trip_places`/`trip_packing_items` — treat cascade as unverified for all four until confirmed against the live DB, per Doctrine §7.3 code-wins-over-docs).

**Storage:** bucket `trip-documents` (private), path `${user_id}/${trip_id}/${uuid}.${ext}`, mirrors the `receipts`/`wardrobe` bucket pattern — the DB stores the path, never a URL; reads go through a batched, trip-scoped signed-URL route (`POST /api/trips/[id]/documents/signed-urls`, `useTripDocumentUrls()`) so a signed URL can never be minted for a path outside the requested trip.

### `trip_side_effects`
Reversal ledger. One row per side effect fired at activation. `previous_value jsonb` stores what was overwritten. Deleted on trip completion. DO NOT query this table for display — it is an internal rollback log only. **Note:** `Trips/4 - Checklist.md` item TRIP-4 calls for a "trip impact panel" that reads this table for display, which directly contradicts the instruction above — unresolved, flagged in the Master Book Pain Inventory, not decided by this doc.

### RPCs
- `activate_trip(p_trip_id uuid)` — SECURITY DEFINER, returns jsonb with effect counts. **Body not in the repo** — see Master Book.
- `complete_trip(p_trip_id uuid)` — SECURITY DEFINER, returns jsonb with reversed count. **Body not in the repo.**
- `get_trip_bundle(p_trip_id uuid)` *(added 2026-08-03, IS in the repo — `migrations/2026-08-03_trips-planner-upgrade.sql`)* — read-only SECURITY DEFINER RPC returning `{ trip, is_owner, places, packing, documents }` as one JSON payload. Replicates `getAccessibleTrip()`'s access rule inside the function (owner always; partner only on a household-scope trip) rather than calling it, since RPC bodies can't import TS helpers. `GET /api/trips/[id]/bundle` → `useTripBundle()` primes the `tripKeys.detail/places/packing/documents` caches from this single call so opening Trip Detail's tabs doesn't cost the 3-4 sequential PostgREST round-trips Hard Rule #21 warns about. Does not touch `trip_side_effects` or either lifecycle RPC.

## Key Files

- `src/features/trips/hooks.ts` — all TanStack Query hooks; `useActivateTrip` / `useCompleteTrip` use `timeoutMs: 30_000` (slow operations); `useUpdateTripPlace`/`useUpdatePackingItem` queue via `addToQueue({ feature: "trip", ... })` on `isOfflineError` *(2026-08-03)*
- `src/features/trips/queryKeys.ts` — hierarchical key factory (`tripKeys`)
- `src/features/trips/tripPhase.ts` — `getTripPhase()`/`tripCountdown()`, pure + unit-tested (`tripPhase.test.ts`) *(2026-08-03)*
- `src/types/trips.ts` — all interfaces + display metadata (status labels/colors, place type/priority labels, document type labels)
- `src/constants/packingPresets.ts`, `src/constants/packingCategories.ts` — starter packing lists + the 8 built-in category names *(2026-08-03)*
- `src/app/api/trips/[id]/activate/route.ts` — account creation + RPC call
- `src/app/api/trips/[id]/complete/route.ts` — RPC call + status update
- `src/app/api/trips/[id]/bundle/route.ts` — `get_trip_bundle()` read, repo-resident *(2026-08-03)*
- `src/components/trips/TripDetail.tsx` — tabbed detail view (Overview / Places / Packing / Docs); calls `useTripBundle()` to prime the other three tabs' caches
- `src/components/trips/TripsView.tsx` — list page, grouped Active / Upcoming & Drafts (sorted by `tripCountdown()`, not `created_at`) / Past
- `src/components/trips/overview/OverviewTab.tsx`, `itinerary/ItineraryView.tsx`, `documents/DocumentsView.tsx` — the three rebuilt tabs *(2026-08-03)*

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
7. **Visibility is app-layer, not RLS**: don't assume `trips`/`trip_places`/`trip_packing_items`/`trip_documents` are protected at the DB level — every route must call `getAccessibleTrip()` (or filter to `user_id = auth uid` for owner-only routes). A raw Supabase query without that check is an open read/write on any trip ID.
8. **Two lifecycle RPCs are not in the repo; the bundle RPC is** *(2026-08-03)*: don't confuse `get_trip_bundle()` (read-only, repo-resident, safe) with `activate_trip()`/`complete_trip()` (write, live-DB-only, human-first). `grep -rn "activate_trip\|complete_trip" migrations/` still returns 0 — the planner-mode upgrade deliberately left that gap open rather than papering over it.
9. **`useTripBundle()` primes caches, it doesn't replace the per-tab hooks** *(2026-08-03)*: `TripDetail` calls it for the side effect of warming `tripKeys.places/packing/documents`; each tab still calls its own `useTripPlaces()`/`useTripPacking()`/`useTripDocuments()`. On a cold mount both fire in parallel (no request is saved on first paint) — the win is on tab switches, which read warm cache instead of firing a new request. Don't "optimize" this into removing the per-tab hooks without also passing bundle data down as props everywhere; that's a bigger refactor than shipped here.

## Out of scope (deferred)

- Multi-currency / FX tracking (no per-account currency exists yet) — place costs now render correctly in the place's own currency via `formatCurrency()`, but there is still no conversion between currencies.
- Push notification when trip starts/ends
- Trip sharing with non-household members
- Budget allocation per trip (envelope budgeting) — Overview's "Planned spend" card sums `trip_places.cost` only; it is explicitly labelled "not actuals," not a budget.
- Shopping list generation from packing items
- Catalogue/inventory picker for packing items (`inventory_item_id`/`catalogue_item_id` are accepted by the API, populated by no UI)
- Cross-linking the trip account's real balance/transactions into the Overview tab (junction work; deferred by explicit user request 2026-08-03 in favor of standalone-first)
