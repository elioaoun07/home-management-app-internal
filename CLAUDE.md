# CLAUDE.md

> **Reactive + Proactive AI Personal Assistant** — a multi-module PWA covering budget tracking, reminders/tasks, meal planning, recipes, catalogues, household chat, dashboards, and an AI assistant. Modules are architecturally independent but share a single household ecosystem. The app is both reactive (responds to user input) and proactive (AI-driven briefings, alerts, and scheduled actions).

---

## Before You Code — Mandatory Checklist

1. **Identify the module type** (Standalone or Junction — see Module Model below) before scoping work
2. **Check the Feature Index** for the relevant doc path
3. **Read that doc first** — it contains architecture, DB tables, and gotchas
4. **Read `migrations/schema.sql`** before any DB work — it is the authoritative schema source
5. **Read `docs/architecture/COMMON_PATTERNS.md`** if touching state, mutations, or modals
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

---

## Module Model

Every feature in this app is either **Standalone** or **Junction**. Identify the type before coding — it determines your scope.

### Standalone Modules

Self-contained features with their own UI, hooks, API routes, and DB tables. Each can be developed, tested, and documented in isolation.

**Rule:** Standalone feature directories (`src/features/[name]/`) must not import from other standalone feature directories.
Shared code belongs in `src/components/`, `src/lib/`, or `src/types/` — available to all modules.
**AI scope:** when modifying a Standalone, changes are fully contained — other standalones are unaffected.

| Module | Feature directory |
| ------ | ----------------- |
| Budget (Accounts, Transactions, Categories, Recurring) | `src/features/accounts/`, `src/features/transactions/`, `src/features/categories/`, `src/features/recurring/`, `src/features/balance/`, `src/features/budget/` |
| Reminders / Items / Tasks | `src/features/items/` |
| Recipes | `src/features/recipes/` |
| Catalogue | `src/features/catalogue/` |
| Inventory | `src/features/inventory/` |
| Debts | `src/features/debts/` |
| Future Purchases | `src/features/future-purchases/` |
| Analytics | `src/features/analytics/` |
| Preferences (LBP, theme, settings) | `src/features/preferences/` |
| Statement Import | `src/features/statement-import/` |
| Transfers | `src/features/transfers/` |
| Watch UI | `src/components/watch/` |
| Guest Portal | `src/app/g/[tag]/` |

### Junction Modules

Bridge between Standalone modules. May import from any standalone feature directory to connect them.

**Rule:** changes here can cascade across multiple standalones — always trace all connected modules before modifying.
**AI scope:** when modifying a Junction, read the docs of every connected Standalone first.

| Junction | Connects |
| -------- | -------- |
| Hub Chat | Budget (message actions → transactions), Reminders (create from chat), Shopping List |
| Shopping List | Hub Chat, Recipes (ingredients → list), Inventory |
| Meal Planning | Recipes, Reminders/Calendar, Shopping List |
| AI Assistant | Transactions + Items (context injection), Dashboard briefing, Focus insights |
| Notifications | Items (alerts), Recurring (payment reminders), Budget (spending alerts) |
| Household Sharing | ALL modules — shared data layer via `household_links` + `profiles` |
| Sync & Offline | ALL modules — IndexedDB queue + `OfflineSyncEngine` |

---

## Architecture References

- **Data flow, optimistic mutations, ID-only state, Framer Motion + HTML5 drag conflicts**: `docs/architecture/COMMON_PATTERNS.md`
- **Offline queue, sync engine, IndexedDB vs legacy localStorage queue**: `docs/architecture/SYNC_AND_OFFLINE.md`
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

| Context | Purpose | Safe variant |
| ------- | ------- | ------------ |
| `SyncContext` | Offline queue, connectivity state, retry logic | `useSyncSafe()` |
| `AppModeContext` | "budget" vs "items" mode, FAB target | `useAppModeSafe()` |
| `TabContext` | Active tab + notification deep-link routing (`pendingItemId`, `pendingThreadId`) | `useTabSafe()` |
| `ThemeContext` | Theme switching (blue/pink/frost/calm), invalidates all queries on change | — |
| `UserContext` | Current user name, email, avatar | — |
| `PrivacyBlurContext` | Privacy mode blur toggle | — |
| `SplitBillContext` | Split bill calculation state | — |

---

## Database

> **`migrations/schema.sql` is the single source of truth.** Read it before writing any SQL. Never assume a column exists.

DB changes = SQL run manually in Supabase SQL Editor. New tables must include RLS policies. Update `schema.sql` and document in the feature doc.

Unique constraint violations: Supabase returns `error.code === "23505"` → respond with `409 Conflict`.

| Domain | Tables |
| ------ | ------ |
| Finance | `accounts`, `account_balances`, `account_balance_history`, `transactions`, `transfers`, `user_categories`, `recurring_payments` |
| Hub | `hub_chat_threads`, `hub_messages`, `hub_message_actions` |
| Items | `items`, `item_alerts`, `item_recurrence_exceptions`, `catalogue_items` |
| Notifications | `notifications`, `push_subscriptions`, `notification_preferences` |
| Household | `household_links`, `profiles` |

