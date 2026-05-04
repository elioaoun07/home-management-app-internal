# CLAUDE.md

> **Reactive + Proactive AI Personal Assistant** — a multi-module PWA covering budget tracking, reminders/tasks, meal planning, recipes, catalogues, household chat, dashboards, and an AI assistant. Modules are architecturally independent but share a single household ecosystem. The app is both reactive (responds to user input) and proactive (AI-driven briefings, alerts, and scheduled actions).

CLAUDE.md auto-syncs to `CODEX.md` and `.github/copilot-instructions.md` via PostToolUse hook.

---

## Before You Code — Mandatory Checklist

1. **Identify the module type** (Standalone or Junction — see Module Model below) before scoping work
2. **Check the Feature Index** for the relevant vault path in `ERA Notes/`
3. **Read that doc first** — it contains architecture, DB tables, and gotchas
4. **Read `migrations/schema.sql`** before any DB work — it is the authoritative schema source
5. **Read `ERA Notes/01 - Architecture/Common Patterns.md`** if touching state, mutations, or modals

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
20. **Atlas must be kept in sync** — every new page (`src/app/.../page.tsx`), new route, new feature module (`src/features/[name]/`), or significant navigation/tab change MUST add/update an entry in `ERA Notes/04 - UI & Design/Page & Feature Atlas/` (copy `_Template.md`, fill all sections, add a row to `_Index.md`). Renaming a feature/route is a breaking change — update or delete the corresponding MD file in the same commit. Stub generator: `node scripts/seed-atlas.mjs` (idempotent). **`public/atlas/atlas.json` is regenerated automatically** via the PostToolUse hook in `.claude/hooks/update-atlas.sh` — no need to run `pnpm atlas` manually after editing `src/app/`, `src/features/`, or `src/components/`.

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

> **`migrations/schema.sql` is the single source of truth.** Read it before writing any SQL. Never assume a column exists.

DB changes = SQL run manually in Supabase SQL Editor. New tables must include RLS policies. Update `schema.sql` and document in the feature doc.

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
| Meal Planning            | `src/app/api/meal-plans/`                                         | `ERA Notes/03 - Junction Modules/Meal Planning/`        | Junction   |
| Inventory                | `src/features/inventory/`, `src/app/inventory/`                   | `ERA Notes/02 - Standalone Modules/Inventory/`          | Standalone |
| Debts                    | `src/features/debts/`                                             | `ERA Notes/02 - Standalone Modules/Debts/`              | Standalone |
| Catalogue                | `src/app/catalogue/`, `src/features/catalogue/`                   | `ERA Notes/02 - Standalone Modules/Catalogue/`          | Standalone |
| Future Purchases         | `src/features/future-purchases/`                                  | `ERA Notes/02 - Standalone Modules/Future Purchases/`   | Standalone |
| Budget Allocation        | `src/features/budget/`                                            | `ERA Notes/02 - Standalone Modules/Budget Allocation/`  | Standalone |
| Preferences (LBP, theme) | `src/features/preferences/`                                       | `ERA Notes/02 - Standalone Modules/Preferences/`        | Standalone |
| Statement Import         | `src/features/statement-import/`                                  | `ERA Notes/02 - Standalone Modules/Statement Import/`   | Standalone |
| Transfers                | `src/features/transfers/`                                         | `ERA Notes/02 - Standalone Modules/Transfers/`          | Standalone |
| Hub Chat                 | `src/app/hub/`, `src/features/hub/`, `src/components/hub/`        | `ERA Notes/03 - Junction Modules/Hub Chat/`             | Junction   |
| Shopping List            | `src/components/hub/ShoppingListView.tsx`                         | `ERA Notes/03 - Junction Modules/Shopping List/`        | Junction   |
| Message Actions          | `src/features/hub/messageActions.ts`                              | `ERA Notes/03 - Junction Modules/Message Actions/`      | Junction   |
| Items / Reminders        | `src/app/items/`, `src/features/items/`                           | `ERA Notes/02 - Standalone Modules/Items & Reminders/`  | Standalone |
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
