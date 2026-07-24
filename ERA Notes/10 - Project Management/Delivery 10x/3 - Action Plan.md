---
created: 2026-07-24
updated: 2026-07-24
type: action-plan
status: living
owner: Elio
tags: [pm/action-plan, tooling/delivery]
---

# Delivery 10x — Action Plan

> **How to read this:** one section per DLV item, ordered by milestone. Each gives the problem, the evidence, the design contract, the file anchors, the config surface, and an acceptance test. Anchors are *starting points verified 2026-07-24*, not prescriptive diffs — re-verify against `git log --since=2026-07-24 -- scripts/delivery scripts/pm` before implementing. All items are fake-driver-testable and must not violate the owner non-negotiables (no git writes, no bypassPermissions, 3 gates, registry as single source of truth).

---

## M1 — Governed Start

### DLV-1 · Budget governance & graceful cap-hit

- **Problem:** no owner-set budget envelope; caps exist as unset config keys with no packet field, no runner enforcement wiring for pause, no UI.
- **Evidence:** `scripts/delivery/budgets.mjs` (all keys optional); `.delivery/sessions/s-20260722-225601-whdv/packet.json` (no budget field); `state.json` — $2.91 / 8.8M processed tokens with zero budget events.
- **Design:** add `budget: { maxUsd, maxTokens, warnPct, perPhase? }` to the packet (immutable authorized envelope). In `run-session.mjs`'s loop, call `checkSessionBudget()` **between turns** (already the doctrine): `warn` ⇒ event + notification, once; `exceeded` ⇒ finish current turn → write finish package (DLV-12) → set `awaiting.reason: "budget-exhausted"` → notify. Live raises via `/api/delivery/control`, recorded as decisions. Launch UI: required budget fields with lane defaults (DLV-6); "no cap" must be typed.
- **Anchors:** `scripts/delivery/budgets.mjs`, `run-session.mjs` (`advanceSession`/`runLoop`), `packet.mjs`, `server-routes.mjs` (start handler), `scripts/pm/src/features/delivery/DeliveryHome.jsx` (launch flow), `UsageView.jsx` (envelope + burn-down display).
- **Config:** `.delivery/config.json` → `budgets.laneDefaults.{fast,standard,deep}.{maxUsd,maxTokens,warnPct}`.
- **Acceptance:** fake-driver test where accumulated usage crosses the cap mid-BUILDING ⇒ session pauses gracefully with finish package + `budget-exhausted` reason; warn event fires exactly once at threshold; UI shows envelope + consumption.

### DLV-2 · Preflight Flight-Check screen

- **Problem:** launch flow doesn't show the envelope: no scope estimate, no model-fit warning, no budget fields, no baseline status, no context preview — the owner authorizes blind.
- **Evidence:** the 2026-07-22 session launched Haiku/low on a dirty tree with a red baseline and no budget, and nothing surfaced any of it.
- **Design:** extend the New Delivery Session flow's final step into a single Flight-Check panel: item + ACs, lane + recommendation (+ mismatch warning), budget fields, baseline/dirty acknowledgments (DLV-5), context manifest preview (DLV-8), capability/risk preview (existing). Launch button disabled until required fields + acknowledgments are set. Persist the flight-check snapshot into the packet (auditable "what the owner saw").
- **Anchors:** `DeliveryHome.jsx` (launch flow), `server-routes.mjs` `/api/delivery/start` (validate + store snapshot), `recommendation.mjs`, `packet.mjs`.
- **Acceptance:** cannot start a session without budget + acknowledgments; packet contains the flight-check snapshot; mismatch warning visible for an S-item + economy-model + large-glob combination.

### DLV-3 · Config hardening (schema, atomic writes, crash-loop backoff)

- **Problem:** malformed `.delivery/config.json` crash-looped the runner with no dashboard surfacing; config writes aren't atomic; respawn had no backoff.
- **Evidence:** `runner.log` — 3 identical fatal stacks (`config.mjs:119` via `fsx.mjs:80`, "line 12 column 11").
- **Design:** (a) validate config shape on load against a hand-rolled schema (zero-dep house style — validator function with precise path-of-error messages); on failure, **fall back to last-known-good + defaults**, emit a `config-invalid` session event and dashboard banner instead of throwing mid-loop. (b) All config/state writes via temp-file + rename (extend `fsx.mjs`). (c) Runner main() catches N rapid identical startup crashes (marker file with timestamps) ⇒ stop respawning, write `awaiting.reason: "runner-crash"` + event, notify.
- **Anchors:** `scripts/delivery/config.mjs` (`loadConfig`), `fsx.mjs` (`readJsonIfExists`, add `writeJsonAtomic`), `run-session.mjs` (`main`, `runLoop`), `server-routes.mjs` (banner data), `pm-server.mjs` (SSE).
- **Acceptance:** failure-injection test (DLV-18): corrupt config ⇒ session survives on last-known-good, banner event emitted, no crash loop; kill -9 the runner repeatedly ⇒ backoff engages.

