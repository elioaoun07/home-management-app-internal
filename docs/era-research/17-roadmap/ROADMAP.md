# Roadmap proposal

**Status: PROPOSED throughout — no commitment, schedule, staffing allocation, or approval.** Baseline: `9cd4166691edd9367ea1bd9a604e0bec13ffe870` plus the local inputs in [README](README.md). Evidence IDs E1–E9 refer there. Candidate costs and risks are in [PRIORITY-MATRIX](PRIORITY-MATRIX.md); prerequisite edges are in [DEPENDENCY-MAP](DEPENDENCY-MAP.md).

## PROPOSED initial set: less noise, clearer saved work

Select **Q1 + F1 + conditional C1**. They form a small outcome: the user receives one clear acknowledgement and can find what ERA actually saved or left unresolved. Q1 can ship independently; F1 protects C1's truthfulness. No new capability family, provider, Home destination, notification or mandatory maintenance habit is needed.

### PROPOSED Q1 — Consolidate draft-confirmation feedback

- **Benefit/foundation:** one success receipt with discoverable Undo, reusing the existing hook (E2). This is a source-confirmed duplication, not an inferred visual defect.
- **Scope:** trace `useConfirmDraft` callers; remove redundant drawer-level success feedback while preserving close/edit behavior and hook feedback. Verify failure feedback ownership too; do not expand into unrelated toast cleanup or alter financial mutation logic.
- **Dependencies/effort:** independent of F1/C1/R1; XS, 0.5–2 days. Existing money-path behavior must remain intact; follow its applicable implementation playbooks.
- **Uncertainties:** other callers may own feedback; deleting a confirmed transaction is not necessarily restoring the original draft. This slice must not advertise a stronger inverse than exists.
- **Acceptance:** a successful drawer confirmation emits exactly one success receipt with the existing Undo action; other callers still get feedback; failure does not emit success or two competing errors; drawer closing/edit reset remains correct. Verify a mocked mutation and a mobile/keyboard interaction with isolated data. Inspect Undo without changing its effect or claiming financial end-to-end certification.
- **Reconsider:** if the duplicate has already been removed when work starts, close the candidate without replacement work. If inverse defects emerge, scope them separately before changing money behavior. Easy presentation rollback; no migration.

### PROPOSED F1 — Close only the readiness/documentation gaps needed next

- **Benefit/foundation:** prevent offering unavailable recovery or claiming unverified guarantees. Reuse existing assistant overview, execution docs/runbook and fixtures (E3–E5), not a new readiness service.
- **Scope:** establish whether interrupted work is persisted, journal rollout/access are supported, and current history solves the user's need. Record evidence dates and unknowns in existing authoritative docs during a later authorized task. This proposal itself does not update them.
- **Dependencies/effort:** none; small, 1–3 days, excluding owner response time. Not required for Q1.
- **Uncertainties:** source presence does not reveal flag state, applied migration, current RLS or interruption frequency. Owner walkthrough and approved deployment evidence are needed; no production agent writes.
- **Acceptance:** a short consumer-specific readiness verdict distinguishes implemented/enabled/verified/unknown; a persisted versus unsent interruption example is traced; each C1/R1 gate has evidence or a named blocker; no competing queue or broad audit is created.
- **Reconsider:** stop when the gate is answered. If journal deployment is not wanted or interruptions are mostly unsent text, retain current behavior and revisit the actual capture problem separately.

### PROPOSED C1 — Locate persisted work without promising automatic recovery

- **Benefit/foundation:** return to an unfinished request without reconstructing its conversation. Reuse history, `EraRunCards`, source links and owner-bound run state (E3/E4); improve existing history first, rather than adding a page.
- **Scope:** a small entry into existing ERA history that opens the original request and shows acknowledged results versus unresolved steps. If cross-conversation discovery is necessary, add a bounded owner-only read projection: current API requires a conversation, so aggregation is not a free existing capability. Define pagination and partial/cancelled-history inclusion explicitly; preserve history access to older partial work.
- **Dependencies/effort:** F1 and owner decisions O2/O3; small–medium, 2–5 days after F1. Does not require R1. New projection only navigates/inspects; existing run-card execution retains its current guards.
- **Uncertainties:** discoverability, useful history window, archive semantics, volume, stale/deleted source references and enabled rollout.
- **Acceptance:** reopening never dispatches a write; original conversation/date anchor and authorized acknowledged links remain intact; uncertainty is Check, not failed or saved. Permission/account changes reveal no private snippets. Empty, unavailable, stale and disabled states differ. Older unresolved/partial work stays findable through history; no badge-clearing chore. Owner can locate a prepared interrupted fixture without retyping; keyboard and 390 px actions remain reachable. No new retry, auto-enqueue or extra permission follows from an entry being visible.
- **Reconsider:** if existing history already meets the outcome, choose Z1. If aggregate history adds little benefit, keep the change conversation-local. Removing the entry must not delete runs or source work.

