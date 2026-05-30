---
name: new-module
description: "Scaffold a new Standalone or Junction module and keep all six index surfaces in sync (feature dir, API route, page, Feature Map, vault doc, CLAUDE.md Feature Index, Atlas). Use when the user wants to add a new module/feature to the app, e.g. \"add a parcels module\", \"scaffold a new standalone feature\", \"/new-module\". Triggers on creating a brand-new top-level feature — NOT for editing an existing one."
---

# /new-module

> Adds module #N+1 without letting docs lag code. The app's whole routing system (Feature Map → vault doc → Atlas → CLAUDE.md Feature Index) only works if a new module appears in **all** of them at once. `pnpm docs:check` (pre-commit + `pnpm sync:ai`) *fails the build* if the CLAUDE.md Feature Index and Feature Map disagree — so a half-scaffolded module blocks commits. This skill generates everything in one shot.

## When to use

Use when the user is adding a **brand-new** feature module — a new `src/features/<name>/` with its own page, API, and DB table. Examples: "add a parcels module", "scaffold a packing-list feature", "new standalone for X".

**Do NOT use** for: editing an existing module, adding a field/route to one, or pure UI components. Those follow the normal Feature-Map-first edit flow.

## What it scaffolds (6 surfaces, one command)

1. `src/features/<name>/` — `types.ts`, `queryKeys.ts`, `hooks.ts` (safeFetch + Undo-toast + household-aware patterns baked in)
2. `src/app/api/<name>/route.ts` — Zod-validated, household-link-aware GET/POST, `23505 → 409`
3. `src/app/<name>/` — thin `page.tsx` + `<Pascal>Client.tsx` (skip with `--no-page`)
4. **Feature Map** — `standalone|junction/<name>.md` + a quick-lookup intent row + a module-table row in `_index.md`
5. **Vault doc** — `02|03 .../<Title>/Overview.md` from the Feature Doc template
6. **CLAUDE.md Feature Index** — one validated row · **Atlas** — entry + `_Index` row (via `seed-atlas.mjs`)

## What you must do when invoked

### Step 1 — Read the audit rationale (once)
This skill exists because of [ERA Notes/10 - Project Management/1 - Codebase & AI Setup Audit.md](<../../../ERA Notes/10 - Project Management/1 - Codebase & AI Setup Audit.md>) §5 #3. The point is *docs never lag code*. Honor that: never hand-create a feature dir without its docs.

### Step 2 — Gather the inputs
You need these before running. Ask the user only for what's missing; infer the rest.

| Input | Flag | Required | Default |
|---|---|---|---|
| Slug (kebab-case) | `--name` | ✅ | — |
| Human title | `--title` | — | Title-cased name |
| Standalone or Junction | `--type` | — | `standalone` |
| Primary DB table | `--table` | — | `<name>` (underscored) |
| One-line description | `--one-liner` | ✅ | — |
| Quick-lookup intent phrase | `--intent` | — | `"<title>"` |
| Junction "Connects" text | `--connects` | junction only | TODO |
| No route (feature-only) | `--no-page` | — | page is created |

**Decide Standalone vs Junction deliberately** (see CLAUDE.md "Module Model"): Junction = it imports from / bridges two or more standalone feature dirs. If it's self-contained, it's Standalone. If unsure, ask the user — it changes the directory, the docs location, and the import rules.

### Step 3 — Dry-run first
Always preview before writing:

```
node scripts/new-module.mjs --name <slug> --title "<Title>" --type <standalone|junction> \
  --table <table> --one-liner "<one line>" --intent '"phrase one" / "phrase two"'
  --dry-run
```

Show the user the planned file list. The script refuses to overwrite any existing surface, so if it errors with "already exists", the module (or a name collision) is already there — stop and tell the user.

### Step 4 — Run for real
Drop `--dry-run`. The script writes all files and runs `seed-atlas.mjs` for the Atlas entry.

### Step 5 — Verify the sync gates pass
Run both and confirm green before declaring done:

```
node scripts/check-feature-index.mjs   # CLAUDE.md ↔ Feature Map must agree
pnpm sync:ai                            # regenerate AGENTS/CODEX/Copilot mirrors
```

If `check-feature-index` reports drift, the Feature Map row and the CLAUDE.md row disagree (usually a title mismatch) — reconcile the titles, don't edit `EXCLUDED_MODULES`.

### Step 6 — Hand off the manual decisions
The scaffold is intentionally a skeleton. Tell the user the remaining work the script *cannot* decide (it prints these too):
1. Add the `<table>` table **+ RLS policy** to `migrations/schema.sql` (the source of truth — Hard Rule). Hot child tables must use a SECURITY DEFINER RPC or denormalized `user_id`, never `EXISTS`-subquery RLS (Hard Rule 20).
2. Fill the Zod schema + DTO `TODO`s in `route.ts` / `types.ts`.
3. Build the real mobile-first UI in `<Pascal>Client.tsx`.
4. Fill the vault `Overview.md` Architecture/Database/Gotchas sections.

## Guardrails the scaffold already honors (don't re-add)

- Mutations use `safeFetch()`, not `fetch()` (Hard Rule 6)
- Every mutation toast has an Undo action + `ToastIcons` (Hard Rule 1)
- API GET checks `household_links` and includes partner data unless `own=true` (Hard Rule 13)
- Zod-validated input; `23505 → 409` (Hard Rules 12, 9)
- Pages are thin wrappers; logic lives in `features/` + `components/`

## Notes

- The script is **idempotent-safe**: it never overwrites, so re-running after a partial failure tells you exactly which surface already exists.
- For a feature with no user-facing route (pure hooks/util module), pass `--no-page`.
- The two index files it patches (`Feature Map/_index.md`, `CLAUDE.md`) are append-only edits anchored on stable headings — if an anchor ever moves, the script aborts loudly rather than corrupting the file.
