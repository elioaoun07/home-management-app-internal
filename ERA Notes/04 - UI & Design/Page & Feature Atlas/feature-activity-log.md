---
slug: feature-activity-log
title: Feature · Activity Log
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
---

# Feature · Activity Log

> Junction feature module for household activity queries, filters, authorization-aware cache behavior and source links.

## Files

- **Module dir**: `src/features/activity-log/`

## Hooks

- `useActivityLog` in `src/features/activity-log/hooks.ts`; `activityLogKeys` in `queryKeys.ts`

## API routes

- `GET /api/activity-log`

## DB tables

- `household_activity`, `activity_log_sources`; capture trigger and authenticated read RPC

## How to get here

- Consumed by `/activity-log`; user menu and ERA Artifacts link to the page.

## What it links to

- `src/app/activity-log/ActivityLogClient.tsx`; known authorized source routes via `activitySourceHref`

## Related vault doc

- `ERA Notes/03 - Junction Modules/Activity Log/Overview.md`

## Screenshots

- n/a

## Notes

- Snapshot audience intersects current source/parent privacy. No client log mutations or persisted activity cache. Read refresh every 15 seconds while visible and after local mutation success. Local database/API suites cover recording and access boundaries; live migration/device UAT pending. PM: HUB-72.
