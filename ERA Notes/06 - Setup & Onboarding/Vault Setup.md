---
type: setup
updated: 2026-11-11
tags:
  - type/setup
  - scope/obsidian
---

# Vault Setup and Structure

All project documentation lives in the **`ERA Notes/`** Obsidian vault at the repository root. [Home](<../00 - Home/Home.md>) is the front door. This page is the standard: where each kind of document belongs, and what happens to it when it stops being current.

## Structure

```
ERA Notes/
├── 00 - Home/                 Home (front door) + Module Index (Dataview)
├── 01 - Architecture/         cross-cutting rules and patterns
│   └── Feature Map/           user intent → exact source files
├── 02 - Standalone Modules/   one folder per standalone module
├── 03 - Junction Modules/     one folder per junction module
├── 04 - UI & Design/          routes, icons, patterns
│   └── Page & Feature Atlas/  one entry per page/feature (feeds the in-app atlas)
├── 05 - Performance/
├── 06 - Setup & Onboarding/
├── 07 - Backlog & Ideas/      vision and ideas; never a queue
├── 08 - Sessions/             wizard and session notes (gitignored)
├── 10 - Project Management/   the backlog: campaigns, plans, research, its own _Archive
├── Templates/
├── _Archive/                  superseded vault material
└── Model-Registry.md
```

There is no `09` folder: `09 - Patterns & Lessons` held only audit packs and was archived on 2026-11-11.

## Where a document goes

| You are writing | Put it in | Notes |
|---|---|---|
| How a module works: architecture, tables, gotchas | That module's folder under `02` or `03`, in `Overview.md` or a named guide beside it | Augment the existing document; never create a parallel one |
| A rule that spans modules | `01 - Architecture/` | One document per concern |
| Which files implement a feature | `01 - Architecture/Feature Map/` | Checked against `CLAUDE.md` by `pnpm docs:check` |
| A new page, route or feature | An entry in `04 - UI & Design/Page & Feature Atlas/` plus a row in its `_Index.md` | Hard Rule 23 |
| A setup or troubleshooting guide | `06 - Setup & Onboarding/` | |
| An idea that is not yet work | `10 - Project Management/0 - Inbox.md` for a quick capture; `07 - Backlog & Ideas/` for a long-form vision | |
| Work to do | A row in a campaign's `4 - Checklist.md` and a `### <ID>` section in its Master Book | Grammar: `10 - Project Management/_Conventions.md` |
| A plan or study that spans campaigns | `10 - Project Management/Plans/` or `Research/` | Only while it governs open work |
| A step-by-step session with the owner | `08 - Sessions/Wizards/` | Written by the `wizard` skill |

## When a document stops being current

Nothing superseded stays beside live documents.

- **Vault documents** (audits, completion notes, replaced guides) move to `ERA Notes/_Archive/`, keeping their section name as a subfolder.
- **PM documents** move to `10 - Project Management/_Archive/`: finished plans to `Plans/`, incorporated studies to `Studies/<subject>/`. Shipped items are archived by `pnpm pm:ship`.
- Fix the links that pointed at the moved file in the same change. `pnpm pm:check-docs` verifies links inside Project Management.
- No tool reads an `_Archive/` folder, and nothing in one states current truth.

## Naming

- Name a document by its subject (`Sync and Offline.md`), never by its author, model, audit wave or date. A date belongs in the name only inside an archive.
- A module folder's main document is `Overview.md`.
- Do not create generation folders (`FABLED 2`, `ASTRA`, …) inside a section. A whole-repository study is one folder under `10 - Project Management/` with a stated retirement condition.

## Frontmatter and tags

Feature documents carry `type: feature-doc` or `type: overview`, `module`, `module-type` (`standalone` / `junction`) and `status`. The Dataview [Module Index](<../00 - Home/Module Index.md>) reads them.

| Tag prefix | Purpose | Examples |
|---|---|---|
| `module/` | Which module | `module/accounts`, `module/hub-chat` |
| `type/` | Document type | `type/feature-doc`, `type/architecture`, `type/ui` |
| `scope/` | Cross-cutting scope | `scope/cross-cutting`, `scope/auth`, `scope/pwa` |
| `status/` | Work status | `status/active`, `status/archived` |

## Git tracking

- **Tracked:** everything except the two entries below.
- **Gitignored:** `08 - Sessions/` (personal working notes) and `.obsidian/workspace.json` (personal layout).

## Obsidian

Templates live in `Templates/` (configured in `.obsidian/templates.json`). Recommended community plugins: **Dataview** (powers the Module Index), **Templater**, **Calendar**. Markdown links with relative paths work in Obsidian, VS Code and on GitHub; prefer them to wikilinks in documents that tools read.
