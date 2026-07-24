---
created: 2026-07-24
updated: 2026-07-24
type: checklist
status: active
owner: Elio
tags: [pm/checklist, tooling/delivery]
---

# Delivery 10x — Checklist

> Grammar per [_Conventions](<../_Conventions.md>) (prefix `DLV`). Design detail per item: [3 · Action Plan](<3 - Action Plan.md>). Evidence: [5 · Session Postmortem](<5 - Session Postmortem (s-20260722-225601-whdv).md>).

## Now

**M1 — Governed Start** — the owner sets the envelope before a token is spent; the floor never crashes silently.

- [x] **DLV-1** Budget governance: owner-set cost/token envelope in the packet, between-turn enforcement, warn threshold, graceful cap-hit pause with finish package → `scripts/delivery/budgets.mjs` _(blocker - M)_
- [x] **DLV-2** Preflight Flight-Check screen: one pre-launch panel with ACs, lane/model recommendation, required budget fields, baseline/dirty acknowledgments, context preview; snapshot persisted into the packet → `scripts/pm/src/features/delivery/DeliveryHome.jsx` _(blocker - M)_
- [x] **DLV-3** Config hardening: schema-validated `.delivery/config.json` with last-known-good fallback + dashboard banner, atomic writes, runner crash-loop backoff → `scripts/delivery/config.mjs` _(blocker - S)_
- [x] **DLV-4** Error taxonomy + retry escalation: close the "monthly spend limit" pattern gap, quota/auth never retried (paused + resumable), max auto-retries per gate then NEEDS_DECISION with notification → `scripts/delivery/quota.mjs` _(blocker - S)_
- [x] **DLV-5** Baseline & change-ownership gate: typed acknowledgments for dirty tree and red baseline, delta-vs-baseline validation semantics, pre-existing edits recorded as not-session-owned → `scripts/delivery/validation-baseline.mjs` _(friction - M)_

## Next

**M2 — Right-Sized Delivery** — session weight matches task weight.

- [ ] **DLV-6** Delivery lanes FAST/STANDARD/DEEP as packet-resolved policy bundles (effort, context budget, validation contract, budget defaults); gates never vary by lane → `scripts/delivery/packet.mjs` _(friction - M)_
- [ ] **DLV-7** Scope contract: measured scope estimate required in every spec, SPEC-gate tripwire renders a decomposition proposal on effort mismatch, scope locked after PLAN → `scripts/delivery/prompts.mjs` _(blocker - M)_
- [ ] **DLV-8** Context governance: per-lane per-phase context budgets, selective loading with recorded drops, persisted loaded-context manifest surfaced in flight-check and UsageView → `scripts/delivery/context-assembly.mjs` _(friction - M)_
- [ ] **DLV-9** Model/effort fit guard: recommendation re-run post-discovery against measured scope, mismatch warning on the SPEC gate with audited acknowledgment → `scripts/delivery/recommendation.mjs` _(friction - S)_

**M3 — Truthful Finish** — every session ends deliberately, honestly, recoverably.

- [ ] **DLV-10** AC coverage matrix as first-class state: per-AC status with evidence pointers, runner-reconciled at phase exit, UAT_READY blocked while ACs unmet/unwaived → `scripts/delivery/run-session.mjs` _(blocker - M)_
- [ ] **DLV-11** Risk-based validation contract: lane-defined ladder, every skipped rung explicit and authorized, delta-vs-baseline at each rung, targeted-test mode for FAST → `scripts/delivery/run-session.mjs` _(friction - M)_
- [ ] **DLV-12** Finish package on every terminal/paused exit: ownership manifest, AC snapshot, remaining-work package, display-only recovery instructions, risk register → `scripts/delivery/run-session.mjs` _(blocker - M)_
- [ ] **DLV-13** Resume & salvage: continuation packet built from remaining-work via DW fork/handoff, predecessor marked superseded, fresh flight-check on relaunch → `scripts/delivery/memory.mjs` _(friction - M)_
- [ ] **DLV-14** PM trace as state-machine exit effect: ACCEPTED keeps the checkbox tick, PARTIAL/BLOCKED/CANCELLED append a drift-guarded dated progress bullet to the campaign Feature State → `scripts/delivery/server-routes.mjs` _(friction - S)_

## Later

**M4 — Operability & Proof.**

- [ ] **DLV-15** Session UX: persistent "what's happening / what you need to do" header, action strip for pending owner actions, dedicated Q&A tab → `scripts/pm/src/features/delivery/SessionDetail.jsx` _(annoyance - M)_
- [ ] **DLV-16** Notifications for gate-waiting/paused/cap-hit/finish events: dashboard toast always, optional web push via the app's existing push infra with session deep-link → `scripts/delivery/events.mjs` _(friction - M)_
- [ ] **DLV-17** Watchdog + transcript integrity: stalled-session detection from runner heartbeat, stub records for aborted turns, gap check at session end → `scripts/delivery/transcript.mjs` _(annoyance - S)_
- [ ] **DLV-18** Failure-injection scenario suite on the fake driver: quota-hit, cap-hit, config corruption, retry storm, crash recovery, salvage; fix the pre-existing red `onEvent` baseline first → `tests/delivery/run-session.test.ts` _(friction - M)_
- [ ] **DLV-19** Fleet metrics on DeliveryHome: outcome distribution, cost per shipped item, intervention count, first-pass validation rate, scope-estimate accuracy → `scripts/pm/src/features/delivery/DeliveryHome.jsx` _(annoyance - S)_

## Definition of Done

- **D1** A fake-driver test exists for every M1/M3 behavior (DLV-18 scenarios green on `pnpm test`).
- **D2** No owner non-negotiable violated: no git writes, no `bypassPermissions`, 3 gates in every lane, `agent-registry.mjs` single source of truth.
- **D3** A real session (S-item, FAST lane) runs launch → ACCEPTED with: budget envelope visible, AC matrix green, finish package written, PM trace auto-appended.
- **D4** The next BUD-11-class overrun is impossible by construction: cap-hit pauses gracefully, scope mismatch trips decomposition, spend-limit errors never retry.
