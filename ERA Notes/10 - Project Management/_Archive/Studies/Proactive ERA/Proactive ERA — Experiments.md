---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# Proactive ERA — Experiments

The first proof should be that ERA can make one useful decision available earlier, without inventing facts or increasing noise. An experiment that disproves a proposed capability is a successful study outcome.

**Status: specifications only; none of these experiments was run in this session.** Source research at `83e44be`, 2026-09-06, established the paths described in the [Intelligence Model](<Proactive ERA — Intelligence Model.md>) and [Knowledge Graph](<Proactive ERA — Signal & Knowledge Graph.md>). No application code, production data, scheduler, model inference or device delivery was exercised. Current [Master Plan](<../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>) lanes/capacity and owner gates remain unchanged.

Numbers below are **proposed admission thresholds**, not measured performance, probabilities or statistical guarantees. Synthetic fixtures can establish invariants; usefulness needs the household's judgment. Begin with X1/X2, then choose one bounded X3 case. Run the model comparison only if the deterministic baseline leaves valuable cases unresolved. X IDs are research references, not task IDs.

## X1. Does the evidence contract distinguish observation from default?

**Hypothesis:** the smallest missing primitive is evidence basis at the fields used for a decision. `asOf + complete` alone is insufficient.

**Setup:** construct synthetic recipe feedback, task completion, goal allocation, NFC transition and message-receipt records using the inspected source shapes. Include the same 15/30 cooking durations as a reported estimate, a separately timed observation, an untouched default, and a legacy record with no provenance. Explicit entry alone does not prove measurement. Include an edited taste note beside untouched time fields. Use a checked cash value and a recently fetched but old checkpoint. Do not extract household records.

**Compare:** (A) timestamp/completeness-only interpretation; (B) proposed evidence basis + coverage + purpose. Labels are established from the fixture setup, not guessed by a model.

**Pass:** B never claims a default/legacy-unknown value is measured, never treats goal progress as reserved money, never treats a read receipt as understanding, and preserves useful explicit feedback independently of unsupported time fields. Every output names the fields whose uncertainty matters.

**Disprove/simplify:** if field provenance adds no decision difference in the selected first capability, omit unused fields from that adapter. Do not backfill an invented history distinction or redesign every form. If a required distinction cannot be captured without material capture friction, choose a capability that does not depend on it.

**Cost / owner:** small offline fixture study; Kitchen/Schedule/ERA. Source witnesses: [cooking feedback](<../../../../../src/components/web/RecipeCookingMode.tsx>), lines 524–551; [task completion](<../../../../../src/components/items/ItemDetailModal.tsx>), lines 353–380; [goal allocation](<../../../../../src/app/api/future-purchases/[id]/allocate/route.ts>), lines 57–104; [message GET](<../../../../../src/app/api/hub/messages/route.ts>), lines 414–449.

## X2. Can three decisions share a small contract without a platform?

**Hypothesis:** commitment review, a conditional preparation conflict and competing optional claims can use one assessment envelope while leaving domain calculations with their owners.

**Setup:** a pure fixture set with three anchors and pairwise failure variants:

| Case | Critical variants | Expected invariant |
|---|---|---|
| Payment review | Confirmed covered, candidate match, two commitments claiming one transaction, transaction deleted, different currency | Preserve meaning; no automatic paid/unpaid assertion from match score; deletion invalidates. |
| Meal/time preparation | Fixed event, accepted mealtime, estimated duration, passive parallel step, missing travel/mealtime, changed recipe version | Conditional timing only; no invented clock or hands-on time; a recipe change invalidates even without meal-row edit. |
| Competing plans | One checked account before unreflected obligations, two $150 claims; drafts already subtracted; two people doing simultaneous tasks | No double subtraction/reservation; distinguish joint from individual feasibility and person identity. |

**Compare:** three detector-specific result objects versus the proposed shared assessment. Keep calculations separate in both arms. Measure duplicated policy/receipt logic, number of adapter-only special cases, and whether evidence/expiry can be replayed without new domain state.

**Pass:** all critical variants remain truthful; the common contract serves all three with no second recurrence/money engine and no synthetic notification/event database. The same evidence produces the same typed conclusion at the same evaluation time.

**Disprove/simplify:** if the contract becomes a large arbitrary payload or generic workflow language, reduce it to shared evidence plus response/expiry and keep domain-specific support structures. If only one useful producer remains, ship that producer's narrow interface rather than a speculative platform.

**Cost / owner:** medium offline prototype, no live writes. E-04 with Budget/Schedule/Kitchen. Canonical input repairs remain production prerequisites; fixtures must not pretend the current endpoints already provide them.

## X3. Does preparation change a household decision?

**Hypothesis:** one well-timed preparation option is more useful than a list of noteworthy facts.

