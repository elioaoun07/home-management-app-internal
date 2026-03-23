---
applyTo: "src/features/**/*.ts,src/features/**/*.tsx"
description: "Use when creating or editing feature module hooks. Covers standalone isolation, query/mutation patterns, cache times, query keys, and safeFetch rules."
---

# Feature Module Conventions

## Standalone Isolation (Non-Negotiable)

- Feature directories (`src/features/[name]/`) must NOT import from other feature directories
- Shared code goes in `src/lib/`, `src/types/`, or `src/components/`
- Exception: Junction modules (hub, shopping-list, meal-planning) CAN import from features

## File Structure

- `hooks.ts` — Query hooks + mutation hooks + fetch functions
- Feature modules are hooks-only — NO page components, NO UI components here

## Query Hooks Pattern

```ts
"use client";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useItems() {
  return useQuery({
    queryKey: qk.yourKey(),
    queryFn: fetchItems,
    staleTime: CACHE_TIMES.APPROPRIATE_CONSTANT,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
```

## Query Keys

- Always use `qk.*` from `src/lib/queryKeys.ts` or feature-scoped `queryKeys.ts`
- NEVER inline arrays like `["accounts"]`

## Cache Times (from `src/lib/queryConfig.ts`)

- BALANCE = 5min, TRANSACTIONS = 2min, ACCOUNTS = 1h, CATEGORIES = 1h
- RECURRING = 30min, DRAFTS = 1min, PREFERENCES = 1h, PERMANENT = 24h

## Mutations

- **Always use `safeFetch()`** for mutations — never plain `fetch()`
- **Every toast must include an Undo action** with `duration: 4000`
- Use `ToastIcons` enum from `src/lib/toastIcons.tsx` for toast icons
- Optimistic updates: use ONLY `onMutate` — never mix with `useState`
