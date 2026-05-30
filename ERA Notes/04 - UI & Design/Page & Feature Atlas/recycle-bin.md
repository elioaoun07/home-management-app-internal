---
slug: recycle-bin
title: Recycle Bin
category: utility
route: /recycle-bin
type: page
parent: null
children: []
status: active
tags: []
---

# Recycle Bin

> Unified recovery surface for soft-deleted records — search, filter by type, restore or permanently delete.

## Files

- **Page**: `src/app/recycle-bin/page.tsx`
- **Main component**: `src/components/recycle-bin/RecycleBinList.tsx`
- **Sub-components**:
  - `src/components/recycle-bin/SearchBox.tsx`
  - `src/components/recycle-bin/FiltersPanel.tsx`
  - `src/components/recycle-bin/SectionNav.tsx`

## Hooks

- `src/features/recycle-bin/hooks.ts` — list, restore, empty mutations

## API routes

- `GET /api/recycle-bin` → list soft-deleted records
- `POST /api/recycle-bin/restore` → restore a record
- `POST /api/recycle-bin/empty` → permanent bulk delete
- `GET /api/recycle-bin/counts` → badge counts per section

## DB tables

- No owned tables. Reads `deleted_at` flags from origin tables across modules.

## How to get here

- Settings menu or direct URL: `/recycle-bin`

## What it links to

- No child routes — all interactions are in-page.

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Recycle Bin/`

## Notes

- "Empty Bin" is irreversible — use a destructive confirmation dialog, not a standard Undo toast.
- Adding a new restorable type: add `deleted_at` to origin table → register in `hooks.ts` → add section in `SectionNav.tsx`.
- Counts endpoint is used for nav badge — keep it fast (COUNT only).
