---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Proactive ERA — Opportunity Portfolio

The strongest opportunities help **before a useful option disappears**. Several are quiet preparation or ranking changes. Their common prerequisite is evidence appropriate to the claim, not an all-knowing household model.

This portfolio is discovery, **not a queue**. No new checklist items or implementation dates are assigned. The [Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>) remains the execution contract. Source cutoff `83e44be`, inspected 2026-09-06; production population, deployment and benefit remain unverified. “Small/medium” below estimates a bounded proof's relative effort; it is not an end-to-end implementation estimate or an additional 2–4-hour packet allocation. Owning safety/DB/delivery work is extra.

The [knowledge graph](<Proactive ERA — Signal & Knowledge Graph.md>) establishes the facts; [architecture](<Proactive ERA — Architectural Leverage.md>) defines the shared mechanism; [experiments](<Proactive ERA — Experiments.md>) determines admission. Capability IDs O1–O9 are study references only, not PM IDs.

## O1. Prepare a commitment review before a duplicate payment

**Notice:** a recurring commitment's relevant period is approaching review/closure, while a logged transaction plausibly covers it. Help is more valuable before another payment is recorded than after a duplicate exists.

**Evidence:** `getRecurringCommitmentStatus` and matching reasons in [commitments.ts](../../../src/features/recurring/commitments.ts), lines 162–342. The [recurring page](../../../src/app/recurring/page.tsx), lines 290–311, independently matches payments; [mark-covered](../../../src/app/api/recurring-payments/[id]/mark-covered/route.ts), lines 89–116, advances dates without persisting the selected match relation.

**Mechanism:** deterministic candidate match and period math. Preserve confirmed-covered, candidate-match, monitor-only and uncovered states. Before presenting, check that another commitment is not claiming the same transaction and that currency/account semantics agree. A high match score is a reason to review, not permission to mark paid.

**Intervention:** prepare one review card or owning-module door at the useful period boundary. Confirmation uses the owner's existing covered/payment path; no new transaction is proposed merely because the due date is near. If coverage is already confirmed, remain silent. A match deletion/edit reopens the assessment.

**Freshness/confidence:** current transaction and commitment state, exact period, scope and units; required failure or ambiguous competing match means abstain or ask. No unsupported “unpaid” accusation.

**Owners / missing prerequisite:** Budget + ERA + Notifications. Canonical money facts, durable coverage provenance and conflict-aware matching. This extends E-04/E-20 subject to Budget contracts; it does not replace the payment engine.

**Leverage / effort:** high / small-to-medium proof. Especially strong as the first deterministic case because the existing helper already exposes reasons rather than only a score.

## O2. Protect a meal preparation window

**Notice:** an intended meal, its preparation dependencies and a known event are compatible only if preparation happens earlier or the meal changes. A reminder at dinner time is too late.

**Evidence:** recipe step duration/prerequisite/parallel fields in [recipe types](../../../src/types/recipe.ts), lines 18–25; meal-plan recipe timings in [meal-plan route](../../../src/app/api/meal-plans/route.ts), lines 43–51; planned coverage in [meal hooks](../../../src/features/meal-planning/hooks.ts), lines 21–33; recorded events and estimates in `schema.sql:552–568`. Explicit substitutions/taste notes are available in [cooking logs](../../../src/app/api/recipes/[id]/cooking-log/route.ts), lines 79–92.

**Mechanism:** interval arithmetic over the canonical schedule, accepted mealtime and qualified duration. AI can interpret step relationships or propose a few existing alternatives. Validate dependency references/cycles and distinguish hands-on effort from passive cooking. Recipe estimates remain estimates; prefilled cooking “actuals” cannot calibrate them.

**Intervention:** silently prepare a feasible earlier step or alternative recipe; show one option at the next relevant glance. If the only blocker is when dinner is intended and knowing it would change the option, ask once. A date-only meal does not justify a precise last-start alert.

**Freshness/confidence:** fresh event/meal versions, correct person, known clock target, declared time basis. Unrelated unavailable data need not suppress a proven time conflict. Missing allergy information blocks an allergy-dependent suitability claim; no food-safety assurance.

**Owners / missing prerequisite:** Kitchen + Schedule + ERA; canonical planned coverage/occurrences and a small preparation relation. Pantry consumption automation and Trips activation are not prerequisites for this claim.

