---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# Proactive ERA — Intelligence Model

ERA should protect the household's ability to act before useful options disappear. The unit of intelligence should be a **situation with a decision window**, supported by evidence and connected to an existing household commitment. A notification is one possible response to that situation.

This is the discovery study commissioned by [ASTRA-PROACTIVE-ERA-STUDY](<../../../../../docs/ASTRA-PROACTIVE-ERA-STUDY.md>), read end to end. The [Top Layer Master Plan](<../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>) remains the execution contract; proposed changes to its framing are recorded in the [Contradiction Register](<../ASTRA/ASTRA — Contradiction Register.md>). Nothing here changes an owner decision, schedules a packet, or claims the product has become proactive.

Read [Architectural Leverage](<Proactive ERA — Architectural Leverage.md>) for the technical recommendation; [Signal & Knowledge Graph](<Proactive ERA — Signal & Knowledge Graph.md>) for the evidence inventory; [Opportunity Portfolio](<Proactive ERA — Opportunity Portfolio.md>) for capabilities; [Silence, Trust & Intervention](<Proactive ERA — Silence, Trust & Intervention.md>) for policy; and [Experiments](<Proactive ERA — Experiments.md>) for falsification and admission.

## Evidence boundary

Inspected 2026-09-06 at `83e44be98a96ef836de029b1113cb27100932368`. `git diff --stat 3106164..HEAD -- src migrations` is empty: the preceding ASTRA source cutoff still applies, although this study examines additional branches. The working tree initially contained only the user's untracked study brief. The July 11 Graphify map was used for orientation, never as current source proof. Domain audits followed the Feature Map, vault architecture and campaign Master/ASTRA Books; their contributions were reconciled across Budget/Schedule, Kitchen/Trips/Healthcare/Outfits, and delivery/privacy/offline.

**Source-proven** means a field, branch or contract was inspected. **Derived** means the named computation is possible under stated assumptions. **Proposed** means architecture or behavior that does not exist yet. **Unverified** includes deployment, live policies/functions, actual stored populations, scheduler activity, device delivery and household usefulness. No production data, database connection, provider inference call or live application mutation was used. Current provider documentation was checked only for structured-output feasibility, not model-performance claims.

## What changed the framing

The prior [10x Portfolio](<../ASTRA/ASTRA — 10x Portfolio.md>) correctly prioritizes durable capture, atomic money effects, explicit outcomes and completeness-bearing facts. This study adds a distinction that those contracts do not fully express: **a reliably stored, freshly read value can still be a default or an assumption rather than an observation**.

In [RecipeCookingMode.tsx](<../../../../../src/components/web/RecipeCookingMode.tsx>), lines 524–551 initialize `actual_prep_minutes` and `actual_cook_minutes` from recipe estimates and submit them as actuals. The [optimization route](<../../../../../src/app/api/recipes/[id]/optimize/route.ts>), lines 97–112, then presents them to the model as actual preparation/cooking history. A synthetic recipe with estimates 15/30 produces an “actual 15/30” log when feedback is submitted without editing either number. Step timers do not populate these fields. A dataset built from this path could appear to validate the same estimates that generated it.

Two related distinctions recur elsewhere. [Future-purchase allocation](<../../../../../src/app/api/future-purchases/[id]/allocate/route.ts>), lines 57–104, records goal progress without a linked account transfer; progress is not proof that cash was reserved. [Hub message retrieval](<../../../../../src/app/api/hub/messages/route.ts>), lines 414–449, marks returned unread messages as read; that receipt does not establish visual exposure or understanding. Proactivity amplifies these distinctions because it must decide without a user asking a question that supplies missing context.

The same issue appears outside Kitchen: [ItemDetailModal.tsx](<../../../../../src/components/items/ItemDetailModal.tsx>), lines 353–380, pre-fills actual task minutes from the estimate and excludes chores from that prompt. Duration history is both selected and partly anchored to defaults. The highest-value information ERA lacks may therefore be **why a value is believed**, rather than another value.

## From facts to a useful intervention

A situation answers five questions:

1. What recorded commitment, preference or explicitly chosen objective is at stake?
2. Which permitted evidence supports a concern or opportunity, and which assumptions could change it?
3. What useful action is still possible, and when does that option change or disappear?
4. What has this recipient already been shown or explicitly decided about this same situation?
5. What is the least costly intervention that could improve the outcome?