### DLV-4 · Error taxonomy + retry escalation

- **Problem:** "You've hit your monthly spend limit" matched no `quota.mjs` pattern ⇒ treated transient ⇒ retried ⇒ dead BLOCKED. Separately, 7 blocked→retry cycles ran with no escalation or notification.
- **Evidence:** `quota.mjs` `QUOTA_PATTERNS` (no `spend limit`); `state.json` `lastError` ("monthly spend limit", `errorKind: null`); decisions `0015–0021` all `"retry"`, note-less, within 12 minutes.
- **Design:** (a) extend patterns: `/spend limit/i`, `/monthly.*limit/i`, `/credit/i` (+ keep list provider-reviewed at each SDK upgrade); add `kind: "auth"` class for login/token failures. (b) Quota/spend/auth ⇒ never retried; session pauses with `awaiting.reason: "quota-paused"`, `resetsAt` display, one-click resume that re-runs preflight. (c) Escalation: per-gate identical-retry counter; at `maxAutoRetries` (config, default 2) ⇒ `NEEDS_DECISION` + notification. All retries — human or automatic — carry a required reason note into the decision record.
- **Anchors:** `quota.mjs` (`classifyTurnError`), `run-session.mjs` (`runGuardedTurn`, retry loop), `state-machine.mjs` (no new states; `awaiting.reason` only), `controls.mjs`, `SessionDetail.jsx` (paused banner + resume).
- **Config:** `errors.maxAutoRetries`, `errors.extraQuotaPatterns[]`.
- **Acceptance:** fake-driver quota-hit test ⇒ zero retries, paused state, resume works; transient error ⇒ ≤2 retries then NEEDS_DECISION; the exact 2026-07-22 message string classifies as `quota`.

### DLV-5 · Baseline & change-ownership gate

- **Problem:** session started on a dirty tree with an already-failing typecheck; the dirty warning is non-blocking; validation compares against absolute green, so pre-existing red poisons the signal and pre-existing edits blur ownership.
- **Evidence:** `state.json` `workspace.dirtyAtStart: true`, `baselineValidation.ok: false` (pre-existing `tests/delivery/run-session.test.ts(1058)` error).
- **Design:** flight-check requires typed acknowledgment for (a) dirty tree — listing the pre-existing changed files, which are recorded in the packet as **not-owned-by-session**; (b) red baseline — validation thereafter passes on **delta vs baseline**: same-or-fewer failures, and zero *new* failures in session-touched files (extend `validation-baseline.mjs` comparison). Ownership manifest (DLV-12) marks any session write to a pre-dirty file as `shared` for the finish package.
- **Anchors:** `validation-baseline.mjs`, `run-session.mjs` (validation phase), `packet.mjs` (`workspace` block), `DeliveryHome.jsx` (acknowledgments).
- **Acceptance:** red-baseline test: pre-existing failure doesn't fail the session's validation; a new failure in a touched file does; dirty files listed in packet and finish package.

---

## M2 — Right-Sized Delivery

### DLV-6 · Delivery lanes (FAST / STANDARD / DEEP)

- **Problem:** every session runs the same weight regardless of task size; the only knobs (model/effort) are manual and unguided.
- **Design:** lane = named policy bundle resolved at launch into packet fields: effort defaults, context budget (DLV-8), validation contract (DLV-11), budget defaults (DLV-1), definition-of-done additions. Stored as `packet.lane` + resolved values (packet stays self-contained). Lanes **never** change gate count (owner rule; see file 6). Lane suggestion comes from item effort/severity/risk flags; owner can override at flight-check.
- **Anchors:** `packet.mjs` (lane resolution), `config.mjs` (lane definitions), `prompts.mjs` (per-lane framing), `recommendation.mjs` (lane suggestion), `DeliveryHome.jsx`.
- **Config:** `lanes.{fast,standard,deep}` policy blocks; classifier keeps risk-flag → DEEP forcing (money-domain, db-migration, security).
- **Acceptance:** S-item defaults to FAST with small budget + minimal context; money-domain item cannot select FAST without typed override; packet records lane + resolved policy.

