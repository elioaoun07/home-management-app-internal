---
name: cache-invalidation
description: "Rules for TanStack Query cache invalidation in this project. Auto-invokes when editing files that use useMutation, queryClient.invalidateQueries, or files in src/features/*/hooks/."
---

# Cache Invalidation

> Hard Rule #17 — invalidate every query key that shows the mutated data, not just the one the mutation "owns". Use `invalidateAccountData(queryClient, accountId?)` from `src/lib/queryInvalidation.ts` for any balance-affecting mutation. Never use stale-time as a correctness guarantee.

Full rules and examples: `ERA Notes/01 - Architecture/Cache Invalidation.md`

## Quick reference

- **Before writing a mutation**: list every query key that displays the mutated data — invalidate ALL of them in `onSuccess`/`onSettled`.
- **Balance mutations** (transaction CRUD, transfers, recurring): always call `invalidateAccountData(queryClient, accountId?)` — covers `accounts`, `my-accounts`, `analytics`, `account-balance` in one call.
- **Prefer `refetchType: "active"`** (default); use `"none"` only for queries the user won't see immediately (e.g. `balance-history`, `daily-summaries`).
- **Optimistic writes** (`onMutate`) cover the primary query only — all secondary views (analytics, dashboards, summaries) still need explicit invalidation.
- **After adding a new feature query**: audit all mutations that could make it stale and add the new key to their invalidation lists.

```ts
import { invalidateAccountData } from "@/lib/queryInvalidation";

onSuccess: () => {
  invalidateAccountData(queryClient, accountId); // accounts, analytics, balance
  queryClient.invalidateQueries({ queryKey: qk.transactions() });
}
```
