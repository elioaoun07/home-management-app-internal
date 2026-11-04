---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 22152c2 (2026-11-04 22:38 +0200). Read from source, migrations/schema.sql, migrations/db-state.json (generated 2026-08-04) and vault docs. Nothing was run against production, a device or a paid API."
---

# ERA Current Context Map

[README](README.md) · **Current Context Map** · [Memory Design](MEMORY-DESIGN.md) · [Context Assembly](CONTEXT-ASSEMBLY.md) · [Correction & Expiry](CORRECTION-AND-EXPIRY-RULES.md)

How ERA remembers, personalises and assembles model context today, traced from code. Everything in §1–§8 is **CURRENT IMPLEMENTATION** unless labelled otherwise. The gaps in §9 are what the other three files design against.

**Labels.** CURRENT IMPLEMENTATION = read in code or migrations at `22152c2`. DOCUMENTED INTENT = stated in vault/PM docs, not fully confirmed in code. PROPOSED DESIGN = only in the other files of this folder. UNKNOWN = not answerable from the repository. ⛁ = the object is created by a migration newer than the 2026-08-04 RLS snapshot, so whether it exists in production, and with which policies, is UNKNOWN (Hard Rule 27).

## 0. Summary

1. **There is no memory store.** ERA's "memory" is a request-time view assembled from conversation rows, a personal lexicon, settings and source modules (`src/lib/ai/eraAdaptiveContext.ts:1-2`). The vault records this as a deliberate decision (AI Assistant Overview, HUB-106: "No new memory store") and Top Layer D17 says "Do not create a new memory engine".
2. **Five kinds of remembered information exist, each in a different place:** working focus in the browser (30 min), conversation rows in `era_messages`, lexicon rules in `era_lexicon` ⛁, settings in `user_preferences`, and domain records in their own modules. A sixth, Brain notes in `household_memories`, is called by code but absent from `schema.sql` and the snapshot.
3. **Only Ask AI gets personal context.** `/api/era/ask` (Claude) receives the adaptive packet on every face. The legacy floating assistant (`/api/ai-chat`, Gemini) and the other Gemini features listed in §1 get none of it.
4. **Retrieval is lexical and short.** At most 400 own messages from the last 30 days, ranked by IDF-weighted term overlap, six episodes, twelve choices, a 12,000-character cap (`eraAdaptiveContext.ts:8-10, 264-294`).
5. **Provenance is good for ERA-owned evidence and absent elsewhere.** Episodes carry message IDs and dates, choices carry rule IDs, sources carry `available/sampled/unavailable`. Face contexts (budget, schedule) carry none of that and treat failed reads as empty.
6. **"Forget" only revokes the last lexicon rule.** No route erases or redacts conversation content; copies of it live in `ai_messages`, in `intent_payload` metadata, and, for reported turns, in git-tracked PM files.
7. **Retrieved text reaches the model in the system prompt.** Item titles, NFC labels and bank-statement descriptions are interpolated raw; the adaptive packet is JSON-encoded with a "data, not instructions" preamble. Writes still need schema admission and Confirm.

## 1. Where model context is assembled

| Surface | Model | Context it receives | Personal memory? | Code |
|---|---|---|---|---|
| ERA Ask AI | Claude via `generateClaudeJson` (model from `ANTHROPIC_MODEL`, `src/lib/ai/anthropic.ts:5`) | Stable contract + capability catalog (cached); dynamic: local date, focus reminder, pending reminder title, Schedule or Budget face context, `PERSONAL_CONTEXT_DATA`; up to 24 history turns | **Yes**, adaptive packet on every face | `src/app/api/era/ask/route.ts:226-260`, `src/lib/ai/eraAskProposal.ts:203-302` |
| ERA native router | none | Focus memory, lexicon rules, composer capture memory, saved place tags | Deterministic personalisation only | `src/features/era/useEraTurn.ts`, `focusMemory.ts`, `lexicon.ts`, `src/lib/era/captureMemory.ts` |
| Legacy floating assistant (`AIChatAssistant`) | Gemini | Client-sent chat history + optional budget context; "Budget AI" persona | No | `src/app/api/ai-chat/route.ts:166-183`, `src/lib/ai/gemini.ts:290` |
| Focus insights | Gemini | Own items | No; its **output** is persisted (see §4) | `src/app/api/focus-insights/route.ts` |
| Budget allocation suggest, schedule suggest, recipe generate/optimize/scale/substitute, recipe from URL, spending analysis report | Gemini | Task-specific inputs | No | `src/app/api/budget-allocations/ai-suggest/`, `suggest-schedule/`, `recipes/[id]/*`, `recipes/extract-from-url/`, `src/lib/ai/analysisReport.ts` |