### DLV-7 · Scope contract + auto-decomposition

- **Problem:** an S "verify" item became an 8-AC, 72-occurrence, 25-file program at SPEC time with no tripwire; mid-build, the agent silently descoped to 5 hooks.
- **Evidence:** `packet.json` (`effort: "S"`, 8 ACs); `artifacts/STEP-1-audit.md` (72 occurrences); build-log's own "Remaining Work (67+ occurrences)".
- **Design:** (a) spec JSON schema gains a required `scopeEstimate: { files, occurrences, modules, sizeClass }`; runner computes sizeClass from config thresholds and **stamps it on the SPEC gate UI** next to packet effort. (b) Mismatch (estimate > effort/lane capacity) ⇒ the SPEC gate becomes a **decomposition proposal**: the agent must present 2–4 sub-items with their own ACs; approving creates follow-up checklist candidates (via the existing writeback path, as *proposed* `0 - Inbox.md` entries or draft items — owner files them) and narrows this session's ACs to slice 1. Typed override allowed. (c) **Scope lock** post-PLAN: AC list + plan file-scope frozen; expansion ⇒ NEEDS_DECISION.
- **Anchors:** `prompts.mjs` (spec schema + decomposition prompt), `run-session.mjs` (spec validation, gate payload), `packet.mjs`, `server-routes.mjs` (gate decision variants), `SessionDetail.jsx` (gate UI).
- **Config:** `scope.thresholds.{S,M,L}` (files/occurrences).
- **Acceptance:** fake-driver spec with 25 files on an S packet ⇒ gate renders decomposition proposal; approving slice 1 narrows ACs; mid-build write outside plan scope ⇒ NEEDS_DECISION.

### DLV-8 · Context governance (budgets, selective loading, manifest)

- **Problem:** context assembly is not budgeted per phase and not visible; the failed Haiku session processed 8.7M cached-input tokens.
- **Design:** per-lane, per-phase context budgets enforced in `context-assembly.mjs` (priority order: item > module map entry > skill > campaign docs; drop lowest-priority first, record drops). Persist a **loaded-context manifest** per turn (source path, reason, size) under `transcript/`; surface totals in `UsageView.jsx` and the flight-check preview (DLV-2).
- **Anchors:** `context-assembly.mjs`, `context-policy.mjs`, `transcript.mjs`, `UsageView.jsx`.
- **Config:** `lanes.*.contextBudget.{discovery,plan,building,review}` (token weights).
- **Acceptance:** FAST-lane turn manifest contains ≤ the configured sources; over-budget assembly drops and records; manifest totals reconcile with usage capture within tolerance.

### DLV-9 · Model/effort fit guard (launch + post-discovery)

- **Problem:** Haiku/low accepted for a measured 25-file refactor; `recommendation.mjs` only advises pre-launch, from unmeasured signals.
- **Design:** re-run recommendation **after discovery** against `scopeEstimate` (DLV-7); mismatch ⇒ warning attached to the SPEC gate ("measured L scope on economy model — recommend switch to <balanced tier> or decompose"), owner acknowledges or switches (mid-session model switch already exists via `/api/delivery/control`). Record the guard verdict + owner choice in the decision.
- **Anchors:** `recommendation.mjs`, `run-session.mjs` (post-discovery hook), `SessionDetail.jsx` (gate warning), `agent-registry.mjs` (tier metadata stays the single source).
- **Acceptance:** fake-driver: L-sized estimate + economy model ⇒ warning present on gate payload; acknowledgment recorded; no warning when matched.

---

## M3 — Truthful Finish

### DLV-10 · AC coverage matrix + evidence gate

