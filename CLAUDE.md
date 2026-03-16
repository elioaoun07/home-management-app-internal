# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev           # Dev server with Turbopack
pnpm build         # Production build
pnpm start         # Production server on port 3000
pnpm lint          # ESLint
pnpm typecheck     # TypeScript check (tsc --noEmit)
pnpm icons         # Generate PWA icons
```

## What This App Is

**Personal AI Home Assistant** — a multi-module PWA covering budget tracking, reminders/tasks, meal planning, recipes, catalogues, household chat, dashboards, and an AI chatbot. All modules share one ecosystem: a single household where data is shared across members (household linking via `household_links` table). Each module is largely independent but connected through shared accounts, categories, and household context.

## Stack

```
Frontend:  Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4
UI:        shadcn/ui + Radix UI, Framer Motion, Lucide React, Recharts, Three.js
State:     TanStack Query v5 (server state), Zustand v5 (client state)
Forms:     React Hook Form + Zod
Backend:   Next.js API routes + Supabase (PostgreSQL + Auth + Realtime + Storage)
AI:        Google Gemini 2.0 Flash (@google/genai)
Other:     date-fns, dnd-kit, rrule, sonner (toasts), vaul (drawer), react-day-picker, web-push
```

## Architecture

```
Component → TanStack Query Hook → API Route → Supabase → PostgreSQL
                ↓
         React Query Cache (optimistic updates via onMutate)
