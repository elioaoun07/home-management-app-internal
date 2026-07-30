---
created: 2026-05-30
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED, FABLED 2, FABLED 3 (originals in ../_Archive/Schedule/)"
tags:
  - pm/master-book
  - scope/module
  - module/schedule
---

# Schedule — Master Book

> **Campaign:** Schedule · prefix `SCH` · working queue → [4 · Checklist](<4 - Checklist.md>)
> **What this file is:** the single consolidated record for the Schedule (Items & Reminders) module — state, shipped history, pains, the recurrence audit, decisions, acceptance criteria, and the successor briefing.

## Identity & North Star

"Schedule" is the user-facing name for the **Items & Reminders** standalone module. It is the household's **time graph** — every dated obligation (reminders, events, recurring chores, flexible routines, payment due-dates) lives here.

Two things make it strategically important: **it is the spine ERA reads from** (briefings are only as smart as the time graph behind them), and **it already touches money, chores and trips** — mostly one-directionally.

**Vision in one line:** *turn Schedule from a calendar you read into a time graph that acts — surfacing the right item, at the right time, with the right context, before you go looking.*

**Source:** `src/features/items/`, `src/app/reminders/`, `src/components/{reminder,items,planner,web}/`, `src/lib/{schedule,utils/dayOccurrences.ts,smartTextParser.ts,gcal}/`. Reads go through the `get_schedule_bundle` RPC (Hard Rule 21). Vault docs: [Items & Reminders / Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) and [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) — the authoritative code map, do not duplicate file tables here.

## Current State (verified)

**Maturity 5.5 / 10 as of 2026-07-18 (FABLED 3, evidence cutoff `f0a8e19`), +0.2 vs 2026-07-02.**

| Dimension | Score | Evidence |
|---|---|---|
| Household semantics | 8 | pass/take-back and idempotent occurrence actions hold, no regressions |
| Engine correctness | 5 | three expansion engines still diverge; gcal sync wraps items rather than adding a fourth expander |
| Test protection | 5 | **suite still red**: `expandOccurrences.test.ts` guard vs `WebTodayView.tsx` (no `is_flexible` reference since `5f7c064`, 2026-06-16). A red suite for a month trains everyone to ignore red |
| Capture UX | 7 | live form + `smartTextParser` (~1,420 LOC) unchanged in window |
| Code health | 4 | `useItems.ts` 2,665 LOC; dead `MobileItemForm.tsx` (49,943 bytes) on its **fourth** flag |
| Outward bridges | 4 (+1) | **Google Calendar sync shipped** — OAuth connect/callback/connection routes + `sync-item` + `google_calendar_connections` + `items.google_synced_at` |
| Handoff readiness | 4 | recurrence anywhere = mid-tier+ with `recurrence-safety` open; the red suite undermines the "run tests" ritual for lower tiers |

**Sub-feature reality:**