**Leverage / effort:** very high / medium proof. Strong first cross-module experiment; it tests whether foresight gives useful time back.

## O3. Consolidate departure preparation into one decision

**Notice:** a recorded trip overlaps planned meals/routines, while an existing shopping occasion and incomplete assigned packing offer a chance to prepare together. One decision can remove several later chores.

**Evidence:** [trip phase](../../../src/features/trips/tripPhase.ts), lines 13–31, is date-derived independently of activation. Packing/places/documents are recorded in `schema.sql:1557–1596,1804–1815`. The existing [trip overview](../../../src/components/trips/overview/OverviewTab.tsx), lines 51–65, 98–100 and 157–163, already derives preparation summaries. Meal plans and Schedule supply the other qualified inputs.

**Mechanism:** deterministic overlap and real optional inventory/catalogue links; AI may interpret which already-recorded essentials belong with a shopping occasion. Cluster by the decision/action that resolves the concerns, not by module. No inferred shop hours, commute, passport law or physical departure.

**Intervention:** prepare one review bundle: meals to retain/change, packing assignments to review, relevant existing shopping entries. A short question such as “Still cooking Thursday?” is justified only if its answer changes several pending preparations. Each resulting domain change still requires its own safe confirmed action; a review bundle is not an atomic multi-module mutation.

**Freshness/confidence:** exact trip sharing scope, planned dates/person, current packing and shopping state. Missing trip time limits the result to day-level preparation. A missing document row means “not recorded,” not “you lack a passport.”

**Owners / missing prerequisite:** Trips + Kitchen + Schedule + Hub/ERA. Accurate read projections and action/backlink identity. Existing lifecycle verification and owner reversal decisions remain required before invoking activation; a read-only preparation can precede activation.

**Leverage / effort:** high / medium proof; action implementation spans multiple owners and should remain separate.

## O4. Expose competing claims on the same money or time

**Notice:** multiple plans are each plausible alone but incompatible together. Independent feature forecasts conceal the conflict until a purchase or booking consumes the resource.

**Evidence:** goal allocation is progress-only ([allocate route](../../../src/app/api/future-purchases/[id]/allocate/route.ts), lines 57–104); [goal analysis](../../../src/app/api/future-purchases/[id]/analysis/route.ts), lines 28–81 and 149–215, evaluates a single goal from reduced history. Schedule supplies responsible person, event intervals and task estimates (`schema.sql:521–568`).

**Mechanism:** deterministic check of a bounded candidate set against one identified resource; no global optimizer. Preserve claim kinds and mutually exclusive alternatives. The same money cannot be counted twice, and simultaneous work by two people is not necessarily a collision. The synthetic $500/$300/two-$150 and one-hour/two-45-minute witnesses are in Architectural Leverage.

**Intervention:** prepare the tradeoff or ask the pivotal funding/priority question. Never say “safe to spend” from unscoped/mixed-currency/incomplete data. An owner's explicit priority decides between goals; AI may explain a valid alternative but cannot invent utility weights.

**Freshness/confidence:** actual cash checkpoint plus distinct obligations in the same units, or qualified time estimates and current agenda. Unknown funding blocks a joint affordability claim. A plan is not a posted effect.

**Owners / missing prerequisite:** Budget + Schedule + ERA. Typed resource/claim identity and canonical facts; applicable money atomicity before execution.

**Leverage / effort:** very high / medium proof, potentially large implementation if broadened. Keep the experiment to one account or one person's known interval.

## O5. Ask for one observation that changes an imminent decision

**Notice:** a useful choice is approaching, but one fact—balance checkpoint, mealtime, actual stock count or departure time—can reverse the recommendation. Generic stale-data warnings would waste attention; this question earns its cost by changing the decision.

**Evidence:** balance checkpoint versus update time (`schema.sql:158–165`), inventory runout/count history (`:1030–1061`), date-only trips (`:1534–1555`), and the prefilled duration path in [RecipeCookingMode](../../../src/components/web/RecipeCookingMode.tsx), lines 524–551.

**Mechanism:** evaluate plausible branches with the unknown unresolved. Ask only if different answers lead to different useful actions and the answer can arrive before the window closes. AI may propose the question; deterministic evaluation establishes why it matters. No entropy-maximizing interrogation or general data-completion campaign.

