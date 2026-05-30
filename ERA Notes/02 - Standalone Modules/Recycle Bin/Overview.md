---
created: 2026-05-30
type: overview
module: recycle-bin
module-type: standalone
status: active
tags:
  - type/overview
  - module/recycle-bin
related:
  - "[[Common Patterns]]"
---

# Recycle Bin

> **Page:** `src/app/recycle-bin/` | **Feature:** `src/features/recycle-bin/` | **Components:** `src/components/recycle-bin/`
> **DB Tables:** soft-delete flags on origin tables (see `schema.sql`)
> **Type:** Standalone
> **Route:** `/recycle-bin`

## Overview

A unified recovery surface for soft-deleted records across all modules. Users can browse, search, filter by type, and restore individual records. A bulk "Empty" action permanently deletes all soft-deleted records. The bin has no DB tables of its own — it reads `deleted_at` flags on the origin tables.

## Architecture

Soft-delete is implemented per-module by setting a `deleted_at` timestamp on the origin row instead of hard-deleting. The Recycle Bin API (`/api/recycle-bin`) queries all soft-deletable tables, unions the results, and returns them with their source type. The restore endpoint (`/api/recycle-bin/restore`) nulls out `deleted_at` on the target row. The empty endpoint (`/api/recycle-bin/empty`) hard-deletes all rows where `deleted_at IS NOT NULL`.

`SectionNav` splits results by source type (items, transactions, etc.) so users can filter to a specific module.

## Database

No owned tables. Reads `deleted_at` from origin tables across modules. Check `schema.sql` for which tables carry a `deleted_at` column.

## Key Files

- `src/app/recycle-bin/page.tsx` — page entry
- `src/components/recycle-bin/RecycleBinList.tsx` — main list with restore actions
- `src/components/recycle-bin/SearchBox.tsx` — text search across deleted records
- `src/components/recycle-bin/FiltersPanel.tsx` — filter by record type
- `src/components/recycle-bin/SectionNav.tsx` — section tabs per source type
- `src/features/recycle-bin/hooks.ts` — query/mutation hooks
- `src/app/api/recycle-bin/route.ts` — list soft-deleted records
- `src/app/api/recycle-bin/restore/route.ts` — restore a record
- `src/app/api/recycle-bin/empty/route.ts` — permanent bulk delete
- `src/app/api/recycle-bin/counts/route.ts` — badge counts per section

## Gotchas

- Adding a new restorable record type requires: add `deleted_at` column to the origin table → register the source in `hooks.ts` → add a section in `SectionNav.tsx` — all three together.
- The empty action is **irreversible** — confirm with the user before calling the `/empty` route. Hard Rule #1 (Undo toast) does not apply here because permanent delete cannot be undone; instead, show a destructive confirmation dialog.
- Counts endpoint is used for badge display in nav — keep it fast (COUNT queries only, no data fetch).

## See Also

- [[Common Patterns]]
- [[Items & Reminders]], [[Transactions]] — primary sources of soft-deleted records
