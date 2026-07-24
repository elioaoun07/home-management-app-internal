---
created: 2026-07-24
updated: 2026-07-24
type: vision
status: living
owner: Elio
tags: [pm/vision, tooling/delivery]
---

# Delivery 10x — Vision & Architecture

> **The 10/10 definition.** A delivery session is: **reliable** (no silent death states — every end state is deliberate), **usable** (the owner always knows what is happening and what is needed from them), **functional** (validation always completes or its skipping is explicit; claims are always evidence-backed), **dependable** (every session — even a failed one — ends with a finish package and a PM trace), and **optimal** (the session's model, effort, context, and budget match the task's measured size, and the owner set that envelope knowingly before launch).
>
> **The organizing correction** (owner, 2026-07-24): the first analysis of the failed session over-weighted *reacting better to failures* (spend-limit handling, crash recovery). Those are the floor, not the ceiling. The defect that matters is that the system offered **no proactive governance** — the owner could not set a budget, could not see scope-vs-model fit, could not right-size the session. 10x = governance-first architecture; reliability fixes ride along underneath it.

---

## M1 — Governed Start

*The owner controls the envelope before a single token is spent.*

### Budget governance (centerpiece)

*(IMPLEMENTED 2026-07-24 — DLV-1 packet envelope, launch fields, boundary enforcement, one-shot warning, graceful budget pause/finish artifact, and audited raise-only resume. DLV-6 will attach the already-configured FAST/STANDARD/DEEP defaults to explicit lane selection.)*

Every session launches with an explicit **budget envelope**, owner-set (with lane defaults, §M2):

- **Caps:** `maxSessionUsd` and/or `maxSessionTokens`, plus optional per-phase caps (BUILDING is where 86% of the failed session's cost accrued).
- **Warn threshold** (default 80%): dashboard banner + notification; session continues.
- **Hard cap:** the runner finishes the in-flight turn, then performs a **graceful pause** — writes the finish package (§M3), sets an explicit `awaiting.reason: "budget-exhausted"`, and notifies. Never a dead `BLOCKED` mid-thought.
- The envelope lives **in the packet** (immutable record of what was authorized) with live raises allowed via `/api/delivery/control` (audited as decisions).
- Machinery already exists (`scripts/delivery/budgets.mjs` — pure verdict functions; `state.usage` accumulation) — the work is wiring it into the packet, the runner loop, the launch UI, and `UsageView.jsx`. **Why it never engaged on 2026-07-22:** every key optional and unset, no UI surface, and the base plan's "unset until baselined" stance. That stance is now revoked: *an owner-set envelope is mandatory at launch* (a deliberate "no cap" choice must be typed, not defaulted into).

### Preflight Flight-Check (one screen before launch)

*(IMPLEMENTED 2026-07-24 — DLV-2 consolidates the item/available ACs, lane and model/effort recommendation, required budget, context manifest estimate, capability/risk preview, and DLV-5 baseline acknowledgments into one launch panel. `/api/delivery/start` requires the reviewed Flight-Check marker and persists a server-reconstructed snapshot into `packet.json`; DLV-6/DLV-8 will later make lane policy and context budgets operational.)*

Nothing starts until the owner has seen, on a single screen:

1. The item + its acceptance criteria (or note that ACs will be authored at SPEC — see scope contract).
2. **Lane** (§M2) + recommended model/effort from `recommendation.mjs`, with a visible mismatch warning.
3. **Budget envelope fields** (required).
4. **Baseline status:** dirty tree? baseline validation red? — each requires explicit acknowledgment (§DLV-5). *(IMPLEMENTED 2026-07-24)*
5. **Context manifest preview:** what files/skills/campaign docs will be loaded per phase, and the estimated context weight (§M2).
6. Capability set + risk flags (existing preview, kept).

### Reliability floor (supporting, not headline)

- **Config hardening:** schema-validate `.delivery/config.json` on load with a precise error surfaced as a session event + dashboard banner; atomic temp+rename writes; crash-loop backoff in the runner (`N` rapid identical crashes → stop respawning, mark session `awaiting.reason: "runner-crash"`, notify). *(IMPLEMENTED 2026-07-24)*
- **Error taxonomy:** extend `quota.mjs` patterns (the "monthly spend limit" gap) and make the classification *sticky and visible* — quota/spend/auth errors are never retried, carry `resetsAt` when parseable, and produce a paused-not-dead state with one-click resume. *(IMPLEMENTED 2026-07-24)*
- **Retry escalation:** max N identical auto-retries per gate (config), then `NEEDS_DECISION` + notification. A retry storm is a bug signal, not a strategy. *(IMPLEMENTED 2026-07-24)*

---

## M2 — Right-Sized Delivery

*The session's weight matches the task's weight.*

### Delivery lanes — FAST / STANDARD / DEEP

A **lane** is a named policy bundle applied at launch — it configures the existing state machine, never forks it:

| Policy | FAST | STANDARD | DEEP |
|---|---|---|---|
| Intended for | S items, single-module, no risk flags | default | L items, money-domain, db-migration/security flags |
| Effort defaults | low across phases | current defaults | high plan/building |
| Context budget | minimal (item + module map + 1 skill) | current | full campaign + domain skills |
| Validation contract (§M3) | typecheck + targeted tests | typecheck + lint + targeted tests | full ladder (typecheck+lint+test) |
| Budget default | small (e.g. $0.50) | medium | owner-set, larger |
| Definition of done | ACs + delta-green validation | + docs touched | + full ladder green + risk register |

> **Owner decision flag — gates per lane.** The base plan's non-negotiable is **always 3 gates**. An "AUTO lane" (no gates) was proposed by an external critique and is **recommended against** (see [6 · Design Debates](<6 - Design Debates & Rejected Ideas.md>)): FAST compresses effort/context/validation, **not oversight**. If the owner ever wants gate-free delivery for doc-only items, that is an explicit revision of the standing rule, recorded in the base plan's `_index.md`, not a lane setting.

### Scope contract + auto-decomposition

- DISCOVERY must emit a **measured scope estimate** in the spec JSON: files touched, occurrences/instances, modules crossed, and a size class (S/M/L by config thresholds).
- **Tripwire:** measured size class > packet effort (or > lane capacity) ⇒ the SPEC gate is presented as a **decomposition proposal** — sub-packets with their own ACs (e.g. BUD-11 → "constants + Budget module" / "Schedule+Kitchen migration" / "remaining modules + enforcement test flip"), each independently deliverable. The owner approves the split or consciously overrides with a typed acknowledgment.
- **Scope lock:** after PLAN approval, the AC list and the plan's file scope are frozen; the agent adding scope mid-BUILDING requires a `NEEDS_DECISION`, not silent expansion. (The failed session's inverse — silent *de*scoping — is caught by the AC matrix, §M3.)

