---
created: 2026-06-19
status: living
owner: Elio
type: status
tags:
  - pm/status
  - scope/module
  - module/schedule
---

# Schedule · 7 — Recurrence & Occurrence Actions — Pain & Refactor Plan

> **Command Center:** [_index](<_index.md>) · [1 · Pain Inventory](<1 - Pain Inventory (Every Painful Thing).md>) · [2 · Target Design](<2 - Target Design & Decisions.md>) · [3 · Execution Plan](<3 - Execution Plan (Staged).md>) · [4 · Type Taxonomy & Form](<4 - Type Taxonomy & Mobile Form Refactor.md>) · [5 · My Plan Reconciliation](<5 - My Plan Reconciliation & Harmonized Scope.md>) · [6 · Master Checklist](<6 - Master Build Checklist.md>) · **7 · Recurrence & Occurrence Actions**
>
> **What this file is:** the deep, code-confirmed audit of *why "recurring items feel like a mess"* — the actual bug behind "Skip moved my occurrence to next week and duplicated it," plus the systemic reason different screens disagree. It ends in a **staged refactor plan**. This makes the abstract parent weak-link #1 ("occurrence-action math is untested") concrete.
>
> **Method & confidence:** every claim is traced to real files/lines from a codebase read on **2026-06-19**. The DB model was read from `migrations/schema.sql`. No code was changed for this doc — it is the map before the build.
>
> **Decision recorded (2026-06-19):** target action model = **Google/Outlook standard** (§4). "Postpone → next occurrence" is removed entirely.

---

## 0. The repro that triggered this

> Recurring item **every Sunday**. **Last** Sunday was missed. On Friday, cleaning up history, I opened **last Sunday's** occurrence and chose **"Skip."** Result: (1) it "moved" to **this** Sunday, and (2) this Sunday now showed **two** copies — the normal weekly one **plus** one tagged **"Postponed."** Marking it Done still left it visible on `/reminders`.

Two separate defects are hiding in that one story: a **mislabelled action** (§1) and a **`/reminders` that never hides completed items** (§5). Underneath both is a **structural duplication** problem (§3).

---

## 1. Root cause — "Skip" is secretly "postpone to next occurrence" 🔴

The control labelled **Skip** is wired to a **postpone-to-next-occurrence**, and postponing a recurring occurrence onto its own next slot **always** produces a duplicate, because the series already lands there.

**Calendar surface (what I actually touched)** — `src/components/web/WebEvents.tsx`:
- The calendar uses its **own** inline floating detail modal (`WebEvents.tsx:1238-1398`), *not* the shared sheet. Its Postpone button opens the **Postpone Options Dialog** (`:1842-2052`).
- The recurring-only button (`:1864-1880`) reads **"Skip to next occurrence — Cancel this time and wait for the next scheduled occurrence"** but calls `handlePostponeAction("next_occurrence")` (`:330-349`).
- `handlePostpone` ([useItemActions.ts:934-993](<../../../../src/features/items/useItemActions.ts>)) computes `postponed_to = calculateNextOccurrence(lastSunday, rrule)` = `addWeeks(lastSunday, 1)` = **this Sunday**, then inserts an `item_occurrence_actions` row `action_type:"postponed", postponed_to:thisSunday`.
- The weekly series already lands on this Sunday → the calendar shows the normal occurrence **plus** the postponed copy (amber "Postponed to this day" section in `WebCalendar.tsx`) → **two occurrences**. Exact match.

**Planner / detail surface (same trap + a second bug)** — `src/components/items/ItemActionsSheet.tsx`:
- Postpone option `next_occurrence` (`:380-385`) is sub-labelled **"Skip this time, mark as incomplete"** → same `onPostpone("next_occurrence")` → same duplicate.
- The real **"Skip This Time"** button (`:758-780`) calls `handleCancelClick` → `onCancel` → records `action_type:"cancelled"`, **not** `"skipped"`. `ItemActionsSheet` has **no `onSkip` prop**; the correct `handleSkip`/`useSkipItem` path (which *does* write `skipped` + an `item_alert_suppressions` row) is dead code from every sheet.

**One-line root cause:** *"Postpone → next occurrence" is conceptually invalid for recurring items, and the UI mislabels it as "Skip." No true per-occurrence Skip is wired anywhere.* The fragile hand-rolled `calculateNextOccurrence` ([useItemActions.ts:93-120](<../../../../src/features/items/useItemActions.ts>) — handles only FREQ DAILY/WEEKLY/MONTHLY/YEARLY, ignores BYDAY/COUNT/UNTIL) exists *solely* to feed this broken option.

---

## 2. The data model is fine — the mess is in the UI/expansion layers

