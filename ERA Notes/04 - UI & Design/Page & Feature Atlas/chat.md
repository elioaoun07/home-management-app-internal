---
slug: chat
title: Chat
category: standalone-page
route: /chat
type: page
parent: null
children: []
status: active
tags: []
---

# Chat

> ERA Hub Chat — the top-layer primary interface. Thread list + full-screen in-thread conversation with NLP-driven message-to-transaction/reminder conversion (single and bulk).

## Files

- **Page**: `src/app/chat/page.tsx`
- **Main component**: `src/components/hub/HubPage.tsx` (`ThreadConversation` renders the in-thread view; thread list is rendered separately in the same file)
- **Sub-components**:
  - `src/components/hub/AddTransactionFromMessageModal.tsx` — single-message → transaction
  - `src/components/hub/AddReminderFromMessageModal.tsx` — single-message → reminder/event
  - `src/components/hub/BulkConvertReviewSheet.tsx` — multi-select "Multi-add" review sheet (transactions or schedule items, confirm-or-draft per row)
  - `src/components/items/DraftRemindersDrawer.tsx` — review surface for draft reminders (`items.status='draft'`) created via bulk convert

## Hooks

- `src/features/hub/hooks.ts` — `HubMessage`, `HubChatThread`, thread/message queries
- `src/features/hub/messageActions.ts` — `useCreateMessageAction`, `useDeleteMessageAction` (links a message to the record it was converted into; auto-archives the message in the thread)
- `src/features/items/useItems.ts` — `useCreateReminder` (drafts use `status:'draft'`), `useDraftItems` (drafts list/count), `useUpdateItem` (confirm draft → `pending`)
- `src/features/transactions/useDashboardTransactions.ts` — `useAddTransaction`
- `src/features/drafts/useDrafts.ts` — draft transactions (`/api/drafts`)
- `src/lib/stores/chatFullscreenStore.ts` — `isThreadOpen` signal read by `ConditionalHeader`/`MobileNav` to hide the global app header while a thread is open

## API routes

- `POST /api/drafts` → `src/app/api/drafts/route.ts` (draft transactions; bulk-convert posts here directly via `safeFetch`)
- `POST /api/hub/message-actions`, `DELETE /api/hub/message-actions/:id` → message-action linking/undo

## DB tables

- `hub_chat_threads`, `hub_messages`, `hub_message_actions`
- `transaction_drafts` (via `/api/drafts`)
- `items` / `reminder_details` (draft schedule items, `status='draft'`)

## How to get here

- Bottom nav **Chat** tab (mobile)
- Direct URL: `/chat`

## What it links to

- Thread → full-screen conversation (same route, internal state — not a sub-route)
- Long-press a message → action menu → **Add as Transaction** / **Add as Reminder** / **Multi-add…** (enters bulk-select mode)
- Converted/drafted messages are hidden in-thread (existing `hasAnyAction` filter) once a message-action is linked

## Related vault doc

- `ERA Notes/03 - Junction Modules/Hub Chat/Overview.md`
- `ERA Notes/03 - Junction Modules/Hub Chat/Chat to Transaction Quickstart.md`
- `ERA Notes/03 - Junction Modules/Message Actions/Overview.md`
- `ERA Notes/02 - Standalone Modules/Drafts/Overview.md`

## Screenshots

- `chat-mobile.png`
- `chat-desktop.png`

## Notes

- **Full-screen in-thread**: the global `ConditionalHeader`/`MobileNav` hide while a thread is open (via `chatFullscreenStore`), since the thread is internal `HubPage` state, not its own route. Thread list keeps the standard header.
- **Edge-swipe back**: a left-edge touch drag (armed only when the gesture starts within ~30px of the left edge) animates the thread out and returns to the thread list — thread → list only, disabled during selection mode or with a sheet/modal open.
- **Bulk convert ("Multi-add")**: long-press → Multi-add enters selection mode; "Select all" auto-checks only numeric rows for budget threads (`parseMessageForTransaction`), all eligible rows for reminder threads (`parseSmartText`). The review sheet (`BulkConvertReviewSheet`) prefills each row and routes it to a full record or a draft based on a per-row Confirm toggle (budget rows are also forced to draft if future-dated). One account applies to the whole batch for budget rows (not per-row).
- **Draft schedule items**: reminders created unconfirmed get `items.status='draft'` (never `'event'` — `event_details` requires non-null start/end). They never auto-create push alerts (suppressed in `useCreateReminder`/`useCreateEvent`/`useCreateTask` while `status==='draft'`) and are excluded from the normal schedule/reminder lists. Reviewed via the amber "Draft Reminders" pill in `ItemsDashboard.tsx`'s header (mirrors the transaction Drafts pill in `AccountBalance.tsx`) → confirm sets `status:'pending'`, delete removes it.
- Bulk-convert save has a one-tap Undo (toast, 4s) that deletes the created message-actions and the underlying records (transaction/draft/item) and invalidates every affected query.