| Sub-feature | Tier | Reality | Next step |
|---|---|---|---|
| Fixed reminders / events | 🟢 Core | one-shot `reminder_details.due_at` / `event_details.start_at`; mobile quick + full forms, desktop dialog | — stable |
| RRULE recurring | 🟢 Core | `item_recurrence_rules.rrule` expanded against `start_anchor`, wall-clock DST adjustment, bi-weekly detect + phase-flip, per-occurrence actions in `item_occurrence_actions`, exceptions in `item_recurrence_exceptions`. Expansion is unit-tested — but **the tested engine is wired to nothing** | Stage 2 engine unification (SCH-4.3b) |
| Flexible routines | 🔵 | "N times per period" with user-picked days (`item_flexible_schedules`). **Universal placement rule:** when `is_flexible`, all views ignore the rrule and inject schedule rows. Overdue look-back ≤3 periods | guard the placement rule with a working test (SCH-4.2) |
| Subtasks | 🔵 | kanban, priority, nested | — stable |
| Alerts | 🔵 | `SmartAlertPicker` (absolute/relative, repeat, channels) → `item_alerts`, fired by the `item-reminders` cron; cancelled occurrences suppressed via `item_alert_suppressions` | watch for missed-suppression edge cases |
| Prerequisites | 🟠 | NFC→item unlock works; **4 evaluators are inert** (`weather`, `time_window`, `schedule`, `custom_formula`) | ship `time_window` first — smallest, highest demo value |
| Calendar / Today / Week views | 🔵 | month/week/today across web + mobile with recurrence expansion and day-expansion modal | no per-view regression test for the placement rule |
| `/reminders` Focus page | 🔵 | `WebDayPlanner` owns the Focus tab: selected day as primary panel with next-item focus, Plan in the top action row, Today in day navigation, overdue hidden until opened; mine/partner filter keys on `responsible_user_id` | — stable |
| Household assignment | 🔵 | `responsible_user_id` — an item you own but assign to your partner shows under "partner" | — stable |
| Focus insights (AI briefing) | 🟡 | `useFocusInsights` → AI Focus briefing, cached 24 h | enrich with cross-module data |
| Catalogue templates | 🔵 | items promoted to / created from catalogue templates (`source_catalogue_item_id`); flexible routines originate here | — stable |
| Plan My Day | 🟡 | Focus tab triages everything landing on a selected day (one-time + recurring + flexible via shared `dayOccurrences.ts`), with push-off, both-direction prepone, ad-hoc tasks and checklist planning; persisted via `day_plans` | mood/energy optimizer deferred — `intent` is stored but unread |
| Google Calendar sync | 🟡 | outbound one-way push (`src/lib/gcal/sync.ts`, 274 lines), OAuth routes, `cron/gcal-reconcile` two-pass idempotent reconciler | prove the cron actually runs |

