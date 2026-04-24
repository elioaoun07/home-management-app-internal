---
type: setup
tags:
  - type/setup
  - scope/obsidian
---

# Obsidian Vault Setup

All project documentation lives in the **`ERA Notes/`** Obsidian vault at the project root. The vault mirrors the Standalone/Junction module model.

## Vault Structure

```
ERA Notes/
├── 00 - Home/          ← Dashboard MOC + Module Index (Dataview)
├── 01 - Architecture/  ← cross-cutting system docs
├── 02 - Standalone Modules/  ← one folder per standalone module
├── 03 - Junction Modules/    ← one folder per junction module
├── 04 - UI & Design/
├── 05 - Performance/
├── 06 - Setup & Onboarding/
├── 07 - Backlog & Ideas/
├── 08 - Sessions/      ← per-work-block notes (gitignored)
│   ├── Features/
│   ├── Bug Fixes/
│   └── Refactors/
├── 09 - Patterns & Lessons/  ← reusable patterns (gitignored)
└── Templates/          ← Obsidian templates for new notes
```

## Session Workflow

1. Before starting a work block, create a new note from the appropriate template:
   - Feature work → `Templates/Session - Feature.md`
   - Bug fix → `Templates/Session - Bug Fix.md`
   - Refactor → `Templates/Session - Refactor.md`
2. File it in `08 - Sessions/{Features|Bug Fixes|Refactors}/`
3. Set the `module` frontmatter to the module slug (e.g., `accounts`, `hub-chat`)
4. Tag with `session/<type>` + `module/<name>`
5. Link to the module's Overview page with `[[Overview]]`

## Tagging Conventions

| Tag prefix | Purpose             | Examples                                                 |
| ---------- | ------------------- | -------------------------------------------------------- |
| `module/`  | Which module        | `module/accounts`, `module/hub-chat`                     |
| `type/`    | Doc type            | `type/feature-doc`, `type/architecture`, `type/ui`       |
| `session/` | Session type        | `session/feature`, `session/bug-fix`, `session/refactor` |
| `scope/`   | Cross-cutting scope | `scope/cross-cutting`, `scope/auth`, `scope/pwa`         |
| `pattern/` | Code pattern        | `pattern/react-hook`, `pattern/zustand-store`            |
| `status/`  | Work status         | `status/active`, `status/completed`, `status/archived`   |

## Git Tracking (Hybrid)

- **Tracked**: `01–07` folders (feature docs, architecture, etc.) — shared project knowledge
- **Gitignored**: `08 - Sessions/`, `09 - Patterns & Lessons/` — personal working notes
- **Gitignored**: `.obsidian/workspace.json` — personal layout state

## Recommended Plugins

Install via Obsidian → Settings → Community plugins:

- **Dataview** — query notes as database tables (powers Module Index)
- **Templater** — auto-populate `{{date}}`, `{{title}}` in templates
- **Calendar** — visualize sessions on a calendar sidebar
