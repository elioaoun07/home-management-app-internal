---
created: 2026-05-30
updated: 2026-06-19
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/schedule
---

# Schedule · 1 — Feature State & Pain Inventory

> **Command Center:** [_index](<_index.md>) · [1 · Feature State & Pains](<1 - Feature State & Pain Inventory.md>) · [2 · Vision & Decisions](<2 - Vision, Target Design & Decisions.md>) · [3 · Type & Capture Design](<3 - Type Taxonomy & Capture Design.md>) · [4 · Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>) · [5 · Execution & Checklist](<5 - Execution Plan & Build Checklist.md>)
>
> **What this file is:** two halves of the same picture — **(A) the honest, no-hype state of every Schedule sub-feature** (what exists, how mature, the single most useful next step) and **(B) the full Pain Inventory** (every painful thing, written as `Pain → Why it hurts → Root cause → Evidence → Severity`). No imagination here (that's [file 2](<2 - Vision, Target Design & Decisions.md>)); no sequencing here (that's [file 5](<5 - Execution Plan & Build Checklist.md>)). This is the terrain.
>
> **Method & confidence:** the maturity assessment is **structural** — derived from the module's vault docs ([Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>), [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>)), the live route/API surface, and `src/features/items/`. It is **not** a line-by-line correctness audit — treat tiers as "how battle-tested," not "bug-free." Pain claims are traced to real files/lines from codebase reads on **2026-05-30** (Clusters 1–4) and **2026-06-19** (Cluster 5). Where a claim couldn't be confirmed from code alone (anything that lives only in the live Supabase DB), it's marked **⚠️ confirm in Supabase** rather than asserted.
>
> **Module identity:** "Schedule" is the user-facing name for the **Items & Reminders** standalone module. At the app level (global [2 · Feature State](<../2 - Feature State — Current Reality.md>)) it is **🟢 Core, stable** — `useItems.ts` is ~2,621 LOC and reads go through the `get_schedule_bundle` RPC pattern.

---

# Part A — Feature State (Current Reality)

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, oldest, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled. |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
|---|---|---|---|
| **Fixed reminders / events** | 🟢 Core | One-shot `reminder_details.due_at` / `event_details.start_at`. The plain, daily path. Mobile quick + full forms, desktop dialog. | — (stable) |
| **RRULE recurring** | 🟢 Core | `item_recurrence_rules.rrule` expanded against `start_anchor` (the DTSTART). Wall-clock DST adjustment. Bi-weekly detect + phase-flip. Per-occurrence actions in `item_occurrence_actions`; exceptions in `item_recurrence_exceptions`. Expansion unit-tested ✅ (`lib/schedule/expandOccurrences.test.ts`) — but ⚠️ **that tested engine is wired to nothing**; live screens run untested inline / `dayOccurrences.ts` paths that diverge. **🔴 Occurrence "Skip" is mislabelled — it postpones onto the next slot and duplicates the occurrence (found 2026-06-19).** Full audit → [file 4](<4 - Recurrence & Occurrence Actions.md>). | Fix Skip/postpone semantics + unify the 3 engines ([file 4](<4 - Recurrence & Occurrence Actions.md>)); then unit-test occurrence actions. |
| **Flexible routines** | 🔵 Established | "N times per period" with user-picked days (`item_flexible_schedules`). Universal placement rule: when `is_flexible`, **all views ignore the rrule** and inject schedule rows. Overdue look-back ≤3 periods. | Guard the placement rule with a test; it silently breaks new views. |
| **Subtasks** | 🔵 Established | Kanban, priority, nested. `ItemSubtasks.tsx` + toggle/add/delete/update hooks. | — (stable) |
| **Alerts** | 🔵 Established | `SmartAlertPicker` (absolute/relative, repeat, channels) → `item_alerts`; fired by the `item-reminders` cron. Soft-delete/archive must deactivate alerts; cancelled occurrences suppressed via `item_alert_suppressions`. | Watch for missed-suppression edge cases. |
| **Prerequisites** | 🟠 Stub/Partial | Trigger conditions (NFC tag / location / other item). Engine works for NFC→item unlock, but **4 evaluators are stubs**: `weather`, `time_window`, `schedule`, `custom_formula` (per global [2 · Feature State](<../2 - Feature State — Current Reality.md>)). | Ship `time_window` first (highest value, lowest effort). |
| **Calendar / Today / Week views** | 🔵 Established | Month/week/today across web + mobile, recurrence expansion, day-expansion modal. All must honor the universal placement rule (skip flexible in rrule loop, inject schedules). | No per-view regression test for the placement rule. |
| **Merged `/reminders` Focus page** | 🔵 Established | `WebDayPlanner` owns the Focus tab. The selected day is a primary panel with next-item focus and remaining list; Plan stays in the top action row, Today lives in day navigation, and overdue is hidden by default until opened as its own section. mine/partner filter keys on `responsible_user_id`. | — (stable) |
| **Household assignment** | 🔵 Established | `responsible_user_id` — an item you own but assign to your partner shows under "partner". | — (stable) |
| **Focus insights (AI briefing)** | 🟡 New/Thin | `useFocusInsights` → AI-generated Focus briefing, cached 24h. Lives partly in the Focus module. | Enrich briefing with cross-module data (see [file 2](<2 - Vision, Target Design & Decisions.md>)). |
| **Catalogue templates** | 🔵 Established | Items can be promoted to / created from catalogue templates (`source_catalogue_item_id`); flexible routines originate here. | — (stable) |
| **Plan My Day (disrupted-day planner)** | 🟡 New/Thin | Shipped 2026-06-16 and merged into `/reminders` on 2026-06-17. The Focus tab triages everything landing on a selected day (one-time + recurring + flexible via shared `dayOccurrences.ts` util), with push-off, both-direction prepone for flexible items, ad-hoc tasks, and checklist planning. Persisted via `day_plans` (title/intent/notes/checklist/is_public). **Fixed 2026-06-16:** the header + checklist used to auto-save on every edit; now a save-gated draft model — edit form with one Save for an unplanned day, read-only preview card with Edit/Delete for a planned one. | Mood/energy "rest vs productivity" optimizer is deferred — `intent` is stored but unread by any optimizer yet. |

