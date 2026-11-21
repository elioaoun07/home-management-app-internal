# Repository Audit — Coding Bugs

## Scope
- Full repository audit (`everything in repo`), analysis-only pass.
- Focus: concrete coding defects likely to cause wrong behavior.

## Evidence baseline
- `pnpm typecheck` passed.
- `pnpm docs:check` passed.
- `pnpm test` did not reach test-result output within the audit window; startup repeatedly emitted SQLite experimental warnings.
- Findings below are code-evidence based and include exact `path:line` references.

## Findings by Severity

### High

1. **Recurring payment confirm can return success after failing to advance recurrence state**
   - **Evidence:** `src/app/api/recurring-payments/[id]/route.ts:269` (attempts `next_due_date` update), `src/app/api/recurring-payments/[id]/route.ts:274` (logs `updateError`), `src/app/api/recurring-payments/[id]/route.ts:281` (still returns success payload).
   - **Impact:** payment transaction may be created while recurrence pointer is not advanced, increasing duplicate/late posting risk.

2. **Balance write helper can fail silently and still return success-shaped values**
   - **Evidence:** `src/lib/balance.ts:97` (update error branch), `src/lib/balance.ts:104` and `src/lib/balance.ts:121` (returns `{ newBalance: previousBalance, previousBalance }` instead of throwing).
   - **Impact:** caller can continue as if balance update succeeded, causing balance drift risk in money flows.

3. **High-risk payment-confirm flows allow account override without explicit account-access guard**
   - **Evidence:** `src/app/api/recurring-payments/[id]/route.ts:201` (uses `body.account_id` override), `src/app/api/recurring-payments/[id]/route.ts:218` (inserts transaction with that account), `src/app/api/future-payments/[id]/confirm/route.ts:72` and `src/app/api/future-payments/[id]/confirm/route.ts:94` (same pattern), while no `getAccessibleAccount` usage appears in these files.
   - **Contrast reference:** guarded pattern exists in `src/app/api/transactions/[id]/route.ts:1` + `src/app/api/transactions/[id]/route.ts:180` and `src/app/api/transfers/[id]/route.ts:109`.
   - **Impact:** authorization correctness is delegated to DB policy assumptions; brittle for money mutations.

4. **Account reorder is non-atomic; partial updates possible**
   - **Evidence:** `src/app/api/accounts/reorder/route.ts:38` (iterates updates), `src/app/api/accounts/reorder/route.ts:41` (per-item DB update), `src/app/api/accounts/reorder/route.ts:48` (returns error on first failure).
   - **Impact:** if one update fails mid-loop, earlier positions remain changed while later ones are not.

### Medium

5. **Unvalidated `limit` parsing can propagate invalid values to DB query builder**
   - **Evidence:** `src/app/api/transactions/route.ts:23` (`parseInt(searchParams.get("limit") || "10000")`), `src/services/transaction.service.ts:96` (`.limit(limit)`).
   - **Impact:** malformed `limit` can become `NaN`, leading to runtime query failures or inconsistent behavior.

6. **Set-stock flow ignores decrements in Restock dialog**
   - **Evidence:** `src/components/inventory/RestockDialog.tsx:77` (`// TODO: Handle decrement if needed`).
   - **Impact:** in "set" mode, lowering stock below current value does nothing; stock can become incorrect.

7. **Mark-as-read flow silently swallows failures**
   - **Evidence:** `src/features/hub/hooks.ts:355` (POST to `/api/hub/mark-read`), `src/features/hub/hooks.ts:361` (`// Silent fail`).
   - **Impact:** receipt/read state can diverge from server with no retry/error surface.

### Low

8. **Transaction service remains heavily `any`-typed in core financial data path**
   - **Evidence:** `src/services/transaction.service.ts:50` (`Promise<any[]>`), `src/services/transaction.service.ts:112` (`(await query) as any`), `src/services/transaction.service.ts:258` (`map((r: any) => ...)`).
   - **Impact:** compiler cannot catch schema-shape regressions in a critical path.

## Findings by Area

### API / Money
- `src/app/api/recurring-payments/[id]/route.ts:269`
- `src/app/api/future-payments/[id]/confirm/route.ts:72`
- `src/app/api/accounts/reorder/route.ts:38`
- `src/app/api/transactions/route.ts:23`

### Shared Money Engine
- `src/lib/balance.ts:97`
- `src/lib/balance.ts:104`
- `src/lib/balance.ts:121`

### UI / Feature Logic
- `src/components/inventory/RestockDialog.tsx:77`
- `src/features/hub/hooks.ts:355`

### Type-Safety Hotspot
- `src/services/transaction.service.ts:50`
- `src/services/transaction.service.ts:112`

## Notes
- This document lists coding defects and defect-risks only.
- Broader quality/process/architecture findings are tracked in the other two reports.
