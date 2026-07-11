---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Notifications
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Notifications · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Notifications** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A rapidly improving junction with registry-driven rendering, critical alert gate, action routes, preferences, push, and Google Calendar-related signals, yet alerts are still primarily individual deliveries rather than causal stories evaluated before interruption.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 2/5 |
| **Decision** | 4/5 |
| **Action safety** | 4/5 |
| **Learning** | 2/5 |
| **Partnership** | 2/5 |
| **Total** | **17/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/junction/notifications.md`
- `ERA Notes/03 - Junction Modules/Notifications/Overview.md`
- `src/lib/notifications/registry.tsx`
- `src/components/notifications/CriticalAlertGate.tsx`
- `src/hooks/useNotifications.ts`
- `src/app/api/notifications`
- `src/app/api/cron`
- `src/lib/pushSender.ts`

## Non-duplication boundary

Delivery policy, digest, feedback learning loop, action inbox, household-aware delivery, and notification→conversation are existing plans; this pack adds causality and pre-delivery validation.

