# Independent review findings

Review date: **2026-11-06**. Source baseline: **`9cd4166691edd9367ea1bd9a604e0bec13ffe870`**, plus the visible untracked research documented in [README](README.md). This is one bounded documentation review, not a deployed acceptance test. Corrections below are recommendations; reviewed files and application code were not changed.

## Reading the verdicts

- **CONFIRMED ERROR:** a quoted design contract contradicts another contract or the inspected implementation. This does not establish a production incident.
- **UNVERIFIED CLAIM:** necessary evidence is absent; the claim may be true.
- **OPEN DECISION:** legitimate alternatives remain; the reviewer cannot approve one.
- **EDITORIAL IMPROVEMENT:** presentation or routing can mislead without establishing incorrect behavior.

**High** means following the document could mishandle money, disclose/retain personal information, encourage an inappropriate health action, or authorize an unsafe recovery. **Medium** means materially incorrect results, dependencies, evaluation or prioritization. **Low** means navigation or maintenance friction. Severity concerns reliance on the documentation, not measured incident frequency.

| ID | Classification | Severity | Finding |
|---|---|---|---|
| F01 | CONFIRMED ERROR | High | Content matching and negative reads cannot prove an operation's outcome |
| F02 | CONFIRMED ERROR | High | Transfer row replay and audit history are overstated as money-effect receipts |
| F03 | CONFIRMED ERROR | High | Artifact status does not detect an edited transfer |
| F04 | CONFIRMED ERROR | High | Private-transaction descriptions and the privacy evaluation disagree with source |
| F05 | CONFIRMED ERROR | High | Groceries evaluation assumes a category calculation the source contract breaks |
| F06 | CONFIRMED ERROR | High | Forget completion precedes persistence and omits durable copies |
| F07 | CONFIRMED ERROR | Medium | Balance reconciliation age is presented as current-value age |
| F08 | CONFIRMED ERROR | Medium | Memory schema, expiry and uniqueness contracts disagree |
| F09 | CONFIRMED ERROR | High | Shared-data rollout omits schema and decision prerequisites |
| F10 | CONFIRMED ERROR | Medium | Ask AI's cost guard is described as the legacy token guard |
| F11 | CONFIRMED ERROR | Medium | Evaluation answer scores do not follow their rubrics |
| F12 | UNVERIFIED CLAIM | High | A medication course ending is treated as evidence it should continue |
| F13 | CONFIRMED ERROR | Medium | Paprika's version-3 citation now opens version 4 |
| F14 | UNVERIFIED CLAIM | Medium | Usage-frequency and volume claims lack household evidence |
| F15 | OPEN DECISION | Medium | Capture, Continue and recovery have overlapping but different boundaries |
| F16 | EDITORIAL IMPROVEMENT | Low | Historical prompts and unqualified IDs can launch duplicate scope |

## F01 — A matching record is not this operation's receipt

**Files:** [ACTION-LIFECYCLE](../06-action-execution/ACTION-LIFECYCLE.md), lines 149–151 and 192–208; [APPROVAL-AND-RECOVERY-MATRIX](../06-action-execution/APPROVAL-AND-RECOVERY-MATRIX.md), lines 59–75 and 96–102; [ACCEPTANCE-SCENARIOS](../06-action-execution/ACCEPTANCE-SCENARIOS.md), AC07, AC10 and the recurring/shopping timeout cases.

**Evidence:** LC24 turns a found record into `done` and an absent record into `Try again`. Matching drafts by amount/account, debts by name/amount, and groceries by content cannot attribute the result to a particular dispatch. The worked recurring example treats an advanced due date as completion and an unchanged due date as permission to retry. Yet [12 README](../12-solution-blueprints/README.md), lines 63–69, requires source operation identity and treats heuristic matches as inspection only. [03 SHARED-DEPENDENCIES](../03-life-journeys/SHARED-DEPENDENCIES.md), lines 61–65 and 89, and JOURNEY-04 explicitly preserve uncertainty after a partial recurring write. LC23 also groups all 4xx responses as `not_started`; status class alone is not a pre-effect receipt.

