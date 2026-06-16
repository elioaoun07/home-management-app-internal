# Feature Map — Plan My Day (Junction)

## Files to edit

### Core
| Intent | File |
|---|---|
| `/today` page | `src/app/today/page.tsx` |
| Main planner view | `src/components/planner/WebDayPlanner.tsx` |

### Feature layer
| Intent | File |
|---|---|
| Day-plan hooks (`useDayPlan`, `useUpsertDayPlan`, `useDeleteDayPlan`, `useCheckpointActions`) | `src/features/day-plan/useDayPlan.ts` |
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
- `src/components/web/WebTodayView.tsx` — "Plan this day" header link
- `src/components/web/DayExpansionModal.tsx` — "Plan day" header button (web calendar day click)
- `src/components/items/MobileDayExpansionModal.tsx` — "Plan this day" header button (mobile calendar day click)

### Nav registration
- `src/components/layouts/ConditionalHeader.tsx` — STANDALONE_APPS `"/today"` entry + `moduleFromPath()` routes it to the `"schedule"` ERAMark
- `src/components/layouts/MobileNav.tsx` — `standaloneRoutes` array
