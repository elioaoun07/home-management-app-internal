---
created: 2026-03-23
type: feature-doc
module: message-actions
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/message-actions
---
# Hub Message Actions & Chat-to-Transaction

> **Module:** `src/features/hub/messageActions.ts`, `src/components/hub/` | **API:** implied via existing transaction API
> **DB Tables:** `hub_message_actions`
> **Status:** Active

## Overview

Users can long-press any chat message in a Hub thread to open an action menu. The primary action is **"Add as Transaction"** — the message content is NLP-parsed for amount, category, and date, then pre-filled into a transaction modal. A junction table prevents duplicate conversions.

## Database

```sql
CREATE TABLE hub_message_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES hub_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('transaction', 'reminder', 'forward', 'pin')),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, action_type)  -- prevents duplicates
);
```

RLS: household-level security — users can only see/create actions in their own household.

**Migration:** `migrations/add_hub_message_actions.sql`

## How It Works

### User flow

1. User long-presses a message bubble (500ms delay → haptic feedback)
2. Action menu appears above the message with blur backdrop
3. If action already exists: button shows "✓ Already Added" (disabled)
4. Otherwise: "💰 Add as Transaction" → opens `AddTransactionFromMessageModal`
5. Modal pre-fills parsed data; user edits and saves
6. On save: transaction created → `useCreateMessageAction` links it with `transaction_id`
7. Green "💰 transaction" badge appears on message

### NLP parsing (`src/lib/nlp/messageTransactionParser.ts`)

- **Amount**: regex matches `$20`, `20$`, `20 dollars`, `20 USD`, `20.50$`
- **Date**: `today`, `yesterday`, `last friday`, `this monday` → ISO date string
- **Category**: fuzzy string matching (Levenshtein), subcategories first (threshold 0.7), then parents (0.6)

## Key Files

- `src/features/hub/messageActions.ts` — hooks: `useMessageActions(ids[])`, `useCreateMessageAction()`, `useDeleteMessageAction()`, `useHasMessageAction()`
- `src/lib/nlp/messageTransactionParser.ts` — NLP amount/date/category extraction
- `src/hooks/useLongPress.ts` — cross-platform long-press hook with haptic feedback
- `src/components/hub/AddTransactionFromMessageModal.tsx` — pre-filled transaction modal
- `src/components/hub/HubPage.tsx` — long-press integration on message bubbles

## Adding New Action Types

1. Update the `action_type` CHECK constraint in a migration
2. Add icon mapping in message badge renderer (`HubPage.tsx`)
3. Add button to action menu with handler
4. Create mutation via `useCreateMessageAction` with the new `actionType`

## Gotchas

- Duplicate prevention works at both DB level (UNIQUE constraint) and UI level (disabled button) — never bypass the UI check
- `useMessageActions` accepts an array of IDs and batch-fetches — pass `messages.map(m => m.id)` not individual IDs
- Transaction modal is lazy-loaded (`next/dynamic`) for performance
- System messages (non-user messages) should have long-press disabled
