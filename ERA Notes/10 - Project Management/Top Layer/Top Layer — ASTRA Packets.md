---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Top Layer — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff: `3106164` (2026-09-02). Deltas [Hub & ERA — Master Book](<../Hub & ERA/Hub & ERA — Master Book.md>) at `updated: 2026-09-02`. Phase 2 delivers specifications only; every gate below is NOT RUN.
>
> [Architecture](<Top Layer — ASTRA Architecture.md>) supplies evidence A1–A17 and contradictions C01–C16. [Experience](<Top Layer — ASTRA Experience.md>) supplies failure behavior. [Completion](<Top Layer — ASTRA Completion.md>) supplies acceptance artifacts.
>
> Suffixes such as E-09a are local subdivisions of an existing packet, not new campaign IDs. No checklist or Master Book is edited in this phase.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| E-01a | DOCKS → E-01 | HUB-37 | Existing Now; CI includes tests; HUB-21 is separate |
| E-11a | DOCKS → E-11 | HUB-47 | Existing Next; outcome guard before new consumers |
| E-11b | DOCKS → E-11 | HUB-47 | After E-11a; conversation DB evidence comes through E-05a |
| E-09a | DOCKS → E-09 | HUB-46 | Existing Next coordination parent; durable IDB first |
| E-09b | DOCKS → E-09 | HUB-46 | Endpoint prerequisite; owner APPLIED evidence |
| E-09c | DOCKS → E-09 | HUB-46 | Endpoint prerequisite; owner APPLIED evidence |
| E-09d | DOCKS → E-09 | HUB-46 | After a/b/c, SCH-7 and explicit replay eligibility |
| E-09e | DOCKS → E-09 | HUB-46 | After safe draft transport; income-only child |
| E-09f | DOCKS → E-09 | HUB-46 | After safe item transport; event-only child |
| E-04a | DOCKS → E-04 | HUB-41 | After BUD-66 and verified domain input contracts |
| E-02a | DOCKS → E-02 | HUB-38 | After ledger/wrappers; logging policy remains held under NOTIF-5.4 |
| E-03a | DOCKS → E-03 | HUB-39 | Local-time fixtures; no activation before owner-recorded C01/C03 resolutions |
| E-05a | DOCKS → E-05 | HUB-42 | Current owner DB evidence and reviewed manual migration |
| E-05b | DOCKS → E-05/E-16/E-19; CONFLICTS → C01/C03 | HUB-42 | HELD for owner-recorded C01 hour and C03 partner-policy sequencing |
| E-07a | DOCKS → E-07 | HUB-44 | Usage truth before gauge/extra consumers |
| E-08a | DOCKS → E-08 | HUB-45 | After BUD-66, meal coverage and canonical Schedule inputs |
| E-10a | DOCKS → E-10 | HUB-48 | Stored briefing and bounded cache after producer proof |
| E-10b | DOCKS → E-10 | HUB-48 | Delete floating assistant only after report/history parity |
| E-13a | DOCKS → E-13 | HUB-16 | Existing host-policy boundary |
| E-13b | DOCKS → E-13 | HUB-16 | After adapter proof; sanctioned shrinking HubPage rider |
| M-00a | DOCKS → M-00 | HUB-40 | Source-proven deletions only; not layout work |

## 1 · Dispatch rules and capacity

These 21 bounded sheets replace or refine portions of the existing catalog. They are **not 21 additional commitments**. Parent obligations not covered here remain in the active plan (§3 below); no parent can be ticked for one child. S = at most half a session; M = at most one 2–4h session. At 18 M + 3 S, this selected catalog alone costs up to 19.5 sessions / about ten weeks at two sessions per week, before retained parent work and owner days. That exposes C15; it does not silently move a date. Re-estimate at PLAN_READY and use the plan's prewritten sacrifice order and missed-gate protocol.

Priority order is correctness/trust first: E-01a → E-11a → E-09a–d; E-04a can proceed independently after verified domain fixtures. E-02/E-03 prerequisites and E-05a–b then establish first delivery. E-08a and E-09e–f reuse those boundaries. Later interface and treaty work stays in its product phase. Do not begin a cosmetic packet while a failed capture gate is open.

**Prerequisite truth:** HEAD is already committed; no git writes are authorized. The existing PM lint error is not a new study defect, but S3 still prevents calling a future implementation done while it remains red. Missing migration links require their own authorized repair; do not create guessed SQL to turn lint green.

**Common allowlist P, included in every sheet:** `ERA Notes/10 - Project Management/Hub & ERA/4 - Checklist.md` and `ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md`, only for the named parent and its shipped evidence. These are future implementation permissions, not Phase-2 edits.

**Documentation allowlist D, included in every sheet:** update only the relevant sections of `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`, `ERA Notes/01 - Architecture/Cache Invalidation.md`, and `ERA Notes/04 - UI & Design/Page & Feature Atlas/feature-era.md`. For E-05b/E-10a new routes, also allow `ERA Notes/04 - UI & Design/Page & Feature Atlas/era.md`, `ERA Notes/04 - UI & Design/Page & Feature Atlas/_Index.md`, and `ERA Notes/04 - UI & Design/App Routes and Icons.md`. For E-13b, also allow `ERA Notes/04 - UI & Design/Page & Feature Atlas/feature-hub.md` and `ERA Notes/04 - UI & Design/Page & Feature Atlas/chat.md`. These exact documentation paths close finish-task's mandatory docs/Atlas gates; no other feature or campaign sweep is authorized.

**Common forbidden set F, included in every sheet:** `src/components/ui/**`; `src/components/hub/HubPage.tsx` except E-13b; `migrations/schema.sql` without the specifically paired migration; all other files outside that sheet's allowlist. No git writes, production DB calls or new dependencies. A listed new path is a future deliverable, not a file claimed to exist.

**Common NOT done N, included in every sheet:** migration written ≠ APPLIED; test file ≠ test in CI include; comment changed ≠ behavior changed; “works locally” ≠ evidence pasted; child shipped ≠ parent complete. Append P/D/F/N and the STOP block when handing a single sheet to a successor.

**PM convention:** “Tick HUB-x” means only after this sheet and every remaining acceptance criterion of that parent pass. Before that, leave HUB-x unchecked and append the given partial Shipped Log sentence with actual date, commit and artifact. Do not allocate another HUB ID during execution of a child. Phase 5 has reconciled study provenance into the existing queue.

### STOP block — all sheets

Any one condition: stop, leave a five-line handoff (result, evidence, blocker, next owner action, untouched scope), and do not improvise.

