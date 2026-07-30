---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/schedule
---

# Schedule · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to touch items, reminders, recurrence, day plans, or calendar sync. The historical failure mode of this cluster is **duplicate occurrence generation** — three diverging expansion engines exist and "skip" once meant "postpone." Everything dangerous here is dangerous quietly.

## First 10 minutes in this cluster

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/items src/lib/schedule src/lib/gcal src/app/api/gcal src/components/planner
npx vitest run src/lib/schedule/    # KNOWN STATE 2026-07-18: expandOccurrences guard is RED (WebTodayView). If MORE than that fails, something new broke.
```

Then read: `.claude/skills/recurrence-safety/SKILL.md` (**mandatory**) → [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) (the engine map) → `src/lib/gcal/sync.ts` if touching sync.

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| UI on reminder/planner views, chips, badges | **any-model** | `ui-guardrails`; no red for item rows (Hard Rule 3); overdue labels `text-white/40` |
| Item CRUD fields with no recurrence/date semantics | **any-model** | `add-feature`; remember reminders have no categories/description |
| NL parser (`smartTextParser`) additions | **any-model** | pure function + extend its test table first |
| Anything touching occurrence expansion, skip/postpone/confirm, exceptions, pauses | **mid-tier+** | `recurrence-safety` open; identify WHICH engine before editing; never add a fourth |
| gcal sync mapping/reconcile | **mid-tier+** | `timezone-handling` + cron template; push-only today — do not invent pull |
| Unifying the three engines; changing skip semantics; the WebTodayView guard diagnosis | **human-first** | the duplicate-generation scar tissue lives here; propose, don't land |

**Out-of-depth tells — stop if:** you can't name which of the three expansion engines your change runs through; you're about to make "skip" write a date; you're expanding RRULEs in a component (`is_flexible` must be skipped in views); you're using calendar months for anything user-facing (custom month start exists); you're storing a local-time string (UTC + tz rules in `timezone-handling`).

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Two recurrence systems | edited money recurring thinking it was item recurrence (or reverse) | `recurring_payments` = money; rrule items = schedule — check the table name first |
| The suite is red by default | "tests fail" panic, or worse, numbness | exactly ONE known failure as of 2026-07-18 (expandOccurrences guard); treat any second failure as yours |
| Flexible items in views | duplicate occurrences shown | views must skip `recurrence_rule?.is_flexible` and inject placements; the guard test enumerates compliant views |
| Hot path = bundle RPC | adding a per-child fetch reintroduces ~200ms/call | `get_schedule_bundle` (Hard Rule 21); never fan out |
| RLS truth is the live DB | schema.sql shows no RLS for items tables — they HAVE it | `migrations/_verify_schedule_rls.md` has the verification queries |
| gcal is one-way backup | assuming Google is source of truth | Google is a *copy*; items are truth; drift heals via `cron/gcal-reconcile` — but verify it's actually scheduled (`vercel.json` absent 2026-07-18) |
| Dead file on disk | "fixing" MobileItemForm.tsx | it's dead; the live form is `MobileReminderForm`. Delete it (O2), don't edit it |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Known-red is exactly one guard | `npx vitest run src/lib/schedule/ 2>&1 \| tail -5` | 1 failed (expandOccurrences) — until O1 lands, then 0 |
| gcal surface is 4 routes + 2 libs | `find src/app/api/gcal src/lib/gcal -name "*.ts" \| wc -l` | 6 |
| No fourth engine appeared | `grep -rln "rrulestr\|RRule(" src --include="*.ts" --include="*.tsx" \| wc -l` | stable small set — if it grew, investigate |
| Dead form status | `ls src/components/items/MobileItemForm.tsx 2>/dev/null` | exists (until O2) — GONE means O2 landed, update `_index` |
| Sync bookkeeping column | `grep -n "google_synced_at" migrations/schema.sql` | present on items |

## What FABLED 2 got wrong here

Nothing factual; its Test-protection note already reported the guard failure. What it underestimated was *decay velocity*: it scored a red suite 5 assuming a prompt fix; a month later the failure is normalized. Gen 3 therefore ties suite-greenness to **Handoff readiness** (a lower-tier model cannot distinguish "known red" from "I broke it" without this file) — that's why O1 outranks everything, including features.
