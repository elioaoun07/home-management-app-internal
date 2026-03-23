---
applyTo: "src/app/api/**/*.ts"
description: "Use when creating or editing API routes. Covers auth, Zod validation, Supabase client selection, household linking, error handling, and cron patterns."
---

# API Route Conventions

## Route Structure

1. `export const dynamic = "force-dynamic"` at top
2. Auth check → `supabaseServer(await cookies())` → `getUser()`
3. Return 401 if no user
4. Zod parse request body (POST/PUT/PATCH)
5. Household linking — check `household_links` for partner data (unless `?own=true`)
6. DB operation via Supabase client
7. Error handling: `23505` → 409 Conflict, others → 500

## Supabase Client Rules

- **Regular routes:** `supabaseServer()` — respects RLS via user cookies
- **Cron routes:** `supabaseAdmin()` — bypasses RLS, requires `Bearer CRON_SECRET` auth check + `export const maxDuration = 60`
- **NEVER** use `supabaseAdmin()` in non-cron routes
- **NEVER** use `supabaseBrowser()` in API routes

## Household Linking Pattern

```ts
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
```

## Validation

- Use Zod schemas for ALL request body validation
- Derive TypeScript types with `z.infer<>`
- Return 400 with `parsed.error.flatten()` on validation failure

## Response Headers

- GET routes: `{ "Cache-Control": "no-store" }` (force-dynamic already set)

## Reference Implementation

See `src/app/api/accounts/route.ts` for the canonical pattern.