## PROPOSED next investment: source-safe continuation, only if justified

### PROPOSED R1 — Finish supported persisted requests safely

- **Benefit/foundation:** avoid repeated effects and preserve partial progress for ordinary own one-time reminders and authorized shopping additions. Reuse B1, existing journal/consent/adapters/artifacts (E4/E6); do not build a workflow engine.
- **Scope:** stable source operation identity, atomic source receipts or proven equivalent, deterministic reconciliation, safe remaining-step execution and conflict-aware correction for those two adapters. Exclude money, recurrence, external actions and unsent text. Keep within existing plan limits.
- **Dependencies/effort:** F1; permission and source-receipt/inverse gates from the dependency map. Large, 8–20 days; reset estimate if either source cannot support the contract. C1 is optional.
- **Uncertainties:** journal and source commit can diverge; source receipt atomicity, version checks and inverse coverage are not proven by run state. Schema changes may be necessary and are future deliverables, never agent-applied production operations.
- **Acceptance:** B1-A1–A10 are the starting specification, not passed tests. In particular, lost source acknowledgement reconciles without another insert; concurrent confirms cannot duplicate effects; unsupported uncertainty remains Check; done steps never repeat; revoked access blocks remaining work; changed effective values/date require review; Stop preserves completed work; stale Undo cannot overwrite another edit. Direct inspection works without a model. Test source failure points using isolated fixtures/replay before owner rollout.
- **Reconsider:** if source proof is unavailable, keep inspect-only C1; never weaken replay safety to meet a date. If interruptions rarely matter, choose Z1. Disable dispatch/retry for rollback while retaining receipts and access to corrections.

## PROPOSED later options: choose one based on household evidence

These are independent options, not a scheduled sequence. None is part of the initial set.

### PROPOSED D1 — Reset the remaining day

- **Benefit/foundation:** deliberately revise one to three commitments using existing occurrence expansion and source move/placement operations (E6/B2).
- **Scope:** Keep/Move for eligible own ordinary one-time reminders; Return only for supported own flexible placements. Source-managed, fixed, partner-owned, completed and recurring-series work stays Open-only. Leave `day_plans` intent/checklist untouched; no free-time guarantee from one-way calendar export.
- **Dependencies/effort:** own eligibility, stable occurrence identity, version/receipt and inverse contracts; large, 8–18 days excluding shared R1 investment. No K1 or global Home prerequisite.
- **Uncertainties:** actual disruption frequency, DST/travel dates, source-managed exclusions and concurrency.
- **Acceptance:** B2's proposed tests plus Keep causes no mutation; move preserves identity; protected work cannot be moved; partial results retain receipts; changed sources and ambiguous local times require review; stale inverse cannot reset the day. User completes a direct-control walkthrough without an AI response or mandatory duration estimates.
- **Reconsider:** prioritize only if direct Schedule editing is measurably awkward in an owner walkthrough. If a small existing bulk-control improvement suffices, reject the reset workflow. No autonomous scheduling.

### PROPOSED K1 — One dinner through preparation and explicit cooking

- **Benefit/foundation:** reuse a saved recipe's ingredients without transcription, with clear meal/list/cooked facts (E6/B3).
- **Scope:** one empty dinner slot, explicit date/audience, original recipe quantities, ingredient selection and existing list, linked receipts, optional explicit Cooked follow-through. No pantry census, expense automation, allergy guarantee, scaling or occupied-slot replacement.
- **Dependencies/effort:** meal/list access, coverage preconditions, source contribution identities, recipe-version checks and cooking/inverse audit; large, 8–18 days excluding shared R1 work. Does not depend on D1.
- **Uncertainties:** usable recipe data, willingness to mark cooked, shopping metadata partial failure and other cooking history/statistics effects.
- **Acceptance:** B3-A1–A13 provide proposed fixtures: explicit none adds no ingredients; lunch does not fill dinner; changed recipe forces review; repeated operation cannot duplicate groceries; list failure preserves saved meal; checked groceries do not imply cooked/stock/expense; Undo preserves later household edits and restores status/timestamp coherently.
- **Reconsider:** compare a clearer existing ingredient picker plus source links first. If recipes are sparse or dinner is not planned here, choose Z1 rather than creating pantry upkeep. Household-only versus solo scope remains O5.