**Intervention:** one timely question, or silently open the existing verification affordance in prepared context. Persist the answer's subject, basis and validity using the eventual owner contract. “Not now” suppresses repeated questioning for that situation/window, without marking the fact known.

**Freshness/confidence:** distinguish a refetch from an observation; a person-confirmed estimate remains an estimate. If every plausible answer leads to the same action, do not ask.

**Owners / missing prerequisite:** ERA plus the source domain. Assessment branches and a bounded receipt; no new mandatory capture fields.

**Leverage / effort:** high / small proof. This may improve foresight more than collecting another module's entire history.

## O6. Quietly honor explicit recipe feedback

**Notice:** when preparing meal suggestions, a person has explicitly said they would not make a recipe again. Recommending it again wastes time and makes ERA seem unaware of supplied feedback.

**Evidence:** `would_make_again` starts null ([RecipeCookingMode](../../../src/components/web/RecipeCookingMode.tsx), line 536), is set by explicit buttons (1657–1675), saved in [cooking-log](../../../src/app/api/recipes/[id]/cooking-log/route.ts), line 91, and displayed in [RecipeDetailView](../../../src/components/web/RecipeDetailView.tsx), lines 427–428. Source search found no ranking consumer; Optimize uses other log details.

**Mechanism:** deterministic soft demotion for that person and recipe/version, with recency and explicit later correction respected. Retrieve a relevant substitution/taste note when it helps an already-selected recipe. Do not infer permanent dislike, an allergy, or the partner's preference.

**Intervention:** ranking/prepared context only. No notification, no diet coaching, no compulsory feedback request. The recipe remains accessible.

**Freshness/confidence:** explicit yes/no has stronger basis than defaulted time/difficulty or a recipe count. Confirm cook/recipe/version association and availability of records; absent feedback leaves ranking unchanged.

**Owners / missing prerequisite:** Kitchen + ERA. A finite candidate list and a correctly scoped feedback projection; no model call or pantry closure.

**Leverage / effort:** high relative to effort / small proof. A useful demonstration that proactivity can mean less repeated friction, not more messages.

## O7. Prepare private health-date logistics before travel

**Notice:** an explicitly recorded vaccine `next_due_on` falls near an owner-visible trip. Opening the relevant record/provider earlier may preserve booking options. Other follow-ups require an explicit Schedule item; a past doctor visit does not supply a follow-up due date.

**Evidence:** Healthcare profiles/vaccines/provider fields (`schema.sql:1654–1718`), the scoped [health bundle route](../../../src/app/api/healthcare/route.ts), lines 20–26, and permitted Trips/Schedule facts. The [minimal allergen route](../../../src/app/api/healthcare/allergens/route.ts) demonstrates purpose-specific projection, not permission to disclose all health records.

**Mechanism:** compare recorded dates. This is logistics on the user's stored record, **not a medical recommendation**. No AI determines treatment, next dose, travel suitability or required vaccinations. Medication supply reasoning is excluded because its observation path is not shipped.

**Intervention:** private prepared context or an existing record door; a booking question only when useful and permitted. The shared trip card must not reveal a private medical cause, including indirectly through a recommendation.

**Freshness/confidence:** recorded due date, source authority/basis, current record and explicit profile-sharing rules. Missing/incomplete data produces no clinical all-clear. Current deployed privacy remains an owner verification gate.

**Owners / missing prerequisite:** Healthcare + Trips + Schedule + ERA. Scoped, availability-bearing projection; dates cannot be promoted into clinical correctness.

**Leverage / effort:** medium / small-to-medium logistics proof after privacy contracts. No clinical engine admitted.

## O8. Propose occasion packing from the personal wardrobe

**Notice:** a recorded trip occasion and existing garments could yield a compact set of candidate outfits, reducing preparation work before packing is complete.

**Evidence:** garment tags/compositions (`schema.sql:1730–1778`), strictly personal [outfit items route](../../../src/app/api/outfits/items/route.ts), lines 2 and 48–51; trip places/packing quantity and assignee fields (`:1557–1596`).

