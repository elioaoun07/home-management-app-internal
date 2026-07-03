---
created: 2026-07-01
type: audit-report
status: living
tags:
  - pm/audit
  - hard-rules
  - codebase-audit
---

# Strong Areas To Keep As Hard Rules

## Summary

This project has several practices that should stay non-negotiable. The fixes from this audit should strengthen these rules, not replace them.

## Keep These Rules

| Rule | Why to keep it | Enforcement to add or preserve |
|---|---|---|
| Read Feature Map before code edits. | It is the fastest intent-to-file router and reduces broad repo wandering. | Keep Feature Map current and run docs checks after feature changes. |
| Identify Standalone vs Junction module type. | It controls blast radius and prevents accidental cross-feature imports. | Keep module classification in Feature Map/Feature Index. |
| Do not import between standalone feature directories. | Shared logic belongs in `src/lib`, `src/components`, or `src/types`. | Add architecture checks if drift appears. |
| Zod schemas for API inputs. | Runtime validation protects database and downstream assumptions. | Route tests should assert invalid input responses. |
| Use the correct Supabase client. | Prevents privilege leaks and auth boundary mistakes. | Keep browser/server/admin separation explicit in docs and reviews. |
| Cron routes require Bearer auth. | Cron endpoints are privileged automation surfaces. | Keep `CRON_SECRET`, `supabaseAdmin()`, and `maxDuration = 60`. |
| Map unique conflicts to HTTP 409. | Clients can distinguish duplicates from server failures. | Add API tests around `23505` behavior. |
| Include household partner data only through explicit rules. | Household sharing is powerful but privacy-sensitive. | Keep `household_links`, `ownOnly`, and private filters central. |
| Use query keys instead of inline arrays where possible. | Consistent keys make invalidation auditable. | Expand shared invalidation helpers for high-blast-radius domains. |
| Use `safeFetch()` for client mutations. | Gives pre-flight connectivity, timeout, and offline behavior. | Add a raw-fetch classifier and enforcement script. |
| Use explicit timeouts for long-running calls. | Prevents false offline state and aborted AI/voice/upload flows. | Document timeout categories and test slow paths. |
| Keep UTC/storage and wall-clock intent separate. | Prevents DST and timezone bugs. | Use timezone skill and date utility tests before recurrence edits. |
| Keep floating panels opaque. | Prevents text bleed-through and unreadable overlays. | Add mobile/visual QA checks. |
| Keep fixed/sticky headers offset from content. | Prevents mobile overlap and unreachable controls. | Verify on mobile viewport for affected routes. |
| Create migrations before schema updates. | Migration files are the manual Supabase runbook. | Keep migration hook/check active. |
| Update PM docs with code changes. | Prevents orphan fixes and lost planning context. | Keep Hard Rule 25 active. |
| Never edit `src/components/ui/` directly. | Preserves shadcn/ui source boundaries. | Keep hook enforcement. |

## Practices That Are Already Paying Off

### Feature Map Routing

The Feature Map is a real advantage. It converts user language into module files and lowers the cost of safe edits.

### Module Model

The Standalone/Junction distinction is the right abstraction for this app. Standalone modules stay isolated; junction modules make cross-module dependencies explicit.

### Query Key Discipline

The codebase already uses feature-scoped query keys in many modules. That gives cache invalidation work a clear foundation.

### Error Logs Module

The existence of a structured Error Logs module means the project does not need to choose between silence and `console.*` noise. Route production-worthy errors there.

### Atlas And PM Automation

Generated Atlas data and the PM dashboard make documentation discoverable. Keep these as part of the normal verification loop.

## Hard-Rule Upgrades From This Audit

1. Convert the no-console rule from documentation to lint enforcement after cleanup.
2. Convert safeFetch expectations into a request classification checklist.
3. Convert cache invalidation guidance into mutation-specific tests.
4. Convert live RLS performance guidance into a repeatable Supabase audit runbook.