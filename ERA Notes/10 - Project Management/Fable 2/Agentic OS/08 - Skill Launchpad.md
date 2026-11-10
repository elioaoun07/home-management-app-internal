---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed design. The input lists are read from the existing SKILL.md files; no form file exists yet."
---

# Agentic OS — skill launchpad

[Agentic OS index](<_index.md>) · [Deterministic evaluation](<07 - Deterministic Evaluation.md>) · next: [PM.2 product design](<09 - PM.2 Product Design.md>) · item: [R98](<../../PM Tooling/PM Tooling — Master Book.md#r98>)

## The problem

All 18 skills carry only `name` and `description` in frontmatter. What a skill needs from the owner is written as prose inside it. `new-module` has a table of eight inputs with flags, defaults and one conditional field; `era-wire` needs an item ID; `db-migration` needs a description and a kind; `triage-inbox` needs nothing. To use one, the owner remembers the skill exists, types its name, and answers the agent's questions one turn at a time. Each answer costs a turn, and a wrong answer is found after tokens are spent.

## The idea

Each skill may ship a small machine-readable form beside its `SKILL.md`. PM.2 renders it, validates it, and launches the skill with every input already answered.

```text
.claude/skills/new-module/
  SKILL.md        unchanged: the playbook the agent follows
  form.json       new: what the owner must supply
```

A sidecar file is used, not new frontmatter keys, so nothing depends on how any agent treats frontmatter it does not recognise.

## `form.json`

Shown for the real `new-module` skill, whose inputs are already listed in its Step 2 table:

```json
{
  "skill": "new-module",
  "title": "New module",
  "summary": "Scaffold a module and its six index surfaces",
  "tier": "CLAUDE_MID",
  "effort": "default",
  "launch": "worktree",
  "fields": [
    { "id": "name", "label": "Slug", "type": "slug", "required": true, "pattern": "^[a-z0-9-]+$" },
    { "id": "title", "label": "Title", "type": "text", "default": { "from": "name", "transform": "titleCase" } },
    { "id": "type", "label": "Type", "type": "enum", "options": ["standalone", "junction"], "default": "standalone" },
    { "id": "connects", "label": "Connects", "type": "modules", "showIf": { "type": "junction" }, "required": true },
    { "id": "table", "label": "Table", "type": "text", "default": { "from": "name", "transform": "snakeCase" } },
    { "id": "oneLiner", "label": "One line", "type": "text", "required": true, "maxLength": 140 },
    { "id": "intent", "label": "Lookup phrase", "type": "text", "default": { "from": "title" } },
    { "id": "noPage", "label": "No page", "type": "boolean", "default": false }
  ],
  "checks": [
    { "kind": "notExists", "path": "src/features/{name}" },
    { "kind": "notInFeatureIndex", "value": "{name}" }
  ],
  "preview": { "command": "node scripts/new-module.mjs --name {name} --type {type} --dry-run" },
  "prompt": "/new-module name={name} title=\"{title}\" type={type} table={table} one-liner=\"{oneLiner}\" intent=\"{intent}\"{noPage? no-page}{connects? connects=\"{connects}\"}"
}
```

## Field types

| Type | Renders as | Validates |
|---|---|---|
| `text`, `multiline` | Input, textarea | Length, pattern |
| `slug` | Input with live kebab-case | Pattern, uniqueness check |
| `enum` | Segmented control | Membership |
| `boolean` | Switch | n/a |
| `item` | Picker over open checklist items | The ID exists and is open |
| `module`, `modules` | Picker over the Feature Index | Membership; junction rules |
| `path` | File picker limited to the repository | Exists, or must not exist |
| `tier` | Picker over the Model Registry | Not disabled |
| `date` | Date in the owner's time zone | n/a |

Pickers read the [registry](<03 - Setup Registry.md>) and the PM scan, so a form can never offer a module or an item that does not exist.

## What launching does

| Step | Detail |
|---|---|
| 1. Validate | Required fields, patterns, the form's `checks`. Nothing launches while one fails |
| 2. Preview | If the skill names a dry-run command, run it and show the planned file list. `new-module` already instructs "dry-run first"; the form makes it automatic |
| 3. Choose where | Worktree (default, the [Local lane](<../10 - Project Management/Delivery/2 - Local Lane Design.md>)), current checkout, or copy only |
| 4. Choose who | Tier and effort, pre-filled from the form and overridable. Stored as the alias; resolved to a selector at launch |
| 5. Launch | Start a native session with the rendered prompt, or copy it to the clipboard |
| 6. Record | The launch (skill, values, tier, setup fingerprint) opens a [flight report](<06 - Flight Recorder.md>) |

Until the Local lane exists (DLV-150), step 5 offers **Copy prompt** and **Copy command** only. That alone removes the question-and-answer turns, and needs no launcher.

## First forms to write

| Skill | Fields | Why first |
|---|---|---|
| `new-module` | 8, listed above | Already has the table and a dry-run script |
| `era-wire` | `item` (a HUB item under ERA reports) | One field; the skill is designed as a cheap repeatable lane |
| `fix-bug` | `item` or free text; module; reproduction; expected | Most frequent task |
| `add-feature` | `item`; module; acceptance | Second most frequent |
| `db-migration` | description; kind (table, column, index, policy, RPC, enum); tables | Guards rule 24 at the source |
| `triage-inbox` | none | A one-click launch |
| `data-repair` | repair class (SQL, browser storage, balance); symptom | The class decides which section of the skill applies |
| `wizard` | system; goal | |

Skills that are knowledge, not procedures (`money-rules`, `ui-guardrails`, `cache-invalidation`, `timezone-handling`, `recurrence-safety`, `api-route`), get no form. On the Launchpad they appear as **attachments**: tick them to preload with any launch, with the ones the target paths require ticked automatically from the `requires` table.

## Beyond single skills: recipes

A recipe is a saved launch: skill, some fixed values, attachments, tier. Examples the current setup already suggests: "ERA report, low cost" (`era-wire`, `CLAUDE_MID`, medium); "Money bug" (`fix-bug` + `money-rules` + `api-route`, `CLAUDE_HIGH`); "Second opinion" (review prompt, `CODEX_MID`, effort high, read-only). Recipes are files under `.claude/recipes/`, so they are versioned and show in the registry.

## Checks the registry gains

- A skill whose text contains an inputs table but has no `form.json`: `FORM-MISSING` (info).
- A form field that the skill text never mentions, or the reverse: `FORM-DRIFT` (warning).
- A form or skill that names a model instead of a tier alias: `era-wire` currently says "Sonnet 5.5, medium effort", which the Model Registry's own rule forbids (`TIER-LITERAL`, warning).

## What it deliberately does not do

- It does not change how a skill works when typed by hand. The form is an optional front door.
- It does not hide the prompt. The rendered text is always shown before launch.
- It does not invent skills. A form exists only for a skill that exists.
