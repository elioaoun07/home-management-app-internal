---
created: 2026-07-01
type: audit-report
status: living
tags:
  - pm/audit
  - security
  - codebase-audit
---

# Security Vulnerabilities

## Summary

The security posture is directionally good: authenticated API routes generally use `supabase.auth.getUser()`, request bodies are commonly validated with Zod, cron routes check `CRON_SECRET`, and sensitive Supabase access is kept server-side.

The main risks are production information leakage through logging, raw request paths that bypass project request safety rules, and one important unknown: live RLS policy bodies are not represented in the repository schema export.

## High - Production Logging Leaks Internal State

**Status:** confirmed risk.

Hard Rule 22 says there should be no `console.log`, `console.warn`, or `console.error` in committed code. A prior PM audit counted hundreds of `console.*` calls, and the current spot-check still finds widespread matches in API routes and client components.

Representative evidence:

| File | Risk |
|---|---|
| `src/app/api/ai-chat/route.ts` | Logs AI route errors and context failures across a large, sensitive route. |
| `src/app/api/auth/test-connection/route.ts` | Logs user and auth error objects in an auth diagnostic route. |
| `src/app/api/auth/signup/route.ts` | Logs signup failures and post-signup update warnings. |
| `src/app/api/user-preferences/route.ts` | Logs update/insert failures with structured context. |
| `src/components/ai/AIChatAssistant.tsx` | Logs usage, conversation, load, and delete failures on the client. |
| `src/components/web/WebDashboard.tsx` | Contains a user interaction `console.log` for country clicks. |

Impact:

- Internal state and identifiers can appear in browser or server logs.
- Production logs become noisy enough to hide real incidents.
- The documented hard rule is weakened because there is no mechanical enforcement.

Recommended fix:

1. Remove no-op/debug logs.
2. Route production-worthy errors through the Error Logs module or a guarded logger.
3. Add lint/pre-commit enforcement after the initial sweep so commits cannot reintroduce the pattern.

## Medium - Raw Request Paths Need Safety Classification

**Status:** confirmed broad surface; classify before editing.

Raw `fetch()` appears across hooks, components, libraries, and API routes. Not every raw fetch is a violation. GET prefetches, connectivity probes, service-worker internals, signed asset downloads, and server-only external calls can be legitimate. The risk is client mutations and long-running calls bypassing `safeFetch()` semantics.

Representative evidence:

| File | Risk |
|---|---|
| `src/hooks/useNotifications.ts` | Many notification mutations use raw `fetch()` and should be audited for `safeFetch()` conversion. |
| `src/features/transactions/useDashboardTransactions.ts` | Transaction mutations are financial hot paths and need timeout/offline behavior. |
| `src/components/hub/ShoppingListView.tsx` | Shopping-list group/message mutations use raw requests in a junction surface. |
| `src/features/voice-conversation/conversationEngine.ts` | AI streaming and voice paths need explicit long-running timeout strategy. |
| `src/app/api/debts/route.ts` | Server route calls another internal API path; direct DB/service extraction may be safer. |
| `src/app/api/tts/route.ts` | External Azure call needs explicit timeout and error semantics. |
| `src/app/api/recipes/extract-from-url/route.ts` | External URL extraction must keep strict timeout and content handling. |
| `src/app/api/hub/item-links/route.ts` | External Jina reader call needs bounded timeout and sanitized failure behavior. |

Impact:

- Mutations can hang on poor networks.
- Slow long-running calls can falsely mark the app offline if converted without proper `timeoutMs`.
- Error handling becomes inconsistent across modules.

Recommended fix:

1. Split findings into allowed raw fetch, convert-to-`safeFetch`, and server-only timeout categories.
2. Convert client mutations to `safeFetch()`.
3. Use explicit `timeoutMs` for AI, voice, upload, extraction, and other calls likely to exceed the default CRUD timeout.

## Medium - Live RLS Policy Audit Is Still Required

**Status:** unknown until checked in Supabase.

The repository schema export documents tables and columns, but it does not include RLS policy bodies or function bodies. Hard Rule 20 bans `EXISTS` subquery policies on hot child tables, but that cannot be fully verified from `migrations/schema.sql` alone.

Impact:

- A policy can be functionally correct but catastrophically slow on hot read paths.
- Repository review may miss a live database policy regression.

Recommended fix:

1. Run live Supabase RLS policy verification queries.
2. Confirm hot child tables use direct `user_id` policies or SECURITY DEFINER RPCs.
3. Add the verification result to the relevant performance or architecture notes.

## Strong Security Areas

| Area | Keep as rule |
|---|---|
| Zod validation | API input should continue to be validated through schemas with derived TypeScript types. |
| Auth checks | Authenticated routes should continue to call `supabase.auth.getUser()` and return 401 on missing users. |
| Cron auth | Cron routes should keep `Authorization: Bearer ${CRON_SECRET}`, `supabaseAdmin()`, and `maxDuration = 60`. |
| Unique conflicts | Supabase `23505` should continue to map to HTTP 409. |
| Household access | Partner data inclusion must continue through active `household_links`, `ownOnly`, and privacy filters. |
| Supabase clients | Browser, server, and admin clients should remain separated by runtime and privilege. |

## Security Remediation Priority

1. Sweep production logging from auth, API, AI, and client components.
2. Add mechanical enforcement for no committed `console.*`.
3. Classify and migrate unsafe raw fetch usage.
4. Run live RLS policy verification.
5. Add route tests for auth, validation, conflict, and household access behavior.