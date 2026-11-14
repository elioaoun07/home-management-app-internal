---
name: add-feature
description: "Playbook for adding a feature or behavior to an EXISTING module — plan the vertical slice, then build in order: DB → API → types → hooks → UI → wiring, each layer from this repo's canonical patterns. Use for 'add X to module Y' tasks. For a brand-new top-level module use new-module instead. NOT for bug fixes (use fix-bug)."
---

# /add-feature — Feature in an Existing Module

> **Contract:** you build in slice order (DB → API → types → hooks → UI → wiring) and you do not start a layer until the one below it exists and typechecks. Every layer copies its shape from the named canonical file — you are assembling proven parts, not designing from memory.

Prerequisite: `start-task` protocol done (task restated, module located via Feature Map, vault doc + gotchas read). If the module is a **Junction**, you have also read every connected standalone's vault doc.

## Step 1 — Write the slice plan (show it before editing)

```
FEATURE: <one sentence>
MODULE: <name> (<standalone|junction>) — vault doc read: yes
DB:    <none | table/column changes>            → db-migration skill
API:   <none | routes to add/modify>            → api-route skill
TYPES: <zod schema + TS types touched>
HOOKS: <queries/mutations to add>               → cache-invalidation skill
UI:    <components/pages touched>               → ui-guardrails skill
DOCS:  <vault doc sections, Atlas if new page>  → finish-task
```

Rules of scope:
- New files go inside the module's existing directories (check the Feature Map file for where things live in THIS module — some modules keep hooks in `hooks.ts`, others in `hooks/`).
- A standalone module must not import from another standalone. Cross-module needs → `src/components/`, `src/lib/`, `src/types/`, or reconsider: is this actually junction work?

## Step 2 — DB layer (only if needed)

Follow `.claude/skills/db-migration/SKILL.md` completely (migration file FIRST, then `migrations/schema.sql`, RLS decision tree). Do not write a single Supabase query against a column you haven't verified in `schema.sql`.

## Step 3 — API layer

Follow `.claude/skills/api-route/SKILL.md`. Canonical file: `src/app/api/accounts/route.ts`.

## Step 4 — Types

- API input types come from Zod: define the schema in the route, derive with `z.infer<typeof schema>`.
- Domain types shared across layers: check `src/types/` and the module's `types.ts` for an existing type **before creating one** (`Grep` the type name). Extend, don't duplicate.

## Step 5 — Hooks (queries + mutations)

Canonical files to imitate — read the relevant one now:
- **Queries:** `src/features/accounts/hooks.ts`
- **Mutations with Undo toasts:** `src/features/trips/hooks.ts`

Non-negotiable rules, with the verified shapes:

1. **Query keys — never inline arrays.** Use `qk.*` from `src/lib/queryKeys.ts` or the module's own `queryKeys.ts`. Note there are TWO central factories (`qk` in `src/lib/queryKeys.ts`, and `queryKeys` in `src/lib/queryConfig.ts` for balance/transactions/preferences) — reuse whichever this module already uses; do not introduce a third style.
2. **`staleTime` from `CACHE_TIMES`** (`src/lib/queryConfig.ts`) — pick the existing constant that matches the data's change frequency; don't invent numbers.
3. **Reads** may use plain `fetch` in `queryFn`, but must throw on `!res.ok` with the body text (see `fetchAccounts` in accounts hooks).
4. **Mutations must use `safeFetch`** (`src/lib/safeFetch.ts`), never `fetch`. Any call that can exceed ~5 s (AI, uploads, external APIs) MUST pass `{ timeoutMs: 60_000 }` or similar — otherwise the default timeout aborts it and falsely flags the app offline via `markOffline()`.
5. **Every success toast has an Undo action** (Hard Rule 1). Verified pattern from `src/features/trips/hooks.ts`:

```ts
import { ToastIcons } from "@/lib/toastIcons";
import { toast } from "sonner";

onSuccess: (created) => {
  qc.invalidateQueries({ queryKey: <the module's key factory>() });
  const undo = () => { /* inverse mutation, then invalidate again */ };
  toast.success("Thing created", {
    icon: ToastIcons.create,          // .create | .update | .delete | .error
    duration: 4000,
    action: { label: "Undo", onClick: undo },
  });
},
onError: () => toast.error("Failed to create thing", { icon: ToastIcons.error }),
```

6. **Invalidation:** follow `.claude/skills/cache-invalidation/SKILL.md`. List every query key that *displays* the mutated data and invalidate all of them. Anything balance-affecting → `invalidateAccountData(queryClient, accountId?)` from `src/lib/queryInvalidation.ts`.
7. **Dates in payloads:** follow `.claude/skills/timezone-handling/SKILL.md` (`localToISO`, never naive strings).
8. **Offline support:** if the mutation must queue offline, use `src/lib/offlineQueue.ts` (IndexedDB) and read `ERA Notes/01 - Architecture/Sync and Offline.md` first. Never add to the legacy localStorage queue in `SyncContext` (hub shopping list only).

## Step 6 — UI layer

Follow `.claude/skills/ui-guardrails/SKILL.md` for every component you touch. Structure rules:
- Pages (`src/app/<route>/page.tsx`) stay thin — logic lives in the feature dir / components.
- Reuse the module's existing components and layout idioms — open a sibling component and match its style, spacing, and theme-class usage before writing your own.

## Step 7 — Wire up & prove it works

1. `pnpm typecheck` and `pnpm lint` → clean.
2. Run the app (`pnpm dev`) and exercise the DONE-WHEN behavior from your task restatement — including the mobile viewport (Hard Rule 5).
3. Test the unhappy paths you built: duplicate create (expect 409 handling), offline mutation (expect queue/toast behavior), partner-visibility if household data is involved.
4. If this added a page/route/tab: Atlas entry is mandatory (covered in finish-task, Hard Rule 23).

## Step 8 — Close out

Run `.claude/skills/finish-task/SKILL.md` (greps, docs, PM Command Center update — feature ✅ in file 1, `[x]` in file 4, `*(IMPLEMENTED YYYY-MM-DD)*` in file 2).
