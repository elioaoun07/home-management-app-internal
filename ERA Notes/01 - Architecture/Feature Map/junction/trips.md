# Feature Map — Trips (Junction)

## Files to edit

### Core
| Intent | File |
|---|---|
| Trip list page | `src/app/trips/page.tsx` |
| Trip detail page | `src/app/trips/[id]/page.tsx` |
| Trip list view | `src/components/trips/TripsView.tsx` |
| Trip detail tabs | `src/components/trips/TripDetail.tsx` |
| Trip card (list item) | `src/components/trips/TripCard.tsx` |
| Status badge | `src/components/trips/TripStatusBadge.tsx` |
| Create/edit sheet | `src/components/trips/TripFormSheet.tsx` |
| Activation sheet | `src/components/trips/TripActivateSheet.tsx` |
| Completion sheet | `src/components/trips/TripCompleteSheet.tsx` |
| Places list + add form | `src/components/trips/TripPlacesList.tsx` |
| Packing list | `src/components/trips/TripPackingList.tsx` |

### Feature layer
| Intent | File |
|---|---|
| Query keys | `src/features/trips/queryKeys.ts` |
| All hooks | `src/features/trips/hooks.ts` |
| Barrel export | `src/features/trips/index.ts` |
| TypeScript types | `src/types/trips.ts` |

### API routes
| Route | File |
|---|---|
| `GET/POST /api/trips` | `src/app/api/trips/route.ts` |
| `GET/PATCH/DELETE /api/trips/[id]` | `src/app/api/trips/[id]/route.ts` |
| `POST /api/trips/[id]/activate` | `src/app/api/trips/[id]/activate/route.ts` |
| `POST /api/trips/[id]/complete` | `src/app/api/trips/[id]/complete/route.ts` |
| `POST /api/trips/[id]/clone` | `src/app/api/trips/[id]/clone/route.ts` |
| `GET/POST /api/trips/[id]/places` | `src/app/api/trips/[id]/places/route.ts` |
| `PATCH/DELETE /api/trips/[id]/places/[placeId]` | `src/app/api/trips/[id]/places/[placeId]/route.ts` |
| `GET/POST /api/trips/[id]/packing` | `src/app/api/trips/[id]/packing/route.ts` |
| `PATCH/DELETE /api/trips/[id]/packing/[itemId]` | `src/app/api/trips/[id]/packing/[itemId]/route.ts` |

### DB (Supabase SQL editor)
| Intent | File |
|---|---|
| Schema + RPCs | `migrations/schema.sql` (bottom — Trips section) |
| Activation RPC | `activate_trip(p_trip_id uuid)` |
| Completion RPC | `complete_trip(p_trip_id uuid)` |

### Nav registration
- `src/components/layouts/ConditionalHeader.tsx` — STANDALONE_APPS `"/trips"` entry
- `src/components/layouts/MobileNav.tsx` — `standaloneRoutes` array