- **S1:** A file outside the allowlist needs editing.
- **S2:** A DB write is required to proceed. Write the manual migration/runbook, hand it to the owner and await APPLIED evidence; never execute it.
- **S3:** Test count decreases, or typecheck/lint/test is red. Zero matched tests is failure.
- **S4:** HubPage line count increases, or a new import of HubPage internals is needed.
- **S5:** A new dependency must be installed. Only E-15 has the plan's explicit test-dependency exception; no sheet here exercises it.
- **S6:** The packet will not finish in one session. Split at a verified boundary and record the remaining scope.
- **S7:** Symptom is “X cannot see Y”: use Hard Rule 27's owner-supplied RLS evidence before route diagnosis.
- **S8:** Money/schedule semantics are ambiguous: ask one focused question, never choose a silent default.
- **S9:** An AI proposal path would write without a confirm tap.
- **S10:** A second engine, queue, toast system, regex family or aggregation for an existing concept would be created.
- **S11:** The work touches D2's excluded scope.
- **S12:** A UI change moves or restyles an existing /era element; additions only.

## 2 · Plan reconciliation

| Sheet | Classification | Existing PM parent | Delta / dependency |
|---|---|---|---|
| E-01a | DOCKS → E-01 | HUB-37 | Already-committed WIP correction; real CI and honest error classification |
| E-11a | DOCKS → E-11 | HUB-47 | Explicit outcome gate across deterministic/templates/AI confirmation |
| E-11b | DOCKS → E-11 | HUB-47 | Activity coverage/error state and actual face landing |
| E-09a | DOCKS → E-09 | HUB-46 | Durable queue acknowledgment and retained terminal failures |
| E-09b | DOCKS → E-09 | HUB-46 | Idempotent draft endpoint before replay |
| E-09c | DOCKS → E-09 | HUB-46 | Atomic/idempotent nonrecurring item endpoint before replay |
| E-09d | DOCKS → E-09 | HUB-46 | One enqueue boundary, owner identity and draft reconciliation |
| E-09e | DOCKS → E-09 | HUB-46 | Income only, after safe draft transport |
| E-09f | DOCKS → E-09 | HUB-46 | Event only, after safe item transport |
| E-04a | DOCKS → E-04 | HUB-41 | Complete/partial/unavailable fact contract; existing three builders |
| E-02a | DOCKS → E-02 | HUB-38 | Authenticated, cadence-aware liveness after ledger implementation |
| E-03a | DOCKS → E-03 | HUB-39 | Polling/local-date eligibility, not fixed summer UTC conversion |
| E-05a | DOCKS → E-05 | HUB-42 | Notification identity, retry claim and verified conversation constraints |
| E-05b | DOCKS → E-05/E-16/E-19; CONFLICTS → D5/D6 sequencing | HUB-42 | Local policy/recipient delivery; C01/C03 resolutions required |
| E-07a | DOCKS → E-07 | HUB-44 | Accurate provider telemetry before gauge/extra AI consumers |
| E-08a | DOCKS → E-08 | HUB-45 | Balance/meal reads and bounded Chef/Brain context |
| E-10a | DOCKS → E-10 | HUB-48 | Stored briefing landing + bounded offline persistence |
| E-10b | DOCKS → E-10 | HUB-48 | Report/history parity then floating assistant removal |
| E-13a | DOCKS → E-13 | HUB-16 | Host policy outside HubPage |
| E-13b | DOCKS → E-13 | HUB-16 | Sanctioned shrinking rider after adapter proof |
| M-00a | DOCKS → M-00 | HUB-40 | Proven dead code removed, current appearance preserved |

The parked **NEW** evaluation-corpus frontier in Architecture has no implementation packet or capacity allocation. Reopening it requires the stated 30-case proof, then a bounded specification. C10/C11 (identity/styling), C12 (served build), and C16 (nonmutating-toast wording) are held for Phase 5; no silent remedy is embedded here.

## 3 · Retained parent obligations

This table prevents selective refinements being mistaken for a complete replacement catalog.

| Parent | Still owned by active plan |
|---|---|
| E-01 | Owner/release handling of the committed tree; CI run evidence. HUB-21 served-build verification is not proved by CI alone. |
| E-02/E-03/E-00 | Cron ledger/wrapper for six routes, Applied ledger, owner scheduler setup, current DB snapshot. E-02a does not implement the ledger. |
| E-05 | Deterministic composition plus D9 focus-insights retirement and D15 source stamping across every writer. Those cross-module changes require owning-campaign allowlists; E-05a is not permission to sweep arbitrary writers. |
| E-06 | Feedback persistence/Undo and vitals UI, using Completion's corrected metric definitions. |
| E-07 | Gauge/view, env override/pin behavior and existing consumer consolidation. E-07a fixes their input evidence; it does not claim the gauge shipped. |
| E-14/E-15 | Top View bundle/selectors and mobile vitals; current owner DB evidence and the explicitly authorized component-test setup. |
| E-16 | Persistent color identity resolution, partner-selected flow and later visual integration; minimum recipient delivery pulled into E-05b only after C03 is recorded. |
| E-17/E-18 | Existing degradation and sacrifice-eligible session-picker work. No excluded-domain work is introduced. |
| E-19–E-23 | Full policy rollout, action stack, anomaly/module producers, feedback ranker; consume the shared facts/outcomes defined here. |
| Lane M / N | Module readiness, export/security, native work and their existing gates. This study does not certify or reschedule them. |

## 4 · Execution sheets

### E-01a · CI and honest capture failures · M · E · Phase 0

**Outcome:** ERA preserves a recoverable command when a write cannot be accepted, and CI runs the actual checks.

**Prereqs:** Phase-1 verified HEAD; resolve the existing PM lint baseline before completion. No new migration required or presumed APPLIED.

**Skills:** start-task → fix-bug → cache-invalidation → finish-task.

**Files:** P + D; `.github/workflows/ci.yml` (new); `vitest.config.ts`; `src/features/era/useEraConversation.ts`; `src/features/era/useEraTurn.ts`; `src/features/era/useEraBudgetSubmit.ts`; `src/components/era/CommandBar.tsx`; `src/features/era/intents/formatters/budget.ts`; `tests/era-outcomes.test.ts` (new). F applies.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No new arithmetic. Fixture: rejected $5 draft yields zero successful domain writes and preserves recoverable command data.

**Gate:** `pnpm typecheck`, `pnpm lint`, `pnpm test` each exit 0; `pnpm exec vitest run tests/era-outcomes.test.ts --passWithNoTests=false` distinguishes connectivity loss, timeout, abort, HTTP error and malformed response. Owner supplies Completion G0.1/G0.7. Workflow runs frozen install/typecheck/test/lint on push and PR, includes TSX tests; no “pass with no tests” option.

**PM:** Tick HUB-37 only for its fully satisfied scope; do not close HUB-21 on a CI-only assertion. Shipped sentence: `- ✅ <date> — **HUB-37** E-01a: CI executes checks; failed ERA capture remains recoverable (<SHA/run/phone evidence>).`

