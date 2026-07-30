---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Analytics
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Analytics · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Analytics** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Turn analytics from a gallery of charts into a decision workbench where every conclusion declares its evidence and can be revisited against what happened next.

## Business and household value

Decision-grade analytics differentiate a household OS from a budget viewer. The economic win is a smaller, higher-value surface estate and more trust in proactive recommendations.

The target is attention returned, errors prevented, decisions shortened, or conflict avoided—not engagement.

## Roadmap

1. Now — add a coverage/provenance envelope to one high-value analytic.
2. Next — let a user save a question, decision, and review date without creating another dashboard.
3. Later — measure which analyses change outcomes and retire surfaces that only decorate the past.

## New opportunity set

### V1 — Decision notebook

- **Mechanism:** Save a question, source snapshot, chosen action, confidence, and review date as one compact analytic record.
- **Smallest proof:** Use it for three real money decisions.
- **Success measure:** At review time the original reasoning can be reconstructed in under a minute.
- **Kill criterion:** Use export/share instead if nobody revisits decisions.
- **Invariant:** The notebook references source facts; it never freezes or rewrites them.

### V2 — Coverage map

- **Mechanism:** Show which accounts, date windows, currencies, and pending states support each metric.
- **Smallest proof:** Add a confidence footer to monthly spend and net worth.
- **Success measure:** Users can identify incomplete analyses before acting on them.
- **Kill criterion:** Collapse to a warning badge if detailed coverage is never opened.
- **Invariant:** Low coverage reduces confidence, not the underlying arithmetic.

### V3 — Decision impact attribution

- **Mechanism:** Compare an explicitly recorded decision with later outcomes while admitting confounders.
- **Smallest proof:** Track one dining guardrail and one savings decision.
- **Success measure:** At least one review produces a useful keep/change/stop conclusion.
- **Kill criterion:** Do not claim causality when the data only supports correlation.
- **Invariant:** Attribution language must expose uncertainty and alternative explanations.

## Existing-roadmap boundary

Cashflow simulator, annual Wrapped, generic AI reports, and anomaly alerts are existing ideas; this vision focuses on evidence quality and post-decision learning.

## Strategy guardrail

Start read-only or in shadow mode. Persist and notify only after real use passes the named gate; never create a parallel engine for an existing concept.

