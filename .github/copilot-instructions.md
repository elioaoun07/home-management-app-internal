]633;E;pnpm dev;2ea4834e-3730-473f-a150-558cfc2f4d06]633;C<!-- AUTO-GENERATED FROM CLAUDE.md — DO NOT EDIT DIRECTLY -->

# CLAUDE.md

> **Reactive + Proactive AI Personal Assistant** — a multi-module PWA covering budget tracking, reminders/tasks, meal planning, recipes, catalogues, household chat, dashboards, and an AI assistant. Modules are architecturally independent but share a single household ecosystem. The app is both reactive (responds to user input) and proactive (AI-driven briefings, alerts, and scheduled actions).

---

## Before You Code — Mandatory Checklist

1. **Identify the module type** (Standalone or Junction — see Module Model below) before scoping work
2. **Check the Feature Index** for the relevant vault path in `ERA Notes/`
3. **Read that doc first** — it contains architecture, DB tables, and gotchas
4. **Read `migrations/schema.sql`** before any DB work — it is the authoritative schema source
5. **Read `ERA Notes/01 - Architecture/Common Patterns.md`** if touching state, mutations, or modals
6. After any change, run `pnpm typecheck` before considering work complete

---

## Hard Rules (Non-Negotiable)

1. **ALL toasts must have an Undo button** — `{ duration: 4000, action: { label: "Undo", onClick: () => undoMutation.mutate(...) } }`. Use `ToastIcons` enum from `src/lib/toastIcons.tsx`.
2. **Single click** = open detail view · **Double click** = toggle pin/favorite
3. **No red for individual task/item rows** — use theme colors (pink/cyan). Container headers CAN use red/amber. Overdue date labels → `text-white/40`
4. **Futuristic icons** where available in toasts and UI elements
5. **Mobile-first** — always verify on mobile viewport
6. **QR/NFC URLs**: never hardcode purpose-specific names (e.g., `/qr-code-oven`). Use generic reusable slugs like `/g/kitchen-1`. Behavior stored server-side.
7. **Focus Page AI briefing**: cached 24h per user, max 2 manual refreshes/day — do not change these limits
8. **Never use `fetch()` for mutations** — always use `safeFetch()` from `src/lib/safeFetch.ts`. It does a pre-flight online check, 3s timeout, and calls `markOffline()` on failure.
9. **Never trust `navigator.onLine`** — use `isReallyOnline()` from `src/lib/connectivityManager.ts`. It probes `/api/health` every 30s for real connectivity.
10. **Cron routes**: verify `Authorization: Bearer {CRON_SECRET}`, use `supabaseAdmin()` (not `supabaseServer()`), add `export const maxDuration = 60`.
11. **Unique constraint violations** (`error.code === "23505"`) → return `409 Conflict`, not 500.
12. **LBP exchange rate** is stored in thousands (e.g., 90 = 90,000 LBP/USD) — see `src/features/preferences/useLbpSettings.ts`.
13. **Theme changes invalidate ALL queries** — use `--theme-bg` CSS variable and `data-theme` attribute, never hardcode background colors.
14. **Never edit `src/components/ui/`** — shadcn/ui auto-generated primitives.
15. **Zod schemas for all API input validation** — derive TS types with `z.infer<>`.
16. **Household linking in API routes**: when fetching user-owned data, always check `household_links` for an active partner and include their data unless `ownOnly=true` is passed. See `src/app/api/accounts/route.ts:28-52`.
17. **Color identity** — current user = **blue** (`blue-400/500`), partner = **pink** (`pink-400/500`). Apply consistently for all color-coded UI: assignment labels, accent bars, avatars, indicators, and any context where "me vs partner" needs visual distinction. Never swap these colors.

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