**NOT done:** N; replacing GET fetch calls does not create offline persistence. Delete the false comment, classify with existing `isOfflineError`, preserve timeout/abort semantics. No invented UI wording pool. STOP S1–S12.

### E-11a · One outcome gate for execution and learning · M · E · Phase 1, correctness prerequisite

**Outcome:** A failed, pending or uncertain action never appears completed or improves its taught template.

**Prereqs:** E-01a. Existing ERA storage migrations must be owner-confirmed APPLIED for phone proof; fixtures run without a DB.

**Skills:** start-task → fix-bug → cache-invalidation → finish-task.

**Files:** P + D; `src/features/era/capabilities/types.ts`; `src/features/era/capabilities/registry.ts`; `src/features/era/intents/resolvers/budget.ts`; `src/features/era/intents/resolvers/schedule.ts`; `src/features/era/intents/resolvers/chef.ts`; `src/features/era/intents/resolvers/brain.ts`; `src/features/era/intents/resolveIntent.ts`; `src/features/era/useEraTurn.ts`; `src/features/era/useEraAskAI.ts`; `src/features/era/templates/learn.ts`; `src/features/era/templates/useEraTemplates.ts`; `src/features/era/actionOutcome.ts` (new pure adapter); `tests/era-outcomes.test.ts`. F applies.

**DB change?** No; reuse existing message payload.

**AI call added?** No.

**Money/schedule math?** No. Do not rewrite domain calculations to normalize results.

**Gate:** `pnpm exec vitest run tests/era-outcomes.test.ts --passWithNoTests=false` passes explicit proposed/needs-input/saved-draft/applied/queued/failed/unknown/partial cases. A failed template's count stays 3; one successful execution makes it 4, never 5 through double learning. Declined AI proposal performs zero writes. Invalid capability/slots cannot default to success.

**PM:** HUB-47 remains open until E-11b and verified conversation behavior pass. Shipped sentence: `- ✅ <date> — **HUB-47** E-11a: outcomes gate learning, focus and action logging (<fixture evidence>).`

**NOT done:** N; propagate outcomes through both direct resolver and registry paths. Preserve a successful domain result if conversation/action logging fails. STOP S1–S12.

### E-11b · Activity reflects outcomes and opens real doors · M · E · Phase 1

**Outcome:** Activity distinguishes unavailable history from no activity and opens the entity ERA actually changed.

**Prereqs:** E-11a and E-05a's verified/APPLIED conversation behavior; owner-stamped APPLIED `2026-08-26_era-actions.sql` or reconciled equivalent; current owner evidence for its accepted entity fields before extending persistence.

**Skills:** start-task → fix-bug → ui-guardrails → cache-invalidation → finish-task.

**Files:** P + D; `src/features/era/logEraAction.ts`; `src/features/era/useEraConversation.ts`; `src/features/era/widgets/useEraActivity.ts`; `src/components/era/dashboards/ArtifactsView.tsx`; `src/components/era/EraShell.tsx`; `src/app/api/era/actions/route.ts`; `tests/era-activity.test.ts` (new). F applies.

**DB change?** No within this sheet. If existing entity constraints cannot represent a required result, STOP and hand off the exact schema extension; never silently omit the event.

**AI call added?** No.

**Money/schedule math?** No.

**Gate:** `pnpm exec vitest run tests/era-activity.test.ts --passWithNoTests=false` covers all current registry write-result entities, query failure vs empty, failed action exclusion, deleted entity fallback and one-shot valid/invalid `?face=` handling. Owner 390×844 screenshot verifies existing Activity layout and Brain landing.

**PM:** Tick HUB-47 only when conversation gate also passes. Shipped sentence: `- ✅ <date> — **HUB-47** E-11b: Activity coverage, honest read errors and face landing verified (<evidence>).`

**NOT done:** N; best-effort `era_actions` is not an atomic financial audit. Record saved drafts as drafts; do not log reads or proposals as completed writes. Stop invalidating the conversation list per message; retain invalidation for actual conversation creation/archive and test latest-message freshness after E-05a's owner-verified timestamp behavior. STOP S1–S12.

### E-09a · Durable queue acknowledgment · M · E · Phase 1

**Outcome:** A capture acknowledged as queued survives a restart, and failed replay retains recoverable input.

**Prereqs:** E-01a. No DB migration.

**Skills:** start-task → fix-bug → cache-invalidation → finish-task.

**Files:** P + D; `src/lib/offlineQueue.ts`; `src/lib/offlineSyncEngine.ts`; `src/lib/stores/offlinePendingStore.ts`; `tests/era-offline-storage.test.ts` (new). F applies.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No domain math.

**Gate:** `pnpm exec vitest run tests/era-offline-storage.test.ts --passWithNoTests=false` tests transaction complete/abort, quota failure, memory fallback, replacement failure and retry exhaustion. Durable requests acknowledge only after IDB transaction commit; a failed replacement retains the previous request; terminal failures remain recoverable and are not retried automatically. Owner restart proof uses actual browser IndexedDB.

**PM:** HUB-46 stays open. Shipped sentence: `- ✅ <date> — **HUB-46** E-09a: durable queue receipts and retained failed operations verified (<fixtures/restart evidence>).`

**NOT done:** N; preserve existing callers through an explicit durable-required option/receipt, not a breaking queue API. No new library needed: controlled IDB event mocks plus real-browser owner proof. Keep one existing store and feature union. STOP S1–S12.

### E-09b · Draft creation has a replay identity · M · E · Phase 1

**Outcome:** Retrying a $5 capture produces the same draft rather than another transaction.

**Prereqs:** E-11a; current owner transaction/account schema and access evidence. New `2026-09-06_era-draft-replay.sql` must be owner-stamped APPLIED before live acceptance.

**Skills:** start-task → money-rules → api-route → db-migration → finish-task.

**Files:** P + D; `src/app/api/drafts/route.ts`; `src/lib/era/requestIdentity.ts` (new); `migrations/2026-09-06_era-draft-replay.sql` (new); `migrations/schema.sql` paired only; `migrations/README.md` runbook text only, Applied cells owner-only; `tests/era-draft-replay.test.ts` (new). F applies.

**DB change?** Yes. Write migration first: nullable `client_request_id` and immutable server-computed `client_request_hash` on transactions, unique per owner/request ID. Existing callers without IDs retain current behavior. Validate incoming ERA create with Zod, authorize account/category ownership, return existing matching request on conflict; mismatch returns 409. Hand SQL to owner, never apply.

**AI call added?** No.

**Money/schedule math?** Yes, preservation invariant. Wallet stored $100 → $5 draft → still $100; retry → same draft, still $100. No confirmation or balance adjustment here. Test this example; keep request identity through confirmation/soft deletion.

**Gate:** `pnpm exec vitest run tests/era-draft-replay.test.ts --passWithNoTests=false` covers parallel requests, lost response, same identity/different payload 409, unauthorized owner, confirmed/deleted original and unchanged balance. Owner supplies APPLIED constraint proof; mock tests alone do not prove uniqueness in the DB.

