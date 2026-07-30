---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Dashboard
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Dashboard · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Dashboard** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make the dashboard a household change detector and decision horizon—not a museum of every metric.

## Business and household value

A focused home surface increases trust and daily utility while reducing code and cognitive load. Pruning is part of the business plan: fewer maintained widgets, clearer product identity.

Measure attention returned, risk reduced, or outcomes improved—not engagement.

## Roadmap

1. Now — inventory duplicated widgets and add freshness/coverage to one critical card.
2. Next — prototype a deterministic Since You Looked delta and Now/Soon/Later horizon.
3. Later — prune dashboards by measured decision value and preserve deep analytics elsewhere.

## New opportunity set

### V1 — Since You Looked

- **Mechanism:** Compare current authoritative state with the last acknowledged dashboard snapshot and show material deltas only.
- **Smallest proof:** Implement locally for balance, today items, and notifications.
- **Success measure:** A returning user understands material change in under 20 seconds.
- **Kill criterion:** Use a simple recent-activity card if snapshots add no value.
- **Invariant:** Absence from the delta never means unchanged when data is stale.

### V2 — Attention horizon

- **Mechanism:** Organize decisions into now, soon, later, and background based on explicit time/risk rules.
- **Smallest proof:** Classify existing cards without changing data.
- **Success measure:** The first screen contains no non-actionable low-horizon noise.
- **Kill criterion:** Keep fixed sections if horizon movement feels unstable.
- **Invariant:** Rules are deterministic and explainable.

### V3 — Dashboard estate budget

- **Mechanism:** Require every widget to name decision, owner, freshness, cost, and retirement trigger.
- **Smallest proof:** Score all current widgets and park the bottom quartile.
- **Success measure:** One surface is deleted or merged with no loss of daily decisions.
- **Kill criterion:** Keep scorecard only as a one-time audit if ongoing telemetry is unnecessary.
- **Invariant:** Removal preserves access to underlying precision tools.

## Existing-roadmap boundary

Proactive briefing, generic action inbox, module usage census, and density modes are existing ideas; this pack focuses on change detection and surface pruning.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notifications, and automation.

