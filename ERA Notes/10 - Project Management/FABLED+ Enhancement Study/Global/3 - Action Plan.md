---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: whole-app
evidence_cutoff: 2026-07-11
---

# Global · Action Plan

> [FABLED+ root](<../_index.md>) · [Global index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · **3 · Action Plan** · [4 · Checklist](<4 - Checklist.md>)

## Operating rule

This plan is a **candidate queue**, not a replacement for ERA Awakening or campaign checklists. Promote one packet at a time into the owning PM checklist. WIP stays at one. A packet is complete only at its evidence gate.

## Phase 0 · Make the study trustworthy (1–2 sessions)

### G0.1 · Final repository verification

- Rerun typecheck, all tests, docs check, and a timed/scoped lint strategy.
- Record the active merchant-mapping commit delta.
- Verify every FABLED+ pack has exactly five files and every Feature Map entry has one pack.

**Gate:** file coverage is 40/40; no empty pack; links and required headings pass a mechanical scan.

### G0.2 · Truth drift corrections

- Decide and document the real `safeFetch` default; align code comment, canonical docs, and tests.
- Resolve Focus as active, dormant, or folded.
- Verify other literal Feature Map references flagged by the audit.
- Decide the ownership/retention of graph extraction and cache artifacts.

**Gate:** each confirmed drift has one authoritative owner and no conflicting current claim.

## Phase 1 · Establish assurance contracts (weeks 1–2)

### G1.1 · Truth Envelope v0

Define a TypeScript-only `Evidence<T>` / truth envelope with source, observed/effective time, confidence, freshness, actor, and supersession. Apply it to **Statement Import parse output** and **Balance freshness** without schema migration.

**Gate:** both surfaces render verified/inferred/stale distinctions from deterministic fixtures; no money behavior changes.

### G1.2 · Capability Passport v0

Document/passport one ERA lookup and one material Message Action. Include permission, preconditions, fallback, idempotency, inverse, and tests.

**Gate:** a reviewer traces each capability end-to-end from one file and a seeded missing-precondition fixture fails safely.

### G1.3 · Semantic test ladder

Convert the flexible-occurrence guard from a brittle source-pattern assumption into behavior/contract coverage where possible. Add route-contract fixtures for the first closed loop.

**Gate:** a deliberate recurrence divergence and a duplicate bulk-import retry both fail tests.

## Phase 2 · Ship one closed loop: Statement Assurance (weeks 3–5)

Sequence:

1. Source fingerprint and parser profile.
2. Row confidence and duplicate clusters.
3. Read-only import rehearsal.
4. Human review.
5. Idempotent batch commit.
6. Batch reconciliation receipt.
7. Correction outcome back to merchant/parser rules.

**Gate:** two real statements reconcile to rows and cents; replay is a no-op; every skipped row has a reason; no balance effect exists outside the receipt.

Why this first: active merchant-mapping work already supplies deterministic learning and tests. This closes a real loop rather than starting a greenfield platform.

## Phase 3 · Harden junctions (weeks 6–9)

### G3.1 · Typed Message Action plan

Compile one message action into typed steps, effects, compensation, operation identity, and source receipt.

### G3.2 · Sync receipt

Expose local → queued → sent → confirmed/conflicted for that same operation and chaos-test retry/reorder.

### G3.3 · Notification shadow rule

Run one candidate rule for 14 days without delivery; record would-send count, evidence, policy outcome, and matching user action.

**Gate:** the message action is traceable and replay-safe; sync state is unambiguous; the notification rule either earns launch or is killed.

## Phase 4 · Prove partnership and pruning (weeks 10–13)

### G4.1 · Household Decision Protocol pilot

Use one genuinely joint budget, meal, or future-purchase decision. Measure off-app clarification and completion time.

### G4.2 · Surface estate decision

Use the Dashboard, Focus, Atlas, and feature packs to merge/delete/park one low-value or duplicate surface. Deletion counts as a successful product outcome.

### G4.3 · Partner-led workflow

The partner chooses one workflow and success definition. The builder observes rather than prescribing.

**Gate:** one joint decision completes with explicit consent; one surface leaves the active estate; one partner-owned workflow is used twice without coaching.

## Sequencing logic

```text
truth drift + final verification
  → Truth Envelope + Capability Passport
  → Statement Assurance closed loop
  → Message Action + Sync + shadow notification
  → household decision pilot + estate pruning
```

## Capacity and risk control

- Two focused packets per week maximum.
- Stop platform work when a vertical proof can deliver the same learning.
- No schema change until the TypeScript/read-only experiment proves a persistent consumer.
- No new notification before shadow precision is measured.
- No partner-governance abstraction before one real joint decision uses it.
- If Phase 2 has not closed by week 6, drop Phase 4 before diluting the proof.

## Portfolio decision gates

| Gate | Pass condition | Failure response |
|---|---|---|
| **Truth** | Source/confidence/freshness visible and accurate. | Keep feature-local labels; do not globalize. |
| **Safety** | Retry, partial failure, and inverse are tested. | Block automation/integration expansion. |
| **Value** | A real outcome improves with acceptable attention cost. | Kill or keep the smaller manual tool. |
| **Partnership** | Both people understand ownership/consent. | Return to single-owner plus visibility. |
| **Business** | Another household can reach value without bespoke engineering. | Remain a private household OS. |