The DB already supports correct semantics:
- `item_occurrence_actions.action_type CHECK IN ('completed','postponed','cancelled','skipped')` + `postponed_to`, `postpone_type`, `occurrence_date`, `metadata_json`.
- `item_recurrence_rules` (rrule + `start_anchor` + biweekly `phase_changed_at`/`previous_start_anchor` + `is_flexible`/`flexible_period`), `item_recurrence_exceptions` (`exdate` + `override_payload_json`), `item_flexible_schedules`, `item_alert_suppressions` (`reason CHECK IN ('cancelled','skipped','deleted','archived','manual')`), `recurrence_pauses`.

The skip API branch ([items/[id]/actions/route.ts:307-369](<../../../../src/app/api/items/[id]/actions/route.ts>)) writes `skipped` + an alert suppression **correctly**. The plumbing is right — nothing calls it.

---

## 3. The systemic mess — duplicated, diverging implementations

Two layers are each implemented 2–3 times and the copies disagree. This is why the same item looks/acts differently on different screens — the real source of "messy."

### 3a. THREE occurrence-expansion engines

| Concern | `date.ts` + WebCalendar inline | `dayOccurrences.ts` (planner, today) | `schedule/expandOccurrences.ts` (canonical, **unused**) |
|---|---|---|---|
| RRULE + bi-weekly phase | ✅ | ⚠️ phase not passed through | ✅ |
| Recurrence exceptions (skip/override) | ✅ inline | ❌ | ✅ |
| `rescheduled_to` moves | ✅ inline | ❌ | ✅ |
| Pauses | ✅ inline | ❌ | ✅ |
| Per-occurrence field overrides | ✅ inline | ❌ | ✅ (`materializeOccurrence.ts`) |
| Completed/cancelled/skipped filter | ✅ | ✅ | ✅ |
| Postponed-action copy on new date | ✅ (separate section) | ✅ | ❌ |
| Flexible-schedule injection | ✅ | ✅ | ❌ |

- [`src/lib/utils/date.ts`](<../../../../src/lib/utils/date.ts>) — `getOccurrencesInRange`, `adjustOccurrenceToWallClock` (DST wall-clock), `buildFullRRuleString`. Correct low-level primitive.
- [`src/lib/utils/dayOccurrences.ts`](<../../../../src/lib/utils/dayOccurrences.ts>) — used by `WebDayPlanner` and `WebTodayView`. **Ignores exceptions, pauses, rescheduled_to, and per-occurrence overrides** → an edited/paused/rescheduled occurrence renders **wrong on `/reminders` & Today** but **right on the calendar**.
- [`src/lib/schedule/expandOccurrences.ts`](<../../../../src/lib/schedule/expandOccurrences.ts>) (+ `materializeOccurrence.ts`) — the intended single source of truth, **already has tests** (`expandOccurrences.test.ts`), handles exceptions/pauses/overrides — but is **wired to nothing**, and lacks flexible injection + postponed-action handling.
- `WebCalendar.tsx:326-569` — the most complete behaviour, but bespoke and duplicated inline.

> ⚠️ **Wiring reality check.** Parent [1 · Feature State](<../1 - Feature State — Current Reality.md>) lists RRULE expansion as "unit-tested ✅ (`expandOccurrences.test.ts`)." True — but that engine **is not imported by any surface**. The screens run the *untested* inline/`dayOccurrences` paths. The test guards code nobody uses.

### 3b. TWO occurrence-action UIs
- **Calendar/week** (`WebEvents.tsx`): inline floating modal + inline Postpone dialog + inline custom-date picker.
- **Planner/detail/swipe** (`ItemActionsSheet.tsx` via `WebDayPlanner`, `ItemDetailModal`, `SwipeableItemCard`).

Different labels, different actions, and **both** shipped the "next occurrence" trap. `WebTodayView`/`WebTabletMissionControl` may add further variants.

### 3c. Two representations of "move one occurrence"
A single-occurrence move is modelled **two ways**: a `postponed` action (`postponed_to`) **and** a recurrence exception (`override_payload_json.rescheduled_to`). `materializeOccurrence`/the canonical engine speak the *exception* dialect; the live UI writes the *action* dialect. They must converge (§7 Stage 2).

---

## 4. Target design — Google/Outlook-standard occurrence actions *(decided 2026-06-19)*

**Recurring occurrence menu** (one shared sheet, identical on every surface):
- **Complete** — records `completed` (unchanged).
- **Skip this occurrence** — records `skipped` + `item_alert_suppressions`; occurrence disappears, **nothing rescheduled**. The correct cleanup for a missed past slot.
- **Move to a date** — *tomorrow* / *pick a specific date* only. **No "next occurrence."** Represented as a recurrence exception with `rescheduled_to` (Stage 2) so it flows through `materializeOccurrence` like any other per-occurrence edit.
- **Edit this occurrence** — exception override (unchanged).
- **Edit series / Delete series** — unchanged.