| Feature                  | Src paths                                                  | Vault doc                                               | Type       |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| Accounts & Balance       | `src/features/accounts/`, `src/features/balance/`          | `ERA Notes/02 - Standalone Modules/Accounts & Balance/` | Standalone |
| Transactions             | `src/app/expense/`, `src/features/transactions/`           | `ERA Notes/02 - Standalone Modules/Transactions/`       | Standalone |
| Categories               | `src/features/categories/`                                 | `ERA Notes/02 - Standalone Modules/Categories/`         | Standalone |
| Recurring Payments       | `src/app/recurring/`, `src/features/recurring/`            | `ERA Notes/02 - Standalone Modules/Recurring Payments/` | Standalone |
| Recipes                  | `src/features/recipes/`, `src/app/recipe/`                 | `ERA Notes/02 - Standalone Modules/Recipes/`            | Standalone |
| Meal Planning            | `src/app/api/meal-plans/`                                  | `ERA Notes/03 - Junction Modules/Meal Planning/`        | Junction   |
| Inventory                | `src/features/inventory/`, `src/app/inventory/`            | `ERA Notes/02 - Standalone Modules/Inventory/`          | Standalone |
| Debts                    | `src/features/debts/`                                      | `ERA Notes/02 - Standalone Modules/Debts/`              | Standalone |
| Catalogue                | `src/app/catalogue/`, `src/features/catalogue/`            | `ERA Notes/02 - Standalone Modules/Catalogue/`          | Standalone |
| Future Purchases         | `src/features/future-purchases/`                           | `ERA Notes/02 - Standalone Modules/Future Purchases/`   | Standalone |
| Budget Allocation        | `src/features/budget/`                                     | `ERA Notes/02 - Standalone Modules/Budget Allocation/`  | Standalone |
| Preferences (LBP, theme) | `src/features/preferences/`                                | `ERA Notes/02 - Standalone Modules/Preferences/`        | Standalone |
| Statement Import         | `src/features/statement-import/`                           | `ERA Notes/02 - Standalone Modules/Statement Import/`   | Standalone |
| Transfers                | `src/features/transfers/`                                  | `ERA Notes/02 - Standalone Modules/Transfers/`          | Standalone |
| Hub Chat                 | `src/app/hub/`, `src/features/hub/`, `src/components/hub/` | `ERA Notes/03 - Junction Modules/Hub Chat/`             | Junction   |
| Shopping List            | `src/components/hub/ShoppingListView.tsx`                  | `ERA Notes/03 - Junction Modules/Shopping List/`        | Junction   |
| Message Actions          | `src/features/hub/messageActions.ts`                       | `ERA Notes/03 - Junction Modules/Message Actions/`      | Junction   |
| Items / Reminders        | `src/app/items/`, `src/features/items/`                    | `ERA Notes/02 - Standalone Modules/Items & Reminders/`  | Standalone |
| AI Assistant             | `src/app/api/ai-chat/`, `src/lib/ai/`                      | `ERA Notes/03 - Junction Modules/AI Assistant/`         | Junction   |
| Notifications            | `src/app/api/notifications/`, `src/app/api/cron/`          | `ERA Notes/03 - Junction Modules/Notifications/`        | Junction   |
| Household Sharing        | `src/features/hub/`                                        | `ERA Notes/03 - Junction Modules/Household Sharing/`    | Junction   |
| Analytics                | `src/features/analytics/`                                  | `ERA Notes/02 - Standalone Modules/Analytics/`          | Standalone |
| Drafts                   | `src/features/drafts/`                                     | `ERA Notes/02 - Standalone Modules/Drafts/`             | Standalone |
| Watch UI                 | `src/components/watch/`                                    | `ERA Notes/02 - Standalone Modules/Watch UI/`           | Standalone |
| Guest Portal             | `src/app/g/[tag]/`, `src/components/guest/`                | `ERA Notes/02 - Standalone Modules/Guest Portal/`       | Standalone |
| Sync & Offline           | `src/contexts/SyncContext.tsx`, `src/lib/offlineQueue.ts`  | `ERA Notes/03 - Junction Modules/Sync & Offline/`       | Junction   |
| Error Logs               | `src/app/error-logs/`, `src/app/api/error-logs/`           | `ERA Notes/02 - Standalone Modules/Error Logs/`         | Standalone |

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
| Root-level only              | `CLAUDE.md`, `README.md`                                    |

---

## Obsidian Vault

All project documentation lives in the **`ERA Notes/`** Obsidian vault at the project root. The vault mirrors the Standalone/Junction module model.

### Vault Structure