**Setup:** after source/policy prerequisites and explicit pilot admission, choose **one** O1 commitment-review or O2 meal-preparation case. Start in shadow: record eligible candidate, evidence basis, decision window, proposed response and silence reason; send nothing automatically. Use synthetic cases first, then only owner-provided minimized cases or a separately authorized capture. This study authorizes no production export.

In shadow, compare three outputs for the same bounded episode: current-style summary, the proposed decision/option, and no intervention. Have the owner judge likely usefulness without seeing which method generated it. Shadow review establishes eligibility and judged usefulness, not actual benefit from earlier receipt. Across up to 14 days, review at most one selected episode per day and a small weekly sample of silent/missed episodes; do not introduce daily compulsory feedback.

**Shadow gate:** at least 10 evaluable episodes (extend observation or report insufficient evidence if fewer), zero unsupported/private/consequential-action claims, and at least three judged materially useful before the window closes. No more than one unnecessary interruptive candidate among the first ten. Review burden itself must be acceptable.

**Prospective gate:** only after separate pilot admission, show at most one selected passive preparation response before its decision window, on the existing surface. Seek three distinct episodes where the owner reports that seeing it changed preparation or avoided rework. Only the displayed response can have an observed outcome; retrospective alternatives cannot. This small pilot supports a practical usefulness decision, not a causal comparative or statistical performance claim.

**Disprove:** if the owner already knew/handled almost every situation, or the useful response is consistently too late, change the source/decision window or retire the capability. If a quiet option works as well as push, retain the quiet option. Do not optimize notification opens to rescue a failed benefit hypothesis.

**Cost / owner:** small implementation only after X2; time needed for observation is separate. ERA with the selected domain. Live push still waits for C01/C03, local-time policy, transport recovery and device proof; a passive prototype does not authorize earlier activation.

## X4. Can AI replace bespoke preparation rules?

**Hypothesis:** structured interpretation of explicit steps/notes can discover useful preparation relationships that simple keyword rules miss, with less rule maintenance. This is not a claim about current model superiority.

**Setup:** 24 varied synthetic or explicitly provided, minimized cases: clear dependency, ambiguous dependency, irrelevant note, conflicting timing, stale version, private input withheld, invented-entity temptation and ordinary text containing hostile instructions. Include Lebanese household wording where supplied; do not invent the users' habits. Mix domains only when every reference is permitted for the tested recipient.