**Mechanism:** AI may interpret the recorded occasion and rank a finite list of owned garments; deterministic validation enforces garment IDs and person scope. Duplicate garment packing can be checked only after an explicit garment-to-packing mapping/proposal reference exists; the current packing schema has inventory/catalogue links, not garment IDs. Only explicit occasion constraints are firm. The model cannot infer cleanliness, location, fit safety or recent wear.

**Intervention:** private proposal. Adding a garment to a shared packing list requires an intentional, supported sharing/action path; private body/fit notes never accompany it by default.

**Freshness/confidence:** personal wardrobe availability is unknown until checked. No claim that wear/planner history exists. Offline writes remain outside Outfits v1's owner contract.

**Owners / missing prerequisite:** Outfits + Trips + ERA; atomic outfit composition, entity mapping and a permission-preserving proposal path.

**Leverage / effort:** medium / medium proof; defer behind stronger daily situations.

## O9. Reduce repeated routine friction

**Notice:** the same flexible occurrence is repeatedly postponed, while the current day has an explicit rest/balanced/productive intention. Another identical reminder is unlikely to help; a different placement or smaller commitment may.

**Evidence:** occurrence action identity/reasons (`schema.sql:678–690`), flexible placements (`:1304–1315`), and [day-plan intent](../../../src/features/day-plan/types.ts), lines 1–25. Historical suggestion code exists but is not a trustworthy active optimizer: [suggest-schedule](../../../src/app/api/suggest-schedule/route.ts), lines 124–167 and 247–252, ignores time in its date-set avoidance and labels three completions high confidence.

**Mechanism:** deterministic repeat detection over the same occurrence/period, then one feasible option consistent with current intent. AI can interpret an explicit postponement reason. Never label skips as failure or infer energy/motivation from sparse logs; prefills and selected completion histories invalidate naive duration learning.

**Intervention:** next-glance option, with “leave it”/dismissal respected for the current window. No autonomous reschedule, productivity score, guilt language or pressure to fill a rest day.

**Freshness/confidence:** correct canonical occurrences and placements; distinguish planned occurrence from actual action time. A missing reason is unknown. Explicit current preference outranks a historical tendency.

**Owners / missing prerequisite:** Schedule + Plan My Day + ERA. Canonical adapter and authoritative reschedule outcome; experiment before any learning model.

**Leverage / effort:** medium-high / small-to-medium proof. Benefit is reduced routine friction, not higher completion counts.

## Deliberate exclusions

| Attractive idea | Why reject or defer it |
|---|---|
| A model continuously monitors all household chat and invents tasks | Reading is not permission to turn private conversation into shared obligations; current GETs may write receipts. Prefer explicit capture and purpose-limited retrieval. |
| Auto-buy, auto-pay, auto-activate Trips, or auto-reschedule a whole day | Consequential composite effects exceed existing safe confirmation/atomicity contracts and owner decisions. |
| Fully automatic pantry consumption / food-expiry assurance | Ingredient identity, units, physical observations and lot safety are absent. Existing automatic-shopping intent remains held under its own contracts. |
| “Safe to spend” from the current goal confidence score | Reduced history, unknown funding and multiple competing claims cannot support it. |
| “Debt overdue” or predicted debt income | Inspected debts lack due-date promises and stable identity/currency in all cases; archived is not settled. No contacting debtors. |
| Wear repetition, laundry readiness or medication depletion | Required observation paths are missing or only planned. A richer model cannot recover unrecorded physical state. |
| Push every detected anomaly / complete daily life summaries | Anomaly is not actionability; current counts can be stale or incomplete. Added noise can reduce trust in valuable interventions. |
| Engineering-health assistant inside the household briefing | PM/Delivery evidence has a different purpose and existing tooling freeze. It does not advance this household mission. |

## What deserves proof first

Test O1 for deterministic commitment meaning, O2 for cross-domain timing, and O6 for low-noise reuse of explicit feedback. Use O4 as an adversarial accounting witness inside the shared-contract experiment, not a full purchase optimizer. O5 is a policy behavior within those experiments, not another feature project. O3/O7/O8/O9 expand only when the same contract demonstrably carries them and the owner admits the work.

This is a proposed proof order, not a change to current lanes or capacity. The study's leverage comes from showing that a few reusable distinctions support several valuable outcomes—and identifying where evidence remains too weak to act.
