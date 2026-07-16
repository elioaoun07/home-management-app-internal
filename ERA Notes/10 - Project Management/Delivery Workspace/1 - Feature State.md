---
created: 2026-07-16
updated: 2026-07-16
type: feature-state
status: living
owner: Elio
tags: [pm/feature-state, tooling/delivery]
---

# Delivery Workspace · 1 — Feature State

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Shipped

**The full ten-slice program (DW-1 → DW-10) shipped 2026-07-16**, implemented straight through in dependency order in one continuous session after plan approval. Final state: 810/810 `tests/delivery` passing (28 files) + all `tests/pm-ui` passing (826 combined), `pnpm typecheck` and `pnpm lint` clean on every touched file, zero state-machine transition/gate-semantics changes anywhere in the program (verified per-slice, not just at the end). Every slice was verified against the fake driver (offline, deterministic) plus a live-browser smoke test against a temporary `pm-server` instance and disposable fixture sessions (created and torn down per slice — never left in `.delivery/sessions/`).

✅ 2026-07-16 — **DW-1: Flight recorder foundation.** Full-fidelity transcript capture + v2 usage/cost, layered onto the existing S1–S3 Delivery runner without changing any state-machine transition or gate semantics.

- `scripts/delivery/transcript.mjs` (new) — record/turn schema, per-turn shards (`transcript/t-NNNN.ndjson`), assembled-prompt files (`transcript/prompts/NNNN.md`), head/tail truncation at a configurable byte cap (default 64 KiB, honest `truncated{originalBytes,...}` markers — a real upgrade from the prior 500/2000-char silent-loss truncation in `events.mjs`), crash-turn reconciliation (`findOrphanedTurnIds`/`buildCrashSealEntry`), and literal-match search primitives.
- `scripts/delivery/usage.mjs` (new) — v2 usage normalization (`normalizeUsageV2`) adding `cacheCreation` (Claude) and `reasoningOutput` (Codex) buckets that v1 `events.mjs.normalizeUsage` dropped; pricing-based cost estimation (`estimateCostUsd`, never fabricates a number without a pricing config); context-occupancy calculation (`computeOccupancy`); multi-level aggregation (`reduceTurnUsage` + phase/agent/model/provider convenience wrappers).
- `scripts/delivery/config.mjs` (new) — `.delivery/config.json` loader with deep-merge-over-defaults, so the owner's model/pricing catalog lives in one hand-edited file (no hardcoded price table), absent-file-safe (defaults match today's behavior exactly).
- `scripts/delivery/run-session.mjs` (extended) — every driver turn (`runGuardedTurn`) now writes its prompt file + full-fidelity record shard + a `transcript/turns.ndjson` entry (fields: turnId, phase, agent, provider, model, effort, duration, usage v2, `costUsd`/`costEstUsd`, occupancy, `result`, `strategy`), all additive and optional — pre-DW-1 test/caller paths that don't opt in (`turnId` omitted) see byte-identical behavior. `state.json` gains `turnCounter` (additive). `runLoop` reconciles crashed turns on `--resume` (a turn with a prompt file but no closing entry is sealed `result:"crashed"`). Side-fix: `emitEvent`'s O(n²) full-ndjson reparse on every append (an unrelated pre-existing inefficiency, `events.mjs`) replaced with an in-memory per-session seq cache — output format unchanged.
- `scripts/delivery/drivers/fake.mjs` (extended) — seam v2 surface for tests: pure-data `manifest()`, `onRaw` full-fidelity record feed, distinct `usageV2` passthrough (kept separate from the always-v1-shaped `usage` field, matching the real-driver contract), per-turn model/effort tracking onto the ref, default `turnMeta`.
- **Tests:** 8 new suites (`transcript`, `usage`, `config`, `run-session-transcript`) + extensions to `drivers.test.ts`, all passing (672/672 delivery tests, zero regressions in the pre-existing 591). `pnpm typecheck` and `pnpm lint` clean on every touched file.
- **Scope note (resolved by DW-2):** `drivers/claude.mjs`/`drivers/codex.mjs` weren't extended to emit real `usageV2`/`onRaw` in this slice — the manifest/signal wiring landed in DW-2/DW-10; live-SDK end-to-end validation remains parked behind the pending provider-turn approval (unchanged since S3).

