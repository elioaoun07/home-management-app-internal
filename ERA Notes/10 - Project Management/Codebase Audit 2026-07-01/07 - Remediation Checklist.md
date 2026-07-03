---
created: 2026-07-01
type: audit-checklist
status: living
tags:
  - pm/audit
  - checklist
  - codebase-audit
---

# Remediation Checklist

## P0 - Fix Before More Feature Expansion

- [ ] Sweep production `console.*` from auth, API, AI, and high-traffic client components.
- [ ] Add mechanical no-console enforcement after the initial cleanup.
- [ ] Classify raw `fetch()` usage into allowed, convert-to-`safeFetch`, and server-timeout categories.
- [ ] Convert unsafe client mutation fetches in notification, transaction, hub/shopping, template, receipt, and watch flows.
- [ ] Add explicit long-running timeouts for AI, voice, upload, extraction, and external service calls.
- [ ] Audit transaction mutation invalidation across transactions, balances, dashboard, analytics, debts, drafts, and recurring projections.
- [ ] Audit hub/shopping mutation invalidation across messages, threads, shopping groups, meal planning, inventory-adjacent displays, and notifications.

## P1 - Stabilize Recovery And Data Consistency

- [ ] Standardize undo mutation rollback with `previousData` snapshots.
- [ ] Add tests for delete -> undo failure -> restored UI/cache state.
- [ ] Audit item/day-plan/flexible-routine invalidation paths.
- [ ] Audit debt settlement invalidation paths.
- [ ] Audit notification unread/preference/action invalidation paths.
- [ ] Add visible offline queue-full UX.
- [ ] Add offline sync replay/failure tests.
- [ ] Run timezone audit for date mutations, recurrence, cron local-time parsing, and DST boundaries.
- [ ] Add date tests for DST and wall-clock recurrence behavior.
- [ ] Normalize API error responses for validation, conflicts, auth, missing resources, and transient DB issues.

## P2 - Strengthen Architecture And Documentation

- [ ] Classify top-level feature directories as Standalone, Junction, Internal, Legacy, Empty, or Folded.
- [ ] Update Feature Map/Feature Index/Atlas only where classification affects user-facing behavior.
- [ ] Decide what to do with `src/features/blink/`.
- [ ] Decide what to do with `src/features/today/`.
- [ ] Clarify `src/features/era/`, `src/features/memories/`, and `src/features/voice-conversation/` ownership.
- [ ] Add API route tests for auth, Zod failure, 409 conflict, cron auth, and household access.
- [ ] Add hook tests for high-value mutation invalidation.
- [ ] Add a live Supabase RLS policy audit runbook.
- [ ] Run and record the live RLS policy audit.
- [ ] Run a mobile viewport audit for fixed/sticky headers and floating panels.

## P3 - Improve Developer Experience

- [ ] Add a request-safety checklist to the architecture docs.
- [ ] Add a cache invalidation contract template for new mutations.
- [ ] Add a PM cadence note for refreshing the dashboard after audit updates.
- [ ] Add visual QA checklist entries for button overflow, panel opacity, header offsets, and toast undo reachability.

## Verification

- [ ] Re-run `console\.(log|warn|error)` search after the console sweep.
- [ ] Re-run `\bfetch\s*\(` search after request classification.
- [ ] Run `pnpm docs:check` after feature documentation changes.
- [ ] Run `pnpm lint` after adding lint enforcement or code cleanup.
- [ ] Run `pnpm typecheck` after code changes.
- [ ] Run `pnpm test` after adding or changing tests.
- [ ] Run `pnpm pm:dashboard` after PM Markdown changes.

## Done Definition

This audit is considered closed when:

1. All P0 items are checked.
2. P1 items either have fixes or linked follow-up tickets in the relevant module PM folders.
3. Feature classification is reconciled.
4. Live RLS audit status is recorded.
5. The PM dashboard has been regenerated and links to this folder.