**PM:** HUB-46 stays open. Shipped sentence: `- ✅ <date> — **HUB-46** E-09b: draft retries return one original entity; migration APPLIED (<owner proof/tests>).`

**NOT done:** N; no use of `statement_hash` as ERA identity, no deletion/reinsertion of promoted rows, no offline draft confirmation. STOP S1–S12.

### E-09c · Atomic nonrecurring item capture · M · E · Phase 1

**Outcome:** A reminder or event is saved once with its required details, or none of it is saved.

**Prereqs:** E-11a/E-09b request identity convention; owner-refreshed items/details/alerts/prerequisites policies and relevant function bodies. New `2026-09-06_era-item-capture.sql` must be APPLIED before live acceptance.

**Skills:** start-task → recurrence-safety → timezone-handling → api-route → db-migration → finish-task.

**Files:** P + D; `src/app/api/items/route.ts`; `src/lib/era/itemCapture.ts` (new validated narrow adapter); `src/lib/era/requestIdentity.ts`; `migrations/2026-09-06_era-item-capture.sql` (new); `migrations/schema.sql` paired only; `migrations/README.md` runbook text only; `tests/era-item-create.test.ts` (new). F applies.

**DB change?** Yes. Proposed authenticated RPC commits an ERA nonrecurring parent, type details, accepted alerts and prerequisites in one transaction; request identity/hash live on items with owner-scoped uniqueness. Restrict execution/ownership using fresh evidence; do not copy an unverified SECURITY DEFINER body. Reuse the current API route with an explicit validated ERA capture envelope; legacy/recurring paths remain separate.

**AI call added?** No.

**Money/schedule math?** Yes. Beirut 2026-09-07 09:00 reminder → 06:00Z; one event 10:00–11:00 → 07:00–08:00Z. Invalid end-before-start rejects all rows. Recurrence input is refused by this narrow adapter, not expanded again.

**Gate:** `pnpm exec vitest run tests/era-item-create.test.ts --passWithNoTests=false` verifies payload validation, ownership boundary, one RPC call and explicit failure. Owner scratch-DB rollback artifact proves a forced child failure leaves zero graph rows; successful retry creates one graph (Completion G1.5).

**PM:** HUB-46 stays open. Shipped sentence: `- ✅ <date> — **HUB-46** E-09c: atomic nonrecurring capture APPLIED and rollback verified (<owner/test evidence>).`

**NOT done:** N; passing prerequisites to today's POST does not make it atomic [A7]. Do not redesign all item creation. S6 applies if the narrow RPC/security review exceeds one session; deliver SQL handoff and split the adapter, not a half-atomic path. STOP S1–S12.

### E-09d · One write boundary and replay reconciliation · M · E · Phase 1

**Outcome:** Eligible ERA captures survive offline use and reappear once in the correct owner's module.

**Prereqs:** E-09a, E-09b, E-09c and SCH-7 unsupported-recurrence refusal; both replay migrations APPLIED; E-11a outcome contract.

**Skills:** start-task → money-rules → recurrence-safety → cache-invalidation → timezone-handling → finish-task.

**Files:** P + D; `src/features/era/enqueueCapabilityAction.ts` (new); `src/features/era/useEraBudgetSubmit.ts`; `src/features/era/intents/resolvers/schedule.ts`; `src/features/era/useEraAskAI.ts`; `src/lib/offlineQueue.ts`; `src/lib/offlineSyncEngine.ts`; `src/contexts/SyncContext.tsx`; `tests/era-enqueue.test.ts` (new). F applies.

**DB change?** No new SQL; prerequisites must be APPLIED.

**AI call added?** No.

**Money/schedule math?** Yes, preservation fixtures from E-09b/c; replay changes no amount, account, date or timezone. Draft remains unconfirmed.

**Gate:** `pnpm exec vitest run tests/era-enqueue.test.ts --passWithNoTests=false` verifies stable request identity before first HTTP attempt, owner-match replay, durable-only acknowledgment, nested draft response/temp-ID replacement, Drafts invalidation, cancel/replay race, and zero queueing on timeout/abort. Owner performs Completion G1.7/G1.8.

**PM:** HUB-46 stays open for income/events. Shipped sentence: `- ✅ <date> — **HUB-46** E-09d: ERA draft/reminder capture replays once with owner and cache reconciliation (<evidence>).`

**NOT done:** N; no `era` queue feature key. Use existing transaction/item features, add Drafts/appropriate ERA query invalidations to their existing reconciliation. Route NFC confirmed create through the atomic endpoint; do not retain two independent POSTs. Confirmation/transfers/recurrence remain ineligible. STOP S1–S12.

### E-09e · Income capture uses the safe draft path · M · E · Phase 1

**Outcome:** An income sentence produces an income draft in the owner's selected income account.

**Prereqs:** E-09d; replay migrations APPLIED; existing account-type/default-income semantics verified from the Budget docs and route.

**Skills:** start-task → money-rules → cache-invalidation → finish-task.

**Files:** P + D; `src/features/era/types.ts`; `src/features/era/intents/resolveIntent.ts`; `src/features/era/replyFormatter.ts`; `src/features/era/intents/budget.ts`; `src/features/era/intents/resolvers/budget.ts`; `src/features/era/intents/formatters/budget.ts`; `src/features/era/useEraBudgetSubmit.ts`; `src/features/era/capabilities/vocab.ts`; `tests/era-reactive-writes.test.ts` (new). F applies.

**DB change?** No new SQL.

**AI call added?** No.

**Money/schedule math?** Yes. Stored income account $100 → income draft $2,000 → stored $100; confirming once through the existing authorized Budget flow would yield $2,100. This packet tests draft type/sign/account and unchanged stored balance; it does not certify current confirmation atomicity [A6].

**Gate:** `pnpm exec vitest run tests/era-reactive-writes.test.ts --passWithNoTests=false` covers “I got paid $2000,” positive income amount, default-income selection, missing account refusal and identical offline replay. Expense and transfer routing regressions remain green.

**PM:** HUB-46 remains open for E-09f/full gate. Shipped sentence: `- ✅ <date> — **HUB-46** E-09e: income sentences save replay-safe income drafts (<fixtures>).`

**NOT done:** N; adjust the existing income veto branch, not a second parser/regex family. No automatic confirmation and no partner account default. STOP S1–S12.

### E-09f · Event capture uses the safe item path · M · E · Phase 1

**Outcome:** A dated event sentence creates one event with the intended local start and end.

**Prereqs:** E-09d/E-09e (shared regression file); item-capture migration APPLIED; existing `parseSmartText` date/time output verified.

**Skills:** start-task → recurrence-safety → timezone-handling → cache-invalidation → finish-task.