✅ 2026-07-16 — **DW-2: Launch config + capability manifests.** Provider capabilities are pure data now, never hardcoded in the UI.

- `manifest()` added to all three drivers (`fake.mjs`, `claude.mjs`, `codex.mjs`) — provider, efforts, `supportsPerTurnModel/Effort/Abort`, `supportsNativeFork`, usage-field support, sandbox description — importable without touching either real SDK.
- `config.mjs`'s `buildCapabilitiesPayload()` merges driver manifests with the owner's `.delivery/config.json` model/pricing catalog into one `GET /api/delivery/capabilities` response (`server-routes.mjs`).
- `DeliveryHome.jsx` step 4 became a real provider → model → per-phase-effort picker sourced entirely from `/capabilities`; `POST /start` validates the choice against the manifest (400 on an unknown model/effort) and packet v2 records `agentConfig.model`/`effort` at launch.
- **Tests:** `config.test.ts`, manifest assertions in `drivers*.test.ts`, `server-routes.test.ts` capabilities-route coverage.

✅ 2026-07-16 — **DW-3: Conversation viewer + usage panels.** The raw transcript DW-1 captures is now actually readable.

- `ConversationView.jsx` (new) — phase-grouped, lazily-loaded turn tree; per-turn expand shows the assembled prompt, assistant text/reasoning, tool calls/results, file changes; server-side literal search (`GET /api/delivery/transcript/search`) with highlighted matches, phase/kind filters, and a match-count/prev-next stepper.
- `UsageView.jsx` (new) — session/phase/turn usage tables computed from `transcript/turns.ndjson`, occupancy alongside token counts.
- `server-routes.mjs` gained `turns`, `transcript`, `transcript/search`, and `prompt` routes, all reading directly from DW-1's transcript files (no new write path).
- Stepper bug fix: the phase list's bogus `REFINING` step corrected to `DISCOVERY`.
- **Tests:** `server-routes.test.ts` route coverage; UI verified live (search highlighting, phase/kind filters, lazy per-turn fetch) against real captured production session data.

✅ 2026-07-16 — **DW-4: Controls channel + cooperative pause + same-provider config change.** The first owner-command channel independent of decisions/messages.

- `controls.mjs` (new) — schema/validation for `controls/NNNN-<type>.json` (pause, resume-run, set-config, and forward-declared rotate/fork/pin/unpin/answer/ask for DW-5/7/9), mirroring the existing decisions/messages numbered-file pattern.
- `run-session.mjs` gained `state.execution` (`{provider, model, effortByPhase, paused, ...}`), `drainControls()` (processed once per `advanceSession` tick, before any phase dispatch), and `applyControl()`. Pause is modeled as an **execution flag**, not a state-machine state — the pure transition table is untouched; a gate and a pause compose freely. A running turn always finishes before a boundary-only pause takes effect.
- Same-provider `set-config` (model/effort) applies at the next turn boundary via strategy `resume-with-overrides`; `SessionDetail.jsx` gained Pause/Resume-run and a `ConfigDialog` with a cache-cold warning.
- **Tests:** `controls.test.ts`, `run-session-controls.test.ts` (pause-while-runner-dead drains correctly on resume; back-compat for sessions with no `execution` field or `controls/` dir).

✅ 2026-07-16 — **DW-5: Memory ledger + Q&A.** A Delivery's memory now survives independent of any provider's chat history.

- `memory.mjs` (new) — versioned `ledger.json` (prior revs kept in `memory/history/`) with pure updaters: `applySpec`/`applyPlan`/`applyDecision`/`applyConfigChange`/`applyQuestionRaised`/`applyAnswer`. Objective, requirements, constraints, decisions, and Q&A all live here — independent of `state.driver.ref`.
- Blocking questions (spec `openQuestions`) are ledger-tracked with evidence links back to the turn that raised them; advisory Q&A is owner/agent-raised via the `ask`/`answer` controls. `QuestionsCard` in `SessionDetail.jsx` renders blocking vs. advisory, with a `Questions: N open · M blocking` header badge.
- Answers are injected into **every** later context assembly (DW-7), not just the next prompt.
- **Tests:** `memory.test.ts`, `run-session-memory.test.ts`.

