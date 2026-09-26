# Activity Log

**Type:** Junction
**Route:** `/activity-log`

## What it does

Household activity history with source visibility and module filters.

## Files at a glance

- **Page entry**: `src/app/activity-log/page.tsx`
- **Main component**: `src/app/activity-log/ActivityLogClient.tsx`
- **Hooks**: `src/features/activity-log/hooks.ts`
- **Query keys**: `src/features/activity-log/queryKeys.ts`
- **Types**: `src/features/activity-log/types.ts`
- **API route**: `src/app/api/activity-log/route.ts` (authenticated GET only)
- **DB tables**: `household_activity`, `activity_log_sources`
- **Recording / visibility / RPC**: `migrations/2026-09-26_household-activity-log.sql`
- **Install metadata**: `src/app/activity-log/layout.tsx`, `public/manifests/activity-log.webmanifest`, `public/activity-log-icon.svg` and PNG variants
- **Tests**: `src/features/activity-log/activityLog.database.test.ts`, `src/app/api/activity-log/route.test.ts`

## Common edit scenarios

- **"Change the Activity Log list UI"** -> `src/app/activity-log/ActivityLogClient.tsx`.
- **"Record another activity source"** -> read its source visibility contract; add a migration updating the registry/ACL context as needed, schema snapshot for any DDL, and isolated PostgreSQL coverage. Never add browser-side log writers.
- **"Change who can see activity"** -> migration's snapshot audience AND current source/parent visibility; test private/public transitions, deletion and unlink/relink.
- **"Change fetch / cache behavior"** -> `src/features/activity-log/hooks.ts`.
- **"Change the install icon"** -> SVG and 180/192/512/maskable PNG variants, manifest and layout.

## Connected modules

- Budget, Schedule/NFC, Hub Chat, Kitchen/Shopping, Catalogue, Trips, Healthcare, Outfits, ERA, Guest Portal, Notifications and Settings.
- Deep architecture: `ERA Notes/03 - Junction Modules/Activity Log/Overview.md`.
- PM: HUB-72. Existing HUB-25 / `era_actions` is the narrower assistant-action trace, not this household ledger.
