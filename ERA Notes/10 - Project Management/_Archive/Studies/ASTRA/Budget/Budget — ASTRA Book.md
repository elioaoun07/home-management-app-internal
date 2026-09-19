---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Budget — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../../../../Budget/Budget — Master Book.md>) updated 2026-08-26. Study only; no DB calls.

## Book delta

Master Book read end to end. `git log --since=2026-08-26 --format="%h %ad %s" --date=short -- src/features/statement-import src/app/api/drafts src/app/api/transactions src/app/api/recycle-bin src/app/api/statement-import src/lib/statement-reconcile.ts src/lib/statement-revert.ts` returns `bf0ee6e`, `071b6cc`, `a5e8dd9`, all Aug26.

The active Pain Inventory still describes the old many-to-one duplicate matcher; current `statement-reconcile.ts:620,700–718` claims each duplicate once (BUD-34/37). It calls transfer import deferred despite shipped BUD-46/54/56. “Single-format text-only” misses coordinate-aware PDF reconstruction and fail-closed rejected-block diagnostics (Overview §Key Concepts, BUD-58; `src/lib/pdf-parser.ts`, `bank-statement-parser.ts`). Those are not new proposals.

BUD-32/M-01 is refined: `reconcile/route.ts:131–160` fetches exact hashes without the deleted filter, `statement-reconcile.ts:644` preserves deleted state and `statement-import/page.tsx:136,1836` marks it in Imported. DELETE still retains the hash. The accepted alternative “recognize deleted instead of recreating” has source support; owner-facing restore completion and current unique-index evidence remain **UNVERIFIED**. Do not null hashes automatically before choosing the intended restore/re-import contract. BUD-39/36 owner repairs are not authorized actions in this study.

Drafts are rows in `transactions` (`schema.sql:58`, `drafts/[id]/route.ts:37`), promoted in place. Drafts Overview's separate `transaction_drafts` table and delete/insert story are false. Money skill's dual-currency description predates BUD-15. Its “atomic helper” and date-based live balance story also require correction (F1/F4). Server console errors are allowed under current Hard Rule 22; old route-console pain is not a current rule violation.

## Re-scored maturity

Same six dimensions; provisional source assessment. The old 5.8 headline already differs from its displayed 34/6 = 5.7 rubric.

| Dimension | Book | ASTRA | Reason |
|---|---:|---:|---|
| Data correctness | 8 | 4 | F1–F4: source admits lost updates and partial commits |
| Test protection | 6 | 6 | Extensive parser/matcher/revert cases; F3 shows an important weak assertion |
| Cross-module bridges | 3 | 5 | FX/household transfer and shared import matching are real; forecast still gated |
| Code health | 5 | 4 | Shared arithmetic remains valuable; commit route has several independent effect branches |
| AI leverage | 7 | 6 | Proposals exist, but ERA spending can aggregate incompatible facts (F5) |
| Handoff readiness | 5 | 4 | Stale live-state narrative coexists with detailed newer shipped evidence |
| **Mean** | **5.8 headline** | **4.8** | No money tests or production operations run during study |

## Ranked findings

### F1 — The financial choke point is a lost-update race

`src/lib/balance.ts:47–83` reads, computes `previousBalance + delta` in JS, then sends an absolute update. There is no RPC call in this function despite its comment. Concurrent −10 and −20 from 100 can finish at 90 or 80 instead of 70. Missing-row/read failure can return 0 (`:55–70`); update failure returns the previous balance (`:85–92`); history failure is best-effort (`:95–119`). Callers awaiting it cannot infer that money changed.

**CONFLICTS → money-rules Invariant 1's factual atomicity claim.** Replace the implementation behind the existing shared boundary, with a transaction-local SQL delta/history primitive available to later domain transactions. Preserve checkpoint and existing direction semantics. This is infrastructure for product correctness, not a new ledger framework. Fresh owner schema/function/grant evidence first; `schema.sql` is not current history-taxonomy authority.

### F2 — Draft capture is safe to separate; confirmation is not

`drafts/[id]/route.ts:50–85` changes `is_draft` before fetching account type and adjusting balance. A missing account type defaults to expense; input uses `parseFloat` without Zod, and the promote guard omits `deleted_at IS NULL`. After a failed balance step a retry cannot promote again. Top Layer A6 correctly holds confirmation out of offline replay. ASTRA-BUD-2 makes one draft transition, balance delta and history atomic and authorized; no new transaction ID or new draft store.

### F3 — Import's advertised rollback guarantee does not hold across failure boundaries

`commit/route.ts:389–418` creates transactions, `:544–653` confirms drafts, and `:833–887` creates transfers. The ledger is persisted only at `:963–980`, followed by balances at `:985–991`. Ledger failure returns “Nothing was written” after earlier writes. `commit/route.test.ts:559–568` explicitly acknowledges inserted rows and asserts only no balance call: tests preserve the hole instead of proving rollback.

A second gap is ledger-present/balance-not-applied: `statement-revert.ts:136` plans from live rows, which prove row existence, not balance application. Example: inserted 20 expense, stored balance still100; blindly reversing an inferred −20 would produce120. **UNVERIFIED:** whether this failure has occurred in production; owner audit of a failed import's rows, applied effects and balances would settle it. Do not repair production by inference.

ASTRA-BUD-3 is a bounded **create-action** slice of atomic import effects. Other action branches, multi-account transfer atomicity and whole-batch recovery stay explicitly open. One successful slice does not certify “every commit revertible.”

### F4 — There are competing descriptions of what a balance means

