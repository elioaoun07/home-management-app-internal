---
created: 2026-07-01
type: audit-report
status: living
tags:
  - pm/audit
  - enhancements
  - codebase-audit
---

# Areas To Enhance

## 1. Make Hard Rules Mechanically Enforced

Enhancement:

- Add `no-console` lint enforcement after the initial cleanup.
- Add a focused script or lint rule that flags raw `fetch()` in client mutation contexts.
- Add a docs check that fails when a new top-level feature lacks a Feature Map/Feature Index classification.

Why:

Rules that only live in instructions drift over time. Mechanical feedback keeps future agents and future-you honest.

## 2. Build A Request-Safety Classification System

Enhancement:

Create a small request policy table and enforce it in reviews:

| Request type | Tooling expectation |
|---|---|
| Client mutation | `safeFetch()` with default CRUD timeout unless slow. |
| Long-running client mutation | `safeFetch()` with explicit `timeoutMs`. |
| Client GET query | Raw `fetch()` can be acceptable inside query functions if no mutation/offline semantics are needed. |
| Prefetch | Raw `fetch()` can be acceptable with clear failure swallowing. |
| Connectivity probe | Raw `fetch()` is expected; `safeFetch()` would recurse into connectivity behavior. |
| Service worker | Raw `fetch()` is expected; audit separately. |
| Server external call | Raw `fetch()` can be acceptable with `AbortSignal.timeout()` and sanitized errors. |

Why:

This avoids two bad outcomes: allowing unsafe mutation fetches, or blindly converting legitimate raw fetches and breaking special cases.

## 3. Add Cache Invalidation Contracts

Enhancement:

For each high-value mutation, document and test the affected query families.

Priority surfaces:

- Transactions and balances.
- Debts and settlement transactions.
- Items, day plans, flexible routines, and notifications.
- Hub messages, shopping groups, and message actions.
- Notifications and unread counters.

Why:

The codebase already has query keys. The missing layer is a contract that says which query families must update together.

## 4. Expand Tests Where They Buy Confidence

Enhancement:

Add tests in this order:

1. API routes: auth, Zod failures, 409 conflict, household access, cron authorization.
2. Mutation hooks: invalidation, optimistic update, rollback, undo.
3. Offline/sync: queue capacity, replay, failure reporting.
4. Timezone/recurrence: DST boundaries, wall-clock preservation, cross-timezone display.
5. Critical UI workflows: transaction entry, hub action creation, shopping group changes, receipt upload/delete.

Why:

The app handles money, dates, and household coordination. Tests should concentrate on behavior where silent regressions are expensive.

## 5. Improve Offline And Sync Feedback

Enhancement:

- Show queue size in sync/debug UI.
- Show a clear toast when the queue is full.
- Distinguish offline, timeout, server error, validation error, and auth expired states.
- Add retry/backoff visibility for failed queued operations.

Why:

Offline support is only trustworthy when users can see what happened to their actions.

## 6. Classify Shadow/Internal Features

Enhancement:

Add a simple classification for top-level feature directories:

- Standalone app feature.
- Junction feature.
- Internal infrastructure.
- Experimental.
- Legacy/orphaned.
- Folded into another feature.

Why:

This keeps Feature Map, Feature Index, Atlas, and PM planning in sync without pretending every folder is a full user-facing module.

## 7. Add A Live Database Audit Runbook

Enhancement:

Create a short runbook for checking live RLS policies, SECURITY DEFINER RPCs, hot child table access, and function definitions.

Why:

The repository schema cannot prove live RLS policy performance. A repeatable runbook closes that audit gap.

## 8. Add A Focused Mobile Visual QA Checklist

Enhancement:

Create a small checklist for mobile viewport verification:

- Header/content offset.
- Bottom nav and safe-area spacing.
- Drawer/sheet scroll reachability.
- Floating panel opacity.
- Button text/icon overflow.
- Toast visibility and undo action access.

Why:

Many project hard rules are visual or interaction rules. They need viewport checks, not only TypeScript checks.