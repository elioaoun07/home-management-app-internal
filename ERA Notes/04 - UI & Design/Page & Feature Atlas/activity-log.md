---
slug: activity-log
title: Activity Log
category: standalone-page
route: /activity-log
type: page
parent: null
children: []
status: active
tags: []
---

# Activity Log

> Installable household activity timeline with module, feature, person and date filters and source visibility enforcement.

## Files

- **Page**: `src/app/activity-log/page.tsx`
- **Main component**: `src/app/activity-log/ActivityLogClient.tsx`
- **Layout/install metadata**: `src/app/activity-log/layout.tsx`, `public/manifests/activity-log.webmanifest`

## Hooks

- `useActivityLog` in `src/features/activity-log/hooks.ts`

## API routes

- `GET /api/activity-log` — session-authenticated, no-store, Zod filters; RPC reads only

## DB tables

- `household_activity`, `activity_log_sources`; `get_household_activity` RPC

## How to get here

- User menu → Activity; ERA Artifacts → Household activity; installed Activity icon
- Direct URL: `/activity-log`

## What it links to

- ERA home and authorized source records/module pages. Deleted sources have no Open link.

## Related vault doc

- `ERA Notes/03 - Junction Modules/Activity Log/Overview.md`

## Screenshots

- Pending owner/device verification; no screenshots captured.

## Notes

- Separate opaque sticky header; global header/nav/floating assistant hidden here. Blue/pink actor colors follow the person. Read-only history, no Undo or log-writing UI.
- Own manifest ID `/activity-log-app`; 180/192/512 and maskable icons. Browser menu installs on platforms without an install prompt.
- History begins after owner applies `migrations/2026-09-26_household-activity-log.sql`. Missing setup and read errors are explicit; no offline activity copy. PM: HUB-72.