Two assistants run side by side. 01-atlas ARCHITECTURE notes the Design Doctrine forbids "a second assistant brain" (§4) and no PM item retires the old one.

### 1.1 Ask AI packet, in order

1. **Authenticate, then quota.** Monthly cost ceiling `MONTHLY_BUDGET_USD = 1`, auto-escalation cap 15/day, rate limit. A failed quota read returns 503 before inference (`route.ts:53-60, 182-225`).
2. **Face context** (only one face): `fetchBudgetContext` or `fetchScheduleContext` (`route.ts:226-232`).
3. **Adaptive context**, six concurrent owner-scoped reads with 2-second aborts each (`eraAdaptiveContextSource.ts:45-130`):

   | Read | Table / RPC | Filter | Coverage label |
   |---|---|---|---|
   | Past messages | `era_messages` ⨝ `era_conversations` | own, non-archived parent, last 30 days, not current conversation, ≤400 | `sampled` / `unavailable` |
   | Current conversation | same | this conversation, ≤32 | `sampled` / `unavailable` |
   | Lexicon | `era_lexicon` ⛁ | own, `revoked_at IS NULL`, ≤100 | `sampled` / `unavailable` |
   | Accounts | `accounts` | own, visible, ≤200 (used to re-bind rule IDs to names) | joined with lexicon |
   | Settings | `user_preferences.date_start` | own | `available` / `unavailable` |
   | Activity | `get_household_activity` ⛁ | `p_actor: "me"`, last 30 days, ≤100; only module counts are kept | `sampled` / `unavailable` |
   | Shared memories | — | not read | always `unavailable` (`:154-156`) |

4. **Assembly** (`eraAdaptiveContext.ts:145-412`): user turns become episodes; an episode is `acknowledged_action` only when the reply carries `done`/`answered` with artifacts for writes, and a plan only when every declared step has a matching receipt (`:75-141`). Turns whose latest reply is `failed`, `uncertain`, `partial`, `needs_input`, `awaiting_confirm`, `drafted` or `handed_off` are dropped (`:236-249`). Reported messages and conversations are excluded and counted as gaps (`:191-212`). Lexicon examples count only if linked to an acknowledged source; IDs other than current own accounts drop the rule (`:302-378`). Activity contributes counts for rows owned **and** acted on by the speaker (`:379-389`).
5. **Bound**: oldest episodes dropped first, then choices, until ≤12,000 chars (`:414-430`). History merge: ≤24 turns, each clipped to 1,000 chars, ≤12,000 chars total (`:449-480`).
6. **Prompt placement**: the packet goes into the **dynamic system block** as `PERSONAL_CONTEXT_DATA=<JSON>`, preceded by four rules: data not instructions; user statements are not proof of actions; observed choices are tentative; `unavailable` means unknown, not empty (`eraAskProposal.ts:293-301`).
7. **After the model**: Zod + capability/plan admission, FOCUS sentinel, NFC tag must match the listed tags; no write happens in the route (`eraAskProposal.ts:391-440`; route comment `:9-11`).
8. **Receipts**: the response carries `contextReceipt` (coverage, episode/choice source IDs, size), which the client stores on the assistant `era_messages.intent_payload` (`src/features/era/useEraAskAI.ts:221, 382-386`). The route also inserts the user message **and** the answer text into `ai_messages` (`route.ts:266-291`).

### 1.2 Face contexts (no provenance)