**Impact:** duplicate charges/messages; adopting another person's matching record; offering Undo against the wrong effect. An absent read can mean authorization loss, in-flight work or incomplete coverage.

**Proposed correction:** make the later operation-correlated contract normative. Only a source-proven pre-effect rejection or an authenticated, payload-bound replay contract can permit resubmission. Otherwise keep `uncertain` and offer inspection. Do not equate 409, absence or a changed due date with a complete effect.

**Acceptance to add:** delayed original request, concurrent identical manual record, revoked visibility, and expense-created/due-date-not-advanced all remain safe without a whole-operation retry.

## F02 — Transfer replay proves a row, not two balance effects

**Files:** [ACTION-LIFECYCLE](../06-action-execution/ACTION-LIFECYCLE.md), lines 202–207; [APPROVAL-AND-RECOVERY-MATRIX](../06-action-execution/APPROVAL-AND-RECOVERY-MATRIX.md), transfer row at line 61; [ACCEPTANCE-SCENARIOS](../06-action-execution/ACCEPTANCE-SCENARIOS.md), AC05 and AC18 (lines 34 and 57).

**Evidence:** [`replayTransfer`](../../../src/app/api/transfers/route.ts), lines 112–144, returns a matching saved transfer. The initial path inserts the transfer around line 342 and adjusts balances separately at lines 390–401. [`adjustAccountBalance`](../../../src/lib/balance.ts), lines 87–121, can return after a failed balance update; history is then best-effort at lines 124–149. Thus a row can exist without proof both balance legs completed, and a balance can change without a history row. AC18's missing-history → “Balance not updated” conclusion is also unsupported. [01 ARCHITECTURE](../01-atlas/ARCHITECTURE.md), lines 150–161, already identifies the atomicity gap.

**Impact:** false completion or a second delta applied to money already moved.

**Proposed correction:** distinguish row identity, balance effects and audit completeness. Describe today's replay narrowly. Require source-owned atomic outcome evidence before calling the transfer complete; missing history warrants an unverified/audit-incomplete state, not automatic repair.

**Acceptance to add:** interruption after row insert, after one leg, and history-only failure. Check effects independently; never infer a compensating delta from history absence alone.

## F03 — Transfer edit detection is a proposed prerequisite

**Files:** [ACTION-LIFECYCLE](../06-action-execution/ACTION-LIFECYCLE.md), lines 170 and 210; [ACCEPTANCE-SCENARIOS](../06-action-execution/ACCEPTANCE-SCENARIOS.md), AC32 at line 86.

**Evidence:** the lifecycle labels “edited transfer → changed → Undo disappears” as current behavior. [`POST /api/era/actions/status`](../../../src/app/api/era/actions/status/route.ts), lines 58–64, selects only `id, deleted_at` for transfers. It sets `changed` only for drafts whose `is_draft` became false. It reads no transfer revision or approved values.

**Impact:** a developer could rely on this status to reverse a transfer after an intervening edit.

**Proposed correction:** relabel this guarantee as proposed and blocked by a source version/precondition contract. Verify the inverse's authorization and current version at the mutation boundary, not just through a prior UI status read.

**Acceptance to add:** edit a transfer between approval/status read and reversal; the stale inverse must not overwrite or reverse the new effect. This review did not execute a reversal.

## F04 — Privacy prose and Q15 do not describe the inspected read path

**Files:** [BUSINESS-RULES](../19-business-rules/BUSINESS-RULES.md), BR04 at line 64; [OPEN-DECISIONS](../19-business-rules/OPEN-DECISIONS.md), line 49; [SCENARIO-CATALOGUE](../19-business-rules/SCENARIO-CATALOGUE.md), S05 line 98; [EVALUATION-PACK](../07-ai-quality/EVALUATION-PACK.md), Q15 lines 153–157; [ANSWER-KEYS](../07-ai-quality/EVALUATION-ANSWER-KEYS.md), lines 111–114.

