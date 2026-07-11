---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Analytics
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Analytics · Feature State

> [FABLED+ root](<../../../_index.md>) · **Analytics** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A broad reporting estate with mature calculations and visual ambition, but most surfaces stop at describing the past and do not preserve the decision, evidence quality, or observed outcome that followed.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/analytics.md`
- `ERA Notes/02 - Standalone Modules/Analytics/Overview.md`
- `src/features/analytics/hooks.ts`
- `src/lib/utils/anomalyDetection.ts`
- `src/components/dashboard-v2`
- `src/app/api/analytics/route.ts`
- `src/lib/ai/analysisReport.ts`

Checked against the 2026-07-11 working tree; current source wins over documentation.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Transactions, balances, allocations, categories, and periods feed analytics. |
| **Interpret** | Pure utilities aggregate, compare, detect outliers, and build reports. |
| **Propose** | Some insights recommend attention or action. |
| **Commit** | Most analytics do not own actions; users navigate elsewhere. |
| **Verify** | Inputs can be traced in code, but data coverage/freshness is not consistently visible. |
| **Learn** | The system does not connect a viewed insight to a later decision and result. |

## Existing leverage

- Comparison, anomaly, category, income/expense, and forecast utilities create a rich deterministic substrate.
- Multiple dashboards prove that the app can render complex money narratives.
- AnalysisReport adds schema validation and a deterministic fallback rather than trusting model prose.

## Feedback, friction, and risk

- Metric confidence is hidden: sparse data, hidden accounts, imported gaps, and pending sync can all change meaning without changing presentation.
- Many dashboards compete for attention; the app cannot identify which analysis actually changes a household decision.
- There is no durable thread from question → evidence → decision → later outcome.

## Study conclusion

**Inference:** Turn analytics from a gallery of charts into a decision workbench where every conclusion declares its evidence and can be revisited against what happened next.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/analytics/hooks.ts" "src/lib/utils/anomalyDetection.ts" "src/components/dashboard-v2" "src/app/api/analytics/route.ts"

Re-read every mutating route and run focused tests before implementation.

