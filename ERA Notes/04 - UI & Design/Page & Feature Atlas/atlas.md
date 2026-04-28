---
slug: atlas
title: Atlas Viewer
category: utility
route: /atlas
type: page
parent: null
children: []
status: active
tags:
  - docs
  - dev-tool
---

# Atlas Viewer

> Animated, searchable map of every page and feature in the app. Reads `public/atlas/atlas.json` (built from the MD files in this folder).

## Files

- **Page**: `src/app/atlas/page.tsx`
- **Main component**: `src/components/atlas/AtlasShell.tsx`
- **Sub-components**:
  - `src/components/atlas/AtlasTree.tsx`
  - `src/components/atlas/AtlasDetail.tsx`
  - `src/components/atlas/AtlasSearch.tsx`
- **Feature module**: `src/features/atlas/types.ts`, `src/features/atlas/utils.ts`
- **Build script**: `scripts/build-atlas.mjs`
- **Seed script**: `scripts/seed-atlas.mjs`
- **Generated data**: `public/atlas/atlas.json`
- **Screenshots folder**: `public/atlas/screenshots/`

## Hooks

- n/a (static data, read from JSON server-side)

## API routes

- n/a (page is statically rendered; JSON is served from `/atlas/atlas.json`)

## DB tables

- n/a

## How to get here

- Direct URL: `/atlas`
- Linked from `ERA Notes/04 - UI & Design/Screen File Map.md` banner.
- Linked from `ERA Notes/04 - UI & Design/App Routes and Icons.md`.

## What it links to

- Each entry's "Files" section uses `vscode://file/...` deep-links to open paths in VS Code.
- "Related vault doc" cross-links into `ERA Notes/02 - Standalone Modules/` and `03 - Junction Modules/`.

## Related vault doc

- `ERA Notes/04 - UI & Design/Page & Feature Atlas/README.md`
- `ERA Notes/04 - UI & Design/Page & Feature Atlas/_Index.md`

## Screenshots

- `atlas-mobile.png`
- `atlas-desktop.png`

## Notes

- Run `pnpm atlas` after editing any MD in this folder.
- `pnpm atlas:seed` re-seeds stubs for any new routes/features (idempotent — never overwrites existing).
- `prebuild` script automatically regenerates `atlas.json` before `next build`.
- CLAUDE.md Hard Rule #20 enforces keeping the atlas in sync.