```

- **Optimistic UI**: `onMutate` only — never parallel `useState` (see `docs/architecture/COMMON_PATTERNS.md`)
- **Real-time**: Supabase Realtime for household shared data (`SyncContext`)
- **Offline**: IndexedDB queue + `OfflineSyncEngine` (see `docs/architecture/SYNC_AND_OFFLINE.md`)
- **PWA**: Service worker at `public/sw.js`, persistent React Query cache via localStorage
- **Path alias**: `@/*` → `src/*`
- **Supabase clients**: `lib/supabase/client.ts` (browser) · `server.ts` (RSC/API) · `admin.ts` (service role)
- **Query keys**: centralized in `src/lib/queryKeys.ts`

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=          # required
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # required
SUPABASE_SERVICE_ROLE_KEY=         # admin ops
GOOGLE_AI_API_KEY=                 # Gemini AI
NEXT_PUBLIC_VAPID_PUBLIC_KEY=      # push notifications
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your@email.com
CRON_SECRET=                       # cron job auth
VOICE_SECRET=                      # voice endpoint JWT
```

## Feature Index

| Feature | Src paths | Doc |
|---|---|---|
| Accounts & Balance | `src/features/accounts/`, `src/features/balance/`, `src/app/api/accounts/` | `docs/features/accounts/BALANCE_SYSTEM.md` |
| Transactions | `src/app/expense/`, `src/features/transactions/` | `docs/features/transactions/` |
| Categories | `src/features/categories/` | `docs/features/categories/CATEGORY_CUSTOMIZATION_FEATURE.md` |
| Recurring Payments | `src/app/recurring/`, `src/features/recurring/` | `docs/features/recurring/` |
| Hub Chat | `src/app/hub/`, `src/features/hub/`, `src/components/hub/` | `docs/features/hub/` |
| Shopping List | `src/components/hub/ShoppingListView.tsx` | `docs/features/hub/SHOPPING_LIST.md` |
| Message Actions | `src/features/hub/messageActions.ts` | `docs/features/hub/MESSAGE_ACTIONS.md` |
| Items / Reminders | `src/app/items/`, `src/features/items/` | `docs/features/items/` |
| Catalogue | `src/app/catalogue/`, `src/features/catalogue/` | `docs/features/catalogue/` |
| Future Purchases | `src/features/future-purchases/` | `docs/features/future-purchases/` |
| Household Sharing | `src/features/hub/` | `docs/features/household/` |
| Notifications | `src/app/api/notifications/`, `src/app/api/cron/` | `docs/features/notifications/NOTIFICATIONS.md` |
| AI Assistant | `src/app/api/ai/`, `src/features/blink/` | `docs/features/ai/` |
| Watch UI | `src/components/watch/` | `docs/ui/watch/WATCH_UI.md` |
| Sync & Offline | `src/contexts/SyncContext.tsx`, `src/lib/offlineQueue.ts` | `docs/architecture/SYNC_AND_OFFLINE.md` |
| Guest Portal | `src/app/g/[tag]/`, `src/components/guest/` | — |
| Error Logs | `src/app/error-logs/`, `src/app/api/error-logs/` | `docs/architecture/ERROR_LOGGING_SYSTEM.md` |
| Performance & Caching | `src/app/providers.tsx`, `src/features/transactions/useDashboardTransactions.ts` | `docs/performance/PERFORMANCE_OPTIMIZATIONS.md` |
| UI Polish & Animations | `src/app/globals.css`, `src/components/ui/button.tsx` | `docs/performance/UI_POLISH.md` |

## Database

> **Read `migrations/schema.sql` before any DB work.** It is a live Supabase export — authoritative source for all tables, columns, constraints, foreign keys, and RLS policies. Never assume a column exists without checking.

DB changes = SQL run manually in Supabase SQL Editor. Always cross-reference `migrations/schema.sql` before writing new SQL to avoid constraint conflicts or duplicate columns.

**Core tables:** `accounts`, `account_balances`, `account_balance_history`, `transactions`, `transfers`, `user_categories`, `recurring_payments`
**Hub:** `hub_chat_threads`, `hub_messages`, `hub_message_actions`
**Items:** `items`, `item_alerts`, `item_recurrence_exceptions`, `catalogue_items`
**Notifications:** `notifications`, `push_subscriptions`, `notification_preferences`
**Household:** `household_links`, `profiles`

## Account Type Behavior

- `expense`: positive amounts **decrease** balance; requires category; seeds default categories
- `income`: positive amounts **increase** balance; category optional; no default categories
- `saving`: positive amounts **increase** balance; shared with household; no default categories

## User Preferences (Non-Negotiable)

- **ALL toasts must have an Undo button** — 4000ms duration, no exceptions
- **Single click** = open detail view · **Double click** = toggle pin/favorite
- **No red for individual task/item rows** — use theme colors (pink/cyan). Container headers CAN use red/amber for status. Overdue date labels → `text-white/40`
- **Futuristic icons** where available in toasts and UI elements
- Mobile-first — always verify on mobile viewport

## Common Mistakes

Full patterns with code examples: **`docs/architecture/COMMON_PATTERNS.md`**

1. **Optimistic UI**: use ONLY `onMutate` — never parallel `useState` for the same data
2. **Render path**: after any change, trace page → layout → component and update all parents
3. **Modal state**: store item **ID** not the object — derive fresh data from the query cache
4. **Framer Motion + drag**: never combine `<motion.div draggable>` with HTML5 drag events
5. **Type/enum updates**: changing a type value requires DB migration + TypeScript + API + UI components + utilities (full checklist in COMMON_PATTERNS.md)

## Documentation Governance

### Before starting any feature work
1. Check the Feature Index above for the doc path
2. **Read that doc first** — it is your checkpoint with architecture, DB tables, and gotchas
3. If no doc exists, create one using the template below

### After implementing
- **Update the feature doc**: add new behavior, DB changes discovered, gotchas found
- **Never create a duplicate doc** for an existing feature — always augment the existing one

### Creating a new doc
Place it in the correct folder (see Documentation Structure below) and use this template:

```markdown
# Feature Name

> **Module:** `src/features/x/` | **API:** `src/app/api/x/` | **Page:** `src/app/x/`
> **DB Tables:** `table1`, `table2`
> **Status:** Active | Completed | Planned

## Overview
What it does and why.

## Architecture / How It Works
Technical explanation.

## Database
Key tables, important columns, constraints to know.

## Key Files
- `path/file.ts` — purpose

## Gotchas
- Known pitfalls or constraints
```

## Documentation Structure

```
docs/
├── features/
│   ├── accounts/         balance system, transfers, income/expense
│   ├── categories/       customization, icon mapping
│   ├── transactions/     voice entry, statement import, LBP currency
│   ├── recurring/        recurring payments, exceptions
│   ├── hub/              chat, message actions, shopping list, voice msgs
│   ├── items/            reminders, birthdays, calendar items
│   ├── catalogue/        catalogue modules, task templates
│   ├── future-purchases/
│   ├── household/        sharing, RLS setup
│   ├── ai/               Gemini API guidelines
│   └── notifications/    push, in-app, architecture
├── architecture/         sync/offline, common patterns, error logging, PWA
├── performance/          dashboard perf, UI polish
├── ui/
│   ├── watch/            watch view
│   └── (root)            icons, APP_ROUTES_ICONS.md
├── setup/                auth troubleshooting, env setup
└── backlog/              ideas, pending instructions
```

**Placement rules:**
- New feature doc → `docs/features/[feature-name]/`
- System/cross-cutting doc → `docs/architecture/`
- UI/visual doc → `docs/ui/`
- Update `docs/ui/APP_ROUTES_ICONS.md` when adding routes or icons
- Only `CLAUDE.md` and `README.md` stay at the project root

## Important Notes

- **QR/NFC URLs**: Never hardcode purpose-specific names (e.g., `/qr-code-oven`). Use generic reusable slugs like `/g/kitchen-1`. Behavior is stored server-side so tags can be repurposed without regenerating.
- Guest portal (`/g/[tag]`) is fully public — no auth required
- Focus Page AI briefing: cached 24h per user, max 2 manual refreshes/day — do not change these limits
- `components/ui/` = shadcn/ui primitives — do not edit manually