**Files:** P + D; `src/features/era/types.ts`; `src/features/era/intents/resolveIntent.ts`; `src/features/era/replyFormatter.ts`; `src/features/era/intents/schedule.ts`; `src/features/era/intents/resolvers/schedule.ts`; `src/features/era/intents/formatters/schedule.ts`; `src/features/era/capabilities/registry.ts`; `src/features/era/capabilities/vocab.ts`; `tests/era-reactive-writes.test.ts`. F applies.

**DB change?** No new SQL.

**AI call added?** No.

**Money/schedule math?** Yes. E-09c timezone fixture; missing required time asks for input; end-before-start rejects; DST gap/fold ambiguity is not silently normalized. Recurring wording does not create a rule.

**Gate:** `pnpm exec vitest run tests/era-reactive-writes.test.ts --passWithNoTests=false` covers dated appointment, start/end meeting, missing time, DST ambiguity, recurring rejection and replay. Registry `event.create` calls the same narrow adapter, never another creation path.

**PM:** Tick HUB-46 only after all six children and Completion G1.2–G1.8/G1.18 pass. Shipped sentence: `- ✅ <date> — **HUB-46** E-09f: event creation preserves local time and safe replay (<evidence>).`

**NOT done:** N; focus remains reminder-only unless a separate authorized focus contract is specified. Do not just widen its entity enum. STOP S1–S12.

### E-04a · Signals preserve scope, units and completeness · M · E · Phase 1

**Outcome:** ERA's briefing states supported facts without turning missing data into reassuring totals.

**Prereqs:** BUD-66 actuals fixtures; current owner evidence for schedule bundle shape and household scope. Review the completeness interface before the domain sheets; implement this consumer after their fixtures, avoiding a dependency cycle. No new migration required; do not infer live RPC behavior from schema.sql.

**Skills:** start-task → money-rules → recurrence-safety → timezone-handling → finish-task.

**Files:** P + D; `src/lib/briefing/signals.ts` (new); `src/lib/briefing/signals.test.ts` (new). F applies. Read-only reuse: `src/lib/utils/incomeExpense.ts`, `src/features/recurring/commitments.ts`, `src/lib/utils/date.ts` and owner-verified schedule output; any required edits there invoke S1.

**DB change?** No.

**AI call added?** No; deterministic only.

**Money/schedule math?** Yes. Fixture: $20 expense + LBP 895,000 at a frozen USD-per-LBP rate of 1/89,500 gives $30 using the existing conversion contract, never 895,020. If the canonical money utility cannot express that existing stored-rate contract, STOP; do not silently introduce another calculator. Custom month starting day 25 includes Sep 1 in Aug 25–Sep 24. One skipped recurring commitment contributes zero due amount; overdue unpaid contributes exactly once. $100 account/$120 due commitment emits supported overdraw risk without posting money.

**Gate:** `pnpm exec vitest run src/lib/briefing/signals.test.ts --passWithNoTests=false` passes three builders, deterministic order, provenance IDs, as-of/scope, unavailable/partial inputs and the worked fixtures. `rg -n gemini src/lib/briefing` returns no production import.

**PM:** Tick HUB-41 after all E-04 criteria pass. Shipped sentence: `- ✅ <date> — **HUB-41** E-04a: three deterministic signal builders reuse domain math and retain completeness/provenance (<fixtures>).`

**NOT done:** N; input adapters must supply verified facts, not widget fallbacks. No RRule expansion, duplicate balance calculator or new RPC in this sheet. STOP S1–S12.

### E-02a · Liveness reports whether each job is healthy · S · E · Phase 0

**Outcome:** The owner can see failed or stale jobs without opening Supabase.

**Prereqs:** Existing E-02 ledger/wrapper completed; its exact cron-runs migration owner-stamped APPLIED; each of six job names/cadences confirmed from E-03. Do not start this sheet to bypass that missing base work.

**Skills:** start-task → api-route → finish-task.

**Files:** P + D; `src/app/api/health/route.ts`; `src/lib/cron/ledger.ts` (created by parent E-02); `tests/era-cron-health.test.ts` (new). F applies.

**DB change?** No new SQL.

**AI call added?** No.

**Money/schedule math?** No domain math; clock fixtures test liveness age.

**Gate:** `pnpm exec vitest run tests/era-cron-health.test.ts --passWithNoTests=false` verifies public GET/HEAD unchanged, authenticated jobs access, six stable entries, last-success age against each cadence, errors and stale-running status. Owner supplies authenticated response; no bearer or household detail appears in public health.

**PM:** Tick HUB-38 only after parent ledger/Applied/wrapper obligations pass. Shipped sentence: `- ✅ <date> — **HUB-38** E-02a: per-job authenticated liveness detects stale and failed runs (<evidence>).`

**NOT done:** N; six historical rows are not six healthy jobs. Server logging removal is not necessary to establish liveness; parent cleanup must respect corrected Hard Rule 22 scope. STOP S1–S12.

### E-03a · Local-hour scheduling survives seasonal changes · S · E · Phase 0/1 boundary

**Outcome:** Each briefing becomes eligible at its recipient's configured local hour throughout the year.

**Prereqs:** Parent E-03 scheduler/secret setup; E-02a. Owner records C01 hour/policy resolution and C03 day-6 sequencing. New `2026-09-06_era-briefing-schedule.sql` must be APPLIED before activation.

**Skills:** start-task → timezone-handling → db-migration → finish-task.

**Files:** P + D; `src/lib/briefing/clock.ts` (new pure function); `tests/era-briefing-clock.test.ts` (new); `migrations/2026-09-06_era-briefing-schedule.sql` (new); `migrations/README.md` runbook text only; `docs/ENV.md`. F applies.

**DB change?** Yes, owner-run cron catalog change: replace only the proposed briefing slot with five-minute UTC polling. Keep the six existing job schedules. Read bearer from the existing Vault convention; no secret in SQL text. No public-schema table change, so schema.sql has no fabricated cron table entry.

**AI call added?** No.

**Money/schedule math?** Yes, delivery time. July Beirut 08:00 corresponds to 05:00Z; December 08:00 to 06:00Z. Use IANA conversion, not these offsets as code constants; skip nonexistent local minute and dedupe repeated local dates per approved rule.

**Gate:** `pnpm exec vitest run tests/era-briefing-clock.test.ts --passWithNoTests=false` includes both seasonal dates, DST transition cases, changed recipient hour, duplicate ticks and day-6 eligibility. Owner scheduler output proves polling at the deployment URL; phone gate proves delivery.

**PM:** Tick HUB-39 only after its six original jobs and owner evidence pass. Shipped sentence: `- ✅ <date> — **HUB-39** E-03a: briefing schedule uses local eligibility with UTC polling (<APPLIED/fixture proof>).`

**NOT done:** N; polling is not delivery; do not activate an unresolved 07:15 branch. STOP S1–S12.

