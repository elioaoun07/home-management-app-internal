---
created: 2026-07-16
updated: 2026-07-16
type: action-plan
status: living
owner: Elio
tags: [pm/action-plan, tooling/delivery]
---

# Delivery Workspace · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Sequencing rationale

**DW-1 is the non-negotiable foundation** — no conversation viewer, Q&A ledger, or compaction is possible without first capturing the full-fidelity transcript and per-turn usage that today's `events.ndjson` truncates away. Everything else builds on it.

```
DW-1 (flight recorder)
 ├─ DW-2 (launch config + capability manifests)      — parallelizable after DW-1
 ├─ DW-3 (conversation viewer + usage panels)         — parallelizable after DW-1
 ├─ DW-4 (pause + same-provider config change)        — parallelizable after DW-1
 └─ DW-5 (memory ledger + Q&A)                        — parallelizable after DW-1
      │
      ├─ DW-6 (timeline redesign)         — needs DW-3 + DW-5
      └─ DW-7 (context engine: rotation, packages, inspector, rehydration)  — needs DW-1 + DW-5
            │
            ├─ DW-8 (provider handoff)    — needs DW-4 + DW-7 (handoff = rotation to a different provider + a verification turn)
            └─ DW-9 (fork + lineage)      — needs DW-7

DW-10 (mid-turn abort, gated) — needs DW-4, independently schedulable
```

No slice changes state-machine transition semantics or gate behavior, so none of this blocks — or is blocked by — S4 (build-loop MVP acceptance) or the pending live-provider-turn approval in `Agentic Delivery Workspace/6 - Roadmap, Testing & Risks.md`. Every slice ships fake-driver-tested; only a handful of specific checks (real per-turn model override, real handoff quality, real usage-field fidelity) are parked behind that approval.

## Slice sequence

| Slice | Name | Depends on | Rough effort | Owner asks satisfied |
|---|---|---|---|---|
| **DW-1** | Flight recorder (transcript + per-turn usage + config) | — | 4–5d | foundation for all ten |
| **DW-2** | Launch config + capability manifests | DW-1 | 2d | provider/model/effort selection at launch |
| **DW-3** | Conversation viewer + usage panels | DW-1 | 4–5d | conversation viewer, usage visibility |
| **DW-4** | Controls: pause + same-provider config change | DW-1 | 3d | pause/resume, mid-Delivery model/effort change |
| **DW-5** | Memory ledger + Q&A | DW-1 | 3–4d | Q&A area, provider-neutral memory |
| **DW-6** | Timeline redesign | DW-3, DW-5 | 2d | outcome-oriented timeline, blocked-in-red |
| **DW-7** | Context engine v1: rotation, packages, inspector, rehydration | DW-1, DW-5 | 4–5d | compaction, context/cache management |
| **DW-8** | Provider handoff | DW-4, DW-7 | 3d | switch providers mid-Delivery |
| **DW-9** | Fork + lineage | DW-7 | 3d | branching, replayability |
| **DW-10** | Mid-turn abort (gated) | DW-4 | 1–2d | within-phase pause |

Full acceptance criteria per slice, the data model for every new file, the API surface, and the risk register live in the approved enhancement plan (kickoff session, 2026-07-16) — this doc tracks sequencing and status; [4 · Checklist](<4 - Checklist.md>) tracks the checkable queue.

## Program status: all ten slices shipped 2026-07-16

Every acceptance criterion in the table above was met; full per-slice evidence lives in [1 · Feature State](<1 - Feature State.md>). Summary:

- **DW-1** — `transcript/{turns.ndjson, t-NNNN.ndjson, prompts/}` written for every turn, including failures and crash-seals; v2 usage fields (`cacheCreation`, `reasoningOutput`) captured with a documented v1 fallback; `.delivery/config.json` loader in place, cost estimates stamped with `pricingVersion`; `events.ndjson`'s O(n²) reparse-per-append fixed; v1 sessions unaffected.
- **DW-2** — driver `manifest()` on all three drivers; `GET /api/delivery/capabilities`; wizard sends model/effort; server validates against the manifest.
- **DW-3** — phase/turn/record conversation viewer with search + highlighting; per-phase/per-turn usage tables; `DISCOVERY` stepper fix.
- **DW-4** — controls channel; cooperative pause/resume (execution flag, not a state); same-provider model/effort change via `resume-with-overrides`.
- **DW-5** — versioned memory ledger; blocking (gate-linked) + advisory Q&A; answers persist into every later context assembly.
- **DW-6** — outcome-card timeline; blocked state in red; tool/message noise collapsed with deep links into Conversation.
- **DW-7** — `context-policy`/`context-assembly` pure and fully unit-tested; owner-commanded rotation (digest + snapshot + fresh ref); pin/unpin rehydration; Context tab with next-turn preview.
- **DW-8** — provider handoff with a schema-validated verification turn; gaps become a blocking question, never silent continuation; effort translated via `config.effortMap`.
- **DW-9** — fork creates an independent sibling session with copied ledger/artifacts/parent link; parent pauses; UI cross-links both directions.
- **DW-10** — `pause{abortInFlight:true}` genuinely aborts a turn already in flight via a concurrent controls poller + `AbortController`; sealed `result:"aborted"`, never retried; git-guard + workspace delta always run; explicit lost-turn UI copy.

No slice changed state-machine transition semantics or gate behavior at any point. Final verification: 810/810 `tests/delivery` (28 files) + all `tests/pm-ui` passing, `pnpm typecheck` and `pnpm lint` clean, live-browser smoke-tested per slice against disposable fixture sessions (none left behind in `.delivery/sessions/`).
