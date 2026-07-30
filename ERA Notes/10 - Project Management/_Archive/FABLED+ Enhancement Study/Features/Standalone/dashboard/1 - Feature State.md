---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Dashboard
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Dashboard · Feature State

> [FABLED+ root](<../../../_index.md>) · **Dashboard** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A visually rich landing estate with several generations of dashboards and large widget files, but the abundance of summaries obscures one product question: what changed, what needs a decision, and what can safely wait?

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/dashboard.md`
- `ERA Notes/02 - Standalone Modules/Dashboard/Overview.md`
- `src/components/web/WebDashboard.tsx`
- `src/components/web/WebTabletMissionControl.tsx`
- `src/components/dashboard-v2`
- `src/components/dashboard/EnhancedMobileDashboard.tsx`
- `src/app/dashboard/page.tsx`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Many module summaries are loaded. |
| **Interpret** | Widgets aggregate and visualize state. |
| **Propose** | Some insights exist, but priority across widgets is inconsistent. |
| **Commit** | Actions usually navigate to another surface. |
| **Verify** | Data freshness and confidence are not uniform. |
| **Learn** | Widget visibility and outcome value are not used to simplify the estate. |

## Existing leverage

- The dashboard can synthesize money, schedule, household, and analytic data.
- Widget and responsive variants demonstrate strong visualization capability.
- Person-absolute colors and privacy blur give a household-aware presentation foundation.

## Feedback, friction, and risk

- Multiple dashboard generations and 1,000–2,500-line surfaces create competing truths and maintenance cost.
- A user returning after hours cannot see a concise delta from last known state.
- Information density is not calibrated to attention horizon, device, or whether a decision is actually due.

## Study conclusion

**Inference:** Make the dashboard a household change detector and decision horizon—not a museum of every metric.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/components/web/WebDashboard.tsx" "src/components/web/WebTabletMissionControl.tsx" "src/components/dashboard-v2" "src/components/dashboard/EnhancedMobileDashboard.tsx"

Run focused tests and inspect consumers before implementation.

