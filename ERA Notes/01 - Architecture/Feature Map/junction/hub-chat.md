# Hub Chat

**Type:** Junction
**Route:** `/chat`, `/hub` (legacy)
**Vault doc:** `ERA Notes/03 - Junction Modules/Hub Chat/`

## What it does

The Hub is the **top-layer primary interface** for household interactions. Chat threads between household members; messages can spawn actions (transaction, reminder, shopping list item, etc.) inline. The Hub is the low-friction surface — standalone forms are the precision tools.

## Files at a glance

- **Page entry**: `src/app/chat/page.tsx`, `src/app/chat/layout.tsx`
- **Components**:
  - `src/components/hub/HubPage.tsx`
  - `src/components/hub/ShoppingListView.tsx`
  - `src/components/hub/NotesListView.tsx`
  - `src/components/hub/ItemChatSheet.tsx`
  - `src/components/hub/AddReminderFromMessageModal.tsx`
  - `src/components/hub/AddTransactionFromMessageModal.tsx`
  - `src/components/hub/InlineVoiceRecorder.tsx`
  - `src/components/hub/VoiceMessagePlayer.tsx`
  - `src/components/hub/ProductComparisonSheet.tsx`
- **Hooks**:
  - `src/features/hub/hooks.ts`
  - `src/features/hub/messageActions.ts` ← see [./message-actions.md](./message-actions.md)
  - `src/features/hub/itemLinksHooks.ts`
  - `src/features/hub/chatNotificationPolicy.ts`
  - `src/features/hub/useHubPersistence.ts`
  - `src/features/hub/usePartnerId.ts`
- **API routes**:
  - `src/app/api/household/` (thread + partner discovery)
  - `src/app/api/hub/` (messages — confirm)
- **DB tables**: `hub_chat_threads`, `hub_messages`, `hub_message_actions`

## Common edit scenarios

- **"Edit the chat thread UI"** → `src/components/hub/HubPage.tsx`.
- **"Change what message actions are offered"** → `src/features/hub/messageActions.ts` + [./message-actions.md](./message-actions.md).
- **"Edit voice message recording / playback"** → `InlineVoiceRecorder.tsx`, `VoiceMessagePlayer.tsx`.

## Gotchas

- Hub is a junction — changes here can ripple to Transactions, Items, Shopping List. Read all connected module docs before non-trivial work.
- The legacy localStorage offline queue in `SyncContext` is only for hub shopping list. New code uses IndexedDB.

## Connected modules

- **Message Actions** ([./message-actions.md](./message-actions.md)).
- **Shopping List** ([./shopping-list.md](./shopping-list.md)).
- **Transactions, Items & Reminders** — message action targets.
- **AI Assistant** ([./ai-assistant.md](./ai-assistant.md)) — proactive briefings appear in Hub.
- **Household Sharing** ([./household-sharing.md](./household-sharing.md)).
