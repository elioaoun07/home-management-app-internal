# Claude Skills Reference

This note summarizes the project playbooks under `.claude/skills/`. Use it as a quick orientation guide; the source of truth for each skill is still its own `SKILL.md` file.

| Skill | What it does |
|---|---|
| `start-task` | Starts any repo task by restating the goal, classifying the work, routing to the right playbooks, and enforcing the docs-first workflow through Feature Map, vault docs, schema, and common patterns. |
| `finish-task` | Defines done: self-review greps, typecheck/lint/tests, functional verification, docs/Atlas updates, PM updates, and migration pairing before reporting completion. |
| `fix-bug` | Evidence-first debugging workflow for bugs, regressions, crashes, wrong values, and stale UI. Requires reproduction/context, a traced data path, proven root cause, minimal fix, verification, and PM trace. |
| `add-feature` | Vertical-slice workflow for adding behavior to an existing module: DB, API, types, hooks, UI, wiring, docs. Routes to the specialized skills for each risky layer. |
| `new-module` | Scaffolds a brand-new standalone or junction module while keeping feature files, API/page surfaces, Feature Map, vault docs, CLAUDE.md Feature Index, and Atlas in sync. |
| `api-route` | API route recipe for `src/app/api/`: Supabase client choice, auth first, Zod validation, household linking, DB operations, status-code mapping, and cron-route rules. |
| `db-migration` | Database change workflow for tables, columns, indexes, policies, RPCs, and enum values. Requires migration file first, `schema.sql` end-state update, RLS decision, and code cascade. |
| `cache-invalidation` | TanStack Query invalidation rules. Requires invalidating every query key that displays mutated data, with special helpers for balance-affecting changes and awareness of localStorage/IndexedDB caches. |
| `timezone-handling` | UTC and DST rules for dates, ISO strings, and recurrence. Points agents to canonical utilities like `localToISO`, `buildFullRRuleString`, and `adjustOccurrenceToWallClock`. |
| `ui-guardrails` | UI hard rules: theme-aware surfaces, person-absolute colors, opaque floating panels, fixed-header offsets, decimal inputs, Undo toasts, click semantics, and mobile-first verification. |
| `money-rules` | Financial correctness invariants for accounts, transactions, transfers, recurring payments, debts, budgets, drafts, analytics, and trip budgets. Requires worked balance examples and tests for changed money math. |
| `recurrence-safety` | Safety rules for recurring payments and item recurrence. Protects exactly-once behavior, skip vs postpone semantics, DST handling, and avoiding duplicate expansion engines. |
| `data-repair` | Safe production data repair workflow for SQL runbooks, browser storage cleanup, bad rows, and backfills. Requires inspect, count, backup, repair, verify, and rollback. |
| `skill-factory` | Meta-playbook for creating or extending project skills. Decides whether a skill is warranted, grounds it in verified code/docs, registers it, and QA-checks it against the junior-test standard. |

## Typical Routing

| Task | Start with |
|---|---|
| Any new task | `start-task` |
| Bug report | `start-task` + `fix-bug` |
| New behavior in an existing module | `start-task` + `add-feature` |
| Brand-new module | `start-task` + `new-module` |
| API changes | `api-route` |
| DB changes | `db-migration` |
| UI/page/component changes | `ui-guardrails` |
| Money logic | `money-rules` |
| Recurrence/due-date logic | `recurrence-safety` |
| Cached or stale data behavior | `cache-invalidation` |
| Date, time, DST, or RRule changes | `timezone-handling` |
| Data cleanup/backfill | `data-repair` |
| Creating a new skill | `skill-factory` |

Every task should end with `finish-task`.
