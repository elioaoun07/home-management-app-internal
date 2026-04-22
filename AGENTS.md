# AGENTS.md

> Quick-reference for AI coding agents. For full project rules, read `CLAUDE.md`. For feature docs, read `ERA Notes/`.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack) + React 19
- **Language:** TypeScript (strict mode)
- **State:** TanStack React Query 5 + Zustand 5
- **DB:** Supabase (Postgres + Auth + Realtime + RLS)
- **Styling:** TailwindCSS 4 + Radix UI + shadcn/ui
- **AI:** Google Gemini (`@google/genai`)
- **Path alias:** `@/*` → `src/*`
- **Package manager:** pnpm
- **Validation:** Run `pnpm typecheck` after every change

---

## File Placement Rules

```
src/
├── app/api/[module]/route.ts   ← API routes (Next.js App Router)
├── app/[page]/page.tsx         ← Page components
├── features/[module]/          ← Standalone module hooks (NO cross-feature imports)
│   └── hooks.ts                ← Query + mutation hooks only
├── components/[domain]/        ← UI components (NEVER edit components/ui/)
├── lib/                        ← Shared utilities (available to all modules)
├── types/                      ← Shared TypeScript types
└── contexts/                   ← React contexts (use Safe variants outside providers)
```

### Import Rules (Critical)

```
✅ feature/accounts/ → import from @/lib/, @/types/, @/components/
✅ feature/accounts/ → import from @tanstack/react-query, zustand, etc.
❌ feature/accounts/ → import from @/features/transactions/  (FORBIDDEN)
❌ feature/accounts/ → import from @/features/items/          (FORBIDDEN)

✅ Junction modules (hub, shopping-list, meal-planning) CAN import from any feature
```

---

## Code Templates

### New API Route

```ts
// src/app/api/[module]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Household linking — include partner's data
  let userIds: string[] = [user.id];
  const ownOnly = req.nextUrl.searchParams.get("own") === "true";
  if (!ownOnly) {
    const { data: link } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id, active")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const partnerId = link
      ? link.owner_user_id === user.id
        ? link.partner_user_id
        : link.owner_user_id
      : null;
    if (partnerId) userIds = [user.id, partnerId];
  }

  const { data, error } = await supabase
    .from("TABLE_NAME")
    .select("*")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });

  if (error) {
    // Unique constraint violation → 409
    if ((error as any).code === "23505") {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schema = z.object({
    name: z.string().min(1),
    // ... fields
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("TABLE_NAME")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

### New Feature Hook

```ts
// src/features/[module]/hooks.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import type { YourType } from "@/types/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function fetchItems(): Promise<YourType[]> {
  const res = await fetch("/api/your-module");
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

export function useItems() {
  return useQuery({
    queryKey: qk.yourKey(),
    queryFn: fetchItems,
    staleTime: CACHE_TIMES.ACCOUNTS, // pick appropriate cache time
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
```

### Mutation with Undo Toast (Required Pattern)

```ts
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { toast } from "sonner";

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await safeFetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: qk.yourKey() });
      toast.success("Item deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await safeFetch("/api/items/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
              });
              queryClient.invalidateQueries({ queryKey: qk.yourKey() });
              toast.success("Restored");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
  });
}
```

### Cron Route

```ts
// src/app/api/cron/[job]/route.ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  // Use admin client — NOT supabaseServer()
  // ... cron logic

  return NextResponse.json({ success: true });
}
```

---

## Supabase Client Selection

| Client              | Import                  | Use For                                            |
| ------------------- | ----------------------- | -------------------------------------------------- |
| `supabaseServer()`  | `@/lib/supabase/server` | API routes, RSC — respects RLS via user cookies    |
| `supabaseBrowser()` | `@/lib/supabase/client` | Client components, realtime subscriptions          |
| `supabaseAdmin()`   | `@/lib/supabase/admin`  | Cron jobs, batch ops — bypasses RLS (service role) |

**Never mix these.** Never use `supabaseAdmin()` in API routes unless it's a cron job.

---

## Query Keys & Cache Times

```ts
import { qk } from "@/lib/queryKeys"; // qk.accounts(), qk.categories(), etc.
import { CACHE_TIMES } from "@/lib/queryConfig";