Account types (`expense`/`income`/`saving`) affect balance direction — see `migrations/schema.sql` CHECK constraints and `src/lib/balance-utils.ts`.

---

## Domain Gotchas

- **Framer Motion + HTML5 drag**: never mix `<motion.div draggable>` with HTML5 drag events — use one or the other (see `COMMON_PATTERNS.md`)
- **Enum/type updates**: always update DB migration + TypeScript type + API route + UI components + utilities together
- **Standalone imports**: standalone feature dirs can't import from each other — use `src/components/`, `src/lib/`, `src/types/`
- **Zustand in non-React modules**: use `store.getState().action()` directly — see `src/lib/stores/offlinePendingStore.ts` (`offlinePendingActions` export pattern)

---

## Feature Index

| Feature | Src paths | Doc | Type |
| ------- | --------- | --- | ---- |
| Accounts & Balance | `src/features/accounts/`, `src/features/balance/` | `docs/features/accounts/BALANCE_SYSTEM.md` | Standalone |
| Transactions | `src/app/expense/`, `src/features/transactions/` | `docs/features/transactions/` | Standalone |
| Categories | `src/features/categories/` | `docs/features/categories/CATEGORY_CUSTOMIZATION_FEATURE.md` | Standalone |
| Recurring Payments | `src/app/recurring/`, `src/features/recurring/` | `docs/features/recurring/` | Standalone |
| Recipes | `src/features/recipes/`, `src/app/recipe/` | `docs/features/recipes/` | Standalone |
| Meal Planning | `src/app/api/meal-plans/` | — | Junction |
| Inventory | `src/features/inventory/`, `src/app/inventory/` | — | Standalone |
| Debts | `src/features/debts/` | — | Standalone |
| Catalogue | `src/app/catalogue/`, `src/features/catalogue/` | `docs/features/catalogue/` | Standalone |
| Future Purchases | `src/features/future-purchases/` | `docs/features/future-purchases/` | Standalone |
| Budget Allocation | `src/features/budget/` | — | Standalone |
| Preferences (LBP, theme) | `src/features/preferences/` | — | Standalone |
| Statement Import | `src/features/statement-import/` | `docs/features/transactions/STATEMENT_IMPORT.md` | Standalone |
| Transfers | `src/features/transfers/` | — | Standalone |
| Hub Chat | `src/app/hub/`, `src/features/hub/`, `src/components/hub/` | `docs/features/hub/` | Junction |
| Shopping List | `src/components/hub/ShoppingListView.tsx` | `docs/features/hub/SHOPPING_LIST.md` | Junction |
| Message Actions | `src/features/hub/messageActions.ts` | `docs/features/hub/MESSAGE_ACTIONS.md` | Junction |
| Items / Reminders | `src/app/items/`, `src/features/items/` | `docs/features/items/` | Standalone |
| AI Assistant | `src/app/api/ai-chat/`, `src/lib/ai/` | `docs/features/ai/` | Junction |
| Notifications | `src/app/api/notifications/`, `src/app/api/cron/` | `docs/features/notifications/NOTIFICATIONS.md` | Junction |
| Household Sharing | `src/features/hub/` | `docs/features/household/` | Junction |
| Analytics | `src/features/analytics/` | `docs/performance/PERFORMANCE_OPTIMIZATIONS.md` | Standalone |
| Drafts | `src/features/drafts/` | — | Standalone |
| Watch UI | `src/components/watch/` | `docs/ui/watch/WATCH_UI.md` | Standalone |
| Guest Portal | `src/app/g/[tag]/`, `src/components/guest/` | — | Standalone |
| Sync & Offline | `src/contexts/SyncContext.tsx`, `src/lib/offlineQueue.ts` | `docs/architecture/SYNC_AND_OFFLINE.md` | Junction |
| Error Logs | `src/app/error-logs/`, `src/app/api/error-logs/` | `docs/architecture/ERROR_LOGGING_SYSTEM.md` | Standalone |

---

## Documentation Rules

- **Read before code** — check Feature Index for an existing doc first
- **Update after implementing** — add new behavior, DB changes, and gotchas to the feature doc
- **Never duplicate** — augment the existing doc, don't create a parallel one
- Update `docs/ui/APP_ROUTES_ICONS.md` when adding routes or icons
- New feature doc template: `docs/TEMPLATE.md`

| Content type | Location |
| ------------ | -------- |
| Feature doc | `docs/features/[feature-name]/` |
| Cross-cutting/system | `docs/architecture/` |
| UI/visual | `docs/ui/` |
| Setup/env | `docs/setup/` |
| Ideas/pending | `docs/backlog/` |
| Root-level only | `CLAUDE.md`, `README.md` |

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
