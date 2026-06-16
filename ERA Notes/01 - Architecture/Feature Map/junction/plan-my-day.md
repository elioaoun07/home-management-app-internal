# Feature Map — Plan My Day (Junction)

## Files to edit

### Core
| Intent | File |
|---|---|
| `/reminders` Focus tab (merged surface) | `src/app/reminders/page.tsx` |
| `/today` redirect | `src/app/today/page.tsx` |
| Main planner view (merged with Reminders) | `src/components/planner/WebDayPlanner.tsx` |

### Feature layer
| Intent | File |
|---|---|
| Day-plan hooks (`useDayPlan`, `useUpsertDayPlan`, `useDeleteDayPlan`, `useChecklistActions`) | `src/features/day-plan/useDayPlan.ts` |
| Day-plan types | `src/features/day-plan/types.ts` |
| Shared "what lands on day X" util (one-time + recurring + flexible) | `src/lib/utils/dayOccurrences.ts` |

### Reused from Items/Schedule (do not duplicate)
| Intent | File |
|---|---|
| Flexible-item period/scheduling | `src/features/items/useFlexibleRoutines.ts` (`useFlexibleRoutines`, `useScheduleRoutine`, `useUnscheduleRoutine`) |
| Postpone / complete / cancel + occurrence actions | `src/features/items/useItemActions.ts` |
| Item list + ad-hoc create | `src/features/items/useItems.ts` (`useItems`, `useCreateReminder`) |

### API routes
| Route | File |
|---|---|
| `GET/POST /api/day-plans` | `src/app/api/day-plans/route.ts` |
| `PATCH/DELETE /api/day-plans/[id]` | `src/app/api/day-plans/[id]/route.ts` |

### DB (Supabase SQL editor)
| Intent | File |
|---|---|
| Schema | `migrations/schema.sql` (`day_plans` table) |
| Migration | `migrations/2026-06-16_plan-my-day.sql` |

### Entry points
- `src/components/web/WebTodayView.tsx` — "Plan this day" link → `/reminders?date=…&plan=1`
- `src/components/web/WebCalendar.tsx` — `onPlanDay` callback (calls `DayExpansionModal`) → `/reminders?date=…&plan=1`
- `src/components/items/CalendarView.tsx` — `onPlanDay` callback (calls `MobileDayExpansionModal`) → `/reminders?date=…&plan=1`

### Nav registration
- `src/components/layouts/ConditionalHeader.tsx` — `/today` entry still present (redirect lands there briefly); `/reminders` handled by `pathname.startsWith("/reminders")`
- `src/components/layouts/MobileNav.tsx` — `/today` stays in `standaloneRoutes` (redirect target)
