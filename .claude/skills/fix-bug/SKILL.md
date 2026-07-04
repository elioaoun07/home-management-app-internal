---
name: fix-bug
description: "Evidence-first debugging playbook for this repo: reproduce, locate via Feature Map, root-cause with proof, minimal fix, verify, PM trace. Use for any bug report, error, regression, crash, wrong value, or 'X doesn't work'. NOT for new features (use add-feature)."
---

# /fix-bug — Debugging Playbook

> **Contract:** you may not edit a file until Phase 4 produces a root cause **with evidence** (`path:line` you read this session). Fixing a symptom without a proven cause is the #1 failure mode of this task type. If after Phase 4 you have only a hypothesis, say so and present it as a hypothesis — do not code it silently.

Prerequisite: run the `start-task` protocol (restate, route, read docs in order). This playbook assumes you did.

## Phase 1 — Pin the bug down

Write this block. If you can't fill it from the user's report, ask now:

```
EXPECTED: <what should happen>
ACTUAL: <what happens instead — exact error text / wrong value>
WHERE: <page/flow — mobile or desktop? which theme? which user (self vs partner)?>
REPRO: <steps, or "not reproducible — evidence is X">
```

- "Which user" matters here: many bugs are household-linking bugs that only occur for partner-owned data.
- If the user references a logged error, check the Error Logs module (`src/app/error-logs/`, API `src/app/api/error-logs/`) for the structured entry before theorizing.

## Phase 2 — Locate via the index, not via search

1. `ERA Notes/01 - Architecture/Feature Map/_index.md` → module file → **exact source paths**.
2. Read the module's vault doc, **gotchas section first** — a large share of "bugs" here are documented gotchas or known-issue areas. If the gotcha explains the bug, your job shrinks to applying the documented remedy.
3. Check `ERA Notes/10 - Project Management/<Campaign>/1 - Feature State.md` for the module — the bug may already be logged with a root cause, or the area may be mid-refactor (e.g. recurrence/occurrence actions). **Never "fix" something that PM docs say is being redesigned** without flagging it.

## Phase 3 — Trace the data path (write it down)

Map the full chain before forming opinions. For a typical bug:

```
UI component (src/features/<m>/... or src/components/...)
  → hook (useQuery/useMutation in src/features/<m>/hooks*.ts)
    → fetch/safeFetch → API route (src/app/api/<m>/route.ts)
      → Supabase query → table (verify columns in migrations/schema.sql)
```

Read every link in the chain that the bug could live in. Note query keys and invalidation calls as you pass them — cache bugs hide there.

## Phase 4 — Root cause, checked against the known-cause table

This app's recurring bug signatures — check these FIRST before inventing a novel theory:

| Symptom | Likely cause | Where to confirm |
|---|---|---|
| UI shows stale data after a save/delete | Missing/incomplete cache invalidation | Mutation's `onSuccess` — see `cache-invalidation` skill; balance-affecting mutations must call `invalidateAccountData(queryClient, accountId?)` from `src/lib/queryInvalidation.ts` |
| App flags "offline" during a long operation (AI, upload) | `safeFetch` call missing `timeoutMs` — default timeout (see `DEFAULT_TIMEOUT_MS` in `src/lib/safeFetch.ts`) aborts and calls `markOffline()` | The mutation's `safeFetch(...)` options |
| Partner's data missing (or leaking when it shouldn't) | Household-link logic: `ownOnly` / `is_public` / `household=true` flag mismatch | `src/app/api/accounts/route.ts` GET is the canonical pattern; helper `getActiveHouseholdPartnerId` in `src/lib/accountAccess.ts` |
| 500 error when creating a duplicate | Unique violation `23505` not mapped to `409` | The route's insert error handling |
| Times shift by 2–3 h, or recurrence lands on wrong hour after DST | Naive date string / hand-rolled RRule | `timezone-handling` skill; utils in `src/lib/utils/date.ts` |
| A page/list got dramatically slow | RLS `EXISTS`-subquery on a hot child table, or N sequential PostgREST calls instead of one bundle RPC | Hard Rules 20/21; `get_schedule_bundle` is the canonical fix pattern |
| Wrong person's color on an item | Color treated role-relative instead of person-absolute | `ERA Notes/01 - Architecture/Color Identity.md`; `ui-guardrails` skill |
| Text bleeding through a dropdown/popover | `neo-card` (translucent) used on a floating panel | Swap to `tc.bgPage` from `useThemeClasses()` |
| Content hidden under the header | `fixed`/`sticky` header without matching `pt-*`, or `ConditionalHeader`/`MobileNav` not hidden on a standalone route | The page's layout wrapper |
| iOS number input scrolls/mangles decimals | `type="number"` | Must be `type="text"` + `inputMode="decimal"` |
| Monthly totals wrong near month boundaries | Calendar month used instead of custom billing month | `startOfCustomMonth(date, monthStartDay)` from `src/lib/utils/date.ts` |
| Recurring payment posted twice / occurrence duplicated or silently skipped | Confirm/cover not idempotent, skip-vs-postpone conflation, or diverging expansion engines | `recurrence-safety` skill — read it BEFORE touching this area |
| Balance wrong but every transaction looks right | Direct `account_balances` write bypassing `adjustAccountBalance`, transfer counted as spend, or `date` vs `inserted_at` | `money-rules` skill invariants 1–4 |
| Bug's cause is bad ROWS, not bad code (stale match, orphan, corrupt state) | Data needs repair, possibly plus a producer fix | `data-repair` skill — never hand-write ad-hoc UPDATEs |

For each candidate cause: **prove or eliminate it by reading the actual code path** — don't stop at the first plausible match. State the confirmed cause as: *"Root cause: `<file:line>` does X, but Y is required because Z."*

If you need runtime evidence, add temporary logging — and remove it before finishing (no committed `console.*`, Hard Rule 22).

## Phase 5 — The minimal fix

- Smallest diff that removes the **cause**. No drive-by refactors, renames, or formatting churn in the same change.
- Fix at the layer where the cause lives (don't patch the UI to hide an API bug).
- If the fix touches a Junction module, list the connected standalones and check each one's flow is unaffected.
- If the same defect pattern obviously exists in sibling code (e.g. the same missing invalidation in 3 mutations), fix all instances **and say you did** — a half-fixed pattern is a future bug report.
- Never edit `src/components/ui/`.

## Phase 6 — Verify the fix

1. `pnpm typecheck` → clean.
2. If a test file covers the area (e.g. `src/lib/balance.test.ts`), run it: `pnpm vitest run <path>`. If the bug was in pure logic (a `src/lib/` function), **add a regression test** reproducing the original failure.
3. Exercise the real flow the user reported (dev server, same viewport/theme/user-side as the report). The bug's REPRO steps from Phase 1 must now produce EXPECTED.
4. Re-check the one adjacent flow most likely to regress (the other caller of the function you changed).

## Phase 7 — Close out

Run `.claude/skills/finish-task/SKILL.md`. PM specifics for bugs (Hard Rule 25):
- If the bug wasn't already logged: add it to the relevant pain cluster in the campaign's `1 - Feature State.md` (severity, root cause, evidence) — then mark it fixed ✅ with today's date, and check `[x]` in `4 - Checklist.md`.
- Report format: root cause → fix → how verified → what you did NOT verify.