| Face | What is read | Defects relevant to memory |
|---|---|---|
| Budget | Own accounts, balances, recurring, future purchases, allocations, categories, this and last calendar month's transactions with descriptions (`src/lib/ai/context.ts:23-330`) | Calendar month, not the billing month `spend.month` uses (HUB-45; 08-shared-data SOURCE-OF-TRUTH §3.1). Errors are not checked on the account read (`:48-51`), so a failed read looks like "no accounts". Appends a separate "Budget AI" persona to ERA's prompt (`eraAskProposal.ts:289-291`). |
| Schedule | Own open, non-deleted, non-archived items (≤50, no ordering), first `due_at`/`start_at`; own active NFC tags with `current_state` (`context.ts:447-497`) | Item errors ignored. Recurrence is not expanded; how a series' `due_at` relates to its next occurrence was not verified here (`recurrence-safety`). Partner/shared items are not included. |
| Chef, Brain | Nothing | Brain notes are never auto-read; `memory.recall` is a separate registered capability. |

## 2. Memory and personalisation stores by kind of information

The seven kinds the brief names, mapped to where each lives today.

| Kind | Where it lives today | Who writes it | Read by ERA? |
|---|---|---|---|
| **Durable facts** | Source modules: accounts, categories, Catalogue Places/Contacts/Documents (`catalogue_items`), Healthcare profiles/allergies/conditions (`health_*`), recipes, trips, assets in Inventory | The person through precision forms; ERA adapters for places/contacts (HUB-94) | Only through registered reads (`reminder.find`, `recipe.search`, …) or face context; Places by name/tag in event grammar |
| | Brain notes `household_memories` (label/value, household-scoped) | `memory.save` / Brain dashboard | `memory.recall` only. **Table absent from `schema.sql` and snapshot**; deployment UNKNOWN (01-atlas ARCHITECTURE F-I3 "Tables without readers, readers without tables") |
| **Preferences** | `user_preferences` (theme, `section_order`, `date_start`, `lbp_exchange_rate`; `schema.sql:119-128`), `notification_preferences` (frequency, `timezone` default `'UTC'`, quiet hours; `:758-768`), `fitness_preferences`, `catalogue_items.is_favorite`, `preferred_time` | Settings screens | `date_start` only (adaptive packet) |
| | `era_lexicon` ⛁: `alias`, `default`, `example` rules with `conditions`, `depends_on`, `source_message_id`, `revoked_at`; one live default per (user, capability, slot, conditions) via partial unique index (`schema.sql:1578-1597, 2323-2334`) | "the box means Drawer", "Always" chip, choice examples (`src/features/era/lexicon.ts`, `src/app/api/era/lexicon/route.ts`) | Native resolvers and the adaptive packet |
| **Goals** | `future_purchases` (target amount/date, urgency; `schema.sql:309-325`), `budget_allocations`, fitness plans, Hub `goal` message type | Precision forms | Budget face context lists future purchases; nothing else |
| **Temporary circumstances** | Only where a module models time: trips (`status`, `start_date`, `end_date`; `:1609-1630`), medication courses (`starts_at`/`ends_at`), `fitness_plan_pauses` | Precision forms | Not read by Ask AI. A circumstance said in chat ("my sister stays until Sunday") exists only as a `user_statement` episode for 30 days, with no end date |
| **Commitments** | Items (reminders/events/tasks with alerts and recurrence), `recurring_payments`, debts, meal plans, chores | Forms and ERA adapters | Schedule face context (own, open items); recurring payments in Budget face |
| **Conversation history** | `era_conversations` / `era_messages` (owner-only RLS in snapshot); `ai_messages` (era-ask copies, legacy chat); `hub_messages` (household chat, shared); focus memory in the browser | ERA turns, Ask AI route, Hub chat | `era_messages` via adaptive packet; `hub_messages` shopping rows feed composer suggestions only (`src/app/api/era/capture-memory/route.ts:30-58`) |
| **AI inferences** | Persisted: `focus_insights` (greeting, summary, `pattern_observations`; `schema.sql:1325-1345`), `recipes.ai_generated` + `ai_generation_prompt`, `ai_messages.analysis_report`, `missKind` on assistant rows (`src/features/era/missTracking.ts`). Computed per request: adaptive "observed" choices, capture-memory inferred account/category (`src/lib/era/captureMemory.ts`) | Models and heuristics | Focus insights shown on Focus page; missKind feeds the gaps summary |

