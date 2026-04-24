---
name: timezone-handling
description: "UTC storage and DST handling rules. Auto-invokes when editing files that import from src/lib/utils/date.ts, contain RRule/DTSTART, or work with Date/ISO strings in mutations."
---

# Timezone Handling

> Hard Rule #18 — always store/transmit dates as UTC ISO 8601 (`Z` suffix). Use canonical utilities from `src/lib/utils/date.ts`.

Full rules and examples: `ERA Notes/01 - Architecture/Timezone Handling.md`

## Canonical utilities (never reimplement)

| Utility | Purpose |
|---|---|
| `localToISO(date, time)` | Convert local date + time string → UTC ISO string |
| `buildFullRRuleString(startDate, rule)` | Build RRule DTSTART in UTC with `Z` suffix |
| `adjustOccurrenceToWallClock(occ, original)` | Preserve wall-clock time across DST for recurring items |

## Quick rules

- **Saving dates**: use `localToISO("2026-04-21", "21:00")` — never raw datetime strings without `Z`.
- **RRule**: use `buildFullRRuleString(startDate, rule)` — never `format(date, "yyyyMMdd'T'HHmmss")`.
- **Recurring items + DST**: use `adjustOccurrenceToWallClock(occ, original)` to preserve wall-clock hours.
- **Reading back**: `parseISO()` from date-fns handles the `Z` suffix — safe everywhere for display.
- **Never hardcode** UTC offsets (`+2`/`+3`) — DST is handled automatically through `Date` + the utilities above.

```ts
// ❌ WRONG — naive string, silent UTC shift
supabase.from("items").insert({ due_at: "2026-04-21T21:00:00" });

// ✅ CORRECT
import { localToISO } from "@/lib/utils/date";
supabase.from("items").insert({ due_at: localToISO("2026-04-21", "21:00") });
```