// Cache durations:
// BALANCE    = 5 min     TRANSACTIONS = 2 min
// ACCOUNTS   = 1 hour    CATEGORIES   = 1 hour
// RECURRING  = 30 min    DRAFTS       = 1 min
// PREFERENCES = 1 hour   PERMANENT    = 24 hours
```

**Never** inline query key arrays like `["accounts"]`. Always use `qk.*` or feature-scoped `queryKeys.ts`.

---

## Common Mistakes (Avoid These)

### 1. Using `fetch()` for mutations

```ts
// ❌ WRONG — no offline check, no timeout
const res = await fetch("/api/items", { method: "POST", ... });

// ✅ CORRECT — pre-flight online check, 3s timeout, calls markOffline() on failure
const res = await safeFetch("/api/items", { method: "POST", ... });
```

### 2. Trusting `navigator.onLine`

```ts
// ❌ WRONG — unreliable, often lies
if (navigator.onLine) { ... }

// ✅ CORRECT — probes /api/health every 30s
import { isReallyOnline } from "@/lib/connectivityManager";
if (await isReallyOnline()) { ... }
```

### 3. Missing Undo on toasts

```ts
// ❌ WRONG — every toast MUST have an undo action
toast.success("Deleted");

// ✅ CORRECT
toast.success("Deleted", {
  icon: ToastIcons.delete,
  duration: 4000,
  action: { label: "Undo", onClick: () => undoMutation.mutate(...) },
});
```

### 4. Hardcoding background colors

```ts
// ❌ WRONG — breaks on theme change
className = "bg-zinc-900";

// ✅ CORRECT — uses theme CSS variable
className = "bg-[var(--theme-bg)]";
```

### 5. Editing shadcn/ui components

```
// ❌ NEVER edit files in src/components/ui/
// These are auto-generated by shadcn CLI

// ✅ Create wrapper components in src/components/[domain]/ instead
```

### 6. Cross-feature imports (standalone modules)

```ts
// ❌ WRONG — standalone features cannot import from each other
// In src/features/accounts/hooks.ts:
import { useTransactions } from "@/features/transactions/hooks";

// ✅ Move shared code to src/lib/ or src/types/
```

### 7. Returning 500 for unique constraint violations

```ts
// ❌ WRONG
if (error) return NextResponse.json({ error: error.message }, { status: 500 });

// ✅ CORRECT — check for Postgres unique violation code
if ((error as any).code === "23505") {
  return NextResponse.json({ error: "Already exists" }, { status: 409 });
}
```

### 8. Using wrong Supabase client

```ts
// ❌ WRONG — supabaseAdmin in regular API route (bypasses RLS!)
import { supabaseAdmin } from "@/lib/supabase/admin";

// ✅ CORRECT — supabaseServer respects user session + RLS
import { supabaseServer } from "@/lib/supabase/server";
const supabase = await supabaseServer(await cookies());
```

### 9. Color identity confusion (role-relative vs person-absolute)

```ts
// ❌ WRONG — hardcoding "current user = blue" regardless of who's logged in
const myColor = "blue-400";
const partnerColor = "pink-400";

// ✅ CORRECT — derive from theme (person-absolute)
// Blue-theme user is ALWAYS blue on both phones.
// Pink-theme user is ALWAYS pink on both phones.
const { theme } = useTheme();
const myColor = theme === "pink" ? "pink-400" : "blue-400";
const partnerColor = theme === "pink" ? "blue-400" : "pink-400";
```

### 10. Using `type="number"` on mobile inputs

```tsx
// ❌ WRONG — iOS scroll-wheel bug, inconsistent decimal handling
<input type="number" value={amount} />

