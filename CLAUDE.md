# CLAUDE.md

> **Reactive + Proactive AI Personal Assistant** — a multi-module PWA covering budget tracking, reminders/tasks, meal planning, recipes, catalogues, household chat, dashboards, and an AI assistant. Modules are architecturally independent but share a single household ecosystem. The app is both reactive (responds to user input) and proactive (AI-driven briefings, alerts, and scheduled actions).
>
> **Interaction model:** ERA Hub Chat is the **top-layer primary interface**. Quick, conversational, low-friction actions (logging a spend, setting a reminder, adding to the shopping list) happen in the Hub. Standalone module pages (Expense Entry Form, Items, Recipes, etc.) are **precision tools** for detailed, structured input — used when full field control is needed. The Hub offloads high-frequency everyday interactions so that dedicated forms are reserved for cases that truly require them. The AI Assistant lives inside Hub Chat and operates both reactively (parses user messages) and proactively (surfaces briefings and alerts unprompted).

CLAUDE.md auto-syncs to `AGENTS.md`, `CODEX.md`, and `.github/copilot-instructions.md` via PostToolUse hook.

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

- **SECURITY DEFINER RPC** (preferred): own the WHERE clause inside the function; bypass per-table RLS. See `migrations/2026-05-11_schedule_bundle_rpc.sql` + `ERA Notes/05 - Performance/Performance Optimizations.md`.
- **Denormalized `user_id`** on the child table + a direct `user_id = auth.uid()` RLS policy. Add a trigger to keep it in sync with the parent.
  Never enable RLS on a child table without one of these patterns in place.

21. **Hot read paths that fetch a parent + N child tables must use a single SECURITY DEFINER RPC** — each PostgREST call costs ~170–200 ms of network overhead. Fetching `items` + `reminder_details` + `event_details` + `item_subtasks` + `item_alerts` + `item_recurrence_rules` + `recurrence_pauses` as 7 separate queries adds ~1.3 s of floor latency before any RLS or query cost. Collapse them into one `get_*_bundle()` RPC returning JSON aggregates. See `get_schedule_bundle` as the canonical example.
22. **No `console.log` / `console.warn` / `console.error` in committed code** — debug logging must be removed before committing. Use the Error Logs module (`src/app/error-logs/`) for persistent structured logging and `src/lib/logger.ts` (if present) for guarded dev-only logs. Stray `console.*` calls slow down React DevTools overlay and leak internal state in production.
23. **Atlas must be kept in sync** — every new page (`src/app/.../page.tsx`), new route, new feature module (`src/features/[name]/`), or significant navigation/tab change MUST add/update an entry in `ERA Notes/04 - UI & Design/Page & Feature Atlas/` (copy `_Template.md`, fill all sections, add a row to `_Index.md`). Renaming a feature/route is a breaking change — update or delete the corresponding MD file in the same commit. Stub generator: `node scripts/seed-atlas.mjs` (idempotent). **`public/atlas/atlas.json` is regenerated automatically** via the PostToolUse hook in `.claude/hooks/update-atlas.sh` — no need to run `pnpm atlas` manually after editing `src/app/`, `src/features/`, or `src/components/`.
24. **DB changes require a migration file** — whenever a DB change is needed (CREATE TABLE, ALTER TABLE, ADD COLUMN, CREATE INDEX, CREATE POLICY, DROP, etc.), you MUST: (1) **first** create `migrations/YYYY-MM-DD_short-description.sql` with the exact SQL to run manually in Supabase SQL Editor, (2) **then** update `migrations/schema.sql` to reflect the final schema state. The migration file is the manual runbook; `schema.sql` is the authoritative end-state snapshot. Never update `schema.sql` without a corresponding migration file in the same session. If multiple unrelated DB changes occur in one session, use a single migration file for all of them. Enforced by `.claude/hooks/check-migration.sh`.
25. **PM files must stay current** — `ERA Notes/10 - Project Management/` is the live command center, not a historical snapshot. Update it in the same session as the code change:
   - **Story/bug-fix completed:** in the relevant module campaign folder (e.g., `Schedule/Pain Inventory & Plan/`), mark the item ✅ with the date in file 1 (Pain Inventory / Feature State), check `[x]` in file 3 (Execution Plan / Action Plan), and add an `*(IMPLEMENTED YYYY-MM-DD)*` note in file 2 (Target Design / Decisions).
   - **New bug surfaces:** add it to the relevant pain cluster or backlog section in file 1 with severity, root cause, and evidence — so it enters the ranked queue, not a separate list.
   - **No orphan fixes** — a fix with no PM trace is invisible to future planning. The PM files are the single source of truth for what hurts, what's been done, and what's next.

---

## Module Model