### PROPOSED M1 — Source-rich household recall

- **Benefit/foundation:** understand which stored fact an answer refers to and whether it may be stale; reuse memories API/resolver (E6 comparison C4; memory index in README).
- **Scope:** authorized source ID/link, age and ambiguity choice for simple recall. Open source for corrections; no new memory store, extraction pipeline or automatic rewriting.
- **Dependencies/effort:** storage/schema/access readiness and a real correction destination; medium, 3–7 days after proof, independent of R1.
- **Uncertainties:** deployed storage, audience, conflicting facts and useful age semantics.
- **Acceptance:** ambiguous labels do not silently select the first result; inaccessible facts/snippets stay hidden; unknown age stays unknown; each displayed source opens the authorized record; no mutation on recall.
- **Reconsider:** promote if repeated lookup is frequent and access is established. Reject expansion if source links solve the issue; do not compensate for absent storage evidence with another system.

### PROPOSED A1 — One pull-only proactive situation

- **Benefit/foundation:** return useful foresight with low interruption cost; reuse attention surfaces and E8's proposed silence rules.
- **Scope:** one owner-chosen, evidence-backed situation surfaced on request/open, with dismiss/mute/source link. No push, cron activation, autonomous execution or arbitrary imported thresholds.
- **Dependencies/effort:** reliable source, freshness, identity, current recipient access, persisted dismissal and silent-case fixtures; medium–large, 5–12 days.
- **Uncertainties:** relevance, acceptable attention budget and existing dismissal semantics.
- **Acceptance:** stale/unavailable/restricted evidence suppresses claims; dismissed unchanged situation stays dismissed; no duplicate card; source resolution removes the suggestion; silence cases pass offline. Dismiss never completes a source task.
- **Reconsider:** only after owner demand for a named situation. If noisy or routinely ignored, disable rather than add a ranking model or more reminders. Push requires a separate decision and operational liveness proof.

### PROPOSED N1 — Global shell and Home consolidation

- **Benefit/foundation:** potentially fewer wrong turns; E7 identifies structural differences and existing navigation to reuse.
- **Scope:** discovery/prototype of a canonical Home and fewer redundant controls before any route migration. Local noise removal remains preferable; neither all subtitles nor starter actions are proven harmful by source alone.
- **Dependencies/effort:** observed navigation problems, owner destination choice, deep-link/installed-app and retained-work/search contracts; large–XL, 10–25 days, discovery-dependent.
- **Uncertainties:** habits, current shortcuts, actual mobile density, privacy of aggregate search and unintended capture changes.
- **Acceptance:** owner completes capture/find/return tasks with fewer wrong turns than baseline; precision URLs/install launches still work; Back preserves origin; keyboard/save visibility and account isolation pass. Prototype can be rejected without changing production routes.
- **Reconsider:** defer until local Q1/C1 improvements prove insufficient. Do not implement Capture/Find/Continue as three new stores or dashboards merely because the interaction study proposes those names.

## PROPOSED rejected direction and no-build option

### PROPOSED X1 — Reject a new universal engine

- **Benefit/foundation:** hypothetical uniform automation; existing capability registry/journal already supply the foundation (E1/E5/E6).
- **Scope evaluated:** a replacement agent/workflow/memory framework, broad autonomous execution or mirrored universal task store. Reject for this roadmap: duplicates responsibility, increases permissions and migration risk, and has no demonstrated unique household outcome.
- **Dependencies/effort:** first prove a specific requirement impossible through existing contracts; XL, 20–60+ days as a low-confidence discovery envelope, not an estimate to fund.
- **Uncertainties:** scope, ownership and ongoing maintenance are effectively unbounded.
- **Acceptance for reconsideration:** a narrow comparison must demonstrate a missing necessary primitive, measurable advantage over extending the existing path, an explicit migration/rollback strategy and permission boundaries. No platform build before that evidence.
- **Reconsider:** only on that evidence; novelty or broader tool counts are insufficient. Current rejection is highly reversible; a state migration would not be.

### PROPOSED Z1 — Do nothing beyond current behavior

- **Benefit/foundation:** preserve familiar tools and avoid new maintenance. All current source behavior is the baseline.
- **Scope:** decline any candidate whose outcome is already easy, rarely useful or too uncertain; optionally walk through the existing flow once. This is a decision, not a silent backlog entry.
- **Dependencies/effort:** no build; zero days, or 0.5–1 day for an optional comparison. Do not use low demand to dismiss a demonstrated correctness/security failure.
- **Uncertainties:** opportunity cost and unobserved pain remain.
- **Acceptance:** owner can complete the relevant baseline task, understands saved versus unresolved state, and sees no material advantage from the proposed slice; record the reason only when a future authorized decision is made.
- **Reconsider:** an actual lost/duplicated action, repeated reconstruction, frequent ambiguous recall or new household need supplies a concrete trigger. No recurring review ceremony is needed.

