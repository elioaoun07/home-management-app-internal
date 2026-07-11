---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Error Logs
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Error Logs · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Error Logs** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make errors into recovery narratives: one causal fingerprint, preserved user intent, attempted recovery, and a reproducible fixture.

## Business and household value

Faster recovery protects trust and developer time. The value metric is incidents resolved and user work preserved, not logs accumulated.

Measure attention returned, risk reduced, or outcomes improved—not engagement.

## Roadmap

1. Now — define the logging choke point and inventory silent/error paths by user outcome.
2. Next — group one cross-layer incident and show a recovery receipt.
3. Later — convert repeated fingerprints into regression fixtures and error-budget decisions.

## New opportunity set

### V1 — Incident fingerprint

- **Mechanism:** Normalize route, feature, error class, network state, and causal chain into one deduplicated incident.
- **Smallest proof:** Group safeFetch/offline errors from one workflow.
- **Success measure:** Ten noisy records become one actionable incident with occurrences.
- **Kill criterion:** Keep simple grouping if fingerprints over-merge distinct causes.
- **Invariant:** Raw evidence remains available.

### V2 — Recovery receipt

- **Mechanism:** Tell the user what failed, what was preserved, what will retry, and what needs action.
- **Smallest proof:** Add a receipt to one offline mutation failure.
- **Success measure:** Users can recover without repeating input or guessing sync state.
- **Kill criterion:** Use a compact toast/detail link if full receipt is excessive.
- **Invariant:** Never claim queued or preserved without verifying it.

### V3 — Failure replay fixture

- **Mechanism:** Capture sanitized state needed to reproduce a class of failure in tests.
- **Smallest proof:** Turn one repeated incident into a deterministic fixture.
- **Success measure:** The regression fails before the fix and passes after it.
- **Kill criterion:** Limit replay to high-severity incidents if sanitization cost is high.
- **Invariant:** No secrets, household content, or personal identifiers in fixtures.

## Existing-roadmap boundary

Generic error-log persistence already exists; this pack emphasizes causal grouping, recovery, and conversion into protection.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notifications, and automation.

