---
created: 2026-04-21
type: architecture
tags:
  - type/architecture
  - scope/cross-cutting
---

# Cache Invalidation — The "Disconnected App" Trap

> **Hard Rule (Universal)** — applies to every mutation in every module.

## The Problem

This app has many views (Dashboard, Review, Analytics, Account pages) that display the same underlying data under **different React Query keys**. A mutation that only invalidates the key it "owns" will silently leave other views stale.

## Rules

1. **Before writing any mutation**, list every query key that displays the mutated data. Invalidate ALL of them in `onSuccess`/`onSettled`.

2. **Prefer `refetchType: "active"`** (the default) so live views refresh immediately. Only use `refetchType: "none"` for queries the user is unlikely to see right away (e.g. `balance-history`, `daily-summaries`).

3. **Optimistic UI (`onMutate` cache writes) covers the PRIMARY query only.** All secondary queries (analytics, dashboards, summaries) must still be explicitly invalidated — optimistic writes do not propagate across query keys.

4. **For any mutation that affects account balances** (direct balance edit, transaction CRUD, transfer, recurring): call `invalidateAccountData(queryClient, accountId?)` from `src/lib/queryInvalidation.ts` — it covers `accounts`, `my-accounts`, `analytics`, and `account-balance` in one call.

5. **After adding a new feature query**, audit all mutations that could make its data stale and add the new key to their invalidation list. Never assume "nobody reads this yet."

6. **Never rely on stale-time as a correctness guarantee.** Stale-time is a performance optimization only. Always invalidate on mutation.

## Helper

```ts
import { invalidateAccountData } from "@/lib/queryInvalidation";

// In any mutation that touches balances:
onSuccess: () => {
  invalidateAccountData(queryClient, accountId); // covers accounts, analytics, balance
  queryClient.invalidateQueries({ queryKey: qk.transactions() }); // add module-specific keys
}
```
