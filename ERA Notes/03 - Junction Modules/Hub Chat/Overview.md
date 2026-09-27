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
- **Message selection (HUB-73)**: long-press → Select messages starts with that message selected. The row circles allow multiple selection; the toolbar selects all visible rows, opens the existing bulk review sheet for addable Budget/Reminder messages, or opens a deletion scope sheet. "Delete for me" hides selected messages only for the current user; "Delete for everyone" is available only when every selected message was sent by the current user. Both have Undo. A review sheet (`BulkConvertReviewSheet.tsx`) prefills every selected addable row and saves it as a full record or a **draft** based on a per-row Confirm toggle. Budget rows without a detectable amount cannot be added in bulk. One account applies to the whole batch for budget rows. See [[Chat to Transaction Quickstart]] and [[Drafts Overview|Drafts]] for the draft-reminder concept (`items.status='draft'`).
- **Per-message color tags + color filter (HUB-11, shipped 2026-08-06)**: any message can be tagged with a color from a fixed 8-swatch preset (`hub_messages.color`, `src/features/hub/messageColors.ts`) — no color has a fixed meaning, the household decides (e.g. one color per person, or transfer vs expense). Set the "active compose color" via the palette button next to the input (sticky per-thread); long-press an existing message → the action menu's color row to recolor it. A header **Filter** button narrows the thread to one color at a time. When a color filter is active, "Select all" selects only visible messages with that color. On mobile, Filter and the other secondary controls live in Chat options.
- **Full-screen in-thread**: opening a thread hides the global app header (`chatFullscreenStore` signal read by `ConditionalHeader`/`MobileNav`); the thread list keeps the normal header.
- **Mobile composer (HUB-74)**: one 48px action button shows the mic for an empty Budget/Reminder draft and a send icon when text is present. The input can shrink within the phone width; the duplicate conversation toggle no longer crowds it. ERA conversation mode remains in Chat options. The recording controls follow the same 48px edge buttons, with a flexible waveform center. Voice upload uses `safeFetch` with a 60-second budget and its sent toast can undo the message.
- **Edge-swipe back**: dragging right from the left ~28px edge inside a thread returns to the thread list (iOS/Android-style back gesture); disabled during selection mode or with a sheet open.
- **One amount extractor (HUB-75)**: ERA's budget router, Hub `messageTransactionParser` and the voice classifier all read amounts through `src/lib/nlp/amount.ts` (`12$`, `$12`, `500k lbp`, `20 euros`). Amounts are **native currency** — `500k lbp` = 500000 LBP; the "LBP in thousands" rule is only the preference exchange rate and LBP-change field. ERA drafts a marked amount only on an own account in that currency (never converts, never drafts LBP on a USD account); an unmarked `500k` on a non-LBP default asks "Which currency?". Hub keeps its bare-number fallback (`allowBare`), ERA does not.
- **ERA effect tiers (HUB-76)**: `intents/speechAct.ts` gates every write intent in `rootIntentRouter` — negated, hypothetical, question, conditional and reported sentences become `clarify{reason:"speechAct"}`; negations never escalate to Ask AI. Native transfer, debt record and reminder delete (and a taught template for a destructive capability) return a `native_action` confirm card instead of writing; `nativeActions.ts` executes on tap with an Undo toast (transfer DELETE, debt DELETE, Recycle Bin restore). A timeout after a money POST replies *uncertain* and is never retried. Cross-currency transfers and non-USD debts are refused. `native_action` is never in `ERA_CAPABILITIES`, so Ask AI cannot propose transfers.
- **ERA Understanding engine (HUB-78, 2026-09-27)**: `src/features/era/engine.ts` holds the outcome contract (`deriveOutcome`, persisted in every assistant row's `intent_payload.outcome`), effect tiers and the handoff shape. Turn state: `EraPendingTurn` has a `slot` kind — ERA asks ONE question as chips (`EraAskChips`); a chip tap answers structurally, typed text is matched to the options, anything else is a new request. Pilot flows: one-sided transfers (`I took 300$ from Drawer` → [Wallet][Savings][Other]), reminders by name with no focus (`resolvers/reminderLookup.ts` over `get_schedule_bundle`; recurring → This one / Series, both Confirm; "this one" writes an occurrence exception through `/api/items/[id]/actions`), and the `/expense?era=<messageId>` handoff (`/api/era/messages/[id]` GET + append-only consumption, `useEraHandoff` in `MobileExpenseForm`; never overwrites unsaved edits; deletes the capture's draft on save). The model stays on misses only (HUB-77 decision). Gym: `tests/era-gym/` (`pnpm vitest run tests/era-gym`; `ERA_GYM_RECORD=1` re-records with the live model, ≤500 calls).
- **Coverage families (HUB-79)**: `resolvers/budgetFamilies.ts` — income and split hand off to `/expense` (default income account / Split toggle on; owner decisions 2026-09-27), `balance.read`, `recurring.cover` (links an existing transaction behind a Confirm card re-checked on tap — `mark-covered` itself advances on every call, BUD-85 — with the Recurring page's own Undo), spend today/yesterday/this week, `reminder.skip` (idempotent occurrence skip), shopping-add (`resolvers/shopping.ts`, one Hub message per item, Undo = soft delete).
- **Household lexicon (HUB-80)**: `era_lexicon` (owner-only RLS; migration `2026-09-27_era-lexicon.sql`, owner run = HUB-83). Pure rules in `lexicon.ts`, mirrored by `useEraLexicon`. Every chip choice is an example; a repeated choice makes the card offer "Always" (a default); "Forget that" revokes the last applied rule; "the box means Drawer" adds an alias. Rules re-bind to the speaker's current accounts every turn; a default never lowers the tier (money still confirms). `era_templates` is frozen — no new rows.
- **Reach (HUB-81)**: `src/features/era/reach.ts` is the module registry; `reach.test.ts` generates [[ERA Reach Matrix]] and fails if a Feature Index module is missing. "open trips" navigates; implicit doors (what should I wear → Outfits, going to Paris → Trips, meds → Healthcare) apply only after every router misses.
- **Follow-ups edit the last result (HUB-84)**: every editable result registers in focus memory with its TYPE (`focusMemory.ts`: reminder, shopping, draft, transfer_card). `intents/followUp.ts` detects an edit of "it" and extracts fields (group, quantity, name, amount, destination, category, remove); `rootIntentRouter` routes it by the referent's type (`amendLast`), so "make it under Spinneys" edits the shopping item ERA just added instead of asking what to reschedule. `resolvers/amend.ts` holds each type's edit contract: shopping → move group (Undo moves back) / quantity / rename / remove (Confirm); draft → replaced, create-then-delete (the PATCH route confirms drafts), Undo swaps back; transfer card → a new Confirm card. Values resolve against real data: one match applies, several ask with chips, none offers "New group · X" behind a card. The same group field works in the first sentence ("add salt under Spinneys"). Group moves are recorded as lexicon examples. With nothing in focus, "Change what?" waits for the answer (chips = newest open list items; a typed name works). "Move salt under Spinneys" finds the item by name (`listOpenShoppingItems`). After a reload, `focusRehydrate.ts` rebuilds "it" from the conversation's saved results.
- **One voice brain (HUB-16/HUB-82)**: Hub `/chat` voice mode now calls the same `runTurn` as typed ERA; `intentClassifier.ts` and the five legacy callbacks are deleted; control words live in `voice-conversation/controlWords.ts`. A spoken turn that leaves a confirm card takes "yes"/"no" by voice (`confirmProposal`/`dismissProposal`). Still separate: Hub long-press conversion prefill (`messageTransactionParser`) and the floating `/api/ai-chat` assistant (retires with HUB-48).
- WhatsApp-style voice recording with transcription
- Private threads with `is_private` column

## See Also

- [[Message Actions Overview|Message Actions]]
- [[Shopping List Overview|Shopping List]]
- [[Household Sharing Setup]]
- [[AI Assistant Overview|AI Assistant]]
