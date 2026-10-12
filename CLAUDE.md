# CLAUDE.md

> **Reactive + Proactive AI Personal Assistant** — a multi-module PWA covering budget tracking, reminders/tasks, meal planning, recipes, catalogues, household chat, dashboards, and an AI assistant. Modules are architecturally independent but share a single household ecosystem. The app is both reactive (responds to user input) and proactive (AI-driven briefings, alerts, and scheduled actions).
>
> **Interaction model:** ERA Hub Chat is the **top-layer primary interface**. Quick, conversational, low-friction actions (logging a spend, setting a reminder, adding to the shopping list) happen in the Hub. Standalone module pages (Expense Entry Form, Items, Recipes, etc.) are **precision tools** for detailed, structured input — used when full field control is needed. The Hub offloads high-frequency everyday interactions so that dedicated forms are reserved for cases that truly require them. The AI Assistant lives inside Hub Chat and operates both reactively (parses user messages) and proactively (surfaces briefings and alerts unprompted).

CLAUDE.md auto-syncs to `AGENTS.md`, `CODEX.md`, and `.github/copilot-instructions.md` via PostToolUse hook.

## Boot Sequence (any agent, any capability tier)

If you read only four things before acting, read these, in order:

1. **This file** — rules, module model, routing tables.
2. **`.claude/skills/start-task/SKILL.md`** — the operating protocol; it routes you to the right playbook and docs for the task at hand.
3. **`ERA Notes/01 - Architecture/Feature Map/_index.md`** — user intent → exact source files.
4. **`ERA Notes/01 - Architecture/Design Doctrine.md`** — how to *decide* when no playbook covers it: the Ten Questions, silent-failure taxonomy, standing decisions, and tradeoff priority order. Mandatory before designing any new feature or resolving an ambiguous tradeoff; skippable for mechanical edits.

PM state: read the campaign's **Master Book** (`ERA Notes/10 - Project Management/<Campaign>/<Campaign> — Master Book.md`) before working it, then inspect code changes since its **evidence cutoff**, not its `updated:` stamp. `ERA Notes/10 - Project Management/_index.md` routes ownership and specs; `_Conventions.md` governs new work; `_Archive/` is historical and no PM tool scans it. Do not recreate competing per-campaign study queues.

---

## Before You Code — Mandatory Checklist