- **Problem:** AC status lived nowhere; the agent claimed ✅ while validation was red; UAT_READY had no AC-coverage precondition.
- **Evidence:** `artifacts/build-log.md` ("✅ COMPLETED", "Perfect!") vs `artifacts/validation-report.md` (typecheck FAIL, ~48 errors); ACs 6/7/8 unmet with nothing recording it.
- **Design:** `state.acceptance[]`: per-AC `{ id, status: unmet|met|waived|failed, evidence: path|null, updatedBy: turn }`. The runner (not the agent) flips status: `met` requires an evidence pointer (validation artifact, diff, file existence check). Phase exit BUILDING→VALIDATING carries the agent's *claimed* AC updates; VALIDATING confirms or reverts them. UAT_READY transition requires all ACs `met|waived` (waive = owner decision, audited). Matrix rendered in `SessionDetail.jsx`.
- **Anchors:** `run-session.mjs` (phase-exit AC reconciliation), `state-machine.mjs` (gate precondition — additive check, no new states), `prompts.mjs` (agent reports claims per AC), `SessionDetail.jsx`.
- **Acceptance:** fake-driver: agent claims AC met with no evidence ⇒ stays `unmet`; UAT_READY blocked until waive; matrix snapshot lands in the finish package.

### DLV-11 · Risk-based validation contract

- **Problem:** validation depth is ad-hoc; lint/test were silently `(skipped)`; only typecheck ran and it failed without consequence to the narrative.
- **Evidence:** `artifacts/validation-report.md` — `## lint (skipped)`, `## test (skipped)`.
- **Design:** the lane (DLV-6) fixes the validation ladder; every rung's outcome is `pass|fail|skipped(reason, authorizedBy)` — a skip requires a recorded authorization (lane policy or owner decision), and the report renders skips as loud, not parenthetical. Delta-vs-baseline semantics from DLV-5 apply at each rung. FAST lane's "targeted tests" = vitest related-file filter on the session's changed files.
- **Anchors:** `run-session.mjs` (`runValidationCommands`), `validation-baseline.mjs`, lane config, `SessionDetail.jsx` (report rendering).
- **Acceptance:** FAST session runs typecheck + targeted tests and records lane-authorized skip of full suite; DEEP session cannot skip any rung without owner decision.

### DLV-12 · Finish package on every terminal/paused state

- **Problem:** the session died leaving its true result (partial migration, failing enforcement test, 67 remaining occurrences) buried in a build log; no ownership manifest, no remaining-work package, no revert instructions, no risk register.
- **Design:** a single runner routine `writeFinishPackage(reason)` invoked on **every** exit to a terminal/paused/blocked state, producing `artifacts/finish/`: `manifest.json` (changed files ↔ phase/turn/plan-step, ownership own/shared per DLV-5), `acceptance.json` (matrix snapshot), `remaining-work.json` (unmet ACs + un-executed plan steps, resume-packet-ready), `recovery.md` (display-only revert commands + exact file list), `risks.md`. Rendered as a "Session outcome" panel.
- **Anchors:** `run-session.mjs` (exit paths + crash reconciliation), `gitread.mjs` (diff/status for manifest), `SessionDetail.jsx`.
- **Acceptance:** every fake-driver scenario in DLV-18 (quota, cap-hit, crash, cancel, accept) leaves a complete `artifacts/finish/`; recovery commands are display-only.

### DLV-13 · Resume & salvage on DW machinery

- **Problem:** a BLOCKED/paused session offers retry or abandonment — no way to continue as a right-sized new session; BUD-11's two dead sessions are unsalvageable today except by hand.
- **Design:** "Salvage" action on paused/blocked/partial sessions: builds a **continuation packet** from `remaining-work.json` (narrowed ACs, carried ownership manifest, link to predecessor), then launches through the normal flight-check (fresh budget, lane, model) using the DW fork/handoff path so ledger/memory carries over. Predecessor gets `awaiting.reason: "superseded"` + pointer.
- **Anchors:** DW fork/handoff surfaces (`memory.mjs`, handoff flow in `run-session.mjs`/`server-routes.mjs`), `packet.mjs` (continuation fields), `DeliveryHome.jsx`/`SessionDetail.jsx`.
- **Acceptance:** salvage of a fake paused session produces a flight-check pre-filled with remaining ACs; predecessor marked superseded; ledger continuity verified.

### DLV-14 · PM trace as a state-machine exit effect