**Compare:** (A) deterministic baseline using explicit step fields and existing types; (B) one structured model proposal over the same bounded evidence. Before seeing outputs, freeze a 12-development/12-held-out split and the rubric: warranted references, correct abstention, feasible option, useful lead time and owner-rated incremental value. Use the current provider wrapper/configuration approved for evaluation and record actual usage/model. No tool execution, live action or raw household chat. D3/E-07 gates still apply to a live consumer; schema-constrained output is a feasible mechanism, not factual validation. [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

**Pass:** zero invented authorized entities, dates, money, permissions or automatic actions; invalid/ambiguous relations remain assumptions. On at least six held-out cases, owner-reviewed candidate relationships or questions add material preparation value beyond A. Typed verifiable claims must pass independent domain predicates. A second run must not turn abstentions into asserted facts merely through wording variation. Record cost, latency and correction burden.

**Disprove:** if benefits are mostly nicer wording, or the model needs frequent factual correction, keep deterministic preparation and drop this consumer. If two simple rules capture nearly all of B's gain, prefer those rules. If gains require unrecorded facts, test X5 before adding more model calls or collecting a full personal profile.

**Cost / owner:** medium evaluation, bounded call budget to be set at admission; ERA plus source-domain reviewer. No model calls made here. Do not claim a live quota guarantee from current estimated telemetry.

## X5. Is the question worth asking?

**Hypothesis:** a single pivotal observation can enable more useful proactivity than a broad stale-data warning or passive abstention.

**Setup:** 12 synthetic decisions, half with an unknown whose possible answers change the best available response and half where they do not. Include balance checkpoint, intended mealtime and explicit departure time. Compare no question, a generic completeness warning, and one question tied to a decision.

**Pass:** ask only in the pivotal half and only while an answer remains useful; answers narrow the decision without becoming broader claims. In owner review, the targeted question earns its attention cost in most selected pivotal cases. The system can accept “not now” without repeating the question on refresh/restart.

**Disprove:** if answering costs more than taking the direct action, use the existing tool door. If no plausible answer changes the response, remove the question. If household review rejects the whole question class, suppress it rather than lowering a confidence threshold to produce more prompts.

**Cost / owner:** small offline comparison attached to X3; no separate feature backlog.

## X6. Can silence survive retries, changes and privacy revocation?

**Hypothesis:** one stable situation identity plus the existing notification receipt can support cross-day quiet behavior and recovery without a new event platform.

**Setup:** replay these synthetic traces through the future pure policy/receipt adapters. Use controlled test doubles for failures; later isolated integration/device tests must prove the actual boundaries separately.

| Trace | Required result |
|---|---|
| Same situation, refresh, restart, next briefing date | No renewed interruption solely because of recomputation/date/wording. |
| Detector version changes but conclusion/options do not | Reevaluate for correctness; no automatic resurfacing. |
| Notification row committed; first push fails | Same logical recipient notification remains recoverable inside its useful window. |
| Send accepted; process dies before result persisted | Unknown transport outcome; same identity, bounded retry/dedupe, zero domain action replay. |
| Suppression source fails while due-date source succeeds | Withhold interruption; never null → unsuppressed. |
| Partner resolves a shared occurrence offline | Do not infer blame; reconcile after commit/sync; cancel obsolete proposal. |
| Source advanced, recipient insert failed | Delivery failure retained independently; no replay of recurrence advancement. |
| Recipe revised or transaction deleted | Invalidate dependent proposal; require fresh preconditions at confirmation. |
| Household unlinked/private source revoked | Withhold new delivery after revalidation, retract on next connected validation, withhold sensitive cached suggestions when current scope is unknown; no promise to recall already displayed/offline content. Confirmation refused if unauthorized. |
| Read/returned, dismissed, snoozed, domain completed | Four distinct meanings; only the applicable policy or resolution predicate changes. |
| Snooze extends beyond useful window | Expire rather than send a stale copy later. |

**Pass:** every invariant holds after restart and concurrent evaluation; no false factual-success/exposure claim. Device duplicate behavior, auth and DB atomic claim require real isolated/owner evidence before production; mocks are insufficient.

**Disprove/simplify:** if receipts cannot express cross-day per-situation acknowledgement coherently, document the exact failing case before considering a narrow state table. If no valuable behavior needs never-surfaced persistence, do not store silent candidates. Do not turn `notifications` into hidden events.

**Cost / owner:** medium failure study plus separately scoped E-05 implementation/device proof. Existing witnesses: [chat cron](<../../../../../src/app/api/cron/chat-notifications/route.ts>), lines 231–244; [item cron](<../../../../../src/app/api/cron/item-reminders/route.ts>), lines 258–275 and 390–395.

## X7. Does explicit preference beat inferred habit?

**Hypothesis:** explicit feedback and current day intent improve quiet ranking more reliably than sparse behavior counts.

**Setup:** paired recipe/routine cases: explicit `would_make_again=false` versus high cooking count; current `rest` versus three past Sunday completions; later positive correction versus an older negative; one person's preference versus the other's. Keep recipes and schedule options accessible.

**Pass:** explicit scoped preference changes ranking without creating permanent bans, guilt or extra pushes; current day intent beats weak inferred habit. Feedback provenance and version/person are preserved. No recommendation is called “personalized” merely because a count was used.

**Disprove:** if old preferences regularly contradict current choices, shorten relevance or request correction only in a real decision; do not train a more complex ranker first. If no owner-visible benefit exists, stop at retrieving the feedback when asked.

**Cost / owner:** small finite-candidate experiment; Kitchen/Schedule/ERA. Existing feedback is already recorded, so do not add required logging fields just to run this comparison.

## Decision record after each experiment

Record the case set, tested source/version, expected invariant, actual output, corrections, missed cases, scope, unavailable inputs, cost/latency and owner benefit judgment. Distinguish synthetic pass, isolated integration pass, observed device delivery and household benefit. Preserve failed examples as regression fixtures if implementation is admitted; do not equate “a report exists” with experiment success.

Possible dispositions are **admit a bounded existing-plan refinement**, **narrow and repeat**, **retain as quiet-only**, **insufficient evidence**, or **reject**. No automatic phase promotion. Current canonical lanes retain ownership; the study creates neither dates nor new capacity. The owner need not approve this research before reading a concrete result—the six documents are that result—but future execution remains subject to its actual domain and owner gates.

## This session's verification receipt

Completed deliverable checks on 2026-09-06: all six required Markdown files present; UTF-8/LF, frontmatter, balanced fences, heading spacing and no study checkboxes/trailing whitespace; 115 study links plus 12 newly added PM links resolve. Independent domain reviews corrected recipe/version identity, default-versus-measured evidence, financial baselines, per-situation receipt requirements, offline revocation claims and shadow-versus-prospective evaluation. `pnpm docs:check` passed. `pnpm pm:lint` passed with zero errors and the existing Native App empty-Next warning. `git diff --check` passed. Seven existing PM documents received additive study/navigation or Pain Inventory changes; their shipped histories/locked decisions are unchanged. Application, migration and checklist files are unchanged, and the user's original brief is preserved.

Application typecheck, runtime tests, mobile screenshots, live RLS, deployment, model inference and the seven experiments are **not run/not applicable to a documentation-only delivery**. Their absence is not a product pass. No application maturity or shipped feature is claimed.