### E-05a · Briefing identity and verified conversation constraints · M · E · Phase 1

**Outcome:** One logical briefing can be retried safely, and conversation activity uses the last message time.

**Prereqs:** E-04a/E-02 ledger; owner current notifications/ERA policies, triggers, constraints and functions. New `2026-09-06_era-briefing-receipts.sql` must be APPLIED before integration.

**Skills:** start-task → db-migration → api-route → finish-task.

**Files:** P + D; `migrations/2026-09-06_era-briefing-receipts.sql` (new); `migrations/schema.sql` paired only; `migrations/README.md` runbook text only; `tests/era-briefing-delivery.test.ts` (new); `src/lib/briefing/delivery.ts` (new storage adapter). F applies.

**DB change?** Yes. One notifications identity per `era_briefing:<recipient>:<local-date>` via partial uniqueness; accepted notification type; explicit pending/sending/accepted/failed/unknown delivery state with claim token, attempt time and retry information. Proposed atomic claim/finish operations reject stale tokens. Owner-only current evidence determines whether message timestamp trigger and intent-face CHECK need addition; do not duplicate either. Exact SQL/security grants must be included in the manual runbook.

**AI call added?** No.

**Money/schedule math?** No domain math.

**Gate:** `pnpm exec vitest run tests/era-briefing-delivery.test.ts --passWithNoTests=false` covers one identity under concurrent claims, failed-send retry, stale claim completion and unknown-after-send. Owner scratch-DB output proves actual uniqueness/claim concurrency and conversation timestamp/CHECK behavior (Completion G2.2).

**PM:** HUB-42 remains open for delivery and D9/D15. Shipped sentence: `- ✅ <date> — **HUB-42** E-05a: briefing identity/claim and verified conversation constraints APPLIED (<owner evidence>).`

**NOT done:** N; do not infer trigger absence. D9 retirement and D15 all-writer source stamping remain separately scoped parent work. No “exactly-once phone delivery” claim from an index. STOP S1–S12.

### E-05b · Deliver the stored briefing to the eligible person · M · E · Phase 1

**Outcome:** Each eligible household member receives one stored briefing at their approved local hour, with failures visible.

**Prereqs:** E-03a/E-04a/E-05a; cron and receipt migrations APPLIED; current notification preferences/subscription access evidence; owner-recorded C01/C03 resolutions; five-morning/day-6 rule retained.

**Skills:** start-task → api-route → timezone-handling → recurrence-safety → finish-task.

**Files:** P + D; `src/lib/briefing/compose.ts` (new); `src/lib/briefing/delivery.ts`; `src/lib/briefing/clock.ts`; `src/app/api/cron/era-briefing/route.ts` (new); `src/lib/pushSender.ts`; `src/lib/notifications/deliveryPolicy.ts` (new shared guard, E-19 extends this); `src/lib/notifications/registry.tsx`; `public/sw.js`; `tests/era-briefing-delivery.test.ts`; `src/lib/notifications/deliveryPolicy.test.ts` (new). F applies.

**DB change?** No new SQL; STOP if the APPLIED receipt/preferences shape cannot support the approved policy.

**AI call added?** No. Composer uses deterministic signals/phrasing only.

**Money/schedule math?** Yes, eligibility only; E-03a fixtures and duplicate-fire cases. Never recompute a money/schedule fact in compose.

**Gate:** `pnpm exec vitest run tests/era-briefing-delivery.test.ts src/lib/notifications/deliveryPolicy.test.ts --passWithNoTests=false` verifies Bearer rejection, claim-before-send, deterministic content, missing subscription/configuration failure, accepted-send count, retry with same notification ID/tag and recipient-specific eligibility. Owner supplies Completion G1.12/G1.13 with both phones.

**PM:** Tick HUB-42 only after D9/D15 and all parent acceptance also pass. Shipped sentence: `- ✅ <date> — **HUB-42** E-05b: stored briefings observed on eligible phones with retry and local-time proof (<artifacts>).`

**NOT done:** N; `!allFailed` is not success. Transport acceptance is not device display. Do not implement a second delivery-policy helper; guard the briefing path now, preserve E-19's later all-producer rollout. Existing sender behavior outside this path needs regression fixtures. STOP S1–S12.

### E-07a · Provider usage is measurable before the gauge · M · E · Phase 1

**Outcome:** The AI usage record reflects the actual call and fallback model, or explicitly identifies an estimate.

**Prereqs:** Existing AI telemetry storage owner-confirmed APPLIED/current; E-01a. New `2026-09-06_era-ai-usage-metadata.sql` must be owner-stamped APPLIED before live accounting acceptance. No additional model consumer before full E-07 passes.

**Skills:** start-task → db-migration → api-route → finish-task.

**Files:** P + D; `src/lib/ai/gemini.ts`; `src/lib/ai/eraAskProposal.ts`; `src/app/api/era/ask/route.ts`; `migrations/2026-09-06_era-ai-usage-metadata.sql` (new); `migrations/schema.sql` paired only; `migrations/README.md` runbook text only; `tests/era-ai-usage.test.ts` (new). F applies.

**DB change?** Yes. The checked-in `ai_messages` shape has token/model columns but no usage-basis metadata (`migrations/schema.sql:337`). After owner verifies current state, add nullable `usage_metadata jsonb` for per-attempt model/status/usage basis and provider usage. Existing null rows mean unknown historical basis, not actual measured usage. Preserve numeric columns for existing consumers without double counting the user/assistant pair. Hand the paired migration to the owner; never apply it.

**AI call added?** No new call; enrich existing `era-ask` accounting. Keep wrapper consumers backward compatible; preserve provider-accepted usage from each attempt when available, and mark unavailable failed-attempt usage explicitly.

**Money/schedule math?** No domain math; token accounting fixtures.

**Gate:** `pnpm exec vitest run tests/era-ai-usage.test.ts --passWithNoTests=false` supplies provider usage for full prompt/context/output, primary and fallback attempts, malformed output and usage-write failure. Quota lookup failure is unavailable allowance, not zero usage. Preserve `AI_MODEL`/`AI_FALLBACK_MODEL` policy D13 when parent adds overrides.

**PM:** HUB-44 remains open until actual gauge/view/degradation/override gates pass. Shipped sentence: `- ✅ <date> — **HUB-44** E-07a: ERA call usage/model attribution verified for success and fallback (<fixtures>).`

**NOT done:** N; a sparkline moving is not accounting correctness. Do not add another counter store or claim complete monetary billing from token counts. STOP S1–S12.

### E-08a · Everyday reads and bounded face context · M · E · Phase 1

**Outcome:** ERA answers account and meal-plan questions and gives Chef/Brain proposals relevant authorized context.

**Prereqs:** Full E-07 ✅ before expanding context; account/meal/memory storage migrations owner-stamped APPLIED/current; E-04 fact scope contract.