### Context governance

- Per-phase **context budgets** (token weight) and **selective loading** — v2 of `context-assembly.mjs`/`context-policy.mjs`: FAST lane loads the item, the module's Feature Map entry, and at most one skill; DEEP loads campaign docs + domain skills.
- The **loaded-context manifest** is persisted per turn (what was included and why, with sizes) — it powers the flight-check preview and post-hoc cost forensics. Evidence for why: 8.7M cached-input tokens on a Haiku session.

### Model/effort fit guard

`recommendation.mjs` runs twice: at launch (heuristic, from item text/effort/risk) and **after discovery** (from the measured scope estimate). A mismatch (Haiku/low vs measured 25-file refactor) raises a warning gate the owner must acknowledge — it never silently blocks, it makes the tradeoff visible.

---

## M3 — Truthful Finish

*Every session ends in a deliberate, honest, recoverable state.*

- **AC coverage matrix as first-class state:** every acceptance criterion tracked in `state.json` (`unmet / met / waived / failed`, with evidence pointer). Rendered in `SessionDetail.jsx`. UAT_READY is blocked while any AC is `unmet` unless the owner waives it (audited). "✅" prose in build logs is decoration; the matrix is truth.
- **Evidence-gated claims:** a step or AC may only be marked `met` with a pointer to a validation artifact (test run, typecheck delta, file diff). The runner enforces this at phase exit, not the agent's honesty.
- **Risk-based validation contract:** validation depth comes from the lane (table above) — but *any* skipped rung is recorded as an explicit, visible decision in the report, never a silent `(skipped)` line. Delta-vs-baseline passing (from DLV-5) applies at every rung.
- **Finish package on every terminal/paused state** (BLOCKED, budget-exhausted, quota-paused, CANCELLED, ACCEPTED alike):
  1. **Changed-file ownership manifest** — every file touched, by which phase/turn, tied to which plan step.
  2. **AC matrix snapshot** with per-AC status.
  3. **Remaining-work package** — machine-readable enough to seed a resume packet.
  4. **Exact recovery/revert instructions** — display-only commands, owner-executed (git ban unchanged).
  5. **Unresolved-risk register** — e.g. "committing now ships a failing enforcement test."
- **PARTIAL as an honest outcome** — expressed via existing states + `awaiting.reason` + finish package (no transition-table change without owner approval), so "Budget module done, 67 occurrences remain" is a first-class, resumable result instead of archaeology in a build log.
- **Resume & salvage** — a paused/blocked session can spawn a **continuation packet** from its remaining-work package, reusing the DW handoff/rotation/fork machinery. No new engine.
- **PM trace as an exit effect:** the state machine's terminal/paused transitions emit a writeback effect — progress note into the campaign's Feature State (and checkbox tick only on ACCEPTED, as today). An agent cannot skip it, because it isn't the agent's job.

---

## M4 — Operability & Proof

- **Session UX:** persistent header answering *"what is happening right now"* + *"what do you need from me"*; cleaner phase timeline; dedicated Q&A view (audit `TimelineView.jsx`/`ConversationView.jsx` first — partially exists).
- **Notifications:** gate-waiting / paused / cap-hit / crash → the app's existing push infra (`src/app/api/notifications/`, `push_subscriptions`) with a dashboard deep-link; channel configurable in `.delivery/config.json`.
- **Watchdog & integrity:** stalled-session watchdog on `runner.json` heartbeat (stale heartbeat + non-terminal state ⇒ flag + notify); transcript completeness check at session end (no turn-number gaps; aborted/zero-usage turns recorded with a reason event).
- **Failure-injection scenarios, right-sized:** extend `drivers/fake.mjs` + `tests/delivery/run-session.test.ts` with: quota-hit mid-BUILDING, malformed config at loop entry, retry storm, crash-recovery reconciliation, budget cap-hit graceful pause. No new framework.
- **Fleet metrics (lightweight, automatic):** outcome distribution, cost per shipped item, human-intervention count, first-pass validation rate, scope-estimate accuracy — computed from session files, shown on `DeliveryHome.jsx`. This replaces formal benchmarking (see file 6).

---

## Owner decisions recorded / pending

| Decision | Status |
|---|---|
| Budget envelope mandatory at launch (typed "no cap" to opt out) — revokes the base plan's "unset until baselined" default | ✅ Direction set by this campaign (2026-07-24); confirm wording at DLV-1 implementation |
| Lanes never change gate count; AUTO lane rejected as-is | ✅ Recommended + recorded in file 6; owner may revisit explicitly |
| PARTIAL expressed without transition-table changes | ✅ Default; owner approval required to add a real state |
| Notifications channel (push vs dashboard-only) | ⏳ decide at DLV-16 |
