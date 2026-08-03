---
slug: feature-trips
title: Feature · Trips
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
---

# Feature · Trips

> Standalone feature module. Hosts hooks, query keys, and the date-derived trip-phase helper. Not directly routable.

## Files

- **Module dir**: `src/features/trips/`
  - `hooks.ts` — all queries/mutations
  - `queryKeys.ts` — `tripKeys`
  - `tripPhase.ts` — `getTripPhase()` / `tripCountdown()` (pure, unit-tested — the module's first test)
  - `index.ts` — barrel export

## Hooks

- Queries: `useTrips`, `useTripTemplates`, `useTrip`, `useTripBundle`, `useTripPlaces`, `useTripPacking`, `useTripDocuments`, `useTripDocumentUrls`
- Mutations: `useCreateTrip`, `useUpdateTrip`, `useDeleteTrip`, `useActivateTrip`, `useCompleteTrip`, `useCloneTrip`, `useCreateTripPlace`, `useUpdateTripPlace`, `useDeleteTripPlace`, `useReorderTripPlaces`, `useCreatePackingItem`, `useUpdatePackingItem`, `useDeletePackingItem`, `useBulkCreatePackingItems`, `useReorderPackingItems`, `useUpdatePackingCategories`, `useCreateTripDocument`, `useUpdateTripDocument`, `useDeleteTripDocument`

## API routes

- `/api/trips`, `/api/trips/[id]` (+ `/bundle`, `/activate`, `/complete`, `/clone`)
- `/api/trips/[id]/places` (+ `/[placeId]`, `/reorder`)
- `/api/trips/[id]/packing` (+ `/[itemId]`, `/bulk`, `/reorder`, `/categories`)
- `/api/trips/[id]/documents` (+ `/[docId]`, `/signed-urls`)

## DB tables

- `trips`, `trip_places`, `trip_packing_items`, `trip_documents`, `trip_side_effects`

## How to get here

- Used by `src/components/trips/*` — see [[trips]] and [[trips-id]].

## What it links to

- `/trips`, `/trips/[id]`

## Related vault doc

- [[Trips/Overview]] (`ERA Notes/03 - Junction Modules/Trips/Overview.md`) — Trips is a **Junction** module (CLAUDE.md Feature Index), despite living in this Atlas section alongside other standalone feature dirs.

## Screenshots

- n/a

## Notes

- `useUpdateTripPlace` and `useUpdatePackingItem` are offline-aware: on `isOfflineError`, they queue via `addToQueue({ feature: "trip", ... })` (`src/lib/offlineQueue.ts`) instead of failing. `useTripBundle` primes the places/packing/documents caches from one `get_trip_bundle()` RPC call so opening tabs on Trip Detail doesn't fire a fresh round trip each time.