**Skills:** start-task → money-rules → api-route → timezone-handling → finish-task.

**Files:** P + D; `src/features/era/types.ts`; `src/features/era/intents/resolveIntent.ts`; `src/features/era/replyFormatter.ts`; `src/features/era/intents/budget.ts`; `src/features/era/intents/chef.ts`; `src/features/era/intents/resolvers/budget.ts`; `src/features/era/intents/resolvers/chef.ts`; `src/features/era/intents/formatters/budget.ts`; `src/features/era/intents/formatters/chef.ts`; `src/features/era/capabilities/registry.ts`; `src/features/era/capabilities/vocab.ts`; `src/lib/ai/context.ts`; `src/app/api/era/ask/route.ts`; `tests/era-reactive-reads.test.ts` (new). F applies.

**DB change?** No.

**AI call added?** Existing `era-ask` call gains Chef/Brain context; E-07 must already be ✅. Maximum 40 recipe/meal rows and 50 memory labels, matching E-08. No extra generation or retrieval service.

**Money/schedule math?** Yes, read semantics. Wallet $100 and income account $200 are separate authorized account facts; do not invent a $300 spendable total. Week/day meal ranges use the recipient's timezone. Own-only excludes partner data; failed read is unavailable, not empty.

**Gate:** `pnpm exec vitest run tests/era-reactive-reads.test.ts --passWithNoTests=false` covers fuzzy account selection reuse, own/household scope, currencies, empty vs failed meal read, context limits and quota gating. Owner compares one real answer against the precision page on both phones.

**PM:** Tick HUB-45 when all E-08 criteria pass. Shipped sentence: `- ✅ <date> — **HUB-45** E-08a: balance/meal reads and bounded Chef/Brain context verified (<fixtures/phone evidence>).`

**NOT done:** N; no broadened focus mutation contract and no new aggregators. If the named files require another dispatcher change, S1 before expansion. STOP S1–S12.

### E-10a · Stored briefing landing and bounded offline paint · M · E · Phase 2

**Outcome:** A tapped briefing opens the same record, and a cached briefing remains identifiable offline.

**Prereqs:** E-05a/b APPLIED and observed; E-11b face handling; existing auth/cache patterns. New UI remains additive.

**Skills:** start-task → api-route → ui-guardrails → cache-invalidation → finish-task.

**Files:** P + D; `src/app/api/era/briefing/today/route.ts` (new); `src/app/api/era/briefing/[id]/route.ts` (new); `src/features/era/useEraBriefing.ts` (new); `src/features/era/queryKeys.ts`; `src/components/era/BriefingCard.tsx` (new); `src/components/era/EraShell.tsx`; `src/app/providers.tsx`; `src/lib/notifications/registry.tsx`; `public/sw.js`; `tests/era-briefing-read.test.ts` (new). F applies.

**DB change?** No; existing stored notification is the briefing record.

**AI call added?** No.

**Money/schedule math?** No, render stored facts without recomputation.

**Gate:** `pnpm exec vitest run tests/era-briefing-read.test.ts --passWithNoTests=false` verifies recipient auth, prior-date ID lookup, invalid/deleted ID, bounded persistence predicate and offline absence. Owner screenshots cover 390×844/1440×900, original element positions unchanged, cached age, cold offline absence and sign-in return to same ID.

**PM:** HUB-48 stays open for E-10b and original status/card acceptance. Shipped sentence: `- ✅ <date> — **HUB-48** E-10a: stored briefing landing and bounded offline cache verified (<artifacts>).`

**NOT done:** N; no blanket `era` query persistence or transcript storage expansion. Do not redesign existing subtitle/animation under a status change; C6 governs. STOP S1–S12.

### E-10b · Analysis parity, then retire the floating assistant · M · E · Phase 2

**Outcome:** ERA opens new and saved Budget analysis reports through the existing renderer.

**Prereqs:** E-07 ✅; E-10a host surface; owner evidence for existing AI report history access; report parity gate before removal.

**Skills:** start-task → api-route → ui-guardrails → cache-invalidation → finish-task.

**Files:** P + D; `src/features/era/capabilities/registry.ts`; `src/features/era/capabilities/types.ts`; `src/features/era/useEraAskAI.ts`; `src/components/era/EraChatDrawer.tsx`; `src/app/api/ai-chat/route.ts`; `src/components/ai/AIChatAssistant.tsx` (delete only after parity); `src/components/DeferredComponents.tsx`; `tests/era-analysis-parity.test.ts` (new); `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`. F applies.

**DB change?** No; D4 keeps saved analysis in existing AI history.

**AI call added?** Existing report generation is relocated to ERA; new ERA report calls count under feature key `era-analysis` using the existing AI session/usage store (session prefix `era-analysis-`). E-07 must be ✅ and its gauge must accept that discriminator. Legacy saved-report session IDs remain readable; no history rewrite or new counter.

**Money/schedule math?** No new arithmetic. Render the same existing report data/component.

**Gate:** `pnpm exec vitest run tests/era-analysis-parity.test.ts --passWithNoTests=false` covers generation, quota refusal, authorized saved-history retrieval, nonowner refusal and actual renderer wiring. Owner screenshot proves the same report reachable in ERA; only then remove the floating file/import and confirm no remaining production references.

**PM:** Tick HUB-48 only after full E-10 status/card/report/offline criteria pass. Shipped sentence: `- ✅ <date> — **HUB-48** E-10b: report/history parity verified; floating assistant retired (<evidence>).`

**NOT done:** N; keep `AnalysisDashboard`; do not delete the entire AI component directory or saved history. No new report prompt, generation engine or assistant store. The relocated call uses `safeFetch` with explicit `timeoutMs: 60_000`; timeout is not an offline write and cannot enqueue generation. STOP S1–S12.

### E-13a · Explicit turn host policy · M · E · Phase 2

**Outcome:** ERA and household chat share execution while persisting each reply in its intended place.

**Prereqs:** E-11a/E-09d; APPLIED capture/ERA storage; treaty in AI Assistant Overview. HubPage remains forbidden in this sheet.

**Skills:** start-task → cache-invalidation → recurrence-safety → finish-task.

**Files:** P + D; `src/features/era/useEraTurn.ts`; `src/features/era/turnHost.ts` (new); `src/features/era/useEraConversation.ts`; `src/features/era/useEraAskAI.ts`; `tests/era-host-policy.test.ts` (new); `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`. F applies.

**DB change?** No.

**AI call added?** No; preserve E-07 feature accounting.

**Money/schedule math?** No new math; one request ID must traverse the host unchanged.

**Gate:** `pnpm exec vitest run tests/era-host-policy.test.ts --passWithNoTests=false` proves ERA host creates/persists one conversation turn; Hub host persists zero ERA rows, emits one host reply, and invokes one domain action. Failure of host persistence never repeats the domain action. Confirmed AI path follows the same host rule.

