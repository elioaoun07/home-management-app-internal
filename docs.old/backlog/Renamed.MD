# CLAUDE.MD - Budget Manager App Development Guide

> **Purpose**: This document serves as the complete memory and reference guide for Claude when working on this project. It contains all progress, implementation details, user preferences, past mistakes to avoid, and future feature requests.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Completed Features](#completed-features)
5. [User Preferences & Remarks](#user-preferences--remarks)
6. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
7. [Database Schema Highlights](#database-schema-highlights)
8. [Migration Guide](#migration-guide)
9. [Future Implementations Requested](#future-implementations-requested)
10. [File Structure](#file-structure)
11. [Replication Guide](#replication-guide)

---

## Project Overview

**Name**: Budget Manager / Home Manager  
**Type**: Progressive Web App (PWA)  
**Purpose**: A household budget and life management application with household sharing capabilities

### Core Functionality

- **Expense Tracking**: Track daily expenses across multiple accounts (wallet, bank, etc.)
- **Balance Management**: Weekly/monthly budget reconciliation with real balance tracking
- **Household Sharing**: Share data with a partner/spouse
- **Reminders/Tasks**: Calendar-based task and reminder system
- **Hub Chat**: WhatsApp-like chat interface for household communication
- **Catalogue System**: A "UI Database" for organizing contacts, tasks, notes, recipes, etc.
- **AI Assistant**: Gemini-powered AI for budget analysis and advice

---

## Tech Stack

```
Frontend:
├── Next.js 16 (App Router, Turbopack)
├── React 19
├── TypeScript
├── Tailwind CSS 4
├── shadcn/ui components
├── Radix UI primitives
├── Framer Motion (animations)
├── TanStack Query (React Query) - data fetching
├── Zustand - global state
└── date-fns - date manipulation

Backend:
├── Next.js API Routes
├── Supabase (PostgreSQL + Auth + Realtime + Storage)
└── Web Push (notifications)

AI:
└── Google Gemini 2.0 Flash (@google/genai)

Other:
├── dnd-kit (drag and drop)
├── rrule (recurring events)
├── react-day-picker (calendar)
└── sonner (toasts)
```

---

## Architecture

### Database

- **PostgreSQL** via Supabase
- **Row Level Security (RLS)** for data protection
- **Household sharing** via `household_links` table

### Data Flow

```
Component → TanStack Query Hook → API Route → Supabase → Database
                ↓
         React Query Cache (optimistic updates)
```

### Key Patterns

1. **Optimistic UI**: Updates appear instantly, sync in background
2. **Real-time Sync**: Supabase Realtime for household data
3. **PWA**: Installable, works offline (service worker)
4. **Mobile-first**: Designed for phone use, tablet-friendly

---

## Completed Features

### 1. Account & Balance System

**Files**: `src/features/accounts/`, `src/features/balance/`, `src/app/api/accounts/`

- Multiple account types: `income`, `expense`, `saving`
- Dynamic balance calculation: `Initial Balance - SUM(transactions since balance_set_at)`
- Balance history tracking with change types
- Account transfers between accounts
- Account visibility and ordering
- Default account selection

**Migrations**:

- `add_account_balances.sql`
- `add_account_balance_history.sql`
- `add_balance_set_at.sql`
- `add_transfers.sql`
- `add_saving_account_type.sql`

### 2. Transaction System

**Files**: `src/features/transactions/`, `src/components/expense/`

- Full CRUD for transactions
- Draft transactions (voice-created)
- Private transactions (hidden from partner)
- Statement import (PDF parsing)
- Category/subcategory assignment
- Date-based filtering

**Migrations**:

- `add_draft_transactions.sql`
- `add_private_transactions.sql`
- `add_statement_import.sql`

### 3. Category System

**Files**: `src/features/categories/`, `src/components/expense/CategorySelect.tsx`

- Hierarchical categories (parent/child)
- Custom icons and colors
- Drag-and-drop reordering
- Per-account categories
- Visibility toggle

**Migrations**:

- `add_category_customization.sql`
- `add_category_visibility.sql`

### 4. Recurring Payments

**Files**: `src/features/recurring/`, `src/app/recurring/`

- Schedule recurring bills/subscriptions
- Auto-calculation of next due date
- Confirm payment → creates transaction
- Due payment notifications

**Migrations**:

- `add_recurring_payments.sql`

### 5. Hub Chat System

**Files**: `src/features/hub/`, `src/components/hub/`

- WhatsApp-like chat threads
- Thread purposes: general, budget, reminder, shopping, travel, health, notes
- Real-time messaging via Supabase Realtime
- Voice messages with transcription
- Message actions (long-press menu)
- Shopping list mode (checkbox interface)

**Migrations**:

- `add_hub_feature.sql`
- `add_hub_chat_threads.sql`
- `add_hub_message_actions.sql`
- `add_voice_messages.sql`
- `add_thread_purpose.sql`

### 6. Household Sharing

**Files**: `src/features/hub/`, household-related components

- Link households via unique code
- View partner's accounts/transactions (read-only)
- Private transaction support
- Shared saving accounts

**Migrations**:

- `household_sharing_policies.sql`
- `add_private_transactions.sql`

### 7. Notifications System

**Files**: `src/app/api/notifications/`, `src/components/notifications/`

- Push notifications (Web Push API)
- In-app notifications (bell icon)
- Daily transaction reminders
- Budget alerts
- Custom preferences

**Migrations**:

- `add_push_subscriptions.sql`
- `add_in_app_notifications.sql`
- `add_unified_notifications.sql`

### 8. Items/Reminders System

**Files**: `src/features/items/`, `src/features/reminders/`

- Calendar-based reminders
- Task management with subtasks
- Recurrence rules (RRULE)
- Recurrence exceptions
- Alert notifications
- **Responsible user assignment** with "All Household" option
  - Select "Me", partner, or "All Household" for task responsibility
  - "All Household" sends alert notifications to both household members

**Migrations**:

- `add_items_system.sql`
- `add_nested_subtasks.sql`
- `add_item_occurrence_actions.sql`
- `add_notify_all_household.sql`

### 9. Catalogue System

**Files**: `src/features/catalogue/`, `src/components/catalogue/`

- Modular system for organizing data
- Built-in modules: Contacts, Tasks, Notes, Recipes
- Custom modules support
- Categories within modules
- Drag-and-drop organization
- Task templates → Calendar integration

**Migrations**:

- `add_catalogue_system.sql`
- `add_catalogue_tasks_calendar_link.sql`

### 10. Future Purchases/Savings Goals

**Files**: `src/features/future-purchases/`

- Goal-based savings tracking
- Target amount and date
- Progress visualization
- Monthly allocation tracking

**Migrations**:

- `add_future_purchases.sql`

### 11. AI Chat Assistant

**Files**: `src/features/blink/`, `src/app/api/ai/`

- Gemini-powered assistant
- Budget context awareness
- Session management
- Rate limiting

**Migrations**:

- `add_ai_messages.sql`
- `add_ai_rate_limits.sql`

### 12. Error Logging

**Files**: `src/app/api/error-logs/`, `src/app/error-logs/`

- Client-side error capture
- Error log dashboard
- User agent tracking

**Migrations**:

- `add_error_logs.sql`

### 14. AI-Powered Focus Page

**Files**: `src/components/focus/FocusPage.tsx`, `src/features/items/useFocusInsights.ts`, `src/app/api/focus-insights/`

- **Smart AI Briefing**: Gemini generates personalized daily/weekly briefings
- **Persistent Caching**: Insights cached for 24 hours, only 1 API call per day per user
- **Smart Refresh**: Cache persists across page visits, manual refresh available
- **Priority Insights**: AI suggests which tasks to focus on first
- **Pattern Detection**: AI identifies patterns in user's task habits
- **Fallback System**: Deterministic fallback when AI unavailable
- **Rate Limiting**: Max 2 refreshes per day to prevent API abuse
- **New Item Detection**: Shows count of new items since last analysis

**Key Features**:

- Living avatar with mood animations (neutral, happy, thinking, celebrating)
- Celebration particles on task completion
- Typing animation for AI messages
- Stale indicator when insights are older than 24h

**Cache Strategy**:

- Fresh: 0-24 hours (green, current)
- Stale: 24h-7 days (amber, usable but shows refresh prompt)
- Expired: 7+ days (regenerate on next visit)

**Migrations**:

- `add_focus_insights.sql`

---

## User Preferences & Remarks

### Toast Notifications

- **ALL toasts MUST have an Undo button** - No exceptions
- Use 4000ms duration for toasts with undo actions
- Use futuristic icons where available

### UI Interactions

- **Single click** on items = Open detail view (view/edit/delete)
- **Double click** on items = Toggle pin/favorite
- Tablet-friendly with optimistic UI updates

### Color Styling for Tasks

- **NO RED for task items in focus view** - Too stressing on the eye
- Containers/collapsible headers CAN use red/amber to indicate status (overdue, incomplete)
- Individual items should use the user's theme color (pink/cyan)
- Overdue date labels should be subtle (`text-white/40`) not red

### Module-Specific Dialogs

- Each catalogue module should have context-specific fields
- No generic fields like "Progress Tracking" for modules that don't need it (e.g., Contacts)

### Account Type Behavior

- `expense`: Positive amounts DECREASE balance, requires category, seeds default categories
- `income`: Positive amounts INCREASE balance, category optional, no default categories
- `saving`: Positive amounts INCREASE balance (like income), category optional, no default categories, shared with household

---

## Common Mistakes to Avoid

### 1. Double State Management for Optimistic UI

**❌ WRONG**: Using BOTH local useState AND React Query cache for optimistic updates

**What happens**:

1. Optimistic update works momentarily
2. Local state is cleared after mutation succeeds
3. `invalidateQueries` triggers refetch
4. Refetch returns stale data (race condition with DB)
5. UI reverts to old state

**✅ CORRECT**: Use ONLY React Query's `onMutate` for optimistic updates:

```typescript
// In the mutation hook - this is ALL you need
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: itemsKeys.all });
  const previous = queryClient.getQueryData(itemsKeys.all);

  queryClient.setQueryData(itemsKeys.all, (old) => {
    return updatedData; // Update cache optimistically
  });

  return { previous };
},
onError: (err, variables, context) => {
  queryClient.setQueryData(itemsKeys.all, context?.previous); // Rollback
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: itemsKeys.all }); // Refetch
},
```

**DO NOT** add separate `useState` in the component for the same data!

### 2. Not Tracing Component to Render Location

**❌ WRONG**: Implementing features but not connecting them to the actual UI

**Pattern observed**:

- Database migrations ✓
- Types ✓
- Hooks/mutations ✓
- Component logic ✓
- BUT FAIL to update PARENT components that render the feature

**✅ CORRECT**: ALWAYS:

1. After implementing component changes, search for all usages of that component
2. Update parent components to pass new props
3. Check the specific view/page the user mentioned
4. Trace the full render path from page → component

### 3. Stale Snapshot in Modal State

**❌ WRONG**: Storing a full object in state then passing to modal

```typescript
// BAD - stores stale snapshot
const [focusItem, setFocusItem] = useState<Item | null>(null);
```

**✅ CORRECT**: Store only ID, derive fresh data from query:

```typescript
// GOOD - stores only ID, derives fresh data
const [focusItemId, setFocusItemId] = useState<string | null>(null);
const focusItem = useMemo(() => {
  if (!focusItemId) return null;
  return items.find((i) => i.id === focusItemId) || null;
}, [focusItemId, items]); // items comes from useQuery
```

### 4. Framer Motion + HTML5 Drag and Drop Conflict

**❌ WRONG**: Using `<motion.div draggable>` with HTML5 drag events

**Problem**: Framer Motion intercepts drag events for its own animation system

**✅ CORRECT**: Use regular `<div draggable>` for HTML5 drag and drop, OR use Framer Motion's `drag` prop with `useDrag` hooks (but NOT both)

### 5. Incomplete Type/Enum Updates

**❌ WRONG**: Adding a new type value but missing UI components

**✅ CORRECT - Checklist for Type Changes**:

When adding new types (e.g., new account type "saving"):

1. [ ] **Database**: Migration with constraint update
2. [ ] **TypeScript types**: `src/types/domain.ts` and related interfaces
3. [ ] **API validation**: API route handlers
4. [ ] **UI Components**:
   - [ ] Form components (RadioGroup, Select, etc.)
   - [ ] Display components (badges, labels with colors)
   - [ ] `src/components/expense/AccountSelect.tsx` for account types
   - [ ] `src/components/expense/NewAccountDrawer.tsx` - Card-style type selector
   - [ ] `src/components/expense/MobileExpenseForm.tsx` - Transaction labels, step flow
5. [ ] **Utility functions**: Type guards, filters, mappers
6. [ ] **Constants**: Default values, seed data types

---

## Database Schema Highlights

### Core Tables

- `accounts` - User accounts (wallet, bank, etc.)
- `account_balances` - Balance tracking with `balance_set_at`
- `account_balance_history` - Full history of balance changes
- `transactions` - All expenses/incomes
- `user_categories` - Custom categories per account
- `transfers` - Account-to-account transfers
- `recurring_payments` - Scheduled recurring bills

### Hub Tables

- `hub_chat_threads` - Chat threads with purposes
- `hub_messages` - Messages with voice support
- `hub_message_actions` - Long-press action configurations

### Items/Reminders Tables

- `items` - Calendar items (reminders, events, tasks)
- `item_alerts` - Alert configurations
- `item_recurrence_exceptions` - Exception dates for recurring items
- `catalogue_items` - Catalogue entries (templates)

### Notification Tables

- `push_subscriptions` - Web Push subscriptions
- `in_app_notifications` - Bell icon notifications
- `notification_preferences` - User preferences

### Household Tables

- `household_links` - Partner linking
- `profiles` - User profiles

---

## Migration Guide

### Running Migrations

1. **Via Supabase Dashboard**:
   - Go to SQL Editor
   - Copy migration file contents
   - Run the SQL

2. **Via CLI**:
   ```bash
   psql "YOUR_CONNECTION_STRING" -f migrations/filename.sql
   ```

### Migration Order (for fresh setup)

```
1. Core tables (usually auto-created by Supabase Auth)
2. add_account_balances.sql
3. add_account_balance_history.sql
4. add_transfers.sql
5. add_draft_transactions.sql
6. add_private_transactions.sql
7. add_recurring_payments.sql
8. add_hub_feature.sql
9. add_hub_chat_threads.sql
10. add_voice_messages.sql
11. add_items_system.sql
12. add_catalogue_system.sql
13. add_push_subscriptions.sql
14. add_in_app_notifications.sql
15. household_sharing_policies.sql
... (run all migrations in migrations/ folder)
```

---

## Future Implementations Requested

### High Priority

1. **Receipt Scanning** - OCR to extract transaction data from photos
2. **Bank Statement Auto-Import** - Connect to bank APIs
3. **Budget Templates** - Pre-made budget allocations
4. **Reports/Analytics** - Monthly/yearly spending reports with charts

### Medium Priority

5. **Split Bills** - Split expenses with household partner
6. **Debt Tracking** - Track money owed to/from others
7. **Currency Conversion** - Multi-currency support
8. **Dark Mode Themes** - More theme options beyond current themes

### Low Priority / Ideas

9. **Investment Tracking** - Track stocks, crypto
10. **Goal Sharing** - Share savings goals with partner
11. **Export to CSV/PDF** - Data export functionality
12. **Widgets** - iOS/Android home screen widgets

### Specific User Requests

- [ ] Watch UI improvements (referenced in WATCH*UI*\*.md files)
- [ ] LBP currency change feature (CLAUDE: check LBP_CHANGE_FEATURE.md)
- [ ] Birthday reminders (BIRTHDAY_FEATURE.md)
- [ ] Multi-link product comparison for shopping (MULTI_LINK_PRODUCT_COMPARISON.md)

---

## File Structure

```
budget-app/
├── migrations/           # SQL migration files
├── public/              # Static assets, PWA manifest
│   └── sw.js           # Service worker
├── scripts/             # Build scripts, utilities
├── src/
│   ├── app/            # Next.js App Router pages
│   │   ├── api/        # API routes
│   │   ├── dashboard/  # Main dashboard
│   │   ├── expense/    # Expense entry page
│   │   ├── settings/   # Settings page
│   │   └── ...
│   ├── components/      # React components
│   │   ├── expense/    # Expense-related components
│   │   ├── hub/        # Chat components
│   │   ├── catalogue/  # Catalogue components
│   │   ├── layouts/    # Layout components
│   │   └── ui/         # shadcn/ui components
│   ├── features/        # Feature modules (hooks, mutations)
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── hub/
│   │   ├── items/
│   │   └── ...
│   ├── hooks/           # Shared custom hooks
│   ├── lib/             # Utilities, helpers
│   │   ├── supabase/   # Supabase client setup
│   │   └── utils/      # Helper functions
│   ├── types/           # TypeScript types
│   └── contexts/        # React contexts
├── .env.example         # Environment variables template
├── schema.sql           # Current database schema (reference)
└── *.md                 # Feature documentation files
```

---

## Replication Guide

### To replicate this project from scratch:

#### 1. Create Next.js Project

```bash
pnpm create next-app@latest budget-app --typescript --tailwind --app
cd budget-app
```

#### 2. Install Dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr @tanstack/react-query zustand framer-motion date-fns sonner zod react-hook-form @hookform/resolvers lucide-react
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-popover @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-separator @radix-ui/react-avatar @radix-ui/react-alert-dialog @radix-ui/react-label @radix-ui/react-radio-group @radix-ui/react-slider @radix-ui/react-slot
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers @dnd-kit/utilities
pnpm add @google/genai rrule web-push class-variance-authority clsx tailwind-merge vaul cmdk react-day-picker
```

#### 3. Set Up Supabase

1. Create Supabase project at https://supabase.com
2. Copy connection credentials to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 4. Run Database Migrations

Run all SQL files in `migrations/` folder in Supabase SQL Editor

#### 5. Set Up shadcn/ui

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog drawer input label select sheet tabs toast checkbox switch popover tooltip scroll-area separator avatar alert-dialog badge calendar command dropdown-menu radio-group slider textarea
```

#### 6. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI (Gemini)
GOOGLE_AI_API_KEY=

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your@email.com

# Cron Security
CRON_SECRET=
```

#### 7. Copy Feature Code

Copy the following directories maintaining structure:

- `src/app/` - All pages and API routes
- `src/components/` - All components
- `src/features/` - All feature hooks/mutations
- `src/lib/` - Utilities
- `src/types/` - TypeScript types
- `src/hooks/` - Shared hooks
- `src/contexts/` - React contexts
- `public/` - Static assets and service worker

---

## Quick Reference Commands

```bash
# Development
pnpm dev           # Start dev server (Turbopack)

# Build
pnpm build         # Production build
pnpm start         # Start production server

# Linting
pnpm lint          # Run ESLint
pnpm typecheck     # TypeScript check

# Icons
pnpm icons         # Generate PWA icons
```

---

## Important Notes for Claude

1. **Always check existing migrations** before creating new database changes
2. **Use the established patterns** in `src/features/` for new features
3. **Follow the optimistic UI pattern** with React Query (see Common Mistakes)
4. **Test on mobile viewport** - this is a mobile-first app
5. **Add Undo to ALL toasts** - user preference
6. **Avoid red colors for items** - use theme colors
7. **Check ALL component usages** when making changes
8. **Read relevant \*.md files** for feature-specific documentation
9. **Update APP_ROUTES_ICONS.md** when adding new routes or icons - this is the central reference for all app navigation
10. **QR Code / NFC Link Naming Convention**: NEVER hardcode purpose-specific names in QR code URLs (e.g., `/qr-code-oven`, `/welcome-home`). Instead, use **generic reusable identifiers** like `/g/abc123` or `/tag/label-01`. The URL label should be a generic, human-friendly slug (e.g., `front-door`, `kitchen-1`, `living-room-a`) that does NOT reveal the current purpose. The actual purpose/behavior is stored server-side (or in config) and can be changed without regenerating the QR code. This allows laminated QR codes or permanent NFC tags to be **repurposed** — e.g., a QR code originally for the oven can later be reused for balcony flowers by simply changing the label's mapped action/page. The label value remains the same in the QR code; only the destination/config changes.

### 13. Welcome Home Guest Portal

**Files**: `src/app/g/[tag]/`, `src/components/guest/`

- Public-facing guest portal accessible via QR code / NFC tag scan
- Futuristic Jarvis-like UI with particle animations and glassmorphism
- Features: WiFi auto-connect, Dos/Don'ts, allergies entry, complaints box, real-time chat (localStorage-based)
- No authentication required — public page
- Chat uses localStorage persistence (no database)

---

_Last Updated: February 15, 2026_
