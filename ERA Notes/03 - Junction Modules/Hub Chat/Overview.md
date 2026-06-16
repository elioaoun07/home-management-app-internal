---
created: 2026-03-23
type: overview
module: hub-chat
module-type: junction
tags:
  - type/overview
  - module/hub-chat
---

# Hub Chat

> **Source:** `src/app/chat/`, `src/features/hub/`, `src/components/hub/`
> **DB Tables:** `hub_chat_threads`, `hub_messages`, `hub_message_actions`
> **Type:** Junction — connects Budget, Reminders, Shopping List

---

## Interaction Philosophy — ERA Hub as Top-Layer Interface

ERA Hub Chat is the **primary interaction layer** of the app. It is evolving into the main interface for all day-to-day input — the quickest, lowest-friction path to logging anything.

The app uses a **two-tier interaction model**:

| Tier                      | Interface               | When to use                                                                                                                       |
| ------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Quick / Casual**        | ERA Hub Chat            | Fast, conversational logging — "bought coffee $4.50", "remind me to call the bank in 20 minutes", "add milk to the shopping list" |
| **Detailed / Structured** | Standalone module pages | Full manual entry with complete fields — complex transactions with split categories, recurring payments, detailed recipes, etc.   |

**The rule of thumb:** if the action can be expressed naturally in a short message, it belongs in the Hub. If it requires careful field-by-field setup, open the dedicated module page.

### Example scenarios

- **Hub Chat** → "spent 35 on groceries" → message action converts it to a draft transaction instantly
- **Expense Entry Form** → opening the form manually to log a transaction with a custom subcategory, attach a note, and mark it private
- **Hub Chat** → "remind me to pay rent tomorrow at 9am" → creates a reminder item
- **Items page** → creating a recurring task with subtasks, custom alerts, and a Kanban stage

Standalone module pages (Expense Entry, Items, Recipes, etc.) remain fully functional as **precision tools** — they are not deprecated, they are the right tool when detail matters. Hub Chat offloads the high-frequency, low-friction interactions so those forms are reserved for cases that truly need them.

### AI role in Hub Chat

The AI Assistant is tightly integrated with Hub Chat. It reads household context (recent transactions, open reminders, shopping list state) and can:

- Interpret natural-language input and route it to the right module action
- Proactively surface briefings, alerts, and spending summaries inside chat
- Draft structured records (transactions, items) from conversational messages for the user to confirm

This makes Hub Chat **both reactive** (responds to what the user types) and **proactive** (AI pushes relevant information without being asked).

---

## Docs in This Module

- [[Chat to Transaction Quickstart]]
- [[Voice Messages]]
- [[Private Chats]]

## Key Concepts

- Long-press → action menu → NLP parsing → transaction/reminder creation
- **Multi-add (bulk convert)**: long-press → "Multi-add…" enters a checkbox selection mode; "Select all" auto-checks only numeric rows for budget threads, all eligible rows for reminder threads. A review sheet (`BulkConvertReviewSheet.tsx`) prefills every row and saves each as a full record or a **draft** based on a per-row Confirm toggle — never silently discarded. One account applies to the whole batch for budget rows. See [[Chat to Transaction Quickstart]] and [[Drafts Overview|Drafts]] for the draft-reminder concept (`items.status='draft'`).
- **Full-screen in-thread**: opening a thread hides the global app header (`chatFullscreenStore` signal read by `ConditionalHeader`/`MobileNav`); the thread list keeps the normal header.
- **Edge-swipe back**: dragging right from the left ~28px edge inside a thread returns to the thread list (iOS/Android-style back gesture); disabled during selection mode or with a sheet open.
- WhatsApp-style voice recording with transcription
- Private threads with `is_private` column

## See Also

- [[Message Actions Overview|Message Actions]]
- [[Shopping List Overview|Shopping List]]
- [[Household Sharing Setup]]
- [[AI Assistant Overview|AI Assistant]]