“Five overdue tasks” is an aggregate. “The two tasks you placed before tonight's event compete for the same available hour” is a situation. “A trip is approaching” is a date fact. “The planned meal and existing shopping task are still scheduled inside the departure window” can justify one preparation review. Both require correct scope and occurrence identity; neither requires a model to calculate dates.

The useful clock is often **latest useful action**, not due time. For a confirmed deadline and justified preparation duration, the latest start can be derived. With uncertain duration, it is a range. With date-only trip/meal records and no clock time, ERA cannot manufacture a departure time or mealtime. It may ask once if the answer changes a real decision. Recipe steps already describe durations and prerequisite/parallel relationships ([recipe types](<../../../../../src/types/recipe.ts>), lines 18–25); these are a starting representation, not proof of a valid execution graph or hands-on duration.

## Knowledge is purpose-dependent

Use two independent dimensions rather than one confidence score:

| Dimension | Examples | Consequence |
|---|---|---|
| Basis of a field | Recorded domain outcome; explicit assertion; untouched default; deterministic derivation; model interpretation | A submitted default must not become an independently measured value. |
| Fitness for this decision | Authorized scope; source available; range covered; recent enough; unit/identity known; relevant assumptions accepted | A valid old fact may be unsuitable for today's decision. A partial feed may still prove one specific conflict. |

An app record can prove that a task was marked completed; it does not prove the physical act occurred. A cooking log can preserve useful taste feedback without establishing pantry consumption. A declared document expiry can justify an expiry check without establishing border-entry eligibility. “Confidence” must describe a particular claim and its support, not the household as a whole.

This also makes silence more precise. Unknown information does not mean all clear. It need not force blanket silence either: two visible fixed events can establish a recorded overlap even when an unrelated source is unavailable. A claim that *nothing conflicts* needs much stronger coverage. A household feed must never certify hidden private state.

## Three jobs for intelligence

**Mechanical evaluation** owns dates, supported occurrence expansion, units, spending classification, authorization, stable identity and preconditions. Reuse existing domain functions. The [recurring commitment evaluator](<../../../../../src/features/recurring/commitments.ts>), especially `getRecurringCommitmentStatus`, already distinguishes coverage and transaction matches instead of treating every due date as unpaid. The two recurrence systems remain separate owners.

**Interpretation** turns permitted free text into candidate relationships: a preparation step, a dependency, an existing recipe alternative, or the question that would separate two plausible plans. Modern AI is most valuable here because the long tail of household meanings is expensive to encode as separate rules. It can propose a small structured plan against evidence references; validators reject invented IDs, invalid dependency cycles and unavailable capabilities. They cannot mechanically prove an arbitrary semantic dependency. Automatic factual interventions require typed claims whose domain predicates can be recomputed; other interpretations remain proposed assumptions requiring confirmation. This is an experimental extension of [eraAskProposal.ts](<../../../../../src/lib/ai/eraAskProposal.ts>), not a second brain.

**Intervention policy** chooses preparation, glance, question, proposal, push or silence. AI must not decide factual truth, private-data disclosure or permission to mutate. Its candidate suggestions cannot bypass deterministic delivery policy. A consequential action stays behind human confirmation and the existing domain boundary, with authoritative outcome and an available inverse where supported.

Google documents schema-constrained extraction and classification. [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). This supports testing the interpretation seam; it does not establish factual truth or prove a particular model can safely plan this household's life. The independent evidence checks are this study's architectural requirement.

## Memory has different jobs

ERA already has several kinds of memory, which should remain distinguishable:

| Existing mechanism | What it remembers | What it does not establish |
|---|---|---|
| `household_memories` route | Explicit household label/value/tags; label search and updates | Typed constraints, evidence provenance, valid-until dates, personal secrecy or truth validation. The table is referenced by source but absent from the inspected schema snapshot; deployment remains unverified. |
| `focusMemory.ts:26–45` | Up to ten recent reminder referents, 30-minute TTL | Durable obligations or a safe reference after restart. |
| `era_templates` / `templates/learn.ts` | How an utterance maps to a capability | Preference for unsolicited interventions or benefit from that capability. |
| `era_actions` / message payloads | Some attempted or reported application actions | Complete domain history or exactly-once success. `resolveIntent.ts:131–133` still drops `ok` on taught actions. |
| Proposed situation receipt | What this recipient was shown/decided for this situation and evidence version | Source truth, permission to act again, or a new conversation store. |

