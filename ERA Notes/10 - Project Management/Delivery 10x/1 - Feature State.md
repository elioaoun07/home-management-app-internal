---
created: 2026-07-24
updated: 2026-07-25
type: feature-state
status: living
owner: Elio
tags: [pm/feature-state, tooling/delivery]
---

# Delivery 10x — Feature State

> **What this file is:** the verified current state of the Delivery feature (what exists in code as of 2026-07-24) followed by the ranked pain clusters that this campaign exists to close. Evidence for every pain bullet lives in [5 · Session Postmortem](<5 - Session Postmortem (s-20260722-225601-whdv).md>).

---

## 1. What exists today (verified against code, 2026-07-24)

**Working and proven in the 2026-07-22 session:**

- **State machine + 3 human gates** — `SELECTED → DISCOVERY → SPEC_READY → PLAN_READY → BUILDING → VALIDATING → REVIEWING → UAT_READY → ACCEPTED → SHIPPED` (+ `BLOCKED/NEEDS_DECISION/FAILED/CANCELLED`), pure transition table in `scripts/delivery/state-machine.mjs`. Gates fired correctly; owner answered 4 substantive clarifying questions; spec + plan formally approved.
- **Guardrails held 100%** — zero git mutations (read-only allowlist `scripts/delivery/gitread.mjs` + post-turn HEAD/ref guards), no `bypassPermissions` (`assertNeverBypass` in `scripts/delivery/drivers/claude.mjs`), forbidden paths (`src/components/ui/**`) respected, read-only phases stayed read-only.
- **Artifact-first persistence** — packet/state/events/decisions/transcripts/memory ledger all on disk under `.delivery/sessions/<id>/`; the entire postmortem was reconstructed from files alone. This is the feature's greatest strength — preserve it in every DLV change.
- **DW durable-memory layer** (shipped, see [Delivery Workspace](<../Delivery Workspace/_index.md>)) — full transcript capture, provider-neutral ledger, pause/resume/abort controls (`controls/`), mid-session model/effort switching (`/api/delivery/control`), provider handoff/rotation/fork.
- **Validation subprocess** — killable typecheck/lint/test runner with baseline capture (`validation-baseline.mjs`); fix-loop with `maxFixLoops` cap.
- **Deterministic classifier + agent registry + recommendation engine** — `classify.mjs`, `agent-registry.mjs`, `recommendation.mjs`.

**Campaign baseline gaps (resolved below where stamped):**

- ~~**`scripts/delivery/budgets.mjs`** — global caps only, absent from packet/launch UI and ineffective in the 2026-07-22 run.~~ **Resolved by DLV-1 (2026-07-24):** owner envelope is mandatory at launch, packet-persisted, boundary-enforced, visible in Usage, and resumable only through an audited raise.
- **`scripts/delivery/quota.mjs`** — quota-vs-transient classifier built *because of* the first BUD-11 incident; its pattern list (`session limit`, `usage limit`, `rate limit`, `quota`, `429`) **did not match "You've hit your monthly spend limit"**, so the fatal error was treated as retryable-transient.

---

## 2. Pain clusters (ranked)