**Evidence:** the business documents say category is withheld. [`SupabaseTransactionService.getTransactions`](../../../src/services/transaction.service.ts), lines 263–284, retains the top-level category and amount while masking finer details. The source path includes partner transactions irrespective of account picker visibility (lines 195–208). [`resolveMonthSpend`](../../../src/features/era/intents/resolvers/budget.ts), lines 99–107 and 145–157, scopes by owner and sums returned rows; it does not exclude masked/private rows. Q15 nevertheless accepts a partner spending call with “private entries aren't included.” [`GET /api/transactions`](../../../src/app/api/transactions/route.ts), lines 25–26, uses this service.

**Impact:** the evaluation can endorse false privacy reassurance and incorrect aggregation expectations. This is a source/document mismatch, **not proof of a production disclosure**; effective live RLS was unavailable.

**Proposed correction:** describe current category/amount behavior accurately and leave the desired visibility matrix in existing Q02 for owner decision. Test account visibility × transaction privacy × viewer × aggregate before treating a model answer as privacy-safe. A model disclaimer cannot substitute for source filtering.

## F05 — A valid spending tool call does not prove a correct category total

**Files:** [EVALUATION-PACK](../07-ai-quality/EVALUATION-PACK.md), Q03 lines 49–53; [ANSWER-KEYS](../07-ai-quality/EVALUATION-ANSWER-KEYS.md), lines 29–33.

**Evidence:** Q03 assumes the application computes groceries correctly once `spend.month` receives the right scope and hint. The transactions service returns `category` as a **string** (lines 276–277), but [`resolveMonthSpend`](../../../src/features/era/intents/resolvers/budget.ts) reads `t.category?.name` at line 156. The JSON is cast without shape validation at line 88. If no category matches, `filteredTotal` remains the whole scoped total (lines 160–173). The route/service connection is established in F04.

**Impact:** perfect model routing can still produce a materially wrong money answer. A model-quality pass would conceal a deterministic source defect.

**Proposed correction:** label Q03 as an interpretation/routing test only until an API-shaped fixture validates the calculation. Record the source mismatch as a prerequisite; do not “fix” the model prompt to compensate. Define an honest unmatched-category outcome.

**Acceptance to add:** actual string-shaped categories with two categories and distinct amounts; groceries yields only groceries, and an unknown hint never silently yields all spending. No live financial test was run here.

## F06 — Forget promises exceed the proposed durable deletion protocol

**Files:** [CORRECTION-AND-EXPIRY-RULES](../04-memory-context/CORRECTION-AND-EXPIRY-RULES.md), CE19–21 at lines 96–113 and AS4 at line 139; [CONTEXT-ASSEMBLY](../04-memory-context/CONTEXT-ASSEMBLY.md), lines 169 and 180.

**Evidence:** CE20/CA16 forbid “Forgotten” until every automatic copy is redacted. AS4 and the worked flow display that completion before a four-second deferred server commit. CE19 revokes kept records/examples without specifying redaction of their statement/value. It omits the execution journal: [`resultSchema` and `RunState`](../../../src/features/era/execution/state.ts), lines 60–110, retain text, metadata, source text and steps; [`era_runs.state`](../../../migrations/schema.sql), lines 1534–1545, persists that JSON. The journal is flag-gated, which makes conditional coverage necessary, not irrelevant.

**Impact:** sensitive content may remain after a claimed forget; process death during the Undo delay may leave no durable request. Redacting receipts also has recovery/audit consequences that need an explicit contract.

