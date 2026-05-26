# Message Actions

**Type:** Junction
**Vault doc:** `ERA Notes/03 - Junction Modules/Message Actions/`

## What it does

A chat message can become a transaction, a reminder, a shopping list item, etc. The message-actions layer parses intent from the message text and shows a modal pre-filled with the parsed data.

## Files at a glance

- **Action layer**: `src/features/hub/messageActions.ts`
- **Modals**:
  - `src/components/hub/AddTransactionFromMessageModal.tsx`
  - `src/components/hub/AddReminderFromMessageModal.tsx`
- **DB table**: `hub_message_actions` (links a message to the spawned record)

## Common edit scenarios

- **"Add a new message action type (e.g. 'create future purchase')"** →
  1. Add the parser in `messageActions.ts`.
  2. New modal in `src/components/hub/AddXxxFromMessageModal.tsx`.
  3. Insert into `hub_message_actions` on success.
- **"Change how the parser detects intent"** → `messageActions.ts`. If using LLM, consider routing through the AI Assistant intent layer instead.

## Gotchas

- LLM parsing path is slow → `timeoutMs` ≥ 60_000.
- Always preserve a back-link to the source message in `hub_message_actions` so the user can undo cleanly.

## Connected modules

- **Hub Chat** ([./hub-chat.md](./hub-chat.md)).
- **Transactions**, **Items & Reminders**, **Shopping List** — typical action targets.
- **AI Assistant** ([./ai-assistant.md](./ai-assistant.md)) — overlaps for LLM-based parsing.