**One-off item menu:** Complete · Move to a date · **Cancel** (`items.status='cancelled'`) · Edit · Delete.

Consequences: delete `calculateNextOccurrence` and the `next_occurrence` postpone path; "Cancel" no longer appears on recurring occurrences (kills the skip/cancel ambiguity). Because flexible-routine overdue accounting keys specifically on `skipped` (`useFlexibleRoutines`), wiring real Skip also fixes silent overdue mis-counts.

---

## 5. The `/reminders` completed-items problem 🟡

`WebDayPlanner` builds `dayOccurrences` *including* completed ones and renders them dimmed/strikethrough with **no way to hide them** (`WebDayPlanner.tsx:1114-1205`, list at `:1845-1862`). The calendar already has the pattern: `showCompleted` + Eye/EyeOff toggle (`WebCalendar.tsx:167, 777-801`).

**Fix design:** add a hide/show-completed toggle (default **hide**; persist in `localStorage`) in the `/reminders` FilterBar `extraActions` next to Plan-day / Overdue ([reminders/page.tsx:200-248](<../../../../src/app/reminders/page.tsx>)), passed into `WebDayPlanner` as a `showCompleted` prop (mirrors `showOverdue`). Split the day list into open items + a collapsible **"Completed (n)"** section gated by the toggle.

---

## 6. Other fragile / poorly-implemented areas (queued, not yet built)

1. **Hand-rolled RRULE math** (`calculateNextOccurrence`) — ignores BYDAY/COUNT/UNTIL; delete with the next-occurrence option.
2. **Engine divergence (§3a)** — central cause of "messy"; `/reminders` & Today silently ignore exceptions/pauses/rescheduled/overrides.
3. **Action-UI divergence (§3b)** — calendar vs planner differ; both shipped the trap.
4. **Skip vs Cancel overlap** — "Skip This Time" writes `cancelled`, breaking flexible overdue accounting that keys on `skipped`.
5. **Completed visibility inconsistent** — calendar has a toggle, `/reminders` has none (§5).
6. **Dual move representation (§3c)** — postponed-action vs rescheduled-exception.
7. **Auto-archive 1-month window** duplicated as a constant in two routes + a manual backfill migration (`migrations/2026-06-19_fix-historic-auto-archived-completed-items.sql`) — drift risk (already flagged in code comments).
8. **`useItems.ts` ~2,621 LOC** hotspot (parent weak-link #4) — split when next touched, not for its own sake.
9. **`WebDayPlanner` optimistic-complete** resets the whole set on any `occurrenceActions` change (`:1105-1108`) — minor flash.

---

## 7. Staged refactor plan

**Stage 1 — Correctness (small, high-value, no schema change)**
- Remove the "skip/postpone → next occurrence" button on **both** surfaces (`WebEvents.tsx:1864-1880`, `ItemActionsSheet.tsx:380-385`).
- Add a real **Skip this occurrence** action (wire `handleSkip`/`useSkipItem`; add `onSkip` to `ItemActionsSheet`; add a Skip control to the calendar modal). Make "Cancel" appear only for one-off items.
- Delete `calculateNextOccurrence` and the `next_occurrence` postpone type usage.
- Add the `/reminders` show/hide-completed toggle + collapsible Completed section (§5).
- Add unit tests for skip/complete/move occurrence math (parent weak-link #1).

**Stage 2 — Unify the engine (the real fix for "messy")**
- Finish `schedule/expandOccurrences.ts` to also inject flexible schedules and (for one-off items) postponed actions; converge recurring single-occurrence **moves** onto `rescheduled_to` exceptions so the engine needs only one move dialect.
- Migrate every surface (WebCalendar, WebWeekView, WebDayPlanner, WebTodayView, WebTabletMissionControl, ItemsListView, RemindersInsightsPage) onto it; delete `dayOccurrences.ts` and the inline loops in WebCalendar.
- Lock behaviour with the expanded `expandOccurrences.test.ts`.

**Stage 3 — Unify the action UI**
- One shared occurrence-action sheet used by calendar, week, planner, today; delete the inline calendar dialog. One labelling, one code path.

**Acceptance test (the original repro):** skipping a missed past occurrence marks it `skipped`, removes it from view, and creates **no** new/duplicate occurrence; completing an occurrence on `/reminders` moves it into the (hideable) Completed section.

---

→ Heading/decisions context → [2 · Target Design & Decisions](<2 - Target Design & Decisions.md>).
→ Where this slots in the build queue → [6 · Master Build Checklist](<6 - Master Build Checklist.md>).
