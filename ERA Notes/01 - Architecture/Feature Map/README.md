# ERA Feature Map

> **Purpose.** This folder is a navigation reference. Hand it to any AI (or human) that has no access to the codebase and they will know **exactly which files to ask for** when you want to change a feature.
>
> If you say *"I want to update the Schedule item entry form"*, the AI opens `standalone/items-and-reminders.md`, sees that the entry form lives in `src/components/items/MobileItemForm.tsx` and `src/components/reminder/MobileReminderForm.tsx`, asks for those, and proceeds. No guesswork, no spelunking.

The map does **not** duplicate architecture, hard rules, or design tokens — those already live in `CLAUDE.md`, the rest of `ERA Notes/`, and `src/app/globals.css`. This is just **"where does X live?"**

**Where this folder lives.** `ERA Notes/01 - Architecture/Feature Map/`. It is intentionally portable: if you hand the folder to a chat-only AI, the relative links between its own files stay valid and the file paths it references (`src/...`) resolve from the budget-app repo root.

---

## How to use it

### As a human
Need to change something? Open `_index.md`, find the row that matches what you're touching, jump to the linked module file. Each module file lists pages, components, hooks, API routes, DB tables, and common edit scenarios.

### As an AI without codebase access
1. Read `README.md` (this file) for the routing protocol.
2. Read `_index.md` to find the right module.
3. Read that module's MD file and ask the user for the **specific** files listed there.
4. After they paste those files, proceed with the edit. Never guess file paths — they are all listed here.

### As an AI with codebase access
1. Skim `_index.md`.
2. Open the relevant module file.
3. Read the actual source files from the paths listed. Do not re-discover them.

---

## What's in here

| File / folder            | Role                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `README.md`              | This file — the routing protocol.                                                                     |
| `_index.md`              | Master catalog. Every module, what it does in one line, link to its file, and quick "where to start". |
| `_conventions.md`        | Cross-cutting patterns (mutations, toasts, modals, query keys). Read this **once**, not per module.   |
| `standalone/`            | One MD per Standalone module (self-contained features: budget, recipes, items, etc.).                 |
| `junction/`              | One MD per Junction module (cross-module bridges: hub, AI assistant, sync, household).                |
| `cross-cutting/`         | Themes, error logs, atlas, layouts, navigation — system-wide surfaces that aren't a "feature".        |

---

## Each module file follows the same structure

```markdown
# <Module name>

**Type:** Standalone | Junction
**Routes:** /foo, /bar
**Vault doc:** ERA Notes/02 - Standalone Modules/<name>/ (the deeper architecture spec)

## What it does
One paragraph in plain English.

## Files at a glance
- **Page entry**: `src/app/<route>/page.tsx`
- **Main UI**: `src/app/<route>/<Wrapper>.tsx`
- **Components**: `src/components/<dir>/...`
- **Hooks (data + mutations)**: `src/features/<name>/...`
- **API routes**: `src/app/api/<endpoints>/route.ts`
- **DB tables**: `table_a`, `table_b`

## Common edit scenarios
- "I want to change X" → edit `<file>`
- "I want to add Y field" → edit `<file>`, then `<file>`, then update zod schema in `<file>`

## Gotchas
- Anything that would surprise an outsider.

## Connected modules
- <other-module> via <reason>
```

If a section is "n/a" it stays "n/a". Empty headers are noise.

---

## Editing the map

- When you ship a new feature or rename a directory, **update the relevant MD file in the same PR**. Out-of-date paths are worse than no paths at all.
- This map is a **navigation index**, not architecture documentation. Architecture lives in the project's `ERA Notes/` vault. Don't write essays here.
- Filenames are kebab-case slugs. Filename = module slug.
- Paths in the map are **relative to the budget-app repo root** (`src/...`, not `c:\Users\...`). The whole point is portability.
- If a feature spans Standalone + Junction territory, file it under whichever directory it lives in primarily, and cross-link from the other.

---

## Why a separate map at all (vs. just reading the codebase)

Three things make this worth maintaining:

1. **Out-of-context AI.** An AI in another tool with no access to your repo cannot grep. It needs a flat reference to read once and then ask precisely for the right file.
2. **Reading the map is O(1); discovering files is O(n).** Even with codebase access, an AI grepping for "schedule item entry" wastes round-trips when the answer is one line in this folder.
3. **The map encodes intent.** A grep finds *every* file that mentions a word. The map says *"these are the files you'd want to edit if you want to change behavior X."* That signal does not exist in raw source.