**PM:** HUB-16 remains open for rider/phone proof. Shipped sentence: `- ✅ <date> — **HUB-16** E-13a: explicit host policy shares execution without duplicate persistence (<fixtures>).`

**NOT done:** N; `conversationId: null` is not a supported current hook option to assume. Define and test it explicitly; no fourth store and no HubPage import. STOP S1–S12.

### E-13b · Shrink HubPage onto the verified host adapter · M · E · Phase 2

**Outcome:** A household-chat reminder retains its intended time and saves once through ERA.

**Prereqs:** E-13a; confirmed adapter parity; E-10b preserves report behavior before any AI-thread removal. APPLIED capture migrations; owner current item visibility evidence.

**Skills:** start-task → fix-bug → recurrence-safety → timezone-handling → finish-task.

**Files:** P + D; `src/components/hub/HubPage.tsx` (sole sanctioned exception to F); `src/features/voice-conversation/conversationEngine.ts`; `src/features/voice-conversation/hooks/useConversationMode.ts`; `src/features/voice-conversation/intentClassifier.ts` (delete only after no authorized caller remains); `tests/era-host-policy.test.ts`. All other F restrictions apply.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** Yes, preservation. Beirut 09:00 input → one reminder at the corresponding UTC instant, unchanged on replay; use E-09c fixture.

**Gate:** `pnpm exec vitest run tests/era-host-policy.test.ts --passWithNoTests=false` passes; Completion G2.8 LF command exits 0 with count < 6,275; owner G2.9 screenshot proves one reminder and one system reply. Reference search confirms removed legacy classifier has no caller.

**PM:** Tick HUB-16 only after all E-13 criteria pass. Shipped sentence: `- ✅ <date> — **HUB-16** E-13b: Hub reminder path uses ERA once; HubPage shrank to <count> lines (<fixtures/phone>).`

**NOT done:** N; added HubPage code is limited to the one sanctioned hook/adapter wiring. No unrelated extraction or new internals import. Any overlap with D2's excluded scope triggers S11, including an unsafe deletion boundary. STOP S1–S12.

### M-00a · Remove dead ERA declarations without visual changes · S · H · Phase 0

**Outcome:** ERA keeps its current behavior and appearance with fewer misleading unused implementations.

**Prereqs:** Fresh reference search at execution time; preserve visible labels/hues and resolve Architecture C09's future door owner. No migration.

**Skills:** start-task → finish-task.

**Files:** P + D; `src/components/era/face-widgets/BrainWidget.tsx`, `src/components/era/face-widgets/BudgetWidget.tsx`, `src/components/era/face-widgets/ChefWidget.tsx`, `src/components/era/face-widgets/EraFaceWidget.tsx`, `src/components/era/face-widgets/ScheduleWidget.tsx` (delete only); `src/features/era/types.ts`; `src/features/era/intentRouter.ts`; `src/features/era/useEraHousehold.ts` (delete only); `src/features/era/faceRegistry.ts`; `src/components/era/EraFaceNav.tsx`; `src/components/era/EraShell.tsx`; `src/features/era/intents/formatters/chef.ts`; `src/features/era/replyFormatter.ts`; `src/features/era/intents/resolveIntent.ts`. F applies.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No.

**Gate:** `rg -n "face-widgets|recipeOfferGenerate|stubIntentRouter|useEraHousehold" src` returns zero matches (expected exit 1); `pnpm typecheck` and `pnpm test` exit 0. No new test file for a reversible dead-code deletion. Owner before/after phone screenshot verifies no visible change. Use no brittle golden line-count test for these files.

**PM:** Tick HUB-40 only after the parent truth/treaty/doc obligations pass. Shipped sentence: `- ✅ <date> — **HUB-40** M-00a: dead ERA declarations removed with current appearance preserved (<reference/type/test evidence>).`

**NOT done:** N; `EraFaceNav` currently owns hue metadata and its visible Recipes label. Consolidation must preserve those values; do not rename it to Chef as a cleanup. Delete only the five proven-unreachable MODULE_COLORS entries in EraShell; preserve the entries selected by existing faces. STOP S1–S12.

## 5 · Review and study validation

No sheet is evidence of a shipped feature. Every new test, helper and migration path above is prospective. The study's validation checks only document consistency, paths, scope and PM lint baseline; no product test pass is claimed.

Recorded Phase-2 validation (2026-09-06): four documents; all relative document links resolve; all 21 sheets contain the required fields; sizes are 18 M / 3 S; each document ends with the exact capped ASTRA findings section. Existing allowlist paths were checked against disk; absent paths are explicitly new or supplied by named prerequisites. `git diff --stat` is empty: the four untracked study documents are the only additions beyond the pre-existing session brief. No application, migration, script, checklist or Master Book was modified; zero DB calls. PM lint remains at its pre-existing 1 error / 1 warning, with output in Completion §2.

Current blocking decisions: C01 quiet interval vs requested hour; C03 minimum partner-delivery sequencing; C10 persistent person identity; C15 honest capacity. Current external evidence gaps: APPLIED ledger and fresh DB state; real scheduler cadence; current deployment identity; real phone delivery. None is resolved by creating these documents.

**Recommended first dispatch after study review:** E-01a and E-11a, then E-09a/b in the next pair of slots. This respects correctness before foresight without creating another planning phase. Owner DB handoffs for E-09c/E-05a can proceed between coding sessions. If real estimates exceed the window, record the miss and apply the plan's existing sacrifice order; do not trade away durable capture or recipient correctness.

## ASTRA 10× Findings

- **Leverage 1 — DOCKS → E-09:** four prerequisite sheets close durability, server idempotency, item atomicity and reconciliation once; income/events then reuse them. This prevents each new capability from inventing its own retry behavior [Architecture A5–A7/A17].
- **Leverage 2 — DOCKS → E-11:** one outcome contract pays for correct learning, focus and Activity instead of separate success heuristics [A1/A2/A8].
- **Leverage 3 — DOCKS → E-03/E-05/E-06:** one briefing identity plus local eligibility and observable send states replaces ambiguous cron/notification success claims [A12; C01–C03/C07].
- **Simplification — DOCKS → M-00/E-10/E-13:** delete dead face implementations and redundant assistant ownership only after preserved-behavior gates, rather than creating another orchestration layer [A16; §4].
- **Frontier — None found with sufficient evidence for dispatch:** the offline evaluation corpus remains a parked Architecture proposal, not a packet competing with capture reliability.
- **Uncomfortable — CONFLICTS → D7 estimate:** the selected safety refinements already occupy up to ten weeks at the actual cadence, before all retained work. Treating their parent checkboxes as one-session bundles hides the cost; the remedy is explicit scope and the existing sacrifice protocol, not more optimistic estimates (§1).