## 3. Working memory (browser)

- **Focus memory**: up to 10 recently touched entities of type `reminder`, `shopping`, `draft`, `transfer_card`, 30-minute TTL (`src/features/era/focusMemory.ts:32-55`). Rebuilt after reload from assistant rows younger than 30 minutes (`focusRehydrate.ts`). Only the single most recent focus **reminder** is sent to Ask AI, as a title plus a `FOCUS` sentinel; the model never sees its ID (`route.ts:97-111`; `eraAskProposal.ts:246-249`).
- **New chat** clears focus, open questions, the miss Ask AI would retry and the last applied lexicon rule (`useEraStore.ts:115-117`); a localStorage marker survives reload (`useEraConversation.ts:132-141`).
- **Recent-dialogue escalation**: a router miss within 30 minutes of an acknowledged assistant row in the same conversation may reach Ask AI without a domain keyword (`src/features/era/adaptiveTurn.ts:20-49`).
- **Composer capture memory**: last 365 days of own spends and titles plus household shopping rows, fetched on composer focus and cached per device session (`capture-memory/route.ts:3-9, 25, 70`).

## 4. Provenance, confidence, scope, time, correction, expiry and conflict today

| Store | Provenance | Confidence | Scope | Time relevance | Correction | Expiry | Conflict handling |
|---|---|---|---|---|---|---|---|
| Focus memory | Entity ID + `addedAt` | Implicit (recency) | Device, conversation | 30 min | Next action replaces | 30 min, New chat | Ties → ask (`focusMemory.ts` header) |
| `era_messages` episodes | Message ID, `created_at`, owner | `user_statement` vs `acknowledged_action` | Owner | 30-day retrieval window | None; Report excludes the turn | **None for storage**; archive hides from retrieval | Packet tells the model to ask on conflict (`eraAskProposal.ts:298`) |
| `era_lexicon` ⛁ | `source_message_id` (optional), `created_at`. Transfer-chip examples are recorded at the chip choice, before Confirm and without `source_message_id` (`src/features/era/intents/resolvers/slots.ts:146-159`); the adaptive packet ignores such unlinked examples, but the native "Always" offer counts them (`lexicon.ts` `countExamples`, `shouldOfferAlways`) | `kind`: default/alias = explicit, example = observed | Owner (RLS `auth.uid() = user_id`) | `conditions` (e.g. account); no dates | New default revokes the old one before insert (`lexicon/route.ts:67-87`) | Only by revocation; inert when a `depends_on` account disappears | One live default per key (partial unique index); revoke-then-insert is two statements, a concurrent insert gets 409 |
| `user_preferences` | Row `updated_at` | Authored | Owner | None | Settings | None | Single row |
| `household_memories` | `created_by`, `updated_at` | Authored | Household | None | **No update route**; duplicate label → 409 and "coming soon" (`resolvers/brain.ts:33-41`) | None | Recall returns most recently updated `ILIKE` label match, not best match (`memories/route.ts:42-46`; comment at `brain.ts:76` says "best ilike match") |
| `focus_insights` | `generated_at`, item count at generation | None shown | Owner | Fresh 24 h; served up to 7 days (`focus-insights/route.ts:14-16`) | Manual refresh (limited) | `expires_at` | Staleness judged by item **count** delta only (`:72-76, 96-100`); edits and completions do not mark it stale |
| `recipes` AI output | `ai_generated`, `ai_generation_prompt`, `source_url` | Flag only | Owner/household per recipe rules | `last_ai_update` | Edit recipe | None | — |
| Catalogue Places | Catalogue row, tags as aliases | Authored | Private by default | None | Catalogue form | None | Saved name/tag fills location silently (HUB-94) |

## 5. Copies of personal content (relevant to "forget")