✅ 2026-07-16 — **DW-6: Timeline redesign.** Outcome-oriented, not event-soup.

- `TimelineView.jsx` (new) — only `CARD_TYPES` (phase transitions, decisions, questions, config changes, validation, blockers, handoffs, rotations) render as cards; everything else is counted into a single "N technical events" line per phase, deep-linking to Conversation. Blocked/error cards render in red (`isBlocking()`), never color-only (icon + label). Filter chips: All/Decisions/Blockers/Questions/Config/Phases.
- Fixed live-data bug: retry-decisions (`data:{retryTo}`, no `.decision` field) were rendering "Decision: undefined" — `summarize()` now cascades `.decision` → `.retryTo` → `.answer` → a generic fallback.
- **Tests:** covered indirectly via `server-routes.test.ts` event shapes; UI verified live.

✅ 2026-07-16 — **DW-7: Context engine v1 (rotation, packages, inspector, rehydration).** The portable-context mechanism that sheds provider-thread bloat.

- `context-policy.mjs` (new) — pure, deterministic `decideContextStrategy()`: resume-native / resume-with-overrides / rotate-fresh / handoff / fork, priority-ordered, every decision emitted as `context.strategy{reasons[]}` for audit.
- `context-assembly.mjs` (new) — `buildContextPackage()` assembles 12 named layers (instructions → objective → packet → artifact paths → decisions → constraints → questions+answers → digests → pins → recent raw tail → workspace delta → next action), each with a token estimate; empty layers dropped. Layers 5–7 (decisions/constraints/Q&A) are **never summarized away** — only the conversation-flow digest layer compacts. `buildMechanicalDigest()` is free, deterministic, no agent call (owner-approved default).
- `performRotation()` in `run-session.mjs` — digest + snapshot + archives the driver ref (fresh provider session next turn), triggered by the owner's `rotate` control (automatic threshold-based rotation is the natural DW-7.1 follow-up, not built this slice).
- Pins: `pin`/`unpin` controls store verbatim excerpts into `state.context.pins`, inlined into every later assembly.
- `ContextView.jsx` (new) — health card, pinned excerpts, next-turn preview (expandable layers), compactions/snapshots lists.
- **Tests:** `context-policy.test.ts`, `context-assembly.test.ts`, `run-session-context.test.ts`.

✅ 2026-07-16 — **DW-8: Provider handoff (Claude ↔ Codex).** Switching providers mid-Delivery without silent context loss.

- `performHandoff()` in `run-session.mjs` reuses `performRotation()` (digest + snapshot + archive old ref), starts a fresh session on the new provider, then runs a **schema-validated verification turn** (`HANDOFF_VERIFICATION_SCHEMA`: `{understandingSummary, currentPhase, nextAction, gaps[]}`) before letting the phase continue. Malformed output or any reported gap raises a blocking question (`NEEDS_DECISION`) — never silent continuation. Effort is translated via `config.effortMap`.
- Test-isolation seam: `createDriver` is dependency-injected into `performHandoff` (`ctx.createDriver`) rather than mutating the global driver registry, so dual-provider tests never leak across the shared vitest worker.
- `ConfigDialog` gained a typed-`SWITCH`-to-confirm provider-switch flow showing the exact transfers-vs-doesn't-transfer contract.
- **Tests:** `run-session-handoff.test.ts` (both directions, gap-detection, handoff-failure-to-BLOCKED).

✅ 2026-07-16 — **DW-9: Fork + lineage.** Branch an independent session from any checkpoint.

