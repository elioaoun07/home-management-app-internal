---
created: 2026-07-24
updated: 2026-07-24
type: index
status: living
owner: Elio
tags: [pm/index, tooling/delivery]
---

# Delivery 10x — Governed, Right-Sized, Truthful Delivery

> **What this campaign is:** the architecture upgrade that turns the Delivery feature from "mechanically works" into a system the owner can *govern* — budget limiters set from the owner's side before a token is spent, right-sized delivery lanes, a scope contract that cannot silently inflate, and a truthful-finish contract so every session ends in a deliberate, honest, recoverable state.
>
> **Trigger:** forensic postmortem of session `s-20260722-225601-whdv` (BUD-11, Haiku/low) — the *second* BUD-11 incident (the first, `s-20260715-214421-hvfk`, produced the DW-11…13 fixes). The tool's guardrails held perfectly; what was missing was governance, not mechanics. See [5 · Session Postmortem](<5 - Session Postmortem (s-20260722-225601-whdv).md>).

**Campaign prefix: `DLV`** — registered in [_Conventions §5](<../_Conventions.md>).

## The four milestones

| Milestone | Outcome | Items |
|---|---|---|
| **M1 — Governed Start** | The owner controls the cost/scope envelope before launch; the floor never crashes silently | DLV-1…5 |
| **M2 — Right-Sized Delivery** | Session weight matches task weight: lanes, scope contract, context budgets, model fit | DLV-6…9 |
| **M3 — Truthful Finish** | Every session ends deliberately: AC coverage, evidence-backed claims, finish package, salvage | DLV-10…14 |
| **M4 — Operability & Proof** | The owner always knows what's happening, gets notified, and can see fleet-level truth | DLV-15…19 |

## Files

| # | File | Read it when... |
|---|---|---|
| 1 | [Feature State](<1 - Feature State.md>) | You need what exists today (verified against code) and the ranked pain clusters. |
| 2 | [Vision & Architecture](<2 - Vision & Architecture.md>) | You need the 10x target architecture and the owner-decision flags. |
| 3 | [Action Plan](<3 - Action Plan.md>) | You are implementing a DLV item — design, file anchors, config surface, acceptance. |
| 4 | [Checklist](<4 - Checklist.md>) | You are executing or picking the next item. |
| 5 | [Session Postmortem (s-20260722-225601-whdv)](<5 - Session Postmortem (s-20260722-225601-whdv).md>) | You need the evidence: full forensic timeline, failure→DLV traceability, BUD-11 salvage runbook. |
| 6 | [Design Debates & Rejected Ideas](<6 - Design Debates & Rejected Ideas.md>) | You are about to propose provider fallback, remote gates, benchmarks, an ungated AUTO lane… — read the dispositions first. |

## Scope contract

- **Relationship to sibling folders — cross-reference, don't fork:**
  - [Agentic Delivery Workspace](<../Agentic Delivery Workspace/_index.md>) stays authoritative for the base architecture: state machine, packet, drivers, gates, dashboard UX, and the owner non-negotiables.
  - [Delivery Workspace](<../Delivery Workspace/_index.md>) (prefix `DW`, shipped) stays authoritative for the durable-memory layer: transcripts, ledger, context packages, pause/resume, handoff/rotation/fork. DLV resume/salvage work builds **on** that machinery, never beside it.
- **All owner non-negotiables from the base plan apply unchanged:** no git writes ever (worktrees banned permanently) · never `bypassPermissions` · `agent-registry.mjs` is the single source of truth for the Agent Catalog · Product Phase 1 = standard agent set only · always 3 human gates (any lane that wants to change gate policy is an explicit owner decision — see file 2 §Owner decisions).
- **This campaign changes governance and contracts, not state-machine semantics.** Where a new outcome is needed (e.g. `PARTIAL`), it is expressed through existing states + `awaiting.reason`/finish-package artifacts unless the owner explicitly approves a transition-table change.

## Where this fits

- Up one level: [10 - Project Management/_index.md](<../_index.md>)
- Grammar: [_Conventions](<../_Conventions.md>)