| Original | Copy | Where | Removed when the original is? |
|---|---|---|---|
| Ask AI question and answer (`era_messages`) | `content` of user and assistant `ai_messages` rows, `session_id` `era-ask`/`era-ask-auto` | `route.ts:266-286` | No. These rows also drive the monthly cost ceiling. |
| Brain note value | `intent_payload.metadata.value` on the recall reply | `resolvers/brain.ts:81` | No. `DELETE /api/memories/[id]` deletes only the note (`[id]/route.ts:17-21`). |
| Reported turns | System `era_messages` row with a transcript snapshot (`src/lib/era/issueReport.ts`) → imported by `pnpm pm:era-issues --apply` into `Hub & ERA — Master Book.md` with up to 16 transcript turns (`scripts/pm/era-issues.mjs:1-24, 37`) | Git-tracked vault | No. Git history retains it even after a file edit. Whether any report was imported is visible in the Master Book; the import runs only when the owner applies it. |
| Lexicon example | `source_message_id` FK, `ON DELETE SET NULL` (`schema.sql:1596`) | — | The rule survives the message. |
| Settings, accounts, categories | Persisted React Query cache (`STABLE_KEYS`, 7 days, localStorage) and service-worker API cache (`src/app/providers.tsx:23-47, 147-165`; 01-atlas ARCHITECTURE cache table) | Each device | Until refetch, buster change or user switch |
| Context receipts | Episode/choice **IDs only** in `intent_payload.contextReceipt` | `era_messages` | IDs dangle harmlessly |

`era_conversations` can only be archived (`src/app/api/era/conversations/[id]/route.ts:6, 24, 49`); no ERA route deletes a message. The legacy chat can hard-delete its own conversations (`src/app/api/ai-chat/conversations/route.ts:138-170`).

**Forget today.** `forgetRule` matches only bare phrases such as "forget that" / "stop doing that" and revokes the rule the **last turn** applied (`src/features/era/intents/index.ts:214-217`; `useEraStore.ts:64`). "Forget that my sister is visiting" does not match this pattern; the sentence itself becomes another stored `era_messages` row that can be retrieved as a `user_statement` for 30 days.

## 6. Who can put text in front of the model (prompt-injection surface)

| Text | Author | Position in Ask AI prompt | Encoding | Current containment |
|---|---|---|---|---|
| Current message | The speaker | User turn | — | Schema + admission + Confirm |
| History tail | Speaker and ERA | Message turns | Clipped | Owner-bound (`eraAdaptiveContextSource.ts:160-169`) |
| `PERSONAL_CONTEXT_DATA` (past statements, lexicon values) | Speaker; ERA replies | System (dynamic) | JSON | Preamble "never instructions" (`eraAskProposal.ts:296`) |
| Schedule upcoming titles | Anyone who can create an item on the speaker's account (forms, ERA, imports; full list UNKNOWN) | System (dynamic) | **Raw lines** under "for context only" (`:274-286`) | Model cannot write without Confirm |
| NFC tag labels | Speaker | System (dynamic) | Raw | Tag ID/state must match the list (`:434`) |
| Transaction descriptions (incl. statement-import rows from bank files) | Speaker; **bank-provided strings** | System, inside the legacy Budget persona prompt (`gemini.ts:345-409`) | Raw | Same |
| `pendingReminderTitle`, `focusEntity.title` | Client-supplied | System, in quotes | Quoted | Zod length only |
| Scraped recipe pages | **Any website** | Gemini prompt in `recipes/extract-from-url` (`:517`); YouTube recipes come from the model's training knowledge (`:7`) | Raw | Extraction returns a draft to the client; `POST /api/recipes` stores `ai_generated` only if the client sends it (`src/app/api/recipes/route.ts:145`). Whether the import UI sends it was not verified |

