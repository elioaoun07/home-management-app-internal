---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Budget — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../Budget — Master Book.md>) updated 2026-08-26. Study only; no DB calls.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-BUD-1 | NEW; factual correction to money-rules Invariant 1 | BUD-63 | Later; current owner DB evidence then atomic shared primitive |
| ASTRA-BUD-2 | NEW; DOCKS → E-09 safety | BUD-64 | Later; after BUD-63; no blanket confirmation replay |
| ASTRA-BUD-3 | NEW | BUD-65 | Later; after BUD-63; create branch only |
| ASTRA-BUD-4 | DOCKS → E-04/E-08; EXTENDS → BUD-4 prerequisite | BUD-66 | Next blocker; correct actuals, keep full BUD-4 open |

## Plan reconciliation

| Sheet | Mapping | Parent boundary |
|---|---|---|
| ASTRA-BUD-1 | NEW; CONFLICTS → money-rules Invariant1's current factual claim | SQL implementation preserves the existing ownership boundary |
| ASTRA-BUD-2 | NEW; DOCKS → E-09 safety prerequisite | Draft confirmation only, no blanket offline eligibility |
| ASTRA-BUD-3 | NEW | Only import create effects; other action branches remain open |
| ASTRA-BUD-4 | DOCKS → E-04/E-08; EXTENDS → BUD-4 | Correct actuals, not full cashflow forecast |
| BUD-32 | DOCKS → M-01; EXTENDS → BUD-32 | Re-assess already-present deleted recognition before choosing a different fix |
| Income draft display / compute removal | CONFLICTS → current draft-subtraction / money skill formula | Owner semantic decision, no dispatch |
| Other import actions / restore | NEW / EXTENDS → BUD-24 | Current DB contract first; separate bounded follow-ons |

## Execution contract

These sheets are specifications, **NOT RUN**. Copy this block with an individually dispatched sheet. S ≤ half a session; M ≤ one 2–4h session. Study IDs allocate no campaign integers; Phase 5 landing above records the canonical queue. A partial child never closes an incomplete parent.

**Common gates:** named regressions execute nonzero cases and pass; `pnpm typecheck`, `pnpm lint`, `pnpm pm:lint` exit 0, with output and tested revision attached. The existing PM lint error for the missing DLV-77 migration path is a separately owned Phase-5 prerequisite, not permission to invent SQL. Tests use isolated fixtures and mocked clients; agents make no live DB calls. Owner-run DB/device evidence is separate from mocked tests.

**Forbidden in every sheet:** `src/components/ui/**`; `src/components/hub/HubPage.tsx` (no rider in these campaign sheets); `migrations/schema.sql` without the explicitly paired migration; every path outside the exact allowlist; git writes, production data access, new dependencies, new modules, a second queue/recurrence engine, and changes to existing `/era` layout. New paths are marked **[NEW]**. Relevant PM trace paths named in each sheet are future implementation permissions, not study edits.

| STOP | Condition — stop and leave a five-line evidence/handoff note |
|---|---|
| S1 | A file outside the allowlist needs editing. |
| S2 | A DB write is needed; hand the owner the manual runbook and await APPLIED evidence. |
| S3 | Test count decreases, a required check is red, or a targeted regression executes zero cases. |
| S4 | HubPage grows or a new import of its internals is required. |
| S5 | A new dependency is required. |
| S6 | Work cannot finish in one session; split before proceeding. |
| S7 | A visibility/permission symptom appears; obtain fresh owner DB-state evidence or Hard Rule 27's untruncated queries before route diagnosis. |
| S8 | Money/schedule semantics are ambiguous; ask one focused question rather than guessing. |
| S9 | An AI proposal would write without the required confirmation. |
| S10 | A second engine, queue, parser, regex family, toast system or aggregate for an existing concept is introduced. |
| S11 | Work enters D2's entirely excluded scope. |
| S12 | An existing `/era` element is moved or restyled. |