`accounts/[id]/balance/route.ts:46–84` reads stored running balance and subtracts all drafts. `computeAccountBalance` uses insert timestamps (`balance.ts:204`), contrary to the skill's event-date formula, but `rg -n computeAccountBalance src --glob '*.ts' --glob '*.tsx'` finds **only its definition and its tests**. It is not the live read path. Do not switch production to it as a repair.

The same GET subtracts income drafts: stored100 with pending income2000 displays−1900. Whether an income draft belongs in available balance at all is a product/accounting decision, **not permission to silently add2000**. This must be resolved before E-09e's capture makes the mismatch routine. Remove the unused computation only after its historical recovery role is ruled out; keep existing money tests that protect active helpers.

### F5 — “This month” can mix period, currency and account type

`src/features/era/intents/resolvers/budget.ts:38–78,117,234–250` reduces raw transaction amounts and combines custom-period expense with calendar-period income/savings/prior expense. `src/services/transaction.service.ts:76–84,261–272` returns native amounts across account types, not canonical USD spending. Account/type, debt-return and frozen-rate facts must enter the existing `sumSpending`/`toUsd` contract before ERA speaks. Failing the custom-period fetch currently falls back to a different period (`budget.ts:220`).

ASTRA-BUD-4 owns this correction; Hub's scope-filter fix remains credited. Do not build a forecast on plausible-looking mixed aggregates.

### F6 — Recycle restoration is a domain transition, not generic undelete

`src/app/api/recycle-bin/restore/route.ts:60–101` undeletes first, then separately reapplies transaction money; `src/lib/recycleBin/registry.ts:99–134` registers transfers without a balance inverse. BUD-24 is real, but even the “fixed” transaction path admits retry races/partial effects. Route it to domain-owned atomic restore operations after F1's primitive; preserve asymmetric FX legs. A registry hook with best-effort errors cannot establish financial restoration (`restore/route.ts:103–113`).

### F7 — Existing evidence can answer questions without generating new money events

`src/features/recurring/commitments.ts:1–46` already represents matched/covered/due/missed with transaction identity and reasons. `statement-reconcile.ts` distinguishes exact identity from heuristic evidence. Expose those facts under E-04/E-22; do not turn a heuristic match into automatic payment confirmation. The later BUD-26 read-only audit mode remains valuable, with the August19 Lebanon-entry/abroad-audit decision overriding the Overview's universal “audit, not entry” statement.

## Ranked enhancement catalog

| Rank | Sheet / retained work | Size / severity | Mapping |
|---|---|---|---|
| 1 | ASTRA-BUD-1: atomic shared balance increment/history | M / blocker | NEW; foundation of BUD-24 and confirmations |
| 2 | ASTRA-BUD-2: atomic draft confirmation | M / blocker | NEW; resolves Top Layer A6 / E-09 safety hold |
| 3 | ASTRA-BUD-3: atomic import create action | M / blocker | NEW; first repair of F3, existing BUD-23 implementation not its advertised guarantee |
| 4 | ASTRA-BUD-4: coherent ERA money-period aggregate | M / friction | DOCKS → E-04/E-08; EXTENDS → BUD-4 |
| Held | Domain restore + remaining import action transactions | No dispatch yet | EXTENDS → BUD-24; NEW remainder of F3; split after current contracts |
| Existing | Audit report, trip matching, merchant suggestions | Existing queue | EXTENDS → BUD-26/27/28, BUD-1/2; no duplicate engine |
| Decision | Income draft display; unused balance computation | No implementation sheet | CONFLICTS → current universal draft-subtraction / skill formula |

## What ERA needs

An authorized money snapshot with account/currency, stored balance vs pending expense vs pending income, reconciliation age, custom-period range, canonical spend, frozen transaction rates and completeness. Commitments contribute due date, amount, account and match provenance; analysis reports contribute typed evidence. Registry writes continue through drafts and human confirmation. No balance-driven prediction is stronger than its input's freshness and accounting contract.

## Do not do

Do not run BUD-39/36 repairs, re-key historical rows, auto-reconcile on reads, widen matching tolerances, replace deterministic money with AI, or merge two recurrence engines. Do not label a skipped duplicate a repaired missing balance. Do not refactor large forms merely for line count. Do not sum account-native currencies into one number.

## Coverage note

Budget owns Accounts/Balance, Transactions, Categories, recurring payments, Transfers, Allocation, Statement Import, Analytics, Debts, Future Purchases and transaction Drafts. Detailed fault tracing focused on shared balance, confirmation, import/revert and ERA aggregation; other submodules were routed through their documented ownership, not exhaustively re-tested. Shared Recycle Bin belongs in coverage with money restore owned here. [Coverage appendix](<../ASTRA — Coverage & Orphans.md>).

## ASTRA 10× Findings

- **Leverage:** Fix the existing balance choke point once; nearly every money writer already uses it (F1).
- **Leverage:** Commit row identity, financial effect and inverse evidence together. A fingerprint alone prevents retries from repairing a partial write (F2/F3).
- **Leverage:** Reuse commitments and import evidence as bounded ERA facts; remove repeated owner investigations without inventing another forecast engine (F7).
- **Simplification:** Retire the unused balance computation after ownership review; it currently anchors a false architecture narrative (F4).
- **Frontier — DOCKS → E-04/E-22:** Evidence-linked cashflow answers can name confirmed obligations, uncertain matches and stale checkpoints separately.
- **Uncomfortable:** A money regression test knowingly permits inserted transactions after ledger failure while the API promises nothing was written (F3).

