# Recycle Bin

**Type:** Standalone
**Route:** `/recycle-bin`

## What it does

A unified view of soft-deleted records (items, transactions, etc.) with search, filter, and restore.

## Files at a glance

- **Page entry**: `src/app/recycle-bin/page.tsx`
- **Components**:
  - `src/components/recycle-bin/RecycleBinList.tsx`
  - `src/components/recycle-bin/SearchBox.tsx`
  - `src/components/recycle-bin/FiltersPanel.tsx`
  - `src/components/recycle-bin/SectionNav.tsx`
- **Hooks**: `src/features/recycle-bin/hooks.ts`
- **API routes**: `src/app/api/recycle-bin/`
- **DB tables**: soft-delete flags on origin tables (see `schema.sql`)

## Common edit scenarios

- **"Add a new restorable record type"** → add the soft-delete flag column → register the source in `recycle-bin/hooks.ts` → add a section in `SectionNav.tsx`.

## Connected modules

- Reads from every module that soft-deletes.