- `performFork()` in `run-session.mjs` — creates a sibling session dir (`<parentId>-f1`, `-f2`, ...) via `cpSync`: copies packet (+`parentSession` ref), artifacts, and the memory ledger; fresh `state.json` at the parent's current phase; fresh (empty) transcript. Parent pauses by default so both lineages don't touch the workspace at once. Starting the fork's runner reuses the existing `/api/delivery/resume` spawn-on-demand logic — no new process-spawn path needed.
- `SessionDetail.jsx` gained a **Fork** header button and lineage cross-links: a "← forked from `<id>`" link on the child, "→ fork `<id>`" links on the parent, both navigating directly to the linked session.
- **Tests:** `run-session-fork.test.ts` (copies ledger/artifacts/parentSession correctly; second fork gets `-f2`; forking pre-ledger sessions degrades gracefully; no turns copied into the fork's transcript). Live-verified: created a real parent+fork pair, confirmed both cross-links navigate correctly, then deleted the fixture sessions.

✅ 2026-07-16 — **DW-10: Mid-turn abort (gated).** The final slice — explicit, owner-initiated, lost-work-acknowledged abort of a turn already in flight.

- A turn is a single `await` inside one `advanceSession` tick, and controls are only drained *between* ticks — so reaching a turn that's already running required a genuinely concurrent mechanism: `watchForAbort()` in `run-session.mjs` polls `controls/` (default every 300ms, configurable) for a **new** `pause{abortInFlight:true}` control while `driver.runTurn()` is in flight, and calls `AbortController.abort()` the moment one appears. The poller only detects and aborts; the control itself is still drained normally by `drainControls()` on the *next* tick (single-writer discipline preserved).
- `driver.mjs` gained `DriverAbortedError` (a distinct, non-retried outcome). `fake.mjs` implements a real abortable delayed turn (`delayMs` + signal race) for offline testing. `claude.mjs` bridges the seam's `signal` onto the SDK's `Options.abortController` (`bridgeAbortSignal()`); `codex.mjs` passes `signal` straight through to `TurnOptions` (`withAbortSignal()`) — both per the SDK types verified in the plan; live-SDK abort behavior itself remains unverified (same provider-turn approval gate as every other live-only check in this program).
- An aborted turn is sealed `result:"aborted"` in `transcript/turns.ndjson` (never retried, unlike a generic failure) and always runs the git-guard + a **workspace delta** (`workspaceDelta.changedPaths`) — the response is lost outright, but the workspace is never rolled back, so the owner needs to see exactly what an aborted BUILDING turn touched. `blockFrom()` renders this as an explicit "Turn aborted by owner. The workspace was not rolled back — N file(s) changed... review the diff (or run validation) before retrying" message, surfaced in both the BLOCKED gate panel and the Timeline's red card.
- `SessionDetail.jsx` gained an **Abort turn…** button (gated on the current provider's manifest `supportsAbort`, hidden while paused/terminal) opening an explicit confirm dialog with the full lost-turn/no-rollback copy before posting the abort control.
- **Tests:** `run-session-abort.test.ts` — genuinely races a real, artificially-delayed fake-driver turn against a control file written mid-flight (real timers), asserting the turn seals as `aborted`, the phase lands on BLOCKED with the right message, the abort is never retried, and the pending pause control drains correctly on the following tick. Plus abort-signal unit tests in `drivers.test.ts`/`drivers-claude.test.ts`/`drivers-codex.test.ts`. Live-verified: a parked-at-BUILDING fixture to check the button/dialog copy, and a pre-aborted fixture to check the BLOCKED/Timeline/Conversation rendering — both fixture sessions deleted after verification.

## In progress

_(none — the full ten-slice program is complete)_

## Not started

None from this program. Natural DW-7.1-style follow-ups noted inline above (automatic threshold-based rotation; agent-mode digests behind `config.context.digestMode`) are deliberately out of scope until requested.

## Known gaps / pain (carried forward, not yet fixed)

- 🟡 Real-SDK abort behavior (DW-10), real per-turn model override, and real handoff quality (DW-8) are structurally wired and type-verified against the pinned SDK `.d.ts` files but **not** live-tested — all three remain parked behind the same pending live-provider-turn approval that has gated every live-only check since S3.
- ⚪ `.delivery/config.json` still needs the owner to hand-populate real model/pricing entries — the loader/validation/UI are all in place and default-safe with an empty catalog.
- ⚪ Automatic threshold-based context rotation (occupancy-triggered, not just owner-commanded) is designed in the context-policy priority order but not wired to a live trigger — DW-7 shipped the owner-commanded `rotate` control only, per the approved scope.