**Cluster A — No owner-side governance** *(the campaign's reason to exist)*

- ✅ **Budget governance shipped 2026-07-24** — the owner sets cost/token caps (or types `NO CAP`) at launch; the immutable packet records authorization; warnings are one-shot; hard caps pause between turns with a finish artifact and audited raise-only resume. → DLV-1
- ✅ **Preflight Flight-Check shipped 2026-07-24** — one launch authorization panel now shows the item/available ACs, lane + model/effort fit, required budget, context manifest estimate, capabilities/risk flags, and governed baseline acknowledgments; the server persists the reviewed snapshot into `packet.json`. → DLV-2
- ✅ **Mobile kill-switch shipped 2026-07-25** — the `whdv` postmortem's core finding was "the defect is the absence of owner-side limiters," and until now every limiter required being at the laptop. `/pm/live` (Mobile Command Surface) puts Pause/Abort-turn/Cancel in the owner's pocket — reachable in three taps from anywhere, revoke-only by construction (it can only reduce a running session's authority, never grant more), and routed through the exact same `routeDelivery()` guards the desktop UI uses. Gate approval (spec/plan/uat/blocked) and budget increases stay laptop-only. → DLV-20, DLV-21
- ✅ **Mobile write surface narrowed to zero-regret actions 2026-07-25** — the same-day sibling of the kill-switch. `/pm/live` shipped at 01:20 with tappable checkboxes; within two minutes of the bridge first going live, a tap silently marked a real PM item done (`Budget/4 - Checklist.md`, 11:17:29) with no confirmation, no trace, and no way back — and the board then *hid the row*, because done items are filtered out. Root cause is a category error, not a UI bug: the phone got a **grant** capability (assert that work is finished) on a surface built for **revoke** capabilities and glanceable one-handed taps. Fixed by removing `tick` from the channel entirely — server-side (`REFUSED_TYPES` + the `pm_commands.type` CHECK), because an installed PWA can still issue it from a cached bundle — and repointing a row tap at the delivery flight check, which is guarded (mandatory envelope, dirty-tree/red-baseline refusal) and costs nothing if abandoned. Every remaining bridge write is now journaled with a restorable pre-image and offered as an Undo on the phone. → DLV-23
- 🟠 **Scope inflates silently at SPEC time** — BUD-11 entered as `_(annoyance - S)_` "verify cache timings"; the approved spec contained 8 ACs amounting to a repo-wide 72-occurrence migration program. Nothing compared spec-implied scope against packet effort. → DLV-7
- 🟠 **Model/effort fit never re-checked** — Haiku/low was accepted for what discovery itself measured as a 25-file cross-module refactor; no warning at launch, none after discovery. → DLV-9

**Cluster B — Reliability floor** *(demoted from headline to floor, still required)*

- ✅ **Nullable provider costs no longer crash PM Live 2026-07-25** — provider usage intentionally emits `costUsd: null` when pricing is unavailable, while the delivery card and bridge notification previously called `toFixed()` unconditionally. PM Live now displays an em dash and notifications say “Cost unavailable,” preserving the distinction from a true $0.00. → DLV-27
- 🔴 **Provider spend-limit error misclassified as transient** — `quota.mjs` pattern gap ("monthly spend limit" unmatched) → blind retries → dead `BLOCKED` with `returnTo: BUILDING` and a half-migrated tree. → DLV-4
- 🟠 **Retry storm with no escalation** — 7 consecutive blocked→retry cycles (decisions 0015–0021, 20:36–20:48Z) with no note, no escalation, no notification. → DLV-4
- ✅ **Dirty/red launch baseline governed 2026-07-24** — the server fingerprints the working tree and runs validation before launch; dirty and red states require exact typed acknowledgments, packet ownership excludes pre-existing edits, and later validation passes only on a non-regressing delta with no new failure in a session-touched file. → DLV-5

**Cluster C — Untruthful finish**

- 🔴 **Progress claims contradicted by validation evidence** — build log full of "✅ COMPLETED / Perfect!" while the same period's `validation-report.md` shows ~48 typecheck syntax errors in exactly those files; **no green validation evidence exists anywhere in the session**; lint and test were `(skipped)` silently. → DLV-10, DLV-11
- 🟠 **No honest partial outcome** — the session's real result ("Budget module migrated, 67 occurrences remain, enforcement test will fail the build if committed") exists only inside the agent's build log; state says `BLOCKED`, ACs have no tracked status, no remaining-work package, no revert instructions. → DLV-12
- 🟠 **PM trace skippable** — BUD-11 still `- [ ]` in [Budget/4](<../Budget/4 - Checklist.md>); AC6's doc never written; the writeback is an agent step, not a state-machine exit effect. → DLV-14
- 🟡 **Transcript gaps** — turns jump 0012→0019; `t-0013…t-0018`, `t-0021` missing; aborted/zero-usage turns unexplained in the record. → DLV-17

**Cluster D — Operability**

- ✅ **Push notifications shipped 2026-07-25 (web-push half)** — gate-waiting, budget events, terminal states, and runner death now push to the owner's phone and deep-link into `/pm/live`, consuming the `notification.requested` event that DLV-1 emitted but nothing read until now. Dashboard-toast-on-`pnpm pm`-itself is still open. → DLV-22 (DLV-16 remainder)
- 🟡 **No fleet truth** — 8 sessions on disk: 7 CANCELLED, 1 BLOCKED, **0 SHIPPED**; nothing surfaces outcome distribution, cost per shipped item, or intervention rate. → DLV-19
- 🟡 **Session page doesn't answer "what's happening / what do you need from me"** at a glance. → DLV-15

---

## 3. Fleet snapshot (2026-07-24)

| Session | Outcome |
|---|---|
| `s-20260712-150339-7kw8`, `s-20260712-204625-4qym`, `s-20260715-214421-hvfk` (BUD-11 #1, ~3M tokens), `s-20260722-203135-cv12`, `s-20260722-205308-8sgn`, `s-20260722-221533-wous`, `s3-accept-codex-1783968103139` | CANCELLED |
| `s-20260722-225601-whdv` (BUD-11 #2, $2.91) | BLOCKED |
| **Shipped items delivered end-to-end** | **0** |

The same checklist item (BUD-11) has now consumed two failed sessions. That is the strongest single argument for M1+M2: governance and right-sizing, not more mechanics.

---

## 4. Done

- ✅ 2026-07-25 (`src/features/pm-live/types.ts`, `src/features/pm-live/chartTheme.ts`, `src/components/pm-live/views/DeliveryView.tsx`, `scripts/pm/bridge.mjs`, `tests/pm-live-derive.test.ts`) **DLV-27** — aligned PM Live’s usage contract with providers that intentionally omit a USD price. Delivery cards render `—`, never crash or pretend the amount is zero; gate notifications instead state “Cost unavailable.”
- ✅ 2026-07-25 (`src/features/pm-live/`, `src/components/pm-live/`, `src/app/pm/live/pm-live.css`, `scripts/pm/bridge.mjs`, `tests/pm-live-derive.test.ts`, `tests/pm-live-query.test.ts`) **DLV-24, DLV-25, DLV-26** — `/pm/live` promoted from a 3-tab relay to a responsive PM application. Five views (Overview / Board / Delivery / Usage / Campaigns) from one component tree: bottom nav under `lg`, side rail + widget grid above it. Two new `pm_live` row kinds — `rollups` (per-campaign lane/severity/effort counts, pain bullets, lint health) and `history` (✅ done-stamp completions) — are derived laptop-side from the *existing* `severityItems`/`sumSeverity`/`lintChecklist` helpers and cost **no migration**: they ride the existing `(id, kind, payload jsonb)` shape. The Board gains the desktop board's own filter grammar (a TS port of `queryLang.js`, parity-tested) plus `lane:`/`e:`, group-by, sort-by, virtualized rows and a detail sheet; a Zustand store confines the 10s heartbeat to the status chip rather than re-rendering ~480 rows. The three commands the bridge had always accepted but nothing could issue — `capture`, `ask`, `abort-turn` — finally have an interface, which also makes DLV-23's Undo strip reachable for the first time. Row tap moved from *launch* to *open detail* (Hard Rule 2); a tap is too cheap to spend a budget envelope on. Gate approvals, `set-budget`, `rotate` and `fork` remain laptop-only and unchanged. 75 tests; the ~200 hardcoded colour literals became a scoped `[data-pm-live]` token block.
- ✅ 2026-07-25 (`scripts/pm/bridge.mjs`, `migrations/2026-07-25_pm-mobile-relay.sql`, `src/app/pm/live/`, `src/components/pm-live/`, `src/app/api/pm/notify/route.ts`, `tests/pm-bridge.test.ts`) **DLV-20, DLV-21, DLV-22** — Mobile Command Surface. `/pm/live` is a phone-installable checklist + delivery view fed by an outbound-only Supabase relay (`pnpm pm --bridge`); pm-server's own binding stays `127.0.0.1`. Every phone command is a thin allowlisted wrapper around the existing `routeDelivery()` handlers — no new delivery business logic. Revoke-tier (pause/abort-turn/cancel) is always reachable; grant-tier (launch, with a mandatory envelope; answer, only on an open question gate) is deliberately narrower; gate approval and budget increases are never exposed. Push notifications consume the previously-unread `notification.requested` event. Amends, and does not reopen, the "Remote decision controls" rejection — see [6 · Design Debates](<6 - Design Debates & Rejected Ideas.md>).
- ✅ 2026-07-24 (`scripts/delivery/recommendation.mjs`, `scripts/delivery/packet.mjs`, `scripts/delivery/server-routes.mjs`, Delivery PM launch UI, focused delivery tests) **DLV-2** — launch now requires one reviewed Flight-Check with a valid FAST/STANDARD/DEEP lane and budget/baseline authorization. The panel surfaces campaign Action Plan ACs (or the SPEC fallback), a broad-scope-aware model recommendation and mismatch warning, an estimated per-phase context manifest, and capabilities/risk signals; the server reconstructs and persists the authoritative snapshot in `packet.json`.
- ✅ 2026-07-24 (`scripts/delivery/validation-baseline.mjs`, `scripts/delivery/run-session.mjs`, `scripts/delivery/server-routes.mjs`, Delivery PM launch UI, focused delivery tests) **DLV-5** — launch preflight now persists an authoritative baseline receipt, lists every pre-existing changed file as `not-session-owned`, and requires `DIRTY TREE` / `RED BASELINE` typed acknowledgments when applicable. Build-turn git fingerprints populate session-touched files and classify ownership as `session-owned` or `shared`; validation advances on acknowledged baseline-equivalent failures while any increased failure count or new diagnostic in a session-touched file enters the normal fix loop.
- ✅ 2026-07-24 (`scripts/delivery/budgets.mjs`, `scripts/delivery/packet.mjs`, `scripts/delivery/run-session.mjs`, `scripts/delivery/server-routes.mjs`, Delivery PM UI, focused delivery tests) **DLV-1** — every new session now records an owner-authorized cost/token envelope in `packet.json` (or an explicit typed `NO CAP` authorization); the runner evaluates packet/current usage only between turns, emits each warning once, and pauses on a hard cap without changing the state-machine phase or discarding the completed turn. Cap hits write `artifacts/finish/budget.json` + `summary.md`, request a notification, and resume only after an audited raise-only `set-budget` control. Existing pre-DLV-1 packets retain the global-config backstop.
- ✅ 2026-07-24 (`scripts/delivery/quota.mjs`, `scripts/delivery/run-session.mjs`, `tests/delivery/quota.test.ts`) **DLV-4** — spend-limit, quota, and authentication failures now pause without retrying; resumptions require an audited reason and fresh provider preflight. Identical transient failures use the configurable two-retry default, then enter `NEEDS_DECISION` and emit a dashboard notification request.
- ✅ 2026-07-24 (`tests/delivery/config.test.ts`, `tests/delivery/runner-crash.test.ts`) **DLV-3** — Delivery config now validates owner edits, atomically snapshots valid config for last-known-good fallback, exposes degraded mode on the dashboard, and parks repeated identical runner startup crashes behind a one-minute restart backoff.
