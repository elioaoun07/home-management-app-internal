---
created: 2026-11-11
updated: 2026-11-11
type: archive
status: superseded
owner: Elio
---

# Schedule — shipped work

> Written by `pnpm pm:ship`. Full receipts and acceptance criteria of completed Schedule items, plus Master Book state-log entries older than the newest 3. The [Master Book](<../../Schedule/Schedule — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under `_Archive/` is read by a PM tool.

## Shipped items

### 2026-05-31 · partner-edit 403 fixed: the PATCH route ran its own creator-only…

- ✅ 2026-05-31 — partner-edit 403 fixed: the PATCH route ran its own creator-only check **stricter than the RLS policy underneath**; now uses `canMutateItem()` (creator OR responsible OR public+partner), matching `items_update`

### 2026-06-06 · Decision 1 shipped

- ✅ 2026-06-06 — **Decision 1 shipped**: `/focus` page retired (`FocusPage`, `FlexibleRoutinesPool`, `ScheduleRoutineSheet` deleted); Focus becomes a per-item action; Week view's "Flexible this week" strip covers routine assignment

### 2026-06-19 · Recurrence Stage 1

- ✅ 2026-06-19 — **Recurrence Stage 1**: the "skip → next occurrence" trap removed from **four** surfaces (`WebEvents`, `ItemActionsSheet`, `WebTabletMissionControl`, `ItemDetailModal`); `calculateNextOccurrence` and the `next_occurrence` postpone type deleted

### 2026-06-19 · real Skip this occurrence wired everywhere…

- ✅ 2026-06-19 — real **Skip this occurrence** wired everywhere (`onSkip` → `handleSkip`/`useSkipItem` on all 4 callers); Cancel is now one-off-only; `WebTabletMissionControl`'s misleadingly-named `handleSkip` renamed and branched correctly

### 2026-06-19 · occurrence-action unit tests (src/lib/utils/dayOccurrences.test.ts):…

- ✅ 2026-06-19 — occurrence-action unit tests (`src/lib/utils/dayOccurrences.test.ts`): the exact repro (skip a past occurrence → no duplicate), complete, move-to-date, postponed/next-occurrence collision dedup, `isOccurrenceCompleted` per action type

### 2026-06-21 · All-Household reminders now buzz both phones

- ✅ 2026-06-21 — **All-Household reminders now buzz both phones**: the `item-reminders` cron used `.maybeSingle()` on `household_links`, which *errors* on >1 active row (re-linking leaves stale-but-active rows), silently falling back to creator-only. Now collects every owner/partner id across all active links into a deduped Set

### 2026-06-21 · a completed occurrence older than 30 days keeps its strikethrough —…

- ✅ 2026-06-21 — a completed occurrence older than 30 days keeps its strikethrough — `useAllOccurrenceActions` filtered `item_occurrence_actions` by *occurrence* date, so old occurrences never reached `isOccurrenceCompleted`; the window was removed entirely

### 2026-06-21 · Decision 4 shipped

- ✅ 2026-06-21 — **Decision 4 shipped**: all four occurrence-action inserts are idempotent `.upsert(..., { onConflict: "item_id,occurrence_date,action_type" })`, ending the 500-then-retry-forever loop on double-tap/offline replay

### 2026-07-10 · Google Calendar sync

- ✅ 2026-07-10 — **Google Calendar sync** (`2783b1d`, 12 files, +727): OAuth connect/callback/connection routes, `sync-item`, `google_calendar_connections` table, `items.google_synced_at`, and a two-pass idempotent `cron/gcal-reconcile` (migration `2026-07-10_google-calendar-sync.sql`)

### SCH-20

- ✅ 2026-10-03 — **SCH-20** Chores got its own page and install icon (`/chores`, `/chores-app`), a Catalogue → Chores section and two-tap weekday assignment; refined the UI into a mobile day agenda and web week/planning workspace with search, theme-aware responsive dialogs and date-link parity. Web Chores renders independently of Budget loading/errors. Fixed the length-keyed `useFlexibleRoutines` cache and missing schedule-items invalidation on `is_chore` edits ([criteria](<../../Schedule/Schedule — Master Book.md#sch-20>), `src/features/chores/choreWeek.test.ts`)

### 2026-10-10 · Chores polish on SCH-20: /chores page uses the themed tc.bgPage…

- ✅ 2026-10-10 — Chores polish on SCH-20: `/chores` page uses the themed `tc.bgPage` (the `--background` gradient rendered near-black in blue dark), **Assign** opens preselected on the selected day (Today by default), and the assign dialog has previous/next week chevrons

### 2026-10-10 · Web View on a phone-width screen (WebViewContainer): the header's…

- ✅ 2026-10-10 — Web View on a phone-width screen (`WebViewContainer`): the header's module tabs and avatar were clipped off-screen, so Mobile View and module switching were unreachable. Below `lg` the tabs are replaced by a module-switcher dropdown and the avatar stays visible; `lg`+ unchanged

## State log