Sources: [memory route](<../../../../../src/app/api/memories/route.ts>), [focus memory](<../../../../../src/features/era/focusMemory.ts>), [learning](<../../../../../src/features/era/templates/learn.ts>), [dispatcher](<../../../../../src/features/era/intents/resolveIntent.ts>), [schema](<../../../../../migrations/schema.sql>), lines 438–450 and 1492–1521.

A stable household memory becomes a planning constraint only after its meaning, subject and scope are explicit. An old free-text “we leave early” is retrieval context, not a clock. D17's planned folding of `features/memories/` need not remove the existing memory capability or create an additional memory service.

## Prior work: retain, extend, challenge

| Prior conclusion | This study's disposition |
|---|---|
| Explicit outcome + replay identity is the highest reliability leverage | Retain. Proactive preparation must never conceal unreliable capture or commitment. |
| Completeness-bearing facts should serve answers, Top View and briefings | Extend with field provenance, coverage, retraction and a situation's decision window. Do not build three calculators. |
| L2 → L3 → L4 is the maturity ladder | Retain as the plan's delivery labels; challenge it as the intelligence model. A silent prepared option may be more useful than a spoken L2 summary. Outcome evidence should govern maturity. |
| Master Plan §1.8 says Chef has nothing to anticipate because Kitchen lacks stock/shopping bridges | Narrow that premise. The Kitchen ASTRA Book already recognizes meal coverage/feedback; this study develops preparation that can precede physical-stock closure. |

Two additional hypotheses were rejected during this study; they are **not attributed to prior ASTRA**. More successful template matches do not imply more useful unsolicited assistance: language recognition, action success and intervention value have separate targets. A universal household graph is not a demonstrated prerequisite: existing relational stores and a small evidence projection can test the valuable joins first.

These are research dispositions, mapped as PE entries in the Contradiction Register. They do not waive D1 scheduler choice, D3 deterministic composition, D5 quiet/cap policy, D6 partner inclusion, D7 capacity, D9 Focus retirement, D11 existing queue, or the current interface decisions.

## ASTRA Frontier Findings

**The most consequential unasked question is whether ERA's history is evidence or recycled defaults.** The cooking path demonstrates a feedback loop that freshness metadata alone cannot repair. Before learning from behavior, preserve the provenance of the fields used as outcomes.

**The highest-leverage proactive move is an evidence-bearing assessment at the already-planned signal seam.** Give a situation identity, warranted claims, invalidators, decision window and possible response. First keep assessments as pure projections; persist only the interaction state needed to avoid repeating yourself. This is smaller than a household digital twin.

**The strongest latent capability is preparation around recorded commitments.** Payment-match states, planned meals, recipe steps, day intent, trip dates and packing assignments already express parts of what must happen before something else. Connect a few of those parts without inventing physical observations.

**The best experimental use of AI is to propose the missing relationship or discriminating question.** Arithmetic, recurrence and “this was already paid” should remain mechanical. A model may interpret why a step must happen early; it should not invent how much time or money is available.

**ERA should stop treating every noteworthy fact as a separate candidate interruption.** Related concerns should compete as one decision, and a resolved or explicitly deferred situation should stay quiet until its relevant evidence or decision window changes. The current system does not yet provide this behavior.

**Reject automatic whole-household optimization.** Unobserved cash, food, effort, clinical state and preferences would become false constraints. Two people's private information cannot be pooled merely because a joint plan would be convenient.

**The largest obstacle is the gap between application state and justified household knowledge, compounded by unproved operations.** Neither a larger model nor more crons closes it. Conversely, requiring every domain to be complete before testing one useful preparation would postpone the product indefinitely.

If designing ERA from this evidence, I would first prove one bounded preparation situation in shadow, then put its deterministic, evidence-qualified result into the existing briefing surface. I would judge success by whether it helped before the decision became expensive, at a low correction and interruption cost. I would expand the same assessment contract only after that result repeats. Reliable capture and existing delivery prerequisites remain necessary; the household should not have to wait for a universal intelligence platform.
