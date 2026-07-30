---
created: 2026-07-01
type: audit-report
status: living
tags:
  - pm/audit
  - functional-risk
  - codebase-audit
---

# Functional Vulnerabilities

## Summary

The highest functional risks are stale state, unsafe mutation requests, and incomplete recovery paths. These risks are more important than their code size suggests because the app handles balances, recurring items, notifications, household collaboration, and offline behavior.

## High - Multi-View Cache Invalidation Gaps

**Status:** confirmed risk pattern; exact fixes require mutation-by-mutation review.

TanStack Query is used widely and feature query keys exist, which is good. The risk is that several mutations affect data shown by multiple views but invalidate only the local query family.

Representative evidence:

| Surface | Risk |
|---|---|
| `src/features/transactions/useDashboardTransactions.ts` | Transaction create/update/delete can affect transaction lists, account balances, dashboard stats, analytics, drafts, debts, and recurring projections. |
| `src/features/hub/hooks.ts` | Hub message actions can affect threads, messages, linked item URLs, notifications, transactions, shopping lists, and reminders. |
| `src/components/hub/ShoppingListView.tsx` | Shopping group/message changes can affect hub messages, shopping list views, meal planning, and inventory-adjacent displays. |
| `src/features/items/useItemActions.ts` | Complete/skip/cancel flows can affect items, day plans, flexible routines, notification counts, and dashboard summaries. |
| `src/features/debts/useDebts.ts` | Debt settlement can affect debts, transactions, balances, and notifications. |

Impact:

- A user deletes or edits a transaction, but balance or dashboard values remain stale.
- A reminder is completed but remains visible in daily summaries.
- A hub action succeeds but related message or notification state remains outdated.

Recommended fix:

1. For every mutation, list all query families that render the changed data.
2. Prefer shared invalidation helpers for finance and schedule surfaces.
3. Add hook tests around the most important invalidation contracts.

## High - Raw Client Mutation Fetches Bypass Offline/Timeout Semantics

**Status:** confirmed broad surface.

Hard Rule 6 requires mutations to use `safeFetch()` so the app gets pre-flight connectivity checks, timeout behavior, and offline marking. Current raw `fetch()` usage appears in multiple client mutation paths.

Representative evidence:

| File | Risk |
|---|---|
| `src/hooks/useNotifications.ts` | Notification create/update/read/preference mutations use raw requests. |
| `src/features/transactions/useDashboardTransactions.ts` | Financial mutation flows use raw requests. |
| `src/components/expense/TemplateQuickEntryButton.tsx` | Template create/update/delete flows use raw requests. |
| `src/components/expense/ReceiptSheet.tsx` | Receipt mutation flows use raw requests. |
| `src/components/watch/WatchView.tsx` | Watch draft/transaction behavior includes raw requests. |
| `src/features/voice-conversation/greetingCache.ts` | TTS request needs long-running timeout handling. |
| `src/features/voice-conversation/conversationEngine.ts` | AI stream request needs explicit long-running semantics. |

Impact:

- Poor networks can leave users in indefinite loading states.
- Offline state may be inaccurate or missing.
- Queue/retry expectations diverge by module.

Recommended fix:

1. Convert client mutations to `safeFetch()`.
2. Keep ordinary CRUD on the default timeout unless the route is known to be slow.
3. Use explicit long timeouts for AI, voice, upload, extraction, and external service calls.

## Medium - Undo Recovery Is Not Always Rollback-Safe

**Status:** likely risk pattern.

Undo flows are user-facing recovery paths. Several spots report failure with a toast or catch block, but the audit did not confirm that every failure restores the previous query cache, visibility flag, or optimistic state.

Representative surfaces:

| Surface | Risk |
|---|---|
| Hub message delete/hide flows | Undo can fail after local visibility already changed. |
| Transaction delete undo | A failed restore can leave transaction lists and balances disagreeing. |
| Shopping list optimistic changes | Failure paths need cache rollback across messages and groups. |

Recommended fix:

1. Standardize mutation contexts with `previousData` snapshots.
2. On failure, restore cache before showing the error toast.
3. Add tests for delete -> undo failure -> rollback.

## Medium - Timezone and Recurrence Edges Need a Focused Audit

**Status:** confirmed risk domain; exact defect list needs date-flow review.

The project has canonical utilities such as `src/lib/utils/date.ts`, but date code remains risky wherever plain `new Date(...)`, recurrence expansion, cron local-time parsing, or wall-clock preservation appears.

Representative concerns:

- Recurring item occurrences across DST can shift if wall-clock intent is not preserved.
- Household partners in different zones can see different local interpretations.
- Cron routes can miss or duplicate reminders when local-time parsing is hand-rolled.
- API mutations can store an instant when the user intended a local wall-clock time.

Recommended fix:

1. Use the timezone-handling skill before editing date/recurrence mutations.
2. Enforce canonical helpers for ISO conversion, RRule DTSTART, and wall-clock adjustment.
3. Add tests for DST boundaries and cross-timezone household display.

## Medium - Offline Queue Overflow Can Become Invisible Data Loss

**Status:** risk identified.

`src/lib/offlineQueue.ts` has a maximum pending operation count. If the app reaches that limit, users need a clear UI warning and next step.

Impact:

- A user can believe an action was queued when it was rejected.
- Long offline sessions become less trustworthy.

Recommended fix:

1. Surface queue size in `SyncContext` or adjacent UI state.
2. Show a toast when the queue is full.
3. Consider priority-aware trimming only after making rejection visible.

## Medium - Mobile Sticky/Fixed Layouts Need Verification

**Status:** visual verification required.

Hard Rule 16 requires fixed or sticky headers to have matching content offsets. Because several pages and isolated routes own their own layout, this needs a mobile viewport pass rather than a pure code search.

Representative surfaces to verify:

- Expense entry and receipt flows.
- Hub chat and shopping list sheets.
- Guest portal routes.
- NFC and other isolated layouts.
- Reminders/schedule pages with sticky controls.

Recommended fix:

1. Test the pages at small mobile widths.
2. Ensure headers have matching top padding and bottom nav/input areas have safe-area offsets.
3. Update Atlas or UI notes if a route has a special layout exception.