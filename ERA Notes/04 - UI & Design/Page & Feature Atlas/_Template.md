---
slug: example-slug
title: Example Page
category: standalone-page
route: /example
type: page
parent: null
children: []
status: active
tags: []
---

# Example Page

> One-sentence description of what this page or feature does.

## Files

- **Page**: `src/app/example/page.tsx`
- **Main component**: `src/components/example/ExamplePage.tsx`
- **Sub-components**:
  - `src/components/example/ExampleList.tsx`
  - `src/components/example/ExampleDetailModal.tsx`

## Hooks

- `src/features/example/hooks.ts` — `useExamples`, `useCreateExample`

## API routes

- `GET /api/example` → `src/app/api/example/route.ts`
- `POST /api/example` → `src/app/api/example/route.ts`

## DB tables

- `examples`
- `example_items`

## How to get here

- Tap **Example** icon in the bottom nav (mobile)
- From `/dashboard`, click the **Example** card
- Direct URL: `/example`

## What it links to

- **Detail**: `/example/[id]` (opens detail modal in-place; no route change)
- **Settings**: `/settings#example`

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Example/`

## Screenshots

- `example-mobile.png`
- `example-desktop.png`

## Notes

- Anything design-relevant: gotchas, theme variants, animation quirks, mobile-vs-desktop behavior.
