---
created: 2026-05-29
type: implementation-note
status: superseded
superseded: 2026-07-15
owner: Elio
tags:
  - pm/audit
  - scope/cross-cutting
  - testing
---

# 5 - P0 Automated Tests Implementation Notes

> ⚠️ **ARCHIVED IN PLACE (2026-07-15)** — historical record of the first test baseline; do not treat as current test coverage. Current truth: the FABLED 2 layer ([FABLED 2 Master Index](<../00 - Home/FABLED 2 Master Index.md>)). Router: [_index](<_index.md>).

> Outcome: the repo now has a working Vitest baseline for the highest-risk pure logic: balance direction, date/timezone helpers, recurring next-due calculation, and split-bill display math.

## Approach

1. Read the project routing docs first: Feature Map, the setup audit, and the weekly action plan.
2. Read the relevant module docs before code: Accounts & Balance, Recurring Payments, Transactions, and Timezone Handling.
3. Added Vitest rather than a UI-heavy test stack. The first safety net should be fast and boring.
4. Kept tests near the utilities they protect under `src/lib/**/*.test.ts`.
5. Extracted recurring next-due math into `src/lib/recurring.ts` so it can be tested without Supabase.
6. Updated the recurring confirmation API route to use that shared helper instead of relying on the missing `calculate_next_due_date` DB function in `migrations/schema.sql`.
7. Fixed the `startOfCustomMonth(..., 31)` edge case while adding date tests. Month start day 31 now clamps to the last day of shorter months.
8. Wired `pnpm test` into `.claude/hooks/pre-commit.sh` after typecheck and before staged-file ESLint.

## What Worked

- Vitest was a good fit for this layer: no browser, no React test renderer, no Supabase mocks needed for the first pass.
- Pure utility tests gave immediate value and ran in under a second.
- The recurring-date extraction removed a hidden schema drift risk: the API expected a DB RPC that is not present in `migrations/schema.sql`.
- Targeted lint on changed TS files works after converting the ESLint flat config to `eslint.config.mjs` with `FlatCompat`.

## What Did Not Work

- The first `pnpm add -D vitest @vitest/ui` attempt failed in the sandbox because npm registry access was blocked. Rerunning with approved network access succeeded and updated `pnpm-lock.yaml`.
- Recurring next-due logic was not testable where it lived because it was delegated to Supabase RPC.
- ESLint initially failed before reading any files because the existing flat config imported `eslint-config-next` directly. `FlatCompat` fixed that path, and renaming the config to `.mjs` removed Node's module-type warning without changing package-wide module semantics.

## Current Coverage Baseline

- `src/lib/balance-utils.test.ts`
  - Expense accounts subtract spend.
  - Income/saving accounts add inflows.
  - Debt returns add money regardless of account type.
  - Deletes reverse the original balance impact.
  - Running balance over multiple deltas.
  - Self and household transfer deltas.

- `src/lib/utils/date.test.ts`
  - Custom month start before/after the configured day.
  - Month start day 31 clamps correctly.
  - `localToISO` emits UTC ISO strings that round-trip to the intended local wall time.
  - UTC RRule DTSTART formatting.
  - Full RRule string construction.
  - DST-safe wall-clock occurrence adjustment.

- `src/lib/recurring.test.ts`
  - Daily, weekly, monthly, and yearly next-due behavior.
  - Weekly configured weekday behavior.
  - Month-end and leap-day clamps.

- `src/lib/utils/splitBill.test.ts`
  - Non-completed split fallback.
  - Both/all totals.
  - Mine/partner amount selection from owner and collaborator perspectives.
  - Description selection and combined descriptions.

## Verification

Commands run on 2026-05-29:

```bash
pnpm test
pnpm typecheck
pnpm eslint --max-warnings=0 -- "src/lib/balance-utils.ts" "src/lib/balance-utils.test.ts" "src/lib/recurring.ts" "src/lib/recurring.test.ts" "src/lib/utils/date.ts" "src/lib/utils/date.test.ts" "src/lib/utils/splitBill.test.ts" "src/app/api/recurring-payments/[id]/route.ts" "vitest.config.ts" "eslint.config.mjs"
```

Result:

- 4 test files passed.
- 26 tests passed.
- TypeScript passed.
- Targeted ESLint passed.
- Direct `bash .claude/hooks/pre-commit.sh` execution was not possible in the local PowerShell sandbox because `bash` resolves to WSL and no WSL distro is installed. The hook was still updated, and its component commands were run directly.

## Follow-Up

- Add API route tests with mocked Supabase for recurring confirmation and transaction creation.
- Add coverage around transfers and `computeAccountBalance` with a mocked `supabaseAdmin()`.
- Add tests for recurring/future-payment hooks once query/mutation test utilities are available.
- Consider a `test:coverage` script after the first few modules have meaningful tests.
