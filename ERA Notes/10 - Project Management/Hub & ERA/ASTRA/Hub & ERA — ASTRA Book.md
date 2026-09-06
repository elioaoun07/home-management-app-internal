---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Hub & ERA — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Source cutoff `3106164`; deltas [Hub & ERA Master Book](<../Hub & ERA — Master Book.md>) `updated: 2026-09-02`. Read with [Packets](<Hub & ERA — ASTRA Packets.md>). Phase 4 adds this campaign delta; the accepted [Top Layer Architecture](<../../Top Layer/Top Layer — ASTRA Architecture.md>) remains authoritative for the assistant.

## Book delta

Inspection followed the campaign book/checklist, Feature Map's Hub Chat/Message Actions entries and their vault Overviews. `git log --since=2026-09-02 --format="%h %ad %s" --date=short -- src/features/hub src/features/era src/components/hub src/app/api/hub src/app/api/ai-chat` returns `3106164`. No later source change invalidates the accepted Phase-2 evidence.

| Book claim | Verified correction | Consequence / mapping |
|---|---|---|
| Partner spend still reports household total | `src/features/era/intents/resolvers/budget.ts:83–112` filters by user and rejects unresolved self/partner identity. HUB-18's own shipped entry records HUB-14 fixed. | Remove the stale pain in Phase 5; do not create another split query. EXTENDS → HUB-40. |
| Analytics headline still uses calendar months | Same file `:188–250` reuses the custom-window headline; income and prior-period comparison intentionally remain calendar based. HUB-13 is a partial repair, not untouched. | Budget owns comparable-period analysis; no duplicate Hub packet. |
| Three test files and 5,978-line HubPage describe current protection | Disk enumeration: ten `*.test.ts` under `src/features/era`, one under `src/features/hub`; additional AI/phrasing/shared tests live elsewhere. HubPage has 6,275 LF lines. | Test-file existence is not hook/component coverage or current green CI. Use accepted E-01a. |
| “No trigger” for conversation timestamp is established | Source has no timestamp update, but live function/trigger state remains UNVERIFIED. | Accepted E-05a requires fresh owner evidence; no source-only DB assertion. |
| Message Actions Overview says the unique constraint prevents duplicate conversions and Undo deletes the link first | `BulkConvertReviewSheet.tsx:257–335` creates the domain row before linking; a later link failure cannot reverse that first request. The action DELETE URL has no route on disk. | A downstream uniqueness check cannot prove exactly-once domain creation. F1–F3 below. |
| Delivery session log still says HUB-1 paused with zero files | Accepted Phase-3 local artifact review found ACCEPTED, seven source paths and an older BLOCKED finish package. | Link that finding; do not rewrite session history or declare SHIPPED. CC-3 owns coherence. |
| Generic HubPage extraction remains a recommended ritual | Active plan D10 permits a real-feature rider; accepted E-13a/b bounds the authorized migration. | Keep D10; no new standalone extraction packet. |

## Re-scored maturity

The book's 4.2 headline is historical and its seven listed dimensions do not reproduce that number. This study uses the **same dimensions**, records a provisional equal-weight mean **4.4/10 (31/7)** and does not replace the plan's G1 operating score.

| Dimension | Book | ASTRA | Evidence / what moves it +1 |
|---|---:|---:|---|
| Reactive chat (Hub) | 7 | 6 | Core chat exists, but conversion and Undo claims outpace linked-write proof (F1–F3). +1: fault-injected conversion/inverse receipts agree with saved records. |
| Intent architecture | 8 | 8 | Shared resolver, registry and ten ERA test files; accepted Phase-2 A1–A4. +1: explicit outcome survives every adapter, E-11a. |
| Test protection | 5 | 4 | Router/pure tests exist; only docs-sync CI exists. +1: E-01a runs real checks and a negative conversion fixture. |
| Proactive reach | 2 | 1 | No `era-briefing` producer in the accepted source snapshot. +1: owner-observed first scheduled delivery, E-05a/b. |
| Voice resilience | 4 | 5 | HUB-36 supplies typed-reply streaming and browser fallback; broader degradation remains accepted E-17 work. +1: injected failure matrix passes across retained hosts. |
| Code health | 3 | 3 | 6,275-line HubPage; no standalone extraction permitted. +1: E-13b shrinks it while preserving host behavior. |
| Handoff readiness | 3 | 4 | Accepted Top Layer sheets define outcomes, prerequisites and failure gates. +1: an actual product run passes those gates with current evidence, not a file citation. |

## Findings

### F1 · Future-payment conversion reads the wrong response envelope

`src/app/api/drafts/route.ts:114` returns `{ draft }`; `AddTransactionFromMessageModal.tsx:115–128` reads the whole response as the draft and passes `draft.id`, which is undefined. Its action hook converts that to a null transaction link (`src/features/hub/messageActions.ts:70`). The bulk sibling correctly destructures `{ draft }` at `BulkConvertReviewSheet.tsx:263`. A future payment can be saved while its source action cannot identify it. **Doctrine priority 1/2; ASTRA-HUB-1, NEW.** This is a direct response-contract defect, not a hypothesis about live policies.

### F2 · Bulk Undo can announce success after failed HTTP responses

The sole `src/app/api/hub/message-actions/route.ts` exports GET/POST; `rg --files src/app/api/hub` finds no action-ID DELETE route. Both `useDeleteMessageAction` and bulk Undo call that missing URL. Bulk Undo does not inspect `Response.ok` at `BulkConvertReviewSheet.tsx:378–410`; its direct item delete also ignores the returned Supabase error. Thus a 404 can be followed by a domain delete and a success toast. `safeFetch` rejecting network failures does not make HTTP failure statuses throw. **Doctrine priority 1/2; ASTRA-HUB-2, NEW.** First fail closed on an unverified inverse; full inverse restoration is a separate cross-domain change requiring verified authority.

