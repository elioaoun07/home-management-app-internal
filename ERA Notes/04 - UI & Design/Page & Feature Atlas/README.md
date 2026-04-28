---
created: 2026-04-28
type: ui
module: cross-cutting
module-type: n/a
status: active
tags:
  - type/ui
  - scope/atlas
---

# Page & Feature Atlas — Workflow

> **Purpose**: A complete, human-readable map of every page and feature in the app. For every page or feature, this folder lists which UI files / hooks / API routes / DB tables are involved, and how a user navigates to it.
>
> Use it when handing the project to a designer ("here are the files that drive this screen"), when asking AI to make a precise change ("update this exact file"), or when onboarding.

---

## Two layers

1. **MD files (this folder)** — one Markdown file per route or feature. Authored by humans, edited freely.
2. **In-app UI at `/atlas`** — an animated nested tree (Obsidian-sidebar style) that reads `public/atlas/atlas.json`. The JSON is generated from these MD files by `scripts/build-atlas.mjs`.

---

## Files

| File           | Role                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| `_Index.md`    | Master index — grouped tables of every entry. Update when adding a page/feature.        |
| `_Template.md` | Copy this when creating a new entry. All sections are required, even if "n/a".          |
| `*.md`         | One file per page or feature. Filename = slug (kebab-case, matches `slug` frontmatter). |

Files prefixed with `_` are excluded from the build output.

---

## Adding a new entry

1. Copy `_Template.md` to `<your-slug>.md` in this folder.
2. Fill in the frontmatter (`slug`, `category`, `route`, `parent`, `children`).
3. Fill in every section (use `n/a` if truly not applicable).
4. Add a row to `_Index.md` under the right group.
5. Run `pnpm atlas` to regenerate `public/atlas/atlas.json`.
6. Commit the MD file **and** the regenerated JSON.

> **CLAUDE.md Hard Rule #20** enforces this: every new page, route, or feature module must add an Atlas entry and regenerate the JSON.

---

## Frontmatter schema

```yaml
---
slug: dashboard # kebab-case, must be unique, must equal filename (without .md)
title: Dashboard # human-readable name
category: main-tab # one of: auth, main-tab, standalone-page, feature, junction, utility, background
route: /dashboard # URL path, or "n/a" for non-route features
type: page # page | feature | junction | api-only
parent: null # slug of parent entry, or null for top-level
children: [] # list of child slugs
status: active # active | wip | deprecated
tags: [] # free tags for search
---
```

The build script reads frontmatter + the H2 sections in `_Template.md` order and emits one node per file into `public/atlas/atlas.json`.

---

## Screenshots

Place images in `public/atlas/screenshots/`:

- `<slug>-mobile.png` — mobile viewport
- `<slug>-desktop.png` — desktop viewport
- `<slug>-detail-<n>.png` — additional shots (modal, drawer, etc.)

Reference them by filename in the **Screenshots** section. The atlas UI shows a placeholder if a file is missing — populate them over time.

---

## Editing rules

- **Never duplicate**: if a vault doc exists in `ERA Notes/02 - Standalone Modules/` or `ERA Notes/03 - Junction Modules/`, link to it from the **Related vault doc** section instead of repeating its content.
- **Paths must be real**: every file path must resolve from the workspace root. The build script does not validate this — use VS Code's "Go to file" to confirm.
- **Keep it short**: this is a navigation map, not architecture documentation. Architecture lives in the vault docs.
