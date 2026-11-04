---
created: 2026-11-04
updated: 2026-11-04
type: briefing
status: draft
owner: Elio
evidence_cutoff: "commit 1c586d0 (2026-11-04)"
---

# ERA Briefing for Future AI Work

[README](README.md) · **Briefing** · [Navigation Guide](NAVIGATION-GUIDE.md) · [Handoff Template](HANDOFF-TEMPLATE.md)

Read this first, then `CLAUDE.md`, then follow [NAVIGATION-GUIDE](NAVIGATION-GUIDE.md) for your task. This file holds **orientation and pointers**. It does not restate rules: if it disagrees with `CLAUDE.md`, a skill, or the code, those win and this file is the bug. Only §7 contains numbers that can go stale; everything else is meant to stay true for months.

## 1. What ERA is

A household operating system for **two people plus one AI**, owned and operated by one person (Elio): money (USD and LBP), schedule and chores, kitchen, health, trips and an assistant (ERA) that captures and proposes. The design promise is that recording life costs almost no attention and the system returns foresight. Beirut connectivity and a partner who must see shared data are design constraints, not edge cases. Source: `ERA Notes/01 - Architecture/Design Doctrine.md` §1 (read it before designing anything).

It is a Next.js PWA over Supabase (Postgres, RLS, Realtime, Storage). The architecture of record is [01-atlas ARCHITECTURE](../01-atlas/ARCHITECTURE.md); do not re-derive it.

## 2. Module map

Eleven PM campaigns own the modules. Each module is **Standalone** (self-contained, may not import another standalone feature) or **Junction** (bridges standalones, so changes cascade). The authoritative module list and types are the Feature Index in `CLAUDE.md`; the intent-to-file router is the Feature Map.

| Campaign | Modules (type) | Cascade hot spots |
|---|---|---|
| Budget | Accounts & Balance, Transactions, Categories, Recurring Payments, Debts, Transfers, Budget Allocation, Statement Import, Drafts, Analytics, Dashboard, Future Purchases (all Standalone) | Balance writer; transfers vs spending; household visibility |
| Schedule | Items & Reminders, Chores, Focus, NFC Tags (Standalone); Plan My Day, Prerequisites (Junction) | Occurrence identity; the three delete meanings; alert cron |
| Kitchen | Recipes, Inventory, Catalogue (Standalone); Meal Planning, Shopping List (Junction) | Shopping list is shared and offline-queued |
| Trips | Trips (Junction) | Trip cascade is switched off (TRIP-39); trip spend totals |
| Hub & ERA | Hub Chat, Message Actions, AI Assistant/ERA, Household Sharing, Sync & Offline (Junction); Guest Portal, Error Logs, AI Usage (Standalone) | ERA writes must leave an Artifact; household link |
| Notifications & Alerts | Notifications (Junction) | Cron routes only run if an external scheduler calls them |
| Healthcare | Healthcare, Fitness (Standalone) | Medications, body measurements shared with Fitness |
| Outfits | Outfits (Standalone) | Personal, not household |
| PM Tooling, Delivery, Native App | PM Command Center and Delivery executor (owner tooling, not the household product); native shell and Watch UI (device surfaces) | Phone-approved Delivery; `/pm` is gated |

Cross-cutting: Activity Log (Junction; DB triggers feed it), Recycle Bin, Preferences, theming, the in-app Page & Feature Atlas.

## 3. Shared foundations (use these; never fork them)

One engine per concept is a standing decision (Doctrine §4). Open the file, not a doc about it.

