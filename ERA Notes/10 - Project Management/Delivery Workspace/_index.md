---
created: 2026-07-16
updated: 2026-07-17
type: index
status: living
owner: Elio
tags: [pm/index, tooling/delivery]
---

# Delivery Workspace — Command Center

> Implementation trace for the "Durable Delivery Memory" enhancement: evolving the Delivery feature (`scripts/delivery/`, `scripts/pm/src/features/delivery/`) into a provider-neutral workspace where a deliverable retains its full history, context, decisions, execution state, artifacts and usage data independently of the AI provider, model or session used.
>
> **Status: shipped.** All thirteen slices (DW-1 → DW-13) landed — DW-1…DW-10 on 2026-07-16, DW-11…DW-13 on 2026-07-17 as a direct follow-up to a real production incident (BUD-11, `s-20260715-214421-hvfk` — a trivial task that burned ~3M tokens and never delivered) — see [1 · Feature State](<1 - Feature State.md>) for the per-slice evidence. This doc set stays living for whatever follow-up work is scoped next (automatic threshold rotation, agent-mode digests, recommendation-engine historical lookback, live-provider verification once the pending approval clears).

| # | File | Read it when... |
|---|---|---|
| 1 | [Feature State](<1 - Feature State.md>) | You need shipped reality and evidence. |
| 2 | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | You need the design decisions and what's still open. |
| 3 | [Action Plan](<3 - Action Plan.md>) | You need the slice sequence and dependencies. |
| 4 | [Checklist](<4 - Checklist.md>) | You are executing or validating a slice. |

## Scope contract

- **Design source of truth:** the enhancement plan (rev. 2026-07-16, approved) — layer model (L0 provider-native / L1 Delivery-owned durable store / L2 derived context), full slice list DW-1…DW-10, data models, API surface, and the owner decisions recorded in file 2. DW-11…DW-13 come from a second, separate plan (approved 2026-07-17) scoped specifically to the BUD-11 incident — root-cause findings, ranked fix ordering, and design in file 1/2, same file-2 owner-decisions doc.
- **Relationship to `Agentic Delivery Workspace/`:** that folder is the original S1–S6 plan (state machine, packet, drivers, dashboard UX) — still authoritative for the base Delivery architecture. This campaign layers the durable-memory enhancement on top of it; it does not replace or duplicate that folder. Cross-reference, don't fork.
- **All four owner non-negotiables from the base plan still apply, unchanged:** no git writes ever (worktrees banned permanently) · never `bypassPermissions` · `agent-registry.mjs` stays the single source of truth for the Agent Catalog · Product Phase 1 = standard agent set only.
- **New non-negotiable for this campaign:** the artifact-first prompt doctrine (paths, not pasted bodies) is preserved and extended, not replaced — only small Delivery-owned ledger/digest/pin layers are ever inlined into a context package.
- **Every slice is fake-driver-testable** and changes no state-machine transition semantics — this work neither blocks nor requires S4 acceptance or the pending live-provider-turn approval.

## How to use this set

- **Daily driver while this program was active:** file 4 (the checklist), items `DW-1`…`DW-13` — all now swept as shipped (file 4's Now/Next/Later lanes are intentionally empty).
- **Files 1–3 are living:** update them if/when follow-up slices are scoped.
- **Design detail beyond what's summarized here** lives in the session record for this campaign's kickoff (2026-07-16) — the plan enumerates data models (`transcript/turns.ndjson`, `transcript/t-NNNN.ndjson`, `memory/ledger.json`, `context/`, `handoffs/`, `controls/`, `.delivery/config.json`), lifecycle flows (pause/resume, model/effort change, provider handoff, rotation, fork), the context policy engine, and the full API surface.

## Where this fits

- **Up one level:** the global command center → [10 - Project Management/_index.md](<../_index.md>).
- **Base architecture (read first if unfamiliar with Delivery):** [Agentic Delivery Workspace/_index.md](<../Agentic Delivery Workspace/_index.md>).
- **Next layer up:** [Delivery 10x/_index.md](<../Delivery 10x/_index.md>) — governance & truthful-finish campaign (prefix `DLV`, 2026-07-24), triggered by the second BUD-11 incident (`s-20260722-225601-whdv`); its resume/salvage items (DLV-13) build on this campaign's fork/handoff machinery.
- **Grammar:** [_Conventions](<../_Conventions.md>) — prefix `DW` registered in §5.
