---
created: 2026-07-01
type: audit-summary
status: living
tags:
  - pm/audit
  - codebase-audit
---

# Executive Summary - Codebase Audit 2026-07-01

## Scope

This audit covers the `budget-app` Next.js/PWA codebase, including API routes, feature modules, hooks, components, shared libraries, tests, architecture documentation, and PM documentation.

It is a repository audit, not a live Supabase production audit. Live RLS policies and production environment values must still be checked directly in Supabase because `migrations/schema.sql` does not include policy bodies.

## Severity Model

| Severity | Meaning | Release posture |
|---|---|---|
| High | Security exposure, production data loss, silent financial/date corruption, or UX collapse. | Fix before release or put behind an explicit mitigation. |
| Medium | Likely regression, stale data, broken recovery path, hard-rule breach, or missing guardrail. | Schedule in the current or next hardening cycle. |
| Low | Maintainability, design consistency, discoverability, or future-risk issue. | Fix opportunistically or as part of nearby work. |

## Verdict

The codebase has a strong architectural core: Feature Map routing, Standalone/Junction module boundaries, Zod validation, Supabase client separation, cron authorization, household-linking rules, query-key conventions, and PM traceability are all real strengths.

The main vulnerability is enforcement drift. Several hard rules exist in documentation but are not mechanically enforced, so violations keep returning: production `console.*`, raw mutation `fetch()`, incomplete cache invalidation, sparse route/hook tests, and documentation drift around new feature directories.

## Release-Blocking Priorities

| Priority | Finding | Why it matters | Report |
|---|---|---|---|
| P0 | Production `console.*` remains widespread. | Leaks internal state, adds production noise, and violates Hard Rule 22. | [01 - Security Vulnerabilities](<01 - Security Vulnerabilities.md>) |
| P0 | Client mutation paths still use raw `fetch()`. | Missing timeout/offline semantics can create false offline state, hanging spinners, or dropped mutations. | [02 - Functional Vulnerabilities](<02 - Functional Vulnerabilities.md>) |
| P0 | Multi-view mutation invalidation is incomplete in several hot areas. | Users can see deleted/changed data in one view while balances, stats, dashboards, or partner views stay stale. | [02 - Functional Vulnerabilities](<02 - Functional Vulnerabilities.md>) |
| P1 | API, hook, and component tests are not deep enough for the blast radius. | Current tests mostly protect utilities; core behavior can regress silently. | [03 - Structural Vulnerabilities](<03 - Structural Vulnerabilities.md>) |
| P1 | Feature inventory and PM docs drift behind implementation. | Agents and future maintenance lose the fastest path from intent to files. | [03 - Structural Vulnerabilities](<03 - Structural Vulnerabilities.md>) |

## Health Snapshot

| Area | Health | Notes |
|---|---|---|
| Architecture rules | Strong | Keep the Feature Map, module model, hard rules, and docs-first routing. |
| API validation | Strong | Zod schemas and auth checks are broadly present. |
| Supabase client selection | Strong | Server/admin/client separation is a known, documented pattern. |
| Cron security | Strong | Cron routes consistently check Bearer auth and use admin clients. |
| Logging hygiene | Weak | Prior audit counted hundreds of `console.*`; current spot-check still finds widespread matches. |
| Mutation request safety | Weak | Raw `fetch()` appears in many client mutation surfaces and long-running calls. |
| Cache invalidation | Mixed | Query keys exist, but mutation invalidation needs a dependency-aware audit. |
| Test coverage | Thin | Current file search found 9 test/spec files, mostly utility-level. |
| Documentation alignment | Mixed | Feature Map is strong; Feature Index/PM summaries need periodic reconciliation. |

## Recommended Order

1. Remove or route production logging, then add mechanical enforcement.
2. Audit raw `fetch()` by intent: allow GET/prefetch/probes/service-worker cases, migrate client mutations and long-running calls.
3. Fix high-blast-radius cache invalidation: transactions, hub/shopping, notifications, day plans/items, debts.
4. Add route and hook tests for the fixed behavior before widening refactors.
5. Reconcile Feature Index, PM dashboard, and shadow/internal feature classification.

## Verification Commands

Run these after remediation or after any update to this audit pack:

```bash
pnpm docs:check
pnpm pm:dashboard
pnpm lint
pnpm typecheck
pnpm test
```

For docs-only updates, `pnpm pm:dashboard` and `pnpm docs:check` are the minimum useful checks.