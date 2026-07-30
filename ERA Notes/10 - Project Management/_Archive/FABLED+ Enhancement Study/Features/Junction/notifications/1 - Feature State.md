---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Notifications
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Notifications · Feature State

> [FABLED+ root](<../../../_index.md>) · **Notifications** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A rapidly improving junction with registry-driven rendering, critical alert gate, action routes, preferences, push, and Google Calendar-related signals, yet alerts are still primarily individual deliveries rather than causal stories evaluated before interruption.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/notifications.md`
- `ERA Notes/03 - Junction Modules/Notifications/Overview.md`
- `src/lib/notifications/registry.tsx`
- `src/components/notifications/CriticalAlertGate.tsx`
- `src/hooks/useNotifications.ts`
- `src/app/api/notifications`
- `src/app/api/cron`
- `src/lib/pushSender.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Module events, scheduled checks, preferences, subscriptions, and receipts are available. |
| **Interpret** | Registry/type and route logic choose presentation/action. |
| **Propose** | Notifications ask attention or offer actions. |
| **Commit** | Actions dismiss, snooze, route, or mutate connected state. |
| **Verify** | Delivery and action can be logged; root-cause grouping is weak. |
| **Learn** | Feedback and regret are not yet a mature policy loop. |

## Existing leverage

- Typed registry and recent route work centralize rendering and actions.
- CriticalAlertGate establishes a distinct high-severity interaction.
- Preferences, push subscriptions, logs, in-app rows, and action routes provide the delivery substrate.

## Feedback, friction, and risk

- Several symptoms of one household cause can generate separate alerts and repeated decisions.
- New rules lack a safe shadow period to measure volume, precision, and regret before delivery.
- Users can configure channels but cannot easily negotiate why a class interrupts, what evidence justified it, or what suppresses it.

## Study conclusion

**Inference:** Make notification intelligence causal and testable: group one root cause into one story, shadow-evaluate new rules, and let users inspect the interruption contract.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/lib/notifications/registry.tsx" "src/components/notifications/CriticalAlertGate.tsx" "src/hooks/useNotifications.ts" "src/app/api/notifications"

Trace every connected standalone before implementation.

