---
created: 2026-09-10
updated: 2026-09-10
type: master-book
status: active
owner: Elio
---

# Hub & ERA — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

A dependable daily assistant that reads broadly, proposes safely and speaks first when useful. Junction and primary interaction layer; owns household, shared sync and cross-module AI contracts.

## Current state & evidence

Intent routing and turn-latency repairs shipped. Proactive delivery, source coverage, safe learned referents and durable capture remain incomplete. September research supplies bounded evidence, not production incidents or completed deliveries.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- The accepted Top Layer plan governs the product target; checklists own status. Preserve D1–D18, including the existing ERA layout freeze, personal-first sequencing and the owner’s no-wake-word/no-geofencing exclusions.
- ERA is the top interface. Chef remains the Kitchen specialist; Brain retains bounded memory; standalone forms are precision tools. Retire floating/Focus surfaces only after the replacement is reachable.
- Never learn from failed, pending, uncertain or wrong-target actions. Read coverage and provenance are part of a fact, not optional telemetry. Proposals require human confirmation before money or schedule mutation.
- HUB-5 is an on-touch rider, not an extraction programme. HUB-16 is the sanctioned HubPage rider; no broad redesign is authorized.
- NOTIF-19 owns E-19 once; BUD-2 owns Hub merchant matching once. Source modules own canonical facts and inverses; Hub owns transport, orchestration and recoverable input.
- DEC-01/02 settle recipient hours/sequencing and persistent colors. DEC-13/18 settle household lifecycle/schema choices; undocumented production state is not evidence.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🟠 **HUB-62** Record current schema and application evidence. See [acceptance](<#hub-62>) for the root cause, evidence and gate.

🔴 **HUB-37** Verify CI and recoverable capture failures. See [acceptance](<#hub-37>) for the root cause, evidence and gate.

🔴 **HUB-38** Record authenticated cadence-aware cron liveness. See [acceptance](<#hub-38>) for the root cause, evidence and gate.

🟠 **HUB-16** Preserve voice reminder time through the shared turn engine. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-16>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-57** Link conversions to the returned draft ID. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-57>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-58** Report bulk Undo failures honestly. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-58>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-59** Use the source message date for transaction conversion. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-59>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-63** Align chat receipts and badges with notification policy. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-63>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-64** Reject learned actions with unsafe referents. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-64>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-67** Make bulk message conversion and inverse atomic. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-67>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **HUB-70** Correct saved notes with ID and revision preconditions. Dated source diagnosis; cause and witness limits are in [criteria](<#hub-70>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### HUB-62

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C00. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Record current schema and application evidence.

- **Acceptance:** E-00 and Catalogue C00: owner supplies current DB snapshot, migration application and household/role witnesses for the selected slices. DEC-18 resolves household_members retain/drop. Written SQL and schema.sql are not deployment proof; agents do not apply migrations.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-37

**Outcome:** Verify CI and recoverable capture failures.

- **Acceptance:** CI runs typecheck/test/lint on push and PR; ERA preserves recoverable input on rejected capture and distinguishes offline, timeout and uncertain results. HEAD is already committed; no git write is part of this packet.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-38

**Outcome:** Record authenticated cadence-aware cron liveness.

- **Acceptance:** Owner-verified cron ledger and six wrappers provide authenticated cadence-aware liveness; record APPLIED migrations separately. E-02a follows ledger implementation. Cron logging reconciliation remains held under NOTIF-5.4; this packet waives neither applicable rule.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-39

**Outcome:** Configure eligible local-time scheduling.

- **Acceptance:** Owner configures the existing scheduler-of-record plan with polling and IANA local-date eligibility; DST and duplicate ticks are verified. The briefing slot stays inactive until recipient policy and owner-recorded C01 eligible-hour/C03 partner-sequencing decisions are satisfied.
- **Depends on:** [HUB-38](<Hub & ERA — Master Book.md#hub-38>), [NOTIF-19](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-40

**Outcome:** Complete the assistant treaty and verified retirement.

- **Acceptance:** Retain the M-00 treaty: ERA owns general conversation, Chef keeps Kitchen specialty, Brain keeps bounded memory, and the floating assistant retires only after its report is reachable. Remove only source-proven dead routes/helpers; no ERA layout redesign. Historical manifest/line counts are evidence cutoffs, not acceptance thresholds. Existing plan supersession is complete.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-41

- **Retained campaign gate (D3):** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only). *(→ HUB-41/E-04, HUB-42/E-05)*

**Outcome:** Build signals with coverage and provenance.

- **Acceptance:** Signals distinguish complete, partial and unavailable facts with provenance. Reuse canonical Schedule/Budget inputs; BUD-66 and the Schedule day-adapter/parity prerequisites must pass before their summaries are certified. Existing recurring-dues/overdraw scope remains.
- **Depends on:** [BUD-66](<../Budget/Budget — Master Book.md#bud-66>), [SCH-8](<../Schedule/Schedule — Master Book.md#sch-8>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-42

- **Retained campaign gate (D5):** *(new 2026-09-02)* ERA has spoken first for 5 consecutive mornings (Speaks-First Ratio ≥ 5/7) — the plan's own G1 gate, Oct 12.

- **Retained campaign gate (D3):** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only). *(→ HUB-41/E-04, HUB-42/E-05)*

**Outcome:** Deliver one stored briefing per eligible recipient day.

- **Acceptance:** Deterministic stored briefing delivers once per eligible local date and recipient, with verified identity/claim and recipient hour/toggle policy. Activate only at an owner-resolved eligible hour; D5 stays binding. Composition and focus-insights retirement remain parent obligations.
- **Depends on:** [HUB-39](<Hub & ERA — Master Book.md#hub-39>), [HUB-41](<Hub & ERA — Master Book.md#hub-41>), [NOTIF-19](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-19>), [NOTIF-21](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-21>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-43

**Outcome:** Measure briefing feedback and vital signs.

- **Acceptance:** *(E-06)* Briefing feedback (👍/👎) + the "ERA vital signs" tile block (SFR₇, precision, cron liveness) in the Activity view.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-44

**Outcome:** Attribute model usage and enforce degradation controls.

- **Acceptance:** Dispatch the M provider/model/usage-attribution sheet first, then the retained quota gauge, degradation matrix and `AI_MODEL`/`AI_FALLBACK_MODEL` pin/kill-switch obligations. One bounded child per session; E-07a alone does not close the parent. Must ship before new Gemini consumers (HUB-45).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-45

**Outcome:** Connect canonical balances and meal coverage to ERA.

- **Acceptance:** ERA reads balances and scoped meal coverage and supplies bounded Chef/Brain context. Reuse the existing Chef meal read; complete meal/person/status coverage and canonical money facts precede a trusted answer.
- **Depends on:** [HUB-44](<Hub & ERA — Master Book.md#hub-44>), [KIT-4](<../Kitchen/Kitchen — Master Book.md#kit-4>), [BUD-66](<../Budget/Budget — Master Book.md#bud-66>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-46

**Outcome:** Make conversational capture durable and idempotent.

- **Acceptance:** Durable queue acknowledgment, idempotent draft/nonrecurring-item endpoints and owner-bound reconciliation precede income/event extensions. Dispatch one bounded child sheet per session; reuse existing queue feature keys. Parent remains open until every retained criterion passes.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-47

**Outcome:** Count only verified actions as successful learning.

- **Acceptance:** Failed/pending/uncertain actions cannot count as success or improve templates; Activity covers capability outcomes and opens real doors. Verify current conversation behavior with owner evidence; any needed migration belongs to E-05a, not a duplicate trigger guess.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-59

**Outcome:** Use the source message date for transaction conversion.

- **Acceptance:** H-03 and Aug1 Inbox: default to the selected message’s created_at local date, preserving explicit user date overrides and UTC storage. Test old threads and timezone boundaries.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-61

**Outcome:** Verify guest-drinks household access.

- **Acceptance:** H-01 and Aug19 Inbox: owner supplies current guest_drinks RLS/role evidence; historical disabled-RLS assertion is not current proof. Produce only any necessary manual runbook and verify intended guest/household scope.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-64

**Outcome:** Reject learned actions with unsafe referents.

- **Acceptance:** UU-X1 synthetic learner/router/dispatcher chain changed a named dentist request into zero-slot focus and deleted Call bank. Require explicit grounded target slots and safe clarification at learning, routing and dispatch; wrong-target actions never count as successful training. No claim of observed live incidence.
- **Depends on:** [HUB-47](<Hub & ERA — Master Book.md#hub-47>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-57

**Outcome:** Link conversions to the returned draft ID.

- **Acceptance:** Future chat conversion links the actual returned draft ID and never automatically recreates a draft after link failure.

**Retained contract — ASTRA-HUB-1:**

- **Outcome:** A future-payment conversion links its source message to the saved draft's real ID.
- **Boundary:** Extract only the modal's existing future-draft create/link sequence into the injectable adapter, retaining the existing request functions. Destructure/validate the successful draft envelope using its real response shape; a missing draft/id must not create a null-target action or report completion. Keep the returned ID through the existing action-link call; do not resubmit domain creation when only tracking failed. Reuse installed Zod if a runtime validator is needed. Test the adapter that the modal actually calls, not a duplicate sequence. This does not make the two writes atomic or introduce a new API client or queue.
- **Money/schedule math?:** Draft-only invariant: account $100 → create future expense draft $20 → account stays $100; action references the draft UUID. No date conversion or posting behavior changes.
- **Gate:** `pnpm exec vitest run tests/hub-created-draft.test.ts --reporter=verbose` → nonzero cases pass: real `{draft:{id}}` envelope, malformed/missing ID and error body. Mocked conversion fixture confirms one draft request, the returned UUID passed to linking, zero confirmation requests, no automatic draft retry on link failure. Common gates pass. Existing test tooling only; no live money fixture.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-58

**Outcome:** Report bulk Undo failures honestly.

- **Acceptance:** Bulk conversion Undo checks every inverse result and refuses a false completion acknowledgment.

**Retained contract — ASTRA-HUB-2:**

- **Outcome:** A failed inverse prerequisite stops bulk Undo before further destructive steps and prevents a success claim.
- **Boundary:** Extract only the existing per-record inverse into an injectable adapter; check every HTTP status and SDK error before advancing or marking that record reversed. Keep confirmed, failed and uncertain results distinct; overall success requires every selected inverse to be confirmed. Preserve truthful partial results and invalidate affected existing keys even after partial completion. Do not bypass the missing endpoint with direct DB calls, invent an atomic guarantee or silently compensate. No new production text is specified; existing failure/success affordances receive the correct branch.
- **Money/schedule math?:** Financial guard: account $80 after a $20 expense; action-link DELETE returns 404 → zero downstream transaction deletes, account remains $80, reversal is not marked complete. A mocked successful owning inverse returns $100 once; this sheet does not certify that server inverse's atomicity.
- **Gate:** `pnpm exec vitest run tests/hub-conversion-undo.test.ts --reporter=verbose` → nonzero cases pass: first response 404 prevents target deletion; second response 500 is not success; resolved SDK `error` is not success; mixed batch retains partial evidence; duplicate result handling does not report double reversal. Common gates pass. Tests inject fake effects; no real row deletions.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-2

- **Retained campaign gate (D2):** Voice degrades gracefully with no Azure connection, and the setup is documented. *(→ HUB-2/E-17)*

**Outcome:** Degrade voice gracefully and document setup.

- **Acceptance:** Voice graceful degradation + setup docs *(now packet **E-17**, Phase 2)* — one `speak()` seam with a `speechSynthesis` fallback promoted from `useEraReplyTTS`, distinct orb states for token-mint/SDK/worklet/mid-stream failures. Wake-word setup itself is out of scope per owner decision 2026-09-02 (D2) — voice degradation is about the TTS/STT pipeline, not wake.

- **Acceptance:** with no Azure connection the voice path degrades with a visible, non-crashing state, the wake-word setup is documented, and a degradation test exists.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-48

**Outcome:** Add briefing status and retire the floating report assistant.

- **Acceptance:** *(E-10)* Status line + in-hub briefing card (additive, doesn't move the orb/widgets/nav) + `analysis.report` capability so the floating `AIChatAssistant` can be retired once the report is reachable from ERA.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-16

**Outcome:** Preserve voice reminder time through the shared turn engine.

- **Acceptance:** `/chat` voice reminders lose the time and don't save *(now packet **E-13**, the one sanctioned `HubPage.tsx` rider)* — gives HubPage's voice engine `runTurn`, deletes `intentClassifier.ts` and the five legacy callbacks.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-49

**Outcome:** Bundle the Top View data read.

- **Acceptance:** *(E-14)* `get_era_topview_bundle()` RPC — collapses the four widget hooks' ~7 round trips into 1 *(absorbs **HUB-7**'s "fresh cache" half)*.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-50

**Outcome:** Keep mobile vitals available while conversation sleeps.

- **Acceptance:** *(E-15)* Vitals strip on mobile, rendered even while asleep — "data is always awake; only the conversational layer sleeps."

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-51

**Outcome:** Deliver partner preferences and persistent person colors.

- **Acceptance:** Implement persistent person identity colors across blue/pink/frost/calm, the partner’s own briefing hour/toggle and her chosen flow. Current role-relative theme fallbacks are insufficient. DEC-01/02 must settle sequencing and color derivation; the Sep2 personal-first decision is not permission to skip partner acceptance.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-52

**Outcome:** Reopen ERA sessions with deterministic titles.

- **Acceptance:** *(E-18)* ERA sessions picker + reopen + deterministic titles (no LLM). *(Inbox 2026-08-27; plan sacrifice #1 if a gate is missed.)*

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-54

**Outcome:** Connect signal cards to confirmed actions and real destinations.

- **Acceptance:** *(E-20)* Signal stack + card actions (draft-only, never a direct write) + doors from every tile.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-55

**Outcome:** Turn a transaction anomaly into one policy-gated proposal.

- **Acceptance:** *(E-21)* Anomaly → proposal: outlier transaction gets exactly one policy-gated card with a "why" line.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-56

**Outcome:** Add Kitchen, Trips and Healthcare signals.

- **Acceptance:** *(E-22)* Module signals from Kitchen/Trips/Healthcare *(absorbs **HUB-9**)*.
- **Depends on:** [KIT-4](<../Kitchen/Kitchen — Master Book.md#kit-4>), [HLTH-21](<../Healthcare/Healthcare — Master Book.md#hlth-21>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-23

**Outcome:** Rank signals using explicit feedback.

- **Acceptance:** *(E-23)* Feedback-weighted ranker — 👎 history halves a signal type's rank. *(Plan sacrifice #4 if a gate is missed.)*

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-5

**Outcome:** Extract HubPage code only alongside a real feature.

- **Acceptance:** Decompose `HubPage.tsx` — no standalone extraction packet; per D10 it only shrinks as a rider on a real feature (E-13/HUB-16 is the sanctioned one this window).

- **Acceptance:** each extraction moves one pure concern out of `HubPage.tsx` with its own test, and the file's line count goes down rather than up in that session.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-6

**Outcome:** Expense-split from chat (gap 8a).

- **Acceptance:** Expense-split from chat (gap 8a) — untouched by this plan; still Later.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-21

**Outcome:** Verify the served revision and original product flows.

- **Acceptance:** Record actual served revision and both-device acceptance for the original ERA slice. CI alone is insufficient. Any old test-data cleanup requires fresh owner inspection and a manual runbook; no production experiment by an agent.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-22

**Outcome:** Add debt settlement and recurring-payment actions.

- **Acceptance:** Propose and confirm debt settlement and recurring-payment add/skip through existing domain contracts. Expense splitting is owned only by HUB-6; do not duplicate it here.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HUB-60

**Outcome:** Provide household data export and verified restore.

- **Acceptance:** M-04: owner-controlled export includes schemas/relationships and an inspectable restore contract, household privacy and secrets exclusion. Rehearse on isolated data; restore must use domain inverses, not generic money row insertion.
- **Depends on:** [BUD-24](<../Budget/Budget — Master Book.md#bud-24>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-63

**Outcome:** Align chat receipts and badges with notification policy.

- **Acceptance:** Make chatNotificationPolicy the agreed recipient/read boundary for receipt and badge counts; avoid one surface reporting a delivered/unread state another suppresses. Include household and reconnect cases.
- **Depends on:** [NOTIF-19](<../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-19>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-65

**Outcome:** Resolve household identity across unlink and relink.

- **Acceptance:** Held for DEC-13. Decide stable household container versus link-epoch identity, then align retained data and new sharing. Do not migrate household ownership from stale prose.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-66

**Outcome:** Choose keep, maintain or park for the module estate.

- **Acceptance:** Top Layer phase2 owner census: record one disposition per existing module and which daily flow justifies it. Preserve data/history for parked modules; no speculative new campaign or deletion.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-67

**Outcome:** Make bulk message conversion and inverse atomic.

- **Acceptance:** Complete the remaining conversion/link/inverse transaction contract: returned draft IDs, no duplicate recreation, exact retry and real inverse on partial failure. HUB-57/58 truthful acknowledgments alone do not prove atomicity.
- **Depends on:** [HUB-57](<Hub & ERA — Master Book.md#hub-57>), [HUB-58](<Hub & ERA — Master Book.md#hub-58>), [BUD-63](<../Budget/Budget — Master Book.md#bud-63>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-68

**Outcome:** Resolve existing floating-panel debt within the style freeze.

- **Acceptance:** Held for DEC-23: inventory source-present translucent overlays and agree the bounded correction compatible with the accepted ERA layout freeze. Future new panels already obey Hard Rule15; do not use this debt as permission to redesign.

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-69

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C10. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Expose authorized catalogue search to ERA.

- **Acceptance:** Catalogue C10: bounded lexical search adapter returns permitted references with source IDs and availability; preserve source-owner permissions and no hallucinated document contents.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>), [KIT-22](<../Kitchen/Kitchen — Master Book.md#kit-22>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-70

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C11a. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Correct saved notes with ID and revision preconditions.

- **Acceptance:** Catalogue C11a: use the deployed D17 branch, exact source ID, revision preconditions and complete paging; confirmation states the actual target. No correction from truncated search or unrelated memory.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>), [HUB-69](<Hub & ERA — Master Book.md#hub-69>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HUB-71

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C11b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Ground reference retrieval and correction in sources.

- **Acceptance:** Catalogue C11b: source-aware retrieval/correction uses authorized records and visible lineage, handles partial/unavailable evidence and never takes ownership from the source module.
- **Depends on:** [HUB-69](<Hub & ERA — Master Book.md#hub-69>), [HUB-70](<Hub & ERA — Master Book.md#hub-70>).

**Provenance:** [Hub & ERA — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Hub & ERA/Hub & ERA — Master Book.md>). The source is historical; this entry owns the retained outcome.

## Backlog reconciliation

- 2026-09-10 — **HUB-53** → NOTIF-19. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **HUB-10** → BUD-2. Scope is retained in the destination criteria; duplicate removed, not shipped.

## Shipped Log

- ✅ 2026-09-02 — **HUB-36** removed the avoidable latency chain behind the owner-reported slow ERA Top Layer: established-thread message inserts are optimistic and serialized in a background per-conversation queue, so intent/model work no longer waits for the user row and text/TTS no longer wait for the assistant row; first-turn conversation creation remains correctly awaited for its required parent id. `/api/era/ask` now overlaps independent quota/rate-limit reads and request-hash/context work, `fetchBudgetContext` collapses eight sequential post-account reads into one concurrent layer, Schedule fetches items/tags together, and non-critical AI usage inserts run via Next `after()`. Command Bar replies now use Azure Speech SDK PCM sentence streaming (`useEraReplyTTS`) instead of downloading a complete `/api/tts` MP3 before playback, with browser `speechSynthesis` fallback. False Offline mode root cause fixed in `safeFetch`: its own timeout and caller abort are no longer classified as lost connectivity or queueable failures; a timeout launches a de-duplicated `/api/health` probe and only confirmed network failures transition global state. Regression coverage: `safeFetch.test.ts` + `connectivityManager.test.ts` + `ttsQueue.test.ts` (8 cases); typecheck and targeted tests green.
- ✅ 2026-06-16 — Hub bulk convert ("Multi-add" → `BulkConvertReviewSheet`) with unconfirmed rows saved as draft items (`items.status='draft'`, reviewed via `DraftRemindersDrawer`)
- ✅ 2026-06-16 — bulk-convert "complete transaction" rule tightened: a budget row auto-confirms only with Amount + Category + Subcategory (description = the chat message); any missing field forces a draft
- ✅ 2026-06-16 — full-screen in-thread view (global header hidden) + edge-swipe-back to the thread list
- ✅ 2026-07-10 — **notification visibility policy** (`0f33396`): `chatNotificationPolicy.ts` (33 lines, pure, **the cluster's first test file**) makes visibility the single choke point — private threads excluded from immediate push and cron fallback
- ✅ 2026-07-10 — per-user receipts extended to shopping child messages: `unread_reply_count` drives the item dot, opening the item thread marks replies read, realtime restores the dot only for a _newer_ partner reply
- ✅ 2026-07-10 — net complexity went **down** with a feature for the first time in this cluster (`useHubPersistence.ts` −27, `chat-notifications` cron −17), and the vault docs were updated in the same commit
- ✅ 2026-07-17 — ERA Top View design study recorded as the standing spec for proactive
- ✅ 2026-08-22 — **HUB-1** intent-routing tests + graceful fallback (`src/features/era/intents/rootIntentRouter.test.ts`, 38 green) — new `clarify` Intent member (`ambiguous`/`weak`) threaded through `types.ts`, `intents/{index,budget}.ts`, `replyFormatter.ts`, `resolveIntent.ts` and `CommandBar.tsx`; a misrecognized intent now asks the user to clarify instead of firing a wrong action. `spent 2 hours studying` no longer drafts a transaction; a weak money word no longer confidently switches faces; a multi-face utterance routes to `clarify` instead of letting fixed FACE_KEYS order decide. `pnpm test` green (1697), no new deps
- ✅ 2026-08-22 — **HUB-1 follow-up** post-delivery review caught two false negatives in the same-day landing: the flat cross-face fallback let a bare `switchFace` keyword echo tie with a fully slot-filled intent ("remind me to buy dinner ingredients" wrongly went to `clarify/ambiguous` instead of `draftReminder`), and the active face's own weak `clarify` short-circuited before other faces' routers ran at all ("remind me to buy groceries" with Budget active never reached schedule). Fixed in `intents/index.ts` by tiering cross-face hits (slot-filled kinds beat bare `switchFace`) and letting a weak local `clarify` step aside for a stronger cross-face hit. One row corrected, one row added to the fixture (39 green). `pnpm test` green (1699), no new deps
- ✅ 2026-08-22 — **HUB-12** ERA Phase 2 intents: `draftReminder`, `showAnalytics`, and `draftTransaction` all resolve for real. Three intents had been reaching `resolveIntent`, falling through to `replyFormatter`'s "Coming soon" string and writing nothing — the worst failure shape in the taxonomy, since the reply reads like success. Now: `draftReminder` → `POST /api/items` via `resolvers/schedule.ts` (`parseSmartText` for title/date/recurrence, `localToISO` for the UTC instant, **`due_at` omitted entirely when `confidence.date === 0`** so we never invent a due time that fires an alert immediately); `showAnalytics` → `GET /api/analytics?months=2` summarizing the current month with a top-3 category list and a month-over-month delta; `draftTransaction` moved **off** its parallel CommandBar path onto the resolver, with `useEraBudgetSubmit.submit` injected as a `ResolveDeps` capability so the Undo toast (Hard Rule #1) and cache invalidation stay exactly where they were while the dispatcher becomes the single owner of "intent → reply". Reply and side effect can no longer disagree: a failed draft now says so instead of returning "Drafting $25.00…". New fixture `src/features/era/intents/resolveIntent.test.ts` (14 green). `pnpm test` green (1715), typecheck clean, no new deps
- ✅ 2026-08-22 — **HUB-15** ERA stopped reading from a script. Every reply was a single hardcoded string, so the fifth reminder of the day came back word-for-word identical to the first — the tell that collapses the illusion of an assistant that's listening. New `src/lib/era/phrasing.ts` holds the mechanics (`pick`/`fill`/`say`, `describeWhen`, `money`, `plural`, `listOut`, `errorReply`, time-aware `greeting`) and every situation across all four faces now owns a **pool** of slot-templated phrasings drawn at random — ~40 pools, 4–10 variants each, covering reminders, schedule, spend, analytics, drafts, recipes, memory, greetings, clarify/unknown and the in-flight interstitials. Lives in `src/lib/` because ERA and voice-conversation are both standalone feature dirs and may not import each other. Four rules are written into the module header and enforced by test: **every variant carries the same facts** (variation is connective tissue only), slots rather than concatenation, no personality-of-the-day, and an error's *diagnosis* is never randomized — only its apology and retry nudge. New fixtures `src/lib/era/phrasing.test.ts` (23) and a variant harness in `resolveIntent.test.ts` that drives `Math.random` across its range, collects every sentence a pool can emit, and asserts the payload survives in **all** of them (a future "breezier" variant that drops the due time or the amount fails). `pnpm test` green (1741), typecheck clean, no new deps
- ✅ 2026-08-22 — **HUB-15 fallout** building the pools surfaced four defects in the phrasing engine, all caught by the sample harness before shipping: `fill` orphaned a separator when a slot was empty (`"one,."`, `"one —."`); it inserted a space in front of *every* slot, so `"{Title}"` rendered `" Water the plant"`; fixing that naively removed the space where a template deliberately wrote the slot flush so an empty one left no gap, giving `$25under Car / Fuel` — resolved by keeping a template-written space, and otherwise adding one unless the slot sits at the start or against an opening delimiter; and `money()` with `minimumFractionDigits: 0` rendered `$1,240.5`, which reads as a typo. Also fixed: sentence-casing after an opener that ends in a full stop (`"Checked. in August…"`), `lowerFirst` de-capitalizing the pronoun "I", and plural disagreement in two schedule pools used only when count > 1 ("There's 3 things due today")
- ✅ 2026-08-22 — **HUB-12 title fix** the schedule router had been copying the whole utterance into the reminder title, so "remind me to call the bank" created an item literally titled "remind me to call the bank". It now stores `parseSmartText`'s cleaned title. Doing so exposed a latent bug in `smartTextParser.extractTitle` shared with **MobileReminderForm and BulkConvertReviewSheet**: every optional filler word in the lead-in strippers was unanchored, so the group ate the *prefix* of the real first word — "remind me tomorrow" titled the item **"Morrow"** and "schedule an appointment" became **"N appointment"**. Fixed by anchoring each optional group with `\b` (13 patterns). Three rows in `rootIntentRouter.test.ts` updated from raw to clean titles
- ✅ 2026-08-26 — **HUB-23** ERA "Ask AI" (Slice 4, delivers WP-10): the manual escape hatch for when the deterministic router can't handle a request — a sparkle button in `CommandBar`, always visible, never auto-triggered (locked decision). `fetchBudgetContext`/`fetchMonthlyTrend` were extracted verbatim from `api/ai-chat/route.ts` into `src/lib/ai/context.ts` (Next.js route files can only export HTTP methods, so anything meant for reuse — this is now the SECOND consumer, `/api/era/ask` — has to live in `lib`); a new `fetchScheduleContext` gives the schedule face upcoming items + every NFC tag with its declared states and live `current_state`. `src/lib/ai/eraAskProposal.ts` asks Gemini for structured JSON — either `{kind:"prose"}` or `{kind:"propose_nfc_reminder", reminderTitle, nfcTagId, targetState}` — using the exact same three-layer pattern `analysisReport.ts` established: `responseSchema` constrains the shape, Zod validates it, and critically, **the model's `nfcTagId`/`targetState` are never trusted blindly** — `parseAskAIResponse` degrades to plain prose unless they match a real tag in `ScheduleContext`, so a hallucinated identifier can never reach a confirm card, let alone a write. This directly answers the owner's own worked example: "remind me when I arrive home" has no date for `parseSmartText`, so Slice 3 now asks "when should I remind you?" — tapping Ask AI instead of answering resends that same sentence to Gemini with the household's real NFC tags in context, and (if a tag plausibly matches) renders a confirm card; Confirm performs the two deterministic writes (`POST /api/items` then `POST /api/items/[id]/prerequisites`) only after the tap — the model never writes anything itself (Doctrine Q10). One proposal kind shipped, deliberately (HUB-24) — this is the owner's real scenario, not a framework built ahead of a second use case. New `src/lib/ai/eraAskProposal.test.ts` (13 cases) pins the safety gate directly: a well-formed proposal naming a tag that doesn't exist degrades to prose every time, and a forced model failure/malformed response never throws and never proposes. `pnpm test` green (1903), typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-26 — **HUB-20** Meal planning joins ERA (Slice 5): three new Chef intents — `listRecipes` ("what recipes do I have"), `assignMeal` ("assign chicken to thursday dinner" → resolves the dish against `/api/recipes`, the day against the existing `parseSmartText` day-of-week logic reused rather than writing a second parser, and upserts via `POST /api/meal-plans`, which already updates-in-place on a taken slot and already 400s with a clear message when there's no household — this resolver surfaces that message instead of re-deriving the household check), and `mealPlanGaps` ("what's unassigned this week" → the next 7 days with no `meal_plans` row at all, pure client compute over one fetch, no new aggregation engine). Dates are never parsed into `Date` objects from bare strings — `formatDate()` (local calendar fields) builds the query range and `` `${date}T12:00:00` `` anchors the display label — the module's documented UTC-midnight-drift trap. New tests in `resolveIntent.test.ts` (7 cases) caught exactly that trap once, in the TEST itself: a first draft used `.toISOString().slice(0,10)` to build mock `planned_date` values and silently dropped a day in this environment's timezone. `pnpm test` green (1886), typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-26 — **HUB-19** Reminder time becomes a required slot (Slice 3): `resolveDraftReminder` no longer writes an undated item when `parseSmartText` finds no date — it asks ("Got \"Call the bank\" — when should I remind you?") and returns a `pending` question. A new `EraPendingTurn` (one shape, one missing slot — `title`) lives in `useEraStore` (in-memory only; a reload loses it, same as any other browser state) and `useEraTurn.runTurn` checks it before the normal router: if a question is outstanding, the WHOLE next utterance is handed to `resolvePendingReminderAnswer` as the answer, never reclassified as a fresh command. A date-shaped answer ("tomorrow at 4pm") completes the reminder through the same write path as a one-shot request; anything else flushes the title to a reviewable `items.status = 'draft'` row — the same rule bulk-convert already uses — rather than losing it or misreading it as an unrelated command. This directly answers the owner's own complaint: ERA previously "logged the reminder without mentioning the time" and moved on; now it either gets a real time or the item waits in Drafts for one. Deliberately NOT built: a general multi-slot framework, or handling the case where the "answer" is actually a genuinely new unrelated command (that command gets treated as a failed time-answer and flushes the pending reminder to draft — a known, documented rough edge, not a silent gap). `resolveIntent.test.ts` gained a `resolvePendingReminderAnswer` suite (3 cases) plus two rewritten `draftReminder` tests (the old "omits due_at" and "never implies a nudge" tests asserted the now-removed undated-write behavior). `pnpm test` green, typecheck clean, no new deps.
- ✅ 2026-08-26 — **HUB-18** Budget capability set (Slice 2): four new intents — `transfer` ("transfer $50 from wallet to savings", self-transfers only, fuzzy account-name matching against the user's own accounts, direct write via the existing `POST /api/transfers` + its already-correct `DELETE` inverse), `recordDebt` ("John owes me $30 for lunch" → `POST /api/debts/standalone`, a pure receivable with zero balance effect at creation or settlement, deliberately not the linked-transaction debt flow which needs an account the router can't reliably parse from one utterance), `listDrafts`, and `confirmDraft` (confirms via the same `PATCH /api/drafts/[id]` the Drafts drawer uses, which overwrites the row rather than partial-patching — this resolver re-fetches the draft's full fields and echoes them back unchanged except `is_draft`). Also fixed in the same session: **HUB-13** (`showAnalytics` now re-sources its headline expense/transactionCount/top-categories from the same custom-billing-month `/api/transactions` window `monthSpend` uses, instead of `/api/analytics`'s calendar-month bucket — income/savings-rate and the previous-period comparison deliberately stay calendar-based, a narrower fix, not a re-architecture) and **HUB-14** (`/api/transactions` has no server-side scope filter at all — it always returns both household members' rows tagged with `user_id` — so "partner" scope was quietly returning the household total under a "your partner has spent" label; now scoped client-side from data already fetched, zero extra round trips, and "self"/"partner" without a resolvable current-user id return an honest error instead of a mislabeled household number). `resolveIntent.test.ts` gained 5 cases for HUB-13/14 and router fixtures for all four new intents. No Undo toast on transfer/recordDebt/confirmDraft — same precedent as `draftReminder`: a real, immediate write confirmed by the spoken reply, undoable from each module's own page. Deliberately deferred: debt *settlement* (no clean Undo inverse exists via the current API — PATCH only supports incremental settlement, not restoring a prior state), expense-split, recurring add/skip (tracked as HUB-22). `pnpm test` green, typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-25 — **HUB-17** ERA Hub (`/era`) voice had never actually worked: `EraShell` mounted `useConversationMode` with only `onWillSpeak` wired, so `conversationEngine.executeNativeIntent` optional-chained through five missing handlers and then spoke `successTemplate(intent)` unconditionally anyway — "Added $25 to Fuel" while writing nothing, for every native voice intent on the app's own flagship page. Fixed by adding an optional `runTurn?: (text) => Promise<{reply, kind}>` to `ConversationHandlers` (`conversationEngine.ts`) that replaces the legacy five-callback path when present; `EraShell` wires it to a new `src/features/era/useEraTurn.ts` — the same hook `CommandBar` now calls for typed input, so both surfaces run one classify (`rootIntentRouter.parse`) → one resolve (`resolveIntent`) → one persist (`era_messages`) path and cannot disagree on a reminder's due time or a draft's fate. The legacy `/chat` path (`HubPage.tsx`, untouched) got the same false-success fix defensively but keeps its own `classifyIntent`/`speechTemplates.ts` — that's HUB-16, now correctly scoped to `/chat` only. Also: the single-line `eraReply` display became `EraThreadTranscript`, a scrollable multi-turn view of `era_messages` (the owner's ask — "not only a single response, but a full conversation thread"), typewriter effect scoped to the newest row only via a ref-based guard (a state-based guard was tried first and re-triggered the effect on its own update, killing the interval a tick after it started — caught before shipping by adding temporary trace logging and reproducing live). Six confirmed-zero-importer components deleted (`FaceCanvas`, `EraHubView`, `QuickFaceChips`, `EraFaceCard`, `FacePlaceholder`, `FaceHeader`, `EraTranscript`); dead `useEraStore.turns`/`pushTurn`/`clearTurns`/`eraActions` removed. `pnpm test` green (1861, +0 new — no new test file; existing `rootIntentRouter.test.ts`/`resolveIntent.test.ts` are the regression net for the unchanged classify/resolve logic this reuses), typecheck clean, 0 new lint issues, no new deps. Verified live against the dev DB via the actual `/era` UI: a real reminder ("remind me to call the bank tomorrow at 4pm") saved with correct `due_at`, `monthSpend`/`todaySchedule` resolved correctly — then removed via the app's own delete endpoint (Hard Rule 26: no direct DB writes, even to clean up test data)
- ✅ 2026-08-06 — **HUB-11** per-message color tags + color filter (`hub_messages.color`, `src/features/hub/messageColors.ts`) — compose-bar palette picker (sticky per-thread), long-press-to-recolor, header filter button; Multi-add's "Select all" now scopes to the active color filter so a mixed budget thread can be swept color-by-color instead of in one undifferentiated pass (migration `2026-08-06_hub-message-color.sql`, pending manual run)
- ✅ 2026-08-27 — **HUB-25** `/era` Activity log (owner request: "an inbox... showing everything the application created/updated... history of today", worked example was "remind me to water the plant" leaving no trail back to the reminder). New `era_actions` log table (migration `2026-08-26_era-actions.sql`, **pending manual run**) + `POST/GET /api/era/actions`; a single logging point (`src/features/era/logEraAction.ts`) maps each of ERA's 8 write-producing intents (`draftReminder`, `confirmDraft`, `draftTransaction`, `transfer`, `recordDebt`, `assignMeal`, `memorySave`, plus the Ask-AI NFC-reminder proposal confirm) to a title + deep-link route, called from `useEraTurn.runTurn` and `useEraAskAI.confirmProposal` — never from inside a resolver, so the mapping has exactly one owner. New `useEraActivity` hook filters to the caller's local "today" client-side (server has no reliable local timezone to filter by). Deep-linking required real wiring, not just a route string: `WebDayPlanner` gained an `initialOpenItemId` prop that fetches the item directly via `useItem` and opens `ItemDetailModal` regardless of which day-section it's in (reminders had no query-param deep-link at all before this); `WebDashboard` gained the same for transactions (`openId` search param → reuse the already-loaded page's row, or fetch `/api/transactions/[id]` and map it into the modal's `Transaction` shape). Transfers/debts still have no per-record detail view anywhere in the app, so their Activity rows land on `/expense` without opening anything — a real gap, not silently glossed over. **Surfaced as a new "Artifacts" chip in `EraFaceNav.tsx`** (`ArtifactsView.tsx`, a new dashboard alongside Budget/Schedule/Chef/Brain — `useEraStore`'s `EraView` gained a third `"activity"` value) — deliberately additive, not a redesign. *(Correction: this landed first as a full hub-layout redesign — orb shrunk to a top-left icon, scatter widgets turned into a grid, the "ERA" pill removed — which the owner explicitly rejected: "Oh hell no! Revert the Initial view! Just add an additional chip on top... YOU MUST REVERT TO HOW IT WAS WITH THE ANIMATION AND EVERYTHING!" `EraShell.tsx`/`EraFaceNav.tsx`/`HubScatterWidgets.tsx` were reverted to their pre-session state via `git restore` and the Activity feature re-shipped as the chip described above. Lesson captured in memory `feedback-no-unrequested-ui-redesign`.)* No new deps.
- ✅ 2026-08-27 — **HUB-25 fix** Activity reminder deep-link 404'd — `logEraAction.ts` built `/items?openId=...` but Items/Reminders has always lived at `/reminders` (no `src/app/items/` route ever existed). Both routes in `buildPayload`'s `draftReminder` case and `logEraNfcReminder` corrected to `/reminders?openId=...`. Any `era_actions` row logged before this fix still carries the stale `/items` route and will 404 until superseded (not rewritten — Hard Rule #26, no direct DB writes).
- ✅ 2026-08-27 — **HUB-26** Named-day schedule queries answered for the wrong day (Stage 0 of the ERA conversational-context plan, `.claude/plans/is-something-like-that-graceful-clock.md`): "what's on my schedule Saturday?" always answered for TODAY because `scheduleRouter`'s regex matched on the generic word "schedule" and never looked at the day named in the sentence. `todaySchedule` gained an optional `dateISO` slot the router now fills from `parseSmartText` (reusing its day-of-week/relative-date parsing — a second parser was not written); `resolveScheduleForDay` replaces `resolveTodaySchedule`, rebuilt on `fetchItems` (the same household-resolved `get_schedule_bundle` RPC bundle the day planner uses, newly exported from `useItems.ts`) and `getOccurrencesForDay` (same occurrence-expansion the day planner uses, via a newly-exported `fetchAllOccurrenceActions`) so ERA and the Schedule module read the identical source of truth and can't disagree. The reply changed shape too, per the plan's own acceptance bar ("return actual schedule items and times instead of only a count") — `formatScheduleForDay` now lists each item's title and local time; overdue stays a today-only concept (skipped for a named future/past day) and the "clean slate" pool is reserved for the true empty-today-and-nothing-overdue case, not just an empty named day. Caught mid-build: `parseSmartText`'s type detector reads "schedule" as an EVENT noun, which routes its parsed date into `startDate` instead of `dueDate` — both the router's day extraction and the reschedule resolver (HUB-27) fall back to `startDate`/`startTime` when `dueDate`/`dueTime` are empty, rather than silently losing the parse. New fixtures: a named-day router row (asserts day-of-week, not an exact date, since "Saturday" is relative to whenever the suite runs) and three `resolveScheduleForDay` cases in `resolveIntent.test.ts` (named-day items surface, a different day's items don't leak in, honest error when no user). `pnpm test` green (1926), typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-27 — **HUB-27** Capability registry + focus memory (Stage 1 of the same plan) — the two building blocks the plan's other worked example needed: `"Remind me to water the plants Saturday at 10." → "Change it to 11."` failed before this because ERA had no reschedule capability at all AND no memory of what "it" meant. New `src/features/era/focusMemory.ts` (pure, no DB) holds the last 10 entities ERA created/touched, 30-min TTL, newest-first, de-duped by id; `resolveFocusRef` implements the design doc's resolution order for what Stage 1's router can actually supply — a pronoun (it/that/this/that one/this one) resolves to the most recent live entity of the required type, and returns `null` (never a guess) when nothing qualifies, matching "never guess when multiple valid entities exist." `useEraStore` gained `focusEntities` + `pushFocusEntity`; `useEraTurn.runTurn` pushes the touched reminder after a create/reschedule/complete (never a delete — a deleted item should fall OUT of focus). Three new intents reuse focus memory: `reminderReschedule` ("change it to 11" — a bare time keeps the reminder's OWN existing date and only shifts the time, since defaulting to today could silently move something backwards; a full date+time overrides both), `reminderComplete` (non-recurring only — occurrence-safety guard: a chat pronoun can't disambiguate WHICH occurrence of a recurring item, so those are pointed at the app instead of guessed), `reminderDelete` (soft-delete via the existing Recycle-Bin route). All three are deliberately pronoun-GATED in the router regex (`\b(?:change|move|push|reschedule|shift)\b...\b(?:it|that|this)\b`), not verb-gated — "move" also means transfer money or move a meal, so requiring the pronoun is what stops "move $100 to savings" and "move dinner to Wednesday" from colliding with Budget's and Chef's own vocabulary (regression-tested). New `src/features/era/capabilities/` (Layer 4 from the plan's architecture): `EraCapability` interface + a 5-entry registry (`schedule.forDay`, `reminder.create/reschedule/complete/delete`) that wraps these resolvers with Zod slot schemas — not consumed by the deterministic router (which calls resolvers directly, unchanged), but the substrate Ask AI (Stage 3, not built this session) will validate structured proposals against instead of trusting a model to invent both the action and its shape. Deliberately deferred: `reminder.setRecurrence` (the plan's own caveat — "only if the backend already supports it" — updating a recurrence rule via chat needs occurrence-aware handling, a recurrence-safety-gated addition, not a small one) and Stages 2–5 (queued below as HUB-28..31). New fixtures: `focusMemory.test.ts` (17 cases, pure), `capabilities/registry.test.ts` (8 cases, schema contract), plus router + resolver cases for all three new intents including the two cross-face regression tests above. `pnpm test` green (1968), typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-31 — **HUB-27 enhancement: named-target support** — Stage 1's three reminder intents now also accept named targets, not only pronouns. `src/features/era/intents/schedule.ts` gained fallback patterns for `reminderReschedule` ("Move dentist reminder to 5"), `reminderComplete` ("Mark dentist done"), and `reminderDelete` ("Delete dentist reminder") by extracting the named target and resolving it via `resolveEntityRef` (the same fuzzy-title matcher the template learner uses). Each fallback tries pronouns first (recent context wins), then falls back to named-target matching; if the name is ambiguous or not found, `resolveEntityRef` returns `null` and the router gracefully falls through to Ask AI / clarify instead of guessing — the same "never guess when ambiguous" rule both surfaces already enforce. Reuses existing `resolveEntityRef` from `focusMemory.ts` (imported, no new logic). No new tests, relies on existing `rootIntentRouter.test.ts` and manual verification against live DB (Stage 1 regression). `pnpm test` green (1926), typecheck clean, 0 new lint issues, no new deps.
- ✅ 2026-08-27 — **HUB-28..31** ERA conversational-context plan, Stages 2–5 — the loop the owner's plan aimed for: *native miss → Ask AI → map to existing capability → ERA validates → execute → learn phrasing → similar future request works natively without AI.* Built on HUB-26/27's capability registry and focus memory, all four stages in one session:
- ✅ 2026-08-27 — **HUB-28..31 fix** own real-usage testing of the session above surfaced a pre-existing routing bug (not caused by the new work — Layer 2 only runs after Layer 1 misses, and neither router file had been touched): `"what's on my schedule this Saturday"` asked with a non-schedule active face returned `clarify: ambiguous` instead of answering, and the bare word `"Schedule"` returned `unknown`. Root causes: `brainRouter`'s `RECALL_PATTERNS[0]` (`/^what(?:'s| is| was)\s+.../`) is broad enough to match almost any "what's X" question as a memory recall, so it collided with `scheduleRouter`'s legitimate `todaySchedule` match whenever Schedule wasn't ALREADY the active face (the existing "named-day schedule query" fixture only ever ran with `active: "schedule"`, which short-circuits before the cross-face ambiguity check runs — it never actually exercised this path); and `scheduleRouter`'s generic face-switch word list had every schedule-domain noun except the word "schedule" itself. Fixed with a new `OTHER_DOMAIN_RE` guard in `brain.ts` (recall patterns skip entirely when schedule/budget/chef vocabulary is present — mirrors each face's own trigger words rather than inventing a parallel list) and adding "schedule" to `scheduleRouter`'s generic switch. Two new root-router regression rows in `rootIntentRouter.test.ts` reproduce the exact reported conversation with a non-schedule active face (the case the old fixtures missed). `pnpm test` green (2017), typecheck clean, 0 new lint issues, no new deps. HUB-28–31's own behavior untouched.
- ✅ 2026-08-27 — **HUB-32** mobile-only design pass on `/era` (owner: pill nav was clipping "Artifacts" with no way to reach it, the orbital ring rendered as an off-center oval, and a module dashboard's floating CommandBar + transcript ate most of a phone screen with an oversized empty gap above it). Desktop (`md:`+) untouched throughout — explicit owner constraint, verified structurally (every change gated by a `md:` Tailwind class or the existing `useIsMobile()` 768px flag) since this session's browser tooling couldn't force a real ≥768px viewport to screenshot. Fixes, all in `src/components/era/`: (1) `EraFaceNav.tsx` pill row gained `overflow-x-auto scrollbar-hide` + `shrink-0` on every pill so it scrolls instead of clipping; (2) `EraShell.tsx`'s mobile ring — root cause was `transform: translate(-50%,-50%)` used to center it, but `.era-hub-ring-inner`'s own `era-orbit-breathe` CSS animation owns the `transform` property outright and silently discards any inline transform value, which is what produced the off-center oval; fixed by giving the wrapper an explicit `160×160` box and centering the ring with `inset` math instead (never touches `transform`); (3) `dashboardTop` was computed from the desktop 3-ring block's height (`RING_H=500`) on every breakpoint — added a `RING_H_MOBILE` constant so mobile's much smaller single-ring mark doesn't over-reserve space above the dashboard; (4) new `EraChatDrawer.tsx` — mobile module/activity views now hide the floating CommandBar/transcript behind a chat-bubble FAB that opens a bottom sheet (confirmed with the owner over a bottom-sheet-vs-side-panel choice); `CommandBar` and the newly-exported `EraThreadTranscript` both gained a `variant?: "floating" | "embedded"` prop so the sheet reuses their mic/send/AI/realtime logic verbatim instead of duplicating it — `"floating"` (default) renders byte-identical to before. Caught and fixed during live testing: the sheet's close button correctly flipped React state (`open:false`, confirmed via the fiber's `memoizedProps`) but never unmounted — `AnimatePresence`'s exit-complete tracking was getting interfered with by the still-mounted embedded transcript's own re-renders (realtime messages, typewriter interval) while it was mid-exit, leaving a stuck, invisible, click-through-inert node forever. Fixed by dropping `AnimatePresence` for the backdrop/sheet entirely — they stay permanently mounted (only while the drawer is even eligible to show) and animate via `open` directly (`animate={{y: open?0:"100%"}}`, `pointerEvents: open?"auto":"none"`), which sidesteps exit-completion callbacks altogether. `pnpm typecheck` clean, `pnpm lint` 0 new warnings; live-verified via Chrome automation at a 390×844 viewport (pill scroll, ring centering via `getBoundingClientRect`, dashboard spacing, drawer open/close/send round-trip through `useEraTurn`) — no component tests existed for these UI files before or after (matches sibling era components, which are logic-tested, not UI-tested). *(Follow-up same day: the ring was still off-center horizontally relative to the "Good afternoon" greeting, spotted by the owner from a screenshot. Root cause: the 160×160 ring wrapper is a plain block box inside a WIDER shared parent — sized by the greeting text's own wrapped-line width, not by the ring — so it defaulted to flush-left instead of centered, while the greeting text only *looked* centered because `text-align:center` centers text within that same wide box. One-line fix: `mx-auto` on the wrapper. Re-verified — ring/mark/greeting/viewport centers all land on the same x-coordinate via `getBoundingClientRect`.)*
- ✅ 2026-08-27 — **HUB-32 polish** owner liked the mobile chat-bubble FAB's (`EraChatDrawer.tsx`, from HUB-32 above) module-hue color but wanted it glossy/gradient instead of flat — `background` changed from a flat `var(--era-accent)` fill to a 3-stop `linear-gradient` still driven off the same `--era-hue`/`--era-sat`/`--era-lum` vars (so it keeps tracking the active module color), plus an absolutely-positioned specular highlight overlay and a layered `boxShadow` (ambient hue-tinted glow + inset top/bottom sheen) for a raised, glassy look. Not live-verified in-browser this session (owner flagged as worth a follow-up check).
- ✅ 2026-08-27 — owner-reported bug fix: `"Transfer 2$ from my account to drawer"` never transferred anything — ERA replied only "Switched to Budget." Root cause: `budgetRouter`'s transfer regex (`intents/budget.ts`) required the `$` to precede the digits (`\$?(\d+...)`), so a trailing-symbol amount ("2$") never matched; the utterance then fell through every other pattern (no spend verb, so no `draftTransaction` either) until the generic domain-noun check matched "account" and fired a bare `switchFace` to Budget with no write. Fixed by making the currency marker optional on both sides of the digits, mirroring `extractAmount`'s existing token shape. New regression row in `rootIntentRouter.test.ts` ("transfer with trailing dollar sign on the amount"). `pnpm vitest run rootIntentRouter.test.ts` green (65/65), no new deps. `recordDebt`'s regex had the same leading-`$`-only gap — fixed in HUB-35, below.
- ✅ 2026-08-31 — **HUB-33** closed the four real gaps in HUB-27..31's "native miss → Ask AI → learn → native next time" loop that a fresh audit found (owner asked to revisit the whole pipeline against the original spec — see the session's own plan file, `i-need-to-revisit-optimized-rocket.md`, for the full before/after map):
- ✅ 2026-08-31 — **HUB-34** two verified defects in HUB-33's taught-template loop, surfaced by an owner-requested second-opinion review of the whole pipeline (checked claim-by-claim against the code first — most of the review's other suggestions, e.g. new `slot_types`/`confidence`/`specificity` columns, were speculative or already true and deliberately NOT taken; see the session's own plan file for the full accept/reject table):
- ✅ 2026-08-31 — **HUB-35** native-router coverage + collision hardening pass across all three per-face Layer 1 routers (`intents/{schedule,budget,chef}.ts`), requested as a standalone audit rather than a bug report. The HUB-27 named-target enhancement (same day) had shipped with no new tests; this pass closed the gaps that left plus two money-wrong false positives and several unguarded cross-face collisions:

## Delivery session log

_(Delivery runner appends dated progress bullets here automatically.)_

- 2026-08-22 — **HUB-1** delivery session `s-20260822-093143-t7tm` ended **paused — needs a decision** at NEEDS_DECISION. 0 file(s) changed.

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