---

## Related code (single source of truth)

Do **not** duplicate file-path tables here — they drift. The authoritative code map lives in:

- [Items & Reminders / Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) — UI entry points, mutation hooks, occurrence-action hooks, API routes, module Hard Rules.
- [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) — the three placement strategies (fixed / recurring / flexible), the universal placement rule, the flexible lifecycle, and the "add a new view" checklist.

---

## The honest weak-link summary *(the foundational risks)*

_(Updated 2026-06-19. These are the structural risks behind the module — Pain Cluster 4 below is the same list, kept in inventory form.)_

1. **Recurrence + occurrence-action correctness is the top weak-link — and now has a confirmed 🔴 bug.** "Skip" is mislabelled and actually postpones a recurring occurrence onto its next slot, duplicating it; no true per-occurrence Skip is wired. Underneath sits a structural mess — **three diverging expansion engines** (the unit-tested one is wired to nothing) and **two action UIs** that disagree. This is the highest-risk gap. Full audit + staged fix → [file 4 · Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>).
2. **The universal placement rule is enforced by convention, not by a test.** Every new date-surfacing view must `continue` on flexible items and inject schedule rows; forget it and flexible items land on the activation day. A single guard test would prevent the whole class of bug.
3. **Prerequisites is half-built** — 4 evaluators advertised but inert (`weather`, `time_window`, `schedule`, `custom_formula`).
4. **`useItems.ts` is ~2,621 LOC** — a change-risk hotspot. Don't refactor for its own sake; split when next touched.

---

# Part B — Pain Inventory (Every Painful Thing)

> Every painful thing about Schedule, written down so the scope is *visible*. **No solutions here** (that's [file 2](<2 - Vision, Target Design & Decisions.md>)) and **no sequencing** (that's [file 5](<5 - Execution Plan & Build Checklist.md>)).

## Severity scale

| Mark | Meaning |
|---|---|
| 🔴 **Blocker** | Stops a core flow or causes a hard error. Fix first. |
| 🟠 **Friction** | Works, but the daily cost is high enough to kill the habit. |
| 🟡 **Annoyance** | Noticeable, livable, fix when convenient. |
| ⚪ **Cosmetic / parked** | Minor, or deliberately out of scope for this campaign. |

---

## Cluster 1 — Household co-ownership & reassignment *(technical)*

> This is the cluster that produces the "RLS errors most of the time" feeling and the "I can't get an item back after I assign it" frustration. **First, the myth-bust** — because it narrows the whole fix.

### 🧨 The "RLS errors" are app-level, not RLS — but RLS *is* enabled (myth corrected 2026-05-31)

