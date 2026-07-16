# Spec

## Problem

Cache timing configuration in queryConfig.ts lacks automated verification that constants are aligned with actual API response headers and React Query hook usage. Currently, there is no test enforcing the cache timing contract, making it possible to introduce misalignments (e.g., API headers changing from hook staleTime expectations) without detection. Additionally, the intent behind each cache time constant is not documented, making it difficult to understand the tradeoff rationale when reviewing or modifying cache strategies.

## Current behavior

**queryConfig.ts (src/lib/queryConfig.ts:13-41):**

- Defines CACHE_TIMES constants without JSDoc explaining intent or tradeoffs
- No documentation mapping each constant to corresponding API endpoints
- No enforcement mechanism that constants are used correctly by hooks or match API headers
- Constants: BALANCE (5 min), TRANSACTIONS (2 min), ACCOUNTS (1 hr), CATEGORIES (1 hr), RECURRING (30 min), DRAFTS (1 min), PREFERENCES (1 hr), NFC (30 min), ONBOARDING (24 hr), PERMANENT (24 hr)

**API route cache headers (audit findings from src/app/api/):**

- `/api/transactions` GET (route.ts:33): "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" — 60 seconds
- `/api/accounts` GET (route.ts:14): `export const dynamic = "force-dynamic"` — no caching declared
- `/api/user-categories` GET (route.ts:5): `export const dynamic = "force-dynamic"` — no caching declared
- `/api/recurring-payments` GET: No explicit Cache-Control header — caching intent undefined
- Mutations (POST/PATCH/DELETE): "Cache-Control": "no-store" ✓ (correctly set)

**React Query hooks usage:**

- `useAccounts()` (src/features/accounts/hooks.ts:60): `staleTime: CACHE_TIMES.ACCOUNTS` (references constant)
- `useRecurringPayments()` (src/features/recurring/useRecurringPayments.ts:65): `staleTime: CACHE_TIMES.RECURRING` (references constant)
- `useDashboardTransactions()` (src/features/transactions/useDashboardTransactions.ts:291): `staleTime: 1000 * 60 * 2` (hardcoded, bypasses constant)
- `prefetchDashboardTransactions()` (line 323): `staleTime: 1000 * 60 * 5` (different hardcoded value than sibling hook)

**Known misalignments (not yet fixed):**

1. API s-maxage=60 (TRANSACTIONS endpoint) vs hook expecting 2min staleTime
2. API force-dynamic (ACCOUNTS, CATEGORIES) vs hook expecting 1hr staleTime
3. Hardcoded staleTime in useDashboardTransactions instead of referencing CACHE_TIMES constant
4. Missing Cache-Control declaration on /api/recurring-payments GET endpoint

**No verification mechanism exists:**

- No test file documents or enforces the cache timing contract
- Silent drift possible: API header could change without hook knowing, or vice versa
- Intent behind each constant's value not documented anywhere

## Proposed behavior

**Create a vitest-based verification test** (`src/lib/__tests__/queryConfig.verify.test.ts`) that:

1. **Mock API endpoints with their actual Cache-Control headers** (extracted from codebase audit)
   - Mock `/api/transactions` with header `s-maxage=60`
   - Mock `/api/accounts` with dynamic behavior indicator
   - Mock mutations with `no-store` headers
   - Each mock represents the current live API contract

2. **For each CACHE_TIMES constant, create a test that:**
   - Documents intent via descriptive test name (e.g., "BALANCE = 5min balances speed with account freshness")
   - Mocks the corresponding API endpoint with its declared headers
   - Asserts the CACHE_TIMES value is correct for that endpoint's caching strategy
   - Documents the rationale as inline comments
   - Flags known misalignments (e.g., 60s API vs 2min hook) as audit findings in test comments
   - Example test structure per owner:

     ```ts
     it("BALANCE = 5min balances speed with account freshness tradeoff", () => {
       // Mock /api/accounts with Cache-Control: max-age=300
       // Intent: show fresh balance quickly but tolerate small async lag
     });

     it("TRANSACTIONS = 2min captures recent spends but not real-time", () => {
       // Audit finding: API returns s-maxage=60, but hook expects 2min
       // Document tradeoff: fast list refresh vs database load
     });
     ```

3. **Verify mutations use no-store consistently:**
   - Test checks that POST/PATCH/DELETE endpoints all set "Cache-Control": "no-store"
   - Fails if any mutation endpoint is missing the header

