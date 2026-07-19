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
  - module/notifications
---

# Notifications & Alerts · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to touch notifications, alerts, push, or cron delivery. This is a **Junction** (Items alerts, Recurring reminders, Budget spending alerts). The registry makes most work mechanical; the delivery paths and crons are where mistakes reach the user's pocket at 3am.

## First 10 minutes in this cluster

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/app/api/notifications src/app/api/cron src/components/notifications src/lib/notifications
grep -n "takeoverEligible\|calendarSync" src/lib/notifications/registry.tsx | head   # the registry is the type system
```

Then read: `src/lib/notifications/registry.tsx` (single source of truth per type) → the frozen [FABLED 2 index "What moved" section](<../FABLED 2/_index.md>) (densest audit record in the vault) → `api-route` skill's cron variant if touching crons.

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| New notification type | **any-model** | add a registry entry (route, actions, icon, class, calendarSync, takeoverEligible, retention) + the DB `notification_type` — the registry drives everything else |
| Alerts-page UI, filters, grouping | **any-model** | `ui-guardrails`; it reads `/api/notifications/in-app` — never add a second endpoint |
| Quick-action changes (Done/Snooze/Confirm/Dismiss) | **mid-tier+** | the actions route was silently broken once (column mismatch); change it WITH a route test; every action toast needs Undo (Hard Rule 1) |
| Cron logic changes | **mid-tier+** | cron template (Bearer CRON_SECRET, `supabaseAdmin()`, `maxDuration=60`); answer "how do I know it ran" in the code comment |
| Push delivery paths / sw.js | **mid-tier+** | sw.js is OUTSIDE the registry (Gap #4) — change both sides or neither |
| Takeover-gate eligibility, delivery policy | **human-first** | full-screen interruptions and send budgets are household-experience decisions — propose, let Elio feel it |

**Out-of-depth tells — stop if:** you're adding notification behavior anywhere but the registry; you're creating a second in-app read endpoint; you're editing a cron without knowing what schedules it (nothing in the repo does — `vercel.json` absent).

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Crons don't self-schedule | code "shipped" but never runs | no `vercel.json`; an external scheduler must be configured — verify liveness, never assume (Domain Gotcha) |
| Registry vs sw.js duality | push shows different text/actions than in-app | update both; Gap #4 until unified |
| Private-thread exclusion | "missing" hub notifications | by design (chatNotificationPolicy) — check visibility first |
| The actions-route scar | quick actions silently no-op | columns were once wrong for weeks; any actions change needs a verifying test |
| gcal code lives in Schedule paths | audit/edit confusion | ownership convention in [3.1](<1 - FABLED 3 — Current Implementation.md>): Schedule owns sync tech, this campaign owns delivery/liveness |
| Cron on `supabaseServer` | empty results / silent RLS filtering | crons use `supabaseAdmin()` (Hard Rule 8); the gcal bookkeeping no-op bug was exactly this class |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Registry exists and is consulted | `grep -rln "notifications/registry" src \| wc -l` | >3 |
| Single in-app read source | `grep -rln "api/notifications/in-app" src \| wc -l` | bell + alerts page + hook — small stable set |
| Six cron routes | `ls src/app/api/cron/` | daily-reminder, daily-items-reminder, item-reminders, chat-notifications, gcal-reconcile, purge-recycle-bin |
| Cron auth pattern | `grep -l "CRON_SECRET" src/app/api/cron/*/route.ts \| wc -l` | 6 |
| console.* debt (until O-3.3) | `grep -rc "console\." src/app/api/cron --include="*.ts"` | shrinking from 13/9/8 |

## What FABLED 2 got wrong here

Very little — its 07-10 re-verify is the model audit entry (three same-day fix passes, each evidence-stamped, including catching its own "code-complete" claim being false when sync never fired from online mutations). Carry its lesson forward verbatim: **"code-complete" and "wired into the live mutation path" are different claims; only the second counts.**
