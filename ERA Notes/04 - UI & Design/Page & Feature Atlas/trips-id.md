---
slug: trips-id
title: Trips Id
category: standalone-page
route: /trips/[id]
type: page
parent: null
children: []
status: active
tags: []
---

# Trips Id

> Single-trip detail screen: 4 tabs (Overview, Places, Packing, Docs) plus the owner-only edit/activate/complete controls.

## Files

- **Page**: `src/app/trips/[id]/page.tsx` → `TripDetail`
- **Main component**: `src/components/trips/TripDetail.tsx`
- **Sub-components**:
  - Overview tab: `src/components/trips/overview/OverviewTab.tsx` (countdown, packing ring, itinerary readiness, next up, documents strip, planned spend)
  - Places tab: `src/components/trips/itinerary/ItineraryView.tsx` + `PlaceFormSheet.tsx` (day-by-day timeline; falls back to a flat date-grouped list for undated trips)
  - Packing tab: `src/components/trips/TripPackingList.tsx` (category grid, presets, assignment, reorder)
  - Docs tab: `src/components/trips/documents/DocumentsView.tsx` + `AddDocumentSheet.tsx`
  - Sheets: `TripFormSheet.tsx` (edit), `TripActivateSheet.tsx`, `TripCompleteSheet.tsx`

## Hooks

- `useTrip()`, `useTripBundle()` (primes places/packing/documents from one RPC), `useUpdateTrip`, `useDeleteTrip`, `useActivateTrip`, `useCompleteTrip`, `useCloneTrip` — `src/features/trips/hooks.ts`
- `useTripPlaces`, `useReorderTripPlaces`, `useTripPacking`, `useReorderPackingItems`, `useBulkCreatePackingItems`, `useUpdatePackingCategories`, `useTripDocuments`, `useTripDocumentUrls`, `useCreateTripDocument` — same file
- `tripCountdown()` — `src/features/trips/tripPhase.ts`

## API routes

- `GET/PATCH/DELETE /api/trips/[id]`, `GET /api/trips/[id]/bundle`
- `POST /api/trips/[id]/activate`, `POST /api/trips/[id]/complete`, `POST /api/trips/[id]/clone` — **gated**, see Overview doc
- `GET/POST /api/trips/[id]/places`, `PATCH/DELETE .../places/[placeId]`, `POST .../places/reorder`
- `GET/POST /api/trips/[id]/packing`, `PATCH/DELETE .../packing/[itemId]`, `POST .../packing/bulk`, `POST .../packing/reorder`, `PATCH .../packing/categories`
- `GET/POST /api/trips/[id]/documents`, `PATCH/DELETE .../documents/[docId]`, `POST .../documents/signed-urls`

## DB tables

- `trips`, `trip_places`, `trip_packing_items`, `trip_documents`, `trip_side_effects` (ledger — display it is out of scope; see Overview doc)

## How to get here

- From `/trips` — tap a trip card.
- Direct URL: `/trips/[id]`

## What it links to

- Storage buckets `trip-documents` (documents tab) via signed URLs.
- Trip account (`trips.account_id`) is referenced but not yet cross-linked into the Accounts tab — junction work, deferred.

## Related vault doc

- [[Trips/Overview]] (`ERA Notes/03 - Junction Modules/Trips/Overview.md`)

## Screenshots

- `trips-id-mobile.png`
- `trips-id-desktop.png`

## Notes

- The Places, Packing and Docs tabs read purely from the four `trip*` tables — no account/transaction/schedule reads (standalone-first, 2026-08 planner-mode upgrade). Overview's "Trip account" card stays a static pointer until junction work lands.