- **Problem:** PM writeback is an agent step it can (and did) skip — BUD-11 has zero PM trace after two sessions.
- **Evidence:** [Budget/4 · Checklist](<../Budget/4 - Checklist.md>) BUD-11 still `- [ ]`; no Feature State note.
- **Design:** terminal/paused transitions emit a `pmTrace` effect executed by the runner/server (drift-guarded, like the existing accept-tick writeback): ACCEPTED ⇒ existing checkbox tick; PARTIAL/BLOCKED/CANCELLED ⇒ append a dated progress bullet to the campaign's `1 - Feature State.md` pain/progress section referencing the session id and finish package. Uses the existing `performPendingWritebacks` path in `server-routes.mjs`.
- **Anchors:** `state-machine.mjs` (effects), `server-routes.mjs` (`performPendingWritebacks`), `pm-server.mjs` (watcher).
- **Acceptance:** fake session ending PARTIAL appends exactly one drift-guarded Feature State bullet; ACCEPTED still ticks the checkbox; no duplicate writes on re-run (idempotent).

---

## M4 — Operability & Proof

### DLV-15 · Session UX: "what's happening / what do you need from me"

- **Design:** persistent session-page header: current phase + live activity line (from latest event), and an action strip (pending gate/question/acknowledgment with deep-link). Audit `TimelineView.jsx`/`ConversationView.jsx` first — collapse noise, promote decisions/questions. Q&A gets its own tab fed by decision records.
- **Anchors:** `SessionDetail.jsx`, `TimelineView.jsx`, `ConversationView.jsx`, `deliveryStore.js`.
- **Acceptance:** with a session paused at a gate, the header answers both questions without scrolling; every pending owner action is one click away.

### DLV-16 · Notifications

- **Design:** events `gate-waiting`, `needs-decision`, `paused (quota/budget/crash)`, `finish-package-ready` ⇒ notification dispatcher; channel per config: dashboard toast (always) + optional web push through the app's existing infra (`src/app/api/notifications/`, `push_subscriptions`) with deep-link to the session. Respect the loopback posture: the push payload links to the dashboard host the owner already uses; no remote decision endpoints (file 6).
- **Anchors:** `events.mjs`, `server-routes.mjs`, `pm-server.mjs` (SSE), `src/app/api/notifications/` (reuse, not modify, unless a delivery topic needs adding).
- **Config:** `notifications.{channel: "dashboard"|"push", pushTopic}`.
- **Acceptance:** paused fake session emits exactly one notification per state change; deep-link opens the session page.

### DLV-17 · Watchdog + transcript integrity

- **Problem:** stalled sessions are invisible; transcript turn numbering has gaps (t-0013…18, t-0021 missing) and unexplained zero-usage turns.
- **Design:** (a) pm-server-side watchdog: non-terminal session + stale `runner.json` heartbeat (> config threshold) ⇒ `stalled` banner + notification. (b) Every allocated turn number writes a record — aborted/guard-violation/zero-usage turns get a stub record with reason; session-end integrity check reports gaps as events.
- **Anchors:** `pm-server.mjs` (watch loop), `run-session.mjs` (turn allocation), `transcript.mjs`.
- **Acceptance:** kill a fake runner mid-turn ⇒ stalled banner within threshold; forced aborted turn leaves a stub record; integrity check flags an artificial gap.

### DLV-18 · Failure-injection scenario suite

- **Design:** extend `drivers/fake.mjs` with scriptable failure modes (quota error text, mid-turn crash, oversized spec, malformed config trigger) and add scenario tests: quota-hit, budget cap-hit, config-corruption, retry-storm escalation, crash-recovery reconciliation, salvage flow. House pattern: `tests/delivery/run-session.test.ts` + `tests/pm-mutations.test.ts` style.
- **Anchors:** `drivers/fake.mjs`, `tests/delivery/run-session.test.ts` (note: fix the pre-existing `onEvent` TS error there first — it is the red baseline from the postmortem).
- **Acceptance:** `pnpm test` covers every M1/M3 behavior above; suite green.

### DLV-19 · Fleet metrics on DeliveryHome

- **Design:** computed from session dirs at request time (no new store): outcome distribution, cost per shipped item, human interventions per session (decision count), first-pass validation rate, scope-estimate accuracy (estimate vs manifest actual). Small stat row + per-session chips; follow `dataviz` skill if charted.
- **Anchors:** `server-routes.mjs` (listing already reads sessions), `DeliveryHome.jsx`.
- **Acceptance:** with today's fleet on disk it renders 7 CANCELLED / 1 BLOCKED / 0 SHIPPED and the two BUD-11 sessions' combined cost — the honest mirror this campaign starts from.