4. **Document intent in queryConfig.ts via JSDoc:**
   - Add JSDoc block explaining cache strategy philosophy
   - Add inline comments for each CACHE_TIMES constant:
     - Which endpoint(s) it applies to
     - The tradeoff it represents (speed vs freshness)
     - Why that value was chosen
   - Example:
     ```ts
     // TRANSACTIONS = 2min
     // Endpoint: /api/transactions (API returns s-maxage=60, audit TODO: align)
     // Tradeoff: Captures recent spends but not real-time; balances database load vs UI freshness
     // Hook: useDashboardTransactions() hardcodes 2min (not referencing constant)
     ```

5. **Test outcomes:**
   - All tests pass (documents findings without failing on known misalignments)
   - Test names and structure make the cache contract explicit and self-documenting
   - Future developers can immediately see what the expected alignment is
   - Audit findings in comments identify what needs separate fixes

**Out of Scope (Do NOT implement, only audit and note):**

- Fixing misalignments (e.g., 60s API vs 2min hook) — raise as separate bug/friction items
- Refactoring hardcoded staleTime values to use constants — raise as separate cleanup item
- Changing API headers or adding missing declarations — raise as separate infrastructure issue

**Deliverables for BUD-11:**

1. `src/lib/__tests__/queryConfig.verify.test.ts` with vitest mocks covering major constants
2. Updated `src/lib/queryConfig.ts` with JSDoc comments and endpoint mapping
3. Test passes (`pnpm test src/lib/__tests__/queryConfig.verify.test.ts`)
4. Audit findings documented in test comments with rationale for why not fixed in this PR

## Acceptance criteria

- **AC-1**: Test file src/lib/**tests**/queryConfig.verify.test.ts created using vitest + mocks
- **AC-2**: describe('queryConfig cache intent verification') block with test cases for each major constant: BALANCE, TRANSACTIONS, ACCOUNTS, CATEGORIES, RECURRING, DRAFTS, PREFERENCES
- **AC-3**: Each test has descriptive name documenting intent (e.g., 'TRANSACTIONS = 2min captures recent spends but not real-time')
- **AC-4**: API endpoints mocked with their actual Cache-Control headers extracted from codebase (e.g., /api/transactions s-maxage=60)
- **AC-5**: Test verifies each CACHE_TIMES value aligns with mocked API header + expected hook staleTime
- **AC-6**: Known misalignments (60s API vs 2min hook, force-dynamic vs staleTime, missing headers) documented as test comments/audit findings, NOT fixed
- **AC-7**: Test includes verification that all mutation endpoints have 'Cache-Control: no-store' header
- **AC-8**: queryConfig.ts updated with: JSDoc block explaining cache strategy + inline comments mapping each constant to endpoint(s), rationale, and known issues
- **AC-9**: Test passes without skips or disables (pnpm test src/lib/**tests**/queryConfig.verify.test.ts passes)
- **AC-10**: Test does NOT include actual network calls, React Query integration tests, or hook implementation logic — mocks and contracts only
- **AC-11**: Comments in test and queryConfig.ts identify which issues are known/flagged for separate PRs (e.g., 'TODO BUD-12: why API 60s vs hook 2min?')

## Affected paths

- src/lib/queryConfig.ts
- src/lib/**tests**/queryConfig.verify.test.ts (new)

## Risk flags

- CRITICAL: Vitest mocks must match actual API headers from audit — if mocks diverge from real code, test provides false confidence. Validate mocks against each src/app/api route before finalizing test.
- KNOWN MISMATCH (documented, not fixed): /api/transactions API header s-maxage=60 vs CACHE_TIMES.TRANSACTIONS (2 minutes) vs useDashboardTransactions hardcoded staleTime — requires separate fix (BUD-12?)
- KNOWN MISMATCH (documented, not fixed): /api/accounts and /api/user-categories use force-dynamic but hooks expect 1hr staleTime — contract violation, separate fix (BUD-13?)
- MISSING HEADER: /api/recurring-payments GET has no explicit Cache-Control header — intention unclear, should be flagged in test audit for infrastructure fix
- SCOPE BOUNDARY: Do NOT fix misalignments, only document them. Misalignments belong in separate bug/friction items with appropriate severity/effort estimates. This task is visibility only.
- OWNER GUIDANCE: The 2min dashboard transaction staleTime is documented as deliberate (comment on line 287-289: 'balances speed with freshness'). Any change requires UX validation to prevent stale balance visibility. Flag in test but do not alter.
- TEST DESIGN CONSTRAINT: Keep test focused on contract verification only. Do not test React Query behavior, actual hook logic, or network calls. Mocks + assertions only.

## Open questions

(none)
