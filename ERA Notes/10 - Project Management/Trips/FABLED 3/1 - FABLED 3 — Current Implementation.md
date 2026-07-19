---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/1 - FABLED 2 — Current Implementation.md
tags:
  - pm/fabled3
  - module/trips
---

# Trips · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) remains normative for the module X-ray — lifecycle states, `trip_side_effects` ledger, account auto-creation, schedule pause cascades. Re-verified via `git diff --stat c561635..HEAD -- src/features/trips src/app/api/trips src/app/trips src/components/trips` → only 9 files, +94/−45. This file writes ONLY the delta.

## The delta: household sharing (`b03b2bb`, 2026-07-11)

**New file `src/lib/tripAccess.ts` (43 lines)** — single access-decision function `getAccessibleTrip(supabase, userId, tripId)`:

- Owner: always accessible, `isOwner: true`.
- Partner: accessible only when `trip.scope === "household"` AND the active `household_links` partner matches (`getActiveHouseholdPartnerId` from `src/lib/accountAccess.ts`). Solo trips stay private.
- **Asymmetric permissions by design:** places/packing on an accessible trip are collaborative read+write (mirrors the `is_public` account pattern); the trip record itself — edit/activate/complete/delete — stays **owner-only**, gated on `isOwner` per route.

Wired into 6 routes (`trips/route.ts` list, `[id]`, `places` ×2, `packing` ×2). `src/types/trips.ts` gained `scope`. UI: `TripCard`/`TripDetail` show partner badge/ownership state.

## Surface census (2026-07-18)

9 API routes, 3,251 LOC total. Largest: `TripPackingList.tsx` 962 · `hooks.ts` 465 · `TripPlacesList.tsx` 272. No new migrations for trips since v2 (sharing reused existing `scope` column — verify claim: `grep -n "scope" migrations/schema.sql`).

## What did NOT change (the load-bearing non-news)

- `activate_trip` / `complete_trip` **RPC bodies still absent from the repo** — only the route callers reference them (`grep -rn "activate_trip" migrations/` → 0 hits, 2026-07-18).
- Zero trips tests.
- The June accounts-semantics drift F2 flagged (trip-account creation mirrors old accounts logic) is unaddressed — and sharing now adds a **second** mirror (`tripAccess` mirrors `is_public` semantics). Two mirrored surfaces, both unverified.
