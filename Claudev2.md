1. Error Handling & Retry Strategy (Missing)

You define mutations well, but nothing about failure behavior.

👉 Add a section like:

API retry rules (e.g. React Query retry count)

When to rollback vs persist optimistic state

Standard error shape ({ error: string, code?: string })

Logging → tie into error-logs module

Why it matters:
With offline + optimistic updates, silent inconsistencies will happen.

2. Authorization / RLS Contract (Critical Missing)

You mention Supabase + household sharing, but not:

How RLS is structured

Whether API routes trust RLS or re-check permissions

Pattern for multi-household users

👉 Add:

## Authorization Model

- All DB access is governed by Supabase RLS
- API routes MUST NOT bypass RLS unless using admin client with explicit checks
- Household access is enforced via `household_links`

Why it matters:
This is the #1 place apps like this break.

3. Concurrency & Conflict Resolution (Important)

You have:

Offline queue + realtime sync

But no rule for:

Conflict resolution (last write wins? merge?)

Duplicate mutation handling

Idempotency

👉 Add:

Mutation IDs / client-generated IDs

Server reconciliation rules

4. Caching Strategy Clarity

You say:

Invalidate, don’t refetch

But missing:

Cache lifetime (staleTime, gcTime)

When NOT to invalidate

Cross-module invalidation rules (important for Junctions)

9. Feature Flags / Progressive Rollout

For a system this complex, you’ll need:

Toggle new features

Disable broken modules quickly