> **Correction (verified against live Supabase, 2026-05-31 — see `migrations/_verify_schedule_rls.md`):** the original claim below was **wrong**. RLS *is* enabled on `items` and every child table; the repo's `schema.sql` was stale because the Supabase visualizer export captures tables only, not policies or function bodies. More importantly, the live RLS policies (`items_update`, `items_delete`) **already grant household co-edit** — `user_id = me OR responsible_user_id = me OR (is_public = true AND active partner)`. The DB was never the blocker.
>
> **The real cause of the 403:** the PATCH/DELETE route ([items/[id]/route.ts](<../../../src/app/api/items/[id]/route.ts>)) ran its *own* creator-only check in app code — **stricter than the RLS policy underneath it** — and rejected the partner before the (already-correct) policy could allow it. Fixed 2026-05-31 by aligning that app-level guard to the policy via a shared `canMutateItem()` helper. ✅
>
> **Residual drift (not yet addressed):** (a) duplicate policy generations coexist per table (old creator-only + new household) — harmless because RLS OR-combines, but a future-cleanup footgun; (b) `get_schedule_bundle` returns `mine OR (partner's AND is_public)` and does **not** surface items where I'm `responsible` but the partner is creator and `is_public=false` — a read/write-policy mismatch that only bites if an item is assigned out while private (the picker prevents this today). Both parked deliberately.

