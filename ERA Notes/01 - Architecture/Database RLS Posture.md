---
updated: 2026-08-04
status: living
---

# Database RLS Posture

> **This file is a reading of `migrations/db-state.json`, not a source of truth.** The snapshot is. Regenerate it (`migrations/db-state.sql` → save → `pnpm db:verify-rls`) before trusting anything here. Per Hard Rule #27, no prose in this vault — including this page — counts as evidence about RLS.
>
> Snapshot this page was written from: **2026-08-04**, 99 tables · 97 with RLS · 340 policies · 37 SECURITY DEFINER functions · 121 `ON DELETE CASCADE` FKs.

## Why this file exists

On 2026-08-04 household trips were invisible to the partner. Every layer of application code was correct; RLS was silently stripping the rows. Three separate documents asserted the trips family had no RLS at all, and all three were wrong — one so load-bearing that a new table had been deliberately shipped policy-free because of it. See the Trips Master Book Shipped Log (TRIP-15) and Hard Rule #27.

The lesson generalizes: **the repo cannot see RLS**, so every RLS claim it makes is a hypothesis. This page tracks the three postures a table can be in and which tables are in a *deliberate* one, so a future agent doesn't "fix" something intentional or ignore something dangerous.

## The three postures

| Posture | Means | Safe when |
|---|---|---|
| **RLS on + policies** | Normal. Policies decide row access. | The default for anything user- or household-owned. |
| **RLS on + NO policies** | Deny-all to clients. Only the service role (`supabaseAdmin()`) can read or write. | **Deliberate** — the strictest posture. Correct *only* if every access path uses `supabaseAdmin()`. If any route uses a user session, that route silently returns zero rows. |
| **RLS off** | 🔴 Open. Any authenticated user can read **and write** every row directly through PostgREST, bypassing every check in the API route. | Never safe for user data. Route-level `getAccessible*()` guards do not help — PostgREST is reachable with the anon key and any logged-in session. |

## 🔴 Open findings (2026-08-04)

Neither is fixed. Both need a migration; per Hard Rule #26 the owner runs it.

### `item_prerequisites` — RLS **disabled**, reachable from the browser
The higher-severity of the two. Referenced by 5 files, and critically **`src/features/items/useItems.ts` queries it client-side**, so it is exposed to the browser Supabase client. Any logged-in user can read or write any household's prerequisite rows. Other touch points: `src/app/api/items/route.ts`, `src/app/api/items/[id]/prerequisites/route.ts`, `src/app/api/nfc/[slug]/items/route.ts`, `src/lib/prerequisites/engine.ts`.

Fix shape: enable RLS and add a policy scoped through the parent `items` row. Per Hard Rule #20 this is a hot child table — do **not** write an inline `EXISTS (SELECT 1 FROM items …)` policy. Use a `SECURITY DEFINER` predicate the way `trip_is_accessible(uuid)` does, or denormalize `user_id` onto the table with a trigger.

### `guest_drinks` — RLS **disabled**
Lower severity: every current access goes through `supabaseAdmin()`, so nothing in the app depends on client access. It is still directly readable and writable through PostgREST. Simplest correct fix is to match its five `guest_*` siblings — enable RLS and add no policy, making it service-role-only.

## ✅ Deliberate service-role-only — do NOT "fix" these

RLS on, zero policies, all access via `supabaseAdmin()`. This is intentional hardening, not an oversight. Adding a permissive policy here would *weaken* them.

`default_categories` · `guest_allergies` · `guest_chat_messages` · `guest_feedback` · `guest_sessions`

The guest tables back the Guest Portal (`src/app/g/[tag]/`), which authenticates by slug rather than by Supabase session, so there is no `auth.uid()` to write a policy against. Service-role-only is the right answer for them.

## ✅ Trips family — verified correct 2026-08-04

Fixed by `migrations/2026-08-04_trips-household-rls.sql` (TRIP-15).

| Table | RLS | `rls_forced` | Policies |
|---|---|---|---|
| `trips` | on | false | 2 (own + household SELECT) |
| `trip_places` | on | false | 2 |
| `trip_packing_items` | on | false | 2 |
| `trip_packing_category` | on *(was off)* | false | 1 |
| `trip_documents` | on *(was off)* | false | 1 |
| `trip_side_effects` | on | false | 1 |

Two facts worth keeping, both verified from the snapshot rather than assumed:

- **Zero RESTRICTIVE policies exist anywhere in the database.** All 340 are PERMISSIVE, so they OR together and adding a permissive policy genuinely grants access. If a RESTRICTIVE policy ever appears, that stops being true — it would be AND'd and could veto everything. `pnpm db:verify-rls` warns if one shows up.
- **`rls_forced` is false on every table.** This is what makes the `SECURITY DEFINER` bypass work. If `FORCE ROW LEVEL SECURITY` were ever enabled, `get_trip_bundle()`, `trip_is_accessible()`, `get_schedule_bundle()` and the other 34 SECURITY DEFINER functions would stop bypassing RLS and several read paths would silently empty. The checker warns on this too.

## Debugging a visibility bug

Full protocol in Hard Rule #27 and the `fix-bug` skill's Phase 1.5 gate. The short version:

1. Read `migrations/db-state.json` **before** reading route code.
2. Silent + asymmetric = RLS. RLS never errors; it removes rows. "Correct query, zero rows, no error, works for the owner but not the partner" is the fingerprint.
3. If a `SECURITY DEFINER` RPC path works where the equivalent PostgREST path fails, that is near-proof RLS is the filter — SECURITY DEFINER bypasses it.
4. Never conclude "the code is fine, so it must be data" without policy bodies in hand.

## Related

- `migrations/db-state.sql` — the introspection query · `scripts/check-db-state.mjs` — `pnpm db:verify-rls`
- Hard Rules #20 (no `EXISTS` policies on hot child tables), #26 (no agent writes), #27 (RLS-first triage)
- `ERA Notes/03 - Junction Modules/Trips/Overview.md` §Visibility & access
- `ERA Notes/10 - Project Management/Trips/Trips — Master Book.md` — TRIP-15