| Foundation | Canonical code | Rule that governs it |
|---|---|---|
| Mutations over the network | `src/lib/safeFetch.ts` | Hard Rule 6: never raw `fetch()` for writes; a timeout is latency, not offline |
| "Am I online?" | `src/lib/connectivityManager.ts` (`isReallyOnline`) | Hard Rule 7 |
| Offline queue and replay | `src/lib/offlineQueue.ts`, `src/lib/offlineSyncEngine.ts`, `public/sw.js` | Do not add to the legacy localStorage queue |
| Query keys, cache times, invalidation | `src/lib/queryKeys.ts`, `queryConfig.ts`, `queryInvalidation.ts` | Hard Rule 17; `cache-invalidation` skill |
| Supabase clients | `src/lib/supabase/{client,server,admin}.ts` | Never mix; cron uses admin (Hard Rule 8) |
| Balance writes | `src/lib/balance.ts` (`adjustAccountBalance`), `balance-utils.ts` | `money-rules` skill; a transfer is not spending |
| Dates and billing month | `src/lib/utils/date.ts` | UTC storage; `startOfCustomMonth`; `timezone-handling` skill |
| Recurring payments | `src/lib/recurring.ts`, `src/features/recurring/commitments.ts` | Engine 1 of two; `recurrence-safety` |
| Schedule occurrences | `src/lib/schedule/expandOccurrences.ts`, `src/lib/items/{createContract,completeItems}.ts`, `src/features/items/bulkItems.ts` | Engine 2 of two; never add a third |
| Household visibility | `household_links` table; no single helper (`src/lib/accountAccess.ts` covers accounts only) | Hard Rules 13 and 27; pattern at `src/app/api/accounts/route.ts` |
| ERA assistant | `src/features/era/engine.ts`, `src/features/era/capabilities/`, `src/app/api/era/ask`, `src/lib/ai/anthropic.ts`, `src/lib/era/artifacts.ts` | AI proposes, human confirms; every ERA write leaves an Artifact |
| Push and cron | `src/lib/pushSender.ts`, `src/app/api/cron/*` | Needs a "how do I know it ran" answer |
| Schema and RLS | `migrations/schema.sql` (tables and columns only), `migrations/db-state.json` (RLS, functions, dated) | Hard Rules 24, 26, 27 |

## 4. Constraints that bite hardest

Numbers refer to the Hard Rules in `CLAUDE.md`. This is a classification, not a copy; read the rule text.

- **Production is off limits (26).** No agent writes to the live database by any route, including read-only-looking `execute_sql`, service-role scripts and cron or repair scripts run for their side effect. SQL is a deliverable handed to the owner, never reported as applied.
- **RLS is invisible to the repo (27).** For "X can't see Y", read `migrations/db-state.json` before route code. Prose is not RLS evidence.
- **No live paid-API tests (29).** The suite is replay-only; `tests/setup/blockPaidApis.ts` enforces it.
- **Migration pairing and PM currency (24, 25).** Migration file first, then `schema.sql`; PM files updated in the same session (hooks enforce).
- **Money and recurrence are the dangerous domains.** A transfer counted as spending, a payment posted twice and a partner seeing hidden data are the failures to prevent (start-task domain-risk gate).
- **Product invariants that look wrong but are deliberate:** LBP in thousands, custom billing month, 8 s default timeout, person-absolute colours, no confirmation dialogs (Undo toasts instead). Overturning a Doctrine §4 decision needs the owner.
- **Code wins over docs; live database wins over `schema.sql` for RLS and functions** (Doctrine §7.3). A rule that code violates is a finding to report, not permission to ignore the rule.
- **Do not edit** `src/components/ui/` (hook-blocked), or the generated mirrors `AGENTS.md`, `CODEX.md`, `.github/copilot-instructions.md` (edit `CLAUDE.md`; `pnpm sync:ai` regenerates). Do not edit `.claude/` skills or hooks unless the task is explicitly about them.

## 5. Where decisions belong

