---
created: 2026-07-16
updated: 2026-07-17
type: vision
status: living
owner: Elio
tags: [pm/vision, tooling/delivery]
---

# Delivery Workspace · 2 — Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## The core idea

> A Delivery owns the permanent context. Providers, models, effort levels, and sessions are replaceable execution engines attached to it.

Three layers, never conflated:

- **L0 — provider-native execution state** (Claude session, Codex thread, prompt caches). Ephemeral, non-portable, referenced only via `state.driver.ref`. Never the system of record.
- **L1 — Delivery durable store** (`.delivery/sessions/<id>/`). Full raw transcript, per-turn usage, memory ledger, Q&A, decisions, artifacts, events. Survives any provider/model/session replacement. *(DW-1 delivers the transcript + usage half of L1; the memory ledger/Q&A half is DW-5.)*
- **L2 — derived context** (versioned, rebuildable from L1). Compaction digests, context-package snapshots, pins — each carrying evidence refs back to L1 so nothing exists *only* in a summary. *(DW-7.)*

## Owner decisions (locked 2026-07-16)

*(IMPLEMENTED 2026-07-16)* Full program DW-1…DW-10 approved in dependency order — no slice deferred by scope, only by sequence.

*(IMPLEMENTED 2026-07-16)* **Digest mode: mechanical v1.** Compaction digests (the narrative summary of what happened in a phase, used when rebuilding context on rotation/handoff) are built deterministically from turn metadata, artifacts, build-log, and validation results — free, no token spend. Agent-written digests (better prose, costs tokens) land later behind `config.context.digestMode`, off by default. **Ledgers, decisions, Q&A and constraints are never summarized away regardless of digest mode** — only the conversation-flow narrative is compacted.

*(IMPLEMENTED 2026-07-16)* **Mid-turn abort: included, gated (DW-10).** Default Pause stays boundary-only (today's doctrine: an in-flight turn always completes). A separate explicit "Stop turn now" control wires the SDK's `AbortController`/`signal`, with an explicit lost-work warning in the UI and mandatory post-abort git-guard + workspace-delta checks.

*(IMPLEMENTED 2026-07-16)* **PM tracking: new `Delivery Workspace` campaign, prefix `DW`**, cross-linked from `Agentic Delivery Workspace/` rather than folded into its roadmap doc — this enhancement is large enough to want its own checkable queue.

*(IMPLEMENTED 2026-07-17)* **BUD-11 root-cause fixed at the source, not just backstopped.** The instinct after a 3M-token runaway session is "add budgets" — that alone would have stopped the bleed but not delivered BUD-11's actual task. Ranked and shipped in this order: (1) DW-11's four correctness bugs (per-phase driver mode, path-guard normalization, quota-error classification, transcript completeness) — these are what actually caused both the token burn *and* the non-delivery; (2) DW-12's validation baselining (stop fixing pre-existing bugs the session didn't cause); (3) DW-12's token/cost budgets as the backstop; (4) DW-13's model/effort recommendation as ongoing cost hygiene. BUD-11 ran on `claude-haiku-4-5` (the cheapest model) the whole time — expensive-model selection was never the cause, volume was.

*(IMPLEMENTED 2026-07-17)* **Model/effort recommendation is always opt-in, never auto-applied.** DW-13's `recommendAgentConfig()` pre-fills the launch wizard's model/effort selects via an explicit "Use recommendation" button; the owner's manual choice always wins, with only a passive delta note if it diverges. No mid-session auto-override was built — see the deferred mid-session-advisory note in file 1.

## Decisions still open (recommendations carried in the plan, not yet re-confirmed)

- **Transcript retention:** warn-only (`warnSessionMB:200`) vs. auto-archival of terminal sessions. Recommendation: warn-only in v1. Shipped as designed (DW-1); still open whether auto-archival is ever wanted.
- **Pricing ownership:** owner hand-maintains `.delivery/config.json` model/price entries; no auto-fetch (network + staleness risk). Shipped as designed (DW-1/DW-2). *(IMPLEMENTED 2026-07-17)* Claude catalog populated (DW-13: haiku-4-5/sonnet-5/opus-4-8, real per-Mtok pricing, tiered economy/standard/premium); Codex catalog still empty, left for the owner to fill in rather than fabricated.
- **Recommendation history lookback:** DW-13 shipped with a static per-tier token/cost estimate only — median-of-past-same-tier-sessions was designed but not wired, because `state.usage.total`'s v1 shape doesn't match the v2 shape the estimator expects (see file 1's Known gaps). Open until a shape-translation or turns.ndjson-reduction path is built.
- **Q&A → PM markdown writeback:** should an answered *blocking* question append to a campaign decision log (HR25-style), or stay session-local? Shipped session-local (DW-5) as recommended; writeback remains a later explicit opt-in, not built.
- **Default thresholds:** `rotateAtTokens:150k`, `hardCeilingPct:0.85`, `recentTailTurns:3`, `forkAfterPhaseRetries:2`, `warnSessionUsd:10`, `maxTurnBudgetUsd` unset. DW-7 shipped the owner-commanded `rotate` control only — these thresholds are defined in `config.mjs` but not yet wired to an automatic trigger, so they remain unconfirmed in practice.
- *(IMPLEMENTED 2026-07-16)* **Pause as an execution flag, not a state-machine state** (composes with existing gates without touching the pure transition table) — shipped in DW-4 exactly as designed; DW-10's abort reuses the same flag (`abortInFlight` on the `pause` control) rather than introducing a second mechanism.
- **Claude `enableFileCheckpointing`:** deliberately NOT adopted — provider-lock risk; workspace delta + owner-run git stays the portable recovery story. Unchanged through DW-10 (the abort flow's "workspace delta" surfacing reinforces this choice rather than revisiting it).

## What does NOT transfer across providers (the handoff contract, DW-8)

Provider thread/session state · prompt caches (cost spike on the first post-switch turn, always shown as an estimate before the switch) · Claude's native compaction summaries · reasoning/thinking traces (kept in the transcript for humans, never replayed into the other provider) · effort enums (translated via `config.effortMap`) · sandbox/permission configs (manifest-mapped, not copied).

## Relationship to the base Delivery plan

`Agentic Delivery Workspace/` remains authoritative for: the state machine, packet schema v1, the classifier, the Agent Catalog/registry, the driver security model (git-read-only enforcement, `canUseTool`, sandboxing), and the S1–S6 slice history. This campaign never contradicts or forks those documents — it adds a durable-memory layer on top, and DW-slice acceptance criteria explicitly forbid changing state-machine transition semantics.