Every feature in this app is either **Standalone** or **Junction**. Identify the type before coding — it determines your scope.

### Standalone Modules

Self-contained features with their own UI, hooks, API routes, and DB tables. Each can be developed, tested, and documented in isolation.

**Rule:** Standalone feature directories (`src/features/[name]/`) must not import from other standalone feature directories.
Shared code belongs in `src/components/`, `src/lib/`, or `src/types/` — available to all modules.
**AI scope:** when modifying a Standalone, changes are fully contained — other standalones are unaffected.

| Module                                                 | Feature directory                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget (Accounts, Transactions, Categories, Recurring) | `src/features/accounts/`, `src/features/transactions/`, `src/features/categories/`, `src/features/recurring/`, `src/features/balance/`, `src/features/budget/` |
| Reminders / Items / Tasks                              | `src/features/items/`                                                                                                                                          |
| Recipes                                                | `src/features/recipes/`                                                                                                                                        |
| Catalogue                                              | `src/features/catalogue/`                                                                                                                                      |
| Inventory                                              | `src/features/inventory/`                                                                                                                                      |
| Debts                                                  | `src/features/debts/`                                                                                                                                          |
| Future Purchases                                       | `src/features/future-purchases/`                                                                                                                               |
| Analytics                                              | `src/features/analytics/`                                                                                                                                      |
| Preferences (LBP, theme, settings)                     | `src/features/preferences/`                                                                                                                                    |
| Statement Import                                       | `src/features/statement-import/`                                                                                                                               |
| Transfers                                              | `src/features/transfers/`                                                                                                                                      |
| Watch UI                                               | `src/components/watch/`                                                                                                                                        |
| Guest Portal                                           | `src/app/g/[tag]/`                                                                                                                                             |
| NFC Tags                                               | `src/features/nfc/`, `src/app/nfc/[tag]/`, `src/app/api/nfc/`                                                                                                  |

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
> **Caveat:** the schema export captures **tables only** — RLS policies and function bodies (e.g. `get_schedule_bundle`) are NOT in the repo. Verified 2026-05-31: items tables DO have RLS even though schema.sql doesn't show it. Before any auth/RLS work, treat the live DB as truth (see `migrations/_verify_schedule_rls.md` for the verification queries).

DB changes = SQL run manually in Supabase SQL Editor. New tables must include RLS policies. **Always create a migration file first** (`migrations/YYYY-MM-DD_description.sql`), then update `schema.sql`. See Hard Rule #24.

Unique constraint violations: Supabase returns `error.code === "23505"` → respond with `409 Conflict`.

| Domain        | Tables                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Finance       | `accounts`, `account_balances`, `account_balance_history`, `transactions`, `transfers`, `user_categories`, `recurring_payments` |
| Hub           | `hub_chat_threads`, `hub_messages`, `hub_message_actions`                                                                       |
| Items         | `items`, `item_alerts`, `item_recurrence_exceptions`, `catalogue_items`                                                         |
| Notifications | `notifications`, `push_subscriptions`, `notification_preferences`                                                               |
| Household     | `household_links`, `profiles`                                                                                                   |

Account types (`expense`/`income`/`saving`) affect balance direction — see `migrations/schema.sql` CHECK constraints and `src/lib/balance-utils.ts`.

---

## Domain Gotchas

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
| Chores                   | `src/app/chores/`, `src/features/chores/`                        | `ERA Notes/02 - Standalone Modules/Chores/`                         | Standalone |
| Focus                    | `src/app/focus/`, `src/components/focus/`                        | `ERA Notes/02 - Standalone Modules/Focus/`                          | Standalone |
| Trips                    | `src/app/trips/`, `src/features/trips/`, `src/components/trips/`  | `ERA Notes/03 - Junction Modules/Trips/`                            | Junction   |
| Dashboard                | `src/app/dashboard/`, `src/components/web/WebDashboard.tsx`       | `ERA Notes/02 - Standalone Modules/Dashboard/`                      | Standalone |
| Recycle Bin              | `src/app/recycle-bin/`, `src/features/recycle-bin/`              | `ERA Notes/02 - Standalone Modules/Recycle Bin/`                    | Standalone |
| Plan My Day              | `src/app/today/`, `src/components/planner/`, `src/features/day-plan/` | `ERA Notes/03 - Junction Modules/Plan My Day/`                 | Junction   |

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
| Session notes (personal)     | `ERA Notes/08 - Sessions/{Features\|Bug Fixes\|Refactors}/` |
| Reusable patterns (personal) | `ERA Notes/09 - Patterns & Lessons/`                        |
| Page & Feature Atlas entry   | `ERA Notes/04 - UI & Design/Page & Feature Atlas/`          |
| Root-level only              | `CLAUDE.md`, `README.md`                                    |
