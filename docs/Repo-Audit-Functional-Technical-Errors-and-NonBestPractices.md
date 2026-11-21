# Repository Audit — Functional / Technical Errors & Non‑Best‑Practice Findings

## Scope
- Full repository analysis (`everything in repo`), reporting-only.
- Focus: functional risks, technical reliability issues, and non-best-practice patterns.

## Automated evidence snapshot
- `pnpm typecheck` ✅ passed.
- `pnpm docs:check` ✅ passed.
- ESLint JSON report: **973 warnings / 0 errors / 233 files with findings**.
  - Top rules: `@typescript-eslint/no-explicit-any` (**513**), `@typescript-eslint/no-unused-vars` (**304**).
- `pnpm test` ⚠️ did not complete during audit window; startup repeatedly emitted `ExperimentalWarning: SQLite is an experimental feature...` before any final test summary.

## Findings by Severity

### High

1. **API body validation is inconsistent with project route standard**
   - **Standard reference:** `.github/instructions/api-routes.instructions.md:50` (“Use Zod schemas for ALL request body validation”).
   - **Evidence examples:** `src/app/api/transactions/route.ts:57` (`const body = await req.json();`), `src/app/api/accounts/reorder/route.ts:18` (raw JSON destructuring).
   - **Impact:** weak input contracts and inconsistent 4xx/5xx semantics on malformed payloads.

2. **Feature mutation paths use plain `fetch` despite module convention to use `safeFetch()`**
   - **Standard reference:** `.github/instructions/feature-modules.instructions.md:50`.
   - **Evidence examples:** `src/features/hub/hooks.ts:237`, `src/features/hub/hooks.ts:355`, `src/features/hub/hooks.ts:1096`, `src/features/hub/hooks.ts:1393`; `src/features/transactions/useDashboardTransactions.ts:1345`.
   - **Impact:** inconsistent timeout/offline handling and mutation error semantics.

3. **DB-state verification is non-blocking by default even on FAIL findings**
   - **Evidence:** `scripts/check-db-state.mjs:9` (warn-only default), `scripts/check-db-state.mjs:186` (exit 1 only in strict mode).
   - **Observed run:** `pnpm db:verify-rls` reported stale snapshot + RLS-disabled tables while exiting successfully.
   - **Impact:** developers can proceed with critical DB-state warnings unnoticed in normal local flow.

### Medium

4. **Silent catch blocks in app shell scripts hide initialization failures**
   - **Evidence:** `src/app/layout.tsx:123`, `src/app/layout.tsx:155` (`catch(e) {}`).
   - **Impact:** early theme/init failures become invisible and harder to diagnose.

5. **Widespread “catch-and-default” patterns can mask real failures**
   - **Evidence:** repository scan found many `.catch(() => null/false)` occurrences; concentrated example in `src/features/era/intents/resolvers/amend.ts:67`, `src/features/era/intents/resolvers/amend.ts:160`, `src/features/era/intents/resolvers/amend.ts:337`.
   - **Impact:** network/data errors can be misinterpreted as ordinary empty-state outcomes.

6. **Client-side logging volume is high in push-notification hook**
   - **Evidence:** `src/hooks/usePushNotifications.ts` has 53 `console.*` occurrences (e.g., `:62`, `:210`, `:725`, `:839`).
   - **Impact:** noisy logs, harder signal-to-noise for production diagnostics, potential accidental metadata exposure.

### Low

7. **Type looseness remains pervasive in key modules**
   - **Evidence:** scan count for `as any` in `src/` returned high volume (example hotspot: `src/components/dashboard-v2/ReviewV2Dashboard.tsx:259`, `:263`, `:1126`).
   - **Impact:** weaker compile-time guarantees and refactor safety.

8. **Lint-warning concentration indicates structural technical debt in large files**
   - **Evidence (top warning files):** `src/components/expense/MobileExpenseForm.tsx` (63 warnings), `src/components/hub/HubPage.tsx` (29), `src/features/transactions/useDashboardTransactions.ts` (25).
   - **Impact:** difficult maintenance and elevated regression risk.

## Findings by Area

### Functional Behavior
- `src/components/inventory/RestockDialog.tsx:77`
- `src/features/hub/hooks.ts:355`

### Reliability / Error Handling
- `src/app/layout.tsx:123`
- `src/features/era/intents/resolvers/amend.ts:67`
- `scripts/check-db-state.mjs:186`

### API Contract Quality
- `src/app/api/transactions/route.ts:57`
- `src/app/api/accounts/reorder/route.ts:18`
- `.github/instructions/api-routes.instructions.md:50`

### State / Network Consistency
- `.github/instructions/feature-modules.instructions.md:50`
- `src/features/hub/hooks.ts:237`
- `src/features/transactions/useDashboardTransactions.ts:1345`

### Tooling / Testability
- `pnpm test` startup observations (SQLite warning storm, no completion summary during audit window).
- ESLint warning inventory: 973 warnings, 0 errors.

## Notes
- No direct code changes were made in this audit.
- “Non-best-practice” items are evidence-backed and prioritized by practical risk, not style preference.
