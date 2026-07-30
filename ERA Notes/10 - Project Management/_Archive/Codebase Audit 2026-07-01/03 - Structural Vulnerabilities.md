---
created: 2026-07-01
type: audit-report
status: living
tags:
  - pm/audit
  - structural-risk
  - codebase-audit
---

# Structural Vulnerabilities

## Summary

The codebase is unusually well documented for a solo product, but the structure relies heavily on human memory. The biggest structural risk is that hard rules are documented but not always enforced by tooling.

## High - Hard Rule Enforcement Is Manual In Key Areas

**Status:** confirmed.

Hard Rule 22 bans committed `console.*`, and Hard Rule 6 bans raw mutation `fetch()`. Both patterns still appear broadly. This means the rules are written down but are not yet enforced strongly enough by linting, hooks, or tests.

Impact:

- New violations can enter without immediate feedback.
- Reviews spend attention on mechanical hygiene instead of behavior.
- Agents can follow outdated local patterns they see in code.

Recommended fix:

1. Add `no-console` enforcement after the initial cleanup.
2. Add a custom lint rule or script that flags raw `fetch()` in client mutation contexts.
3. Keep documented exceptions explicit: service worker, connectivity probe, GET prefetch, signed asset download, and server-only external calls with timeout.

## Medium - Feature Inventory Drift

**Status:** confirmed classification gap.

`src/features/` contains feature directories that need a clear classification as user-facing, internal, experimental, legacy, or folded into another module.

Directories requiring classification or doc reconciliation:

| Directory | Current concern |
|---|---|
| `src/features/atlas/` | Cross-cutting/internal feature needs explicit index treatment. |
| `src/features/blink/` | Likely legacy or empty/orphaned surface; decide archive/delete/ignore. |
| `src/features/era/` | AI/assistant-adjacent feature should be tied to Hub & ERA or AI Assistant docs. |
| `src/features/memories/` | Needs classification as app feature, assistant memory, or internal service. |
| `src/features/reminders/` | Needs relationship to Items & Reminders clarified. |
| `src/features/today/` | Needs relationship to Plan My Day/Focus clarified. |
| `src/features/voice-conversation/` | Needs relationship to Hub & ERA/AI Assistant clarified. |

Impact:

- Agents can miss real code or treat orphaned code as active.
- Feature Map and Feature Index stop being reliable routers.
- PM planning can double-count or hide work.

Recommended fix:

1. Create a classification table: Standalone, Junction, Internal, Legacy, Empty, or Folded.
2. Update Feature Map, Feature Index, Atlas, and PM docs only where the classification changes user-facing behavior.
3. Remove empty/legacy directories only after confirming no imports or routes depend on them.

## Medium - Test Coverage Is Too Utility-Heavy

**Status:** confirmed from file search.

Current test/spec file search found 9 files, mostly in utility and schedule/math areas:

- `tests/pm-mutations.test.ts`
- `src/lib/utils/splitBill.test.ts`
- `src/lib/utils/dayOccurrences.test.ts`
- `src/lib/utils/date.test.ts`
- `src/lib/utils/anomalyDetection.test.ts`
- `src/lib/schedule/expandOccurrences.test.ts`
- `src/lib/recurring.test.ts`
- `src/lib/budget/budgetForecast.test.ts`
- `src/lib/balance-utils.test.ts`

Gaps:

- API route auth and validation behavior.
- Mutation hook invalidation and rollback behavior.
- Offline queue and sync replay behavior.
- Cron authorization and due-item selection.
- High-value UI workflows such as transaction entry, hub actions, shopping list updates, and receipt flows.

Recommended fix:

1. Add route tests for auth, Zod failure, 409 conflict, and household access.
2. Add hook tests for transactions, items/day plans, notifications, hub/shopping, and debts.
3. Add regression tests as each P0/P1 finding is fixed.

## Medium - PM and Audit Metadata Drift

**Status:** confirmed.

The command center still references older audit dates in several places. That is expected for living documents, but after this audit the PM index and dashboard should point to the new dated audit pack.

Impact:

- The command center can suggest an older risk picture.
- New reports become hard to discover.

Recommended fix:

1. Link this folder from `ERA Notes/10 - Project Management/_index.md`.
2. Run `pnpm pm:dashboard` after adding or changing PM Markdown files.
3. Keep dated audit packs immutable enough to be comparable, while marking fixed items in the checklist.

## Low/Medium - Design System Consistency Needs A Targeted Pass

**Status:** needs visual/code audit.

Areas to check:

- Raw `<button>` usage where the local Button pattern should be used.
- Floating panels using translucent card styles instead of opaque page backgrounds.
- Mobile text overflow and header/content overlap.
- Hardcoded colors instead of theme variables/classes.
- Toasts missing undo actions or `ToastIcons` where the action is reversible.

Recommended fix:

Run this as a focused UI audit, not as drive-by refactors. Fix issues when touching the relevant feature surface.

## Structural Strengths

| Strength | Why it matters |
|---|---|
| Feature Map | Gives agents and maintainers fast intent-to-file routing. |
| Standalone/Junction model | Prevents accidental cross-feature coupling. |
| PM command center | Keeps product planning close to code reality. |
| Atlas generation | Reduces drift in app/page navigation metadata. |
| Skills for cache/timezone | Encodes high-risk domain knowledge outside ad hoc memory. |