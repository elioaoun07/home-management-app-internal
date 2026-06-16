---
created: 2026-03-23
type: overview
module: message-actions
module-type: junction
tags:
  - type/overview
  - module/message-actions
---

# Message Actions

> **Source:** `src/features/hub/messageActions.ts`
> **Type:** Junction — connects Hub Chat, Transactions

## Docs in This Module

- [[Message Actions]]

## Key Concepts

- Long-press message menu
- NLP parsing (amount/date/category)
- Prevent duplicate conversions with unique constraint
- **Bulk convert**: `BulkConvertReviewSheet.tsx` calls `useCreateMessageAction` once per saved row (transaction, draft, or draft item) so each converted/drafted message auto-archives the same way a single-message conversion does. Undo deletes the message-action first, then the underlying record.

## See Also

- [[Hub Chat Overview|Hub Chat]]
- [[Transactions Overview|Transactions]]
