---
created: 2026-07-03
type: codex-checklist
status: active
tags:
  - codex
  - security
  - bugs
  - checklist
---

# CODEX - Security & Bug Enhancement Checklist

Source docs reviewed:

- `ERA Notes/10 - Project Management/Codebase Audit 2026-07-01/00 - Executive Summary.md`
- `ERA Notes/10 - Project Management/Codebase Audit 2026-07-01/01 - Security Vulnerabilities.md`
- `ERA Notes/10 - Project Management/Codebase Audit 2026-07-01/02 - Functional Vulnerabilities.md`
- `ERA Notes/10 - Project Management/Codebase Audit 2026-07-01/03 - Structural Vulnerabilities.md`
- `ERA Notes/10 - Project Management/Codebase Audit 2026-07-01/04 - Areas To Enhance.md`
- `ERA Notes/10 - Project Management/Codebase Audit 2026-07-01/07 - Remediation Checklist.md`
- `ERA Notes/10 - Project Management/_index.md`

## Priority Scale

| Rating | Meaning |
|---|---|
| Critical | Release-blocking or likely to expose data, corrupt user state, or break core money/date flows. |
| High | Major correctness, recovery, or enforcement issue with broad blast radius. |
| Medium | Important hardening issue that can cause regressions or user confusion. |
| Low | Useful cleanup or future-proofing once higher-risk items are handled. |

## P0 - Critical

- [ ] **Production `console.*` sweep and enforcement**  
  **Criticality:** Critical  
  **Why it matters:** Logs can leak internal state, auth/user context, AI context, and production error details. The project hard rule already bans committed `console.log`, `console.warn`, and `console.error`, but the audit still found broad usage.  
  **Likely scope:** `src/app/api/`, auth routes, AI routes, high-traffic client components, `src/components/ai/`, `src/components/web/`.  
  **Done when:** Debug logs are removed or routed through the approved logging path, and mechanical enforcement prevents reintroduction.

- [ ] **Classify raw `fetch()` and convert unsafe client mutations to `safeFetch()`**  
  **Criticality:** Critical  
  **Why it matters:** Client mutations that bypass `safeFetch()` miss pre-flight connectivity checks, timeout behavior, and offline marking. This can create hanging spinners, dropped actions, or false online/offline state.  
  **Likely scope:** `src/hooks/useNotifications.ts`, `src/features/transactions/useDashboardTransactions.ts`, `src/components/hub/ShoppingListView.tsx`, `src/components/expense/TemplateQuickEntryButton.tsx`, `src/components/expense/ReceiptSheet.tsx`, `src/components/watch/WatchView.tsx`.  
  **Done when:** Each fetch is classified as allowed raw fetch, convert-to-`safeFetch`, or server-only timeout case; unsafe client mutations are converted.

- [ ] **Add explicit timeouts for long-running AI, voice, upload, extraction, and external calls**  
  **Criticality:** Critical  
  **Why it matters:** The default `safeFetch()` timeout is 3 seconds, which is right for CRUD but wrong for AI/voice/upload/extraction. Missing explicit timeouts can falsely mark the app offline.  
  **Likely scope:** AI chat, voice conversation, TTS, receipt/upload flows, recipe URL extraction, item link extraction.  
  **Done when:** Slow calls use explicit `timeoutMs` or server-side bounded timeout behavior with sanitized errors.

- [ ] **Fix high-blast-radius cache invalidation gaps for finance and hub/shopping mutations**  
  **Criticality:** Critical  
  **Why it matters:** Users can see stale balances, dashboards, analytics, debts, notifications, or partner views after a mutation succeeds. This is especially risky for financial data.  
  **Likely scope:** transactions, balances, dashboard stats, analytics, debts, recurring projections, hub messages, shopping groups, notifications.  
  **Done when:** Mutation invalidation contracts are documented and implemented for the affected query families.

## P1 - High

- [ ] **Standardize undo rollback for delete/hide/optimistic flows**  
  **Criticality:** High  
  **Why it matters:** Undo is a core recovery path. If restore fails after local state changes, the UI and server can disagree.  
  **Likely scope:** hub message delete/hide, transaction delete undo, shopping list optimistic changes.  
  **Done when:** Mutations snapshot `previousData`, restore cache on failure, and show failure toasts only after rollback.

