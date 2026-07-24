---
created: 2026-07-24
updated: 2026-07-24
type: reference
status: living
owner: Elio
tags: [pm/reference, tooling/delivery]
---

# Delivery 10x — Design Debates & Rejected Ideas

> **Why this file exists:** the campaign was shaped by two analyses — a code-forensic postmortem (this repo's session files) and an external AI critique the owner used to sharpen direction. The owner's standing instruction is *challenge proposals, don't absorb them*. This file records the disposition of every contested idea so future sessions don't relitigate. The external critique's structural contribution — **outcome milestones over a flat bug list, and governance over repair** — was adopted; individual items below were judged on their own merits.

## Adopted (with right-sizing)

| Idea | Disposition |
|---|---|
| Outcome milestones instead of 14 flat fixes | ✅ Adopted — M1–M4 structure (file 2). |
| Budget controls, scope tripwire, model guard to **Now** | ✅ Adopted — they are M1/M2's core; the original draft had them mid-list. |
| Risk-based validation instead of "always full ladder" | ✅ Adopted (DLV-11) — with the amendment that *skips are always explicit and authorized*, because silent `(skipped)` lines are exactly what the failed session produced. |
| FAST/DEEP lanes | ✅ Adopted as FAST/STANDARD/DEEP policy bundles (DLV-6) — but lanes never alter gate count (see rejections). |
| Context budgets, selective loading, loaded-context manifest | ✅ Adopted (DLV-8) — as v2 of the existing `context-assembly.mjs`/`context-policy.mjs`, not a new engine. |
| AC coverage matrix, evidence-backed completion, remaining-work package, revert instructions, risk register, PARTIAL outcome | ✅ Adopted (DLV-10, DLV-12) — PARTIAL expressed via existing states + `awaiting.reason`, no transition-table change without owner approval. |
| Failure-injection / crash-recovery / retry-storm / quota testing | ✅ Adopted (DLV-18) — as scenario cases on the existing fake driver + `tests/delivery/run-session.test.ts`, **not** a new test framework. |
| Stalled-session watchdog, transcript integrity | ✅ Adopted (DLV-17). |
| Preflight summary / launch recommendation screen | ✅ Adopted and promoted to M1 centerpiece (DLV-2 Flight-Check). |

## Rejected / deferred

| Idea | Disposition | Rationale |
|---|---|---|
| **Automatic provider fallback** (Claude↔Codex mid-session) | ❌ Rejected | Cross-provider auth, cost, and behavior differences make silent fallback risky; the DW layer already supports **deliberate** provider handoff/rotation at a human gate. A failing provider should pause and ask, not silently switch who is editing the tree. |
| **Remote decision controls** | ❌ Rejected (reframed) | pm-server is loopback-bound by design (net-guard; `--lan` is the only sanctioned widening). Exposing gate decisions remotely reverses the security posture. What survives: push notifications (DLV-16) deep-linking into the dashboard the owner already trusts. |
| **Ungated AUTO lane** | ❌ Rejected as-is | Conflicts with the owner non-negotiable "always 3 gates" (base plan `_index.md`, locked 2026-07-11). FAST compresses effort/context/validation, **not oversight**. If the owner ever wants gate-free doc-only deliveries, that is a recorded revision of the base rule, not a lane flag. |
| **Formal S/M/L benchmark + Delivery-vs-direct-CLI comparison** | ❌ Rejected | A measurement science project for a solo owner with 8 sessions of history. The same questions are answered continuously and for free by DLV-19's fleet metrics (cost per shipped item, first-pass validation rate, intervention rate, scope-estimate accuracy). Revisit only if fleet volume makes A/B meaningful. |
| **Conversation search & highlighting** | ⏸ Deferred | Real but polish-tier; not on the dependability path. Candidate for a Later DLV item once M1–M3 ship. |
| **"Avoid locking exact files/functions too early"** | ◐ Partially rejected | This repo's playbook culture works *because* docs anchor to verified files. Compromise: the Action Plan anchors files as starting points with a freshness protocol, and specifies contracts, not diffs. |
| **Idempotent transitions / duplicate side-effect prevention as new work** | ◐ Right-sized | The transition table is already pure and crash reconciliation exists. This became *verify-and-harden* inside DLV-18's scenarios (e.g. PM-writeback idempotency in DLV-14's acceptance) rather than a standalone rebuild. |
| **Mid-session model/effort switching, pause/resume/cancel, provider switching** | ✅ Already exists | Shipped in the DW campaign (`/api/delivery/control`, `controls/`, handoff flow). The 10x work surfaces them better (DLV-15), it does not rebuild them. |

## Standing tensions to keep in view

- **Governance friction vs launch speed.** Mandatory budget fields + acknowledgments add clicks to every launch. Accepted deliberately: the flight-check is the product. Lane defaults (FAST pre-fills a small envelope) keep the S-item path to ~3 confirmations.
- **Runner-enforced truth vs agent autonomy.** DLV-10 moves AC status from agent prose to runner reconciliation — more machinery, less trust in the model. The failed session settles this: the economy model *will* over-claim, so truth must be structural, exactly as the git ban is enforced by construction rather than by prompt.
- **"Unset until baselined" is dead.** The base plan's token-budget stance (no defaults until a benchmark runs) produced two uncapped runaway sessions on the same item. Defaults may be imperfect; absent envelopes are worse. Recorded as an owner-direction change, 2026-07-24.
