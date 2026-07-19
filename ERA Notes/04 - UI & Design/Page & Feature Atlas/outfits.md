---
slug: outfits
title: Outfits
category: standalone-page
route: /outfits
type: page
parent: null
children: []
status: active
tags:
  - module/outfits
---

# Outfits

> Wardrobe studio: digitize garments (photo → on-device background-removal cutout → tags), browse them in a filterable grid, and dress a 2D paper doll by swiping garments per body slot to compose and save outfits.

## Files

- **Page**: `src/app/outfits/page.tsx` (+ `layout.tsx` metadata)
- **Main component**: `src/components/outfits/OutfitsPage.tsx` (segmented control Wardrobe | Outfits)
- **Sub-components**: `WardrobeGrid`, `AddGarmentSheet` (3-step capture/cutout/tags), `GarmentDetailSheet`, `SizingProfileSheet`, `OutfitBuilder` (paper doll), `SlotSwiper` (snap-scroll swiper primitive), `SaveOutfitSheet`, `OutfitsGallery`, `OutfitSheet` (shared bottom-sheet shell) — all in `src/components/outfits/`

## Hooks

- `src/features/outfits/hooks.ts` — `useWardrobeItems`, `useOutfits`, `useWardrobeProfile` + garment/outfit/profile mutations (safeFetch, Undo toasts)
- `src/features/outfits/useSignedUrls.ts` — `useWardrobeImageUrls` (batched signed URLs, 50-min cache)

## API routes

- `/api/outfits` (GET list w/ `outfit_items(*)` embed, POST create) · `/api/outfits/[id]` (PATCH/DELETE)
- `/api/outfits/items` (GET/POST) · `/api/outfits/items/[id]` (PATCH/DELETE) · `/api/outfits/items/[id]/images` (POST multipart original+cutout, DELETE)
- `/api/outfits/signed-urls` (POST batch, ≤100 paths) · `/api/outfits/profile` (GET/PUT)

## DB tables

- `wardrobe_profiles`, `wardrobe_items`, `outfits`, `outfit_items` (+ Storage bucket `wardrobe`, private)

## How to get here

- Direct URL: `/outfits` (standalone shell — registered in `MobileNav.standaloneRoutes` and `ConditionalHeader.STANDALONE_APPS`)

## What it links to

- Self-contained (personal per user, no household sharing by locked design D4)

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Outfits/Overview.md` — design of record, locked decisions, image pipeline, STOP conditions

## Screenshots

- `outfits-mobile.png`
- `outfits-desktop.png`

## Notes

- Shared motion presets live in `src/lib/motion.ts` (app-wide; this module is the first consumer).
- Cutouts via lazy-loaded `@imgly/background-removal` (~40 MB model on first use, browser-cached); "Keep original" is the always-available fallback.
- Phases 2 (AI auto-tag) and 4 (weekly planner + wear log) are pending — see `ERA Notes/10 - Project Management/Outfits/4 - Checklist.md`.
