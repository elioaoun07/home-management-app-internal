---
created: 2026-07-01
type: audit-evidence
status: living
tags:
  - pm/audit
  - evidence
  - codebase-audit
---

# Evidence Index

## Searches Used

| Search | Purpose | Result summary |
|---|---|---|
| `console\.(log|warn|error)` in `src/**` | Find production logging. | Many matches returned; prior PM audit counted hundreds. |
| `\bfetch\s*\(` in `src/**` | Find raw request paths. | Many matches returned across hooks, components, libs, and API routes. |
| `invalidateQueries|setQueryData|useMutation` in `src/features/**` | Locate mutation/cache surfaces. | Broad mutation coverage; needs dependency-aware review. |
| `**/*.{test,spec}.{ts,tsx}` | Count test/spec files. | 9 files found. |
| `src/features/` directory listing | Compare actual features to docs. | 32 top-level feature directories found. |

## Evidence Table

| Category | Severity | Path | Evidence | Next action |
|---|---|---|---|---|
| Security | High | `src/app/api/ai-chat/route.ts` | High-density `console.*` and sensitive AI/chat context handling. | Remove/route logs, then add tests for error responses. |
| Security | High | `src/app/api/auth/test-connection/route.ts` | Logs auth user/error diagnostic data. | Remove or guard; ensure route is dev-only or safe. |
| Security | High | `src/app/api/auth/signup/route.ts` | Logs signup errors/warnings. | Route production-worthy errors through structured logging. |
| Security | Medium | `src/app/api/user-preferences/route.ts` | Logs update/insert failures with context. | Replace with structured logger or Error Logs module. |
| Security | Medium | `src/app/api/tts/route.ts` | External Azure call via raw `fetch()`. | Confirm timeout and sanitized failure behavior. |
| Security | Medium | `src/app/api/recipes/extract-from-url/route.ts` | External URL fetch/extraction. | Keep strict timeout/content handling; avoid SSRF-like expansion. |
| Security | Medium | `src/app/api/hub/item-links/route.ts` | External Jina reader call. | Bound timeout and sanitize returned content/errors. |
| Security | Medium | Live Supabase RLS policies | Repository schema omits policy bodies. | Run live RLS policy audit. |
| Functional | High | `src/hooks/useNotifications.ts` | Many raw notification request paths. | Classify GET vs mutation; migrate mutations to `safeFetch()`. |
| Functional | High | `src/features/transactions/useDashboardTransactions.ts` | Financial mutations and invalidation surface. | Audit affected queries: balances, dashboard, analytics, debts, drafts. |
| Functional | High | `src/components/hub/ShoppingListView.tsx` | Junction surface with many raw group/message request paths. | Migrate mutation requests and test hub/shopping invalidation. |
| Functional | High | `src/features/hub/hooks.ts` | Hub threads/messages/actions mutation surface. | Audit invalidation for messages, threads, actions, notifications. |
| Functional | Medium | `src/features/items/useItemActions.ts` | Item complete/skip/cancel affects several views. | Audit invalidation for items, day plans, flexible routines, notifications. |
| Functional | Medium | `src/features/voice-conversation/conversationEngine.ts` | AI stream request path. | Use explicit long-running timeout semantics. |
| Functional | Medium | `src/features/voice-conversation/greetingCache.ts` | TTS/greeting request path. | Use explicit long-running timeout semantics. |
| Functional | Medium | `src/lib/offlineQueue.ts` | Queue capacity behavior. | Add visible queue-full UX. |
| Functional | Medium | `src/lib/offlineSyncEngine.ts` | Replay/sync failure behavior. | Add tests and user-visible failure state. |
| Functional | Medium | `src/lib/utils/date.ts` | Canonical date utility anchor. | Audit date mutation callers against timezone rules. |
| Structural | High | `eslint.config.mjs` | No confirmed hard guard against `console.*`. | Add enforcement after cleanup. |
| Structural | Medium | `src/features/atlas/` | Feature directory needs classification. | Mark internal/cross-cutting or document as feature. |
| Structural | Medium | `src/features/blink/` | Possible legacy/orphaned directory. | Confirm imports, then archive/delete/classify. |
| Structural | Medium | `src/features/era/` | AI/assistant-adjacent directory needs doc mapping. | Tie to Hub & ERA or AI Assistant docs. |
| Structural | Medium | `src/features/memories/` | Needs user-facing/internal classification. | Add Feature Map/Index decision. |
| Structural | Medium | `src/features/today/` | Needs relationship to Plan My Day/Focus clarified. | Classify or fold into docs. |
| Structural | Medium | `src/features/voice-conversation/` | Needs relationship to Hub & ERA/AI Assistant clarified. | Add docs/index link. |
| Structural | Medium | `tests/pm-mutations.test.ts` and `src/lib/**/*.test.ts` | Only 9 test/spec files found. | Add API route, hook, offline, and UI tests. |
| Enhancement | Medium | `src/components/web/`, `src/components/hub/`, `src/app/**` | Mobile/floating panel rules need visual QA. | Run mobile viewport audit. |

## Current Test File Baseline

| File |
|---|
| `tests/pm-mutations.test.ts` |
| `src/lib/utils/splitBill.test.ts` |
| `src/lib/utils/dayOccurrences.test.ts` |
| `src/lib/utils/date.test.ts` |
| `src/lib/utils/anomalyDetection.test.ts` |
| `src/lib/schedule/expandOccurrences.test.ts` |
| `src/lib/recurring.test.ts` |
| `src/lib/budget/budgetForecast.test.ts` |
| `src/lib/balance-utils.test.ts` |

## Evidence Caveats

- Raw `fetch()` is not automatically wrong. Classify by request intent before editing.
- `console.error` can be useful during development, but committed production paths should use structured logging or guards.
- RLS performance cannot be proven from repository schema alone.
- Mobile overlap and floating panel opacity require viewport testing, not just static search.