- [ ] **Audit item, day-plan, flexible-routine, debt, and notification invalidation paths**  
  **Criticality:** High  
  **Why it matters:** Schedule and notification state is cross-view. Completion, skip, cancel, settlement, read/unread, and preference changes can leave dashboards or counters stale.  
  **Likely scope:** `src/features/items/`, `src/features/day-plan/`, debts hooks, notifications hooks.  
  **Done when:** Each mutation invalidates every query family that can render the changed data.

- [ ] **Run live Supabase RLS policy verification**  
  **Criticality:** High  
  **Why it matters:** `migrations/schema.sql` does not include live RLS policy bodies. Hot child table policies with `EXISTS` subqueries can be correct but catastrophically slow.  
  **Likely scope:** live Supabase policies, hot child tables, SECURITY DEFINER RPCs.  
  **Done when:** Verification queries are run, results are recorded, and any hot-child-table policy violations have migrations/runbooks.

- [ ] **Add route and hook tests around security and mutation behavior**  
  **Criticality:** High  
  **Why it matters:** Current coverage is utility-heavy. API auth, Zod validation, 409 conflicts, household access, cron auth, mutation invalidation, and rollback can regress silently.  
  **Likely scope:** API route tests and hook tests for transactions, notifications, hub/shopping, debts, items/day plans.  
  **Done when:** Tests cover the fixed P0/P1 behavior before broader refactors.

## P2 - Medium

- [ ] **Run timezone and recurrence bug audit**  
  **Criticality:** Medium  
  **Why it matters:** Date bugs can silently shift reminders, recurring items, cron behavior, and household displays around DST or timezone boundaries.  
  **Likely scope:** date mutations, recurrence expansion, cron local-time parsing, wall-clock preservation.  
  **Done when:** Canonical date helpers are used consistently and DST/cross-timezone tests exist for the risky flows.

- [ ] **Make offline queue overflow visible**  
  **Criticality:** Medium  
  **Why it matters:** If the pending operation limit is reached, users need to know an action was not queued. Invisible rejection is effectively data loss from the user's perspective.  
  **Likely scope:** `src/lib/offlineQueue.ts`, `SyncContext`, sync/offline UI or toasts.  
  **Done when:** Queue-full state surfaces clearly and failed queue attempts are visible.

- [ ] **Normalize API error responses**  
  **Criticality:** Medium  
  **Why it matters:** Consistent validation, conflict, auth, missing-resource, and transient DB errors make client recovery and tests easier.  
  **Likely scope:** API routes touched during fetch/cache/test hardening.  
  **Done when:** Routes follow the project pattern and important errors are tested.

- [ ] **Verify mobile sticky/fixed layout bugs**  
  **Criticality:** Medium  
  **Why it matters:** Fixed headers, bottom nav/input areas, and sheets can overlap content on mobile if offsets and safe areas are missing.  
  **Likely scope:** expense/receipt flows, hub chat, shopping list sheets, guest portal, NFC, reminders/schedule.  
  **Done when:** Mobile viewport checks pass and special layout exceptions are documented.

## P3 - Low

- [ ] **Classify shadow/internal feature directories**  
  **Criticality:** Low  
  **Why it matters:** Feature Map and Feature Index are strong only if every active, internal, legacy, or folded feature is classified. Drift makes future work slower and riskier.  
  **Likely scope:** `src/features/atlas/`, `era/`, `memories/`, `reminders/`, `today/`, `voice-conversation/`, plus any legacy folders.  
  **Done when:** Each directory has a classification and docs are updated only where user-facing behavior changes.

- [ ] **Add request-safety and cache-invalidation templates/checks**  
  **Criticality:** Low  
  **Why it matters:** Templates reduce repeated mistakes after the immediate cleanup is done.  
  **Likely scope:** architecture docs, lint/scripts, mutation PR checklist.  
  **Done when:** New mutations have a clear request-safety and invalidation contract to follow.

## Recommended Pick Order

1. Production `console.*` sweep and enforcement.
2. Raw `fetch()` classification plus `safeFetch()` conversion for client mutations.
3. Long-running timeout fixes for AI/voice/upload/extraction.
4. Finance and hub/shopping cache invalidation contracts.
5. Undo rollback standardization.
6. Live RLS policy verification.
7. Route/hook tests for the behavior fixed above.

