---
created: 2026-03-23
type: overview
module: drafts
module-type: standalone
tags:
  - type/overview
  - module/drafts
---

# Drafts

> **Source:** `src/features/drafts/`
> **Type:** Standalone

## Docs in This Module

_No dedicated docs yet — add feature documentation here._

## Two draft concepts — don't confuse them

| | Draft **transactions** | Draft **schedule items** |
|---|---|---|
| Table | `transaction_drafts` (via `/api/drafts`) | `items` with `status='draft'` |
| Created by | Voice entry, incomplete expense form, future-dated bulk-convert rows | Unconfirmed bulk-convert reminder rows (Hub Chat "Multi-add") — added 2026-06-16 |
| Review UI | `src/components/expense/DraftsDrawer.tsx`, badge pill in `AccountBalance.tsx` (`balance.draft_count`) | `src/components/items/DraftRemindersDrawer.tsx`, badge pill in `ItemsDashboard.tsx` header |
| Confirm path | `useConfirmDraft()` → PATCH `/api/drafts/:id`, deletes the draft row and inserts a transaction | `useUpdateItem()` → sets `status:'pending'` on the same row (no new row) |
| Notifications | N/A | Draft items never get auto-created push alerts — suppressed in `useCreateReminder`/`useCreateEvent`/`useCreateTask` while `status==='draft'` (see `src/features/items/useItems.ts`) |
| Excluded from normal lists by default | Yes (separate table) | Yes — `get_schedule_bundle` RPC takes `include_drafts` (default `false`); `useItems()` excludes drafts unless `{ includeDrafts: true }` is passed |

Migration: `migrations/2026-06-16_draft-item-status.sql` (adds `'draft'` to the items status enum).
