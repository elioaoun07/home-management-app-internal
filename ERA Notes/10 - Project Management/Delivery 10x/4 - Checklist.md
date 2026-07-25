---
created: 2026-07-24
updated: 2026-07-25
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

**Mobile Command Surface** — `/pm/live`, a phone-installable checklist + delivery command surface. Outbound-only Supabase relay from `pnpm pm --bridge`; amends (does not reopen) the "Remote decision controls" rejection in [6 · Design Debates](<6 - Design Debates & Rejected Ideas.md>) — gate approval (spec/plan/uat/blocked) stays laptop-only.

- [x] **DLV-20** Mobile command channel: bridge drainer + allowlist mapping every phone command onto the existing `routeDelivery()` gates (capture/undo/preflight/launch/pause/abort-turn/resume/cancel/answer/ask); `set-budget`/`set-config`/`rotate`/`fork` and any spec/plan/uat/blocked gate decision are never exposed → `scripts/pm/bridge.mjs`, `migrations/2026-07-25_pm-mobile-relay.sql` — `tick` removed the same day, see **DLV-23** _(blocker - M)_
- [x] **DLV-21** Mobile launch flow: flight-check + mandatory budget envelope, no default; refuses on a dirty tree or red baseline because mobile never forwards the typed `DIRTY TREE`/`RED BASELINE` ack → `scripts/pm/bridge.mjs`, `src/components/pm-live/LaunchSheet.tsx` _(blocker - S)_
- [x] **DLV-23** Mobile checklist is read-only and a row launches a delivery session instead of ticking a checkbox: `tick` refused server-side (`REFUSED_TYPES`) + dropped from the `pm_commands.type` CHECK, every bridge write journaled with a restorable pre-image under `.delivery/pm-undo/`, `undo` command + Undo strip on the phone (refuses instead of clobbering a later laptop edit). Done 2026-07-25 (same-day revocation of the tap-to-tick shipped in DLV-20). → `src/components/pm-live/board/TaskRow.tsx`, `migrations/2026-07-25_pm-commands-drop-tick.sql` _(blocker - S)_
- [x] **DLV-22** Push notification consumer for the `notification.requested` event (emitted since DLV-1, unconsumed until now) — the web-push half of **DLV-16**: gate transitions, budget events, terminal states, and runner death (60s debounce) all deep-link into `/pm/live`. DLV-16's dashboard-toast half is still open. → `scripts/pm/bridge.mjs`, `src/app/api/pm/notify/route.ts` _(friction - S)_
- [x] **DLV-24** `/pm/live` promoted from a 3-tab relay to a responsive PM application: five views (Overview / Board / Delivery / Usage / Campaigns), bottom nav under `lg` and a side rail + widget grid above it. Two new `pm_live` row kinds (`rollups`, `history`) derived laptop-side from the existing `severityItems`/`sumSeverity`/`lintChecklist` helpers — no migration, they ride the existing `(id, kind, payload jsonb)` shape. Board gains the desktop board's filter grammar plus `lane:`/`e:`, group-by, sort-by, virtualized rows and a detail sheet; a Zustand store confines the 10s heartbeat to the status chip instead of re-rendering ~480 rows. → `src/features/pm-live/derive.ts`, `src/components/pm-live/PmLiveApp.tsx` _(friction - L)_
- [x] **DLV-25** The three orphaned bridge commands get an interface: `capture` (Inbox quick-add — which also makes the DLV-23 Undo strip reachable for the first time), `ask` (free-form guidance to a running agent) and `abort-turn` ("Stop turn", beside Pause). All three were already implemented, allowlisted and tested server-side with no way to issue one. Gate approvals stay laptop-only, unchanged. → `src/components/pm-live/CaptureSheet.tsx`, `src/components/pm-live/views/DeliveryView.tsx` _(friction - S)_
- [x] **DLV-26** Two drift fixes found while refactoring: `LANE_HINTS` was a hand-copied constant that silently diverged from `DEFAULT_CONFIG.budgets.laneDefaults` whenever `.delivery/config.json` was customized — the bridge now publishes the real values on the `fleet` row; and finished `session:<id>` rows were never deleted, so the bridge now prunes terminal sessions older than 7 days. → `scripts/pm/bridge.mjs`, `src/components/pm-live/LaunchSheet.tsx` _(annoyance - S)_
- [x] **DLV-27** PM Live renders a missing provider USD cost as unavailable, rather than crashing or showing a false zero; gate notifications use the same safe fallback. Done 2026-07-25. → `src/features/pm-live/chartTheme.ts`, `src/components/pm-live/views/DeliveryView.tsx`, `scripts/pm/bridge.mjs` _(blocker - S)_

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
- [ ] **DLV-16** Dashboard toast for gate-waiting/paused/cap-hit/finish events on `pnpm pm` itself. _(The web-push half — optional push via the app's existing infra with session deep-link — shipped as **DLV-22**, part of the Mobile Command Surface below.)_ → `scripts/delivery/events.mjs` _(friction - S)_
- [ ] **DLV-17** Watchdog + transcript integrity: stalled-session detection from runner heartbeat, stub records for aborted turns, gap check at session end → `scripts/delivery/transcript.mjs` _(annoyance - S)_
- [ ] **DLV-18** Failure-injection scenario suite on the fake driver: quota-hit, cap-hit, config corruption, retry storm, crash recovery, salvage; fix the pre-existing red `onEvent` baseline first → `tests/delivery/run-session.test.ts` _(friction - M)_
- [ ] **DLV-19** Fleet metrics on DeliveryHome: outcome distribution, cost per shipped item, intervention count, first-pass validation rate, scope-estimate accuracy → `scripts/pm/src/features/delivery/DeliveryHome.jsx` _(annoyance - S)_

## Definition of Done

- **D1** A fake-driver test exists for every M1/M3 behavior (DLV-18 scenarios green on `pnpm test`).
- **D2** No owner non-negotiable violated: no git writes, no `bypassPermissions`, 3 gates in every lane, `agent-registry.mjs` single source of truth.
- **D3** A real session (S-item, FAST lane) runs launch → ACCEPTED with: budget envelope visible, AC matrix green, finish package written, PM trace auto-appended.
- **D4** The next BUD-11-class overrun is impossible by construction: cap-hit pauses gracefully, scope mismatch trips decomposition, spend-limit errors never retry.
