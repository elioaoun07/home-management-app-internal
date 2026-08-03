---
slug: trips
title: Trips
category: standalone-page
route: /trips
type: page
parent: null
children: []
status: active
tags: []
---

# Trips

> List of the household's trips, grouped Active / Upcoming & Drafts / Past. Entry point into trip planning and the (gated) lifecycle cascade.

## Files

- **Page**: `src/app/trips/page.tsx` → `TripsView`
- **Main component**: `src/components/trips/TripsView.tsx`
- **Sub-components**: `TripCard.tsx`, `TripStatusBadge.tsx`, `TripFormSheet.tsx` (create), template picker sheet (inline in `TripsView.tsx`)

## Hooks

- `useTrips()`, `useTripTemplates()`, `useCreateTrip()`, `useCloneTrip()` — `src/features/trips/hooks.ts`
- `tripCountdown()` — `src/features/trips/tripPhase.ts` (sorts the Upcoming & Drafts group by soonest departure)

## API routes

- `GET /api/trips` (`?templates=true`, `?own=true`)
- `POST /api/trips`

## DB tables

- `trips` (see `migrations/schema.sql`)

## How to get here

- Mobile nav: standalone route, registered in `MobileNav.tsx` (`standaloneRoutes`) and `ConditionalHeader.tsx` (`STANDALONE_APPS["/trips"]`)
- Direct URL: `/trips`

## What it links to

- `/trips/[id]` (tap a trip card)

## Related vault doc

- [[Trips/Overview]] (`ERA Notes/03 - Junction Modules/Trips/Overview.md`)

## Screenshots

- `trips-mobile.png`
- `trips-desktop.png`

## Notes

- A trip can sit in `status: draft` indefinitely — activation fires an unverified cross-module cascade and is a deliberate, gated action (see the Overview doc's Planner vs Live split). The list and badges are date-derived (`tripPhase.ts`), not status-derived, for draft/upcoming trips.