**NOT done, in every sheet:** migration written ≠ APPLIED; test file ≠ test in CI include; local success ≠ evidence pasted; transport acceptance ≠ observed household outcome; child implementation ≠ parent completion.


**PM allowlist P:** `ERA Notes/10 - Project Management/Budget/4 - Checklist.md`; `ERA Notes/10 - Project Management/Budget/Budget — Master Book.md`.

## ASTRA-BUD-1 · Atomic balance delta and history · M · H · financial foundation

**Outcome:** Concurrent accepted balance deltas both count, and an unsuccessful update cannot be reported as applied.

**Prereqs:** E-01 CI; owner provides fresh balance tables/constraints/triggers/functions/grants, including history change-type taxonomy. Resolve actual owner attribution for partner-funded operations without widening authorization. Paired migration below must be APPLIED before cutover.

**Skills:** `start-task → money-rules → db-migration → fix-bug → finish-task`.

**Files:** `src/lib/balance.ts`; `src/lib/balance.test.ts`; `migrations/YYYY-MM-DD_atomic-balance-delta.sql` **[NEW, actual date at execution]**; paired `migrations/schema.sql`; `migrations/README.md` **[prerequisite-created Applied ledger]**; `.claude/skills/money-rules/SKILL.md`; `ERA Notes/02 - Standalone Modules/Accounts & Balance/Balance System.md`; plus P.

**Boundary:** Keep adjustAccountBalance's public role, but use a transaction-local SQL increment with returned before/after balances and atomic required history. Service-role-only callable helper; no freely callable authenticated arbitrary-account adjustment. It can also be invoked inside later authenticated domain functions in the same DB transaction. Missing-row creation is authorized from the account's actual owner, not empty metadata; serialize that race too. Fail on write/history errors. No event-date/checkpoint/direction changes, automatic repair, retry enrollment or new application ledger.

**DB change?** Yes, manual migration + schema, including grants, constraints and isolated concurrency/rollback verification. Owner applies; agent never executes.

**AI call added?** No.

**Money/schedule math?** Yes, Invariants1/3/8: 100 plus concurrent−10/−20 →70, history 100→90→70 or100→80→70. Forced history failure → entire individual increment rolls back. Checkpoint unchanged; +20 inverse restores90 after−10/−20/+20. Primitive adds supplied deltas without inferring account type.

**Gate:** `pnpm exec vitest run src/lib/balance.test.ts --reporter=verbose` → nonzero wrapper/error cases pass. Owner isolated SQL outputs prove concurrent update, absent-row race, unauthorized invocation refusal and history rollback. Common gates pass. Inspect callers for error handling; if any needs an edit, S1 requires a new scoped sheet, not widening this one.

**PM:** Tick BUD-63 only after every sheet gate passes. Shipped sentence: `- ✅ YYYY-MM-DD — **BUD-63** (ASTRA-BUD-1) Shared balance increments and history are atomic; concurrency and error evidence: <evidence>.`

**NOT done:** Primitive atomicity ≠ transaction/draft/import/transfer atomicity; callers can still fail after an earlier domain-row write.

**STOP:** S1–S12 above.

## ASTRA-BUD-2 · Atomic draft confirmation · M · H · after ASTRA-BUD-1

**Outcome:** Confirming a draft changes its status and account balance exactly once, or changes neither.

**Prereqs:** ASTRA-BUD-1 APPLIED and tested; owner-current transaction/category/account/trigger/grant contract, including frozen FX stamp. E-09b must be accepted before its capture endpoint is changed; this sheet edits only confirmation. Migration below APPLIED before cutover.

**Skills:** `start-task → money-rules → timezone-handling → api-route → db-migration → finish-task`.

**Files:** `src/app/api/drafts/[id]/route.ts`; `tests/draft-confirmation.test.ts` **[NEW]**; `migrations/YYYY-MM-DD_atomic-draft-confirmation.sql` **[NEW, actual date]**; paired `migrations/schema.sql`; `migrations/README.md` **[prerequisite-created]**; `ERA Notes/02 - Standalone Modules/Drafts/Overview.md`; plus P.

