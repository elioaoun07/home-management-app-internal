<!-- AUTO-GENERATED FROM CLAUDE.md -- DO NOT EDIT DIRECTLY. Edit CLAUDE.md instead. -->

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

Deep-dive state of every module lives in its PM campaign's **Master Book** (`ERA Notes/10 - Project Management/<Campaign>/<Campaign> — Master Book.md`) — current state with a scored maturity read, shipped log, pain inventory, locked decisions, acceptance criteria, and a **Successor Briefing** with a task-tier map, trap registry and verification manifest. Read the book before working a campaign, then delta with `git log --since=<its updated: stamp>`. Vault sections (`01 - Architecture/`, `05 - Performance/`, …) keep their own `FABLED 3/` audits — those stay. Superseded PM material lives in `10 - Project Management/_Archive/`, which no PM tool scans. The operating manual for AI sessions is `ERA Notes/10 - Project Management/FABLE — Testament (2026-07-18).md`.

---

## Before You Code — Mandatory Checklist

1. **For edit / bug-fix tasks, read the Feature Map first** — open `ERA Notes/01 - Architecture/Feature Map/_index.md`, find the matching module, then read that module's MD file to get exact source file paths. Do this **before** Glob / Grep / Read on source files. It is the cheapest and most accurate router from user intent → files to edit.
2. **Identify the module type** (Standalone or Junction — see Module Model below) before scoping work
3. **Check the Feature Index** for the deeper vault doc in `ERA Notes/`
4. **Read that doc first** — it contains architecture, DB tables, and gotchas
5. **Read `migrations/schema.sql`** before any DB work — it is the authoritative schema source
6. **Read `ERA Notes/01 - Architecture/Common Patterns.md`** if touching state, mutations, or modals

> **Two indexes, different jobs.** The Feature Map (step 1) is a flat, intent-routed file index — *"the user says X, edit these files."* The Feature Index (step 3, table further down) points at the deeper vault docs in `02 - Standalone Modules/` and `03 - Junction Modules/` for architecture intent. Use the Feature Map to find files; use the vault doc to understand *why* the feature is built that way.

---

## Engineer Playbooks (Skills)

Step-by-step playbooks in `.claude/skills/`, written as senior-engineer handoffs so **any agent — including lower-capability models — can execute reliably**. Each contains verified code templates, evidence gates, and STOP conditions. They operationalize the Mandatory Checklist and Hard Rules; when one applies, follow it instead of improvising.

**Start every task with `start-task`; end every task with `finish-task`.**

| Playbook | Use for |
|---|---|
| `start-task` | Any new task — restate goal, classify type, read docs in order, verify assumptions before editing |
| `fix-bug` | Bugs / errors / regressions — evidence-first root-cause with this app's known-cause table |
| `add-feature` | New behavior in an existing module — vertical slice order (DB → API → types → hooks → UI) |
| `api-route` | Anything under `src/app/api/` — auth/Zod/household/error-mapping templates + cron variant |
| `db-migration` | Any DB change — migration runbook first, schema.sql end state, RLS decision tree |
| `ui-guardrails` | Any component/page/style change — theming, color identity, mobile-first verification |
| `finish-task` | Definition of done — self-review greps, typecheck/lint/test, docs, Atlas, PM update |

**Domain-invariant skills** — organized by *risk domain*, not per module (module knowledge lives in the vault docs; skills are execution modes). start-task's domain-risk gate routes into these:

| Skill | Use for |
|---|---|
| `money-rules` | ANY money logic (accounts, transactions, transfers, recurring, debts, envelopes, drafts) — balance invariants, worked before/after example, test required |
| `recurrence-safety` | Both recurrence systems (recurring payments + item occurrences) — exactly-once guarantees, skip≠postpone, no new expansion engines |
| `data-repair` | Production data fixes, cleanup/backfill SQL runbooks, console scripts — inspect→backup→fix→verify→rollback |
| `skill-factory` | Authoring a skill for a future domain (Healthcare, Diet, …) — decision gate, house template, registration, junior-test QA |