| Decision | Home | Who decides |
|---|---|---|
| New or changed universal rule or policy | `CLAUDE.md` (mirrors regenerate) | Owner only |
| Tradeoff with no playbook | Design Doctrine §5 priority order: money/schedule correctness, trust, capture speed, coherence, foresight, polish | Agent applies; overturning §4 needs owner |
| Cross-campaign policy choice | `ERA Notes/10 - Project Management/_Decisions.md` | Owner |
| Campaign scope, acceptance, lasting decisions | Owning Master Book | Owner; agent records |
| Pending work and priority | Campaign `4 - Checklist.md` | Owner |
| Product behaviour of one module and its gotchas | The module's vault Overview doc | Agent updates after implementing |
| Where code lives | Feature Map | Agent updates with the change |
| Schema or RLS change | `migrations/YYYY-MM-DD_*.sql` then `schema.sql` | Owner applies; agent writes SQL |
| Fixing bad production data | `data-repair` runbook as a deliverable | Owner runs it |
| A new skill | `skill-factory` decision gate | Owner approves |
| Model or effort for a delivery plan | `ERA Notes/Model-Registry.md` tier alias | Owner edits the mapping |
| Open business questions from research | [19-business-rules OPEN-DECISIONS](../19-business-rules/OPEN-DECISIONS.md), [01-atlas decisions](../01-atlas/ARCHITECTURE.md#decisions-that-need-the-owner), [08-shared-data decisions](../08-shared-data/CROSS-MODULE-CONTRACTS.md) | Owner; once answered, record in the owning Master Book or `_Decisions.md`, not in the research file |

## 6. Stable context and what must be refreshed

**Stable** (changes only when the owner changes a rule or the architecture is rebuilt): §1, §2's module grouping, §3's choke points, §4, §5. Re-check them only on a trigger below.

**Refresh** (verify at the start of each task; never trust a remembered value):

| Fact | Why it goes stale | How to refresh |
|---|---|---|
| Current commit and what changed since this briefing | Work continues | `git log --oneline 1c586d0..HEAD`; if more than about a third of `src/app/api/` or `src/features/` changed, treat the research folders as history |
| Which migrations are applied, live RLS, live functions | Only the owner can see production | Ask for a refreshed `migrations/db-state.json` (query in `migrations/db-state.sql`), then `pnpm db:verify-rls` |
| Whether cron routes run | The scheduler is outside the repo | Look for a last-run trace; otherwise UNKNOWN |
| Campaign state, pending counts, evidence cutoffs | Master Books are updated per session | Read the campaign Master Book, then diff code since its **evidence cutoff** (not its `updated:` stamp); the SessionStart radar flags stale checklists |
| Open defects | Fixes land | `ERA Notes/10 - Project Management/Research/Major Bug Sweep.md` and `ERA Notes/01 - Architecture/Mutation Integrity Audit.md` (both dated 2026-11-04) |
| Tests, typecheck, lint | Code changes | `pnpm typecheck`, `pnpm lint`, `pnpm test` (needs `node_modules`; not run in the research sessions) |
| Model aliases | Models change | `ERA Notes/Model-Registry.md` |

**Update triggers for this folder:**

| Event | Update |
|---|---|
| A Hard Rule is added, renumbered or removed | §4 rule numbers; Navigation Guide §3 (UI row) |
| A module is added, renamed, or moves campaign | §2 and Navigation Guide §3 rows; only after the Feature Map and Feature Index are updated (they stay the source) |
| A choke point file moves or is replaced | §3 and Navigation Guide §3 |
| A skill is added or removed | Navigation Guide §3 |
| A source in Navigation Guide §1 changes class (becomes historical, superseded, adopted) | Navigation Guide §1 |
| A research decision is answered by the owner | Remove it from §5's pointer if its folder is retired; record the answer in the Master Book |
| Evidence cutoff is more than one release cycle old | Re-run the refresh table, bump `evidence_cutoff`, fix or delete anything that no longer holds |

## 7. Snapshot (REFRESH: dated, will go stale)

Measured at commit `1c586d0`, 2026-11-04, by directory listing and `grep -c` (no code was run):

| Item | Value | Re-measure with |
|---|---|---|
| Pages / API routes | 42 / 256 | `find src/app -name page.tsx \| wc -l`; `find src/app/api -name route.ts \| wc -l` |
| Feature folders in `src/features` | 35 | `ls src/features \| wc -l` |
| Tables in `schema.sql` | 122 | `grep -c 'CREATE TABLE' migrations/schema.sql` |
| Cron routes | 6 (`chat-notifications`, `daily-items-reminder`, `daily-reminder`, `gcal-reconcile`, `item-reminders`, `purge-recycle-bin`) | `ls src/app/api/cron` |
| RLS snapshot | `migrations/db-state.json` dated 2026-08-04 (92 days old at cutoff) | `git log -1 --format=%cs -- migrations/db-state.json` |
| Git history | Shallow: starts 2026-09-26 in this clone | `git log --oneline \| wc -l` |

Limits of this briefing: nothing was run (no `node_modules`), no production, device or paid API was touched, and deployed behaviour is not inferred from code.
