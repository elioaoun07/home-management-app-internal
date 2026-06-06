---
created: 2026-05-30
updated: 2026-06-06
type: overview
module: focus
module-type: standalone
status: retired
tags:
  - type/overview
  - module/focus
related:
  - "[[Common Patterns]]"
---

# Focus — Retired 2026-06-06

> **Was:** `src/app/focus/` | `src/components/focus/`
> **Decision:** [Schedule Pain Inventory & Plan — Decision 1](<../../10 - Project Management/Schedule/Pain Inventory & Plan/2 - Target Design & Decisions.md>)

The standalone `/focus` page has been retired. "Focus" is now a **per-item action** available from `ItemActionsSheet` (and `ItemDetailModal`) — it opens the item's detail view for a focused look at that single item.

## What was retired

- `src/app/focus/page.tsx` and `layout.tsx` — deleted
- `src/components/focus/FocusPage.tsx` — deleted
- `src/components/focus/FlexibleRoutinesPool.tsx` — deleted
- `src/components/focus/ScheduleRoutineSheet.tsx` — deleted
- Atlas entry `focus` — removed from `_Index.md`
- Route `/focus` — removed from `MobileNav.tsx` standaloneRoutes

## What was kept

- `src/features/items/useFlexibleRoutines.ts` — still used by WebWeekView, WebCalendar, WebTodayView, Chores.
- `src/features/items/useFocusInsights.ts` — still feeds the Today view and ERA briefing.
- `src/app/api/focus-insights/` — insights API still active.
- Flexible-routine pool strip in `WebWeekView.tsx` ("Flexible this week") — the scheduling UI already lived here; nothing to migrate.

## Why it was retired

The page was dull, redundant, and unused. Its two jobs were:
1. **Flexible routine assignment** — already done via the Week view's "Flexible this week" strip.
2. **AI briefing** — feeds Today view and ERA; not tied to the page.

Retiring it removes dead-weight maintenance and reduces surface sprawl (7 surfaces → 6). See [Schedule Pain Inventory, Cluster 2](<../../10 - Project Management/Schedule/Pain Inventory & Plan/1 - Pain Inventory (Every Painful Thing).md>).

## See Also

- [[Items & Reminders]] — items table, ItemActionsSheet
- [[AI Assistant]] — generates Focus Insights (still active)
