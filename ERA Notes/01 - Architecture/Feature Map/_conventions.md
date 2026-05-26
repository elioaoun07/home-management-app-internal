# Shared Conventions

> Read this **once**. Every module file below assumes these.

## Path alias

`@/` → `src/`. So `@/components/ui/button` is `src/components/ui/button.tsx`.

## Layering

```
src/app/<route>/             # Next.js App Router pages — thin wrappers
src/app/api/<endpoint>/      # API routes (always Zod-validated)
src/components/<area>/       # Presentational + container components
src/features/<name>/         # Hooks, mutations, query keys, types
src/lib/                     # Cross-cutting utilities (fetch, dates, supabase, stores)
src/types/                   # Shared TS types
src/contexts/                # React contexts (theme, sync, app mode, etc.)
migrations/                  # SQL — schema.sql is the source of truth
```

**Standalone feature dirs (`src/features/[name]/`) must not import from other standalone feature dirs.** Shared code goes in `src/lib/`, `src/components/`, or `src/types/`. Junction code can import from any standalone.

## Where mutations live

| What it looks like                                    | What you're looking at                     |
| ----------------------------------------------------- | ------------------------------------------ |
| `src/features/<name>/hooks.ts`                        | Standard `useFoo()` query + mutation hooks |
| `src/features/<name>/use<Thing>.ts`                   | Single-purpose hook                        |
| `src/features/<name>/queryKeys.ts`                    | Feature-scoped query key factory           |
| `src/lib/queryKeys.ts` (`qk.*`)                       | Cross-cutting query keys                   |
| `src/lib/queryConfig.ts`                              | `staleTime` constants (BALANCE=5m etc.)    |

A typical pattern: hook calls `safeFetch()` → mutates server → invalidates a `qk.*` query key → optimistic update.

## Hard rules that affect what you write (full list in root `CLAUDE.md`)

1. **Every toast that mutates data has an `Undo` action**, using `ToastIcons` from `src/lib/toastIcons.tsx` and a 4000 ms duration.
2. **Single click** = open detail · **Double click** = toggle pin/favorite.
3. **No red on individual rows.** Containers can use red/amber, rows use theme colors.
4. **Mobile-first.** Always verify viewport.
5. **Never `fetch()` mutations.** Always `safeFetch()` from `src/lib/safeFetch.ts`. Pass `timeoutMs` for long calls (AI, uploads).
6. **Never `navigator.onLine`.** Use `isReallyOnline()` from `src/lib/connectivityManager.ts`.
7. **Floating panels must be opaque.** Use `tc.bgPage` from `useThemeClasses()`, not `neo-card`.
8. **Fixed/sticky headers** require matching content top padding (e.g. `pt-14` under `h-14`).
9. **`type="number"` is banned on mobile inputs.** Use `type="text"` + `inputMode="decimal"`.
10. **Zod for all API input.** Derive TS types with `z.infer<>`.
11. **Household linking:** API routes that fetch user data must check `household_links` and include the partner's data unless `ownOnly=true` is passed.
12. **Color identity is person-absolute.** Same person = same color on every device.
13. **No `console.log` in committed code.** Use the Error Logs module or `src/lib/logger.ts`.
14. **`23505` (unique violation) → 409 Conflict**, not 500.
15. **Cron routes** verify `Bearer CRON_SECRET`, use `supabaseAdmin()`, set `maxDuration = 60`.
16. **Never edit `src/components/ui/`.** A pre-tool hook blocks it.
17. **Theme changes invalidate ALL queries.** Use `--theme-bg` CSS variable, never hardcode bg colors.

## Supabase clients

| Client                  | Where                              | Use for                                 |
| ----------------------- | ---------------------------------- | --------------------------------------- |
| `supabaseBrowser()`     | `src/lib/supabase/client.ts`       | Browser code, realtime subscriptions    |
| `supabaseServer()`      | `src/lib/supabase/server.ts`       | API routes + RSC, user-scoped queries   |
| `supabaseAdmin()`       | `src/lib/supabase/admin.ts`        | Cron, batch ops, service-role only      |

Never mix them. Each file should import exactly one.

## Modals / sheets / drawers

Conventions used across the app:

- **Dialog** (`src/components/ui/dialog`): centered modal, full overlay. Used for confirmations and short forms.
- **Drawer** (`src/components/ui/drawer`): slides from edge. Used for longer forms (new account, drafts).
- **Sheet** (`src/components/ui/sheet`): bottom sheet on mobile. Used for action menus and detail views.
- **ActionsSheet** suffix (e.g. `ItemActionsSheet`, `ChoreActionsSheet`): swipe / long-press menu for a single row.

Anything floating above content **must be opaque** — see Hard Rule #7 above.

## Schema / DB

- **`migrations/schema.sql` is the source of truth.** Read it before writing SQL.
- DB changes happen via SQL run manually in Supabase SQL Editor, then `schema.sql` updated and the change documented in the feature's vault doc.
- Every new table needs RLS policies.
- Hot child tables (item_alerts, item_subtasks, etc.) **never** use `EXISTS`-subquery RLS — they use SECURITY DEFINER RPC bundles or denormalized `user_id` columns. See Hard Rule #20 and `get_schedule_bundle` for the canonical pattern.

## Where shared bits live

| Concern                    | File                                                  |
| -------------------------- | ----------------------------------------------------- |
| Network fetch (mutations)  | `src/lib/safeFetch.ts`                                |
| Online detection           | `src/lib/connectivityManager.ts`                      |
| Offline queue (new code)   | `src/lib/offlineQueue.ts` (IndexedDB)                 |
| Offline queue (legacy)     | `src/contexts/SyncContext.tsx` (localStorage, hub only) |
| Toast icons                | `src/lib/toastIcons.tsx`                              |
| Theme tokens runtime       | `src/contexts/ThemeContext.tsx` + `useThemeClasses()` |
| Date helpers + DST + UTC   | `src/lib/utils/date.ts`                               |
| Balance math               | `src/lib/balance-utils.ts`                            |
| Query key factory          | `src/lib/queryKeys.ts` (root) + per-feature `queryKeys.ts` |
| Cache `staleTime` constants| `src/lib/queryConfig.ts`                              |
| Logging (dev-guarded)      | `src/lib/logger.ts` (if present) — never raw `console.*` |
| Offline pending store      | `src/lib/stores/offlinePendingStore.ts`               |

## Common file naming

| Suffix / pattern              | Meaning                                            |
| ----------------------------- | -------------------------------------------------- |
| `MobileFooForm.tsx`           | Mobile-optimized form (drawer/sheet layout)        |
| `FooDrawer.tsx`               | Slide-in drawer surface                            |
| `FooSheet.tsx`                | Bottom sheet                                       |
| `FooDialog.tsx`               | Centered modal                                     |
| `FooActionsSheet.tsx`         | Row long-press / swipe action menu                 |
| `FooClientWrapper.tsx`        | Bridges server-rendered route to client tree       |
| `WebFoo.tsx` in `components/web/` | Desktop / wide-viewport variant of a feature   |

## Testing the routing protocol

If you can answer this question by reading **only** the relevant module's MD file (no source needed), the map is doing its job:

> "Where is the schedule item entry form, and what do I edit if I want to add a new field to it?"

Answer should be: open `standalone/items-and-reminders.md`, find the "Common edit scenarios" section, follow the bullets. Each bullet names the file to edit and (if any) the schema or hook to update alongside it.