**Boundary:** Zod-validate finite amount, IDs and date under the existing signed-amount contract; do not silently prohibit refunds while repairing atomicity. Resolve any ambiguous zero/refund policy under S8. Verify category/account/owner before effects. Authenticated SQL function locks the same nondeleted draft, checks destination access, changes its existing row, applies canonical account-type delta and history in one transaction via BUD-1's primitive. No fallback account type. Preserve repeat result only for the same confirmed payload/identity; altered replay is 409, cross-owner replay refused. Never re-read an already-confirmed row and apply money again. No new queue capability.

**DB change?** Yes; owner manual migration with auth/rollback/replay fixtures and least-privilege grants.

**AI call added?** No.

**Money/schedule math?** Yes, Invariants1/3/5: expense stored100, draft20 → display80; confirm → stored80, draft reservation0, display80. Retry →80. Inject history failure → stored100 and draft retained. Income stored100 confirming20 →120. Deleted draft cannot confirm; changed destination/category cannot escape authorization.

**Gate:** `pnpm exec vitest run tests/draft-confirmation.test.ts src/lib/balance-utils.test.ts --reporter=verbose` → nonzero route/payload/direction cases pass; owner SQL proves concurrent confirm, lost-response repeat, conflict payload and rollback. Common gates; owner two-frame confirmation shows stable display80 and one history effect.

**PM:** Tick BUD-64 only after every sheet gate passes. Shipped sentence: `- ✅ YYYY-MM-DD — **BUD-64** (ASTRA-BUD-2) Draft confirmation commits status and money once; replay/auth/rollback evidence: <evidence>.`

**NOT done:** Does not decide income-draft display, repair past partial confirmations or certify statement-import's separate confirm branch.

**STOP:** S1–S12 above.

## ASTRA-BUD-3 · Atomic import create effect · M · H · after ASTRA-BUD-1

**Outcome:** A newly imported transaction, its rollback entry and its balance effect are committed together.

**Prereqs:** ASTRA-BUD-1 APPLIED; fresh owner import ledger/transactions/hash/history contracts and all referenced columns present. Required existing import migrations APPLIED: `2026-08-19_statement-import-rollback.sql`, `2026-08-24_transactions-bank-description.sql`, `2026-08-24_statement-import-rekey-action.sql`, `2026-08-24_statement-import-transfers.sql`, `2026-08-24_statement-skipped-rows.sql`, `2026-08-25_transfer-statement-hash.sql`; owner confirms actual state rather than trusting filenames. New migration APPLIED before cutover.

**Skills:** `start-task → money-rules → api-route → db-migration → finish-task`.

**Files:** `src/app/api/statement-import/commit/route.ts`; `src/app/api/statement-import/commit/route.test.ts`; `migrations/YYYY-MM-DD_atomic-import-create.sql` **[NEW, actual date]**; paired `migrations/schema.sql`; `migrations/README.md` **[prerequisite-created]**; `ERA Notes/02 - Standalone Modules/Statement Import/Overview.md`; plus P.

**Boundary:** Only the create-action branch: one authenticated SQL operation owns transaction insert, per-row import ledger and BUD-1 delta/history. Verify batch ownership and category/account; lock/unique identity prevents repeated effect. Already occupied fingerprint returns existing classification without moving money. Remove this branch's amount from the route's later balance application and do not re-upsert its ledger as a new effect. Receipt may still summarize its delta; receipt data must not drive a second application. Keep other branches untouched and document their remaining partial-write risks. If required endpoint changes exceed one session, stop and split before edits.

**DB change?** Yes; paired owner-run SQL with forced ledger/history failures and retry verification.

**AI call added?** No.

