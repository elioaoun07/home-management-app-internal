---
created: 2026-04-21
type: architecture
tags:
  - type/architecture
  - scope/cross-cutting
---

# Timezone Handling

> **Hard Rule (Universal)** — applies to every module that stores or displays dates/times.

## Core Rule

All dates must be stored and transmitted as **UTC ISO 8601 strings** (with `Z` suffix).

A naive datetime like `"2026-04-12T21:00:00"` (no `Z`, no offset) inserted into a `timestamptz` column is interpreted as UTC, silently shifting local times by the user's UTC offset (e.g. 9 PM local in UTC+3 → stored as 9 PM UTC → displayed as 12 AM local).

## The Canonical Utilities (never reimplement these)

| Utility | File | Purpose |
|---|---|---|
| `localToISO(date, time)` | `src/lib/utils/date.ts` | Convert local date + time string → UTC ISO string |
| `buildFullRRuleString(startDate, rule)` | `src/lib/utils/date.ts` | Build RRule DTSTART in UTC with `Z` suffix |
| `adjustOccurrenceToWallClock(occ, original)` | `src/lib/utils/date.ts` | Preserve wall-clock time across DST for recurring items |

## Rules

### Saving dates
```ts
// ❌ WRONG — naive string, stored as UTC silently
await supabase.from("items").insert({ due_at: "2026-04-21T21:00:00" });

// ✅ CORRECT — localToISO converts local input to UTC with Z suffix
import { localToISO } from "@/lib/utils/date";
await supabase.from("items").insert({ due_at: localToISO("2026-04-21", "21:00") });
```

### RRule DTSTART
```ts
// ❌ WRONG — format() outputs local-time digits, rrule.js interprets as UTC → offset shift
const rrule = `DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}\nRRULE:...`;

// ✅ CORRECT — single canonical implementation
import { buildFullRRuleString } from "@/lib/utils/date";
const rrule = buildFullRRuleString(startDate, recurrenceRule);
```

### Overdue detection
```ts
// ❌ WRONG — startOfDay misses items due later same day
if (dueAt < startOfDay(new Date())) { ... }

// ✅ CORRECT — compare against current time (updated every 60s via setInterval)
if (dueAt < currentTime) { ... }
```

### DST — wall-clock preservation for recurring items
```ts
// ❌ WRONG — rrule generates fixed UTC instant, shifts local display across DST
const nextOccurrence = occurrences[0];

// ✅ CORRECT — preserves original wall-clock hour across DST transitions
import { adjustOccurrenceToWallClock } from "@/lib/utils/date";
const nextOccurrence = adjustOccurrenceToWallClock(occurrences[0], originalItemDate);
```

## Reading dates back
`parseISO()` from date-fns correctly handles the `Z`/offset in retrieved values, converting back to local-time Date objects. Safe for display everywhere.

## DST Background
The DB stores UTC. The same local time (e.g. 10 AM) maps to different UTC values depending on DST at creation time (10 AM UTC+2 → 08:00Z in winter, 10 AM UTC+3 → 07:00Z in summer). This is correct — **never "fix" DB values when DST changes**. JavaScript's `Date.getHours()` returns local hours using the DST rules of the date inside the object, not the current date. All DST handling is automatic through `Date` + `localToISO` + `adjustOccurrenceToWallClock`. Never hardcode `+2`/`+3`.

## Household sharing
Each user sees times in their own browser timezone. The underlying UTC values are identical. No server-side timezone conversion is needed.
