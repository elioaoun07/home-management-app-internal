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
| 7 | [Cost Anatomy (DLV-28 smoke tests)](<7 - Cost Anatomy (DLV-28 smoke tests).md>) | You need to know what a session actually spends money on, whether cost scales, or whether a given item is worth running through the pipeline at all. |

## Smoke Tests

Real end-to-end delivery pipeline validation: a FAST-lane session reaching ACCEPTED with all D3 gate criteria met.

| Date | Session ID | Outcome |
|---|---|---|
| 2026-07-25 | s-20260725-151324-23aw | CANCELLED - stranded at PLAN_READY by DLV-29 (owner-gate lost after a budget-exhausted collision) |
| 2026-07-25 | s-20260725-154808-p1im | CANCELLED - stranded at UAT_READY by the same DLV-29 collision, second reproduction |
| 2026-07-25 | s-20260725-181118-xdl9 | ACCEPTED - first session to complete the pipeline end-to-end. Hit the DLV-29 collision twice more in flight (PLAN_READY, then UAT_READY) with the fix live; both times `awaiting` was correctly restored after an owner-authorized raise and the session proceeded. Marked SHIPPED 2026-07-29 (had sat ACCEPTED-not-shipped for 4 days, silently holding the global build lock — see DLV-42/43/44 smoke test row below) |
| 2026-07-29 | s-20260729-121840-pdhx | CANCELLED - owner-run FAST-lane smoke test on a genuinely trivial S-effort item (BUD-14, mobile expense form quick-amount chip). Never reached BUILDING: DISCOVERY exhausted `maxInternalTurns` before finishing, both auto-retries and a post-guidance resume all crashed instantly, escalated to NEEDS_DECISION twice. Surfaced 3 new findings — DLV-42 (money-domain triage-gate false positive from item wording alone), DLV-43 (budget/usage accounting records $0 for a failed turn), DLV-44 (resume-after-max-turns crash loop). Positive finding: the retry-exhaustion escalation itself worked correctly both times — stopped and asked rather than looping silently. **Corrected 2026-07-30:** the "~$0.34 / 512K tok" originally recorded here was inflated ~2.4x by counting duplicate raw-jsonl records — deduplicated, the real spend was **$0.1026 / 210,193 tok** (DLV-47). |
| 2026-07-30 | s-20260730-104900-9mfu | CANCELLED at the budget gate, **$0.5317 spent, zero lines of code changed** - re-run of the same BUD-14 item after DLV-42…51. **DISCOVERY completed on the first attempt** where the 07-29 run could not finish at all: 6 tool calls / 7 internal turns (was 13 and a ceiling hit), 149,760 tok / **$0.1048**, complete 5-AC spec written. Confirms in a real session: `established` now persists (DLV-44), the FAST reading list is trimmed (DLV-45), the flight check recommends FAST not DEEP (DLV-42), and recorded usage matches the deduplicated raw transcript **exactly** (DLV-47). All three human gates were honoured by the owner. Then the gates themselves surfaced six more findings — DLV-53 (plan rejection routed to DISCOVERY, so the owner's re-plan instruction reached a phase that cannot plan), DLV-54 (`packet.mode: "uat"` read by the agent as its current phase), DLV-55 (`maxPlanSteps` advisory-only: 6 steps for a one-line edit), DLV-56 (forecast off by 3.0x with 4 phases unrun), DLV-57 (economy `plan` effort at `medium` cost $0.1857 to decompose one line), DLV-59 (the triage gate could never fire for a UI item). **DLV-58 is the positive finding: the $0.50 cap held, pausing the session with the underlying phase gate correctly preserved** — DLV-29's fix working on real spend. All but DLV-52/56 fixed the same day. **Verdict recorded: the FAST lane is now genuinely fast and correct, but it cannot beat editing by hand on an item this size, and it was never going to — the floor is ~5 phases each paying its own cache-creation cost. BUD-14 is the item the pipeline should refuse, and after DLV-59 it does.** |

## Scope contract

- **Relationship to sibling folders — cross-reference, don't fork:**
  - [Agentic Delivery Workspace](<../Agentic Delivery Workspace/_index.md>) stays authoritative for the base architecture: state machine, packet, drivers, gates, dashboard UX, and the owner non-negotiables.
  - [Delivery Workspace](<../Delivery Workspace/_index.md>) (prefix `DW`, shipped) stays authoritative for the durable-memory layer: transcripts, ledger, context packages, pause/resume, handoff/rotation/fork. DLV resume/salvage work builds **on** that machinery, never beside it.
- **All owner non-negotiables from the base plan apply unchanged:** no git writes ever (worktrees banned permanently) · never `bypassPermissions` · `agent-registry.mjs` is the single source of truth for the Agent Catalog · Product Phase 1 = standard agent set only · always 3 human gates (any lane that wants to change gate policy is an explicit owner decision — see file 2 §Owner decisions).
- **This campaign changes governance and contracts, not state-machine semantics.** Where a new outcome is needed (e.g. `PARTIAL`), it is expressed through existing states + `awaiting.reason`/finish-package artifacts unless the owner explicitly approves a transition-table change.

## Where this fits

- Up one level: [10 - Project Management/_index.md](<../_index.md>)
- Grammar: [_Conventions](<../_Conventions.md>)