0. **Is the bug shaped like "X can't see Y"?** (partner/household can't see shared data, empty list with no error, works for one user but not another) — **stop and follow Hard Rule #27 before reading any code.**
1. **For edit / bug-fix tasks, read the Feature Map first** — open `ERA Notes/01 - Architecture/Feature Map/_index.md`, find the matching module, then read that module's MD file to get exact source file paths. Do this **before** Glob / Grep / Read on source files. It is the cheapest and most accurate router from user intent → files to edit.
2. **Identify the module type** (Standalone or Junction — see Module Model below) before scoping work
3. **Check the Feature Index** for the deeper vault doc in `ERA Notes/`
4. **Read that doc first** — it contains architecture, DB tables, and gotchas
5. **Read `migrations/schema.sql`** before any DB work — it is the authoritative schema source
6. **Read `ERA Notes/01 - Architecture/Common Patterns.md`** if touching state, mutations, or modals

> **Two indexes, different jobs.** The Feature Map (step 1) is a flat, intent-routed file index — *"the user says X, edit these files."* The Feature Index (step 3, table further down) points at the deeper vault docs in `02 - Standalone Modules/` and `03 - Junction Modules/` for architecture intent. Use the Feature Map to find files; use the vault doc to understand *why* the feature is built that way.

---

## Engineer Playbooks (Skills)

Playbooks live in `.claude/skills/<name>/SKILL.md` (verified templates, evidence gates, STOP conditions); each file's `description` says when it applies. They operationalize the Mandatory Checklist and Hard Rules — when one applies, follow it instead of improvising.

**Start every task with `start-task`; end every task with `finish-task`.**

- **Workflow:** `fix-bug`, `add-feature`, `api-route` (anything under `src/app/api/`), `db-migration` (any DB change), `ui-guardrails` (any component/page/style change)
- **Risk domains** (start-task's domain-risk gate routes here): `money-rules` (ANY money logic), `recurrence-safety` (both recurrence systems), `data-repair` (production data fixes), `skill-factory` (new skills)
- **Specialized:** `new-module`, `cache-invalidation`, `timezone-handling`, `triage-inbox` (never implements), `wizard`, `graphify`, `pwa-install` (installable apps/manifests, "already installed"), `era-wire` (ERA reports: wire a shipped manual feature into the command bar)

---

## Hard Rules (Non-Negotiable)

> These are **universal** rules — they apply to every module. Module-specific rules live in the module's `ERA Notes/` Overview doc and are loaded via Mandatory Checklist step 3. Modules with their own Hard Rules: **NFC Tags** (slug URLs), **Guest Portal** (slug URLs), **Preferences** (LBP in thousands), **AI Assistant** (Focus briefing cache), **Categories** (cross-user slug matching).

1. **ALL toasts must have an Undo button** — `{ duration: 4000, action: { label: "Undo", onClick: () => undoMutation.mutate(...) } }`. Use `ToastIcons` enum from `src/lib/toastIcons.tsx`.
2. **Single click** = open detail view · **Double click** = toggle pin/favorite
3. **No red for individual task/item rows** — use theme colors (pink/cyan). Container headers CAN use red/amber. Overdue date labels → `text-white/40`
4. **Futuristic SVG icons** where available in toasts and UI elements
5. **Mobile-first** — always verify on mobile viewport
6. **Never use `fetch()` for mutations** — use `safeFetch()` from `src/lib/safeFetch.ts` (default timeout **8 s**). Calls that may exceed 8 s (AI, uploads, imports) **must** pass `timeoutMs`. A timeout is latency, not offline: it must never mark offline or enqueue a mutation. Details: `ERA Notes/01 - Architecture/Sync and Offline.md` §Verified Connectivity.
7. **Never trust `navigator.onLine`** — use `isReallyOnline()` from `src/lib/connectivityManager.ts`. It probes `/api/health` every 30s for real connectivity.
8. **Cron routes**: verify `Authorization: Bearer {CRON_SECRET}`, use `supabaseAdmin()` (not `supabaseServer()`), add `export const maxDuration = 60`.
9. **Unique constraint violations** (`error.code === "23505"`) → return `409 Conflict`, not 500.
10. **Theme changes invalidate ALL queries** — use `--theme-bg` CSS variable and `data-theme` attribute, never hardcode background colors.
11. **Never edit `src/components/ui/`** — enforced by PreToolUse hook.
12. **Zod schemas for all API input validation** — derive TS types with `z.infer<>`.
13. **Household linking in API routes**: when fetching user-owned data, always check `household_links` for an active partner and include their data unless `ownOnly=true` is passed. See `src/app/api/accounts/route.ts:28-52`.
14. **Color identity is person-absolute, not role-relative** — blue-theme user = `blue-400/500` on both phones always; pink-theme user = `pink-400/500` on both phones always. Derive from `useTheme()`: `theme === "pink"` → current user = pink, partner = blue; otherwise reverse. Colors follow the **person**, not the viewer. See `ERA Notes/01 - Architecture/Color Identity.md`.
15. **Floating panels must be opaque and portaled** — never `neo-card` glass on a dropdown/popover, never a hand-rolled `absolute`/`fixed` panel. Use `@/components/shared/DropdownMenu`; anything custom portals to `document.body` with solid `tc.bgPage`. Details: `ui-guardrails` §4.
16. **Fixed/sticky headers need a matching content offset** (`h-14` ⇒ `pt-14`); isolated pages must also hide `ConditionalHeader`/`MobileNav`. Details: `ui-guardrails` §5.
17. **Cache invalidation** — see `.claude/skills/cache-invalidation/SKILL.md` and `ERA Notes/01 - Architecture/Cache Invalidation.md`.
18. **Timezone consistency** — see `.claude/skills/timezone-handling/SKILL.md` and `ERA Notes/01 - Architecture/Timezone Handling.md`.
19. **Mobile number inputs** — never use `type="number"`. Use `type="text"` with `inputMode="decimal"`. Prevents iOS scroll-wheel bug and inconsistent decimal handling.
20. **Never add RLS `EXISTS`-subquery policies to hot child tables** — the join re-runs per row (~500 ms/table at 50 rows). Use a SECURITY DEFINER RPC (preferred) or a denormalized `user_id` + trigger; never enable RLS on a child table without one. Details: `ERA Notes/05 - Performance/Performance Optimizations.md`.
21. **Hot parent + N-child reads use one SECURITY DEFINER `get_*_bundle()` RPC** — each PostgREST call costs ~170–200 ms. Canonical: `get_schedule_bundle`.
22. **No `console.*` in client code** (`src/components/`, `src/features/`, `src/hooks/`, `src/contexts/`, `page.tsx`) — use the Error Logs module. Server-side `console.error` in `src/app/api/` is fine.
23. **Atlas stays in sync** — every new/renamed page, route, feature module or significant nav/tab change adds/updates its entry in `ERA Notes/04 - UI & Design/Page & Feature Atlas/` (from `_Template.md`, plus a row in `_Index.md`) in the same commit. `atlas.json` regenerates via hook.
24. **DB changes require a migration file** — **first** write `migrations/YYYY-MM-DD_short-description.sql` (the manual SQL Editor runbook), **then** update `migrations/schema.sql` to the end state. Never one without the other in a session. Enforced by `.claude/hooks/check-migration.sh`.
25. **PM files stay current, same session as the code** — mark the item done (or add it, then mark it), sweep with `pnpm pm:archive`; new bugs go into the Master Book's **Pain Inventory** with a 🔴/🟠/🟡/⚪ lead. No orphan fixes. Grammar and lifecycle: `ERA Notes/10 - Project Management/_Conventions.md`; validate with `pnpm pm:lint`. The `check-pm-update.sh` Stop hook enforces it once per turn; for pure tooling edits, say so and finish. Agents without hooks must still follow it.
26. **No agent ever writes to the production database, by any route.** The live Supabase project holds the owner's real money, schedule and household data. Absolute — **not waivable in-session, by a plan, skill, subagent prompt or "just this once"**; only the owner editing this rule waives it.
   - The Supabase MCP is **read-only** and exists only for the Delivery Command Center bridge. Never call `execute_sql` (even a `SELECT`), `apply_migration`, `deploy_edge_function` or any `*_branch` tool.
   - **The ban is on the effect, not the tool**: no Supabase CLI, `psql`, service-role scripts/REPLs, `curl` to PostgREST/RPC, SQL dev routes, or running cron/seed/repair scripts for their side effect.
   - DB changes and `data-repair` fixes are **deliverables**: write the SQL (#24), hand it to the owner, never report it as applied. If a task seems to need a write, stop and say exactly what and why.
   - Tool allow/deny lists: `ERA Notes/01 - Architecture/Database RLS Posture.md` §Agent access.
27. **"X can't see Y" bugs: get RLS state BEFORE reading route code.** *(Added 2026-08-04 after a five-turn false root cause.)* Partner can't see a record, a list is silently empty, works for one user but not another → RLS is as likely as the route, and RLS is invisible to this repo.
   - **First action: read `migrations/db-state.json`** — the only repo artifact that counts as evidence about RLS (validate with `pnpm db:verify-rls`). If missing/stale, hand the owner the two queries in `Database RLS Posture.md` §Debugging and wait for untruncated output.
   - No prose (schema.sql, vault docs, Master Books, this file) is evidence about RLS. Silent-empty is the signature; a working SECURITY DEFINER path next to a failing PostgREST path is near-proof.
   - Don't "fix" correct code to chase the symptom. New child tables get a policy in the same migration.
28. **UI text is a cost — write the minimum and stop.** *(Added 2026-08-24, owner: "way too many texts to explain things that are pretty clear for me".)* Labels, numbers, 1–2-word verb buttons. No explanatory prose, reassurance text, banners restating the tab, or design justifications; one short clause is the ceiling; real help goes behind an `i` popover. Applies to every shipped string. Details: `ui-guardrails` §13.

29. **Live tests against paid/rate-limited APIs (Gemini, Azure, …): one approved, bounded, paced pass.** Replay offline first; get the owner's OK naming the call count; then one call per scenario, sequential, ≥ 30 s apart, no retries or fallback, stop on first error, lock file against reruns. Never batch scenarios into one request (thinking tokens eat the output cap), never loop or schedule. Synthetic inputs only. Full protocol: `ERA Notes/01 - Architecture/Live API Testing Protocol.md`.

---

## Module Model

Every feature in this app is either **Standalone** or **Junction**. Identify the type before coding — it determines your scope.

### Standalone Modules

Self-contained features with their own UI, hooks, API routes, and DB tables. Each can be developed, tested, and documented in isolation.

**Rule:** Standalone feature directories (`src/features/[name]/`) must not import from other standalone feature directories.
Shared code belongs in `src/components/`, `src/lib/`, or `src/types/` — available to all modules.
**AI scope:** when modifying a Standalone, changes are fully contained — other standalones are unaffected.

Every module and its type is listed in the **Feature Index** below.

### Junction Modules

Bridge between Standalone modules. May import from any standalone feature directory to connect them.

**Rule:** changes here can cascade across multiple standalones — always trace all connected modules before modifying.
**AI scope:** when modifying a Junction, read the docs of every connected Standalone first.

| Junction | Connects |
| --- | --- |
| Hub Chat | Budget (message actions → transactions), Reminders (create from chat), Shopping List |
| Shopping List | Hub Chat, Recipes (ingredients → list), Inventory |
| Meal Planning | Recipes, Reminders/Calendar, Shopping List |
| AI Assistant | Transactions + Items (context injection), Dashboard briefing, Focus insights |
| Notifications | Items (alerts), Recurring (payment reminders), Budget (spending alerts) |
| Household Sharing | ALL modules — shared data layer via `household_links` + `profiles` |
| Sync & Offline | ALL modules — IndexedDB queue + `OfflineSyncEngine` |
| Prerequisites | NFC Tags + Items (trigger engine for dormant → pending activation) |
| Plan My Day | Items/Schedule (one-time, recurring, flexible placement) ↔ `day_plans` table |
| Activity Log | Source activity across Budget, Schedule/NFC, Chat, Kitchen, Catalogue, Trips, Healthcare, Outfits, ERA, Guest Portal, Notifications and Settings |

---

## Architecture References

- **Design judgment — the Ten Questions, silent-failure taxonomy, standing decisions, tradeoff priority order**: `ERA Notes/01 - Architecture/Design Doctrine.md` (read before designing any feature)
- **Data flow, optimistic mutations, ID-only state, Framer Motion + HTML5 drag conflicts**: `ERA Notes/01 - Architecture/Common Patterns.md`
- **Offline queue, sync engine, IndexedDB vs legacy localStorage queue**: `ERA Notes/01 - Architecture/Sync and Offline.md`
- **API route pattern** (auth check → zod parse → DB op → error handling): follow `src/app/api/accounts/route.ts`
- **Query cache time constants**: `src/lib/queryConfig.ts`
- **Supabase clients**: `lib/supabase/client.ts` (browser singleton, required for realtime) · `server.ts` (API routes/RSC) · `admin.ts` (cron/batch ops, service role) — never mix
- **Query keys**: use `qk.*` from `src/lib/queryKeys.ts` OR feature-scoped `queryKeys.ts` — never inline arrays
- **Offline queue**: new code uses IndexedDB via `src/lib/offlineQueue.ts`. The legacy localStorage queue in `SyncContext` is for hub shopping list only — don't add to it.
- **Custom month start**: billing cycle uses day 1–31 set by user. Use `startOfCustomMonth(date, monthStartDay)` from `src/lib/utils/date.ts`, not calendar months.
- **Environment variables**: see `docs/ENV.md`
- **Project docs** live in `ERA Notes/`. See `ERA Notes/06 - Setup & Onboarding/Vault Setup.md` for vault structure.

---

## React Contexts

Located in `src/contexts/`. Always use the `Safe` variant (`useSyncSafe`, `useAppModeSafe`, `useTabSafe`) in components that may render outside the provider.

---

## Database

> **`migrations/schema.sql` is the single source of truth for tables/columns.** Read it before writing any SQL. Never assume a column exists.
> **Caveat — `schema.sql` CANNOT answer RLS or function questions** (tables/columns/constraints only). Use `migrations/db-state.json` or the live DB — see Hard Rule #27.

DB changes = SQL run manually in the Supabase SQL Editor. New tables must include RLS policies. **Always create the migration file first** (`migrations/YYYY-MM-DD_description.sql`), then update `schema.sql` (Hard Rule #24). Unique constraint violations: Supabase returns `error.code === "23505"` → respond `409 Conflict`. Account types (`expense`/`income`/`saving`) affect balance direction — see the `schema.sql` CHECK constraints and `src/lib/balance-utils.ts`.

---

## Domain Gotchas

- **Two recurrence systems exist** — recurring *payments* (money commitments, `recurring_payments`) and item/schedule *recurrence* (rrule occurrences + exceptions + pauses). They share vocabulary but not engines. Identify which one you're in before editing anything recurring (`recurrence-safety` skill), and never introduce a new expansion path.
- **The AI layer runs on Gemini** (`src/lib/ai/gemini.ts`) with a fallback model on a separate quota bucket and daily-vs-per-minute 429 discrimination — **except ERA Ask AI** (`/api/era/ask`), which runs on Claude via `src/lib/ai/anthropic.ts` (HUB-107 migration in progress, 2026-10-11). AI mutations always flow through the drafts/proposal pattern — AI proposes, the human confirms; never let a model write directly to money or schedule state.
- **Every ERA write leaves an Artifact** (owner rule, 2026-10-04) — create, update and delete. The adapter returns `artifacts` via `eraArtifact()` (`src/lib/era/artifacts.ts`, the one entity + deep-link registry); `recordArtifacts.ts` logs them and the Activity Log opens the item from them. Never add a per-intent logging `switch`; add a row to `src/features/era/artifacts.contract.test.ts`. New wirings: `/era-wire`.
- **Cron scheduling lives outside the repo** — there is no `vercel.json`; the six `src/app/api/cron/*` routes only run if an external scheduler (or Vercel project config) invokes them with `Bearer CRON_SECRET`. Never assume a cron is live without checking a last-run trace; anything time-triggered needs a "how do I know it ran" answer.
- **Framer Motion + HTML5 drag**: never mix `<motion.div draggable>` with HTML5 drag events — use one or the other (see `COMMON_PATTERNS.md`)
- **Enum/type updates**: always update DB migration + TypeScript type + API route + UI components + utilities together
- **Standalone imports**: standalone feature dirs can't import from each other — use `src/components/`, `src/lib/`, `src/types/`
- **Zustand in non-React modules**: use `store.getState().action()` directly — see `src/lib/stores/offlinePendingStore.ts` (`offlinePendingActions` export pattern)

---

## Feature Index

| Feature | Src paths | Vault doc | Type |
| --- | --- | --- | --- |
| Accounts & Balance | `src/features/accounts/`, `src/features/balance/` | `ERA Notes/02 - Standalone Modules/Accounts & Balance/` | Standalone |
| Transactions | `src/app/expense/`, `src/features/transactions/` | `ERA Notes/02 - Standalone Modules/Transactions/` | Standalone |
| Categories | `src/features/categories/` | `ERA Notes/02 - Standalone Modules/Categories/` | Standalone |
| Recurring Payments | `src/app/recurring/`, `src/features/recurring/` | `ERA Notes/02 - Standalone Modules/Recurring Payments/` | Standalone |
| Recipes | `src/features/recipes/`, `src/app/recipe/` | `ERA Notes/02 - Standalone Modules/Recipes/` | Standalone |
| Meal Planning | `src/features/meal-planning/`, `src/app/meal-plan/`, `src/components/web/WebMealPlanCalendar.tsx` | `ERA Notes/03 - Junction Modules/Meal Planning/` | Standalone |
| Inventory | `src/features/inventory/`, `src/components/inventory/` (mounted in Catalogue) | `ERA Notes/02 - Standalone Modules/Inventory/` | Standalone |
| Debts | `src/features/debts/` | `ERA Notes/02 - Standalone Modules/Debts/` | Standalone |
| Catalogue | `src/app/catalogue/`, `src/features/catalogue/` | `ERA Notes/02 - Standalone Modules/Catalogue/` | Standalone |
| Future Purchases | `src/features/future-purchases/` | `ERA Notes/02 - Standalone Modules/Future Purchases/` | Standalone |
| Budget Allocation | `src/features/budget/` | `ERA Notes/02 - Standalone Modules/Budget Allocation/` | Standalone |
| Preferences (LBP, theme) | `src/features/preferences/` | `ERA Notes/02 - Standalone Modules/Preferences/` | Standalone |
| Statement Import | `src/features/statement-import/` | `ERA Notes/02 - Standalone Modules/Statement Import/` | Standalone |
| Transfers | `src/features/transfers/` | `ERA Notes/02 - Standalone Modules/Transfers/` | Standalone |
| Hub Chat | `src/app/chat/`, `src/app/alerts/`, `src/features/hub/`, `src/components/hub/` | `ERA Notes/03 - Junction Modules/Hub Chat/` | Junction |
| Shopping List | `src/components/hub/ShoppingListView.tsx` | `ERA Notes/03 - Junction Modules/Shopping List/` | Junction |
| Message Actions | `src/features/hub/messageActions.ts` | `ERA Notes/03 - Junction Modules/Message Actions/` | Junction |
| Items / Reminders | `src/app/reminders/`, `src/features/items/`, `src/components/reminder/`, `src/components/items/` | `ERA Notes/02 - Standalone Modules/Items & Reminders/` | Standalone |
| AI Assistant | `src/app/api/ai-chat/`, `src/lib/ai/` | `ERA Notes/03 - Junction Modules/AI Assistant/` | Junction |
| Notifications | `src/app/api/notifications/`, `src/app/api/cron/` | `ERA Notes/03 - Junction Modules/Notifications/` | Junction |
| Household Sharing | `src/features/hub/` | `ERA Notes/03 - Junction Modules/Household Sharing/` | Junction |
| Analytics | `src/features/analytics/` | `ERA Notes/02 - Standalone Modules/Analytics/` | Standalone |
| Drafts | `src/features/drafts/` | `ERA Notes/02 - Standalone Modules/Drafts/` | Standalone |
| Watch UI | `src/components/watch/` | `ERA Notes/02 - Standalone Modules/Watch UI/` | Standalone |
| Guest Portal | `src/app/g/[tag]/`, `src/components/guest/` | `ERA Notes/02 - Standalone Modules/Guest Portal/` | Standalone |
| Sync & Offline | `src/contexts/SyncContext.tsx`, `src/lib/offlineQueue.ts` | `ERA Notes/03 - Junction Modules/Sync & Offline/` | Junction |
| Error Logs | `src/app/error-logs/`, `src/app/api/error-logs/` | `ERA Notes/02 - Standalone Modules/Error Logs/` | Standalone |
| NFC Tags | `src/features/nfc/`, `src/app/nfc/[tag]/`, `src/app/api/nfc/` | `ERA Notes/02 - Standalone Modules/NFC Tags/` | Standalone |
| Prerequisites | `src/lib/prerequisites/`, `src/app/api/items/[id]/prerequisites/` | `ERA Notes/03 - Junction Modules/Prerequisites/` | Junction |
| Chores | `src/app/chores/`, `src/components/chores/`, `src/features/chores/` | `ERA Notes/02 - Standalone Modules/Chores/` | Standalone |
| Focus | `src/app/focus/`, `src/components/focus/` | `ERA Notes/02 - Standalone Modules/Focus/` | Standalone |
| Trips | `src/app/trips/`, `src/features/trips/`, `src/components/trips/` | `ERA Notes/03 - Junction Modules/Trips/` | Junction |
| Dashboard | `src/app/dashboard/`, `src/components/web/WebDashboard.tsx` | `ERA Notes/02 - Standalone Modules/Dashboard/` | Standalone |
| Recycle Bin | `src/app/recycle-bin/`, `src/features/recycle-bin/` | `ERA Notes/02 - Standalone Modules/Recycle Bin/` | Standalone |
| Plan My Day | `src/app/reminders/` (Focus tab), `src/app/today/` (redirect), `src/components/planner/`, `src/features/day-plan/` | `ERA Notes/03 - Junction Modules/Plan My Day/` | Junction |
| Healthcare | `src/features/healthcare/` | `ERA Notes/02 - Standalone Modules/Healthcare/` | Standalone |
| Outfits | `src/features/outfits/`, `src/app/outfits/`, `src/components/outfits/` | `ERA Notes/02 - Standalone Modules/Outfits/` | Standalone |
| Activity Log             | `src/features/activity-log/`                                      | `ERA Notes/03 - Junction Modules/Activity Log/`         | Junction   |

> **Note:** this table is validated against the **Feature Map** (`ERA Notes/01 - Architecture/Feature Map/_index.md`) by `pnpm docs:check`, which runs during `pnpm sync:ai` and pre-commit. **AI Usage is intentionally excluded** from this Feature Index because it is not part of the application.

---

## Documentation Rules

- **Read before code** — check Feature Index for an existing doc in the vault first
- **Update after implementing** — add new behavior, DB changes, and gotchas to the feature doc
- **Never duplicate** — augment the existing doc, don't create a parallel one
- Update `ERA Notes/04 - UI & Design/App Routes and Icons.md` when adding routes or icons
- New feature doc template: `ERA Notes/Templates/Feature Doc.md`
- Vault folders under `ERA Notes/` are self-describing; only `CLAUDE.md` and `README.md` live at the repo root