// ✅ CORRECT — proper mobile numeric keyboard without iOS quirks
<input type="text" inputMode="decimal" value={amount} />
```

---

## Schema Quick Reference

> Full schema: `migrations/schema.sql` (1122 lines). For live schema access, use the Supabase MCP server.

### Finance

| Table                | Key Columns                                                                                                                  | Notes                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `accounts`           | `id`, `user_id`, `name`, `type` (income/expense/saving), `position`, `visible`                                               | Type affects balance direction |
| `account_balances`   | `account_id` (UNIQUE), `user_id`, `balance` (numeric, default 0)                                                             | One-to-one with accounts       |
| `transactions`       | `id`, `user_id`, `account_id`, `category_id`, `subcategory_id`, `date`, `amount`, `description`, `is_draft`, `is_private`    | `amount` is always positive    |
| `user_categories`    | `id`, `user_id`, `account_id`, `name`, `color`, `parent_id` (self-FK), `position`, `visible`                                 | Hierarchical categories        |
| `transfers`          | `from_account_id`, `to_account_id`, `amount` (>0), `transfer_type` (self/household), `fee_amount`, `returned_amount`         |                                |
| `recurring_payments` | `account_id`, `category_id`, `name`, `amount`, `recurrence_type` (daily/weekly/monthly/yearly), `next_due_date`, `is_active` |                                |
| `budget_allocations` | `category_id`, `account_id`, `assigned_to` (user/partner/both), `monthly_budget`, `budget_month`                             |                                |
| `debts`              | `transaction_id`, `debtor_name`, `original_amount`, `returned_amount`, `status` (open/archived/closed)                       |                                |

### Items / Reminders

| Table                   | Key Columns                                                                                                                          | Notes                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `items`                 | `id`, `user_id`, `responsible_user_id`, `type`, `title`, `priority`, `status`, `categories` (array), `subtask_kanban_stages` (jsonb) | Core task/reminder/event entity |
| `reminder_details`      | `item_id` (FK), `due_at`, `completed_at`, `estimate_minutes`                                                                         | One-to-one with items           |
| `event_details`         | `item_id` (FK), `start_at`, `end_at`, `all_day`, `location_text`                                                                     | One-to-one with items           |
| `item_subtasks`         | `parent_item_id`, `title`, `done_at`, `order_index`, `kanban_stage`                                                                  | Nested subtasks                 |
| `item_alerts`           | `item_id`, `kind`, `trigger_at`, `offset_minutes`, `channel` (push), `active`                                                        |                                 |
| `item_recurrence_rules` | `item_id`, `rrule`, `start_anchor`                                                                                                   | iCal RRULE format               |

### Hub / Chat

| Table                 | Key Columns                                                                                                                 | Notes |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| `hub_chat_threads`    | `household_id`, `created_by`, `title`, `purpose` (general/budget/shopping/...), `is_archived`                               |       |
| `hub_messages`        | `thread_id`, `sender_user_id`, `message_type` (text/system/transaction/...), `content`, `source` (user/inventory/system/ai) |       |
| `hub_message_actions` | `message_id`, `action_type` (transaction/reminder/forward/pin)                                                              |       |

### Household / Users

| Table              | Key Columns                                                                    | Notes                               |
| ------------------ | ------------------------------------------------------------------------------ | ----------------------------------- |
| `household_links`  | `code` (UNIQUE), `owner_user_id`, `partner_user_id`, `active`                  | Partner linking                     |
| `profiles`         | `id` (FK to auth.users), `full_name`                                           |                                     |
| `user_preferences` | `user_id`, `theme`, `section_order` (jsonb), `date_start`, `lbp_exchange_rate` | LBP rate in thousands (90 = 90,000) |

### Other

| Table              | Key Columns                                                                                                | Notes |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ----- |
| `recipes`          | `user_id`, `name`, `ingredients` (jsonb), `steps` (jsonb), `difficulty` (easy/medium/hard), `tags` (array) |       |
| `catalogue_items`  | `module_id`, `category_id`, `name`, `status`, `priority`, `metadata_json` (jsonb)                          |       |
| `inventory_stock`  | `item_id` (FK), `quantity_on_hand`, `auto_add_to_shopping`                                                 |       |
| `notifications`    | `user_id`, `title`, `source`, `priority`, `push_status`, `severity`                                        |       |
| `meal_plans`       | `recipe_id`, `planned_date`, `meal_type` (breakfast/lunch/dinner/snack), `status`                          |       |
| `future_purchases` | `name`, `target_amount`, `current_saved`, `urgency` (1-5), `status`, `allocations` (jsonb)                 |       |

---

## Custom Month Start

Users set a billing cycle start day (1–31). Use `startOfCustomMonth(date, monthStartDay)` from `src/lib/utils/date.ts`, not calendar months.
