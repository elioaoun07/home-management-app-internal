---
created: 2026-09-10
updated: 2026-09-26
type: master-book
status: active
owner: Elio
---

# Budget — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Reliable balances, transactions, commitments and financial decisions. Standalone campaign; Budget also owns its money bridges.

## Current state & evidence

Core calculations, manual merchant matching, statement import and account/transfer improvements have shipped. Concurrent money/history, domain restore, import recovery and truthful summaries remain incomplete. Historical owner repair counts are not a current inventory.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Inside Lebanon, statement upload remains an entry source; abroad, record each tap and audit the statement after returning (owner decision 2026-08-19). One importer with two modes; stale “all statements are audit-only” wording is superseded.
- AI proposes money through drafts; users confirm. Balance/history and inverse guarantees are domain contracts, never generic row restore.
- Payments and Schedule recurrence remain separate engines. Do not widen matching tolerance to hide bad matches.
- Expense/recurring mega-forms split only when real work touches them (BUD-9). Full forecasting waits for money contracts and coverage; cheap ERA signals do not close BUD-4.
- Calculation tests, manual merchant mapping, transfers and account editing are implemented as recorded in the Shipped Log. Proposed E11–E13 matching/briefing experiments remain in Research unless covered by a named task.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🟠 **BUD-32** Verify deleted-row recognition and restore choice. See [acceptance](<#bud-32>) for the root cause, evidence and gate.

🟠 **BUD-67** Verify statement and default-income deployment. See [acceptance](<#bud-67>) for the root cause, evidence and gate.

🔴 **BUD-39** Verify and repair historical duplicate imports. See [acceptance](<#bud-39>) for the root cause, evidence and gate.

🟠 **BUD-24** Restore money with exactly-once inverse effects. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-24>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-63** Commit balance and history atomically. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-63>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-64** Confirm transaction drafts exactly once. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-64>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-65** Commit imported rows and balance effects atomically. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-65>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-66** Provide canonical money facts to ERA. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-66>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-68** Keep debt reads free of mutations. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-68>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-69** Make future-purchase analysis financially truthful. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-69>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-70** Match commitments exclusively with account provenance. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-70>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **BUD-71** Complete import atomicity beyond row creation. Dated source diagnosis; cause and witness limits are in [criteria](<#bud-71>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

All open items include [item execution plans](<../_Conventions.md#9-item-execution-plans>). Read only the chosen ID and its prerequisites. These are unreviewed implementation references; the checklist remains the sole queue and owner evidence remains separate.

### BUD-32

**Outcome:** Verify deleted-row recognition and restore choice.

- **Acceptance:** Reproduce current exact-hash matching against deleted transactions and the restore/re-import choice in an isolated witness. Preserve fingerprint semantics until that witness identifies a defect; code already includes deleted exact-hash rows. Do not blindly clear hashes to force insertion.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Reproduce before changing anything — the acceptance says preserve fingerprint semantics until a witness shows a defect, and explicitly forbids clearing hashes to force insertion. The matcher is `src/lib/statement-reconcile.ts`: read `RowStatus`/`RowClassification`, the window constants `MATCH_WINDOW_BACK_DAYS` (7) / `MATCH_WINDOW_FORWARD_DAYS` (1), and the tolerance constants `AMOUNT_EPSILON`, `AMOUNT_TOLERANCE_MIN`, `AMOUNT_TOLERANCE_PCT`; its test is `src/lib/statement-reconcile.test.ts`. The exact-hash comparison against deleted rows happens on the route side — `src/app/api/statement-import/reconcile/route.ts` — and the restore/re-import choice surfaces through `src/features/statement-import/sessionModel.ts` (`getBucket`, `isRestored`, `RowDecision`). Soft-delete semantics: `src/features/recycle-bin/`. This gates BUD-67, BUD-39 and BUD-36; `.claude/skills/money-rules/SKILL.md` applies to anything you change.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; current exact-hash recognition is present. Prove the missing restore choice before changing money or fingerprints.

**Verify:** `pnpm exec vitest run src/lib/statement-reconcile.test.ts src/app/api/statement-import/reconcile/route.test.ts src/features/statement-import/sessionModel.test.ts` — deleted exact hash, hash outside the date window, cross-account destination, standing skip and batch revert. These tests were inspected, not executed in this planning pass.

```delivery-plan-v1
{
  "outcome": "Identify and close only a reproduced gap in deleted-import recognition or the restore/re-import choice.",
  "acceptance": [
    "A deleted exact-hash transaction stays distinguishable from a new row and creates no duplicate.",
    "The witness records which existing restore/revert path is safe and which behavior still needs implementation."
  ],
  "scope": [
    "src/lib/statement-reconcile.test.ts",
    "src/app/api/statement-import/reconcile/route.test.ts",
    "src/features/statement-import/sessionModel.test.ts"
  ],
  "steps": [
    "Build an isolated fixture for plain delete, exact re-upload, batch revert and re-upload; record classification, staged action and balance before each transition.",
    "Trace the exact-hash lookup and imported-row UI. Keep standing-skip Restore separate from transaction undelete; sessionModel.restored is not money restoration.",
    "Run existing tests and add only the missing behavior witness. If a defect requires product changes, narrow the scope around the failing branch before dispatch.",
    "Record the result for BUD-67/BUD-39; keep any production restore or repair in owner UAT."
  ],
  "invariants": [
    "Occupied transaction fingerprints remain occupied after ordinary soft delete.",
    "No guessed hash, duplicate transaction or automatic balance correction."
  ],
  "exclusions": [
    "Historical cleanup.",
    "Changing all import branches.",
    "Implementing BUD-24 domain restoration."
  ],
  "checks": [],
  "risks": [
    "A UI Restore label can refer to two different operations.",
    "A recognition test alone cannot certify money restoration."
  ],
  "unknowns": [
    "Whether the current imported-row UI exposes an adequate choice after ordinary deletion."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: reconcile route hash/window queries, matcher deleted-row fixture and sessionModel reviewed at HEAD 45b2889; no live witness."
}
```

### BUD-67

**Outcome:** Verify statement and default-income deployment.

- **Acceptance:** Owner verifies BUD-56 fingerprint and BUD-62 default-income SQL/application, Salary preference, re-import receipt and a real transfer witness against current evidence. Code-shipped does not imply migration-applied or owner-accepted.
- **Depends on:** [BUD-32](<Budget — Master Book.md#bud-32>).

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner verification; code-shipped is not migration-applied. Read `migrations/` for the BUD-56 fingerprint and BUD-62 default-income SQL and their end state in `migrations/schema.sql`, and use `migrations/db-state.json` for anything about policies or triggers (Hard Rule #27). The Salary preference lives in `src/features/preferences/` — note Hard Rule: LBP amounts are stored in thousands, so a currency check here is easy to misread. Re-import receipt and transfer witness come through `src/app/api/statement-import/imports/` and `src/features/transfers/`. Agents never apply the SQL (Hard Rule #26). Depends on BUD-32's semantics being settled first.

**Execution plan — 2026-09-26**

**Readiness:** Owner evidence; this is deployment/UAT verification, not an autonomous production task. Engineering may prepare and review evidence.

**Verify:** Owner supplies current schema/index/trigger receipts for `2026-08-25_transfer-statement-hash.sql` and `2026-08-26_accounts-default-income.sql`, then Salary default, repeated import and transfer before/after receipts. Record applied, source-present and device-verified separately.

```delivery-plan-v1
{
  "outcome": "Establish whether statement fingerprints and default-income behavior are deployed and accepted.",
  "acceptance": [
    "Each prerequisite has dated owner evidence or an explicit pending state.",
    "Repeated transfer import moves no money again; received income targets the selected Salary account."
  ],
  "scope": [],
  "steps": [
    "Read BUD-32's isolated witness and compare the two named migrations with the current code contract; do not infer application from schema.sql.",
    "Prepare a compact owner UAT sequence: inspect existing columns/indexes/triggers, confirm Salary selection, then one statement receipt and one transfer witness.",
    "Ask the owner to run only missing reviewed SQL and the app checks. Wait for their outputs; agents do not access production to perform them.",
    "Record per-check results and hand the verified dependency status to BUD-39. Any actual code defect becomes a bounded engineering slice."
  ],
  "invariants": [
    "No statement row or transfer is applied twice.",
    "Default-income selection remains independent of the general default account.",
    "A code receipt is not a deployment receipt."
  ],
  "exclusions": [
    "Production SQL execution by an agent.",
    "Duplicate repair.",
    "Unrelated preference or LBP redesign."
  ],
  "checks": [],
  "risks": [
    "The committed DB snapshot predates these August migrations.",
    "Re-running a migration blindly can collide with objects already present."
  ],
  "unknowns": [
    "Current migration application, Salary preference and real transfer outcome."
  ],
  "dependencies": [
    "BUD-32"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: named migration paths and schema fields verified; db-state generated 2026-08-04. Production application remains unknown."
}
```

### BUD-39

**Outcome:** Verify and repair historical duplicate imports.

- **Acceptance:** Owner re-inspects the duplicate groups and statement evidence, backs up affected rows, and decides whether the existing 2026-08-24 repair runbook needs revision. Historical counts (10 copies), $42.08 drift and the Touch Prepaid $17.04 pair are leads, not current facts. Preserve legitimate FX rows. Resolve hash/restore semantics under BUD-32 before a reviewed manual repair; verify balances and reconciliation afterwards.
- **Depends on:** [BUD-32](<Budget — Master Book.md#bud-32>), [BUD-67](<Budget — Master Book.md#bud-67>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A data-repair runbook the **owner** executes, never the agent — `.claude/skills/data-repair/SKILL.md` is the shape (inspect + count → backup → idempotent fix → verification query → rollback) and Hard Rule #26 makes the deliverable SQL text, not an action. Every historical number in the acceptance is a lead, not a fact: re-count before writing anything. The duplicate identity is the import fingerprint — see `src/lib/statement-reconcile.ts` and the hash columns in `migrations/schema.sql`. "Preserve legitimate FX rows" is the trap: two same-day rows differing only by exchange rate are not duplicates, so read `toUsd()` in `src/lib/balance-utils.ts` and the currency fields before grouping. Balances must be re-verified after (`getBalanceDelta`, `getTransferDeltas`). Depends on BUD-32 and BUD-67.

**Execution plan — 2026-09-26**

**Readiness:** Owner evidence and runbook reconciliation first. The two existing August repair files disagree; neither is permission to repair current data.

**Verify:** Owner: untruncated current duplicate groups plus bank evidence, exact backup count/IDs, reviewed balance effect, then post-repair groups, account balance and reconciliation receipt. Historical 10/$42.08/$17.04 figures are leads only.

```delivery-plan-v1
{
  "outcome": "Prepare a current, reviewable duplicate repair and preserve legitimate repeated charges and FX rows.",
  "acceptance": [
    "Every proposed removal has statement evidence and a backed-up exact identity.",
    "Owner verification reconciles both transaction rows and balance effects after the chosen repair."
  ],
  "scope": [],
  "steps": [
    "After BUD-32 and BUD-67, compare the owner-supplied current groups with statement rows; specifically adjudicate the Touch Prepaid pair and exclude unproven duplicates.",
    "Reconcile 2026-08-24_repair-delete-duplicates.sql with 2026-08-24_repair-duplicates-and-phantom-fx.sql: their SQL/app deletion, FX and balance instructions differ.",
    "Draft one current inspect/backup/fix/verify/rollback runbook using data-repair and money-rules; name exact rows and expected deltas. Assign its file scope only after evidence fixes the method.",
    "Hand the reviewed runbook to the owner; wait for execution and verification receipts before enabling BUD-36 recovery."
  ],
  "invariants": [
    "No delete based only on equal date, amount and wording.",
    "Legitimate FX and real repeated payments survive.",
    "Every money effect has one explicit inverse."
  ],
  "exclusions": [
    "Agent production reads/writes.",
    "Automatically choosing the oldest repair file.",
    "Blind hash clearing or historical-count reuse."
  ],
  "checks": [],
  "risks": [
    "The old runbooks prescribe incompatible balance handling.",
    "Restoring repaired rows could reapply money unless the inverse is specified."
  ],
  "unknowns": [
    "Actual duplicate inventory and intended survivor identities.",
    "Which historical repair steps, if any, the owner already applied."
  ],
  "dependencies": [
    "BUD-32",
    "BUD-67"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: both August runbook headers/instructions reviewed against active acceptance. No current production data inspected."
}
```

### BUD-36

**Outcome:** Verify historical re-import recovery month by month.

- **Acceptance:** After BUD-32/BUD-39, owner verifies the current rekey/stamp contract and applies only missing reviewed SQL. Re-import one oldest month, inspect created/matched/re-fingerprinted receipt, repeat, then a full-year upload must create nothing. Historical 157 missing hashes and 152 v1 hashes are not a current inventory. Never reconstruct unprovable fingerprints or auto-run a repair.
- **Depends on:** [BUD-39](<Budget — Master Book.md#bud-39>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-driven, month by month, and the acceptance forbids reconstructing unprovable fingerprints or auto-running a repair — the historical 157/152 hash counts are not an inventory. The rekey/stamp contract lives in `src/app/api/statement-import/imports/` and `imports/[id]/route.ts`, with `commit/route.ts` on the write side and `imports/[id]/revert/route.ts` as the inverse. The receipt fields you are inspecting (created / matched / re-fingerprinted) come from `ReconcileSummary` in `src/lib/statement-reconcile.ts`. The acceptance's end state — a full-year re-upload creating nothing — is the real test of idempotence. Depends on BUD-39.

**Execution plan — 2026-09-26**

**Readiness:** Owner evidence after BUD-39; engineering prepares the sequence and interprets receipts. No autonomous re-import or SQL application.

**Verify:** `pnpm exec vitest run src/app/api/statement-import/commit/route.test.ts src/lib/statement-reconcile.test.ts src/lib/statement-revert.test.ts` protects the local contract. Owner: oldest month first, repeat-month zero creates, then full-year zero creates, with before/after balance and per-row receipts.

```delivery-plan-v1
{
  "outcome": "Recover historical statement identity month by month without duplicating money.",
  "acceptance": [
    "Every month has a dated created/matched/re-fingerprinted receipt and explained balance effect.",
    "The final full-year upload creates no additional rows."
  ],
  "scope": [],
  "steps": [
    "Read BUD-32/BUD-39 receipts and establish the current rekey/stamp behavior, ledger constraint and bank_description contract.",
    "Prepare owner checks for any missing reviewed migration, preserving current hashes and bank-text provenance; do not reconstruct unknown fingerprints.",
    "Have the owner re-import the oldest month, inspect each receipt and reconcile balances before proceeding to the next month.",
    "Repeat one accepted month and then the full year; stop on any unexplained create, duplicate or balance movement and route the defect to a bounded implementation slice."
  ],
  "invariants": [
    "Stamp/rekey are balance-neutral.",
    "Historical counts never determine a present repair.",
    "Only the original statement proves a missing fingerprint."
  ],
  "exclusions": [
    "Bulk unattended recovery.",
    "Inventing hashes from renamed transaction descriptions.",
    "Treating imported-row atomicity as already solved."
  ],
  "checks": [],
  "risks": [
    "Month overlap and identical real charges can expose one-to-one matching mistakes.",
    "Incomplete migration deployment can make ledger writes fail."
  ],
  "unknowns": [
    "Current missing/v1 hash inventory and owner-applied migration state."
  ],
  "dependencies": [
    "BUD-39"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: accepted recovery contract and current reconcile/commit test paths checked; production receipts remain owner evidence."
}
```

### BUD-66

**Outcome:** Provide canonical money facts to ERA.

- **Acceptance:** ERA actuals share canonical account type, currency, ownership and custom-period semantics; blocks trusted E-04/E-08 money summaries.

**Retained contract — ASTRA-BUD-4:**

- **Outcome:** ERA's spending and analytics answers use the same billing period, ownership scope and currency basis.
- **Boundary:** Shared adapter enriches authorized transaction rows with account types/rates and delegates to canonical incomeExpense/toUsd helpers. No copied spending formula. Current and previous custom-period facts share scope/currency; unknown account or failed retrieval is incomplete, not zero or calendar fallback. Preserve toUsd's documented null-rate legacy/USD behavior; if a foreign currency lacks a usable stamp and its legacy status is unknown, expose incompleteness rather than inventing a rate. Preserve existing response presentation and privacy masking; no raw partner-private description in ERA. Stop if required inputs cannot be obtained through existing authorized endpoints.
- **Money/schedule math?:** Yes, Invariants4/6/7/8: expenseUSD20 + expenseEUR10 at frozen1.1 → USD31 spend; income1000 excluded from spend, refunds handled by canonical policy, transfers absent. Same fixture with billing day15 onSep6 excludesSep15 future rows and compares like periods. Income/savings use that period, not calendar September.
- **Gate:** `pnpm exec vitest run tests/era-money-period.test.ts src/features/era/intents/resolveIntent.test.ts src/lib/utils/incomeExpense.test.ts --reporter=verbose` → nonzero mixed-currency/account/refund/period/failure/privacy cases pass; common gates; 390×844 answer capture has coherent values and unchanged layout.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The canonical-facts item that BUD-26, BUD-69 and the ERA money answers all wait on. Four semantics to unify, each with a home: account type direction is `src/lib/balance-utils.ts` (`AccountType`, `getBalanceDelta`, `getTransferDeltas`) plus the CHECK constraints in `migrations/schema.sql`; currency is `toUsd(amount, exchangeRate)` in the same file, and the LBP-in-thousands rule from Preferences; ownership is the `household_links` + `ownOnly` pattern of Hard Rule #13, canonically `src/app/api/accounts/route.ts`; and the custom billing period is `startOfCustomMonth(date, monthStartDay)` in `src/lib/utils/date.ts` — never a calendar month. The consumer is the AI context assembler `src/lib/ai/context.ts` and `src/features/era/`. `.claude/skills/money-rules/SKILL.md` is mandatory: a worked before/after example and a test.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; first inventory the authorized ERA money inputs and keep the adapter scope bounded.

**Verify:** `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts src/lib/utils/incomeExpense.test.ts src/lib/balance-utils.test.ts`; `tests/era-money-period.test.ts` from the retained contract is a proposed new test, not present at this cutoff. Include USD20 + EUR10×1.1 = USD31, refunds, custom day15 and read failures.

```delivery-plan-v1
{
  "outcome": "ERA money answers use canonical currency, account type, household scope and billing-period facts.",
  "acceptance": [
    "Current and comparison totals use the same authorized scope and currency basis.",
    "Unknown account/rate or failed reads produce incomplete results, never fabricated zero."
  ],
  "scope": [
    "src/features/era/intents/resolvers/budget.ts",
    "src/lib/ai/context.ts",
    "src/lib/utils/incomeExpense.ts",
    "src/features/era/intents/resolveIntent.test.ts"
  ],
  "steps": [
    "Trace each money answer's inputs against account types, frozen transaction rates, ownership masking and startOfCustomMonth; document divergence before edits.",
    "Introduce one shared facts adapter in an explicitly named new src/lib path only if existing helpers cannot hold it; agree that scope before dispatch.",
    "Delegate totals to canonical incomeExpense/toUsd helpers and apply one custom-period boundary to current and comparison data; preserve documented legacy null-rate semantics.",
    "Wire consumers to the result's completeness status, suppress unsafe summaries on partial reads, and verify privacy-masked partner responses with the worked fixtures."
  ],
  "invariants": [
    "Transfers never become spend.",
    "No raw partner-private descriptions.",
    "No copied arithmetic or calendar-month fallback."
  ],
  "exclusions": [
    "Full cashflow forecast.",
    "Changing balance storage.",
    "Inventing FX rates or repairing historical data."
  ],
  "checks": [],
  "risks": [
    "A plausible zero is more misleading than an unavailable answer.",
    "Current and previous periods can silently use different account sets."
  ],
  "unknowns": [
    "Final adapter location and authorized inputs need source-level confirmation before dispatch."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: retained ASTRA-BUD-4 contract, account/currency vault and Feature Map reviewed; Next plan is not a full resolver audit."
}
```

### BUD-24

**Outcome:** Restore money with exactly-once inverse effects.

- **Acceptance:** Domain restore must reapply money exactly once: transfers currently lack their inverse, and transaction undelete followed by balance adjustment can partly commit. Inspect current owner DB contracts; split by domain before implementation.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two named defects, split by domain before implementing. Transfers lack an inverse — `src/features/transfers/` and `getTransferDeltas()` in `src/lib/balance-utils.ts` show that a transfer is two deltas, so a restore must reverse both or neither. Transaction undelete followed by a balance adjustment can partly commit — the sequence is in `src/app/api/transactions/[id]/route.ts` (see its delete branch, which already hand-reverses a completed split's collaborator balance) and `src/features/recycle-bin/` / `src/app/api/recycle-bin/`. "Exactly once" under replay means the offline queue too (`src/lib/offlineQueue.ts`). Atomicity across a write and its balance effect is BUD-63's shared boundary — coordinate rather than building a second transaction. `.claude/skills/money-rules/SKILL.md`; owner DB evidence first (Hard Rule #26).

**Execution plan — 2026-09-26**

**Readiness:** Split first and owner DB evidence. Separate transaction restore from transfer restore before implementation; coordinate the atomic primitive with BUD-63.

**Verify:** `pnpm exec vitest run src/lib/balance.test.ts src/lib/balance-utils.test.ts src/lib/statement-revert.test.ts`; add proposed isolated restore-route fixtures. Expense100 → delete20 restores120 → restore returns100; repeated restore stays100. Transfer restores both original legs or neither.

```delivery-plan-v1
{
  "outcome": "Each money-domain restore reapplies its original effect exactly once, with its row and history.",
  "acceptance": [
    "Restore, lost-response retry and Undo preserve the domain's balance invariant.",
    "Failure between undelete and balance/history leaves neither side partially committed."
  ],
  "scope": [
    "src/app/api/recycle-bin/restore/route.ts",
    "src/lib/balance.ts"
  ],
  "steps": [
    "Inspect current owner-supplied restore/functions/trigger evidence and the generic restore route; enumerate transaction, draft and transfer behavior separately.",
    "Produce one bounded transaction-restore slice using BUD-63's shared transaction-local primitive, with owner access and already-restored outcomes explicit.",
    "Produce a separate transfer slice that restores both account deltas and history atomically using original currencies/amounts; do not reuse one-leg transaction math.",
    "Write paired manual migration/schema changes only after contracts and target paths are fixed; test concurrency/failure in an isolated DB and hand production application to the owner."
  ],
  "invariants": [
    "A draft restore applies no posted-money delta.",
    "No automatic balance_set_at change.",
    "Restore cannot bypass domain authorization."
  ],
  "exclusions": [
    "Generic row-only restore for money.",
    "Production execution.",
    "Repairing old drift as part of restore."
  ],
  "checks": [],
  "risks": [
    "The current route undeletes before applying transaction balance.",
    "Transfer inverse evidence may not be sufficient to safely infer both legs."
  ],
  "unknowns": [
    "Current DB restore contracts and history taxonomy; inspect before migration design."
  ],
  "dependencies": [
    "BUD-63"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: restore route balance sequence and schema history fields inspected; live DB semantics not certified."
}
```

### BUD-1

**Outcome:** Apply merchant mappings to voice transaction drafts.

- **Acceptance:** Merchant-match → Voice Draft Transactions — when a spoken message contains a known merchant, run it through `matchMerchantMapping()` so the draft pre-selects Category/Subcategory from the merchant map (on top of existing NLP category matching). → `src/lib/nlp/` + drafts review UI

- **Acceptance:** a spoken draft whose text contains a known merchant pre-selects that merchant's Category/Subcategory in the drafts review UI, on top of existing NLP category matching.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small and additive. `matchMerchantMapping()` lives in `src/lib/merchantMatch.ts` (with `resolveCategoryRef` and its own `merchantMatch.test.ts`) and is already used by `src/components/expense/MobileExpenseForm.tsx` and `src/lib/bank-statement-parser.ts` — the voice/draft path does not call it (verified 2026-09-20). The speech parser is `src/lib/nlp/speechExpense.ts`, which does its own fuzzy category matching with explicit thresholds; merchant mapping layers **on top of** that, so decide precedence rather than replacing it. Drafts review UI: `src/features/drafts/` and `src/components/expense/DraftTransactionsDialog.tsx` / `DraftsDrawer.tsx`. The draft is a proposal — pre-select, never auto-commit.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; agree a single suggestion precedence and reuse it for BUD-2.

**Verify:** `pnpm exec vitest run src/lib/merchantMatch.test.ts`; add proposed speech/draft integration cases for mapped merchant, unknown merchant, explicit manual selection and cross-user category slug resolution. Existing draft confirmation behavior must remain unchanged.

```delivery-plan-v1
{
  "outcome": "Voice transaction drafts preselect a known merchant's category and subcategory for human review.",
  "acceptance": [
    "A valid mapped merchant enriches the draft without changing account, amount or confirmation behavior.",
    "Missing/invalid mappings keep deterministic NLP fallback and preserve manual selections."
  ],
  "scope": [
    "src/lib/nlp/speechExpense.ts",
    "src/lib/merchantMatch.ts",
    "src/components/expense/DraftTransactionsDialog.tsx",
    "src/components/expense/DraftsDrawer.tsx"
  ],
  "steps": [
    "Trace parseSpeechExpense into the live voice draft creation/review consumer; identify where authorized mappings and selected-account categories are already available.",
    "Apply matchMerchantMapping plus resolveCategoryRef at that boundary; keep parser logic pure by passing data rather than fetching during parsing.",
    "Use explicit user category edits first, a resolvable merchant suggestion next, then the existing NLP fallback; record and test this precedence before sharing it with BUD-2.",
    "Verify a suggested draft can still be edited and discarded, and that confirming uses the existing one-time money path."
  ],
  "invariants": [
    "Suggestion never posts money.",
    "A mapping cannot redirect the selected account.",
    "Cross-user category references resolve through existing identity rules."
  ],
  "exclusions": [
    "New merchant learning.",
    "Draft confirmation atomicity.",
    "Replacing the NLP parser or adding Gemini calls."
  ],
  "checks": [],
  "risks": [
    "A mapping can point to a category outside the selected account.",
    "Reapplying suggestions on render can overwrite the user's edit."
  ],
  "unknowns": [
    "Exact draft-creation consumer must be pinned before widening the listed candidate scope."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: merchant helper, speech parser export and live draft paths verified; accepted mapping outcome retained."
}
```

### BUD-2

**Outcome:** Apply merchant mappings to Hub transaction conversion.

- **Acceptance:** Merchant-match → Hub Budget Chat "Add as Transaction" — when converting a chat message to a transaction (Message Actions), run the text through the merchant map to pre-select Category/Subcategory in the action sheet. Junction work — coordinate with [Hub & ERA · 4 · Checklist](<../Hub & ERA/4 - Checklist.md>) (HUB-10).
- Absorbs HUB-10: Merchant-match in "Add as Transaction". BUD-2 is the surviving owner; the historical "still Later" wording was superseded by the canonical checklist's Next lane.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Reuse `matchMerchantMapping()` from `src/lib/merchantMatch.ts` at `src/components/hub/AddTransactionFromMessageModal.tsx`, with source-message linkage in `src/features/hub/messageActions.ts`. Read the Hub Chat and Message Actions vault docs before this junction change. Share suggestion precedence with BUD-1 and leave the human to confirm. HUB-10 was absorbed here; do not recreate its queue entry.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; junction work owned by BUD-2. HUB-10 is a retired alias, not another pending dependency.

**Verify:** `pnpm exec vitest run src/lib/merchantMatch.test.ts`; add proposed AddTransactionFromMessageModal/message-action fixture for known merchant, unknown merchant, account change, manual override and cancelled conversion. Confirm creates one existing message-action link.

```delivery-plan-v1
{
  "outcome": "Hub Add as Transaction opens with a valid merchant category suggestion ready to confirm.",
  "acceptance": [
    "The conversion sheet preselects category/subcategory without changing money or creating a record until confirmation.",
    "Manual edits survive asynchronous mapping/category loads."
  ],
  "scope": [
    "src/components/hub/AddTransactionFromMessageModal.tsx",
    "src/features/hub/messageActions.ts",
    "src/lib/merchantMatch.ts"
  ],
  "steps": [
    "Read the Message Actions and Hub contracts, then follow the current conversion sheet's parse and account/category loading sequence.",
    "Reuse the BUD-1 merchant suggestion precedence and matchMerchantMapping/resolveCategoryRef; put cross-module logic in the shared helper, not a standalone-to-standalone import.",
    "Apply the suggestion once to eligible unedited fields; recompute safely on explicit account change and keep invalid mappings as no suggestion.",
    "Verify confirm/cancel/Undo still use the existing message-action linkage and transaction writer; keep BUD-2 as the only checklist owner."
  ],
  "invariants": [
    "Human confirmation remains the write gate.",
    "No learned mapping redirects the account.",
    "One conversion keeps one source-message lineage."
  ],
  "exclusions": [
    "Recreating HUB-10.",
    "Bulk convert redesign.",
    "New merchant learning or alternate transaction writer."
  ],
  "checks": [],
  "risks": [
    "Async mapping results can overwrite selections or suggest a category from another account."
  ],
  "unknowns": [
    "Current modal initialization semantics require a focused read before implementation."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: Feature Map, Message Actions/Hub vault and BUD-2↔HUB-10 reconciliation reviewed; no runtime conversion performed."
}
```

### BUD-26

**Outcome:** Add a read-only statement audit mode.

- **Acceptance:** Reconcile-only ("audit") mode for statement import — a run that matches parsed rows against already-logged transactions and **creates nothing**: no `create` entries, no balance deltas, no merchant learning writes, only a verdict per row. The matcher (`/api/statement-import/reconcile`) is already balance-neutral; what's missing is a session mode that stops before commit and a result surface that reads as a report instead of a work queue. Mode must be chosen at upload and be visible on the review screen, so an audit run can never be mistaken for an insert run. → `src/features/statement-import/sessionModel.ts` + `src/app/statement-import/page.tsx`
- **Depends on:** [BUD-66](<Budget — Master Book.md#bud-66>).

- **Acceptance:** an audit-mode statement run produces a per-row verdict and, on completion, `statement_import_entries` gained **zero** rows, no `balance_deltas` were written and no merchant mapping was learned — provable by comparing account balances before/after; the mode is visible on the review screen at all times.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The matcher is already balance-neutral — `src/app/api/statement-import/reconcile/route.ts` over `src/lib/statement-reconcile.ts` — so the work is a **session mode** that stops before commit and a result surface that reads as a report. Mode belongs in `src/features/statement-import/sessionModel.ts` (`Bucket`, `getBucket`, `RowDecision` are the existing vocabulary) and must be chosen at upload and visible on the review screen at all times, per the acceptance. The three things that must not happen are each a separate call site: `src/app/api/statement-import/commit/route.ts` (no `statement_import_entries` rows), the balance writes it triggers (`balance_deltas`), and merchant learning (`src/lib/merchantMatch.ts` write path). Prove it by comparing account balances before and after. Page: `src/app/statement-import/page.tsx`. Depends on BUD-66; feeds BUD-27, BUD-28 and TRIP-28.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft after BUD-66. Audit mode must have an explicit no-write boundary, including resumed sessions.

**Verify:** `pnpm exec vitest run src/features/statement-import/sessionModel.test.ts src/app/api/statement-import/reconcile/route.test.ts`; add proposed audit-mode UI/hook tests asserting zero commit/learning calls on upload, resume, confirm and finish. Use mocked writes; production counters are owner UAT.

```delivery-plan-v1
{
  "outcome": "A statement can be audited as a report without importing transactions or learning mappings.",
  "acceptance": [
    "Mode is chosen at upload, remains visible and survives session persistence.",
    "Every audit action stays balance/ledger/merchant-write neutral."
  ],
  "scope": [
    "src/features/statement-import/sessionModel.ts",
    "src/lib/statementImportSession.ts",
    "src/app/statement-import/page.tsx",
    "src/features/statement-import/hooks.ts",
    "src/features/statement-import/sessionModel.test.ts"
  ],
  "steps": [
    "After canonical money facts are available, define an explicit session mode with backward-compatible resume behavior; old entry sessions must not silently become audits.",
    "Select the mode at upload and expose its terse label during review; route audit results through existing reconciliation classifications.",
    "Guard every path that can build/submit commit actions or learn mappings, including keyboard/resume/Ready controls; finishing an audit produces only its report.",
    "Prove zero domain writes for matched, unmatched, transfer, probable and repeated audit runs; retain normal entry-mode tests."
  ],
  "invariants": [
    "Audit never writes statement_import_entries, balances or merchant mappings.",
    "Reconciliation verdicts are not import actions."
  ],
  "exclusions": [
    "Trip matching.",
    "New financial formulas.",
    "Writing audit-pair resolution into transaction rows."
  ],
  "checks": [],
  "risks": [
    "A hidden Save shortcut or persisted entry decision can cross the mode boundary.",
    "Existing code assumes every session is eventually committed."
  ],
  "unknowns": [
    "Exact existing-session version/default must be verified before altering persisted shape."
  ],
  "dependencies": [
    "BUD-66"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: session/reconcile entry points and accepted audit contract inspected; persistence and UI require focused implementation read."
}
```

### BUD-27

**Outcome:** Match trip transactions across FX and accounts.

- **Acceptance:** Trip-aware matching — the current matcher is single-account, single-currency, −7/+1 days, tolerance `max($1, 10%)` (`AMOUNT_TOLERANCE_MIN`/`_PCT`), which is right for Lebanon and wrong abroad on three counts: (1) **FX** — the bank posts a converted amount in the card's currency while the manual log is in the trip currency, so raw amount comparison fails outright; compare via an **implied rate** (`statement_amount / logged_amount`) clustered across the trip, accept rows near the cluster median and flag the outliers, instead of widening the flat tolerance; (2) **posting lag** — foreign settlement plus weekends routinely exceeds 7 days, so the window needs a trip profile; (3) **account scope** — candidates are hard-filtered to the statement's `account_id`, but trip spend may be logged against the trip account created by `activate_trip` (in the trip's currency), so the candidate pool must span the card account **and** the trip's account. → `src/lib/statement-reconcile.ts`
- **Depends on:** [BUD-26](<Budget — Master Book.md#bud-26>).

- **Acceptance:** a foreign-currency trip statement matches the manually logged trip transactions without widening `AMOUNT_TOLERANCE_PCT` — matching succeeds through an implied-rate cluster, spans both the card account and `trips.account_id`, and a unit test in `src/lib/statement-reconcile.test.ts` covers a worked EUR-logged / USD-posted example plus a rate-outlier that must be flagged, not silently matched.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The acceptance already contains the design; the code it names is real. `src/lib/statement-reconcile.ts` holds all three limits as exported constants — `MATCH_WINDOW_BACK_DAYS` (7) / `MATCH_WINDOW_FORWARD_DAYS` (1), `AMOUNT_TOLERANCE_MIN` (1) / `AMOUNT_TOLERANCE_PCT` (0.1) / `AMOUNT_EPSILON`, and a candidate pool hard-filtered to the statement's account (`CandidateTx`, `MatchCandidate`, `RowClassification`). The instruction is explicitly *not* to widen `AMOUNT_TOLERANCE_PCT`: cluster implied rates (`statement_amount / logged_amount`) across the trip and flag outliers. The second account is `trips.account_id`, created by `activate_trip` (see TRIP-1) and reachable via `src/lib/tripAccess.ts`. Currency conversion helper: `toUsd()` in `src/lib/balance-utils.ts` — and never sum currencies (BUD-76). The named test file `src/lib/statement-reconcile.test.ts` exists; add the worked EUR/USD case and the rate outlier there. `.claude/skills/money-rules/SKILL.md` is mandatory.

**Execution plan — 2026-09-26**

**Readiness:** Split first after BUD-26; resolve trip profile/FX evidence before enabling automatic matches.

**Verify:** `pnpm exec vitest run src/lib/statement-reconcile.test.ts src/app/api/statement-import/reconcile/route.test.ts` — worked EUR-log/USD-statement cluster, explicit rate outlier, weekend posting lag, two similar charges and unauthorized trip account. Tolerance constants remain unchanged.

```delivery-plan-v1
{
  "outcome": "Trip audits match authorized card and trip-account transactions using defensible FX evidence.",
  "acceptance": [
    "Implied-rate clustering explains supported cross-currency matches and flags outliers.",
    "A transaction can satisfy only one statement row; domestic matching stays unchanged."
  ],
  "scope": [
    "src/lib/statement-reconcile.ts",
    "src/lib/statement-reconcile.test.ts",
    "src/app/api/statement-import/reconcile/route.ts",
    "src/app/api/statement-import/reconcile/route.test.ts"
  ],
  "steps": [
    "Read the selected trip/account authorization and currency provenance; define the allowed two-account candidate scope and explicit trip posting-window profile.",
    "Create a pure FX candidate/scoring fixture: comparable currency pairs, sufficient cluster evidence, median distance and explicit ambiguous/outlier results.",
    "Integrate that trip profile at the existing matcher boundary while preserving exact fingerprints and one-to-one claiming; never globally widen AMOUNT_TOLERANCE_PCT.",
    "Wire the authorized trip context through audit reconciliation and verify the read-only mode still cannot create/stamp/learn anything."
  ],
  "invariants": [
    "Raw amounts in different currencies are never directly compared.",
    "Weak FX evidence stays ambiguous.",
    "No cross-household candidate expansion."
  ],
  "exclusions": [
    "General currency-policy redesign.",
    "Automatic transaction rewriting.",
    "Guessing a rate from one convenient pair."
  ],
  "checks": [],
  "risks": [
    "A sparse or mixed-currency trip can create a misleading cluster.",
    "Longer date windows increase plausible false matches."
  ],
  "unknowns": [
    "Accepted minimum cluster evidence, outlier threshold and trip posting-window values; settle with owner examples first."
  ],
  "dependencies": [
    "BUD-26"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: matcher constants/candidate route and accepted trip contract reviewed; algorithm thresholds remain an explicit decision."
}
```

### BUD-28

**Outcome:** Report reconciliation exceptions in both directions.

- **Acceptance:** Reconciliation exception report — the output of an audit run, ranked, in **both** directions: statement rows with no logged transaction (a tap never logged) and logged transactions with no statement row (double-logged, cash-not-card, or not yet posted). Lead with the arithmetic that triggers the whole exercise — total statement vs total logged for the period, with the gap stated in one number — then the ranked exceptions, `probable`/`ambiguous` pairs first with a one-tap confirm/reject that resolves the pair without inserting anything. Small gaps within tolerance close silently; a large gap (owner's threshold ~$100) is the alert. → `src/components/statement-import/`
- **Depends on:** [BUD-27](<Budget — Master Book.md#bud-27>).

- **Acceptance:** the report opens with total statement vs total logged and one gap number, then lists exceptions in both directions (statement row with no log, logged transaction with no statement row); confirming or rejecting a `probable`/`ambiguous` pair resolves it and still writes no transaction.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The report surface for BUD-26's audit run; depends on BUD-27's matching. Data comes from `ReconcileSummary` and `RowClassification` in `src/lib/statement-reconcile.ts` — the `probable`/`ambiguous` statuses are already in `RowStatus`, so the ranking is a presentation of existing verdicts, not new matching. Both directions means you also need logged transactions with no statement row, which the current row-driven shape may not produce — check before designing. Components go in `src/components/statement-import/` with session state in `src/features/statement-import/sessionModel.ts`. Confirm/reject must resolve a pair and still write no transaction — that is BUD-26's invariant, so route it through the same audit-mode guard. Hard Rules #3 (no red on individual rows; the gap header may) and #28 (the gap is one number, not a paragraph). TRIP-28 consumes this scoped to a trip.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft after BUD-27; confirm the gap threshold and amount basis before presenting a ranked report.

**Verify:** `pnpm exec vitest run src/features/statement-import/sessionModel.test.ts src/lib/statement-reconcile.test.ts`; add proposed report tests for both unmatched directions, confirmed/rejected pairs, small/large gap and mixed currencies. All report interactions assert zero transaction writes.

```delivery-plan-v1
{
  "outcome": "Audit reports show one comparable money gap and the exceptions that explain it in both directions.",
  "acceptance": [
    "Statement-only and logged-only rows are independently visible, with probable/ambiguous pairs first.",
    "Confirm/reject resolves report pairing without inserting or updating money."
  ],
  "scope": [
    "src/features/statement-import/sessionModel.ts",
    "src/app/statement-import/page.tsx",
    "src/lib/statement-reconcile.ts",
    "src/features/statement-import/sessionModel.test.ts"
  ],
  "steps": [
    "Extend the audit result with unmatched logged candidates as well as statement rows; preserve their account/currency/provenance and one-to-one pairing identity.",
    "Compute statement/logged totals only for the same supported period and currency basis; unavailable comparisons cannot become a numeric gap.",
    "Add the compact totals/gap header and ranked exception report in a proposed named src/components/statement-import component, declaring that scope before dispatch.",
    "Keep pair confirm/reject in audit review state and verify completion still invokes no commit/learning mutation; test mobile reading order and concise labels."
  ],
  "invariants": [
    "No mixed-currency sum.",
    "Resolving a report pair creates no transaction.",
    "Small tolerated differences never silently erase genuine unmatched rows."
  ],
  "exclusions": [
    "Changing the matcher thresholds.",
    "Persistent money correction.",
    "Adding explanatory banners."
  ],
  "checks": [],
  "risks": [
    "A row-driven API can omit logged-only evidence.",
    "An approximate $100 preference is not a final threshold contract."
  ],
  "unknowns": [
    "Exact alert threshold and comparable totals policy for cross-currency trip reports."
  ],
  "dependencies": [
    "BUD-27"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: accepted report/audit contracts and existing matcher/session types reviewed; final report component is proposed."
}
```

### BUD-63

**Outcome:** Commit balance and history atomically.

- **Acceptance:** Concurrent balance deltas and required history commit atomically at the shared boundary; current owner DB evidence precedes the manual migration.

**Retained contract — ASTRA-BUD-1:**

- **Outcome:** Concurrent accepted balance deltas both count, and an unsuccessful update cannot be reported as applied.
- **Boundary:** Keep adjustAccountBalance's public role, but use a transaction-local SQL increment with returned before/after balances and atomic required history. Service-role-only callable helper; no freely callable authenticated arbitrary-account adjustment. It can also be invoked inside later authenticated domain functions in the same DB transaction. Missing-row creation is authorized from the account's actual owner, not empty metadata; serialize that race too. Fail on write/history errors. No event-date/checkpoint/direction changes, automatic repair, retry enrollment or new application ledger.
- **Money/schedule math?:** Yes, Invariants1/3/8: 100 plus concurrent−10/−20 →70, history 100→90→70 or100→80→70. Forced history failure → entire individual increment rolls back. Checkpoint unchanged; +20 inverse restores90 after−10/−20/+20. Primitive adds supplied deltas without inferring account type.
- **Gate:** `pnpm exec vitest run src/lib/balance.test.ts --reporter=verbose` → nonzero wrapper/error cases pass. Owner isolated SQL outputs prove concurrent update, absent-row race, unauthorized invocation refusal and history rollback. Common gates pass. Inspect callers for error handling; if any needs an edit, S1 requires a new scoped sheet, not widening this one.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The shared-boundary item that BUD-64, BUD-65 and BUD-71 all wait on: a balance delta and its required history row must commit together, and a failed update must not be reported as applied. Read `src/lib/balance-utils.ts` (`getBalanceDelta`, `getTransferDeltas`) for what a delta is, then the writers — `src/app/api/transactions/route.ts`, `transactions/[id]/route.ts`, `src/app/api/statement-import/commit/route.ts` — for the current sequential PostgREST pattern that cannot be atomic. The fix is a SECURITY DEFINER RPC (`.claude/skills/db-migration/SKILL.md`, Hard Rule #20 for why not a child-table policy; Hard Rules #24/#26 — migration file, then `schema.sql`, then hand it to the owner). "Concurrent accepted deltas both count" means row locking, not read-modify-write. Owner DB evidence precedes the migration. `.claude/skills/money-rules/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** Owner DB evidence and bounded implementation draft. Inspect current function/trigger/grant state before authoring the manual migration.

**Verify:** `pnpm exec vitest run src/lib/balance.test.ts src/lib/balance-utils.test.ts`; isolated SQL witness: 100−10−20=70 concurrently, one serial history chain, absent-row race, history failure rollback and denied arbitrary-account invocation. Production application is owner-only.

```delivery-plan-v1
{
  "outcome": "The balance choke point atomically applies a supplied delta and its required history.",
  "acceptance": [
    "Concurrent successful deltas both count; failed balance/history operations are reported as failures.",
    "No unauthorized client can invoke an arbitrary-account balance adjustment."
  ],
  "scope": [
    "src/lib/balance.ts",
    "src/lib/balance.test.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read current owner DB evidence and adjustAccountBalance callers; inventory return/error assumptions without editing callers in this slice.",
    "Write a proposed dated migration for the restricted transaction-local increment/history function, with account-owner validation and serialized missing-row initialization; then update schema.sql end state.",
    "Delegate the existing wrapper to that function, return actual before/after values, and propagate errors; preserve zero-delta, direction and checkpoint behavior.",
    "Run wrapper fixtures and isolated concurrency/rollback/grant checks. Hand the migration to the owner and keep applied/runtime status separate from local implementation."
  ],
  "invariants": [
    "Delta sign is supplied by canonical domain callers, not re-inferred by the primitive.",
    "Automatic writes never move balance_set_at.",
    "Required history and balance commit together."
  ],
  "exclusions": [
    "New application ledger.",
    "Automatic repair.",
    "Widening into draft/import/restore domain transactions."
  ],
  "checks": [],
  "risks": [
    "SECURITY DEFINER grants can expose arbitrary account mutation.",
    "Read-modify-write or unprotected absent-row creation reintroduces lost updates."
  ],
  "unknowns": [
    "Current DB functions/triggers/grants and caller error handling; new migration filename requires the execution date."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: retained ASTRA-BUD-1, balance/schema paths and tests reviewed; no current DB concurrency or grant witness."
}
```

### BUD-68

**Outcome:** Keep debt reads free of mutations.

- **Acceptance:** Reproduce the documented unpaid-debt autoarchive on GET and remove the write from retrieval. Explicit paid/archive/overdue transitions remain distinct; verify account effects and repeated reads.

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Verified 2026-09-20 and it is exactly as documented: `src/app/api/debts/route.ts` **GET** runs an `.update({ status: "archived", archived_at: ... })` before its select — a write inside a read. Remove it and give archiving an explicit transition; the deliberate ones to keep distinct are paid, archived and overdue (see the `status` query parameter the same handler already accepts, and `src/app/api/debts/[id]/` plus `debts/standalone/`). Check account effects: settling a debt moves money (`src/features/debts/`, `src/components/expense/DebtSettlementModal.tsx`), so verify that removing the auto-archive does not strand a balance change — `.claude/skills/money-rules/SKILL.md`. Repeated reads must be stable, which is the point of the fix.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; current debt GET write confirmed. Keep scope on removing retrieval side effects.

**Verify:** Add proposed debt-route tests asserting zero insert/update/delete calls on repeated GET for unpaid overdue, paid, archived and filtered results. `pnpm exec vitest run src/lib/balance-utils.test.ts` remains the money regression baseline; inspect existing settlement coverage before adding cases.

```delivery-plan-v1
{
  "outcome": "Reading debts never changes their status, timestamps or account effects.",
  "acceptance": [
    "Repeated GET leaves unpaid overdue debts unchanged.",
    "Explicit paid/archive/overdue behavior remains distinct and settlement money stays exactly once."
  ],
  "scope": [
    "src/app/api/debts/route.ts"
  ],
  "steps": [
    "Pin the current pre-select autoarchive update with a failing GET fixture; inventory explicit archive/settlement routes before changing their behavior.",
    "Remove only the write from GET and keep authorized household/filter handling intact.",
    "Verify that existing explicit transitions remain reachable; if one is missing, propose its bounded route/UI scope rather than silently replacing autoarchive with another hidden write.",
    "Check repeated refresh and settlement/Undo with worked before/after balances, and record any already-archived historical rows as a separate owner repair question."
  ],
  "invariants": [
    "GET is side-effect-free.",
    "Overdue does not mean paid or archived.",
    "No automatic historical unarchive."
  ],
  "exclusions": [
    "Debt currency redesign.",
    "Changing settlement amounts.",
    "Repairing existing archived debt data."
  ],
  "checks": [],
  "risks": [
    "The old write may have hidden unpaid debts from the normal list.",
    "Deleting it can reveal legitimate overdue work that the UI must still render."
  ],
  "unknowns": [
    "Whether current explicit archive controls cover every intended transition; verify before adding new UI."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: debts GET update at lines 27–29 confirmed; explicit transition and UI coverage remain implementation checks."
}
```

### BUD-69

**Outcome:** Make future-purchase analysis financially truthful.

- **Acceptance:** Separate currencies, report failed/partial reads and replace the unsupported 55–70 percent single-month allocation assumption with an agreed affordability contract. No recommendation from incomplete balances; preserve provenance and worked allocation examples.
- **Depends on:** [BUD-66](<Budget — Master Book.md#bud-66>).

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on BUD-66. The unsupported assumption is a literal constant: `const frontLoadPercentage = 0.55;` in `src/app/api/future-purchases/[id]/analysis/route.ts`, feeding an `affordableMonths` calculation and a recommendation string a few lines below. Replace it with an agreed affordability contract rather than a different magic number. "Separate currencies" means never summing across them (`toUsd()` in `src/lib/balance-utils.ts`, and BUD-76's held decision); "report failed/partial reads" is the same unavailable-vs-zero rule as HLTH-21 and KIT-4 — an incomplete balance read must suppress the recommendation, not quietly lower it. Client: `src/features/future-purchases/hooks.ts`. Worked allocation examples and a test are required by `.claude/skills/money-rules/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** Decision held after BUD-66: affordability inputs, reserve/commitment treatment and multi-period allocation need an agreed contract.

**Verify:** Add proposed analysis-route fixtures for failed/partial balances, separate currencies, no recommendation on unknown funds, and owner-agreed allocations. `pnpm exec vitest run src/lib/balance-utils.test.ts src/lib/utils/incomeExpense.test.ts` protects canonical money math.

```delivery-plan-v1
{
  "outcome": "Future-purchase advice states supported financial facts and recommends only from a complete agreed affordability model.",
  "acceptance": [
    "Incomplete or incomparable balances suppress recommendations.",
    "The 55/60/70-percent allocation heuristics are replaced only by an accepted worked contract."
  ],
  "scope": [
    "src/app/api/future-purchases/[id]/analysis/route.ts",
    "src/features/future-purchases/hooks.ts",
    "src/components/web/WebFuturePurchases.tsx"
  ],
  "steps": [
    "Use BUD-66 facts to enumerate known/unknown balances, currencies, recurring commitments and periods; separate read failure from a true zero.",
    "Prepare two small owner examples showing available funds, protected reserves/commitments, target date and remaining amount; agree how allocation is calculated before implementation.",
    "Replace the route's fixed front-load percentages with that deterministic contract and carry currency/provenance/completeness to the client.",
    "Verify recommendation suppression and an editable truthful display; AI wording may explain the result but cannot invent the arithmetic."
  ],
  "invariants": [
    "No mixed-currency sum or invented rate.",
    "Unknown funds never imply affordability.",
    "Suggestions move no money."
  ],
  "exclusions": [
    "Full BUD-4 forecast.",
    "Changing target progress automatically.",
    "Choosing a different unexplained percentage."
  ],
  "checks": [],
  "risks": [
    "A polished recommendation can conceal missing accounts or currency mismatch."
  ],
  "unknowns": [
    "Owner-approved affordability/reserve contract and supported comparison currencies."
  ],
  "dependencies": [
    "BUD-66"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: source percentages 0.55/0.6/0.7 and analysis/client entry paths verified; policy intentionally unresolved."
}
```

### BUD-70

**Outcome:** Match commitments exclusively with account provenance.

- **Acceptance:** One transaction may satisfy at most the intended commitment; match account, currency, ownership and selected transaction provenance. Verify tolerance/duplicate cases with worked examples; do not broaden matching by convenience.

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** "At most the intended commitment" is an exclusivity invariant: one transaction may not satisfy two commitments, and matching must not be broadened for convenience. The four dimensions to check are account, currency, ownership and the selected transaction's provenance — account/currency from `src/lib/balance-utils.ts` and the account row, ownership from the `household_links` pattern (Hard Rule #13, `src/app/api/accounts/route.ts`), provenance from whether the row came from statement import or manual entry (`src/lib/statement-reconcile.ts`). The commitment side is `src/features/recurring/` and `src/app/api/recurring/`; note `.claude/skills/recurrence-safety/SKILL.md` — recurring *payments* are a different engine from item recurrence. Tolerance and duplicate cases need worked examples (`.claude/skills/money-rules/SKILL.md`).

**Execution plan — 2026-09-26**

**Readiness:** Investigation and split first; distinguish advisory matching from durable exclusive coverage before selecting a DB change.

**Verify:** `pnpm exec vitest run src/features/recurring/commitments.test.ts src/app/api/recurring-payments/[id]/mark-covered/route.test.ts`; cases: same20 transaction offered to two commitments, wrong account/currency/owner, deleted/draft candidate, tolerance edge, concurrent mark-covered and replay.

```delivery-plan-v1
{
  "outcome": "A recurring payment is covered only by the intended authorized transaction, without reusing it for another commitment.",
  "acceptance": [
    "Candidate and selected-transaction provenance are validated again at the write boundary.",
    "Covering changes due-state once and never creates new spend."
  ],
  "scope": [
    "src/features/recurring/commitments.ts",
    "src/features/recurring/commitments.test.ts",
    "src/app/api/recurring-payments/[id]/mark-covered/route.ts",
    "src/app/api/recurring-payments/[id]/mark-covered/route.test.ts"
  ],
  "steps": [
    "Inventory current matching scores and mark-covered validation, including whether transaction identity is persisted or only a date advances.",
    "Define one worked account/currency/owner/provenance contract for candidate eligibility and server validation; never rely on the UI's suggested pair.",
    "If durable exclusive identity is absent, obtain current DB evidence and split a checked claim/unique-constraint migration from matcher UI changes; preserve existing rows rather than inventing historical links.",
    "Verify retry/concurrency, payment-period advancement and Undo. Reusing a selected transaction must return a truthful conflict rather than cover another commitment."
  ],
  "invariants": [
    "One transaction covers at most the intended commitment.",
    "Mark-covered creates zero spend.",
    "Payment recurrence remains separate from Schedule recurrence."
  ],
  "exclusions": [
    "Broad tolerance widening.",
    "Auto-covering unmatched payments.",
    "Historical provenance backfill by guess."
  ],
  "checks": [],
  "risks": [
    "A score bonus for matching account is weaker than an eligibility gate.",
    "Date-only coverage cannot enforce transaction exclusivity."
  ],
  "unknowns": [
    "Existing durable coverage identity and current DB constraints."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: commitments and mark-covered entry points/schema reviewed; complete exclusivity audit remains the first execution step."
}
```

### BUD-74

**Outcome:** Cover core money route contracts.

- **Acceptance:** Reverify current accounts/transactions tests, then cover authentication, household/ownOnly visibility, Zod rejection, duplicate409 and money invariants where missing. Stale audit route/test counts are not a current baseline.

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Re-inventory first; the acceptance says stale route/test counts are not a baseline. The canonical correct route is `src/app/api/accounts/route.ts` — auth → Zod → `household_links` expansion honouring `ownOnly` → DB → `23505` mapped to 409 — and `.claude/skills/api-route/SKILL.md` has the template. The money routes to cover are `src/app/api/transactions/` (+ `[id]/`, `split-bill/`), `accounts/`, `transfers/`, `recurring/`, `debts/`, `budget-allocations/` and `statement-import/`. Four axes: authentication, household/`ownOnly` visibility, Zod rejection (Hard Rule #12 — several money routes may have none; check before assuming), duplicate → 409 (Hard Rule #9), and money invariants from `src/lib/balance-utils.ts`. PM Tooling R46 is building the lint that finds the Zod gaps.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first, then bounded test slices. Do not turn this into a rewrite of every money route.

**Verify:** Inventory with `rg --files src/app/api tests` and map existing route tests to auth, household/ownOnly, validation, duplicate409 and money cases. Run each selected test file explicitly with `pnpm exec vitest run`; require nonzero executed cases.

```delivery-plan-v1
{
  "outcome": "Core money route contracts have current, meaningful tests with identified gaps and owners.",
  "acceptance": [
    "Coverage records actual tested behavior, not stale route/test counts.",
    "Negative paths assert zero unauthorized or invalid money writes."
  ],
  "scope": [],
  "steps": [
    "Re-inventory accounts, transactions, transfers, recurring-payments, debts, allocations and import tests; produce a short per-route gap table under this item.",
    "Prioritize the shared accounts/transactions contract and add tests in explicitly named existing or proposed files before widening to other route families.",
    "Cover unauthenticated requests, owner/partner/ownOnly scope, Zod failures, duplicate23505→409 and concrete balance/history invariants.",
    "When a test proves a product defect, give it a bounded implementation scope under the owning item; preserve failure evidence rather than weakening the assertion."
  ],
  "invariants": [
    "Mocks prove application contracts, not live RLS state.",
    "Tests fail for the wrong behavior rather than mirror implementation structure.",
    "No production money mutation in test setup."
  ],
  "exclusions": [
    "Blanket route cleanup.",
    "Invented coverage percentages.",
    "Treating mocks as deployment acceptance."
  ],
  "checks": [],
  "risks": [
    "Permissive DB mocks can make invalid writes appear harmless.",
    "Expanding all route families in one session obscures the actual defect."
  ],
  "unknowns": [
    "Current full coverage inventory and exact first missing test files."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: existing money test paths verified; full route-test inventory deliberately remains executable investigation."
}
```

### BUD-64

**Outcome:** Confirm transaction drafts exactly once.

- **Acceptance:** Draft confirmation commits status and money exactly once or neither; depends on BUD-63 applied and tested.
- **Depends on:** [BUD-63](<Budget — Master Book.md#bud-63>).

**Retained contract — ASTRA-BUD-2:**

- **Outcome:** Confirming a draft changes its status and account balance exactly once, or changes neither.
- **Boundary:** Zod-validate finite amount, IDs and date under the existing signed-amount contract; do not silently prohibit refunds while repairing atomicity. Resolve any ambiguous zero/refund policy under S8. Verify category/account/owner before effects. Authenticated SQL function locks the same nondeleted draft, checks destination access, changes its existing row, applies canonical account-type delta and history in one transaction via BUD-1's primitive. No fallback account type. Preserve repeat result only for the same confirmed payload/identity; altered replay is 409, cross-owner replay refused. Never re-read an already-confirmed row and apply money again. No new queue capability.
- **Money/schedule math?:** Yes, Invariants1/3/5: expense stored100, draft20 → display80; confirm → stored80, draft reservation0, display80. Retry →80. Inject history failure → stored100 and draft retained. Income stored100 confirming20 →120. Deleted draft cannot confirm; changed destination/category cannot escape authorization.
- **Gate:** `pnpm exec vitest run tests/draft-confirmation.test.ts src/lib/balance-utils.test.ts --reporter=verbose` → nonzero route/payload/direction cases pass; owner SQL proves concurrent confirm, lost-response repeat, conflict payload and rollback. Common gates; owner two-frame confirmation shows stable display80 and one history effect.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (rechecked 2026-09-26):** The live confirmation path is `useConfirmDraft` in `src/features/drafts/useDrafts.ts` → PATCH `src/app/api/drafts/[id]/route.ts`. It updates the existing `transactions` row from `is_draft: true` to false, then separately calls `adjustAccountBalance`; it does not delete a separate draft row and insert a new transaction. Depend on BUD-63's applied/tested primitive and preserve the draft ID. The status change, authorized account/category selection, delta and required history must commit together; same-input retry returns the original outcome and changed replay conflicts. Read money-rules before implementation.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; local code/fixture preparation can target BUD-63's stable tested contract. Integration and rollout still require the accepted owner-applied/tested BUD-63 evidence.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts src/lib/balance.test.ts`; retained `tests/draft-confirmation.test.ts` is a proposed new route test. Isolated DB tests cover concurrent confirm, lost response, altered replay, deleted draft and history failure.

```delivery-plan-v1
{
  "outcome": "Confirming a transaction draft changes its existing row and money exactly once, or changes neither.",
  "acceptance": [
    "The accepted signed-amount/account contract is validated before any effect.",
    "Same-identity retry returns the original result; changed replay conflicts and rollback retains the draft."
  ],
  "scope": [
    "src/app/api/drafts/[id]/route.ts",
    "src/features/drafts/useDrafts.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Follow useConfirmDraft to PATCH /api/drafts/[id], which updates transactions.is_draft on the same row; inventory payload, ownership and UI response assumptions.",
    "Add Zod validation and authorized account/category resolution without an expense-type fallback; resolve ambiguous zero/refund policy before altering it.",
    "Prepare a proposed dated migration that locks the draft, confirms it and calls BUD-63's balance/history primitive in one transaction, with idempotent outcome identity.",
    "Update the route/hook boundary and test expense100/draft20: display80 before and after confirmation; retry stays80; forced failure retains stored100 and draft. Owner applies SQL separately."
  ],
  "invariants": [
    "One existing transaction ID survives confirmation.",
    "No second balance effect or draft reservation after success.",
    "No automatic checkpoint change."
  ],
  "exclusions": [
    "New draft table or queue.",
    "Income available-balance policy BUD-75.",
    "Historical money repair."
  ],
  "checks": [],
  "risks": [
    "The current update and balance call can partly commit.",
    "UI retries after a lost response must not apply the delta again."
  ],
  "unknowns": [
    "Current DB primitive/application evidence and exact repeat/conflict response contract."
  ],
  "dependencies": [
    "BUD-63"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: actual drafts PATCH and canonical balance helper read; retained ASTRA-BUD-2 remains binding. No DB execution."
}
```

### BUD-65

**Outcome:** Commit imported rows and balance effects atomically.

- **Acceptance:** The import create branch commits its transaction, inverse evidence and balance effect together; depends on BUD-63 and current import contracts.
- **Depends on:** [BUD-63](<Budget — Master Book.md#bud-63>).

**Retained contract — ASTRA-BUD-3:**

- **Outcome:** A newly imported transaction, its rollback entry and its balance effect are committed together.
- **Boundary:** Only the create-action branch: one authenticated SQL operation owns transaction insert, per-row import ledger and BUD-1 delta/history. Verify batch ownership and category/account; lock/unique identity prevents repeated effect. Already occupied fingerprint returns existing classification without moving money. Remove this branch's amount from the route's later balance application and do not re-upsert its ledger as a new effect. Receipt may still summarize its delta; receipt data must not drive a second application. Keep other branches untouched and document their remaining partial-write risks. If required endpoint changes exceed one session, stop and split before edits.
- **Money/schedule math?:** Yes: expense100, create20 →80 and one transaction+ledger/history; failure at any of those three writes →100 and no new transaction/ledger/history. Repeat same statement identity →80. Refund20 →120. Mixed create+stamp fixture proves create is not applied again in the final accumulated delta.
- **Gate:** `pnpm exec vitest run src/app/api/statement-import/commit/route.test.ts src/lib/statement-revert.test.ts --reporter=verbose` → nonzero tests pass. Replace the permissive ledger-failure assertion for create with zero domain writes. Owner SQL supplies rollback/concurrency evidence and create→revert inverse100→80→100; common gates. Other branches are labeled unverified, never implied fixed.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on BUD-63. Three things must commit together on the import create branch: the transaction row, its inverse/rollback evidence, and the balance effect. The branch is in `src/app/api/statement-import/commit/route.ts`, with the inverse consumed by `src/app/api/statement-import/imports/[id]/revert/route.ts` — read the revert path first, because it defines what evidence the create branch owes it. BUD-71 extends this to the confirm/stamp/rekey/transfer branches, so build the boundary so those can reuse it. `.claude/skills/money-rules/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; execute only the create-action branch after BUD-63, with current import contracts.

**Verify:** `pnpm exec vitest run src/app/api/statement-import/commit/route.test.ts src/lib/statement-revert.test.ts`; isolated transaction failure/concurrency witness, plus create20→revert restoring100. Mixed create+stamp must not apply create twice.

```delivery-plan-v1
{
  "outcome": "One imported create commits its transaction, inverse evidence and balance/history effect together.",
  "acceptance": [
    "Failure in any required stage leaves no created row, ledger or money effect.",
    "An occupied fingerprint returns its existing classification without moving money."
  ],
  "scope": [
    "src/app/api/statement-import/commit/route.ts",
    "src/app/api/statement-import/commit/route.test.ts",
    "src/lib/statement-revert.test.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read the current create action and revert evidence before changing writes; identify the later accumulated balance/ledger application that must exclude the atomic branch.",
    "Prepare a proposed dated authenticated SQL command using BUD-63's primitive, validated batch/account/category ownership and locked/unique statement identity.",
    "Have the create branch consume the committed result once; keep receipt totals informative without using them to apply the same delta again.",
    "Test expense100→80, refund20→120, repeated fingerprint and every injected failure; owner applies SQL and verifies the inverse. Record remaining branches under BUD-71."
  ],
  "invariants": [
    "Transaction, required ledger and history are one transaction.",
    "Stamp remains balance-neutral.",
    "A receipt is not a second write instruction."
  ],
  "exclusions": [
    "Confirm/stamp/rekey/transfer atomicity.",
    "Changing fingerprints.",
    "Claiming whole-import atomicity."
  ],
  "checks": [],
  "risks": [
    "The route can double-apply money if the final accumulator still includes create.",
    "Permissive old failure tests may encode partial success."
  ],
  "unknowns": [
    "Current DB grants, constraint and BUD-63 application receipts."
  ],
  "dependencies": [
    "BUD-63"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: retained ASTRA-BUD-3 and current commit/revert test paths reviewed; isolated SQL witnesses remain future work."
}
```

### BUD-3

**Outcome:** Project recurring dues into Schedule.

- **Acceptance:** Budget owns due-date semantics and payment confirmation; Schedule consumes a read projection through the existing occurrence surfaces. Confirming a payment follows the existing money draft/confirmation contract. Never merge recurring payments with item recurrence or add another expansion engine.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** An ownership boundary more than a feature: Budget keeps due-date semantics and payment confirmation, Schedule only *consumes a read projection*. The two prohibitions are explicit — never merge `recurring_payments` with item recurrence, never add another expansion engine — so read `.claude/skills/recurrence-safety/SKILL.md` first; it is the authority on the two systems that share vocabulary and not engines. Budget side: `src/features/recurring/`, `src/app/api/recurring/`, and the forecast drawer `src/components/expense/FuturePaymentsDrawer.tsx`. Schedule side: the occurrence surfaces SCH-4.3b is unifying — project into them, do not materialize `items` rows. Payment confirmation follows the existing draft/confirmation contract (BUD-64).

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first; Budget payment semantics precede Schedule read integration.

**Verify:** `pnpm exec vitest run src/features/recurring/commitments.test.ts src/app/api/recurring-payments/[id]/route.test.ts src/lib/utils/dayOccurrences.test.ts`; proposed bridge fixtures cover same due twice, late payment, custom-month boundary, hidden account and failed data.

```delivery-plan-v1
{
  "outcome": "Schedule displays recurring dues as a Budget-owned read projection with the existing money confirmation action.",
  "acceptance": [
    "Projected dues agree with Budget status/date/account semantics.",
    "Confirming through Schedule applies one existing payment effect; viewing applies none."
  ],
  "scope": [
    "src/features/recurring/commitments.ts",
    "src/components/expense/FuturePaymentsDrawer.tsx",
    "src/components/planner/WebDayPlanner.tsx"
  ],
  "steps": [
    "Define the minimal authorized due projection from existing commitments: stable payment/period identity, amount/currency, due state and owner action.",
    "Split a Budget read adapter from the Schedule consumer; declare a proposed shared src/lib path rather than importing one standalone directly into another.",
    "Render projected dues through the canonical Schedule surface contract without creating items or merging recurrence engines.",
    "Route confirmation to the existing reviewed money path and verify refresh/Undo in both modules, including late and repeated confirmations. Pin extra hook/route scope before implementation."
  ],
  "invariants": [
    "Budget owns due advancement and money.",
    "Schedule never expands payment recurrence independently.",
    "Transfers and drafts retain their own semantics."
  ],
  "exclusions": [
    "Copying dues into items.",
    "New payment writer.",
    "Full cashflow forecast."
  ],
  "checks": [],
  "risks": [
    "Two surfaces can present the same period with different identities.",
    "A display projection can accidentally become a second posting engine."
  ],
  "unknowns": [
    "Exact current due-read endpoint and canonical Schedule adapter shape at execution time."
  ],
  "dependencies": [
    "SCH-8",
    "BUD-64"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: recurrence-safety, payment Overview and accepted bridge contract reviewed; selected source paths verified, no projection implemented."
}
```

### BUD-4

**Outcome:** Build the full multi-account cashflow forecast.

- **Acceptance:** Project canonical balances, account type, currencies, custom billing period and recurring commitments, with explicit coverage and no mixed-currency sum. Money-path tests precede trust. HUB-41 supplies only the cheaper recurring-dues/overdraw signal; shipping it does not close this forecast.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The full forecast, and HUB-41's cheaper signal does not close it. Five things must be canonical first, which is BUD-66's job: balances, account type direction (`getBalanceDelta` in `src/lib/balance-utils.ts`), currencies (`toUsd` — and no mixed-currency sum, BUD-76), the custom billing period (`startOfCustomMonth` in `src/lib/utils/date.ts`, never a calendar month), and recurring commitments (`src/features/recurring/`). "Explicit coverage" means the forecast states what it could not see rather than implying zero — the same unavailable-vs-zero rule as BUD-69. Surfaces: `src/features/analytics/`, `src/app/dashboard/`, `src/components/web/WebDashboard.tsx`. Money-path tests precede trust (`.claude/skills/money-rules/SKILL.md`).

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first; agree forecast horizon/coverage after canonical money contracts.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts src/features/recurring/commitments.test.ts src/lib/budget/budgetForecast.test.ts`; proposed cashflow fixtures separate actual balances from projected dues, currencies, uncertain reads and custom-period boundaries.

```delivery-plan-v1
{
  "outcome": "A full multi-account forecast shows supported future cashflow with explicit coverage and currency provenance.",
  "acceptance": [
    "Every projected amount names its account/currency and source basis.",
    "Incomplete inputs remain incomplete; a cheap recurring-dues signal cannot close this item."
  ],
  "scope": [
    "src/features/analytics/useNetWorth.ts",
    "src/features/recurring/commitments.ts",
    "src/components/web/WebDashboard.tsx"
  ],
  "steps": [
    "Inventory BUD-66 facts, current balances, recurring coverage, draft semantics and account visibility; record which forecast inputs remain unavailable.",
    "Agree horizon, included commitments and available-versus-projected presentation with worked account examples; retain unresolved BUD-75/76 policies as limits.",
    "Split a pure shared forecast adapter from the dashboard consumer; reuse canonical period/rate/direction helpers and distinguish scheduled estimates from actual transactions.",
    "Verify contribution totals, missing inputs and Undo/refresh effects before exposing concise forecast widgets; pin proposed test/adapter files before dispatch."
  ],
  "invariants": [
    "No mixed-currency sum.",
    "Transfers are movement, not income/spend.",
    "A forecast never posts money."
  ],
  "exclusions": [
    "Promoting HUB-41's smaller signal into full acceptance.",
    "Inventing future income.",
    "New financial ledger."
  ],
  "checks": [],
  "risks": [
    "Draft reservations and recurring dues can double-count one commitment.",
    "Current balance rates and frozen transaction rates serve different facts."
  ],
  "unknowns": [
    "Owner's forecast horizon, draft inclusion and confidence/coverage contract."
  ],
  "dependencies": [
    "BUD-66",
    "BUD-70"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: canonical money/payment docs and existing analytics paths reviewed; product scope remains a bounded design prerequisite."
}
```

### BUD-5

**Outcome:** 50/30/20 budgeting templates + Dashboard V2 widgets.

- **Acceptance:** 50/30/20 budgeting templates + Dashboard V2 widgets.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Templates over the existing envelope model — read `src/features/budget/` and its vault doc (`ERA Notes/02 - Standalone Modules/Budget Allocation/`) before inventing a second allocation concept; 50/30/20 is a preset over allocations, not a new table. Category grouping comes from `src/features/categories/` (note Categories has a cross-user slug-matching hard rule). Widgets land on `src/app/dashboard/` / `src/components/web/WebDashboard.tsx`, and the editable widget grid is `src/components/expense/EditableWidgetGrid.tsx`. Charts follow the `dataviz` skill; Hard Rules #10 (no hardcoded colours) and #14 (person-absolute identity) apply.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; acceptance is broad. Agree template base and first widget before implementation.

**Verify:** `pnpm exec vitest run src/lib/budget/budgetForecast.test.ts src/lib/utils/incomeExpense.test.ts`; proposed preset cases use agreed base1000→500/300/200, category omissions, manual overrides and custom-period boundaries. Mobile Apply/Undo must preserve stored balances.

```delivery-plan-v1
{
  "outcome": "A reviewed 50/30/20 preset populates existing envelope proposals and the agreed Dashboard V2 view.",
  "acceptance": [
    "The preset is an editable proposal over the existing allocation model.",
    "Applying/undoing allocations does not move money or overwrite unrelated periods."
  ],
  "scope": [
    "src/components/web/WebBudget.tsx",
    "src/features/budget/hooks.ts",
    "src/types/budgetAllocation.ts"
  ],
  "steps": [
    "Read current classification/envelope contracts and ask which income base, category grouping and dashboard widget the owner wants; do not invent a bundle of widgets.",
    "Define a worked 50/30/20 proposal, including unclassified categories, existing manual allocations and rounding remainder.",
    "Implement one preset over current allocation mutations, keeping manual edits and the established optimistic rollback/Undo behavior.",
    "Add the single selected Dashboard V2 consumer as a separately pinned component scope and verify totals, account/period filtering and mobile clarity."
  ],
  "invariants": [
    "A percentage preset is not a second budget table.",
    "One period/account scope per calculation.",
    "No balance/transaction effect."
  ],
  "exclusions": [
    "Funding workflow BUD-6.",
    "Full forecast.",
    "Automatic AI allocation."
  ],
  "checks": [],
  "risks": [
    "Category ownership/classification can differ across household accounts.",
    "Applying a template blindly can erase intentional manual choices."
  ],
  "unknowns": [
    "Accepted income base, savings treatment, unclassified category handling and exact widget."
  ],
  "dependencies": [
    "BUD-66"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: Budget Allocation Overview and existing hooks/types/forecast test checked; broad acceptance requires an owner-scoped first slice."
}
```

### BUD-6

**Outcome:** Complete Salary-to-Wallet-to-envelope funding.

- **Acceptance:** Preserve the accepted funding workflow: Salary income → Wallet allocation → envelopes, including recurring-commitment suggestions, editable allocations and worked balance effects. This is a funding redesign, not merely a recurring-payment hint.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A funding redesign, not a hint — the acceptance is explicit. The chain is Salary income → Wallet allocation → envelopes, so read all three: the Salary/default-income preference (`src/features/preferences/`, and BUD-67 verifies its migration), account types and direction (`src/lib/balance-utils.ts` — `income` accounts move balance the other way), and envelopes (`src/features/budget/`). Recurring-commitment suggestions come from `src/features/recurring/`. Allocations must stay editable and every step needs a worked balance effect — `.claude/skills/money-rules/SKILL.md` requires the before/after example and a test. Transfers between accounts already exist (`src/features/transfers/`, `getTransferDeltas`): reuse that, do not write a parallel mover.

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first; preserve the accepted Salary→Wallet→envelopes workflow and explicit human review.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts src/features/recurring/commitments.test.ts src/lib/budget/budgetForecast.test.ts`; worked Salary1000/Wallet0→fund400 gives600/400, then envelope200 leaves balances600/400. Retry and Undo verify one transfer.

```delivery-plan-v1
{
  "outcome": "Salary funding, Wallet transfer and editable envelope suggestions form one coherent reviewed workflow.",
  "acceptance": [
    "Funding uses the existing transfer contract exactly once.",
    "Envelope allocation remains planning; recurring suggestions do not post unpaid commitments."
  ],
  "scope": [
    "src/components/web/WebBudget.tsx",
    "src/features/budget/hooks.ts",
    "src/components/expense/TransferDialog.tsx",
    "src/features/transfers/hooks.ts"
  ],
  "steps": [
    "Map the selected default-income account, Wallet and envelope period; confirm current BUD-67 deployment and required funding controls.",
    "Split the workflow into explicit Salary availability, reviewed transfer, then allocation proposal; reuse existing account/transfer authorization and currencies.",
    "Build recurring-commitment suggestions from canonical coverage, preserve manual allocations and make partial completion resumable without re-sending the transfer.",
    "Verify the worked balances, no-money allocation, failed step/retry and Undo, then document the exact retained state after each stage."
  ],
  "invariants": [
    "Money moves only through the transfer domain.",
    "Allocation never debits Wallet again.",
    "A failed later step does not re-run earlier funding."
  ],
  "exclusions": [
    "A new money mover.",
    "Silent scheduled funding.",
    "Reducing this item to a recurring hint."
  ],
  "checks": [],
  "risks": [
    "One UI action spanning independent mutations can conceal partial success.",
    "Using default-income as a balance basis needs current evidence."
  ],
  "unknowns": [
    "Current desired transfer/allocate interaction and scope of household funding accounts."
  ],
  "dependencies": [
    "BUD-67",
    "BUD-70"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: transfer canonical deltas, accepted funding sequence and allocation mutation docs reviewed; no money moved."
}
```

### BUD-7

**Outcome:** Future Purchase.

- **Acceptance:** Future Purchase → Transaction auto-complete on linked purchase.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Future Purchase → Transaction auto-complete on a linked purchase. The link is the missing piece: check `src/app/api/future-purchases/` and `migrations/schema.sql` for whether a purchase can reference a transaction at all before designing. Reads are `src/features/future-purchases/hooks.ts`; the transaction side is `src/app/api/transactions/`. "Auto-complete" must not move money — completing a wish records that the purchase happened, it does not create the expense; the expense already exists and is what triggers it. BUD-69's truthfulness rules and BUD-77's promotion lineage both touch this record.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; define explicit purchase linkage and deletion/refund behavior before writing the bridge.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts`; proposed bridge tests cover authorized link, repeated transaction event, wrong-owner link, draft confirmation, deletion/refund and zero additional balance/history writes.

```delivery-plan-v1
{
  "outcome": "A future purchase becomes completed when its explicitly linked real purchase is recorded.",
  "acceptance": [
    "Completion is based on a selected transaction identity, not matching name/amount heuristics.",
    "The bridge records purchase state and creates no second expense."
  ],
  "scope": [
    "src/app/api/future-purchases/[id]/route.ts",
    "src/features/future-purchases/hooks.ts",
    "src/components/web/WebFuturePurchases.tsx",
    "migrations/schema.sql"
  ],
  "steps": [
    "Confirm the current schema and write paths: future_purchases has status/completed_at but no transaction link in this snapshot.",
    "Agree linkage cardinality, eligible confirmed transaction and what deletion/refund/Undo does to completion; record unresolved policy rather than choosing it silently.",
    "Prepare an additive, authorized link contract with a proposed dated migration and idempotent transition; integrate at the existing transaction lifecycle only after declaring that route scope.",
    "Verify status changes, preserved target/saved history and no extra money effect; owner applies SQL separately."
  ],
  "invariants": [
    "Completing a wish does not create or fund a transaction.",
    "No inferred purchase from a checked shopping message.",
    "Unrelated transactions cannot complete it."
  ],
  "exclusions": [
    "BUD-77 Catalogue promotion.",
    "Affordability recommendations.",
    "Automatic name matching."
  ],
  "checks": [],
  "risks": [
    "A purchase may be partial or cover multiple goals.",
    "A deleted transaction can leave a misleading completed goal."
  ],
  "unknowns": [
    "Cardinality and lifecycle policy for partial purchase, refund and deletion."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: future_purchases schema and completion PATCH inspected; linkage is absent from the committed schema, not certified live DB."
}
```

### BUD-8

**Outcome:** Debt.

- **Acceptance:** Debt → Schedule auto-reminder on collection date.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Debt → Schedule auto-reminder on the collection date. Debts are `src/features/debts/` and `src/app/api/debts/` (fix BUD-68's write-on-read first — an auto-reminder built on a GET that mutates will misfire). The Schedule side is item creation via `src/app/api/items/route.ts`, which already auto-creates a push alert when `due_at` is present and `alerts` is absent — read that branch (`resolveAlertBaseTime`) rather than inventing alert logic. Debts and Items are both standalone, so the bridge belongs in `src/lib/` or an API route, never a cross-feature import. Idempotence matters: a debt edited twice must not produce two reminders.

**Execution plan — 2026-09-26**

**Readiness:** Deferred after read-only debt retrieval; pin reminder lifecycle ownership before implementation.

**Verify:** `pnpm exec vitest run src/lib/utils/date.test.ts src/lib/utils/dayOccurrences.test.ts`; proposed bridge fixtures cover create/date change, repeated save, paid/archive, Undo, household rights and offline replay without duplicate reminders.

```delivery-plan-v1
{
  "outcome": "A debt's collection date can create and maintain one linked Schedule reminder.",
  "acceptance": [
    "Repeated debt edits update the intended reminder instead of creating duplicates.",
    "Reminder creation changes no debt balance or settlement state."
  ],
  "scope": [
    "src/app/api/debts/",
    "src/features/debts/useDebts.ts",
    "src/app/api/items/route.ts"
  ],
  "steps": [
    "After BUD-68, inspect explicit debt create/edit/settle transitions and identify the real collection-date field and current household rights.",
    "Agree how paid, archived, postponed and restored debts affect the linked reminder; name the source identity used for retries.",
    "Implement a bounded shared/API bridge using the existing item creation/alert contract, with a paired migration only if a durable link is missing.",
    "Verify due-date timezone conversion, retries and inverse behavior in both modules; keep reminders separate from debt settlement and its money effect."
  ],
  "invariants": [
    "Debt GET stays read-only.",
    "One logical debt reminder identity.",
    "Schedule owns alert/occurrence semantics."
  ],
  "exclusions": [
    "A second alert engine.",
    "Automatic debt payment.",
    "Cross-standalone imports."
  ],
  "checks": [],
  "risks": [
    "Separate debt/item writes may leave partial linkage.",
    "Archiving and paying are different lifecycle events."
  ],
  "unknowns": [
    "Exact collection-date field, desired opt-in/default and paid/archive reminder policy."
  ],
  "dependencies": [
    "BUD-68",
    "SCH-9"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: debt/Schedule routing and accepted bridge checked; field/link/lifecycle audit is the first deferred execution step."
}
```

### BUD-9

**Outcome:** Split the expense + recurring mega-forms into testable units (only when next touched).

- **Acceptance:** Split the expense + recurring mega-forms into testable units (only when next touched).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked with an explicit trigger — split only when a feature next forces you in. The two mega-forms are `src/components/expense/MobileExpenseForm.tsx` (the live mobile expense form, also named in DLV-84 as a render-loop risk site) and the recurring form under `src/features/recurring/` / `src/app/recurring/`. Shared state is `src/components/expense/ExpenseFormContext.tsx`. Before splitting, read `ERA Notes/01 - Architecture/Common Patterns.md` and `.claude/skills/cache-invalidation/SKILL.md`: the risk is diverging mutation/invalidation behaviour, not line count. Any split must preserve Hard Rule #19 (`type="text"` + `inputMode="decimal"`) on every amount field.

**Execution plan — 2026-09-26**

**Readiness:** Trigger held; only refactor the specific form section when a real feature next touches it.

**Verify:** `pnpm typecheck`; run existing tests for the selected touched behavior, then mobile before/after capture and submit/Undo checks. Add tests only for extracted behavior with an independently meaningful contract, not component-file shape.

```delivery-plan-v1
{
  "outcome": "The next required form change extracts a bounded testable unit while preserving capture behavior.",
  "acceptance": [
    "The motivating feature and extraction share a narrow explicit scope.",
    "Field values, validation, submission, offline behavior and cache invalidation remain equivalent."
  ],
  "scope": [
    "src/components/expense/MobileExpenseForm.tsx",
    "src/features/recurring/useRecurringPayments.ts"
  ],
  "steps": [
    "Wait for a real form feature; identify its live component, state owner and consumers through the Feature Map before selecting the extraction.",
    "Choose one cohesive pure calculation or UI subflow; declare proposed helper/component files and public props before editing.",
    "Move that boundary without changing payloads, query keys, state timing or number-input behavior; leave unrelated form sections intact.",
    "Verify the feature's existing behavior and mobile layout, including rollback/Undo and offline submission, then stop rather than continuing a size-driven refactor."
  ],
  "invariants": [
    "No extraction solely to reduce line count.",
    "Money uses canonical helpers.",
    "Amounts remain text inputs with decimal inputMode."
  ],
  "exclusions": [
    "Splitting both mega-forms in advance.",
    "UI redesign.",
    "Changing money semantics."
  ],
  "checks": [],
  "risks": [
    "Shared form closures can hide order-dependent state.",
    "Moving a hook can alter mutation invalidation or persistence."
  ],
  "unknowns": [
    "The triggering feature and exact recurring form component are intentionally not selected yet."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: accepted conditional scope and live form/recurring paths reviewed; this plan does not activate the parked refactor."
}
```

### BUD-10

**Outcome:** Statement Import.

- **Acceptance:** Statement Import → Inventory/Catalogue price pre-fill.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Statement Import → Inventory/Catalogue price pre-fill; parked. The parser already resolves merchants — `src/lib/bank-statement-parser.ts` calls `matchMerchantMapping()` from `src/lib/merchantMatch.ts` — so the missing half is a price field on the catalogue/inventory record, which is also KIT-8's blocker. Check `src/types/catalogue.ts` and the inventory item shape before designing. Statement Import, Inventory and Catalogue are three standalones: the bridge goes in `src/lib/` or a route. Nothing here may write money (BUD-26's audit invariant).

**Execution plan — 2026-09-26**

**Readiness:** Deferred; price identity/unit/currency and explicit prefill destination require a bounded design decision.

**Verify:** `pnpm exec vitest run src/lib/merchantMatch.test.ts`; proposed prefill fixture covers selected source row, wrong product/unit, mixed currency, stale price and cancel. Assert no transaction, stock or catalogue write before explicit acceptance.

```delivery-plan-v1
{
  "outcome": "A reviewed statement price can prefill an explicitly selected Inventory/Catalogue price field with provenance.",
  "acceptance": [
    "The target and source row are selected or resolved by an accepted identity contract.",
    "Prefill records price basis without implying stock purchase, quantity or current market price."
  ],
  "scope": [
    "src/lib/bank-statement-parser.ts",
    "src/types/catalogue.ts",
    "src/features/statement-import/sessionModel.ts"
  ],
  "steps": [
    "Read current Inventory/Catalogue price/unit fields and the statement row shape; resolve KIT-8's price-data constraint before inventing storage.",
    "Agree whether the amount is a unit price or receipt total, its currency/date and the selected product link; merchant identity alone cannot prove product identity.",
    "Implement a bounded shared/API prefill proposal using the existing review UI, declaring target editor and any proposed schema additions before dispatch.",
    "Verify manual edits/cancel and provenance display; no money or stock effect occurs from suggesting or accepting a price."
  ],
  "invariants": [
    "No inferred product from merchant text alone.",
    "No mixed-currency comparison.",
    "A bank row is historical evidence, not a live price feed."
  ],
  "exclusions": [
    "Automatic inventory restock.",
    "Catalogue price scraping.",
    "Changing import commit semantics."
  ],
  "checks": [],
  "risks": [
    "A multi-item transaction total can masquerade as a unit price.",
    "Wrong currency/unit makes later comparisons misleading."
  ],
  "unknowns": [
    "Accepted destination field and product/quantity/currency mapping."
  ],
  "dependencies": [
    "KIT-8"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: accepted bridge and Catalogue/statement routes reviewed; price-schema and identity contract remain unresolved."
}
```

### BUD-71

**Outcome:** Complete import atomicity beyond row creation.

- **Acceptance:** After BUD-63/65, cover confirm, stamp, rekey, transfer and recovery branches with transaction/inverse/balance guarantees. Current create-only repair does not certify all import/revert paths.
- **Depends on:** [BUD-63](<Budget — Master Book.md#bud-63>), [BUD-65](<Budget — Master Book.md#bud-65>).

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on BUD-63 and BUD-65; it extends their guarantee to the branches the create-only repair did not cover. Each has a file: confirm and stamp/rekey in `src/app/api/statement-import/imports/[id]/route.ts` and `commit/route.ts`, recovery in `imports/[id]/revert/route.ts`, transfers in `src/features/transfers/` with `getTransferDeltas()` from `src/lib/balance-utils.ts` (two deltas, so two things to keep atomic). Transfer detection during import is `treatsAsTransfer()` in `src/features/statement-import/sessionModel.ts`. For each branch the same triple must hold: the row, its inverse evidence, and the balance effect commit together. `.claude/skills/money-rules/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first after BUD-63/65. One branch contract at a time; no whole-import atomicity claim from create-only work.

**Verify:** `pnpm exec vitest run src/app/api/statement-import/commit/route.test.ts src/lib/statement-revert.test.ts`; add branch failure/concurrency fixtures for confirm, stamp, rekey, transfer and recovery, including later human edits and repeated revert.

```delivery-plan-v1
{
  "outcome": "Each remaining import/recovery branch commits its domain change, required inverse evidence and money effects coherently.",
  "acceptance": [
    "Each branch has a named atomic boundary and truthful failure result.",
    "Revert respects newer human edits and never applies an inverse twice."
  ],
  "scope": [
    "src/app/api/statement-import/commit/route.ts",
    "src/app/api/statement-import/imports/[id]/revert/route.ts",
    "src/lib/statement-revert.ts",
    "src/app/api/statement-import/commit/route.test.ts",
    "src/lib/statement-revert.test.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Inventory current confirm/stamp/rekey/transfer/recovery sequences and which writes BUD-65 now owns; list one failure witness per remaining branch.",
    "Split confirm, identity maintenance and two-leg transfer/recovery into sequential bounded slices reusing BUD-63 and existing import identities.",
    "Prepare paired manual SQL for only the selected slice, preserving ledger previous/applied values, authorization and newer-edit conflict checks.",
    "Verify no-op/retry/conflict and inverse balances for that branch, then record its acceptance without certifying unconverted branches."
  ],
  "invariants": [
    "Stamp/rekey stay money-neutral.",
    "Transfer restores both native-currency legs or neither.",
    "Receipt data cannot cause a second effect."
  ],
  "exclusions": [
    "Fingerprint redesign.",
    "Automatic historical repairs.",
    "Replacing the existing revert planner."
  ],
  "checks": [],
  "risks": [
    "Multiple ledger/domain operations can still partially commit outside the selected transaction.",
    "A replay can conflict with a newer edit."
  ],
  "unknowns": [
    "Current applied BUD-63/65 contracts and exact per-branch SQL scope."
  ],
  "dependencies": [
    "BUD-63",
    "BUD-65"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current commit/revert boundaries and retained atomicity scope reviewed; no branch is newly claimed fixed."
}
```

### BUD-72

**Outcome:** Resolve populated account type and currency edits.

- **Acceptance:** Held for DEC-12. Decide historical transaction semantics before allowing populated account type/currency edits; no silent reinterpretation of existing money.

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-12 — record the decision before coding; the prohibition is silent reinterpretation of existing money. The stakes are visible in `src/lib/balance-utils.ts`: `AccountType` is `expense | income | saving` and `getBalanceDelta()` uses it to choose sign, so changing the type of a populated account re-signs every historical transaction on it. Currency is worse: amounts are stored raw with an `exchange_rate` (`toUsd()`), and LBP is stored in thousands per the Preferences hard rule. The edit path is `src/app/api/accounts/[id]/route.ts` and `src/components/expense/AccountCurrencyDialog.tsx`. Write the decision into `_Decisions.md` with a worked example of what happens to existing rows under each option.

**Execution plan — 2026-09-26**

**Readiness:** Decision held — DEC-12. Produce worked options first; do not enable populated-account reinterpretation.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts`; use read-only fixtures showing expense/income/saving sign and frozen/current FX before and after each proposed policy. No production conversion is part of this investigation.

```delivery-plan-v1
{
  "outcome": "Define what a populated account's type or currency edit means for existing money and history.",
  "acceptance": [
    "A dated owner decision covers stored balance, past transactions, frozen rates, drafts and linked consumers.",
    "The chosen contract preserves history or defines an explicit reviewed conversion with an inverse."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Budget/Budget — Master Book.md"
  ],
  "steps": [
    "Trace the account edit route and canonical helpers using a populated expense account and a foreign-currency account; inventory every affected interpretation.",
    "Present bounded choices such as refusing populated edits versus an explicit migration/conversion, with concrete before/after values and operational cost.",
    "Ask the owner to choose DEC-12 and record the selected historical semantics, rollback limits and treatment of existing drafts/transfers.",
    "Only then derive a separate implementation/migration scope and owner UAT; keep the current protection until the contract is accepted."
  ],
  "invariants": [
    "Existing amounts are never silently relabelled or re-signed.",
    "Current account rate does not rewrite frozen transaction evidence.",
    "No automatic data conversion."
  ],
  "exclusions": [
    "Implementing a speculative account migration.",
    "Changing getBalanceDelta globally.",
    "Production inspection by the agent."
  ],
  "checks": [],
  "risks": [
    "Changing type affects aggregate direction; changing currency affects unit meaning.",
    "A reversible UI field can imply irreversible historical interpretation."
  ],
  "unknowns": [
    "Owner-selected policy for populated type/currency changes."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: DEC-12, account currency docs, schema and balance helpers reviewed; this is a decision plan only."
}
```

### BUD-73

**Outcome:** Define dual approval for transactions.

- **Acceptance:** Held for DEC-11. Preserve the Inbox wording “requires both comments”; decide whether this means comments, both people’s approval, eligible transactions and pending-money behavior before implementation.

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-11 — the whole item is deciding what "requires both comments" means, and the acceptance says preserve that Inbox wording while resolving it. Four sub-questions: comments versus approvals, which transactions are eligible, and what pending money does in the meantime. Context to read: the household model (`household_links`, Hard Rule #13, `src/app/api/accounts/route.ts`), the existing two-party money flow that already exists — split bills (`src/app/api/transactions/split-bill/route.ts`, `src/lib/utils/splitBill.ts`) — and the draft/pending pattern in `src/features/drafts/`. Do not implement an approval mechanism before the definition is recorded in `_Decisions.md`.

**Execution plan — 2026-09-26**

**Readiness:** Decision held — DEC-11. Preserve the original phrase before specifying an approval system.

**Verify:** Review a decision table for one comment, two comments, one approval, both approvals, edit, rejection, offline retry and household unlink. Each scenario states when money moves; no product mutation test is warranted before policy exists.

```delivery-plan-v1
{
  "outcome": "Clarify which transactions require both comments and what that means before implementation.",
  "acceptance": [
    "The owner distinguishes comments from approvals and selects eligible transactions.",
    "Pending, approved, rejected and edited money semantics have explicit examples."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Budget/Budget — Master Book.md"
  ],
  "steps": [
    "Keep the owner's exact wording, 'requires both comments', and show how comments and bilateral approval would behave differently on one transaction.",
    "Ask for the intended actors, eligibility rule and whether pending money is reserved, projected or posted; include privacy and unlink behavior.",
    "Record an accepted state/transition table with edit/rejection/retry/Undo cases and canonical money effects.",
    "If adopted, split authorization/storage, atomic state transition and concise review UI into separately scoped implementation work; do not build from the phrase alone."
  ],
  "invariants": [
    "No money effect is inferred from a comment.",
    "Both actors' rights remain explicit.",
    "AI may propose but never supply a household member's approval."
  ],
  "exclusions": [
    "Invented thresholds or eligible categories.",
    "A new approval workflow before DEC-11.",
    "Reusing split-bill semantics without proof."
  ],
  "checks": [],
  "risks": [
    "Ambiguous pending-money treatment can double-count or hide commitments.",
    "A later edit can invalidate an earlier approval."
  ],
  "unknowns": [
    "Meaning of comments, eligibility, approval actors and pending balance policy."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: DEC-11 and preserved Inbox/acceptance wording reviewed; no requirement was silently selected."
}
```

### BUD-75

**Outcome:** Resolve income-draft available-balance semantics.

- **Acceptance:** Held for DEC-19. The study’s stored100 plus pendingincome2000 displayed−1900 example needs an explicit available/projected definition. Do not blindly flip a sign or shared helper.

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-19 and the acceptance warns against flipping a sign or a shared helper blindly — the helper in question is `getBalanceDelta()` in `src/lib/balance-utils.ts`, where `income` accounts already move the other way, and a change there touches every money surface. The worked example (stored 100 + pending income 2000 displayed as −1900) needs an explicit definition of *available* versus *projected* balance before any edit. Where pending money lives: `src/features/drafts/` (`is_draft` on transactions) and the balance card in `src/features/balance/` / `src/components/expense/AccountBalance.tsx`. Record the definition in `_Decisions.md`, then apply it once at the display boundary rather than in the shared delta helper if that is what the decision implies.

**Execution plan — 2026-09-26**

**Readiness:** Decision held — DEC-19. Define available versus projected money before changing any sign.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts src/lib/balance.test.ts`; proposed display fixtures compare stored100 plus pending income2000 across available/projected views and confirmation/Undo. Existing transaction delta tests must remain unchanged.

```delivery-plan-v1
{
  "outcome": "Pending income drafts have an explicit available/projected balance meaning shared by money surfaces.",
  "acceptance": [
    "The retained 100/2000/−1900 example is explained under the selected policy.",
    "Confirmation neither counts expected income twice nor changes unrelated expense reservations."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Budget/Budget — Master Book.md"
  ],
  "steps": [
    "Trace current balance GET/draft read and display calculation; distinguish stored balance, pending reservation and projected income rather than assuming a sign bug.",
    "Present worked income and expense cases before/after confirm, delete and Undo, including whether expected income is spendable.",
    "Have the owner choose DEC-19 and record which surfaces display available, projected or both with concise labels.",
    "Pin the minimal read/display adapter and tests for later implementation; preserve canonical posted-money deltas unless independent evidence proves them wrong."
  ],
  "invariants": [
    "One confirmed income contributes once.",
    "No silent definition change in shared balance helpers.",
    "Unknown account currency remains unknown."
  ],
  "exclusions": [
    "Blind sign flip.",
    "Changing all money semantics.",
    "Historical balance repair."
  ],
  "checks": [],
  "risks": [
    "A display correction can accidentally alter server posting direction.",
    "Mixed definitions across widgets can show contradictory totals."
  ],
  "unknowns": [
    "Owner's available-versus-projected definition for pending income."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: DEC-19 and canonical sign/draft contracts reviewed; the old numerical example is a policy witness, not a current runtime certification."
}
```

### BUD-76

**Outcome:** Define currency contracts for debt, split and NFC consumers.

- **Acceptance:** Held for DEC-20. Agree supported currencies, FX provenance/rounding and comparison rules across debt/split/NFC consumers before wiring money suggestions; do not sum currencies.

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-20; the cross-cutting rule is already stated — do not sum currencies. The primitives are `toUsd(amount, exchangeRate)` in `src/lib/balance-utils.ts` and the LBP-in-thousands convention from Preferences (`src/features/preferences/`, and see `ERA Notes/02 - Standalone Modules/Preferences/`). The three consumers to give an agreed contract are debts (`src/features/debts/`, `src/app/api/debts/`), split bills (`src/lib/utils/splitBill.ts`, `src/app/api/transactions/split-bill/route.ts`) and NFC wallet prompts (`src/components/expense/NfcWalletTransferPrompt.tsx`, `src/features/nfc/`). Supported set, FX provenance, rounding and comparison rules all go in `_Decisions.md` first; BUD-27's implied-rate matching depends on this being settled.

**Execution plan — 2026-09-26**

**Readiness:** Decision held — DEC-20. Work is a cross-consumer currency contract, not a helper substitution.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts src/lib/utils/splitBill.test.ts`; review worked USD/LBP-thousands and foreign-currency debt/split/NFC cases, explicit unavailable rate, rounding and inverse. No production transfer is needed.

```delivery-plan-v1
{
  "outcome": "Debt, split and NFC consumers share an explicit supported-currency and FX provenance contract.",
  "acceptance": [
    "Each consumer defines amount unit, rate source/time, rounding and comparison rules.",
    "Unsupported or missing FX prevents misleading suggestions or money movement."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Budget/Budget — Master Book.md"
  ],
  "steps": [
    "Inventory debt origin amounts, split payer/account choices and NFC from/to prompts; separate frozen transaction rates from current balance/conversion rates.",
    "Prepare a compact contract table with worked native-amount and displayed-USD examples, including LBP stored in thousands.",
    "Resolve DEC-20 with the owner: supported combinations, selected conversion amount, unavailable-rate handling and rounding/inverse policy.",
    "Sequence one consumer implementation at a time, reusing existing transfer/delta helpers where their contract applies and declaring any schema additions separately."
  ],
  "invariants": [
    "Never sum unlike currencies.",
    "Rate provenance is explicit; no guessed rate.",
    "Undo preserves original native amounts and selected conversion."
  ],
  "exclusions": [
    "Universal currency engine.",
    "Automatic historical conversion.",
    "Extending unsupported household FX transfers by convenience."
  ],
  "checks": [],
  "risks": [
    "Debts lack an explicit currency column in the current documented model.",
    "Same-number comparisons can hide different units."
  ],
  "unknowns": [
    "Supported currency pairs and per-consumer rate/rounding policy."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: DEC-20, account transfer FX restrictions, LBP rule and split/NFC entry paths reviewed; implementation remains held."
}
```

### BUD-77

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C12. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Promote a saved wish into a Budget goal.

- **Acceptance:** Catalogue C12: explicit promotion creates a goal with positive target, date and urgency, zero initial progress and source lineage. No money moves and no inferred purchase.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>).

**Provenance:** [Budget — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Budget/Budget — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C12, depends on KIT-20's typed patch and revision checks. The rule is a clean separation: promotion creates a Budget goal with lineage and **moves no money** and infers no purchase. The lineage precedent is `source_catalogue_item_id` (see `src/app/api/items/[id]/promote/route.ts` for the existing promotion shape to copy). The wish side is `src/features/future-purchases/` and `src/app/api/future-purchases/`; the goal side is `src/features/budget/`. Zero initial progress plus a positive target and date are validation, so Zod them (Hard Rule #12). Repeated promotion must link, not duplicate — a unique constraint and 409 (Hard Rule #9).

**Execution plan — 2026-09-26**

**Readiness:** Deferred after KIT-20 and the accepted C12 prerequisites; owner-local reliable transport and source protection must be evidenced.

**Verify:** `pnpm exec vitest run src/lib/balance-utils.test.ts`; proposed C12 route fixtures cover positive target/date/urgency, selected existing goal authorization, lost-response replay, changed-payload409, source archive and unchanged balances/transactions/allocations.

```delivery-plan-v1
{
  "outcome": "Plan purchase explicitly creates or links a Budget goal from a saved Catalogue wish with provenance.",
  "acceptance": [
    "New goals start with zero saved progress and validated target/date/urgency.",
    "Retry retains one goal; source research and financial editing keep their separate owners."
  ],
  "scope": [
    "src/components/web/CatalogueItemDetailDialog.tsx",
    "src/components/web/WebFuturePurchases.tsx",
    "src/features/future-purchases/hooks.ts",
    "src/app/api/future-purchases/",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read Catalogue C12/C02/C03/C10 and current goal schema; confirm source rights/revision and available command-receipt transport before selecting a route.",
    "Open existing Budget-required fields from Plan purchase; never copy generic Catalogue progress into current_saved.",
    "Prepare an additive source FK/revision/request-identity migration and a proposed Budget-owned command that commits goal/link and idempotent outcome together.",
    "Verify owner-only goal linkage is hidden from other source viewers, source archive/delete preserves provenance, and all financial snapshots remain unchanged. Owner applies SQL separately."
  ],
  "invariants": [
    "Promotion moves no money and infers no purchase.",
    "No name-based goal linking.",
    "One retry identity preserves the created goal."
  ],
  "exclusions": [
    "Allocating savings.",
    "Purchasing/completing the wish.",
    "Mirrored financial editing in Catalogue."
  ],
  "checks": [],
  "risks": [
    "Shared references can reveal private goal linkage through usage counts.",
    "Unreliable replay can create duplicate goals."
  ],
  "unknowns": [
    "Current C02/C03/C10 acceptance and reliable command transport; final proposed endpoint path."
  ],
  "dependencies": [
    "KIT-20"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: accepted Catalogue C12 and goal schema inspected; no source-link columns or command are claimed deployed."
}
```

### BUD-83

**Kind:** feature

**Outcome:** Show the Split tag in transaction details and remove a pending split.

- **Acceptance:** `TransactionDetailModal` shows a checked **Split** tag when `split_requested` is true and no Split tag when it is false. Hard Rule #28: the label is only "Split", with no helper text.
- **Acceptance:** the owner can uncheck the tag only while the split is pending (`split_completed_at` is null). Unchecking clears `split_requested`, `collaborator_id`, `collaborator_amount`, `collaborator_description` and `collaborator_account_id`. No account balance or balance history changes.
- **Acceptance:** a completed split still shows the tag, but it is locked. The server also refuses: the PATCH update is conditional on `split_completed_at IS NULL` and the owner's `user_id`, and a completed or missing row returns 409/404 instead of 500. A partner or collaborator viewing the transaction sees the tag read-only.
- **Acceptance:** after removal, the partner's pending split list (`GET /api/transactions/split-bill`) no longer shows it, and their pending split notification is dismissed. That notification row belongs to the partner: RLS `notifications` UPDATE is `auth.uid() = user_id` (db-state snapshot 2026-08-04). Dismiss it server-side, scoped to `transaction_id` + the former `collaborator_id`.
- **Acceptance:** the removal uses `safeFetch` through the existing transaction mutation hook, with the cache invalidated. The toast has **Undo** (Hard Rule #1), and Undo re-requests the split for the same collaborator so it shows as pending again.
- **Acceptance (money-rules):** `src/lib/utils/splitBill.ts` exports `canRemoveSplit(transaction)`: true only when `split_requested` is true, `split_completed_at` is empty and `is_owner` is not false. The UI and the PATCH route both use it. The protected Delivery check `tests/delivery-oracles/bud83-split-removal.mjs` verifies it (the writer cannot edit that file); existing `src/lib/utils/splitBill.test.ts` still passes. The PATCH update itself stays conditional on `split_completed_at IS NULL`.
- **Race note:** the collaborator's completion is already guarded at DB level. RLS "Collaborators can update split amounts" requires `split_requested = true AND split_completed_at IS NULL`, so a completion after removal matches zero rows and moves no balance. Do not change `split-bill/route.ts` for this item.

**Touches:** `src/components/dashboard/TransactionDetailModal.tsx`, `src/app/api/transactions/[id]/route.ts`, `src/features/transactions/useDashboardTransactions.ts`, `src/lib/utils/splitBill.ts`, `src/lib/utils/splitBill.test.ts`

**Provenance:** owner request 2026-09-19 — "if i set it to split by mistake i can remove the tag"; owner scoped removal to pending splits only. Selected as a Delivery V2 Fast lane product trial.

- **Reading guide:** Well specified already; here is where each clause lands. Display and the checkbox: `src/components/dashboard/TransactionDetailModal.tsx`, reading `split_requested` / `split_completed_at` — the display helpers that already branch on that pair are `getTransactionDisplayAmount()` and `getTransactionDisplayDescription()` in `src/lib/utils/splitBill.ts` (with `splitBill.test.ts`). Server: `src/app/api/transactions/[id]/route.ts` — its PATCH is where the conditional update on `split_completed_at IS NULL` + owner `user_id` goes, and its DELETE branch already shows the completed-split balance reversal you must **not** trigger here (removal of a *pending* split changes no balance). Partner's pending list: `src/app/api/transactions/split-bill/route.ts`. The notification dismissal is cross-user, and the acceptance is right that `notifications` UPDATE is `auth.uid() = user_id` — so it must be done server-side scoped to `transaction_id` + the former `collaborator_id`; re-check `migrations/db-state.json` rather than trusting the quoted snapshot (Hard Rule #27). Client mutation: `src/features/transactions/useDashboardTransactions.ts`, through `safeFetch` (Hard Rule #6) with Undo re-requesting the split (Hard Rule #1). Hard Rule #28: the label is "Split", nothing more.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; refresh owner RLS evidence before certifying the completion/removal race. Keep the existing protected acceptance unchanged.

**Verify:** `pnpm exec vitest run src/lib/utils/splitBill.test.ts`; existing protected `tests/delivery-oracles/bud83-split-removal.mjs` remains untouched. Add a proposed route/UI regression witness for pending owner removal, collaborator refusal, completed 409, notification dismissal and Undo; mobile four-theme check.

```delivery-plan-v1
{
  "outcome": "An owner can remove an accidental pending Split tag without changing money.",
  "acceptance": [
    "Pending owner removal clears exactly the five named split fields and dismisses the former collaborator's pending notification.",
    "Completed and nonowner splits remain visible and locked; Undo re-requests the same collaborator."
  ],
  "scope": [
    "src/components/dashboard/TransactionDetailModal.tsx",
    "src/app/api/transactions/[id]/route.ts",
    "src/features/transactions/useDashboardTransactions.ts",
    "src/lib/utils/splitBill.ts",
    "src/lib/utils/splitBill.test.ts"
  ],
  "steps": [
    "Extend the detail payload/type with existing split fields and add the shared canRemoveSplit predicate; keep the label exactly Split.",
    "Add a validated removal branch to PATCH, scoped to owner and split_completed_at IS NULL; distinguish missing, completed/conflict and write failure without entering balance adjustment.",
    "Dismiss only the former collaborator's notification for this transaction through the existing server authority; report failure truthfully and avoid broad notification updates.",
    "Wire the tag through the existing safeFetch mutation, invalidate transaction/split/notification consumers and add Undo restoring the previous collaborator request.",
    "Verify completion versus removal using fresh owner evidence and isolated fixtures; do not edit the collaborator completion route or protected oracle."
  ],
  "invariants": [
    "Pending removal and Undo move zero balance/history.",
    "A stale client cannot remove a completed split."
  ],
  "exclusions": [
    "Completed split reversal.",
    "Currency policy changes.",
    "Editing split-bill/route.ts."
  ],
  "checks": [],
  "risks": [
    "A guarded row update and a cross-user notification write can partially succeed."
  ],
  "unknowns": [
    "Current live collaborator policy/race behavior; the committed snapshot is dated 2026-08-04."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: detail modal, PATCH, hook fields, split helpers and dated notification/transaction policies inspected; feature not present at HEAD 45b2889."
}
```

## Backlog reconciliation

- 2026-09-10 — **HUB-10** → BUD-2. Scope is retained in the destination criteria; duplicate removed, not shipped.

## Shipped Log

- ✅ 2026-06-10 — `balance-utils` unit-tested (balance direction)
- ✅ 2026-06-10 — recurring next-due math unit-tested
- ✅ 2026-06-16 — Reconciliation checkpoint: "last checked" date (reuses `balance_set_at`) glows red past 7 days; one-tap "Balance matches" / "Doesn't match — correct it" in `BalanceHistoryDrawer`, with Undo
- ✅ 2026-06-25 — Transfers: `/expense?transfer=salary-wallet` opens a small transfer amount prompt
- ✅ 2026-06-25 — Dashboard V2 Monthly Savings reads the flat `Our Savings` balance and adds `Expected Savings` (Income − Expense) with metric toggles
- ✅ 2026-06-26 — AI proposal layer for allocations woven inline on the Allocate surface (manual always wins): outlier-cleaned history via `anomalyDetection.ts`, deterministic statistical fallback, per-row Apply + Apply-All, separate read-only Review surface
- ✅ 2026-06-26 — Review v3 experimental dashboard view (Insight tab: category-stacked monthly spend, runtime outlier toggle, budget reference line, Income/Expense/Expected-Savings pie)
- ✅ 2026-06-26 — Outlier detection upgraded to a two-signal median/MAD model (in-category spikes + rare-but-large transactions) with a reviewable list grouped by month
- ✅ 2026-06-26 — Bimodal categories handled via largest-gap splitting + a recurring-merchant signal (same description ≥4×/≥3 months never flags)
- ✅ 2026-06-26 — Multi-tier/rhythmic overhaul: log-space spike scoring, `normalizeMerchant` collapses bank ref-code noise, date-based cadence detection, `recurring_payments` fed in as authoritative suppression
- ✅ 2026-06-26 — Per-envelope rare-category floor: materiality is now a fraction of the median everyday transaction (`max($50, median×0.6)`) so a new envelope is judged on its own and graduates once it builds a baseline
- ✅ 2026-06-26 — Insight tab made interactive (`InsightFocusPanel`, removable chips, tap-to-drill) with two-step zoom (month → category → out)
- ✅ 2026-06-26 — Dashboard FilterBar UX: date presets and category filter moved out of the panel into always-visible chip rows; panel reduced to group toggle + custom range + journal filters
- ✅ 2026-06-26 — Insight pie follows the global date filter; global filters persist across tab switches (removed the `setTwelveMonthRange` force-reset)
- ✅ 2026-06-27 — Transfers: single-URL template slugs replace the `from`+`to` param pair; in-modal 3-chip template toggle pre-fills accounts and description (legacy slugs still work)
- ✅ 2026-06-27 — `NfcWalletTransferPrompt` partner account picker fixed — uses `useAccounts()` so the partner sees the owner's public accounts
- ✅ 2026-06-27 — Budget AI structured spending analysis (`AnalysisReport`: KPIs, insights, anomalies, recommendations) renders as a chat answer **and** a dashboard; duplicate model category labels merged before render; `analysis_report` persisted on `ai_messages` so historical answers reopen without another AI call → [Spending Analysis Report](<../../03 - Junction Modules/AI Assistant/Spending Analysis Report.md>)
- ✅ 2026-07-03 — balance computation/adjustment unit-tested (`src/lib/balance.test.ts`)
- ✅ 2026-07-03 — canonical income/expense/spending totals unit-tested (`src/lib/utils/incomeExpense.test.ts`)
- ✅ 2026-07-03 — recurring confirm→transaction posting unit-tested (`src/app/api/recurring-payments/[id]/route.test.ts`): owner confirm, partner confirm, private-payment blocking, transaction payload, balance adjustment, date updates
- ✅ 2026-07-03 — recurring commitments console + manual transaction reconciliation
- ✅ 2026-07-04 — drawer-balance bug fixed via a proper data-repair runbook (`migrations/2026-07-04_repair-drawer-account-balance.sql`)
- ✅ 2026-07-11 — merchant map feeds manual entry: typing a merchant on the Category/Subcategory steps makes the mapped card glow; works cross-user and cross-account, silent skip when absent
- ✅ 2026-07-11 — merchant-mappings API (`0a39c4e`) persists merchant→category mappings learned from import confirmations
- ✅ 2026-07-11 — `analytics/debug` route removed from the prod surface
- ✅ 2026-07-18 — **BUD-12** deleted the remaining debug/diagnostic routes (`env-check`, `supabase-check` — the latter an unauthenticated `listUsers` probe); zero callers verified, typecheck green
- ✅ 2026-07-21 — **BUD-13** household transfers authorize a visible private partner account only as the destination of an explicit household transfer; ordinary partner writes stay public-only (`src/lib/accountAccess.test.ts`)
- ✅ 2026-08-01 — **BUD-14** [TEST] Mobile expense form quick-amount chip: replace the $25 preset with $20 → `src/components/expense/MobileExpenseForm.tsx:1144`
- ✅ 2026-08-04 — **BUD-15** Multi-currency accounts + frozen per-transaction exchange rates + cross-currency conversion transfers (built for the Italy trip's EUR cash account). `accounts.currency`/`accounts.exchange_rate` (current rate), `transactions.exchange_rate` stamped by a `SECURITY DEFINER` DB trigger (`stamp_transaction_exchange_rate`, BEFORE INSERT/UPDATE OF account_id) so historical USD dashboard totals stay frozen at the rate in effect when logged, even after the account's rate is later edited. `transfers.to_amount`/`exchange_rate` support asymmetric cross-currency transfers (`getTransferDeltas` in `src/lib/balance-utils.ts` gained an optional `toAmount` param) with a user-overridable destination amount for cash-exchange rounding. Analytics route and `WebDashboard` both convert to USD via the frozen rate (`toUsd()` helper); net worth converts via each account's *current* rate. New `AccountCurrencyDialog` lets an existing account's currency/rate be edited from the account wiggle-mode. Migration `migrations/2026-08-04_multi-currency.sql` pending owner run. Tests: `src/lib/balance-utils.test.ts` (+6 cases, conversion deltas + delete-reversal + toUsd).
- ✅ 2026-08-04 — **BUD-16** Account long-press edit mode now springs into a clearer alternating wiggle, with non-overlapping in-card visibility and labeled currency controls sized for mobile touch.
- ✅ 2026-08-06 — **BUD-17** Expense form (and everything reachable from it for a single account) now renders that *account's own currency* instead of always `$`. New `src/lib/currency.ts` (`getCurrencySymbol`, `getQuickAmounts`) maps each of the 6 `AccountCurrencyDialog` codes to a display symbol and real banknote denominations. First pass only covered the amount input + quick chips; a follow-up pass (same day, after the owner caught the balance card still showing `$`) swept every other single-account-scoped `$` in the expense flow: `AccountBalance.tsx` (balance + outstanding-debt line), `BalanceHistoryDrawer.tsx` (`formatCurrency` threaded a `currency` prop through `DayCard`/`ActivityEntry`/`ArchiveCard`), `FuturePaymentsDrawer.tsx` (+ `PaymentCard`), `TransferDialog.tsx` (from-account leg: amount input, returned/fee, household summary — the self-transfer leg already showed currency codes correctly), `ExpenseTagsBar.tsx`, and `MobileExpenseForm.tsx`/`ExpenseForm.tsx` toast descriptions. Drafts are cross-account (global drawer), so `DraftsDrawer.tsx`/`DraftTransactionsDialog.tsx` resolve *per-draft* currency via a new `accounts!...(name, currency)` select in `/api/drafts`; `OfflinePendingDrawer.tsx` similarly resolves per-op currency from `op.body.account_id` since the offline queue spans accounts too. Deliberately left USD/unconverted: `DebtsDrawer`/`DebtSettlementModal` (debts have no `currency` column — derived from an arbitrary origin transaction, real fix needs a schema change), `SplitBillModal`/`SplitBillHandler` (the payer picks their own account, which can differ in currency from the partner's original leg — no reliable single currency), `NfcWalletTransferPrompt` (NFC Tags module, same from/to ambiguity as TransferDialog, not picked up this pass). Dashboard/analytics untouched — already USD via `toUsd()`. Verified live in-browser after fixing an unrelated tab HTTP-cache trap (hard-reload needed to see the fix): Trip - Italy 2026 (EUR) shows `€` everywhere in the flow including Balance History; Wallet (USD) still shows `$`.
- ✅ 2026-08-18 — **BUD-18** Statement import Phase 0 correctness batch (first slice of the reconcile overhaul, plan `~/.claude/plans/the-e-statement-upload-feature-stateless-karp.md`): **(1) money bug** — credits (refunds/reversals, encoded negative by the dialog) were `Math.abs()`ed into positive expenses AND summed into the deduction total, so a €20 refund *lowered* the balance by 20; route rewritten with Zod validation + per-row signed deltas (`is_debt_return: true` on credits → `getBalanceDelta` adds the money back; worked example −50+20 → net −30 encoded in `src/app/api/statement-import/import/route.test.ts`, 7 tests). **(2)** server-side account-ownership gate (403) + category↔account/subcategory-parent validation with per-row `errors[]` reporting — the silent `continue` that vanished rows is gone; dead `use_count` block removed. **(3)** Settings "+ Add" category 500 fixed — `/api/categories/manage` inserted a phantom `icon` column (`user_categories` has none; only `default_categories` does); stripped from create + bulk_update. **(4)** "new subcategory never appears" fixed — creators now call `refreshCategoryCaches()` (`src/lib/queryInvalidation.ts`): refetch active category queries + drop inactive/persisted entries, because `invalidateQueries` (refetchType "active") never reached unmounted consumers running `refetchOnMount:false` against the localStorage-persisted cache. **(5)** trip activation copies `trip.currency` onto the auto-created account (EUR trip no longer creates a USD-labeled account). **(6)** `LEBANESE_MERCHANTS` no longer injected into parse mappings — they set `matched: true` with a null category, showing a green "Matched" badge invisible to the Needs-Category filter. Drift migration `migrations/2026-08-18_statement-import-phase0-drift.sql` (documents the two live unique indexes; schema.sql paired) — **pending owner run, expected no-op**.
- ✅ 2026-08-19 — **BUD-19** Statement reconcile engine. New pure matcher `src/lib/statement-reconcile.ts` (16 tests): candidate window is logged-date ∈ [posting − 7d, posting + 1d] so the bank's posting lag stops being the user's problem; exact-amount tier → `matched`, within `max($1, 10%)` → `probable` (tips/FX); ranking is tier → date proximity → `normalizeMerchant` token overlap → recency; **one-to-one greedy assignment** so two identical taps never claim the same logged row; direction must agree (a credit only matches a money-back row); genuinely tied candidates return `ambiguous` for the user to pick rather than a silent guess; prior-import rows are recognized by exact hash *and* by a probable-duplicate tier (amount + window against any hash-bearing row) which is what makes the hash-formula change safe without a backfill. `POST /api/statement-import/reconcile` (5 tests) does ownership-gated candidate fetch in one query over the union window. Parse route now requires `account_id` (chosen before upload), returns `statement_id` (sha256 of the file text) + strict currency detection, adds `normalized_key` per row, and drops its private duplicate matcher for the shared `matchMerchantMapping`. Migration `migrations/2026-08-18_statement-reconcile-index.sql` (`idx_transactions_account_date`, partial on `deleted_at IS NULL`) — **pending owner run**.
- ✅ 2026-08-19 — **BUD-20** Statement commit endpoint + hash v2. `POST /api/statement-import/commit` replaces the old import route with three explicit actions and per-row results (no more silent `continue` swallowing rows): `create` (batch insert, per-row retry to isolate duplicates), `stamp` (**balance-neutral** — tags an already-logged transaction with the fingerprint and keeps the user's own date, since the posting date is noise), `confirm_draft` (draft → real, balance applied once). Credits are stored positive with `is_debt_return`, so a refund raises the balance. Every write is guarded (`statement_hash IS NULL`, `is_draft = true`, hash uniqueness) so **re-committing is a no-op** — proven in `commit/route.test.ts` (10 tests) alongside the worked example: $1,000 → create 45.50, stamp 80.00, credit 20.00, confirm draft 12.75 → net −38.25 → **$961.75**, and a retry moves nothing. Hash v2 = `sha256("v2|account|date|desc|out|in")` + `#n` for identical rows in one file: `balance` dropped (re-issued statements used to re-import wholesale), `account_id` added. Merchant mappings are learned only from rows that actually landed, stored under the normalized merchant with a friendly display name.
- ✅ 2026-08-19 — **BUD-21** `/statement-import` full-screen page replaces the Settings-nested dialog (1,659 lines deleted along with the old import route, `useImportTransactions`, and the split-transaction hack). Three buckets (Matched / Needs review / Skipped) mirror the reconciler. Grouping is by **full normalized merchant** — "le gray" and "le mall" are finally separate — and a group category is a *default for rows that have none*, inverting the old behavior where one group choice overwrote every member; any row can be detached (✂) into its own group. Per row: category/subcategory with **inline creation** (`refetchQueries`, the only thing that beats the persisted 1 h cache — this is the "I created a subcategory and had to start over" bug, dead), date edit, group-level −1/−2/−3d shift for posting lag, skip/restore. Review state persists to IndexedDB after every change (`src/lib/statementImportSession.ts`) with a Resume banner and Undo-able discard, so navigating away no longer destroys the work. Pure decision logic lives in `src/features/statement-import/sessionModel.ts` (17 tests) — buckets, category resolution, and decision → commit-action mapping, deliberately conservative (a row writes nothing until its intent is unambiguous). Registered in `STANDALONE_APPS` + `MobileNav.standaloneRoutes` (own sticky commit bar). Verified in-browser against the owner's real 71-row Italy EUR statement.
- ✅ 2026-08-19 — **BUD-22** Statement import cleanup + docs. Deleted dead `src/lib/statement-parser.ts` (never imported) and the 111-line `LEBANESE_MERCHANTS` table whose `suggestedCategory` fields were never read. Fixed a false currency warning found during in-browser verification: the sniff returned the first currency code found anywhere in the header, so the Italy EUR statement was reported as USD ("Fresh USD" is this bank's product name) and advised importing elsewhere — detection now requires an explicit `Currency: XXX` label, and the hint is transient rather than persisted so a stale wrong value can't survive in a saved session. Vault guide rewritten to the audit model (the old one described a dialog that no longer exists, a per-row control the old UI never had, and ~30 merchants that were never in the code); Feature Map rewritten (its `src/app/api/statement-import/route.ts` pointer never existed); Atlas page + feature entries filled in; `App Routes and Icons` row added.
- ✅ 2026-08-19 — **BUD-23** Statement import rollback + account-scoped dedupe. **(1) Silent data-loss blocker** — `buildCommitActions` took the create account from the row's *merchant mapping* (`decision?.account_id || row.account_id`) and `continue`d when it was null. On a first import nothing has been learned yet, so EVERY create action was dropped and Commit reported "0 created" with no error at any layer; it also meant a mapping could route a row to account B under a fingerprint hashed for account A. Creates now always land in the session account (`sessionModel.ts`), the parser stamps that same account onto each row, and the parse route no longer lets a mapping learned on another account supply a category (`user_categories.account_id` is NOT NULL, so it would fail per-row at commit). Two regression tests in `sessionModel.test.ts`. **(2) Rollback** — a commit is now a durable, reversible batch: the route opens a `statement_imports` record and writes one `statement_import_entries` row per transaction (both the state it found and the state it wrote, plus the signed delta) *before* any balance moves, returning **503 having changed nothing** if either write fails. `POST /api/statement-import/imports/[id]/revert` replays it backwards — created rows soft-deleted to the Recycle Bin with `statement_hash` freed so the file stays re-importable, stamps un-stamped, confirmed drafts re-drafted with their original category/amount, merchant mappings restored to their pre-import value (or deleted if the import invented them), one balance write per account. Rules are pure and tested in `src/lib/statement-revert.ts` (19 tests) with the inverse worked example: $961.75 → **$1,000.00**, and a second pass moves nothing. Two invariants decide every edge case — deltas come from **live** row state (an amount edited after the import still nets to zero) and a newer human edit is never overwritten (except on rows the import itself created, which go anyway and are counted in the receipt). Rows another import has claimed, or purged from the bin, are reported → `partially_reverted`. **(3)** History UI on the `/statement-import` upload screen (`ImportHistory.tsx`): expandable per-row ledger with a live "edited since" badge and a confirm step that states exactly what will happen. **(4)** Fixed a pre-existing app-wide bug found while tracing this: Recycle Bin **restore never re-applied a transaction's balance** (delete reverses it, restore didn't), so every restore left the account permanently short — `api/recycle-bin/restore/route.ts` now re-applies the delta for non-draft transactions. Migration `migrations/2026-08-19_statement-import-rollback.sql` (extends `statement_imports`, new `statement_import_entries` with denormalized `user_id` RLS per Hard Rule 20, and the **missing UPDATE policy on `statement_imports`** — it had SELECT+INSERT only, so marking an import reverted would have silently affected 0 rows) — **pending owner run**. Tests: 1,659 pass, typecheck + lint clean.
- ✅ 2026-08-21 — **BUD-29** Mobile expense form: fixed a false-positive long-press in `useLongPress` (`MobileExpenseForm.tsx:191`) that flipped Account/Category/Subcategory into drag-reorder edit mode mid-swipe. Root cause was two gaps in the hook — no `onTouchCancel` handler, so a swipe-back gesture handed off to the browser/OS (which fires `touchcancel`, not `touchend`) left the 500ms timer running and it fired anyway; and no `onTouchMove` movement check, so even an uncancelled swipe taking ≥500ms still triggered edit mode mid-gesture. Added `onTouchCancel: clear` and an `onTouchMove` handler that cancels the pending timer once the touch has moved >10px from its start point. Also moved `MerchantNoteInput` (merchant/note free-text field) from directly under the step header to directly below the tile grid/reorder list, on both the Category and Subcategory steps (all three render branches, including the "no subcategories yet" branch where it now sits below the "Add subcategory" button).
- ✅ 2026-08-19 — **BUD-25** `/statement-import` rebuilt for the phone — the screen it is actually used on. The review list stacked a group category picker, a date-shift row, and every statement row expanded inline with its own date input, two ~28px icon buttons and **two side-by-side `Select` dropdowns**; at 400px those triggers show truncated text and one merchant costs a scroll plus three taps through a native listbox. Now the list is a flat list of **merchants** — one tap target each, two lines: merchant + amount, then either a colored category chip or a bright “Choose category” pill, so unfinished work is scannable without reading. Tapping one opens `GroupSheet` (vaul drawer, phone-width even on desktop), whose primary control is the **same 3-across category tile grid the expense form uses** (`CategoryPicker` rewritten from selects to tiles, inline creation kept incl. the `refetchQueries`-beats-persisted-cache trick): tap a category → subcategory step if it has any, otherwise the sheet closes itself. **Two taps per merchant** is the whole loop. Everything rare — a different category for one row, a date fix, skip, the −1/−2/−3d posting-lag shift — moved behind a collapsed “N rows” disclosure inside that sheet; the ✂ detach control was dropped as redundant with the per-row category (the model still honors `detached_from_group`). Filters became a full-width segmented control over a progress bar (`34/71 done`), the commit bar a single primary `Save N · M left` with Discard demoted to an icon, the receipt three big numbers, and past imports collapsed behind a toggle instead of burying the upload button. **Two bugs found while verifying in-browser:** (1) both sticky bars painted `background-color: var(--theme-bg)` — that variable is **never set on this page** (`getComputedStyle` → empty), so the header and the commit bar were transparent and the cards scrolled straight through them; both now use `tc.bgPage`, which is what Hard Rule 15 prescribes. (2) A row the matcher only *probably* matched could be re-categorized as a new transaction — i.e. **double-writing money already logged** — and, once you answered “not a match”, the old single-row branch kept showing the match card forever with no way to categorize it. Those rows are now hoisted into their own “Might already be logged” section above the merchant list, and answering “not a match” drops the row into the merchant groups. Also fixed: the sheet showed nothing selected while the list card read “Travel” (a learned merchant mapping resolves through `resolveRowCategory`, not `group_categories`) — the grid now reflects the effective category, or nothing when rows disagree. No change to `sessionModel.ts`, the hooks, or any API route — presentation only; 19 session-model tests, typecheck and lint clean. Verified in-browser against the owner’s real 71-row Italy EUR statement.
- ✅ 2026-08-24 — **BUD-30** Statement import: own-account FX rows stopped being written as money, renames decoupled from the dedupe key, and the review screen split by trust level. **(1) Money bug (the reason for the batch).** `isTransferDescription()` only recognised `/transfer\s+(from|to)/`, so the owner's bank's own-account FX legs — `"Own Account Exchange: USD to EUR at 0.852 - from 501400630004"` — fell through as ordinary debits/credits and were **created as real income and expense**. The two legs cancel on the balance, which is exactly why it stayed invisible: the account total was right while analytics accrued phantom income and phantom spend on every internal transfer (money-rules Invariant 4). Replaced with a named `OWN_ACCOUNT_PATTERNS` list (own account / account exchange / internal transfer / between own accounts), deliberately conservative and anchored to an explicit "account"/"transfer" word — a false positive silently drops a *real* expense, the worse failure, so bare `/exchange/` is rejected and pinned by a test using "Currency Exchange Hamra" and "The Exchange Bookshop". `getTransactionType()` in `bank-statement-parser.ts` mirrors the rule (and the 2-amount fallback now reads `- from 5014…` as money **in**, where it previously defaulted every own-account leg to money out). Worked example — the owner's 07/08 statement page, 4 FX rows (150.00 in, 150.00 out, 0.85 in, 0.85 out): **before** = 4 transactions created, balance delta 0, analytics +150.85 phantom income and −150.85 phantom spend; **after** = 0 transactions, 0 delta, 0 phantom. **(2) Exact-hash now beats the transfer rule** in reconcile pass 1, so FX rows written by the pre-fix importer report "imported before" instead of hiding in Skipped — the only signal that points at the phantom rows already in the ledger. **(3) Rename with a preserved key.** New `RowDecision.description`; `buildCommitActions` stores it while `statement_hash` stays the parse-time fingerprint of the **raw** bank text, so "PrePaid" → "ALFA Prepaid Phone" is safe and re-importing the same statement still dedupes. Blank/whitespace falls back to the bank text. Renames are per-row and manual by design — deliberately *not* learned into `merchant_mappings`. Editable in `GroupSheet`'s per-row controls (bank text stays on screen above the input) and in the new stepper. **(4) `already_imported` split out of `matched`.** New `imported` bucket: "Imported" (fingerprint hit — machine-certain, unactionable, rendered as a compact date-grouped receipt) is now a separate tab from "Logged" (the matcher's judgement that a bank row is one of your manual entries — needs an eye). One tab used to hold both, burying a handful of guesses inside a pile of certainties. `MatchedRowCard` now leads with a labelled **Bank** vs **You** wording comparison instead of a trailing `you logged "…"` clause. **(5) `ReviewStepper.tsx`** — opt-in one-row-at-a-time drawer over `undecidedRows()`, offered from the Review tab past 2 outstanding rows: progress bar, rename input, category grid that auto-advances, Skip, Back/Next. The queue is **snapshot on open**, because answering a row removes it from the live undecided list and would renumber the steps under the owner's thumb. A carousel over the *whole* statement was considered and rejected — one interaction per row even for rows needing nothing, no overview, and it fights the page's own scroll. 1,747 tests pass (7 new), typecheck + lint clean. **No DB change, no migration.**
- ✅ 2026-08-24 — **BUD-33** Statement import: deliberate account targeting, per-row overrides, and cross-account duplicate flagging. **(1) The account was chosen by not noticing it.** `page.tsx` pre-selected `is_default` the moment accounts loaded, so the dropdown already read "Wallet", Upload was already enabled, and the account was **never displayed again** for the rest of the review (its only appearance was inside the currency-mismatch banner, which usually never fires). The target of a bulk money write had no deliberate choice and no visible confirmation. Removed the default entirely — Upload stays disabled until an account is picked — and the review header now reads "Importing into &lt;account&gt; · &lt;currency&gt;" for the whole session, with a **Change** control that discards and restarts (the fingerprints are built from that account and the uploaded file is not retained, so switching in place would silently mis-key every row). **(2) Per-row account override.** New `RowDecision.account_id` + `resolveRowAccount()`; `buildCommitActions` uses it and the commit route already validated ownership, category↔account scoping and per-account balance deltas for arbitrary create accounts, so no route change was needed. Motivating case: bank fees on a salary statement are a charge against the expenses account, not salary income. Changing a row's account clears its category (`user_categories.account_id` is NOT NULL). **The fingerprint deliberately stays keyed to the STATEMENT's account** — a property of the file, not of the row's destination — so a re-targeted row is still recognised on the next import of the same statement. **(3) Reconcile now looks across accounts**, which is the direct consequence of (2): the window sweep dropped its `account_id` filter and a second unbounded `statement_hash IN (…)` lookup was added, so a row overridden into another account (or one whose date was edited afterwards) is still found by fingerprint. **(4) `other_account` flag** *(owner request)* — a row whose exact date, amount and direction match a transaction in a **different** account is surfaced with "Same one — skip it" / "Different — import it", never auto-resolved: it is either a deliberate past override or a mis-filing worth moving, and only the owner can tell. Description is **not** a gate — a mis-filed transaction is usually hand-typed so its wording is the owner's, not the bank's; it ranks which twin to show, and both descriptions go on screen. Cross-account rows are informational only: they are never matched or claimed, since stamping one would tag a transaction in the wrong account with this statement's hash. 1,761 tests pass (+9), typecheck + lint clean. **No DB change, no migration.**
- ✅ 2026-08-24 — **BUD-34 + BUD-37** Self-healing fingerprints, so a formula change repairs its own history. **(1) The probable-duplicate tier is now one-to-one.** It used `candidates.find()`, so every statement row matching the same criteria resolved to the *same* already-imported transaction: a month with two identical charges where only one had been imported marked BOTH as already-imported and silently dropped the genuinely-new one — a **missing** transaction, worse than a duplicate. The owner's data is exactly this shape (eight consecutive months of `Monthly Charges-Standard Plan` at $1.99). Now filters, sorts by closest posting date with an id tiebreak, and claims each transaction at most once (`claimedAsDuplicate`, which exact-hash hits join too). Same guarantee BUD-19 gave same-account matching. **(2) `rekey` — the fingerprint upgrade.** `RowClassification.already_imported` now carries `stored_hash`; when the fuzzy tier recognises a row whose stored hash differs from the current formula's, the commit step overwrites it with the current one. Balance-neutral by construction (only `statement_hash` is written), guarded on the previous hash so a concurrent run or a later import is never clobbered, ledgered like every other change and walked back by `planRevert` (a re-key that drifted is skipped, not forced). A 23505 means the new fingerprint already belongs to another row — a genuine duplicate rather than an outdated key — so it is left alone. Receipt reports it separately and does **not** count it in `transactions_count`, because no money moved. **Why it matters:** v1→v2 (2026-08-19) shipped with no backfill and left 152 rows matchable only by *resemblance*, which is the weaker guarantee and the one with the `find()` flaw above; re-importing now promotes them to identity matching. This is the general answer to "a future change that impacts statements should include historic data correction" — the correction rides along with the next import instead of needing a migration nobody remembers. Migration `migrations/2026-08-24_statement-import-rekey-action.sql` widens the `statement_import_entries.action` CHECK — **pending owner run, and it is a hard prerequisite**: the ledger is written as one batch, so without it the CHECK rejects the `rekey` row and the entire commit returns 503 having changed nothing. 1,767 tests pass (+8), typecheck + lint clean.
- ✅ 2026-08-24 — **BUD-41** Statement matcher read transaction direction from the wrong field, so **every income row would have re-imported as a duplicate**. Caught live on the owner's first real re-import (August 2025 Salary): a $2,524 salary deposit already in the ledger came back as `unmatched` and was offered as a new transaction. Root cause: the matcher compared `tx.is_debt_return !== (row.type === "credit")` in three places. The stored row carried `is_debt_return = false` — what the old import route wrote for income — while the parser correctly read the statement line as a credit, so two encodings of the SAME fact looked like a direction conflict. On an income or saving account `is_debt_return` is redundant: `getBalanceDelta()` adds either way, which is why both encodings were always balance-correct and the disagreement stayed invisible. Replaced with `movesMoneyIn(tx) = tx.is_debt_return || tx.account_type !== "expense"`, deriving direction exactly the way the balance derives sign; `CandidateTx` gained `account_type` and the reconcile route now fetches every owned account (it needed the names for `other_account` anyway, so this is one query, not two). The fix deliberately does NOT collapse direction — a money-OUT statement row still refuses to match an income-account row, because an income account can only add. **Why it mattered so much:** all 16 Salary rows plus every future month would have duplicated, and the receipt would have looked plausible (`created 16`) rather than wrong. **Process note:** this is the case the "stop if the Review tab shows rows already in your ledger" gate was written for, and it worked — the owner stopped before saving. Tests: 3 regressions pinning the exact shape (both `is_debt_return` values match on income; a debit row still does not match income money-in; the fuzzy tier still recognises an income re-import so it can be re-keyed). 1,770 pass, typecheck + lint clean.
- ✅ 2026-08-24 — **BUD-42** Statement import: bank wording stored, category›subcategory shown, per-row amount. **(1) `transactions.bank_description`** — the statement line kept verbatim beside the human `description`. The owner's wording drifts between imports ("Spinneys" one month, "Supermarket Spinneys" the next) which makes it a poor grouping key; the bank's text is machine-generated and stable. It **cannot** be recovered from `statement_hash` — SHA-256 is one-way over free text, so storing it is the only option, and that was the actual question asked. Written on **create, stamp AND rekey**, so the month-by-month re-import backfills it across history for rows originally logged by hand — no separate backfill script. Always `row.description` (raw), never the rename, since the rename is the drifting half. Ledger carries the prior value on both sides and revert restores it, but only when the import actually wrote one (otherwise a revert would blank a pre-existing value). Migration `2026-08-24_transactions-bank-description.sql` + partial index on `(user_id, bank_description)` — **pending owner run, and it must precede the deploy**: the commit route writes the column, so code-first breaks every import on an unknown column. **(2) Category › subcategory chips** on the merchant card, resolved only when every row agrees (same rule the parent chip already used). Fixed the underlying bug too: `pickCategory` cleared `subcategory_id` unconditionally, so re-tapping the category a row ALREADY had — opening Food to check a learned Spinneys mapping — silently dropped Groceries and showed the grid with nothing selected. Now only a genuine change of parent drops the child. **(3) Per-row amount** in the GroupSheet row controls, beside the bank line, matching the per-row date; previously only the group total was visible, so a multi-row merchant could not be read row by row. 1,772 tests pass (+3), typecheck + lint clean.
- ✅ 2026-08-24 — **BUD-43** Statement import: skip-all, backfill-only re-imports, and skips that persist. **(1) "Skip all N remaining"** in the Review tab — a statement can be mostly rows that are not spending, and clearing them one at a time was the slowest part of the review. The Undo restores the exact prior decisions rather than clearing them, because some of those rows may already carry a category or a rename. **(2) Re-importing a fully-healed statement was impossible.** `buildCommitActions` only emitted a `rekey` when the stored fingerprint was STALE, so a statement whose hashes were all current produced zero actions — Save sat disabled at "0 rows" and `bank_description` could never be backfilled for that history. An already-imported row is now re-written for two reasons: stale fingerprint **or** missing/drifted bank wording; the guard uses the currently-stored hash, so for a current fingerprint the write is a no-op on the hash and only the wording lands. The commit route's no-op check was widened to match — hash-only would have reported "nothing to do" and left the column empty forever. **(3) Standing skips** *(owner asked whether these should persist — yes)*: a skip is a decision about a bank ROW, not about one upload, so it is recorded in the new `statement_skipped_rows` against the fingerprint and honoured on every future import as `skipped_before`. Keyed on the hash rather than the file, so it survives a wider re-upload (one month vs a full year) and a re-downloaded PDF. Transfers are deliberately not recorded — the matcher re-derives those every run. Restore from the Skipped tab emits `unskip`. Deliberately NOT part of `statement_import_entries`: reverting an import should not silently un-skip rows ruled on separately. Migration `2026-08-24_statement-skipped-rows.sql` (RLS via denormalized `user_id`, direct predicate per Hard Rule #20 — reconcile queries this on every import, so it must be an index lookup) — **pending owner run**. 1,776 tests pass (+9), typecheck + lint clean.
- ✅ 2026-08-24 — **BUD-44** Statement import review screen de-noised, plus a new standing rule about it. The owner: *"too many texts and descriptions and too much noise… you are adding on production, on the UI, way too many texts to explain things that are pretty clear for me… it is getting too frustrating."* That is a pattern across several turns of this session, not one bad card, so the fix is **CLAUDE.md Hard Rule #28 — "UI text is a cost, not a feature"** (buttons are 1–2 word verbs; no reassurance text; no banner restating its own tab; never justify a design decision on screen; use an `i` affordance when help is genuinely needed) mirrored to AGENTS/CODEX/copilot. Applied it: the `other_account` card went from *"Same date, amount and wording already sits in Debit Card - NEO. Filed there by mistake, or genuinely a separate charge?"* + *"Same one — skip it"* / *"Different — import it"* to **"Also in Debit Card - NEO"** + **Skip** / **Import**; deleted the Imported-tab banner (the tab name already says it), the Logged-tab banner, the rename and account-override reassurance lines in GroupSheet, the stepper's *bank says “…”* caption, the upload-screen field label and sub-caption; shortened the receipt line and the change-account confirm. **Sub-navigation added under Review** (Categorize / Other account / Maybe logged, segments only shown when non-empty, auto-falls back when one empties) — Review was stacking three unrelated jobs into one scroll, so with 31 rows the merchant list sat below a dozen other-account cards. Also removed the now-dead `importedByReason` memo and a dead `renamed` var. **Not regressions:** the owner reported the Skip-all button and the per-row amount missing; both were present in the working tree (`page.tsx` skip-all under the stepper, `GroupSheet.tsx:321-326` amount) — they were viewing a build predating those two turns. 1,776 tests pass, typecheck clean, lint back to the 919-warning baseline.
- ✅ 2026-08-24 — **BUD-45** `other_account` rows became inspectable. The card could only show a truncated description, so the decision it asks for — same money, or a genuinely separate charge? — was being made without seeing either side in full. New `OtherAccountSheet` puts both on screen: the bank's row and the twin transaction, each with its own date, amount and untruncated wording, with Skip / Import in the footer. The card itself gained the date (matching `ReviewGroupCard`) and its title area is now the tap target, with the actions kept separate so a mis-tap cannot decide anything. Written to Hard Rule #28: labels and values only, no explanatory prose.
- ✅ 2026-08-24 — **BUD-38 + BUD-40 resolved** — transfers split by counterparty, and rows auto-targeted at an account that can represent their direction. **(1)** `isTransferDescription()` now matches OWN-account wording only (`transfer from|to own`, `own account`, `account exchange`, `internal transfer`, `between my|own accounts`); the blanket `/transfer (from|to)/` that swallowed everything moved to the new `isPersonTransfer()`, and those rows are imported. "Transfer to RACHA SAMIR TOUMA via Mobile" is real spending; "Transfer from SALIM …" is real income — both were being silently skipped, which is the defect flagged as BUD-38/40 and left open pending the owner's call. Direction is taken from the statement's MONEY IN / MONEY OUT columns, never inferred from the wording. Parser's `isOwnAccountDescription()` widened to match. **(2) `suggestAccountForRow()`** — a money-OUT row on an income or saving account is unrepresentable: `getBalanceDelta()` can only ADD there, so the owner's $400 `Audi ATM Cash withdrawal` on a Salary statement would have *raised* Salary by $400. Such rows now default to an expense account (preferring `is_default`). Money IN from a person on an expense account defaults to an income account — income rather than a card refund; an ordinary merchant refund deliberately stays put, since `is_debt_return` represents it correctly. Both are DEFAULTS only: the per-row select still wins, and the merchant card appends the target account to its date caption so an auto-redirect is visible rather than silent. `buildCommitActions` / `resolveRowAccount` take the account list; an empty list disables the suggestion. 1,782 tests pass (+6), typecheck clean, lint at baseline.
- ✅ 2026-08-24 — **BUD-46** Household transfers import as TRANSFERS, not transactions. "Transfer to RACHA SAMIR TOUMA via Mobile" is money moving inside the household: it nets to zero, so writing it as spending is money-rules Invariant 4. It now creates a `transfers` row (`transfer_type='household'`, `recipient_user_id`, `household_link_id`) — a different TABLE from `transactions`, which is what keeps it out of every spending aggregate by construction instead of by a flag. The sender's leg carries no category; what the partner later spends it on is a separate transaction with its own. **Counterparty, not wording, is the discriminator:** `matchHouseholdMember()` tests the line against household profile names and requires EVERY significant word to match (banks pad with middle names), because a false positive would erase real spending from every total — "Transfer to SALIM IBRAHIM SAADEH" stays an ordinary importable transaction. **Only the sender records it:** `POST /api/transfers` requires the creator to own the from-account and the partner the to-account, so a receiving leg structurally cannot mint a second copy — it recognises the sender's (`existing_transfer_id`, amount + date window) or waits in Skipped until they import. That answers "transfers should match between us" as *recognition*, not a second write, which is the only version that cannot double-count. Destination account is picked per row (owner's choice — no counterparty mapping table), restricted to the partner's accounts since the API rejects anything else. **Fully revertible**, which was non-negotiable because this moves money on TWO users' balances: migration `2026-08-24_statement-import-transfers.sql` adds `statement_import_entries.transfer_id` + the `create_transfer` action, the planner reverses both legs from the ledger, and the route soft-deletes the transfer. New **Household** sub-tab in Review. **Pending owner run — must precede deploy** (commit route writes both column and action; code-first fails the ledger insert and returns 503). 1,786 tests pass (+4), typecheck clean, lint at baseline.
- ✅ 2026-08-24 — **BUD-47** Household-transfer detection no longer DEPENDS on profile names — and `profiles` turned out to be empty. The owner reported no rows in `public.profiles`; names come from `auth.users` metadata, which PostgREST cannot reach, which is exactly why the `profiles` mirror exists. Two findings: **(1)** the empty table silently degrades four unrelated features to an email prefix or "Someone" — `useHouseholdMembers` (partner reads as "aounelio"), `hub/messages`, `cron/chat-notifications`, `nfc/[tag]`. Migration `2026-08-24_backfill-profiles.sql` backfills from `auth.users` and adds the standard `on_auth_user_created` trigger so it stays populated. **(2)** more importantly, matching on a profile name was *fragile regardless* — a bank statement carries a legal name ("ELIO ANTOINE AOUN") while a profile holds a display name ("Elio"), so even a populated table would often miss. Reworked: **every** person-to-person transfer is now classified `person_transfer` and surfaced for a decision, with `household_match` as a HINT that pre-selects the transfer path rather than a gate that enables the feature. New `treatsAsTransfer()` — the owner's explicit pick wins, defaulting to the hint; "Not household" moves the row into the categorize list as ordinary spending. `extractCounterparty()` pulls the name off the line for display, so the card is readable with zero configuration. Net effect: the feature works with an empty `profiles` table and merely gets better when it is filled. **Also fixed a real self-inflicted bug:** a Python heredoc had written literal backspace bytes (0x08) into the `extractCounterparty` regex in place of `\b`, so it never matched and every counterparty fell back to the whole raw line — caught by the new tests, repaired at byte level, and the repo scanned for other stray control characters (none in source). 1,787 tests pass, typecheck clean, lint at baseline.
- ✅ 2026-08-24 — **BUD-48** Transfers promoted to a top-level tab, and parsing of person-to-person transfers pinned by test. The owner reported transfers "not showing" and asked whether parsing dropped them — **it does not**: new fixtures in `bank-statement-parser.test.ts` prove `Transfer to RACHA SAMIR TOUMA via Mobile - Car` and `Transfer from SALIM …` both parse with the correct date, amount and direction (`transfer_out` 200.00 out / `transfer_in` 20.00 in). They were simply one level down, inside the Review sub-navigation, which is exactly the discoverability failure the report describes. **Transfers is now its own top-level tab** (Review / Transfers / Imported / Logged / Skipped) with its own empty state. Also corrected a test of mine that had encoded the OLD invariant — it asserted "whatever the parser types as a transfer, the matcher skips", which stopped being true when own-account and person transfers were split. The parser's `transfer_in`/`transfer_out` is a SHAPE label (this line reads like a transfer), not an instruction to ignore the money; only own-account moves are skipped. Re-pinned as "skips own-account moves and only those", so re-conflating the two ideas — which would silently drop a payment to a friend — now fails a test. 1,789 tests pass (+2), typecheck clean, lint at baseline.
- ✅ 2026-08-24 — **BUD-49** Transfers tab was unreachable — my bug, not a cache. The owner reported the new tab missing after clearing caches; it was never wired. The edit that was meant to add `["transfers", "Transfers", …]` to the top-level tab array searched with 24-space indentation while the array uses 20, so the `.replace()` matched nothing and returned silently — and I had not asserted on that particular call. The paired edit that REMOVED "Household" from the Review sub-navigation *did* match, so the net effect was worse than a no-op: the `filter === "transfers"` block existed with no control able to select it, making every person-to-person transfer unreachable in the UI. **Lesson, now applied throughout: every scripted string replacement asserts its match count.** Two edits this session died the same silent way (this one, and the `extractCounterparty` regex that got literal 0x08 bytes). Fixed by wiring the tab; 1,789 tests pass, typecheck clean, lint at baseline. **Tooling:** `pnpm dev:clean` (`scripts/dev-clean.mjs`) removes `.next` and `node_modules/.cache` before `next dev`, because a stale `.next` is SERVER-side output that no amount of browser hard-reloading can touch — which is the shape of "new code on disk, old UI on screen". Verified the dev service worker is not a factor: `ServiceWorkerRegistration.tsx:128-146` skips registration outside production AND actively unregisters leftovers and deletes every Cache Storage entry.
- ✅ 2026-08-24 — **BUD-50** Transfers tab shows every transfer, and partner money carries the partner's colour. The owner reported `Transfer to RACHA SAMIR TOUMA` sitting in Review with `Transfers 0`. Cause: `householdRows` gated on `treatsAsTransfer()`, which defaults to the household NAME match — so a row only reached the Transfers tab if the profile name matched. That contradicted the principle set two turns earlier ("`household_match` is a HINT, never a gate"): I applied it to the classification but not to the tab, so a missed match hid the row in the merchant list rather than merely costing a tap. **The tab now holds every `person_transfer`**; the name match only pre-selects the household path on the card. Each card carries a **Partner / Not partner** toggle, the direction (`sent` / `received`) beside the date, and — when it is partner money — the PARTNER's identity colour on the title and border, per Hard Rule #14 (colour follows the person: blue when the owner's theme is pink, pink otherwise), derived the same way `ShoppingListView` does. Also removed a stale "already in the ledger" comment that had travelled with the block when it moved tabs. 1,789 tests pass, typecheck clean, lint at baseline.
- ✅ 2026-08-25 — **BUD-51** Five gaps the owner found from a real 379-row statement review: Restore was a dead end, withdrawals were unhandled, Transfers couldn't become transactions, Review/Transfers double-counted, and Skipped had no way to hide noise. **(1) Restore was a dead end.** `skipped_before` was a STATUS (`{status:"skipped_before"}`), so a restored row had no real classification left to route it anywhere — `getBucket` short-circuited to `skipped` regardless of the decision, and Restore just raised the Save count with the row stuck on the Skipped tab forever. Made it a FLAG instead: `RowClassification = RowStatus & {skipped_before?, memo?, withdrawal?}` in `statement-reconcile.ts` — the matcher now classifies every row fully (matched/person_transfer/unmatched/…) and stamps `skipped_before` on top in a final pass, so Restore falls through to the row's real bucket (Review/Transfers/Imported/Logged). Legacy sessions already in IndexedDB (up to 3, `MAX_SESSIONS`) still carry the old status shape — kept as a variant in `RowStatus` so they resolve sanely without a migration. Restore now toasts "Restored to &lt;tab&gt;" with Undo. **(2) Withdrawals.** No parser type, no classification, no UI existed — an ATM or voucher withdrawal fell through as an ordinary `unknown`/`unmatched` merchant row. New `cash_withdrawal` parser type + `classifyWithdrawal()` (ATM vs voucher, by the word "voucher") + `extractStatementMemo()` (everything after the FIRST " - " in the bank line — "Voucher … for Voucher No 123 - Car Insurance" → memo "Car Insurance", used as the merchant name AND the default transaction description). Both are FLAGS like `skipped_before`, so an already-imported or hand-logged withdrawal still reports its real status. A withdrawal now lands on the Transfers tab's new **Cash** sub-nav: "To wallet" emits a SELF `create_transfer` (cash moving, not spent — `transfer_type` is new on the action, `"self" | "household"`, `transfers.transfer_type` already allowed `'self'` in schema.sql so no migration); "Spent" is an ordinary categorised `create`, pre-filled from the memo, with `learn_mapping` suppressed since a withdrawal's `normalized_key` is a reference number, not a merchant. **(3) Transfers → transactions.** A non-partner transfer ("Not partner") used to have nowhere to go — no rename input, no category picker. `TransferRowCard` now shows sent (muted, ↑) vs received (emerald, ↓ with a `+`) at a glance, an editable description defaulting to the memo (the note the owner typed in the bank app — "Transfer to ELIE JOSEPH AZAR via Mobile - 'link bowling - mkalles - for 2'" → default description "link bowling - mkalles - for 2"), the raw bank line kept visible beneath, and — only when not-partner — a `CategoryPicker` scoped to whichever account the row actually resolves to (income for received, since `suggestAccountForRow` already routes money-in person-transfers there; the statement's own for sent). New `CategoryChip` + `CategoryPickerSheet` (a `CategoryPicker` in a bare Drawer, factored out of `GroupSheet` for a single non-grouped row) shared by `TransferRowCard` and `CashWithdrawalCard`. **(4) Review/Transfers double-counted.** `getBucket` returned `"review"` for every `person_transfer` (unless already imported) WHILE the page separately hoisted every `person_transfer` onto the Transfers tab — so Review's count included the same rows Transfers displayed, and `undecidedRows()` (which only checked the review bucket, not what kind of decision a row needs) fed the "Review N one at a time" stepper transfer/other-account rows the Categorize list never shows. New `Bucket` value `"transfers"`: `getBucket` now routes every `person_transfer` and every unmatched withdrawal there, `undecidedRows` excludes `other_account`/undecided `probable`/`ambiguous`, and a new `countOpen()` (review ∪ transfers, minus rows waiting on the sender's own import) replaced `countUndecided` for the Save button and resume banner's "N left" — those had counted only the review bucket, which undercounts now that transfers live outside it. Verified live against the owner's real statement: Review dropped from a reported 20 (6 real) to a correct 6, and from 279 to the true review-only count on the larger one; the stepper stopped touching transfer rows. **(5) Skipped noise.** "Show/Hide own transfers N" toggle, default hidden — `visibleRows` filters `classification.status === "transfer"` rows out of the Skipped tab unless toggled, no session-state change (a view preference). **Verified end-to-end in-browser** against the owner's real 379-row NEO statement (Resume → skip an `other_account` row → Restore → toast "Restored to Review", row reappeared in Review and Skipped count dropped correctly; income-account `CategoryPicker` correctly showed the Salary account's categories, not the statement account's, and picking one updated the Save count). **Dev-environment note, not a code bug:** partway through verification the browser kept rendering old UI despite fresh compiles (confirmed via curl and `fetch({cache:'no-store'})` that the server had the current code) — root cause was Chrome caching the Turbopack dev JS chunk (`Cache-Control: public, max-age=31536000, immutable` on a chunk URL that doesn't change name per edit in dev); a hard reload (Ctrl+Shift+R) fixed it, `pnpm dev:clean` did not (server-side cache was never the problem this time). Worth remembering alongside BUD-49's note on the same symptom with a different cause. 1,806 tests pass (+17), typecheck clean, lint at the 919-warning baseline. **No DB migration** — `transfers.transfer_type` already allowed `'self'` and `statement-revert.ts`'s `create_transfer` reversal already reads the ledger entry generically (verified with a new revert test, not previously covered).
- ✅ 2026-08-25 — **BUD-55** The parser read an FX rate as the row's amount — the reason BUD-54 appeared to do nothing. The owner, after BUD-54 shipped: *"didn't work. It is still in Skipped. Exchange is still showing in skipped not Transfers"*, with a screenshot showing 137 skipped rows reading **`Own Account Exchange: USD to EUR` · $0.85 · Own-account move** — the rate as the amount, and the description cut off before it. **Root cause, and it was upstream of everything BUD-54 built:** `[\d,]+\.\d{2}` is not anchored on its right, so it matches the first two decimals of a THREE-decimal number — and a statement carries exactly one of those, the FX rate. The row wraps across three extracted lines (`08/08/2026 Own Account Exchange: USD to EUR` / `at 0.852 - to 501400630005 -` / `200.00 - 1,909.46`); the row-assembly loop tests each continuation line for money to decide "description or numbers?", `0.852` answered yes, so it took `at 0.852 - to 501400630005 -` AS the numbers line, broke out, and parsed `moneyOut = 0.85`. The real numbers line was then orphaned and dropped. So the description reaching `classifyOwnExchange()` was `"Own Account Exchange: USD to EUR"` with no rate in it — the classifier correctly returned null, the `exchange` flag was never stamped, and BUD-54's routing had nothing to route. Every exchange had been importing at $0.85 since long before BUD-54. **Fix:** the three money patterns are now named constants carrying `(?!\d)` — `MONEY_ANYWHERE`, `TRAILING_AMOUNTS`, `MONEY_OR_DASH` — with the reason documented at the definition, plus a note that the two used with `.test()`/`.search()` must NOT carry `g` (a global regex advances `lastIndex` between calls and would skip every other row; a test pins that). With the guard, the rate line no longer looks like money, so it is rejoined into the description where it belongs and the amount comes off the real numbers line: description `"Own Account Exchange: USD to EUR at 0.852 - to 501400630005 -"`, moneyOut 200.00, balance 1,909.46 — and BUD-54's Exchange section then works as designed. Also suppressed `extractStatementMemo()` on exchange rows: an exchange line's `" - "` separates FIELDS, so the memo rule was about to default the transfer's description to `"to 501400630005 -"`. **Verified the tests actually bite** — reverting just the `(?!\d)` fails exactly the 4 wrapped-row tests and passes the rest, so the coverage is real rather than incidental. 1,855 tests pass (+11: 5 single-line, 5 wrapped-row, 1 memo), typecheck clean, lint at baseline. **No DB change, no migration.** **Lesson for the trap registry:** BUD-54 was correct code sitting on top of a parser that never produced the input it needed. The classifier was unit-tested against a hand-written statement line, which passed — the line the PDF extractor actually emits was different, and nothing tested that seam. When a feature keys off parsed text, test it against the extractor's real output shape, not a hand-typed ideal of it.
- ✅ 2026-08-25 — **BUD-54** Own-account currency exchanges are imported as FX self transfers instead of being skipped. The owner, with the August statement line: *"Own Account Exchange: USD to EUR at 0.852 … Money out 200.00 … it should be logged as a transfer from current account to Trip account with an exchange rate of 0.852 … It should update then the balance of my target account with the rate in consideration: 170.40 EUR."* **The bug:** `isTransferDescription()` recognised these as own-account moves and that was where it stopped — the row classified `transfer`, landed on Skipped, and produced no action at all. That is right for a same-currency internal move (it nets to zero), and **wrong** for an exchange: the destination account gains a DIFFERENT number than the one on the statement, so skipping it left the EUR account permanently short by every exchange ever made. **The fix.** New pure `classifyOwnExchange(description, type)` in `statement-reconcile.ts` reads both currencies, the rate and the counterparty account digits off the line and stamps them as an `exchange` FLAG on `RowClassification` — like `withdrawal`/`skipped_before`, so an already-imported or hand-logged exchange still reports its real status (pinned by updating the existing "already-imported transfer" test). `getBucket` routes the OUT leg to the **Transfers** bucket; every other own-account move still goes to Skipped. New **Exchange** sub-section on the Transfers tab, rendering through `TransferRowCard` with `kind="exchange"`: **no `Transfer | Spent` toggle** (an exchange is a move by definition — offering "Spent" only invites a wrong answer), one data line stating the bank's own arithmetic (`200.00 USD → 170.40 EUR @ 0.852`), and a destination picker over the owner's own accounts now labelled with their currency. Picking one stages a SELF `create_transfer` carrying **`to_amount`** — the converted figure — which the commit route writes to `transfers.to_amount` and passes to `getTransferDeltas(amount, 0, type, toAmount)` so the destination balance moves by 170.40 while the source moves by −200.00. `transfers.exchange_rate` is DERIVED server-side from `to_amount / amount` rather than accepted from the client, so the stored rate can never disagree with the two amounts it relates — the same rule `POST /api/transfers` already follows, and conversion composes only with a plain self transfer for the same reason it does there (fee/returned-amount math assumes one currency). **WORKED EXAMPLE** — Salary (income, USD) 1,909.46 · Trip - Italy (expense, EUR) 0.00. Import the row, destination Trip - Italy: Salary 1,909.46 → **1,709.46** (`transfer_out −200.00`), Trip - Italy 0.00 → **170.40** (`transfer_in +170.40`), `transfers` row `{amount: 200, to_amount: 170.40, exchange_rate: 0.852, transfer_type: "self"}`. Revert restores both exactly, because `planRevert` reads `applied.to_delta` off the ledger entry rather than re-deriving it from `amount` — a symmetric revert would have left the EUR account 29.60 over (new test). Unchanged: every spending aggregate, since a transfer is not a transaction (money-rules Invariant 4) — `stagedNetAmount()` excludes it and a test asserts the Ready headline stays 0. **Two correctness guards.** (a) **Only the OUT leg is actionable.** The identical bank line prints on BOTH statements — MONEY OUT 200.00 on the USD side, MONEY IN 170.40 on the EUR side — and the two rows hash differently because the account is part of the fingerprint, so nothing would have stopped the second import from writing the movement twice. `direction` therefore comes from the statement's own money column, never the wording (which is identical on both sides); the IN leg stays on Skipped labelled "Other side of an exchange". Same rule and same reason as "only the SENDER records a household transfer". (b) **The rate is applied only when the destination is actually in the target currency** — 0.852 is EUR-per-USD, and multiplying a USD wallet by it would invent 29.60 out of nothing; a mismatched destination gets a plain 1:1 move and the card says which amount lands. The picker is deliberately NOT filtered to the target currency (a picker that silently hides accounts is how a row becomes un-answerable). Conversion rounds to cents ONCE in `convertAtRate()` — 200 × 0.852 is 170.40000000000003 in float, and that is the number that would have reached a real balance (money-rules Invariant 8). 1,844 tests pass (+16), typecheck clean, lint at baseline. **No DB migration** — `transfers.to_amount` and `transfers.exchange_rate` already exist (added by the Transfers module) and `statement-revert.ts` needed no change. **Not yet verified in-browser**; the owner's next import of the August statement is the live check.
- ✅ 2026-08-25 — **BUD-53** Statement import review UX, four findings from the owner (*"Statement-Import feature is horrible!"*). **(1) The disappearing row — the one with teeth.** *"AGAIN, when In transfers, choose the Category or choose the transfer to which account, you must not remove it… it should remain showing!!!"* Root cause: **Restore was encoded as `resolution: "undecided"`**, and `resolution` is overwritten by the very next thing the owner does — `updateDecision` promotes it to `"create"` on a category pick, and the destination `Select` sets it explicitly. `getBucket()` then re-evaluated `skipped_before && resolution !== "undecided"` and threw the row straight back onto the Skipped tab, so **answering a restored row made it vanish from the tab it was answered on, at the moment it was answered** — on Transfers and on Review alike. Fixed with `RowDecision.restored`, a durable flag that survives further decisions, read through `isRestored()` (which still honours the legacy `undecided` encoding so a session already in IndexedDB resumes intact) and cleared by `updateDecision` on an explicit skip so no stale `unskip` is emitted. Six regression tests pin it, including the two exact gestures the owner named. **Standing rule added to the Feature Map: never encode durable state as a `resolution` value.** **(2) Two more ways a pick looked discarded, both found while proving (1).** Categories are **account-scoped**, and `suggestAccountForRow()` deliberately redirects rows off the statement account (money-OUT on an income/saving statement → default expense account; person money-IN on an expense statement → income). The page's category map was built from the statement account's list only, so a category picked in a redirected row's grid could not be NAMED — `CategoryChip` fell back to "Choose category" and the pick read as thrown away. `categoryOf()` now merges the statement, income and expense lists. Separately, the Cash card passed `spendAccountId={session.account_id}` while `buildCommitActions` files the row at `resolveRowAccount()` — the picker offered the wrong account's categories and the commit route would have rejected the pair as a category↔account mismatch; now both read `resolveRowAccount()`. And the transfer destination `Select` rendered its PLACEHOLDER whenever the chosen account was absent from `destinations` (partner accounts arrive from a separate query, so this is every resume before it lands) — it now always renders the saved choice via an `accountName` fallback option. **(3) Skipped got a sub-navigation with reasons.** *"I need grouping… go through everything that was skipped and see why"* + *"Previously skipped should have a section so I don't have to think again"*. New pure `skipReason()` splits the bucket into the three populations that arrive by different routes: **This import** (set aside during this review — the only ones still in play), **Previously skipped** (a standing skip recorded by fingerprint on an earlier import — re-deciding these monthly is the exact work the standing skip exists to avoid), **Own moves** (own-account transfers the matcher re-derives every run; no Restore button, because there is nothing to undo). Every row now states WHY, read off the real classification under the skip (`Also in Debit Card - NEO`, `Transfer · SALIM`, `Cash withdrawal`, `Already imported`, `Matches a logged transaction`, `Several possible matches`, `Set aside`). Replaces BUD-51's flat list + Show/Hide-own-transfers toggle, which put a 3-row decision inside 85 rows of remembered noise with no reason shown for any of it. The sub-nav auto-lands on a section that has rows. **(4) Ready reads as the final stage, and Log vs Restore is answered.** *"Ready navigation should be showing off as a final stage… and why some of them are tagged Log, some are tagged Restore?"* Moved **last** in the tab bar (third, it read as just another filter). It now opens with the **net ledger effect as one signed number** (`stagedNetAmount()` — credits add, debits subtract; transfers excluded because they net to zero across the owner's own accounts) over a money/matches/memory count line, then splits the list into three lanes via `actionLane()`: **Money** (`create`, `create_transfer`, `confirm_draft` — the balance moves; a draft was never counted in the stored balance, so confirming applies the delta once), **Matches** (`stamp` — an existing transaction gets the bank fingerprint), **Memory** (`rekey`, `skip`, `unskip` — nothing but what the next import remembers). Money rows keep the primary badge and the amount; the other two lanes get an outline badge and no amount, so the class of each action is legible before Save. That grouping IS the answer to the Log/Restore question. 1,828 tests pass (+12), typecheck clean, lint at baseline. **No DB change, no migration** — `restored` is a client-side session field in IndexedDB. **Not yet verified in-browser** against a real statement; the four behaviours are covered by unit tests on the pure model, and the owner's next import is the live check.
- ✅ 2026-08-25 — **BUD-52** Statement import Transfers tab made straightforward, plus a real partner-account bug. The owner: *"'To wallet' button and the dropdown to selecting the account is confusing. From where to where am i transferring this row..."*, *"me selecting stuff shouldn't act as if i confirmed and want to save directly"*, *"the navigation is truncated, and i can't see the count correctly"*, and a screenshot of an empty **To account** dropdown. **(1) One question per row.** A person transfer and a cash withdrawal ask the identical thing — did the money move somewhere, or is it gone — so `CashWithdrawalCard` was deleted and both now render through one `TransferRowCard` with one **`Transfer | Spent`** toggle (Transfer → pick an account, Spent → pick a category), replacing "To wallet"/"Partner / Not partner" which never said from where, to where, or why it wasn't just spending. The Transfer side now shows `<statement account> → <destination>` explicitly. **(2) Staging, not committing.** A decided row keeps its place and grows a green `✓ Send · Debit Card - NEO → Whish · Racha Touma` line; nothing is written until Save. Added a **Ready** tab — deliberately a CROSS-CUTTING view, not a sixth bucket — rendering `buildCommitActions()` through a new pure `describeCommitAction()` so it can never promise what the commit won't do, one row per action with an owner's-word verb badge (Log / Move / Send / Match / Confirm / Re-tag / Skip / Restore), target and amount. Its count IS the Save button's number. This is the direct answer to the owner's DoD: *"know each row in my statement what action should be done for it"*. **(3) The empty partner dropdown was a real bug, and not RLS — the owner said so and was right.** `partnerAccounts` used `useAccounts()`, which returns only the partner's **`is_public`** accounts, so a partner keeping accounts private produced an empty list with no error at any layer. A household transfer is exactly the case allowed to name a private partner account (BUD-13), and `TransferDialog` — the working precedent — uses `useHouseholdAccounts()`. Switched to that, and identify the partner **explicitly** rather than by subtracting the owner's list, so an account merely missing from `useMyAccounts` (hidden, say) can't be mistaken for the partner's. Verified live: the dropdown returned exactly the partner's four accounts. **(4) Both members use the SAME account names** ("Debit Card - NEO", "Salary", "Wallet" exist on both sides), so a bare name in that picker reads as the owner's own — every partner destination is now labelled `Whish · Racha Touma`. The name comes from a new `useHouseholdPartner()` hook hitting `/api/household` (which resolves via `supabaseAdmin().auth.admin.getUserById`) because `useHouseholdMembers()` reads the `profiles` mirror, and that table is empty on this account (BUD-47) — it was rendering `rachatouma`. Kept as a separate hook so the four features already depending on `useHouseholdMembers`'s shape are untouched. **(5) Nav no longer truncates.** Six tabs whose counts are the information don't fit equal `flex-1` slots with `truncate` — exactly the count got cut. New `ScrollableTabs` (top nav + both sub-navs) gives each tab its natural width, scrolls, and fades scrollable edges with a **CSS mask** rather than a gradient overlay, because `tc.pillBg` is a translucent per-theme colour an overlay would have to match in all four themes; the fade appears only on a side that can actually be scrolled toward. Scroll listener is **native + `{passive:true}`**, not React's `onScroll` (`scroll` doesn't bubble; passive keeps touch-dragging smooth). **Verification note, stated honestly:** the browser harness would not deliver scroll or resize events for programmatic scrolling (a native listener recorded **zero** events while `scrollLeft` demonstrably changed), so the fade's scroll-position transitions could not be confirmed in-browser. Rather than claim it verified, the edge logic was extracted into pure `scrollEdges()` / `edgeMask()` and pinned by 5 unit tests (`ScrollableTabs.test.ts`) covering fits/at-start/at-end/mid-scroll/sub-pixel — durable coverage that outlives the harness. What WAS confirmed live: the bar is genuinely scrollable at 328px (scrollWidth 516) and renders solid-left/faded-right at `scrollLeft: 0`. 1,816 tests pass (+10), typecheck clean, lint at the 919-warning baseline. **No DB change, no migration.**
- ✅ 2026-08-25 — **BUD-56** Transfers created by a statement import now carry the statement fingerprint, so a re-import can't write the same movement twice. The owner asked whether they had one; they did not. **The gap:** `transactions` has carried `statement_hash` plus `transactions_statement_hash_uniq` since this feature shipped, and transfers are the ONE thing the importer writes outside `transactions` — a household transfer, a cash-withdrawal-to-wallet, an own-account FX exchange. Their hash was recorded **only** in the `statement_import_entries` ledger, which `reconcileStatementRows` never reads, and `byHash` was built purely from transaction candidates. So on any re-import of the same period every transfer row came back classified `person_transfer` / `transfer`+`exchange` / `unmatched`+`withdrawal` — indistinguishable from never having been imported — and one confirm moved **both** balances a second time, with no unique index to catch it and nothing on screen to hint at it. This is the last hole in the identity model the rest of the feature is built on. **The fix, in four layers.** (1) `transfers.statement_hash text` + `transfers_statement_hash_uniq` on `(user_id, statement_hash) WHERE statement_hash IS NOT NULL AND deleted_at IS NULL` + a lookup index. (2) The commit route writes the hash on insert and maps a 23505 to `skipped_duplicate`, matching the create-transaction path exactly. (3) The reconcile route looks live transfers up by fingerprint and passes them as `ImportedTransferRef[]`; `reconcileStatementRows` checks them in pass 1 immediately after the transaction-hash hit — ahead of the transfer / person-transfer rules, for the same reason the transaction check runs first: a row that really was recorded must say so rather than be re-offered as an action. New `RowStatus` arm `{status:"already_imported", reason:"transfer_hash", transfer_id}`, deliberately a SEPARATE arm from the transaction one because a transfer has no `bank_description` to backfill and no older hash formula to re-key — there is nothing to upgrade, only something to report. (4) `buildCommitActions` bails on that arm **before every other branch**, which is the non-obvious part: pass 5 stamps `withdrawal` / `exchange` onto every row regardless of status, so those two branches (which key off the flag, not the status) would still have fired on an already-imported row if a stale `transfer_to_account_id` sat in the session — the exact duplicate the fingerprint exists to stop, re-entered through the side door. **The soft-delete decision:** the unique index excludes `deleted_at IS NOT NULL` rather than nulling the hash on revert the way `transactions` does, because a transfer can be removed by reverting its import **or** from the Transfers module, and only the index-level rule covers both — either way the statement row must become importable again. **No balance math changed** — this adds an identity column and a refusal path; `getTransferDeltas` and `statement-revert.ts` are untouched. **Migration `migrations/2026-08-25_transfer-statement-hash.sql` is PENDING the owner's run.** It backfills history from the ledger via `DISTINCT ON (user_id, statement_hash)` so that transfers already duplicated by this bug do not block the unique index — the first copy of each fingerprint is stamped, later copies stay hashless — and ships the query that lists those groups (`transfer_ids`, date, amount) for manual cleanup. 1,861 tests pass (+6), typecheck clean, lint clean on the touched files. **Not yet verified in-browser**; the owner's next re-import of an already-imported statement is the live check, and it cannot be run before the migration.
- ✅ 2026-08-25 — **BUD-57** A standing skip no longer outranks a row's real verdict, which was hiding every recognised row on the Skipped tab. The owner, re-importing two years of statements: *"'Imported' navigation under statement import is null. Shows 0 records... I have lots of salary income rows and none are showing under imported"* — screenshot: **Review 0 · Transfers 0 · Imported 12 · Logged 0**, the 12 being nothing but `Own Account Exchange` rows, with a real salary line (`Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX`, MONEY IN 2,526.00) nowhere on screen. **Root cause — BUD-51 introduced it and BUD-53/54/55 made it visible.** BUD-51 turned `skipped_before` from a STATUS into a FLAG precisely so a restored row could fall through to its real bucket, and then `getBucket` checked that flag **first**, before the switch — which reinstated the old behaviour for every un-restored row. A bank line that is already in the ledger (`already_imported`) or already hand-logged (`matched`) has nothing left to suppress, but if the owner had ever skipped that fingerprint on an earlier import it was routed to **Skipped** anyway, and its true status never appeared anywhere. With 36 rows in `statement_skipped_rows` and 12 exchange rows recognised through BUD-56's brand-new `transfers.statement_hash` (the only fingerprints too new to have a skip against them), the Imported tab collapsed to exactly those 12. The rows were never lost — they were on the Skipped tab, which sits off-screen to the right in the scrollable tab bar, so it read as data loss. **Fix:** `getBucket` now computes the row's real bucket first (extracted as `bucketForStatus`) and applies the standing-skip suppression **only** when that bucket is actionable — `review` or `transfers`. `imported`, `matched` and `skipped` report themselves honestly regardless of the flag, which is what the "a flag, not a status" contract in `statement-reconcile.ts` said all along. Restore is unaffected (`isRestored` still short-circuits the suppression) and no commit action changes class: an `already_imported` row still emits at most the balance-neutral `rekey`, and the standing-skip loop still writes `skip`/`unskip` off the decision, not the bucket. **Also confirmed, so it is not re-investigated:** the parser handles that salary line in all three PDF layouts it can arrive in (single line, wrap-with-amounts-on-line-1, wrap-with-amounts-on-line-2) — probed directly, `moneyIn: 2526`, description intact; and `transfers.statement_hash` **is live in the DB** (verified read-only via MCP `list_tables`), so BUD-56's migration has been run. 1,861 tests pass, including the BUD-51 test updated to the new contract (a `matched` row carrying `skipped_before` now reports `matched`, not `skipped`) plus a new assertion for the `already_imported` case. **No DB change, no migration.** **Lesson for the trap registry:** a cross-cutting flag added "on top of" a classification must state which verdicts it may override. Suppression flags belong AFTER the verdict is computed, never before it.
- ✅ 2026-08-26 — **BUD-59** A transfer's description silently lost words on both sides of the amounts, and one specific shape lost the WHOLE transfer. The owner, from a real e-statement screenshot: a `Transfer to JOHN GEORGES YAZBECK via Mobile - malak el` row wrapped so that `tawouk 2 burgers` printed on the far side of a page break, and the imported row showed as **"(no merchant)" $14, Choose category** — a plain unmatched review row, not a person transfer at all. **Root cause, found by extracting the real fixture PDF's raw text (not by guessing the layout):** this bank sometimes prints the row's date next to the AMOUNTS line instead of the first line of the description — `17/06/2026 POS Purchase SPINNEYS MTAYLEB` / `MTAYLEB LB 0000` / `95.24 - 206.97` / `Transfer to JOHN GEORGES` / `YAZBECK via Mobile - malak el` / `18/06/2026 14.00 - 192.97` / `tawouk 2 burgers` / `18/06/2026 Bill Payment...`. The parser only ever starts collecting a row from a line that BEGINS with a date, so `Transfer to JOHN GEORGES` / `YAZBECK via Mobile - malak el` had no date to anchor to and were silently skipped as noise between transactions; the row it built for `18/06/2026` had an EMPTY description (`type` fell through to `"unknown"`, `merchantName` to `""`) — hence "(no merchant)". Separately, even a normally-anchored row already loses any continuation that wraps PAST its amounts (`tawouk 2 burgers` alone was always being dropped, dateless-amounts row or not). **Fix, in `bank-statement-parser.ts`:** a `pendingOrphan` buffer holds any line that is neither dated nor carries money. The next dated line resolves it two ways — if that line's content is amounts-only (the leading-wrap shape above), the buffered lines ARE this row's description and get prepended; otherwise the buffered lines must be the PREVIOUS row's trailing overflow, so they get appended to the transaction already pushed (recomputing `type`/`merchantName` off the corrected description, not just tacking text onto a stale classification). This single mechanism recovers BOTH the leading wrap and the ordinary trailing wrap with no separate code path. **A second, unrelated bug surfaced by the same fix:** the bank's one-time authenticity footer (`For Verifications` / `Scan the QR code` / `This Tamperproof is digitally signed.` / …, printed once at the very bottom of these single-tall-page statements) has no date and no money either, so it was about to be glued onto whichever transaction happened to sit right before it — confirmed happening to a real `POS Purchase SPINNEYS` row in the fixture corpus. Filtered out by a new `DOCUMENT_FOOTER_PATTERN` before parsing starts. **Verified two ways.** Unit: 4 new tests transcribing the real corpus lines (dateless-amounts wrap recovers both the leading AND trailing continuation; the footer is dropped, not appended; the row before/after stay untouched), plus the existing 390/154/32-row corpus integration tests re-run clean except the ONE intended reclassification (`account_statement_Debit_2025-2026.pdf`: `other` 282→281, `person_transfer` 15→16 — the exact row this bug describes). Live: uploaded the real fixture through the running app — the row now shows on the **Transfers** tab as **JOHN GEORGES YAZBECK $14.00**, `Bank: Transfer to JOHN GEORGES YAZBECK via Mobile - malak el tawouk 2 burgers`, full description recovered. 1,865+ tests pass, typecheck clean, lint clean on touched files. **No DB change, no migration.** **Drift noted, not fixed here:** the vault Overview already cites **BUD-58** (PDF coordinate-aware rendering, `pdf-parser.ts`'s `renderStatementPage`) as shipped, but no BUD-58 entry exists anywhere in this Master Book or its checklist — the code is real and in production, only the Shipped Log entry was never written. Left as-is; flagging so a future sweep doesn't reuse the number.
- ✅ 2026-08-26 — **BUD-60** Statement-import Transactions review cards: a Skip button where the row count used to sit, and the row count moved to a small leading badge. The owner: *"add a skip like under Transfer place it instead of Row count"* + *"if i have multiple rows, put it [the count] before the title in an icon or parenthesis"*. `ReviewGroupCard` previously had no way to set a whole merchant group aside without opening `GroupSheet` first — every OTHER review surface (Transfers' `TransferRowCard`, the `other_account` cards, the per-row `RowControls` inside the sheet) already has an inline Skip. Card split into an outer non-interactive wrapper holding two independent buttons (opening the sheet vs. skipping the group) instead of one big button, since a button cannot nest inside a button; the category chip stays its own tap target so it still opens the sheet directly. Row count (`rowCount > 1` only — a single-row group shows nothing, per Hard Rule #28) renders as a small `Layers` icon + number before the merchant name, mirroring the icon already used elsewhere in this screen for "review N one at a time". New `skipGroup(rowIds)` in `page.tsx` mirrors the existing `skipAllInReview` shape exactly (Hard Rule #1: Undo restores the prior decisions rather than clearing them, since a skipped row may already carry a category or rename). **Verified live:** uploaded a real statement, confirmed the "2" badge + Layers icon render before a genuine 2-row merchant group, clicked Skip → toast "2 row(s) skipped" with Undo → Undo restored both rows to Review exactly. Typecheck clean, lint clean on touched files. **No DB change, no migration.**
- ✅ 2026-08-26 — **BUD-61** The Transfers tab and the Categorize tab read as two different apps. The owner: *"Let the Cards of Transactions and Transfers be very similar"* — specifically (1) replace the `Transfer | Transaction` button pair with a toggle icon, off = transaction, on = transfer, and (2) once a row is decided (category picked, or destination picked), show it read-only the way a Categorize card does, tap to reopen and edit. Also, separately: *"If in the same statement uploaded, i have multiple years... you should display the years"* — dates across the review screen were month/day only, so a Dec 2025 row and a Dec 2026 row on the same imported statement (a `Debit_2025-2026.pdf`) were indistinguishable. **Fix, `TransferRowCard.tsx`:** the two buttons became one `role="switch"` control (an `ArrowLeftRight` icon on a sliding knob). A decided row — `destination` set (mode `transfer`) or `resolvedCategory.category_id` set (mode `spent`) — now renders a read-only summary (`<from> → <to>` pills, or `CategoryChip` + the saved description) instead of the live `Select`/input+chip; tapping the summary flips local `editing` state back to true and reopens the control, which is exactly the "looks read-only, tap to edit" affordance `ReviewGroupCard` already used, so the two tabs now share one interaction language. `CategoryChip` gained `interactive?: boolean` (`interactive={false}` → renders a `<div>`, not a `<button>`, since the chip sits inside the card's own edit-tap button and buttons cannot nest) — the only other consumer is `TransferRowCard` itself, so this was a safe, non-branching addition. **Fix, multi-year dates:** `hasMultipleYears(rows)` and `formatStatementDate(iso, { year?, weekday? })` are new pure exports on `sessionModel.ts`, computed once per session (`multiYear` in `page.tsx`) and threaded as a `showYear` prop into every row-level date renderer — `TransferRowCard`, `MatchedRowCard`, `GroupSheet`, `OtherAccountSheet`, `ReviewStepper`, plus the merchant-group (`groupDateLabel`) and day-group (`longDate`) labels in `page.tsx` itself. This replaced **six** separate hand-copied `toLocaleDateString` functions (page.tsx ×2, `TransferRowCard`, `MatchedRowCard`, `GroupSheet`, `ReviewStepper`, `OtherAccountSheet`) with the one shared formatter — the duplication was already a latent bug (any future date-format change had to be applied by hand six times, or it would show up inconsistently between tabs, which is exactly what motivated centralizing it instead of hand-threading a boolean into each copy). A single-year statement is unaffected ("21 Oct"); a statement crossing a year boundary shows the year everywhere ("21 Oct 2025"). **Verified live** against a real resumed session (`account_statement_Debit_2025-2026.pdf`, a statement that genuinely spans Oct 2025 – Aug 2026): merchant-group date ranges show `Oct 28, 2025 – Nov 20, 2025`; the Transfers tab shows `Oct 21, 2025`, `Jan 8, 2026`, `Feb 20, 2026`; the Existing → Imported day headers show `MON, AUG 24, 2026`. Toggled a person-transfer row to a decided destination — collapsed to `Debit Card - NEO → Whish · Racha Touma` pills, tap reopened the `Select`. Picked a category on a received-transfer row — collapsed to a `Bonus` chip + description, tap reopened the input + chip. No new console errors (only pre-existing, unrelated warnings: multiple GoTrueClient instances, a Radix Dialog missing-Description warning already present before this change). 7 new unit tests for `hasMultipleYears`/`formatStatementDate` (85 total in `sessionModel.test.ts`, all pass), typecheck clean, lint clean (0 errors) on every touched file. **No DB change, no migration.**
- ✅ 2026-08-26 — **BUD-62** A received person-transfer defaulted to the wrong income account (Drawer instead of Salary), and — same root cause — a category the owner picked after manually working around it looked discarded on the card even though it saved correctly. The owner: *"When it is a transfer 'received', first it is getting preselecting Drawer account, it should preselect Salary Account"* + *"When i chose the Category subcategory, it is taking them correctly, and logging them in database correctly, but it should display them on the card"* — screenshot showing a blue "Choose category" pill sitting right next to a green `✓ Log · Salary` staged line, which is logically impossible from one `resolvedCategory.category_id` unless the category IS set but its NAME can't be found. **Root cause, both symptoms:** `pickAccount(accounts, "income")` in `sessionModel.ts` (used by `suggestAccountForRow` for the auto-redirect AND by `page.tsx` to decide which income account's categories to fetch into `categoryOf()`, per the BUD-53 merge) preferred `is_default` — but `is_default` is a single APP-WIDE flag shared with the everyday quick-entry default (`ExpenseForm`, `MobileExpenseForm`, Hub, watch views) and sits on an expense account (Wallet) in this household, so no income candidate ever matched it and the code fell through to `candidates[0]` — whichever income account is first in array order (Drawer, a physical cash account also typed `income`), not the actual preference (Salary). Since `spendAccountId` for the row and `incomeAccountId` for `categoryOf()` both came from this same wrong call, a category picked after the owner manually overrode the row to Salary lived on an account `categoryOf()` never fetched, and `CategoryChip` fell back to its "Choose category" placeholder regardless of `interactive={false}` — confirmed by reading `CategoryChip.tsx`: the fallback fires whenever `categoryOf(id)` returns null, independent of decided/undecided state. **Fix:** a second, independent flag, `accounts.is_default_income` (`migrations/2026-08-26_accounts-default-income.sql` — new column + a partial unique index + trigger mirroring `ensure_single_default_account`, confirmed against the live `ensure_single_default_account` function body via `migrations/db-state.json` per Hard Rule #27 before mirroring it). `pickAccount()` now prefers it for `type === "income"`, falling back to `is_default` then array order only if unset. New `PATCH /api/accounts/[id]/default-income` (rejects a non-income account, 400) + `useSetDefaultIncomeAccount()` + a second badge/button in Settings → Accounts for income-type accounts, alongside the existing app-wide default badge — the owner still needs to set Salary as the default income account once, after the migration runs. With the auto-default correct, no manual per-row override is needed for this scenario, so `spendAccountId` and `incomeAccountId` agree automatically and the category-display bug is fixed as a side effect of the same change — no separate `categoryOf()` refactor. 2 new regression tests (`pickAccount`/`suggestAccountForRow` preferring `is_default_income` over array order, and falling back to array order when unset), 87 tests pass (+2) in `sessionModel.test.ts`, typecheck clean, lint clean (0 errors) on every touched file. **Migration PENDING the owner's run** (Hard Rule #26 — no DB write made by this session); **not yet verified in-browser** against a real received transfer — the owner's next statement import, after running the migration and setting Salary as the default income account in Settings, is the live check.

- ✅ 2026-09-18 — **BUD-78** A EUR statement failed to import with a **422** because one transfer row was rejected as `amounts_unreadable`, and the parse route blocks the whole batch if any single row is rejected (`src/app/api/statement-import/parse/route.ts:203-210`). The row was `Transfer to RACHA SAMIR TOUMA via Mobile - Out: 105.02`, whose description wraps across three extracted lines — `14/08/2026 Transfer to RACHA SAMIR TOUMA` / `via Mobile - Out: 105.02` / `31.46 - 323.03`. **Root cause:** the multi-line-description loop in `parsePDFTextWithDiagnostics` (`src/lib/bank-statement-parser.ts`) treated the FIRST continuation line carrying any `\d+\.\d{2}` as the money-columns line; the mobile transfer prints its outgoing amount as text (`Out: 105.02`) inside the description, so the loop stopped there, read `-`/`105.02` as MONEY OUT / balance (money-out `-` → null, money-in null → rejected), and the real `31.46 - 323.03` line was orphaned and dropped. This shape never appeared in the USD corpus, so it shipped undetected. **Fix:** new `isAmountsOnlyLine()` — a continuation line is only accepted as the amounts line when it is nothing but money values, dashes and whitespace (which still catches a wrapped 2-column amounts line like `500.00 1,234.56`); a line that merely contains an embedded number is kept as description, so the loop reads on to the real money columns. The RACHA row now parses `moneyOut 31.46`, `transfer_out`; diagnostics on the owner's file went from `rejected_count 1` → `0`, all 75 rows parse, and the 422 is gone. Tests: 2 regressions in `bank-statement-parser.test.ts` (correct columns + not-rejected/no-422); the existing "unreadable money columns" case still rejects. Whole parser suite (30) + integration corpus green, typecheck clean. No DB change.

- ✅ 2026-09-18 — **BUD-79** Importing a statement into a fresh account (a trip's own account) filed some rows back onto the old card they were first learned on, and the account dropdown could not undo it. The owner, importing the Italy EUR statement into **Trip - Italy 2026**: *"some of the rows are under account 'Debit Card - NEO' by default, although I am importing under 'Trip - Italy 2026' Account. I am unable to change from 'Debit Card - NEO' to 'Trip - Italy 2026'."* **Root cause — a BUD-23 regression.** `suggestAccountForRow()` (`src/features/statement-import/sessionModel.ts`) returned `row.mapping_account_id` as its FIRST branch, so a merchant previously categorized on Debit Card - NEO carried that account onto the row even though the statement belongs to the trip account — the exact "a mapping routes a row to account B under a fingerprint hashed for account A" hazard BUD-23 fixed, and which both `resolveRowAccount`'s own doc comment *("Never a merchant mapping's account. That was BUD-23…")* and the parser comment *("A merchant mapping must never redirect the row somewhere else")* say must never happen. The dropdown could not override it because selecting the trip account (= the statement account) stores `account_id: undefined` (`GroupSheet.tsx:437`), which re-ran the suggestion and snapped the row straight back to Debit Card - NEO. **Fix.** **(1)** `suggestAccountForRow` no longer consults `mapping_account_id` at all — a row defaults to the statement account, and the two correctness gates (money-OUT off an income/saving account → default expense; person money-IN on an expense account → income) remain the only redirects. **(2)** The parser (`src/lib/bank-statement-parser.ts`) now applies a learned mapping's category/subcategory only when it was learned on the SAME account being imported (a null-account legacy mapping still applies); a cross-account mapping keeps only its friendly merchant name, so the row is reviewed against the trip account's own categories instead of failing commit with a "Category belongs to a different account" error. Tests: `sessionModel.test.ts` — replaced the "keeps a learned cross-account mapping as the default" case (it encoded the regression) with one pinning that a mapping never reroutes the account, plus a trip-scenario regression (expense statement + money-out + mapping to another expense card → stays on the statement account). 139 statement-import tests pass, typecheck clean. No DB change.
- ✅ 2026-09-19 — **BUD-80** Statement import row sheet: changing a row's account left the category grid on the statement account's categories (picker was hardwired to the statement account unless a row was drilled into, and a single row's cleared category override shadowed the group pick), and picking the statement account (e.g. Salary) snapped back to the auto-suggested one (`account_id: undefined` fell through to `suggestAccountForRow`). Fix in `GroupSheet.tsx`: picker follows the rows' resolved account and writes to the row when it owns an override; the select stores the explicit pick; income/saving accounts are disabled for debit rows (a debit there raises the balance — `getBalanceDelta`). 88 statement-import tests pass, typecheck clean. **Known edge left open:** a multi-row group where every row was individually redirected still has its group-level pick shadowed by the rows' cleared overrides; the per-row "Own" button works around it. **Follow-up same day:** the review card still read "Choose category" after a pick on a row re-targeted at a non-default expense account (Debit Card - NEO) — `page.tsx`'s `categoryById` only loaded the statement + default income/expense accounts' categories. Now also loads every account picked in a row's select via new `useCategoriesForAccounts` (`useQueries`, same `qk.categories` cache).
- ✅ 2026-09-19 — **BUD-81** Statement Import can target the partner's public accounts (partner couldn't pick a shared "Italy Trip"). Picker adds partner `is_public` visible accounts; parse/reconcile/commit/revert authorize via `listWritableAccounts` (`src/lib/accountAccess.ts`). Imports stay per-importer: `(user_id, statement_hash)` key unchanged, rows written with the importer's `user_id`, matching only against the importer's own transactions (owner decision). Tests: reconcile + commit partner-account cases; 395 pass. Known limit: an import never dedupes against the account owner's own manual entries on the shared account.
- ✅ 2026-09-19 — **BUD-82** Statement import row sheet: the per-row account dropdown omitted the partner's public accounts (GroupSheet got own-only `accounts`). Now fed the same own + partner-public set as the statement picker (partner name suffixed); transfer destinations pinned to own accounts; `accountRefs` includes a shared statement account so `suggestAccountForRow` knows its type. Category grid already follows the row's account (`/api/categories` resolves the account owner's categories).

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-09-19 — **BUD-83** V2 run `r-83dddb67fea9` · candidate verified; not applied · codex gpt-5.6-luna <!-- v2:res-fc5b50822f64@2 -->
- 2026-09-19 — **BUD-83** V2 run `r-83dddb67fea9` · not verified (criterion, disposition) · codex gpt-5.6-luna <!-- v2:res-fc5b50822f64@1 -->
- 2026-07-30 — **BUD-11** delivery session `s-20260715-214421-hvfk` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-203135-cv12` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-205308-8sgn` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-221533-wous` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-225601-whdv` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-14** delivery session `s-20260729-121840-pdhx` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-14** delivery session `s-20260730-104900-9mfu` ended **cancelled** at CANCELLED. 0 file(s) changed. · finish package: `.delivery/sessions/s-20260730-104900-9mfu/artifacts/finish/summary.md`
- 2026-08-01 — **BUD-14** delivery session `s-20260801-094951-jx8o` ended **paused — needs a decision** at NEEDS_DECISION. 1 file(s) changed · ACs 0/3 satisfied. · finish package: `.delivery/sessions/s-20260801-094951-jx8o/artifacts/finish/summary.md`

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
