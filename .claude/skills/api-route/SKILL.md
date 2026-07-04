---
name: api-route
description: "Recipe + verified template for API routes in this repo: Supabase client selection, auth → Zod → household linking → DB → error mapping (23505→409), plus the cron-route variant. Use when creating or editing anything under src/app/api/."
---

# /api-route — API Route Recipe

> **Contract:** every route you write follows the canonical shape below — same order, same status codes. The canonical living example is `src/app/api/accounts/route.ts` (user route) and `src/app/api/cron/purge-recycle-bin/route.ts` (cron route). When in doubt, open them and copy; do not improvise middleware, wrappers, or new error formats.

## Step 0 — Pick the right Supabase client (get this wrong = security bug)

| Client | Import | Use for | Never |
|---|---|---|---|
| `supabaseServer(await cookies())` | `@/lib/supabase/server` | ALL user-facing API routes / RSC — runs as the logged-in user, RLS applies | — |
| `supabaseAdmin()` | `@/lib/supabase/admin` | Cron + batch/service ops ONLY — service role, **bypasses RLS** | Never in a user-facing route; never mix with the server client in one handler |
| browser client | `@/lib/supabase/client` | Client components (realtime) | Never in API routes |

## The canonical user-route shape (verified against `src/app/api/accounts/route.ts`)

```ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic"; // disable caching

// 1. Zod schema at top — derive types with z.infer, validate EVERYTHING inbound
const createThingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["a", "b"]),
  optional_flag: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  // 2. Auth first — always this exact gate
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 3. Validate — safeParse, 400 with flatten() on failure
    const parsed = createThingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // 4. DB op — user_id always from the session, NEVER from the request body
    const { data, error } = await supabase
      .from("things")
      .insert({ user_id: user.id, ...parsed.data })
      .select()
      .single();

    // 5. Error mapping — unique violation is a client error, not a 500
    if (error) {
      if ((error as any).code === "23505") {
        return NextResponse.json({ error: "Thing already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to create thing" }, { status: 500 });
  }
}
```

### Status-code contract

| Situation | Status |
|---|---|
| No session user | 401 |
| Zod parse failure | 400 + `parsed.error.flatten()` |
| Duplicate / unique violation (`error.code === "23505"`) | 409 (Hard Rule 9) |
| Row genuinely not found (single-resource GET/PATCH/DELETE) | 404 |
| Any other DB error | 500 + `error.message` |

## GET routes for user-owned data — household linking (Hard Rule 13)

Any GET that returns user-owned rows must ALSO return the active household partner's rows unless the caller passes `?own=true`. Copy the pattern from `fetchAccountList` in `src/app/api/accounts/route.ts:25-82`:

- Partner id via `getActiveHouseholdPartnerId(supabase, userId)` from `@/lib/accountAccess`.
- Visibility semantics used by accounts (reuse the vocabulary, don't invent new flags): default = partner's `is_public` rows only; `?household=true` = all partner rows (dashboard); `?own=true` = skip partner entirely (entry forms).
- Return partner rows merged with own rows; the client renders ownership by `user_id` (person-absolute colors — see ui-guardrails).

## Cron routes (verified against `src/app/api/cron/purge-recycle-bin/route.ts`)

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = supabaseAdmin();
  // ...batch work; return a JSON summary of what was processed
}
```

All three lines are mandatory: `maxDuration`, the Bearer check, `supabaseAdmin()` (Hard Rule 8). Register the schedule in `vercel.json` crons.

## Performance rules (these are correctness rules here)

1. **Parent + N child tables on a hot read path → ONE `get_*_bundle()` SECURITY DEFINER RPC**, not N PostgREST calls. Each extra call costs ~170–200 ms of floor latency (Hard Rule 21). Canonical: `get_schedule_bundle` (`migrations/2026-05-11_schedule_bundle_rpc.sql`).
2. No per-row queries in loops on request paths (seed/one-time flows like account seeding are the tolerated exception).
3. Long external calls (AI, third-party APIs) inside a route: remember the **client** calling this route must pass `timeoutMs` to `safeFetch` — say so in your handoff notes when you add such a route.

## Checklist before leaving this skill

- [ ] Correct client for the route type (server vs admin)
- [ ] Auth gate first; `user_id` from session only
- [ ] Zod schema validates body AND meaningful query params; types via `z.infer`
- [ ] 401 / 400-flatten / 409-on-23505 / 500 mapping in place
- [ ] Household partner data included on user-owned GETs (or `own=true` documented)
- [ ] Every table/column used exists in `migrations/schema.sql` (you read it)
- [ ] No secrets/service errors leaked in response bodies; `Cache-Control: no-store` on user data
- [ ] Cron variant: `maxDuration = 60` + Bearer `CRON_SECRET` + `supabaseAdmin()`