```
ERA Notes/
├── 00 - Home/          ← Dashboard MOC + Module Index (Dataview)
├── 01 - Architecture/  ← cross-cutting system docs
├── 02 - Standalone Modules/  ← one folder per standalone module
├── 03 - Junction Modules/    ← one folder per junction module
├── 04 - UI & Design/
├── 05 - Performance/
├── 06 - Setup & Onboarding/
├── 07 - Backlog & Ideas/
├── 08 - Sessions/      ← per-work-block notes (gitignored)
│   ├── Features/
│   ├── Bug Fixes/
│   └── Refactors/
├── 09 - Patterns & Lessons/  ← reusable patterns (gitignored)
└── Templates/          ← Obsidian templates for new notes
```

### Session Workflow

1. Before starting a work block, create a new note from the appropriate template:
   - Feature work → `Templates/Session - Feature.md`
   - Bug fix → `Templates/Session - Bug Fix.md`
   - Refactor → `Templates/Session - Refactor.md`
2. File it in `08 - Sessions/{Features|Bug Fixes|Refactors}/`
3. Set the `module` frontmatter to the module slug (e.g., `accounts`, `hub-chat`)
4. Tag with `session/<type>` + `module/<name>`
5. Link to the module's Overview page with `[[Overview]]`

### Tagging Conventions

| Tag prefix | Purpose             | Examples                                                 |
| ---------- | ------------------- | -------------------------------------------------------- |
| `module/`  | Which module        | `module/accounts`, `module/hub-chat`                     |
| `type/`    | Doc type            | `type/feature-doc`, `type/architecture`, `type/ui`       |
| `session/` | Session type        | `session/feature`, `session/bug-fix`, `session/refactor` |
| `scope/`   | Cross-cutting scope | `scope/cross-cutting`, `scope/auth`, `scope/pwa`         |
| `pattern/` | Code pattern        | `pattern/react-hook`, `pattern/zustand-store`            |
| `status/`  | Work status         | `status/active`, `status/completed`, `status/archived`   |

### Git Tracking (Hybrid)

- **Tracked**: `01–07` folders (feature docs, architecture, etc.) — shared project knowledge
- **Gitignored**: `08 - Sessions/`, `09 - Patterns & Lessons/` — personal working notes
- **Gitignored**: `.obsidian/workspace.json` — personal layout state

### Recommended Plugins

Install via Obsidian → Settings → Community plugins:

- **Dataview** — query notes as database tables (powers Module Index)
- **Templater** — auto-populate `{{date}}`, `{{title}}` in templates
- **Calendar** — visualize sessions on a calendar sidebar

---

## Multi-Agent Sync

This project uses **two AI coding agents**: Claude Code (reads `CLAUDE.md`) and GitHub Copilot (reads `.github/copilot-instructions.md`). To keep them in sync:

- **`CLAUDE.md` is the single source of truth.** All rule changes go here.
- **`.github/copilot-instructions.md` is auto-generated.** Whenever you modify `CLAUDE.md`, immediately overwrite `.github/copilot-instructions.md` with the full contents of `CLAUDE.md`, prefixed with this header:
  ```
  <!-- AUTO-GENERATED FROM CLAUDE.md — DO NOT EDIT DIRECTLY -->
  ```
- **`AGENTS.md` is a separate condensed quick-reference** with code templates. When updating Hard Rules, Module Model tables, or Common Mistakes in `CLAUDE.md`, also review `AGENTS.md` and update any overlapping sections there.
- **`.github/instructions/*.instructions.md`** are Copilot-only scoped deep-dives (API routes, components, feature modules). They are additive — not duplicates. Update them independently when their specific domain changes.
- A **CI workflow** (`.github/workflows/check-docs-sync.yml`) validates that `CLAUDE.md` and `.github/copilot-instructions.md` are in sync on every PR.

---

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Backend
SUPABASE_SERVICE_ROLE_KEY=         # admin ops (cron, batch)
GOOGLE_AI_API_KEY=                 # Gemini AI
CRON_SECRET=                       # cron job auth (Bearer token)
VOICE_SECRET=                      # voice endpoint JWT

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your@email.com

# Optional / Dev
NEXT_PUBLIC_APP_URL=               # app root URL (used in push notification links)
NEXT_PUBLIC_ENABLE_SW=             # set to "false" to disable service worker during debugging
DEV_USER_ID=                       # override auth user in local development
```