**~~Original claim (preserved as the corrected record — do not trust):~~** *There is no row-level security on the Schedule tables at all. A full read of `migrations/schema.sql` shows no `ENABLE ROW LEVEL SECURITY`...* — this was an artifact of the stale `schema.sql`, not the live DB.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| ✅ **~~Partner can't edit a shared item → 403~~** *(FIXED 2026-05-31)* | The whole point of a household is shared items. If only the creator can edit, the partner is locked out of the item they're responsible for. | `PATCH` allowed only the **creator** in app code — *stricter than the RLS policy*. Now uses `canMutateItem()` (creator OR responsible OR public+partner), matching `items_update`. | [src/app/api/items/[id]/route.ts](<../../../src/app/api/items/[id]/route.ts>) — `canMutateItem()` guard | 🔴 |
| ✅ **~~Same lock on delete~~** *(FIXED 2026-05-31)* | Partner can't remove a shared item they own responsibility for. | `DELETE` used the same creator-only app guard; now shares `canMutateItem()`, matching `items_delete`. | `src/app/api/items/[id]/route.ts` (delete branch) | 🟠 |
| ✅ **~~Edit and "act" are inconsistent~~** *(FIXED 2026-05-31)* | Confusing and infuriating: a partner *can* tick an item complete or postpone it, but *can't* edit its text/date. Two different rules for the same item. | Edit/delete now use the same household-aware predicate as the action routes (`canMutateItem()` mirrors the complete route's check). | act path: [src/app/api/items/[id]/complete/route.ts:84-104](<../../../src/app/api/items/[id]/complete/route.ts#L84-L104>); edit/delete now consistent. | 🔴 |
| ✅ **~~Can't take an item back / reclaim responsibility~~** *(FIXED 2026-06-06)* | Once I assign to my partner, I can't reassign it to myself — one-way street. | Added "Pass to partner" and "Take it back" one-tap actions to `ItemActionsSheet` (uses `useHouseholdMembers` to derive which button to show, calls `useUpdateItem` with Undo toast). No dedicated endpoint needed — RLS already permits it. | [src/components/items/ItemActionsSheet.tsx](<../../../src/components/items/ItemActionsSheet.tsx>) — `onReassign` prop + `PassToPartnerIcon` / `TakeBackIcon` buttons | 🔴 |
| ✅ **~~Handed-off items vanish — no "assigned out / assigned to me" view~~** *(FIXED 2026-06-06)* | After assigning, the item disappears from my view — no list of "things I gave my partner" or "things assigned to me." | Added two collapsible sections to `StandaloneRemindersPage`: **"Assigned to me"** (`responsible=me`, creator=partner) and **"Assigned out"** (creator=me, `responsible=partner`). Each row has a one-tap "Return →" or "← Reclaim" button wired to `handleReassign`. | [src/components/reminder/StandaloneRemindersPage.tsx](<../../../src/components/reminder/StandaloneRemindersPage.tsx>) — `assignedToMeItems`, `assignedOutItems`, `renderAssignmentItem` | 🟠 |
| **No reassignment history / audit** | Can't see who *had* responsibility and when it changed. Disputes ("I thought you had it") have no record. | No audit table or log on `responsible_user_id` changes. | — (absence) | 🟡 |
| ✅ **~~Read path may already hide partner items~~** *(CONFIRMED 2026-06-06)* | RPC body now captured in `migrations/schema.sql`. Visible items = `user_id = me OR (partner's AND is_public = true)`. Normal flow is safe — the "Pass to partner" action sets `is_public = true`, so assigned items are always visible. **Known edge case (parked):** a private item (`is_public = false`) assigned to me by the partner won't appear in the bundle — but the assignment picker prevents this state today. | | ✅ |

> **Reusable pattern already in the codebase:** the Trips module already reassigns `responsible_user_id` in both directions automatically (`activate_trip()` hands a solo traveler's items to the partner; `complete_trip()` hands them back) — see `migrations/schema.sql`. That's the proven shape to copy for manual "pass / take back." Captured in [2 · Target Design](<2 - Vision, Target Design & Decisions.md>).

---

## Cluster 2 — UX heaviness & surface sprawl

> The "too heavy, confusing, not user-friendly" feeling. The core finding: **this is structural, not just a missing habit.** One module is spread across ~7 surfaces with overlapping jobs.

### Surface map (one module, seven doors)

| Surface | Where | Its job today | Overlap / problem |
|---|---|---|---|
| **Mobile Form** | `/expense` (Item input · Journal · Plan Schedule) | Full structured create/edit | Large & field-heavy → capture friction (Cluster 3) |
| **`/reminders` standalone** | `/reminders` (Focus + Insights tabs) | Main mobile view to see & action items | Rarely opened (below) |
| **Today (web)** | `WebTodayView` | Today + overdue + upcoming briefing | Fine as-is, per user |
| **Focus (web)** | `/focus` page | Flexible-routine assignment dashboard | **Dull, redundant, never used** — duplicates Week-view assignment |
| **Calendar — Month (web)** | `WebCalendar` | Monthly grid, add items | Most-visited; keep |
| **Calendar — Week (web)** | `WebWeekView` | Assign flexible items + Chores to days | Most *important*; keep — and absorb Focus's job |
| **Stats (web)** | analytics surface | Schedule stats | **Never used** — parked |

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| **Seven surfaces for one module** | Cognitive load: no single obvious place to *do the thing*. Overlapping jobs mean I hesitate about where to go. | Organic growth — each view added without retiring or merging an old one. | surface map above | 🟠 |
| ✅ **~~Focus page is dead weight~~** *(FIXED 2026-06-06)* | Retired `/focus` page + `FocusPage.tsx` + `FlexibleRoutinesPool.tsx` + `ScheduleRoutineSheet.tsx`. Added "Focus" per-item action to `ItemActionsSheet` → opens `ItemDetailModal`. Week view's "Flexible this week" strip covers routine assignment. | | ✅ |
| ✅ **~~`/reminders` hook rarely opened~~** *(IMPLEMENTED 2026-06-17)* | Merged `/reminders` + Plan My Day into one surface (`WebDayPlanner.tsx` at `/reminders` Focus tab). `StandaloneRemindersPage.tsx` deleted; `/today` redirects. Default view = today's items; "Plan my day" button reveals the planning editor. | | ✅ |
| **Stats unused** | Maintenance surface with zero payoff right now. | Built ahead of need. | analytics surface | ⚪ parked |

> The Focus-page pain was **decided** then shipped: retire the page, make Focus a per-item *mode*. See [2 · Target Design, Decision 1](<2 - Vision, Target Design & Decisions.md>).

---

## Cluster 3 — Capture friction *(the "I'm not inputting everything" problem)*

> The habit killer: if logging an item is heavy, I won't do it, and the whole module degrades into a half-empty calendar I don't trust. **The crisp type model + form refactor that resolves this lives in [file 3](<3 - Type Taxonomy & Capture Design.md>).**

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| 🟢 **~~Mobile Form is too heavy for quick capture~~** *(LARGELY ADDRESSED 2026-06-06)* | Logging "remind me to call the plumber" shouldn't need a multi-field form. | **Correction:** the live form is [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) (NOT the dead `MobileItemForm.tsx`) — already single-page w/ smart NL input ([smartTextParser.ts](<../../../src/lib/smartTextParser.ts>)), inferred type, progressive disclosure, voice. **Title-only "someday" save, quick date chips, and At-Home/Place/Map location shipped 2026-06-06.** | [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) | 🟢 |
| **Events are easier to log than reminders/tasks** | The asymmetry means my reminders/tasks are under-captured relative to events — exactly the items I most need surfaced. | Events map cleanly to one start time; reminders/tasks invite optional recurrence/alert/subtask decisions that slow entry. | `event_details.start_at` vs. `reminder_details.due_at` + optional recurrence/alerts | 🟡 |
| **No agreed low-friction path** *(DECIDED — both lanes; see [file 3](<3 - Type Taxonomy & Capture Design.md>))* | Without one canonical "fast lane," capture stays inconsistent. | Two viable directions: **(A)** route quick capture through Hub Chat (per CLAUDE.md, the Hub is the top-layer primary interface; forms are precision tools) vs. **(B)** strip the Mobile Form down. **Decision (2026-06-06): both** — rule-based NL box in the form + Gemini in Hub Chat. | trade-offs in [2 · Target Design](<2 - Vision, Target Design & Decisions.md>); resolved in [3 · Type & Capture Design](<3 - Type Taxonomy & Capture Design.md>) | 🟠 |

---

## Cluster 4 — Foundational risk *(same as Part A's weak-link summary, in inventory form)*

> These are the structural risks listed in **Part A · The honest weak-link summary** above. Repeated here only so the pain map is complete.

| Pain | Sev | Source |
|---|---|---|
| Recurrence + occurrence-action math is **untested** (highest-risk logic) — now with a confirmed 🔴 "Skip duplicates" bug (Cluster 5 / [file 4](<4 - Recurrence & Occurrence Actions.md>)). | 🟠→🔴 | Part A weak-link #1 |
| Universal placement rule enforced by **convention, not a test** — a forgotten skip+inject breaks flexible items across all views. | 🟠 | Part A weak-link #2 |
| Prerequisites half-built — **4 evaluators inert** (`weather`, `time_window`, `schedule`, `custom_formula`). | 🟡 | Part A weak-link #3 |
| `useItems.ts` is **~2,621 LOC** — change-risk hotspot. | 🟡 | Part A weak-link #4 |
| ✅ **~~Schema drift~~** *(FIXED 2026-06-06)* | Table DDL, `get_schedule_bundle` RPC body, and all RLS policies now captured in `migrations/schema.sql`. | [migrations/schema.sql](<../../../migrations/schema.sql>) |

---

## Cluster 5 — Recurrence & occurrence-action correctness *(technical — added 2026-06-19)*

> This is what makes "recurring items feel like a mess." The DB model is sound (`item_occurrence_actions` cleanly distinguishes completed/postponed/cancelled/skipped); the damage is entirely in the UI + expansion layers, which are **duplicated and disagree**. Full audit + staged fix in [4 · Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>). This makes Cluster 4 weak-link #1 *concrete*.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| **"Skip" is secretly "postpone to next occurrence" → duplicates** | Skipping a missed Sunday "moves" it onto this Sunday, so the week shows the normal occurrence **plus** a "Postponed" copy. Postponing a recurring slot onto its own next slot can never be right — the series already lands there. | A recurring-only button labelled "Skip to next occurrence" calls `handlePostpone("next_occurrence")` → `addWeeks(date,1)` → `postponed` action. No true per-occurrence Skip is wired. | calendar: [WebEvents.tsx:1864-1880](<../../../src/components/web/WebEvents.tsx>); sheet: [ItemActionsSheet.tsx:380-385](<../../../src/components/items/ItemActionsSheet.tsx>); handler: [useItemActions.ts:934-993](<../../../src/features/items/useItemActions.ts>) | 🔴 |
| **Real "Skip This Time" writes `cancelled`, not `skipped`** | Silently corrupts skip vs cancel analytics **and** breaks flexible-routine overdue accounting, which keys specifically on `skipped`. | `ItemActionsSheet` has no `onSkip` prop; "Skip This Time" calls `onCancel`. The correct `handleSkip`/`useSkipItem` path is dead code. | [ItemActionsSheet.tsx:758-780](<../../../src/components/items/ItemActionsSheet.tsx>); unused [useItemActions.ts:457-518](<../../../src/features/items/useItemActions.ts>) | 🟠 |
| **Three diverging expansion engines** | The same item renders differently per screen. `/reminders` & Today ignore exceptions, pauses, `rescheduled_to`, and per-occurrence overrides — so an edited/paused/moved occurrence is right on the calendar but wrong on `/reminders`. | `WebCalendar` inline (complete) vs `dayOccurrences.ts` (partial) vs `schedule/expandOccurrences.ts` (canonical, tested, **wired to nothing**). | [dayOccurrences.ts](<../../../src/lib/utils/dayOccurrences.ts>), [expandOccurrences.ts](<../../../src/lib/schedule/expandOccurrences.ts>), `WebCalendar.tsx:326-569` | 🟠 |
| **The tested engine isn't the used engine** | False confidence: Part A calls expansion "unit-tested ✅," but the test covers `expandOccurrences.ts`, which no surface imports. The screens run untested paths. | Canonical engine built + tested but never migrated onto. | `expandOccurrences.test.ts` vs zero imports of `expandOccurrencesForRange` | 🟠 |
| **Two diverging action UIs** | Calendar (inline modal/dialog in `WebEvents`) and planner/detail (`ItemActionsSheet`) offer different labels/actions; both shipped the next-occurrence trap. | Organic growth — no shared occurrence-action component. | `WebEvents.tsx:1238-1398, 1842-2052` vs `ItemActionsSheet.tsx` | 🟠 |
| **Completed items can't be hidden on `/reminders`** | Completed occurrences pile up dimmed in the day list with no toggle — the page never feels "clean." | `WebDayPlanner` renders completed inline; no `showCompleted` (the calendar has one). | `WebDayPlanner.tsx:1114-1205, 1845-1862`; pattern at `WebCalendar.tsx:167,777-801` | 🟡 |
| **Two representations of "move one occurrence"** | Recurring moves are modelled as both a `postponed` action and a `rescheduled_to` exception; the canonical engine only understands the exception dialect, the live UI writes the action dialect. | Legacy postpone path never converged onto exceptions. | `item_occurrence_actions.postponed_to` vs `item_recurrence_exceptions.override_payload_json.rescheduled_to` | 🟡 |

> **Decision (2026-06-19):** adopt the **Google/Outlook-standard** model — drop "next occurrence" entirely; recurring occurrence = Complete / Skip this occurrence / Move to a date / Edit this / Edit-or-Delete series; "Cancel" only for one-off items. Staged plan in [file 4](<4 - Recurrence & Occurrence Actions.md>).

---

## 🎯 Top pains, ranked *(the at-a-glance scope)*

> **Top live blocker (2026-06-19): 🔴 "Skip" duplicates recurring occurrences.** The action labelled "Skip" actually postpones onto the next slot and creates a second copy; no true per-occurrence Skip is wired anywhere. This is the #1 correctness issue, ahead of the capture-friction item below. Full audit + staged fix → [4 · Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>). *(Cluster 5)*

1. ✅ ~~**🔴 Partner can't edit shared items (403, creator-only).**~~ *(FIXED 2026-05-31)* Aligned app-level guard via `canMutateItem()`. *(Cluster 1)*
2. ✅ ~~**🔴 Can't take an item back / reassign in both directions.**~~ *(FIXED 2026-06-06)* "Pass to partner" + "Take it back" one-tap actions in `ItemActionsSheet`. *(Cluster 1)*
3. ✅ ~~**🟠 Handed-off items vanish — no assigned-out/assigned-to-me view.**~~ *(FIXED 2026-06-06)* Two collapsible sections added to `/reminders`. *(Cluster 1)*
4. **🟠 Capture is too heavy → I don't log everything.** The habit-killer; both lanes decided, form work largely shipped, Hub-Gemini lane pending. *(Cluster 3 → [file 3](<3 - Type Taxonomy & Capture Design.md>))*
5. ✅ ~~**🟠 Surface sprawl + dead Focus page.**~~ *(FIXED 2026-06-06)* Retired `/focus` page; added Focus per-item action to `ItemActionsSheet`; Week view handles routine assignment. *(Cluster 2)*
6. ✅ ~~**🟠 Schema drift.**~~ *(FIXED 2026-06-06)* Full schema — tables, `get_schedule_bundle` RPC, and all RLS policies — now in `migrations/schema.sql`. *(Cluster 4)*

→ Where each pain is *heading* → [2 · Vision, Target Design & Decisions](<2 - Vision, Target Design & Decisions.md>).
→ What to actually do, and in what order → [5 · Execution Plan & Build Checklist](<5 - Execution Plan & Build Checklist.md>).