### F3 · “Conversion failed” can mean the money/item already exists

Bulk creates a draft/transaction/item before the message-action insert; it pushes into its Undo/processed collection only after linking succeeds (`BulkConvertReviewSheet.tsx:257–335`). A second-request failure leaves a domain record outside that collection. Single transaction conversion also treats tracking failure separately (`AddTransactionFromMessageModal.tsx:152–169`). Retry can create another domain row. **Doctrine priority 1/2.** Accepted E-09b/c supplies the draft/item idempotency foundations; Budget owns posted-money atomicity. A unique action-link constraint alone cannot repair ordering across two requests.

This is a recorded defect, not a claim that ASTRA-HUB-1/2 makes conversion atomic. A subsequent atomic conversion/inverse packet must follow the owning primitives and fresh DB evidence. Do not add a compensating client deletion that can erase a legitimate concurrent edit.

## Enhancement catalog

| Rank / study ID | Outcome | Size / severity | Reconciliation / dependencies |
|---|---|---|---|
| 1 · ASTRA-HUB-2 | Bulk Undo never proceeds past a failed prerequisite or reports an unverified reversal as complete. | S / blocker | **NEW:** missing HTTP-status checks are outside E-09's assistant capture scope; existing inverse remains blocked until supplied. |
| 2 · ASTRA-HUB-1 | A future-payment message action receives the actual created draft ID. | S / friction | **NEW:** precision chat conversion adapter, outside accepted E-11's ERA action log; E-01a CI prerequisite. |

These are two narrow guards, not two declarations of complete conversion safety. F3 stays a cross-domain dependency in the defect inventory. No immediate catalog entry is allocated for the parked frontier.

## Ownership treaty with the accepted Top Layer study

| Concern | Authoritative owner | This campaign delta |
|---|---|---|
| ERA outcome/result propagation, activity, learned templates | Top Layer Architecture A1–A4; E-11a/b | Cross-reference only; no duplicate packet. |
| Durable capture, idempotent draft/item creation, income/events | Top Layer A5–A7/A17; E-09a–f | Message conversion must reuse these primitives after they ship. |
| Signals, delivery policy, scheduler, quotas | Top Layer E-04a/E-05a–b/E-07a and Notifications study | No second briefing or delivery ledger. |
| Three assistant doors and host migration | Top Layer E-10b/E-13a–b | Preserve household chat and sanctioned shrinking rider. |
| Manual Hub conversion / its inverse | This book F1–F3 | Domain money/item implementation remains with Budget/Schedule. |
| Result proof and real product-run governance | Command Center / Delivery ASTRA | No filename-only proof of household behavior. |

## What ERA needs from this module

E-04 needs domain facts with scope, units, observation time and completeness, not chat text promoted into verified money. `hub_message_actions` can supply provenance from a saved domain record back to the originating message once F1/F3 are resolved. It cannot itself certify that money moved correctly.

The existing registry and `era_messages.intent_payload` already distinguish registered language gaps from missing capabilities (Master Book HUB-28/33). Retain the accepted Top Layer evaluation frontier: anonymized, owner-reviewed failed turns can become deterministic fixtures. No new AI call, capability registry, message database or household-chat summarizer is proposed. Kitchen/Trips/Healthcare signals enter the canonical E-22/E-04 seam from their owning data.

## Do not do

Do not rebuild the already-fixed partner-spend path, silently equate mixed analytics periods, broaden offline replay to transfers/confirmation, infer live constraints from an Overview, add a new conversation store, or commission HubPage decomposition. Do not call the missing inverse restored merely because the UI now refuses a failed request. No proposed UI copy or layout change.

## Coverage note

Owns Hub Chat, Message Actions and AI Assistant orchestration, with voice-host work bounded by the accepted Top Layer scope. Shopping List's stock/recipe semantics belong to Kitchen; transaction/draft/transfer/debt invariants belong to Budget; Items/Prerequisites/Plan My Day belong to Schedule. Household Sharing and Sync & Offline remain cross-cutting in the coverage appendix, with accepted E-09 ownership. No new campaign.

UNVERIFIED: deployed conversion behavior, current action constraints/foreign-key delete behavior, policies and triggers. Owner supplies current `migrations/db-state.sql` output and Hard Rule 27's untruncated table/policy queries for `hub_messages`, `hub_chat_threads`, `hub_message_actions`, `transactions`, `items` before DB implementation. Mocked route/fault fixtures verify the code contracts without live calls.

## ASTRA 10× Findings

- **Leverage 1 — DOCKS → E-09:** domain idempotency is the reusable foundation for ERA and manual chat conversion; linking only after an unprotected create cannot provide it (F3).
- **Leverage 2 — NEW / ASTRA-HUB-2:** stop false Undo success at the existing HTTP boundary before attempting more elaborate orchestration (F2).
- **Simplification — DOCKS → E-10/E-13/M-00:** reuse the accepted assistant treaty and dead-code sheets; no duplicate migration plan in this campaign.
- **Frontier — DOCKS → the accepted Top Layer NEW evaluation frontier:** link an owner-reviewed failed turn to a domain-outcome fixture. Reconsider only after the existing 30-case threshold; do not build another evaluator.
- **Uncomfortable — NEW / F3:** a source-link uniqueness promise protects the last write in a multi-write conversion, while the financially consequential write happens first.