**Surface map — one module, seven doors:** Mobile Form (`/expense`, precision create/edit) · `/reminders` (main mobile view) · Today (web) · Calendar Month (most-visited) · Calendar Week (most important — absorbed Focus's job) · Stats (never used, parked) · the retired `/focus` page.

## Pain Inventory

- 🟠 **The red suite is a culture problem, not a test problem.** One guard failure (`expandOccurrences.test.ts` "keeps documented schedule views on the flexible skip plus inject pattern" vs `WebTodayView.tsx`) has kept `pnpm test` red since 2026-06-16. Every session since has learned to read "1 failed" as normal — exactly how the *second* real failure slips through. The diagnosis (real double-expansion bug vs stale source-text guard) is itself unresolved, which is the point.
- 🟠 **Three diverging expansion engines.** `date.ts` + `WebCalendar` inline (complete) vs `dayOccurrences.ts` (ignores exceptions, pauses, `rescheduled_to`, per-occurrence overrides) vs `schedule/expandOccurrences.ts` (canonical, tested, **imported by nothing**). An edited/paused/moved occurrence is right on the calendar and wrong on `/reminders` and Today.
- 🟠 **The tested engine isn't the used engine** — false confidence: the test guards code no surface imports.
- 🟠 **Two diverging occurrence-action UIs** — the calendar's inline modal (`WebEvents.tsx`) and the shared sheet (`ItemActionsSheet.tsx`). Both now distinguish Skip from Cancel correctly, but they are two implementations to keep in sync.
- 🟠 **The `gcal-reconcile` cron may never run.** It shipped 2026-07-10 and is well-built (two-pass, idempotent, self-reporting via `last_synced_at`) — but there is no `vercel.json` and no scheduler trace in the repo. An unscheduled cron is indistinguishable from a scheduled one by reading code. Until `last_synced_at` is *observed advancing daily in prod*, treat the Google copy as silently diverging — and Healthcare medications plan to trust this layer.
- 🟠 **Seven surfaces for one module** — cognitive load; no single obvious place to do the thing. Organic growth: each view added without retiring or merging an old one.
- 🟡 Two representations of "move one occurrence" — a `postponed` action (`postponed_to`) *and* a recurrence exception (`override_payload_json.rescheduled_to`); the canonical engine speaks only the exception dialect, the live UI writes the action dialect.
- 🟡 `MobileItemForm.tsx` is dead code on its **fourth** generational flag — 49,943 bytes, zero importers. Deleting it is a 2-minute `git rm` + typecheck. (Left in place per an earlier owner decision — do not delete without ticking SCH-5.3.)
- 🟡 OAuth token lifecycle is unobserved — `google_calendar_connections` stores refresh tokens with no surfaced "refresh failed / connection dead" state. A dead connection looks identical to a healthy idle one.
- 🟡 Prerequisites is half-built — 4 evaluators advertised but inert.
- 🟡 `useItems.ts` is ~2,665 LOC — change-risk hotspot. Split when a feature next forces you in, never "just because".
- 🟡 No reassignment history / audit — disputes ("I thought you had it") have no record.
- 🟡 Events are easier to log than reminders/tasks — events map to one start time; reminders invite optional recurrence/alert/subtask decisions that slow entry.
- 🟡 Auto-archive 1-month window duplicated as a constant in two routes plus a manual backfill migration — drift risk.
- ⚪ `day_plans.intent` is captured but unconsumed; no `getWeekShape()` for ERA.
- ⚪ Stats surface unused — maintenance with zero payoff; parked.
- ⚪ Residual RLS drift (parked deliberately): duplicate policy generations coexist per table (harmless — RLS OR-combines), and `get_schedule_bundle` doesn't surface items where I'm responsible but the partner is creator and `is_public = false` (the assignment picker prevents that state today).

## Shipped Log

- ✅ 2026-05-31 — partner-edit 403 fixed: the PATCH route ran its own creator-only check **stricter than the RLS policy underneath**; now uses `canMutateItem()` (creator OR responsible OR public+partner), matching `items_update`
- ✅ 2026-05-31 — DELETE shares the same `canMutateItem()` guard, matching `items_delete`
- ✅ 2026-05-31 — edit and "act" made consistent — the same household-aware predicate everywhere
- ✅ 2026-05-31 — **myth corrected**: RLS *is* enabled on `items` and every child table; the repo's `schema.sql` was stale because the Supabase export captures tables only (`migrations/_verify_schedule_rls.md`)
- ✅ 2026-06-06 — "Pass to partner" / "Take it back" one-tap actions in `ItemActionsSheet` with Undo toast (no new endpoint — RLS already permits it)
- ✅ 2026-06-06 — "Assigned to me" and "Assigned out" collapsible sections with one-tap Return/Reclaim
- ✅ 2026-06-06 — **Decision 1 shipped**: `/focus` page retired (`FocusPage`, `FlexibleRoutinesPool`, `ScheduleRoutineSheet` deleted); Focus becomes a per-item action; Week view's "Flexible this week" strip covers routine assignment
- ✅ 2026-06-06 — **Decision 3 shipped**: schema drift captured — table DDL, `get_schedule_bundle` body and all RLS policies now in `migrations/schema.sql`
- ✅ 2026-06-06 — capture friction addressed on the live form (`MobileReminderForm.tsx`): title-only "someday" save, quick date chips, At-Home/Place/Map location
- ✅ 2026-06-16 — **Plan My Day** shipped: `/today` triage page for one-time/recurring/flexible items landing on a day, push-off, both-direction prepone, ad-hoc tasks, checkpoints, persisted via `day_plans`
- ✅ 2026-06-16 — Plan My Day save-gated draft model replaced auto-save-per-keystroke (edit form + one Save vs read-only preview card with Edit/Delete)
- ✅ 2026-06-17 — **W9 surface consolidation**: `/reminders` merged with Plan My Day into `WebDayPlanner.tsx`; `StandaloneRemindersPage.tsx` deleted; `/today` redirects
- ✅ 2026-06-19 — **Recurrence Stage 1**: the "skip → next occurrence" trap removed from **four** surfaces (`WebEvents`, `ItemActionsSheet`, `WebTabletMissionControl`, `ItemDetailModal`); `calculateNextOccurrence` and the `next_occurrence` postpone type deleted
- ✅ 2026-06-19 — real **Skip this occurrence** wired everywhere (`onSkip` → `handleSkip`/`useSkipItem` on all 4 callers); Cancel is now one-off-only; `WebTabletMissionControl`'s misleadingly-named `handleSkip` renamed and branched correctly
- ✅ 2026-06-19 — `/reminders` show/hide-completed toggle (Eye/EyeOff in the FilterBar, default hide, `localStorage`-persisted) + collapsible "Completed (n)" section
- ✅ 2026-06-19 — occurrence-action unit tests (`src/lib/utils/dayOccurrences.test.ts`): the exact repro (skip a past occurrence → no duplicate), complete, move-to-date, postponed/next-occurrence collision dedup, `isOccurrenceCompleted` per action type
- ✅ 2026-06-21 — "Responsible: All Household" badge no longer hides the real assignee — `ResponsibleUserBadge` always renders, "Notifying household" becomes a supplementary badge
- ✅ 2026-06-21 — **All-Household reminders now buzz both phones**: the `item-reminders` cron used `.maybeSingle()` on `household_links`, which *errors* on >1 active row (re-linking leaves stale-but-active rows), silently falling back to creator-only. Now collects every owner/partner id across all active links into a deduped Set
- ✅ 2026-06-21 — a completed occurrence older than 30 days keeps its strikethrough — `useAllOccurrenceActions` filtered `item_occurrence_actions` by *occurrence* date, so old occurrences never reached `isOccurrenceCompleted`; the window was removed entirely
- ✅ 2026-06-21 — **Decision 4 shipped**: all four occurrence-action inserts are idempotent `.upsert(..., { onConflict: "item_id,occurrence_date,action_type" })`, ending the 500-then-retry-forever loop on double-tap/offline replay
- ✅ 2026-07-10 — **Google Calendar sync** (`2783b1d`, 12 files, +727): OAuth connect/callback/connection routes, `sync-item`, `google_calendar_connections` table, `items.google_synced_at`, and a two-pass idempotent `cron/gcal-reconcile` (migration `2026-07-10_google-calendar-sync.sql`)

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Locked decisions

1. **Focus is a per-item mode, not a page** *(IMPLEMENTED 2026-06-06)* — flexible-routine assignment consolidates into the Week view.
2. **Household co-ownership: shared = co-editable, reassign both ways** *(IMPLEMENTED 2026-06-06)* — edit/delete/reassign/reclaim all use `canMutateItem()`; assigned-out and assigned-to-me are explicit buckets.
3. **Capture the schema drift back into the repo** *(IMPLEMENTED 2026-06-06)*.
4. **Occurrence-action writes must be idempotent** *(IMPLEMENTED 2026-06-21)*.
5. **Type taxonomy — Option A: keep three types in the data, never ask the user to pick one.** A time + alert → reminder; a start + duration/subtasks → task; a start AND end → event; "at home" → `location_context: home` (+ `is_chore` from a chore template). No migration, types stay, the form infers at Save. *(The live form already went further for display: it shows Reminder | Event only and coerces `task → reminder` in the UI. Global `task` retirement is SCH-6.1.)*
6. **Both capture lanes** *(2026-06-06)* — a natural-language box in the mobile form **and** Hub Chat. **Engine split:** rule-based parser in the form (offline-capable, mirrors `messageTransactionParser.ts`'s *shape*), Gemini in Hub Chat (must pass `timeoutMs`, Hard Rule 6). The form's structured fields stay the source of truth; the parser pre-fills them as editable chips.
7. **Occurrence actions follow the Google/Outlook standard** *(2026-06-19)* — recurring occurrence menu = Complete · Skip this occurrence · Move to a date · Edit this · Edit/Delete series. "Move" is a recurrence exception with `rescheduled_to`, never a postpone action. "Cancel" only for one-off items. "Postpone → next occurrence" is removed entirely, because postponing a recurring occurrence onto its own next slot **always** duplicates it.
8. **No geofencing** *(2026-06-06)* — "when I get home" routes through `location_context: home` plus the existing NFC arrive-home prerequisite (`nfc_state_change`, evaluated by `nfc-state.ts`). The only net-new piece is mapping the phrase "home" → the user's tag via `nfc_tags.label`.

### The form blueprint (design intent, mostly shipped)

**Capture first, classify last.** One screen: a title field (the only required one), date chips (`Today / Tomorrow / Pick… / No date`), alert **off by default**, an 🏠 At-home toggle, Save — with everything advanced (end-time, recurrence, subtasks, responsible user, category, priority, prerequisites, description) under a "More" disclosure. Type is inferred at Save, never asked. Title-only save creates a dateless "someday" reminder — capturing *something* beats capturing nothing.

### Track A — internal enhancements

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| Finish Prerequisites evaluators | NFC→item works; 4 stubs | `time_window` ("show meds 7–9am"), `schedule` ("after gym → log meal"), `custom_formula` — conditional automation | M each; `time_window` is S |
| Recurrence editor UX | single-occurrence vs series edits are subtle | clear "this / this-and-future / all" on every edit and delete | M |
| Bulk occurrence operations | one at a time | multi-select → bulk complete/postpone/reschedule | M |
| Smarter overdue handling | flexible look-back ≤3 periods; fixed items just sit | roll-forward suggestions + a single overdue triage view | M |
| Natural-language entry | `smartTextParser` exists and ships | "every other Thursday at 7", "remind me 2 days before rent" → rrule + alert in one line | M |
| Test the placement rule | convention across 6+ views | one guard test that actually passes | S |
| Plan My Day phase 2 | triage shipped | hourly timeline canvas + mood/energy optimizer reading `day_plans.intent` | M / M–L |

### Track B — bridges out of Schedule

- **Schedule → Focus / ERA briefing enrichment** — pull the whole week's shape, not just today's items.
- **Schedule ↔ Budget (due-dated payments)** — unify so confirming a payment closes the reminder (BUD-3 from the other side).
- **Schedule ↔ Notifications (smart timing)** — smart offsets, quiet hours, weekly digest instead of daily noise.
- **Trips → Schedule cascade** — make trip activation/completion side-effects legible from the Schedule side.
- **Debt → Schedule** — auto-create a reminder on a debt's collection date.

### The bets, in order

1. **Green the suite, then lock the foundation** — the placement-rule guard and recurrence/occurrence tests. Do this before any enhancement that touches views.
2. **Ship `time_window`** — smallest of the four stubs, highest demo value, proves the conditional-automation engine end-to-end.
3. **Schedule → briefing enrichment** — the biggest *felt* upgrade; makes ERA visibly smarter by reading the full time graph.

> Resist starting bridges before the foundation tests exist — the recurrence math is exactly where a silent bridge bug would hide.

### Not now / will not do

- ⚪ **Stats redesign** — zero current payoff.
- ⚪ **`weather` prerequisite** — lowest value-for-effort of the four evaluators.
- ⚪ **Don't redesign Month / Week / Today** — these are the parts that work.
- ❌ **Refactor `useItems.ts` "just because"** — only when a feature forces you in.
- ⛔ **Geofencing / fire-on-arrival location triggers** — doesn't exist, it's a PWA, and the owner said no. `location_context` is a static flag, not a trigger.
- ⛔ **Reusing the budget NLP wholesale for items** — `messageTransactionParser.ts` is hard-wired to amounts/currencies/spend categories. Reuse its *shape*, not its logic.
- ⛔ **Ad-hoc deletion of "duplicate/confusing mobile pages"** — surface consolidation is a decision, not a cleanup. No deletion without ticking the item.
- ⛔ **Lighting up inert evaluators just to widen NLP coverage.**
- ⚠️ **Never feed an unproven parser into untested recurrence math** — recurrence parsing stays conservative and gated behind tests before it can write an RRULE.

### Staged recurrence refactor (the spine of SCH-4.3b)

- **Stage 1 — correctness** *(shipped 2026-06-19, see Shipped Log)*.
- **Stage 2 — unify the engine.** Finish `schedule/expandOccurrences.ts` to also inject flexible schedules and (for one-off items) postponed actions; converge recurring single-occurrence moves onto `rescheduled_to` exceptions so the engine needs only one move dialect. Migrate every surface (WebCalendar, WebWeekView, WebDayPlanner, WebTodayView, WebTabletMissionControl, ItemsListView, RemindersInsightsPage) onto it; delete `dayOccurrences.ts` and the inline loops. Lock with an expanded `expandOccurrences.test.ts`.
- **Stage 3 — unify the action UI.** One shared occurrence-action sheet used by calendar, week, planner and today; delete the inline calendar dialog.

## Acceptance Criteria Index

### SCH-4.2
- **Acceptance:** `npx vitest run src/lib/schedule/` is green, and the guard either asserts on behavior or names the delegation in a comment when a view delegates its flexible check to a shared helper.

### SCH-4.3b
- **Acceptance:** skipping a missed past occurrence marks it `skipped`, removes it from view, and creates **no** new or duplicate occurrence; completing an occurrence on `/reminders` moves it into the hideable Completed section; the same item renders identically on calendar, week, planner and today.
- **Acceptance:** exactly one expansion engine is imported by every surface; `dayOccurrences.ts` and the `WebCalendar` inline loop are gone.

### SCH-6.1
- **Acceptance:** no `task` value remains in the `ItemType` union, any surface, or the DB; existing `task` rows are migrated with a paired migration file.

## Successor Briefing

**Who should read this:** you are about to touch items, reminders, recurrence, day plans or calendar sync. The historical failure mode of this cluster is **duplicate occurrence generation** — three diverging expansion engines exist and "skip" once meant "postpone." Everything dangerous here is dangerous quietly.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/items src/lib/schedule src/lib/gcal src/app/api/gcal src/components/planner
npx vitest run src/lib/schedule/    # KNOWN STATE 2026-07-18: expandOccurrences guard is RED (WebTodayView). If MORE than that fails, something new broke.
```

Then read `.claude/skills/recurrence-safety/SKILL.md` (**mandatory**) → `src/lib/gcal/sync.ts` if touching sync.

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| UI on reminder/planner views, chips, badges | any-model | `ui-guardrails`; no red for item rows (Hard Rule 3); overdue labels `text-white/40` |
| Item CRUD fields with no recurrence/date semantics | any-model | `add-feature`; reminders have no categories/description |
| `smartTextParser` additions | any-model | pure function — extend its test table first |
| Occurrence expansion, skip/postpone/confirm, exceptions, pauses | mid-tier+ | `recurrence-safety` open; identify WHICH engine before editing; **never add a fourth** |
| gcal sync mapping/reconcile | mid-tier+ | `timezone-handling` + cron template; push-only today — do not invent pull |
| Unifying the three engines; changing skip semantics; the `WebTodayView` guard diagnosis | human-first | the duplicate-generation scar tissue lives here; propose, don't land |

**Out-of-depth tells — stop if:** you can't name which of the three expansion engines your change runs through; you're about to make "skip" write a date; you're expanding RRULEs in a component (`is_flexible` must be skipped in views); you're using calendar months for anything user-facing (custom month start exists); you're storing a local-time string.

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| Two recurrence systems | edited money recurring thinking it was item recurrence | `recurring_payments` = money, rrule items = schedule — check the table name first |
| The suite is red by default | "tests fail" panic, or worse, numbness | exactly ONE known failure as of 2026-07-18; treat any second failure as yours |
| Flexible items in views | duplicate occurrences shown | views must skip `recurrence_rule?.is_flexible` and inject placements |
| Hot path = bundle RPC | a per-child fetch reintroduces ~200 ms/call | `get_schedule_bundle` (Hard Rule 21); never fan out |
| RLS truth is the live DB | `schema.sql` shows no RLS for items tables — they HAVE it | `migrations/_verify_schedule_rls.md` |
| gcal is one-way backup | assuming Google is source of truth | Google is a *copy*; items are truth; drift heals via `cron/gcal-reconcile` — verify it is actually scheduled |
| Dead file on disk | "fixing" `MobileItemForm.tsx` | it's dead; the live form is `MobileReminderForm` |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| Known-red is exactly one guard | `npx vitest run src/lib/schedule/ 2>&1 \| tail -5` | 1 failed (expandOccurrences) — 0 once SCH-4.2 lands |
| gcal surface is 4 routes + 2 libs | `find src/app/api/gcal src/lib/gcal -name "*.ts" \| wc -l` | 6 |
| No fourth engine appeared | `grep -rln "rrulestr\|RRule(" src --include="*.ts" --include="*.tsx" \| wc -l` | stable small set |
| Dead form status | `ls src/components/items/MobileItemForm.tsx 2>/dev/null` | exists until SCH-5.3 lands |
| Sync bookkeeping column | `grep -n "google_synced_at" migrations/schema.sql` | present on items |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Vault: [Items & Reminders / Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) · [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) · [Plan My Day](<../../03 - Junction Modules/Plan My Day/Overview.md>)
- Pre-consolidation originals (including the externally-authored "Simplify Mobile Schedule Entry" Codex brief and its full reconciliation): `../_Archive/Schedule/`
- Skills: `recurrence-safety` (mandatory), `timezone-handling`, `ui-guardrails`