**Proposed correction:** use a pending acknowledgement until durable completion; define cancellation separately. Inventory content-bearing journal and kept-record fields and distinguish content redaction from minimal non-content receipts. Resolve retention needs explicitly in [D03](DECISION-REGISTER.md#d03--forget-retention-and-recovery).

**Acceptance to add:** close before deferred commit, crash after commit/before acknowledgement, partial copy failure, journal enabled/disabled, and another device retaining an old cache. “Forgotten” requires evidence for every in-scope copy.

## F07 — `balance_set_at` is not the timestamp of the current calculated balance

**Files:** [CORRECTION-AND-EXPIRY-RULES](../04-memory-context/CORRECTION-AND-EXPIRY-RULES.md), CE13 line 68 and AS13 line 148; [ATTENTION-RULES](../05-proactive-assistance/ATTENTION-RULES.md), AR2a lines 45–46; [EVALUATION-SCENARIOS](../05-proactive-assistance/EVALUATION-SCENARIOS.md), EV19 line 73.

**Evidence:** ordinary [`adjustAccountBalance`](../../../src/lib/balance.ts) updates `balance` and `updated_at` (lines 89–92), not `balance_set_at`. The [manual balance route](../../../src/app/api/accounts/[id]/balance/route.ts), lines 175–189, updates/restores the reconciliation anchor. Dating today's computed value “as of 20 Sep” from that anchor conflates different clocks.

**Impact:** fresh recorded spending can be called stale, while a recently fetched value can be mistaken for a recent manual reconciliation.

**Proposed correction:** separate `fetched_at`, source `updated_at` and last manual reconciliation. An old anchor may justify a reconciliation suggestion under an owner-chosen policy; it does not date the current value backwards.

**Acceptance to add:** old manual baseline followed by today's logged transaction: show the current computed balance, its read coverage, and separately the age of reconciliation.

## F08 — The memory data definition cannot express all its rules consistently

**Files:** [MEMORY-DESIGN](../04-memory-context/MEMORY-DESIGN.md), lines 57–68 and 136–143; [CORRECTION-AND-EXPIRY-RULES](../04-memory-context/CORRECTION-AND-EXPIRY-RULES.md), CE9–11 and CE22 at line 119.

**Evidence:** CE9/10 require a stored zone for interpretation; CE11 introduces review timing. Neither zone nor a derivation/storage contract for review timing appears in the field/migration list. The live-row predicate `valid_from ≤ now < valid_until` does not specify null semantics for preferences without expiry. The design's unique key omits `conditions`; CE22 includes it and also calls saves client-ID-idempotent. Natural-key duplicate detection and operation replay are different guarantees.

**Impact:** long-lived preferences disappear, conditional preferences collide, or identical retries cannot be distinguished from intentional later saves.

**Proposed correction:** one normative proposed record contract: zone, nullable/open interval semantics, review/last-use derivation, condition-aware duplicate semantics, and payload-bound operation replay. Link other sections to it. No migration is authorized by this review.

**Acceptance to add:** no-expiry preference; same statement under two conditions; DST boundary; repeated same operation versus a separately requested save.

## F09 — Shared-data stages have hidden SQL and acceptance dependencies

**File:** [CROSS-MODULE-CONTRACTS](../08-shared-data/CROSS-MODULE-CONTRACTS.md), lines 65, 206–225.

**Evidence:** the overview calls stages 0–2 code-only and stage 3 SQL optional. Stage 2 writes planned occurrence instants plus `done_at`, while stage 3 lists `done_at` as an optional new column. The earlier mirror contract requires coordinated trigger changes in the same migration. Stage 2 requires W1–W6 even though W5's legacy signed-URL repair is assigned to stage 3. Mandatory money dates depend on D4, but stage 2 names only D1/D2. Stage 4 deletes tables through owner SQL yet offers “Restore from Git” as rollback.

**Impact:** implementers may deploy incompatible writers/triggers, declare acceptance without required data repair, or mistake code rollback for restoration of deleted data.

**Proposed correction:** separate genuinely code-only helpers from schema/trigger/data transitions. List each consumer's decisions, migration, compatibility reader and acceptance prerequisites. Give data retirement an explicit preservation/restore runbook; Git alone cannot recover table contents. Keep D4 unresolved rather than silently implementing its default as approval.

**Acceptance to add:** old/new client coexistence, absent/new column states, matching mirror behavior, legacy URL before/after owner repair, and demonstrated restore prerequisites in an isolated fixture.

## F10 — Two different AI guard paths are collapsed into one limit

**Files:** [BUSINESS-RULES](../19-business-rules/BUSINESS-RULES.md), BR32 line 257; [OPEN-DECISIONS](../19-business-rules/OPEN-DECISIONS.md), Q14 line 118; also qualify the shared-controls wording in [CAPABILITY-MAP](../01-atlas/CAPABILITY-MAP.md), line 237.

**Evidence:** [`POST /api/era/ask`](../../../src/app/api/era/ask/route.ts), lines 53–60 and 182–218, uses a **$1 estimated monthly cost guard**, explicitly replacing the old 1M-token guard for this path. [`rateLimit.ts`](../../../src/lib/ai/rateLimit.ts), line 15, still contains the legacy 1M-token limit. [USAGE-CONTROLS](../07-ai-quality/USAGE-CONTROLS.md), lines 20–24, already separates them correctly.

**Impact:** incorrect household budget assumptions and misleading limit-hit acceptance cases.

**Proposed correction:** link to the route-by-route limits table; distinguish automatic handoff counts, per-minute limits, cost estimation and legacy token limits. None is proof of a globally reserved, hard household spending ceiling. Desired budget remains Q14, not a decision made here.

## F11 — Clarification answers receive points their rubrics do not award

**Files:** [EVALUATION-PACK](../07-ai-quality/EVALUATION-PACK.md), Q08–09 lines 89–101; [ANSWER-KEYS](../07-ai-quality/EVALUATION-ANSWER-KEYS.md), lines 65–76.

**Evidence:** Q08 gives two points for stating next Monday, but its clarification-only reference omits that date and is scored 10. Q09 gives points for Thursday dinner and ingredient binding, but “Which pasta…” alone scores 10. Conversely its source-bound lookup plan is scored 7 although lookup-first is expressly allowed by the expected behavior.

**Impact:** graders cannot reproduce model comparisons or release thresholds; legitimate clarification may be penalized or rewarded arbitrarily.

**Proposed correction:** branch the rubric for clarification versus executable proposals, with explicit not-applicable rules and a common maximum. Separate model interpretation, adapter correctness and end-to-end effect tests. Hand-score references against the actual rubric before any model comparison; use existing replay fixtures, not paid live calls.

## F12 — Course end does not establish a need to continue medication

**File:** [TRIGGER-CATALOGUE](../05-proactive-assistance/TRIGGER-CATALOGUE.md), P10 lines 172–185.

**Evidence:** the only course trigger is `ends_at` approaching. The benefit asserts preventing a gap in a course “that should continue”; the example names amoxicillin and presents **Continue**, opening a prefilled edit. No prescriber direction, renewal eligibility or supply evidence establishes continuation. CDC guidance is to use antibiotics as prescribed; that does not support an app inferring an extension from an end date. [CDC antibiotic-use guidance](https://www.cdc.gov/antibiotic-use/about/), checked 2026-11-06.

**Impact:** a proposed administrative reminder can imply a treatment recommendation.

**Proposed correction:** neutral **Review** leading to the source record, with no prefilled extension or implied need to renew. Keep recorded course completion, refill logistics and prescribed regimen changes distinct. Future clinical assumptions need appropriate evidence and explicit scope. Fictional names do not remove this design risk.

**Acceptance to add:** a finite course ending normally must not produce a continuation recommendation. This is a product-safety finding, not advice about anyone's treatment.

## F13 — The Paprika citation no longer supports its version label

**Files:** [SOURCES](../16-product-research/SOURCES.md), Paprika entry at line 26 and version caveat at line 36; [PRODUCT-PATTERNS](../16-product-research/PRODUCT-PATTERNS.md), Paprika section.

**Evidence:** the pack labels the generic Windows guide as Paprika 3 and distinguishes a version-4 beta. During this review, that [generic guide](https://www.paprikaapp.com/help/windows/) redirects to the [Paprika 4 guide](https://www.paprikaapp.com/help/v4/windows/), explicitly titled version 4. The version-3 link exists on that page, but its destination was not retrievable in this browsing pass.

**Impact:** a future reader attributes changing features to the wrong product version. This proves citation drift now, not fabrication at the original retrieval date.

**Proposed correction:** use a verified version-specific page and snapshot date, or mark version-3 details unverified until accessible. The general recipe-to-shopping inspiration can remain a hypothesis; no hands-on behavior was verified.

## F14 — Demand and storage volume are hypotheses, not observations

**Files:** [ACTION-LIFECYCLE](../06-action-execution/ACTION-LIFECYCLE.md), XD4 line 238; [MEMORY-DESIGN](../04-memory-context/MEMORY-DESIGN.md), line 118.

**Evidence:** “commonest ERA writes” has no usage sample behind it in the reviewed inputs. “Hundreds of rows a month” is asserted alongside an acknowledgement that row counts are unknown. Source capability breadth cannot establish household frequency.

**Impact:** unsupported demand can elevate an expensive migration, retention policy or memory architecture over a smaller source-confirmed fix.

**Proposed correction:** label both as workload hypotheses, identify the smallest owner observation that would change the choice, and retain deterministic/manual alternatives. Do not start analytics collection from this review.

**Important distinction:** named households and amounts are generally marked fictional; the AI cost workloads are explicitly assumptions. This pass found no basis to accuse those examples of being fabricated personal facts. The roadmap's effort ranges are estimates, not measured delivery data.

## F15 — One recovery family, several different products

**Files:** [CAPTURE-AND-RETRIEVAL-FLOWS](../10-interaction-design/CAPTURE-AND-RETRIEVAL-FLOWS.md), F1/F2/F5; [HOME-AND-NAVIGATION](../10-interaction-design/HOME-AND-NAVIGATION.md), Continue; [SOLUTION-CONCEPTS](../16-product-research/SOLUTION-CONCEPTS.md), C1; [BLUEPRINT-01](../12-solution-blueprints/BLUEPRINT-01.md); [ROADMAP](../17-roadmap/ROADMAP.md), Q1/F1/C1/R1 and N1.

**Evidence:** the interaction design includes durable raw thought capture and unfinished editors; the blueprint deals with operation recovery; the roadmap intentionally narrows C1 to discovering persisted work and makes larger R1 conditional. It does not claim unsent text is durable. These are related proposals, not interchangeable acceptance boundaries.

**Impact:** treating all as one approved “Continue” feature creates extra storage, privacy and conversion obligations, or falsely promises unsent-input recovery from a run journal.

**Proposed correction:** keep the narrowed roadmap boundary explicit. Decide which actual interruption matters before selecting raw-capture persistence or operation recovery. Preserve source-owned drafts and receipts; specify raw text ownership, retention and conversion identity before adding a store. See [D01](DECISION-REGISTER.md#d01--next-slice-and-interruption-boundary).

## F16 — Make historical prompts and IDs unambiguous

**Files:** [RemainingTASKS.MD](../RemainingTASKS.MD), lines 1–30; repeated short IDs throughout packs 03/05/08/12/16/17; [NAVIGATION-GUIDE](../18-ai-handoff/NAVIGATION-GUIDE.md).

**Evidence:** the historical prompt list still presents work now visible in packs 03/10/12/16/17 as future sessions. `C1`, `D1`, `F1` and `P1` have different meanings across packs. The older handoff cannot route to every later local pack.

**Impact:** duplicate documentation tasks or confusing an evaluation fixture with a roadmap dependency. This is not a request to update that historical file.

**Proposed correction:** use this inventory and [READ-FIRST](READ-FIRST.md) as a review overlay; qualify IDs with pack names. Preserve old prompts as provenance, not the current work queue. No proposal becomes approved because a newer pack links it.

## What this pass did not establish

Local links had no missing file targets in the 906-link scan. This is not proof that every heading, line locator, external page or linked claim is correct. The external check ledger and unavailable inputs are in [README](README.md). No runtime, phone, live database, scheduler, provider-call, clinical or household-usage acceptance was performed. Unchallenged claims are not automatically verified.
