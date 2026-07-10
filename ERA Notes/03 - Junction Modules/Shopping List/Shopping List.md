---
created: 2026-03-23
type: feature-doc
module: shopping-list
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/shopping-list
---
# Shopping List

> **Module:** `src/components/hub/ShoppingListView.tsx` | **API:** uses existing hub messages API
> **DB Tables:** `hub_chat_threads`, `hub_messages` (no new tables needed)
> **Status:** Active

## Overview

Hub chat threads with `purpose="shopping"` render as a collaborative shopping list instead of a chat interface. Items are regular text messages; checked state is tracked in localStorage. Real-time sync works automatically through existing message infrastructure.

## How It Works

- Shopping items = plain `hub_messages` with `message_type: "text"`
- Checked state = localStorage key `shopping-checked-items` (array of message UUIDs)
- Checked items move to bottom with strikethrough styling
- Both household members see real-time updates via `useRealtimeMessages`

**Sorting:** unchecked items oldest-first; checked items newest-first (at bottom).

## Item URL Links

Per-chat toggle for product links:

```sql
-- Added to hub_chat_threads
enable_item_urls BOOLEAN DEFAULT FALSE

-- Added to hub_messages
item_url TEXT DEFAULT NULL
```

**To enable:** tap "Links" button in chat header (gray = off, blue = on). When enabled, each item shows a link icon 🔗 to add/edit a product URL. Links persist through check/uncheck cycles.

**When to use:**
- Gift shopping lists → share product pages
- Online shopping → link to product pages

**When to keep off:**
- Regular grocery lists (keeps UI clean)

## Thread Purposes

Available purposes for `hub_chat_threads`:

| Purpose | Icon | Description |
|---|---|---|
| `general` | 💬 | General conversation |
| `budget` | 💰 | Budget-related |
| `reminder` | ⏰ | Reminders |
| `shopping` | 🛒 | Shopping list mode |
| `travel` | ✈️ | Travel planning |
| `health` | 🏥 | Health tracking |
| `notes` | 📝 | Notes |
| `other` | 📋 | General other |

## Key Files

- `src/components/hub/ShoppingListView.tsx` — shopping list UI component
- `src/components/hub/HubPage.tsx` — renders `ShoppingListView` when `thread.purpose === "shopping"`
- `src/features/hub/hooks.ts` — `ThreadPurpose` type, `useRealtimeMessages`

## Best Practices

- One persistent list per shopping category (e.g., "Weekly Groceries", "Costco Run", "Gift Ideas")
- Uncheck items you buy regularly rather than re-adding them
- Periodically delete old completed items to keep lists clean
- Use descriptive thread names so purpose is clear

## Gotchas

- Checked state is client-side (localStorage) — clears if user clears browser storage or uses a different device. To share checked state across devices, the state would need to be stored in the DB (not currently implemented).
- No drag-and-drop reordering (removed for simplicity — items sort by creation time)
- "Clear all completed" is a planned enhancement, not yet implemented

## Item Chat Notifications and Unread State *(implemented 2026-07-10)*

Shopping items can have child messages through `hub_messages.parent_item_id`. These child messages now use `hub_message_receipts`, just like normal Hub messages:

- A partner reply on a public shopping thread triggers the normal Hub chat notification path.
- The cyan item dot means **there is an unread reply from the partner**, not merely that the item has chat history.
- Opening the item chat marks all partner replies for that item as read and clears the dot immediately.
- Replies sent by the current user do not create an unread dot on their own device.
- A later partner reply creates the dot again through the shopping-thread realtime subscription.

The parent messages response includes `unread_reply_count` per shopping item. The UI clears that field optimistically in the `["hub", "messages", threadId]` cache and invalidates `["hub", "threads"]` so the thread-level unread total also reconciles.
