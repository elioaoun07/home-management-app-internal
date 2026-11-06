---
created: 2026-11-06
status: proposed-design
analyzed_commit: 9cd4166691edd9367ea1bd9a604e0bec13ffe870
---

# Journey 01 — Get through a busy week

[Index](README.md) · [Shared contracts](SHARED-DEPENDENCIES.md) · Priority **1**

## User goal and trigger

“Help me get through next week without dropping the essentials.” Trigger: a Sunday review, an unusually busy week, or a disruption such as a changed appointment. The outcome is a feasible set of commitments, followed by explicit completion, deferral or cancellation. A full-looking calendar is not the outcome.

## Current behavior and evidence

**CURRENT:** Schedule represents one-off, recurring and flexible items. `dayOccurrences.ts` expands ordinary occurrences and injects flexible placements from `item_flexible_schedules`; a flexible routine is not expanded again through its RRULE. [Source:35](../../../src/lib/utils/dayOccurrences.ts#L35).

Plan My Day stores daily title, intent, notes, sharing and checklist separately from Schedule. The editor saves its local draft explicitly; checklist toggles are live. The POST route upserts by user/date and nulls omitted title/intent/notes, so a new partial caller would be unsafe. [Planner](../../../src/components/planner/WebDayPlanner.tsx), [route:65](../../../src/app/api/day-plans/route.ts#L65), [vault save model](<../../../ERA Notes/03 - Junction Modules/Plan My Day/Overview.md>).

ERA can read a day's schedule and create some reminders, but its registered find/reschedule/complete operations target owned, non-recurring reminders. A broad weekly recurring/flexible replan exceeds that adapter. [Registry:46](../../../src/features/era/capabilities/registry.ts#L46), [registry:311](../../../src/features/era/capabilities/registry.ts#L311). Meal coverage is available through Chef's existing coverage helper; it is not a household time-budget optimizer. [Chef:191](../../../src/features/era/intents/resolvers/chef.ts#L191).

**Gap:** there is no evidenced end-to-end “approve my week and recover its unfinished handoffs” journey across these sources. Daily intent does not automatically move tasks, and an informal day-plan checklist is not a second occurrence ledger.

## Participating modules and source of truth

| Module / role | Authoritative fact |
|---|---|
| Hub/ERA, junction entry | User request and supported execution receipts; not schedule truth |
| Items/Schedule, standalone | Item identity, due instant, recurrence exceptions/actions and flexible placement |
| Plan My Day, junction | Saved daily intent and informal checklist in `day_plans` |
| Chores, existing Schedule-backed workflow | Household responsibility and chore occurrence, edited through its owning UI |
| Meal Planning, contextual input | Person/day meal coverage, not a cooking-time reservation |
| Notifications, optional junction | Alert configuration/delivery record; not proof work was done |

The weekly review should reference these facts. It does not need a competing weekly calendar database. [Schema:1703](../../../migrations/schema.sql#L1703), [shared source matrix](../08-shared-data/SOURCE-OF-TRUTH-MATRIX.md).

## Input once

Capture the week, time zone, non-negotiable periods, available work windows, priorities, and whether the review covers self or household. Reuse existing item IDs, routine targets, responsible people and meal assignments. Ask for missing duration/availability only when it changes placement; absence of a calendar event is not proof of free time. New actual outcomes are later inputs, not facts the assistant can predict.

## Proposed end-to-end interaction

1. From Hub, “Plan next week.” Resolve the absolute date interval and zone once. Read permitted Schedule occurrences, flexible slots and saved day plans; optionally show meal gaps and chores as context.
2. Present a compact week review: fixed commitments, unresolved collisions, and proposed flexible placements. Unknown durations remain visible. AI may suggest ordering and tradeoffs; deterministic logic computes occurrences, existing placements and overlaps where durations are known.
3. The user accepts the proposed changes and chooses which conflicts to leave unresolved. Show each move's original occurrence/slot, destination, assignee and scope. A day-plan note may summarize the choice but cannot stand in for the actual move.
4. Execute supported effects through their owning module. Until new safe adapters exist, open recurring/flexible/partner changes in Schedule or Chores with context retained. Open each day through the existing planner link. Unsupported actions remain “needs review”, not “scheduled”.
5. During the week, the next commitment opens its original item. A disruption offers only affected moves; completed work stays completed. Meal gaps can link into Journey 02 without automatically generating a shopping list.
6. Close the week with source-backed done/deferred/cancelled states and the explicitly unresolved remainder. Carrying an item forward retains its identity; do not recreate it from the summary.

```mermaid
flowchart LR
  A[Week and constraints] --> B[Schedule and meal reads]
  B --> C[Review changes]
  C --> D[Owning module actions]
  D --> E[Daily execution]
  E --> F[Outcome review]
  E --> C
```

## Handoff events and decisions

These event names are **proposed**, not implemented messages.

| Event | Handoff payload / next owner | AI versus deterministic |
|---|---|---|
| `week.reviewed` | Absolute window, zone, approved source references and unresolved constraints → day review | AI explains alternatives; deterministic source/coverage checks |
| `commitment.placement.approved` | Exact item/occurrence or flexible slot, before/after values → Schedule | User chooses; existing recurrence/placement engine applies |
| `day.intent.saved` | Full day-plan draft and source links → daily execution | Deterministic full save; no implicit task completion |
| `commitment.outcome.recorded` | Source receipt, occurrence and actual state → remaining-week review | Deterministic status; AI may suggest a revised remainder |

A direct link suffices to open an existing day/item. C1–C6 are necessary for a review that actually changes several commitments or resumes mid-write. No new recurrence engine is justified.

## Permissions and confirmations

Default to the user's own schedule. Reading shared chores or meals does not grant permission to edit a partner's private items. Approve the concrete move set; separately approve sharing a day plan or changing a responsible person. Existing manual completion remains an explicit action, with its module's Undo. A new AI move must not bypass recurrence-scope selection. D1 governs proactive entry and D7 travel/DST behavior.

## Exceptions and interrupted work

| Condition | Proposed handling and resume behavior |
|---|---|
| Stale schedule or a partner edits after review | Re-read affected rows; retain unchanged steps, invalidate only conflicting moves and show a new before/after choice. |
| Missing availability, duration, failed meal read | Show unknown coverage. Let the user give a window or leave placement open; do not interpret failure as a free week or no meals. |
| Contradictory day note and item time | Schedule wins for due time; offer to update the note. Two real overlapping commitments require a user choice. |
| Revoked sharing or changed signed-in user | Suspend dependent steps, remove partner detail from active context, and resume only within current access. |
| Duplicate request or repeated tap | Same run/step and occurrence identity; consume a confirmed receipt. A fresh “plan again” may propose a revision, never duplicate all items. |
| Time-zone or DST change | Preserve original week and source zone. For a new ambiguous time ask which instant; never reinterpret “next Monday” after reopening. |
| App closes, network fails, or response is lost | Resume known done steps from receipts; re-read uncertain destinations. Current ERA plans do not queue offline. Unsaved current day-plan editor text may be lost; durable weekly draft recovery is proposed. |
| No feasible placement / task is no longer needed | Leave unscheduled or explicitly cancel; never squeeze it into a fabricated time slot. |

CURRENT continuation foundations: [execution state:104](../../../src/features/era/execution/state.ts#L104), [executor:138](../../../src/features/era/execution/client.ts#L138). These do not yet implement this whole weekly review.

## User-visible completion criteria

**Prepared:** every accepted change has a source receipt and every unresolved conflict is named; opening the relevant day shows the approved source commitments. **Outcome complete:** each essential commitment has a real completion or an explicit defer/cancel decision; pending sync and uncertain writes remain visible. “Week handled” cannot conceal unplaced essentials.

## Fictional example

On 2026-11-08, Maya requests 2026-11-09 through 2026-11-15 in `Asia/Beirut`. Her dentist appointment is Wednesday at 18:00; two flexible chores remain; Tuesday dinner already covers Tuesday and Wednesday as leftovers. She enters once: “Keep Wednesday evening clear; two 30-minute home-work windows Monday and Thursday.”

The proposal places laundry Monday at 19:00 and bathroom cleaning Thursday at 19:00, leaving the dentist fixed. Maya approves via the appropriate Schedule controls. Monday's saved day intent links to the existing laundry slot. On Thursday she moves cleaning to Saturday, retaining the slot identity. A reload after the move reads the saved placement instead of creating another chore. Sunday's review shows two completed chores, the appointment handled, and no duplicated Wednesday cooking requirement. These are fictional acceptance outcomes, not an executed test.

## Owner decisions

D1: invocation and authority to propose moves; D7: zone/DST policy; D8: saved-review retention. Default scope is a reviewable personal week with explicit household handoffs.
