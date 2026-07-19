---
slug: feature-outfits
title: Feature · Outfits
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
  - module/outfits
---

# Feature · Outfits

> Standalone feature module. Hosts hooks/types/query keys for the Outfits wardrobe studio. Not directly routable.

## Files

- **Module dir**: `src/features/outfits/` — `types.ts` (slots/seasons/formality unions, rows, DTOs, `SlotMap` helpers), `queryKeys.ts` (`outfitKeys` factory), `hooks.ts`, `useSignedUrls.ts`

## Hooks

- `useWardrobeItems`, `useOutfits`, `useWardrobeProfile` (queries)
- `useCreateGarment`, `useUploadGarmentImages` (60 s timeout), `useUpdateGarment`, `useArchiveGarment` (optimistic), `useDeleteGarment`
- `useSaveOutfit`, `useUpdateOutfit`, `useDeleteOutfit`, `useSaveWardrobeProfile`
- `useWardrobeImageUrls` — batched signed-URL cache (50-min staleTime)

## API routes

- `/api/outfits`, `/api/outfits/[id]`, `/api/outfits/items`, `/api/outfits/items/[id]`, `/api/outfits/items/[id]/images`, `/api/outfits/signed-urls`, `/api/outfits/profile`

## DB tables

- `wardrobe_profiles`, `wardrobe_items`, `outfits`, `outfit_items`

## How to get here

- Consumed by `src/components/outfits/*` rendered from `src/app/outfits/page.tsx`.

## What it links to

- `/outfits` page (see `outfits.md` Atlas entry)

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Outfits/Overview.md`

## Screenshots

- n/a

## Notes

- All mutation toasts carry Undo (Hard Rule 1); garment hard-delete Undo restores tags only — photos are permanently removed from storage (delete button warns; archive is the soft path).