Specialized skills (existing): `new-module` (brand-new module scaffold), `cache-invalidation`, `timezone-handling`, `graphify`, `triage-inbox` (file raw entries from the PM Idea Inbox `0 - Inbox.md` into canonical checklist items/docs — never implements), `wizard` (interleaved AI/owner setup or debug sessions — shared MD checklist, steps split `[AI]`/`[OWNER]`, progression gated on the owner's pasted verification output).

---

## Graphify (Dynamic Codebase Exploration)

> ERA Notes = **design intent + hard rules** (always read first).
> Graphify = **implementation reality + relationships** (use for exploration).

Run `/graphify` **before reading individual files** when the task involves:

- Starting on an **unfamiliar module** — visualize structure before diving in
- **Junction modules** — trace cross-module cascades before changing anything
- **Large refactors** — map all affected modules and dependencies first
- **Architecture verification** — confirm code matches ERA Notes intent

Never use graphify as a substitute for ERA Notes — it cannot infer hard rules, gotchas, or design decisions.

---

## Hard Rules (Non-Negotiable)

> These are **universal** rules — they apply to every module. Module-specific rules live in the module's `ERA Notes/` Overview doc and are loaded via Mandatory Checklist step 3. Modules with their own Hard Rules: **NFC Tags** (slug URLs), **Guest Portal** (slug URLs), **Preferences** (LBP in thousands), **AI Assistant** (Focus briefing cache), **Categories** (cross-user slug matching).

1. **ALL toasts must have an Undo button** — `{ duration: 4000, action: { label: "Undo", onClick: () => undoMutation.mutate(...) } }`. Use `ToastIcons` enum from `src/lib/toastIcons.tsx`.
2. **Single click** = open detail view · **Double click** = toggle pin/favorite
3. **No red for individual task/item rows** — use theme colors (pink/cyan). Container headers CAN use red/amber. Overdue date labels → `text-white/40`
4. **Futuristic SVG icons** where available in toasts and UI elements
5. **Mobile-first** — always verify on mobile viewport
6. **Never use `fetch()` for mutations** — always use `safeFetch()` from `src/lib/safeFetch.ts`. It does a pre-flight online check, a configurable timeout (default **3 s**), and calls `markOffline()` on any abort/network failure.
   - The 3 s default is right for CRUD operations. **Long-running calls (AI generation, file uploads, any external API that may take >5 s) MUST pass `timeoutMs`** — e.g. `{ timeoutMs: 60_000 }` — or the request will be killed at 3 s and the app will be falsely flagged offline.
   - `markOffline()` is triggered on **timeout** too, not only hard network failures. A missing `timeoutMs` on a slow call will light up the offline indicator and badge even when the user is fully online.
7. **Never trust `navigator.onLine`** — use `isReallyOnline()` from `src/lib/connectivityManager.ts`. It probes `/api/health` every 30s for real connectivity.
8. **Cron routes**: verify `Authorization: Bearer {CRON_SECRET}`, use `supabaseAdmin()` (not `supabaseServer()`), add `export const maxDuration = 60`.
9. **Unique constraint violations** (`error.code === "23505"`) → return `409 Conflict`, not 500.
10. **Theme changes invalidate ALL queries** — use `--theme-bg` CSS variable and `data-theme` attribute, never hardcode background colors.
11. **Never edit `src/components/ui/`** — enforced by PreToolUse hook.
12. **Zod schemas for all API input validation** — derive TS types with `z.infer<>`.
13. **Household linking in API routes**: when fetching user-owned data, always check `household_links` for an active partner and include their data unless `ownOnly=true` is passed. See `src/app/api/accounts/route.ts:28-52`.
14. **Color identity is person-absolute, not role-relative** — blue-theme user = `blue-400/500` on both phones always; pink-theme user = `pink-400/500` on both phones always. Derive from `useTheme()`: `theme === "pink"` → current user = pink, partner = blue; otherwise reverse. Colors follow the **person**, not the viewer. See `ERA Notes/01 - Architecture/Color Identity.md`.
15. **Floating panels (dropdowns, popovers, command palettes) must be opaque** — never use `neo-card` (which is semi-transparent glass) on panels that float above page content. Use `tc.bgPage` from `useThemeClasses()` as the background class so the panel is the same solid color as the page background per theme. `neo-card` is only for non-overlaid cards. Glass/blur on floating panels causes text bleed-through from content behind them.
16. **Fixed/sticky headers must not overlap page content** — when using `fixed` or `sticky` positioning on headers (`h-14`, etc.), the content below **must** have matching top padding (e.g., `pt-14`) to prevent overlap. For standalone/isolated pages (NFC, guest portal, etc.) that render their own layout, ensure the root layout's `ConditionalHeader` and `MobileNav` hide on those routes — otherwise a fixed header with no content offset causes overlap. Always verify on mobile viewport.
17. **Cache invalidation** — see `.claude/skills/cache-invalidation/SKILL.md` and `ERA Notes/01 - Architecture/Cache Invalidation.md`.
18. **Timezone consistency** — see `.claude/skills/timezone-handling/SKILL.md` and `ERA Notes/01 - Architecture/Timezone Handling.md`.
19. **Mobile number inputs** — never use `type="number"`. Use `type="text"` with `inputMode="decimal"`. Prevents iOS scroll-wheel bug and inconsistent decimal handling.
20. **Never add RLS `EXISTS`-subquery policies to hot child tables** — policies of the form `EXISTS (SELECT 1 FROM items i WHERE i.id = child.item_id AND i.user_id = auth.uid())` re-evaluate a join for every row scanned. On tables like `item_alerts`, `item_subtasks`, `reminder_details`, etc., this causes catastrophic slowdowns (~500ms per table for 50 rows even under service role baseline). Always enforce access in one of these ways instead:

- **SECURITY DEFINER RPC** (preferred): own the WHERE clause inside the function; bypass per-table RLS. See `get_schedule_bundle` in `migrations/schema.sql` (FUNCTIONS section) + `ERA Notes/05 - Performance/Performance Optimizations.md`. *(Citation corrected 2026-08-01: the previously referenced `migrations/2026-05-11_schedule_bundle_rpc.sql` does not exist in the repo.)*
- **Denormalized `user_id`** on the child table + a direct `user_id = auth.uid()` RLS policy. Add a trigger to keep it in sync with the parent.
  Never enable RLS on a child table without one of these patterns in place.

21. **Hot read paths that fetch a parent + N child tables must use a single SECURITY DEFINER RPC** — each PostgREST call costs ~170–200 ms of network overhead. Fetching `items` + `reminder_details` + `event_details` + `item_subtasks` + `item_alerts` + `item_recurrence_rules` + `recurrence_pauses` as 7 separate queries adds ~1.3 s of floor latency before any RLS or query cost. Collapse them into one `get_*_bundle()` RPC returning JSON aggregates. See `get_schedule_bundle` as the canonical example.
22. **No `console.log` / `console.warn` / `console.error` in client code** — i.e. `src/components/`, `src/features/`, `src/hooks/`, `src/contexts/`, and `page.tsx` files. Stray `console.*` calls there slow down the React DevTools overlay and leak internal state into the user's browser. Use the Error Logs module (`src/app/error-logs/`) for persistent structured logging. **Server-side `console.error` in `src/app/api/` is permitted** — it is the Vercel log stream and has none of the above costs. *(Scope corrected 2026-08-01: the rule previously banned `console.*` in all committed code while giving a client-only rationale; it was being ignored at ~535 sites. The reference to `src/lib/logger.ts` was removed — that file does not exist.)*
23. **Atlas must be kept in sync** — every new page (`src/app/.../page.tsx`), new route, new feature module (`src/features/[name]/`), or significant navigation/tab change MUST add/update an entry in `ERA Notes/04 - UI & Design/Page & Feature Atlas/` (copy `_Template.md`, fill all sections, add a row to `_Index.md`). Renaming a feature/route is a breaking change — update or delete the corresponding MD file in the same commit. Stub generator: `node scripts/seed-atlas.mjs` (idempotent). **`public/atlas/atlas.json` is regenerated automatically** via the PostToolUse hook in `.claude/hooks/update-atlas.sh` — no need to run `pnpm atlas` manually after editing `src/app/`, `src/features/`, or `src/components/`.
24. **DB changes require a migration file** — whenever a DB change is needed (CREATE TABLE, ALTER TABLE, ADD COLUMN, CREATE INDEX, CREATE POLICY, DROP, etc.), you MUST: (1) **first** create `migrations/YYYY-MM-DD_short-description.sql` with the exact SQL to run manually in Supabase SQL Editor, (2) **then** update `migrations/schema.sql` to reflect the final schema state. The migration file is the manual runbook; `schema.sql` is the authoritative end-state snapshot. Never update `schema.sql` without a corresponding migration file in the same session. If multiple unrelated DB changes occur in one session, use a single migration file for all of them. Enforced by `.claude/hooks/check-migration.sh`.
25. **PM files MUST stay current** — `ERA Notes/10 - Project Management/` is the live command center, not a historical snapshot. You MUST update it in the same session as the code change, before considering the work done — whether that means marking an already-documented point as completed, or adding it (then marking it completed) if it didn't exist yet:
   - **Story/bug-fix completed:** every campaign folder (`Budget/`, `Schedule/`, `Kitchen/`, `Trips/`, `Hub & ERA/`, `Notifications & Alerts/`, `Healthcare/`, `Outfits/`, `PM Tooling/`, `Delivery/`, `Native App/`) holds exactly **two** files: `<Campaign> — Master Book.md` and `4 - Checklist.md`. Check `[x]` in the checklist, then sweep the record into the Master Book's **Shipped Log** as `- ✅ YYYY-MM-DD — **ID** what landed (evidence)` and delete the checklist line; add an `*(IMPLEMENTED YYYY-MM-DD)*` note in the book's **Vision & Decisions** where a decision is realized.
   - **New bug surfaces:** add it to the Master Book's **Pain Inventory** with an emoji severity lead (🔴/🟠/🟡/⚪ at line start — the dashboard reads those), root cause, and evidence — so it enters the ranked queue, not a separate list.
   - **Canonical item grammar:** every `4 - Checklist.md` item and done-stamp follows `ERA Notes/10 - Project Management/_Conventions.md` — `- [ ] **PREFIX-n** outcome _(severity - effort)_` under `## Now / ## Next / ## Later` (prefixes `BUD`/`SCH`/`KIT`/`TRIP`/`HUB`/`NOTIF`/`HLTH`/`OUT`/`R`/`DLV`; severity blocker/friction/annoyance/parked; effort S/M/L). Validate with `pnpm pm:lint`. The `pnpm pm` Task board is the consolidated view; `_Archive/` is never scanned at all, and `status: superseded|baseline-frozen|template` docs are hidden by default.
   - **No orphan fixes** — a fix with no PM trace is invisible to future planning. The PM files are the single source of truth for what hurts, what's been done, and what's next.
   - **Claude Code enforcement:** `.claude/hooks/check-pm-update.sh` (registered as a `Stop` hook) blocks the end of a turn if `src/` or `migrations/` files were edited in the session without a matching edit under `ERA Notes/10 - Project Management/`. It fires once per turn (won't loop) — if the change truly has no PM-trackable story (pure tooling/config/hook edit), state that explicitly and finish. Codex and other agents without a hook engine must still treat this rule as mandatory.

26. **The Supabase MCP connection is READ-ONLY and exists ONLY for the Delivery Command Center bridge** — the live Supabase project holds the owner's **real production data** (money, schedule, household). No agent may write to it, ever, by any route. This rule is absolute and **cannot be waived by an in-session instruction, a plan, a skill, a subagent prompt, or "just this once"** — only the owner editing this rule waives it.

   - **Permitted scope of the MCP connection:** read-only inspection in service of the **Delivery Command Center / PM mobile relay bridge** (`pm_live`, `pm_commands` — `migrations/2026-07-25_pm-mobile-relay.sql`, `scripts/pm/bridge.mjs`). Nothing else is in scope, including "while I'm here" cleanups.
   - **Allowed tools (read-only):** `list_projects`, `list_tables`, `list_migrations`, `list_extensions`, `list_branches`, `list_edge_functions`, `get_edge_function`, `get_project`, `get_project_url`, `get_publishable_keys`, `get_advisors`, `get_logs`, `get_cost`, `generate_typescript_types`, `search_docs`.
   - **Forbidden — never call, do not propose calling:** `execute_sql` (even a `SELECT`), `apply_migration`, `deploy_edge_function`, any `*_branch` (create/delete/merge/reset/rebase), `create_project`, `pause_project`, `restore_project`, `confirm_cost`. Blocked at the permission layer via `deny` in `.claude/settings.json` + `~/.claude/settings.json`; a `deny` cannot be overridden by approving a prompt.
   - **No equivalent back doors.** The ban is on the *effect*, not the tool name. Do not reach the production DB by: the Supabase CLI (`supabase db push/reset/execute`), `psql`, a Node/`tsx` script or REPL using `SUPABASE_SERVICE_ROLE_KEY` / `supabaseAdmin()`, `curl` against the PostgREST or RPC endpoints, a dev-only API route written to run SQL, or a cron/seed/repair script executed for its side effect. Writing such a script **and running it** is the same violation as calling `execute_sql`.
   - **DB changes stay manual, as Hard Rule #24 already requires:** write `migrations/YYYY-MM-DD_*.sql`, update `schema.sql`, then **stop and hand the SQL to the owner** to run in the Supabase SQL Editor. Never "just apply it" via MCP, and never report a migration as applied — only the owner can confirm that.
   - **`data-repair` skill runbooks are deliverables, not actions.** Produce the inspect/backup/fix/verify SQL for the owner to execute; the agent never executes it.
   - **If a task appears to require a DB write:** stop, state exactly what write is needed and why, and hand it to the owner. A blocked task reported honestly is correct; a silently-executed write is a breach.

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

| Junction          | Connects                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ |
| Hub Chat          | Budget (message actions → transactions), Reminders (create from chat), Shopping List |
| Shopping List     | Hub Chat, Recipes (ingredients → list), Inventory                                    |
| Meal Planning     | Recipes, Reminders/Calendar, Shopping List                                           |
| AI Assistant      | Transactions + Items (context injection), Dashboard briefing, Focus insights         |
| Notifications     | Items (alerts), Recurring (payment reminders), Budget (spending alerts)              |
| Household Sharing | ALL modules — shared data layer via `household_links` + `profiles`                   |
| Sync & Offline    | ALL modules — IndexedDB queue + `OfflineSyncEngine`                                  |
| Prerequisites     | NFC Tags + Items (trigger engine for dormant → pending activation)                   |
| Plan My Day       | Items/Schedule (one-time, recurring, flexible placement) ↔ `day_plans` table         |

---

## Architecture References

- **Design judgment — the Ten Questions, silent-failure taxonomy, standing decisions, tradeoff priority order**: `ERA Notes/01 - Architecture/Design Doctrine.md` (read before designing any feature)
- **Data flow, optimistic mutations, ID-only state, Framer Motion + HTML5 drag conflicts**: `ERA Notes/01 - Architecture/Common Patterns.md`
- **Offline queue, sync engine, IndexedDB vs legacy localStorage queue**: `ERA Notes/01 - Architecture/Sync and Offline.md`
- **API route pattern** (auth check → zod parse → DB op → error handling): follow `src/app/api/accounts/route.ts`
- **Query cache time constants** (`BALANCE=5min`, `TRANSACTIONS=2min`, `ACCOUNTS/CATEGORIES=1h`, `RECURRING=30min`): `src/lib/queryConfig.ts`
- **Supabase clients**: `lib/supabase/client.ts` (browser singleton, required for realtime) · `server.ts` (API routes/RSC) · `admin.ts` (cron/batch ops, service role) — never mix
- **Query keys**: use `qk.*` from `src/lib/queryKeys.ts` OR feature-scoped `queryKeys.ts` — never inline arrays
- **Path alias**: `@/*` → `src/*`
- **Offline queue**: new code uses IndexedDB via `src/lib/offlineQueue.ts`. The legacy localStorage queue in `SyncContext` is for hub shopping list only — don't add to it.
- **Custom month start**: billing cycle uses day 1–31 set by user. Use `startOfCustomMonth(date, monthStartDay)` from `src/lib/utils/date.ts`, not calendar months.
- **Environment variables**: see `docs/ENV.md`
- **Project docs** live in `ERA Notes/`. See `ERA Notes/06 - Setup & Onboarding/Vault Setup.md` for vault structure.

---

## React Contexts

Located in `src/contexts/`. Always use the `Safe` variant in components that may render outside the provider.

| Context              | Purpose                                                                          | Safe variant       |
| -------------------- | -------------------------------------------------------------------------------- | ------------------ |
| `SyncContext`        | Offline queue, connectivity state, retry logic                                   | `useSyncSafe()`    |
| `AppModeContext`     | "budget" vs "items" mode, FAB target                                             | `useAppModeSafe()` |
| `TabContext`         | Active tab + notification deep-link routing (`pendingItemId`, `pendingThreadId`) | `useTabSafe()`     |
| `ThemeContext`       | Theme switching (blue/pink/frost/calm), invalidates all queries on change        | —                  |
| `UserContext`        | Current user name, email, avatar                                                 | —                  |
| `PrivacyBlurContext` | Privacy mode blur toggle                                                         | —                  |
| `SplitBillContext`   | Split bill calculation state                                                     | —                  |

---

## Database

> **`migrations/schema.sql` is the single source of truth for tables/columns.** Read it before writing any SQL. Never assume a column exists.
> **Caveat:** the live DB remains the final authority for RLS and functions — treat it as truth before any auth/RLS work (see `migrations/_verify_schedule_rls.md` for the verification queries).
> *(Corrected 2026-08-01: this caveat previously claimed the export captures "tables only" and that RLS policies and function bodies are NOT in the repo. That is no longer true — `schema.sql` now contains the full policy set (see the `items` and `*_via_parent` policies) and a FUNCTIONS section including `get_schedule_bundle`. Doctrine §7.3: code wins over docs.)*

DB changes = SQL run manually in Supabase SQL Editor. New tables must include RLS policies. **Always create a migration file first** (`migrations/YYYY-MM-DD_description.sql`), then update `schema.sql`. See Hard Rule #24.

Unique constraint violations: Supabase returns `error.code === "23505"` → respond with `409 Conflict`.

Account types (`expense`/`income`/`saving`) affect balance direction — see `migrations/schema.sql` CHECK constraints and `src/lib/balance-utils.ts`.

---

## Domain Gotchas

- **Two recurrence systems exist** — recurring *payments* (money commitments, `recurring_payments`) and item/schedule *recurrence* (rrule occurrences + exceptions + pauses). They share vocabulary but not engines. Identify which one you're in before editing anything recurring (`recurrence-safety` skill), and never introduce a new expansion path.
- **The AI layer runs on Gemini** (`src/lib/ai/gemini.ts`) with a fallback model on a separate quota bucket and daily-vs-per-minute 429 discrimination. AI mutations always flow through the drafts/proposal pattern — AI proposes, the human confirms; never let a model write directly to money or schedule state.
- **Cron scheduling lives outside the repo** — there is no `vercel.json`; the six `src/app/api/cron/*` routes only run if an external scheduler (or Vercel project config) invokes them with `Bearer CRON_SECRET`. Never assume a cron is live without checking a last-run trace; anything time-triggered needs a "how do I know it ran" answer.
- **Framer Motion + HTML5 drag**: never mix `<motion.div draggable>` with HTML5 drag events — use one or the other (see `COMMON_PATTERNS.md`)
- **Enum/type updates**: always update DB migration + TypeScript type + API route + UI components + utilities together
- **Standalone imports**: standalone feature dirs can't import from each other — use `src/components/`, `src/lib/`, `src/types/`
- **Zustand in non-React modules**: use `store.getState().action()` directly — see `src/lib/stores/offlinePendingStore.ts` (`offlinePendingActions` export pattern)

---

## Feature Index

| Feature                  | Src paths                                                         | Vault doc                                               | Type       |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| Accounts & Balance       | `src/features/accounts/`, `src/features/balance/`                 | `ERA Notes/02 - Standalone Modules/Accounts & Balance/` | Standalone |
| Transactions             | `src/app/expense/`, `src/features/transactions/`                  | `ERA Notes/02 - Standalone Modules/Transactions/`       | Standalone |
| Categories               | `src/features/categories/`                                        | `ERA Notes/02 - Standalone Modules/Categories/`         | Standalone |
| Recurring Payments       | `src/app/recurring/`, `src/features/recurring/`                   | `ERA Notes/02 - Standalone Modules/Recurring Payments/` | Standalone |
| Recipes                  | `src/features/recipes/`, `src/app/recipe/`                        | `ERA Notes/02 - Standalone Modules/Recipes/`            | Standalone |
| Meal Planning            | `src/features/meal-planning/`, `src/app/meal-plan/`, `src/components/web/WebMealPlanCalendar.tsx` | `ERA Notes/03 - Junction Modules/Meal Planning/` | Standalone |
| Inventory                | `src/features/inventory/`, `src/components/inventory/` (mounted in Catalogue) | `ERA Notes/02 - Standalone Modules/Inventory/`          | Standalone |
| Debts                    | `src/features/debts/`                                             | `ERA Notes/02 - Standalone Modules/Debts/`              | Standalone |
| Catalogue                | `src/app/catalogue/`, `src/features/catalogue/`                   | `ERA Notes/02 - Standalone Modules/Catalogue/`          | Standalone |
| Future Purchases         | `src/features/future-purchases/`                                  | `ERA Notes/02 - Standalone Modules/Future Purchases/`   | Standalone |
| Budget Allocation        | `src/features/budget/`                                            | `ERA Notes/02 - Standalone Modules/Budget Allocation/`  | Standalone |
| Preferences (LBP, theme) | `src/features/preferences/`                                       | `ERA Notes/02 - Standalone Modules/Preferences/`        | Standalone |
| Statement Import         | `src/features/statement-import/`                                  | `ERA Notes/02 - Standalone Modules/Statement Import/`   | Standalone |
| Transfers                | `src/features/transfers/`                                         | `ERA Notes/02 - Standalone Modules/Transfers/`          | Standalone |
| Hub Chat                 | `src/app/chat/`, `src/app/alerts/`, `src/features/hub/`, `src/components/hub/` | `ERA Notes/03 - Junction Modules/Hub Chat/`             | Junction   |
| Shopping List            | `src/components/hub/ShoppingListView.tsx`                         | `ERA Notes/03 - Junction Modules/Shopping List/`        | Junction   |
| Message Actions          | `src/features/hub/messageActions.ts`                              | `ERA Notes/03 - Junction Modules/Message Actions/`      | Junction   |
| Items / Reminders        | `src/app/reminders/`, `src/features/items/`, `src/components/reminder/`, `src/components/items/` | `ERA Notes/02 - Standalone Modules/Items & Reminders/`  | Standalone |
| AI Assistant             | `src/app/api/ai-chat/`, `src/lib/ai/`                             | `ERA Notes/03 - Junction Modules/AI Assistant/`         | Junction   |
| Notifications            | `src/app/api/notifications/`, `src/app/api/cron/`                 | `ERA Notes/03 - Junction Modules/Notifications/`        | Junction   |
| Household Sharing        | `src/features/hub/`                                               | `ERA Notes/03 - Junction Modules/Household Sharing/`    | Junction   |
| Analytics                | `src/features/analytics/`                                         | `ERA Notes/02 - Standalone Modules/Analytics/`          | Standalone |
| Drafts                   | `src/features/drafts/`                                            | `ERA Notes/02 - Standalone Modules/Drafts/`             | Standalone |
| Watch UI                 | `src/components/watch/`                                           | `ERA Notes/02 - Standalone Modules/Watch UI/`           | Standalone |
| Guest Portal             | `src/app/g/[tag]/`, `src/components/guest/`                       | `ERA Notes/02 - Standalone Modules/Guest Portal/`       | Standalone |
| Sync & Offline           | `src/contexts/SyncContext.tsx`, `src/lib/offlineQueue.ts`         | `ERA Notes/03 - Junction Modules/Sync & Offline/`       | Junction   |
| Error Logs               | `src/app/error-logs/`, `src/app/api/error-logs/`                  | `ERA Notes/02 - Standalone Modules/Error Logs/`         | Standalone |
| NFC Tags                 | `src/features/nfc/`, `src/app/nfc/[tag]/`, `src/app/api/nfc/`     | `ERA Notes/02 - Standalone Modules/NFC Tags/`           | Standalone |
| Prerequisites            | `src/lib/prerequisites/`, `src/app/api/items/[id]/prerequisites/` | `ERA Notes/03 - Junction Modules/Prerequisites/`        | Junction   |
| Chores                   | `src/app/reminders/` (Chores tab), `src/app/chores/` (redirect), `src/components/chores/`, `src/features/chores/` | `ERA Notes/02 - Standalone Modules/Chores/` | Standalone |
| Focus                    | `src/app/focus/`, `src/components/focus/`                        | `ERA Notes/02 - Standalone Modules/Focus/`                          | Standalone |
| Trips                    | `src/app/trips/`, `src/features/trips/`, `src/components/trips/`  | `ERA Notes/03 - Junction Modules/Trips/`                            | Junction   |
| Dashboard                | `src/app/dashboard/`, `src/components/web/WebDashboard.tsx`       | `ERA Notes/02 - Standalone Modules/Dashboard/`                      | Standalone |
| Recycle Bin              | `src/app/recycle-bin/`, `src/features/recycle-bin/`              | `ERA Notes/02 - Standalone Modules/Recycle Bin/`                    | Standalone |
| Plan My Day              | `src/app/reminders/` (Focus tab), `src/app/today/` (redirect), `src/components/planner/`, `src/features/day-plan/` | `ERA Notes/03 - Junction Modules/Plan My Day/`                 | Junction   |
| Healthcare               | `src/features/healthcare/`                                        | `ERA Notes/02 - Standalone Modules/Healthcare/`         | Standalone |
| Outfits                  | `src/features/outfits/`, `src/app/outfits/`, `src/components/outfits/` | `ERA Notes/02 - Standalone Modules/Outfits/`       | Standalone |

> **Note:** this table is validated against the **Feature Map** (`ERA Notes/01 - Architecture/Feature Map/_index.md`) by `pnpm docs:check`, which runs during `pnpm sync:ai` and pre-commit. **AI Usage is intentionally excluded** from this Feature Index because it is not part of the application.

---

## Documentation Rules

- **Read before code** — check Feature Index for an existing doc in the vault first
- **Update after implementing** — add new behavior, DB changes, and gotchas to the feature doc
- **Never duplicate** — augment the existing doc, don't create a parallel one
- Update `ERA Notes/04 - UI & Design/App Routes and Icons.md` when adding routes or icons
- New feature doc template: `ERA Notes/Templates/Feature Doc.md`

| Content type                 | Vault location                                              |
| ---------------------------- | ----------------------------------------------------------- |
| Feature doc (Standalone)     | `ERA Notes/02 - Standalone Modules/[module-name]/`          |
| Feature doc (Junction)       | `ERA Notes/03 - Junction Modules/[module-name]/`            |
| Cross-cutting/system         | `ERA Notes/01 - Architecture/`                              |
| UI/visual                    | `ERA Notes/04 - UI & Design/`                               |
| Performance                  | `ERA Notes/05 - Performance/`                               |
| Setup/env                    | `ERA Notes/06 - Setup & Onboarding/`                        |
| Ideas/pending                | `ERA Notes/07 - Backlog & Ideas/`                           |
| Session notes (personal)     | `ERA Notes/08 - Sessions/{Features\|Bug Fixes\|Refactors\|Wizards}/` |
| Reusable patterns (personal) | `ERA Notes/09 - Patterns & Lessons/`                        |
| Page & Feature Atlas entry   | `ERA Notes/04 - UI & Design/Page & Feature Atlas/`          |
| Root-level only              | `CLAUDE.md`, `README.md`                                    |
