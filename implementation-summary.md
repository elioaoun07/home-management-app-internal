# Codebase Audit — Implementation Summary

---

## 1. Security: CRON_SECRET Bypass Fix

The cron route auth check allowed requests when `CRON_SECRET` was unset, since `if (CRON_SECRET && authHeader !== ...)` evaluates to `false` when the env var is missing. Changed to `if (!CRON_SECRET || authHeader !== ...)` making the secret mandatory.

**Files:**

- `src/app/api/cron/item-reminders/route.ts`
- `src/app/api/cron/daily-reminder/route.ts`
- `src/app/api/cron/daily-items-reminder/route.ts`
- `src/app/api/cron/chat-notifications/route.ts`

---

## 2. Security: Content Security Policy & Image Domains

Removed `'unsafe-eval'` and blanket `https:` from the CSP `scriptSrc` directive. Restricted `images.remotePatterns` to only `*.supabase.co` and `*.supabase.in` instead of allowing all origins.

**Files:**

- `next.config.ts`

---

## 3. Infrastructure: IndexedDB Connection Leaks

All 6 IDB functions in the offline queue were missing `db.close()` calls, leaking connections on every operation. Wrapped each in `try-finally { db.close() }`.

Functions fixed: `addToQueue`, `removeFromQueue`, `getAllPending`, `clearQueue`, `getQueueCount`, `updateRetryCount`, `updateQueuedOperation`.

**Files:**

- `src/lib/offlineQueue.ts`

---

## 4. Infrastructure: safeFetch TypeError Narrowing

`isOfflineError()` was catching ALL `TypeError` instances. Narrowed to only match network-related messages via regex: `/failed to fetch|networkerror|load failed/i`.

**Files:**

- `src/lib/safeFetch.ts`

---

## 5. Infrastructure: Missing `force-dynamic` Exports

Four API routes lacked `export const dynamic = "force-dynamic"`, risking stale cached responses in production.

**Files:**

- `src/app/api/items/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/api/auth/reset/route.ts`
- `src/app/api/error-logs/route.ts`

---

## 6. Hard Rule: `fetch()` → `safeFetch()` for Mutations

Replaced raw `fetch()` calls with `safeFetch()` across 6 feature hook files. `safeFetch` provides a pre-flight online check, 3-second timeout, and calls `markOffline()` on failure.

| File                                               | Replacements |
| -------------------------------------------------- | ------------ |
| `src/features/catalogue/hooks.ts`                  | 13 mutations |
| `src/features/recipes/hooks.ts`                    | 15 mutations |
| `src/features/debts/useDebts.ts`                   | 6 mutations  |
| `src/features/statement-import/hooks.ts`           | 4 mutations  |
| `src/features/categories/useCategoryManagement.ts` | 1 mutation   |
| `src/features/transactions/useSplitBill.ts`        | 1 mutation   |

**Total: ~40 raw `fetch()` calls replaced.**

---

## 7. Hard Rule: Undo Buttons on All Toasts

Added `ToastIcons` import and `{ duration: 4000, action: { label: "Undo", onClick } }` to every `toast.success()` call that was missing it.

### `src/features/recipes/hooks.ts` — 10 toasts

- Recipe created / updated / deleted
- Meal planned / updated / removed
- Ingredients added to shopping list
- Recipe generated with AI
- Version saved
- Cooking feedback saved

### `src/features/catalogue/hooks.ts` — 4 toasts

- Module updated
- Category updated
- Item updated
- Sub-item added

### `src/features/debts/useDebts.ts` — 5 toasts

- Debt created
- Debt fully settled
- Debt partially settled
- Debt unarchived
- Debt deleted (added in prior pass)

### `src/features/inventory/hooks.ts` — 3 toasts

- Item added to inventory
- Item restocked
- Items added to shopping list

### `src/features/items/useItems.ts` — 3 toasts

- Exception created for occurrence
- Exception removed
- Occurrence updated

### `src/features/items/useItemActions.ts` — 1 toast + bugfix

- "Marked as pending" toast
- Added missing `const queryClient = useQueryClient()` to `useItemActionsWithToast` (was causing TS error)

### `src/features/hub/itemLinksHooks.ts` — 2 toasts

- Product info refreshed
- Bulk refresh completed

**Total: ~28 toasts fixed across 7 files.**

---

## 8. Hard Rule: No Red on Task/Item Rows

Removed red coloring from individual task/item rows in the mission control component. Container headers and delete buttons retain red/amber per the rules. Overdue labels now use `text-white/40`.

| Element                      | Before                           | After                                |
| ---------------------------- | -------------------------------- | ------------------------------------ |
| Priority `urgent` badge      | `text-red-400 bg-red-500/20`     | `text-amber-400 bg-amber-500/20`     |
| Overdue subtask row bg (×2)  | `border-red-500/30 bg-red-500/5` | `border-white/20 bg-white/5`         |
| Overdue checkbox border (×2) | `border-red-400/50`              | `border-amber-400/50`                |
| Overdue item card            | `bg-red-500/15 border-l-red-400` | `bg-white/[0.06] border-l-amber-400` |
| "• overdue" text label       | `text-red-400`                   | `text-white/40`                      |
| Urgent `Zap` icon            | `text-red-400`                   | `text-amber-400`                     |

**Files:**

- `src/components/web/WebTabletMissionControl.tsx`

---

## 9. Linting: ESLint Severity Upgrade

Changed two ESLint rules from `"warn"` to `"error"` so they block CI instead of being silently ignored.

- `@typescript-eslint/no-explicit-any` → `"error"`
- `react-hooks/exhaustive-deps` → `"error"`

**Files:**

- `eslint.config.js`

---

## Validation

`pnpm typecheck` passes with **zero errors** after all changes.
