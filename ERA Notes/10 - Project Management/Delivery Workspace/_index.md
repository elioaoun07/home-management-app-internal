---
created: 2026-07-16
updated: 2026-07-16
type: index
status: living
owner: Elio
tags: [pm/index, tooling/delivery]
---

# Delivery Workspace — Command Center

> Implementation trace for the "Durable Delivery Memory" enhancement: evolving the Delivery feature (`scripts/delivery/`, `scripts/pm/src/features/delivery/`) into a provider-neutral workspace where a deliverable retains its full history, context, decisions, execution state, artifacts and usage data independently of the AI provider, model or session used.
>
> **Status: shipped.** All ten slices (DW-1 → DW-10) landed 2026-07-16 — see [1 · Feature State](<1 - Feature State.md>) for the per-slice evidence. This doc set stays living for whatever follow-up work is scoped next (automatic threshold rotation, agent-mode digests, live-provider verification once the pending approval clears).

| # | File | Read it when... |
|---|---|---|
| 1 | [Feature State](<1 - Feature State.md>) | You need shipped reality and evidence. |
| 2 | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | You need the design decisions and what's still open. |
| 3 | [Action Plan](<3 - Action Plan.md>) | You need the slice sequence and dependencies. |
| 4 | [Checklist](<4 - Checklist.md>) | You are executing or validating a slice. |

## Scope contract

- **Design source of truth:** the enhancement plan (rev. 2026-07-16, approved) — layer model (L0 provider-native / L1 Delivery-owned durable store / L2 derived context), full slice list DW-1…DW-10, data models, API surface, and the owner decisions recorded in file 2.
- **Relationship to `Agentic Delivery Workspace/`:** that folder is the original S1–S6 plan (state machine, packet, drivers, dashboard UX) — still authoritative for the base Delivery architecture. This campaign layers the durable-memory enhancement on top of it; it does not replace or duplicate that folder. Cross-reference, don't fork.
- **All four owner non-negotiables from the base plan still apply, unchanged:** no git writes ever (worktrees banned permanently) · never `bypassPermissions` · `agent-registry.mjs` stays the single source of truth for the Agent Catalog · Product Phase 1 = standard agent set only.
- **New non-negotiable for this campaign:** the artifact-first prompt doctrine (paths, not pasted bodies) is preserved and extended, not replaced — only small Delivery-owned ledger/digest/pin layers are ever inlined into a context package.
- **Every slice is fake-driver-testable** and changes no state-machine transition semantics — this work neither blocks nor requires S4 acceptance or the pending live-provider-turn approval.

## How to use this set

- **Daily driver while this program was active:** file 4 (the checklist), items `DW-1`…`DW-10` — all now swept as shipped (file 4's Now/Next/Later lanes are intentionally empty).
- **Files 1–3 are living:** update them if/when follow-up slices are scoped.
- **Design detail beyond what's summarized here** lives in the session record for this campaign's kickoff (2026-07-16) — the plan enumerates data models (`transcript/turns.ndjson`, `transcript/t-NNNN.ndjson`, `memory/ledger.json`, `context/`, `handoffs/`, `controls/`, `.delivery/config.json`), lifecycle flows (pause/resume, model/effort change, provider handoff, rotation, fork), the context policy engine, and the full API surface.

## Where this fits

- **Up one level:** the global command center → [10 - Project Management/_index.md](<../_index.md>).
- **Base architecture (read first if unfamiliar with Delivery):** [Agentic Delivery Workspace/_index.md](<../Agentic Delivery Workspace/_index.md>).
- **Grammar:** [_Conventions](<../_Conventions.md>) — prefix `DW` registered in §5.