**Money/schedule math?** Yes: expense100, create20 →80 and one transaction+ledger/history; failure at any of those three writes →100 and no new transaction/ledger/history. Repeat same statement identity →80. Refund20 →120. Mixed create+stamp fixture proves create is not applied again in the final accumulated delta.

**Gate:** `pnpm exec vitest run src/app/api/statement-import/commit/route.test.ts src/lib/statement-revert.test.ts --reporter=verbose` → nonzero tests pass. Replace the permissive ledger-failure assertion for create with zero domain writes. Owner SQL supplies rollback/concurrency evidence and create→revert inverse100→80→100; common gates. Other branches are labeled unverified, never implied fixed.

**PM:** Tick BUD-65 only after every sheet gate passes. Shipped sentence: `- ✅ YYYY-MM-DD — **BUD-65** (ASTRA-BUD-3 create-only) Import create effects commit transaction, inverse evidence and balance together; remaining branches listed; evidence: <evidence>.`

**NOT done:** Not whole-batch atomicity, transfer restore, stamp/confirm/rekey atomicity, historical repair or “every import safely revertible.”

**STOP:** S1–S12 above.

## ASTRA-BUD-4 · Coherent ERA money actuals · M · E · E-04/E-08 prerequisite

**Outcome:** ERA's spending and analytics answers use the same billing period, ownership scope and currency basis.

**Prereqs:** Reviewed E-04a completeness interface specification, not completed E-04a implementation; owner confirms household USD summary basis already used by Analytics. E-01 CI. No migration required APPLIED. Do not change standalone dashboard calendar-month tiles.

**Skills:** `start-task → money-rules → timezone-handling → finish-task`.

**Files:** `src/features/era/intents/resolvers/budget.ts`; `src/features/era/intents/formatters/budget.ts`; `src/features/era/intents/resolveIntent.test.ts`; `src/lib/eraMoneyPeriod.ts` **[NEW]**; `tests/era-money-period.test.ts` **[NEW]**; `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`; plus P.

**Boundary:** Shared adapter enriches authorized transaction rows with account types/rates and delegates to canonical incomeExpense/toUsd helpers. No copied spending formula. Current and previous custom-period facts share scope/currency; unknown account or failed retrieval is incomplete, not zero or calendar fallback. Preserve toUsd's documented null-rate legacy/USD behavior; if a foreign currency lacks a usable stamp and its legacy status is unknown, expose incompleteness rather than inventing a rate. Preserve existing response presentation and privacy masking; no raw partner-private description in ERA. Stop if required inputs cannot be obtained through existing authorized endpoints.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** Yes, Invariants4/6/7/8: expenseUSD20 + expenseEUR10 at frozen1.1 → USD31 spend; income1000 excluded from spend, refunds handled by canonical policy, transfers absent. Same fixture with billing day15 onSep6 excludesSep15 future rows and compares like periods. Income/savings use that period, not calendar September.

**Gate:** `pnpm exec vitest run tests/era-money-period.test.ts src/features/era/intents/resolveIntent.test.ts src/lib/utils/incomeExpense.test.ts --reporter=verbose` → nonzero mixed-currency/account/refund/period/failure/privacy cases pass; common gates; 390×844 answer capture has coherent values and unchanged layout.

**PM:** Tick BUD-66 after this sheet's gates; keep full BUD-4 forecast open. Shipped sentence: `- ✅ YYYY-MM-DD — **BUD-66** (ASTRA-BUD-4 prerequisite) ERA money actuals share canonical period, scope and currency; worked fixtures: <evidence>.`

**NOT done:** Correct actuals ≠ forecast, currency migration applied or repaired historical balances.

**STOP:** S1–S12 above.

## ASTRA 10× Findings

- **Leverage:** Three bounded financial boundaries can replace many misleading success paths without replacing the money model.
- **Simplification:** ERA consumes canonical aggregates; it stops being another ad hoc spending calculator.
- **Uncomfortable:** Existing tests need stronger failure assertions, not a larger pass count.
