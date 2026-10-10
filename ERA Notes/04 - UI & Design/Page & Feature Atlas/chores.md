---
slug: chores
title: Chores
category: standalone-page
route: /chores
type: page
parent: null
children: []
status: active
tags:
  - installable
---

# Chores

> Day-focused mobile agenda and a wide web week/planning workspace. Me | Both | partner tabs, collapsible week strip, planning search, swipe-to-assign (left me, right partner) with All day / time, and responsive action dialogs. Own installable app (`/chores-app`); the web shell uses the same components.

## Files

- **Page**: `src/app/chores/page.tsx` (web view mode → `WebViewContainer initialMode="chores"`)
- **Layout / metadata**: `src/app/chores/layout.tsx`
- **Manifest**: `public/manifests/chores.webmanifest`
- **Main component**: `src/components/chores/ChoresView.tsx`
- **Sub-components**: `ChoreRow.tsx`, `ChoreTodoRow.tsx`, `ChoreSheet.tsx`, `ChoreCheckInPanel.tsx`, `ChorePostponeSheet.tsx`, `choreUi.tsx` (all in `src/components/chores/`)
- **Desktop**: `src/components/web/WebChores.tsx` → `ChoresView variant="web"`

## Hooks

- `src/features/chores/useChores.ts` — `useChoreWeek`
- `src/features/chores/useChoreActions.ts` — slot actions, assign/move/unassign, responsibility
- `src/features/chores/choreWeek.ts` — pure week model

## API routes

- `POST /api/items/[id]/complete` → `src/app/api/items/[id]/complete/route.ts`
- `POST /api/items/[id]/actions` → `src/app/api/items/[id]/actions/route.ts`
- Flexible slots: direct Supabase upsert/delete on `item_flexible_schedules`

## DB tables

- `items` (`is_chore = true`), `reminder_details`, `item_occurrence_actions`, `item_flexible_schedules`

## How to get here

- Installed **Chores** icon, or `/chores`
- Reminders → Chores section button
- `/reminders?tab=chores` (redirects, keeps `?date=`)
- `/chores?date=YYYY-MM-DD` selects that date in the mobile or web agenda
- ERA: "open chores"

## What it links to

- Week header → **Library** → `/catalogue?section=chores`
- **Assign** opens the Assign form on mobile: room gradient tiles (done · assigned · to plan), Rooms|Chores tabs, assign-all bar, staged changes saved together (Save / Discard on close); To plan stays an immediate sidebar on web
- In-page sheets only otherwise

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Chores/Overview.md`

## Notes

- Header: standalone `ConditionalHeader` (h-16) on mobile; content has `pt-16`. MobileNav hidden.
- The web shell renders Chores independently of Budget transaction loading/errors.
- Offline: warm launch works after one online visit (SW stale-while-revalidate); a never-visited cold offline launch shows the SW loading shell.
