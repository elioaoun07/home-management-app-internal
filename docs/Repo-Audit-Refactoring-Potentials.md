# Repository Audit — Refactoring Potentials

## Scope
- Full-repo refactor opportunity map (analysis-only).
- Prioritized for reliability + maintainability gains with minimal behavioral risk.

## Prioritization rubric
- **Impact:** correctness/risk reduction value.
- **Complexity:** expected implementation effort.
- **Blast radius:** number of modules touched.

## High-Impact Potentials

1. **Introduce typed transaction domain DTOs and remove `any` in transaction service path**
   - **Evidence:** `src/services/transaction.service.ts:50`, `:112`, `:258`.
   - **Why now:** core financial pipeline still uses permissive typing.
   - **Expected benefit:** safer refactors, better API contracts, fewer runtime shape bugs.
   - **Complexity:** Medium.

2. **Create shared API mutation client for feature hooks (`safeFetch` + JSON parsing + `res.ok` handling)**
   - **Evidence:** mutation `fetch` usage in `src/features/hub/hooks.ts:237`, `:355`, `:1096`, `:1393`; convention in `.github/instructions/feature-modules.instructions.md:50`.
   - **Expected benefit:** unified offline/timeout/error semantics.
   - **Complexity:** Medium.

3. **Make account reorder atomic (RPC/transactional update strategy)**
   - **Evidence:** sequential updates in `src/app/api/accounts/reorder/route.ts:38` + `:41`.
   - **Expected benefit:** prevents partial ordering states.
   - **Complexity:** Medium.

4. **Harden balance adjust contract to fail-loud semantics**
   - **Evidence:** `src/lib/balance.ts:97`, `:104`, `:121`; important callsites `src/app/api/recurring-payments/[id]/route.ts:251`, `src/app/api/future-payments/[id]/confirm/route.ts:126`.
   - **Expected benefit:** avoids silent balance drift.
   - **Complexity:** Medium-High (money domain).

## Medium-Impact Potentials

5. **Extract shared Zod validation wrappers for API routes**
   - **Evidence:** mixed raw JSON parsing in `src/app/api/transactions/route.ts:57`, `src/app/api/accounts/reorder/route.ts:18`; standard in `.github/instructions/api-routes.instructions.md:50`.
   - **Expected benefit:** consistent 400 responses and schema-driven contracts.
   - **Complexity:** Medium.

6. **Refactor giant components into bounded submodules**
   - **Evidence (line counts):**
     - `src/components/hub/HubPage.tsx` (5619)
     - `src/components/expense/MobileExpenseForm.tsx` (3111)
     - `src/components/hub/ShoppingListView.tsx` (3034)
     - `src/components/web/WebDashboard.tsx` (2549)
   - **Expected benefit:** testability, reviewability, reduced merge conflicts.
   - **Complexity:** High (incremental slicing recommended).

7. **Replace silent catch/default patterns with explicit result states**
   - **Evidence:** `src/app/layout.tsx:123`, `src/features/era/intents/resolvers/amend.ts:67`, `:160`, `:337`.
   - **Expected benefit:** clearer debugging and fewer false-success flows.
   - **Complexity:** Low-Medium.

## Low-Impact Potentials

8. **Constrain client debug logging behind environment-aware logger**
   - **Evidence:** `src/hooks/usePushNotifications.ts` (53 `console.*` usages).
   - **Expected benefit:** cleaner production diagnostics.
   - **Complexity:** Low.

9. **Strengthen verification UX around DB-state checks**
   - **Evidence:** non-strict default in `scripts/check-db-state.mjs:9` and `:186`; stale-state findings observed in current run.
   - **Expected benefit:** earlier visibility of RLS drift risks.
   - **Complexity:** Low.

## Thematic opportunities

### Reduce Duplication
- Repeated API parse + error branches can be consolidated into route helpers.

### Improve API Safety
- Mandatory schema parsing and typed DTO boundaries for money/recurrence routes.

### Improve Money Correctness
- Make balance update result explicit and enforced at callsites.

### Improve Testability
- Break monolith components and isolate business logic into pure helpers/hooks.

## Verification approach for future refactors
- Keep behavior snapshots before/after (`typecheck`, `lint`, targeted vitest suites).
- For money-related refactors: include before/after balance examples and route-level tests.
- For API refactors: verify status-code and response-shape parity.