## PROPOSED evaluation and stop rules

Compare a fictional fixture on the current flow and the smallest direct-control prototype before expanding. Observe completion, wrong turns, retyping, extra feedback, and whether the owner can explain what was saved and what remains unknown. These are future observations, not claimed analytics. Safety acceptance requires zero unauthorized disclosures or duplicated effects in the scoped fixtures; convenience does not excuse a safety failure.

Carry E1's questions into each later implementation: partner visibility, added capture effort, offline behavior, exact inverse, duplicate dispatch, cache refresh, read cost, person-absolute identity, optional proactive seam and deterministic fallback. For the initial set, this means no partner run-history sharing, no new required inputs, truthful unavailable state, preserving Undo, no write on navigation, source-owned caches and no model needed to locate work. Proactive expansion deliberately waits.

Stop expanding when the small outcome is met. Missing evidence narrows behavior or blocks the dependent increment; it does not justify a new framework. No acceptance criterion in this pack authorizes production writes, paid calls, deployment or operational-plan updates.

## Owner decisions before dependent implementation

These questions do not block this documentation delivery. Defaults are PROPOSED assumptions, not consent.

| ID | Decision | Proposed starting point / affected candidates |
|---|---|---|
| O1 | Which real friction is frequent: duplicate feedback, losing persisted work, or unsent text loss? | Q1 first; validate C1/R1 only for persisted interruptions. If unsent loss dominates, scope that separately |
| O2 | Where should unfinished requests be found, including archived and partial work? | Existing ERA history first; small entry only if needed, no new Home or daily queue (C1) |
| O3 | What retention/deletion and diagnostic content are acceptable? | Minimize private copies; preserve unresolved-source evidence; explicitly settle history versus receipt deletion before C1/R1 release |
| O4 | Can the owner provide current journal/permission evidence, and is durable execution desired? | No inferred flag enablement; unavailable mode stays honest (F1/C1/R1) |
| O5 | Which later outcome matters more, day reset or dinner, and is household-only dinner acceptable? | Choose one after a walkthrough; direct controls, no required AI (D1/K1) |
| O6 | Is source-rich recall or a specific proactive situation valuable enough to displace later workflow work? | Exact source-backed recall or one pull-only situation; no general memory/push expansion (M1/A1) |
| O7 | Is a canonical Home change desirable across existing shortcuts and installs? | Preserve destinations until demonstrated confusion warrants N1 |

## Consistency review

Review performed for this documentation pack:

- Candidate IDs F1/Q1/C1/R1/D1/K1/M1/A1/N1/X1/Z1 match the matrix, dependency map and candidate definitions. Every candidate includes benefit, foundation, scope, dependencies, effort, uncertainties, acceptance and reconsideration.
- Initial selection is Q1 + F1 + conditional C1 everywhere. R1 is conditional next work; D1/K1 are alternatives. C1 is an inspect/discovery increment, not delivery of the complete B1 blueprint.
- All stages and diagram nodes are PROPOSED; no dates, tickets, assignments or operational statuses are created. Effort ranges are judgments, not commitments or measured velocity.
- Journal concurrency never becomes source idempotency; unknown never becomes failed; Stop never becomes rollback; a shopping check never becomes cooking or a spend; calendar export never becomes complete availability. Retention decisions and source permissions remain explicit gates.
- The inventory distinguishes 62 existing pack files from these four new outputs and separates untracked inputs from committed source. No absent research pack or live behavior is invented.
- Local link targets and cited line bounds were checked; the output directory contains only the four requested files. Final Git status was compared with the starting state to verify no tracked edits and only this added output directory beyond the pre-existing untracked inputs.
- Code/runtime/device tests were not run: no implementation changed. Finish-task code, migration, Atlas and PM-update gates are inapplicable. Live deployment, RLS, user value, usability and estimate accuracy remain unverified.

**Strongest first implementation candidate: Q1, one draft-confirmation feedback owner.** It has direct source evidence, a small boundary, immediate reduction in noise, high reuse and easy rollback. **Strongest larger investment if interruption pain is confirmed: R1**, preceded by F1 and retained inspect-only behavior wherever source outcomes cannot be proved.