Containment that already holds: no tool executes arbitrary HTTP/SQL; IDs must come from validated lists or registered lookups; model prose is never a receipt; writes wait for Confirm (AI Assistant Overview, HUB-108). What does not hold: retrieved text sits in the system position next to real instructions; titles and descriptions are not delimited; nothing screens them. The current external guidance on this point is summarised in [MEMORY-DESIGN §6](MEMORY-DESIGN.md#6-external-research).

## 7. Time and time zone

- No per-person time zone is stored (08-shared-data SOURCE-OF-TRUTH row "A person's time zone"). Ask AI receives a client `localDate` only (`route.ts:114-117`); relative dates are anchored to the request (HUB-108 hardening).
- The adaptive window, focus TTL and Report grace are absolute durations, so they are DST-neutral. Budget context and the Ask AI quota month use the **server's** calendar month (`context.ts:28-33`; `route.ts:163-167`).

## 8. Precedents worth reusing

- **Allergens for cooking**: `get_household_allergens()` returns every household profile's allergens regardless of `shared_with_household`, with minimal fields and no medical notes (`src/app/api/healthcare/allergens/route.ts:7-10`). A purpose-scoped, source-owned read that overrides a sharing flag for safety.
- **Lexicon evidence rule**: an example is not a default; a repeat earns one offer; a tap makes a rule; "forget that" revokes (`lexicon.ts:5-13`; "ERA Learns Your World" §8).
- **Delivery memory ledger**: requirements, constraints, decisions and questions with `source` (`agent`/`owner`/`runner`), status (`open/answered/dismissed/superseded`) and versioned history; durable facts are never compacted (`scripts/delivery/memory.mjs:1-26`). Built for coding sessions, not the household, but it is the repo's only versioned, attributed memory.
- **Coverage vocabulary**: `available / sampled / unavailable` (adaptive packet) and HUB-41's `complete / partial / unavailable` for signals.

## 9. Gaps the design addresses

| ID | Gap | Evidence |
|---|---|---|
| G1 | No place for a **stated** preference or temporary circumstance with an end date; they survive only as 30-day episodes | §2, §4 |
| G2 | No erase or redact path for conversation content; four kinds of copies | §5 |
| G3 | Face contexts have no provenance or coverage and read failures look empty | §1.2 |
| G4 | Retrieved text is placed in the system prompt and partly undelimited | §6 |
| G5 | Brain notes: absent table, no correction, recency instead of relevance, household audience for personal content | §2, §4; HUB-70, D17 |
| G6 | Two assistants with different context and money periods | §1; HUB-45 |
| G7 | Persisted AI output (Focus insights) can be served for 7 days with staleness judged by item count | §4; D9 |
| G8 | No stored time zone, so "until Sunday" has no defined end | §7 |
| G9 | Ask AI's context (face + adaptive) is own-only, so a "we" question is answered from one person's view without saying so. Household scope exists only inside some registered reads (`spend.month` takes `self/partner/household`, `src/features/era/capabilities/registry.ts:183-193`), whose results the model does not see | §1.1 (`p_actor: "me"`, own-only reads) |
| G10 | Lexicon examples recorded before Confirm can earn an "Always" offer | §4 lexicon row; HUB-47 |
| G11 | Schedule time words use fixed parser defaults ("morning" → 07:00, `src/lib/smartTextParser.ts:46`); no personal time preference is consulted; lexicon rules are read only by Budget/transfer resolvers (`resolvers/budget.ts`, `slots.ts`, `amend.ts`) | §2 |

## 10. UNKNOWN

- Whether `era_lexicon`, `era_templates`, `era_actions`, `era_runs`, `get_household_activity` and the 2026-10-04 artifact migration are applied, and with which RLS (⛁; snapshot 92 days old at this cutoff).
- Whether `household_memories` exists or holds rows, and its policies.
- Row counts and growth of `era_messages`, `ai_messages`, `era_lexicon`; how often each person uses Ask AI; which languages they type in.
- Whether `NEXT_PUBLIC_ERA_DURABLE_EXECUTION` is enabled in the deployment.
- Whether any ERA Report transcript has already been imported into the Master Book in a deployment that held real conversations (the file is in the repo; who wrote each item was not traced).
- Real model behaviour with the packet: all evidence is synthetic SDK fixtures and replay (AI Assistant Overview, HUB-106 revalidation).
