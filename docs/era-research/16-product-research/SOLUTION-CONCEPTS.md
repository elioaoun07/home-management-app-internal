# ERA solution concepts

Verified **2026-11-06**. Repository anchor: `9cd4166691edd9367ea1bd9a604e0bec13ffe870`. **Everything in this document is PROPOSED DESIGN unless explicitly labeled otherwise.** Examples are invented acceptance journeys, not reports of household behavior. These are solution concepts, not approved implementation plans or a competing PM queue.

[ERA-FIT-ANALYSIS](ERA-FIT-ANALYSIS.md) contains the implementation evidence and documented intent. [PRODUCT-PATTERNS](PRODUCT-PATTERNS.md) contains the external inspiration; vendor workflows were not tested hands-on.

## Selection and shared constraints

| Concept | Benefit hypothesis | Main uncertainty / maintenance cost | Initial scope |
| --- | --- | --- | --- |
| C1 Resume an interrupted request | Avoid retyping and duplicate actions. | Durable execution rollout and separate draft/receipt states. | One existing request and its source status. |
| C2 Reset the rest of today | Reduce the cost of replanning a disrupted day. | Duration data, recurrence scope, unseen calendars. | Triage a few ERA commitments; no autonomous scheduler. |
| C3 Review a budget tradeoff | Turn a shortfall into an understandable decision. | Period/currency consistency and atomic allocation changes. | Read-only alternatives before any write capability. |
| C4 Fill meal gaps and review the shopping delta | Reuse meals, leftovers, ingredients and list facts. | Ingredient identity, stock accuracy, partial writes. | A short horizon and reviewed exact matches. |
| C5 Answer with the source and its age | Make remembered answers checkable. | Source permissions and the distinction between facts and statements. | Existing memories, then bounded owner evidence. |

These are qualitative judgments, not measured impact or effort scores. C1 is the most broadly useful first investigation. C2 and C4 should be compared with the household's actual pain before choosing the next slice. C5 can begin with existing memory records. C3's read-only demonstration is useful early; committing its multi-allocation changes has a higher correctness bar.

Minimum data below is a conceptual contract, not a database schema. **Existing** means the referenced source types/read path provide a foundation, not that every field is exposed to the proposed UX. **New** means a requirement to design and validate if implemented. No SQL or integration setup is part of this task.

All concepts inherit these rules:

- Reuse ERA's composer, precision pages, registry, artifacts, notification taxonomy, and source operations. Add a source adapter only when its semantics and permission boundary are understood; a navigable page is not an executable capability.
- Read-only work never silently changes domain facts. AI proposes; deterministic validation and user review precede domain writes. Every effect needs a source receipt and an available, honest inverse or recovery path.
- An unseen partner record, unavailable read, uncertain write, or expired proposal is not an empty result. Recheck identity, current access, source versions, date anchor and time zone before acting.
- Keep user copy to labels, counts and short clauses. Details and evidence belong behind an information control; this document's explanations are not proposed screen copy.
- Default to in-app results. A review suggestion creates no new push stream. Optional nudges require per-person opt-in, existing preferences, an expiry, an action destination and deduplication. Do not suppress explicitly configured reminders under an unvalidated “attention” heuristic.
- Reuse the existing item occurrence engine and the separate payment engine; never expand recurrence in a new optimizer. Offline preview is labeled stale; committing a stale plan requires fresh validation.

## C1 — Resume an interrupted request

**Problem solved:** Returning from a call, navigation or network loss should not require reconstructing a request or guessing whether an action happened. Relevant patterns: P02/P09, while preserving P01.

**CURRENT IMPLEMENTATION:** [P09](ERA-FIT-ANALYSIS.md#p09--explicit-recovery-and-commit-state) identifies chat history, focus reconstruction, form handoffs, artifact status and the gated execution journal. [P02](ERA-FIT-ANALYSIS.md#p02--reviewed-batch-capture) establishes bounded plans and owner/chat-bound confirmation. These do not establish a universal durable unsent draft.

**DOCUMENTED INTENT:** The Doctrine's capture-cost, exactly-once, offline and trust questions favor keeping intent and acknowledging actual effects.

**Example journey / proposed UX:** The user asks for a reminder and groceries, confirms a small review, then leaves after the reminder succeeds. On return to that conversation, one compact “Continue” row shows one completed effect and the remaining step. “Review” opens the source result and pending changes. It does not resubmit the original request. An unsent sentence uses a separate “Draft” state, never a completed-action badge. No global unfinished-work dashboard is required.

**Minimum required data:**

| Foundation | Data |
| --- | --- |
| Existing | Conversation/owner identity; request text; journal plan/step status when enabled; source artifacts; handoff status; captured reference date/time zone. |
| New | A small resume projection linking existing states without duplicating their authority; owner-scoped unsent-draft persistence if user pain justifies it; explicit expiry and source-version checks. |
| Deliberately unnecessary | All chat history, a second queue, model-generated completion estimates, or a background autonomous worker. |

**AI responsibilities:** Summarize the remaining intent only when useful; never infer success from its earlier prose. Native source receipts determine completion. Changing a request produces a fresh review rather than inheriting consent. No inference call is needed merely to display “1 of 2.”

**Alternatives:** Keep History, artifacts and manual re-entry as the fallback. A local owner-scoped draft alone is a smaller answer if typing loss is the real problem. Extending the journal to every action before validating the return UX is too large. A new “agent inbox” would duplicate existing conversation and artifact surfaces.

**Dependencies:** Prove whether durable execution is enabled/applied; use `RunState` rather than inventing another executor; verify source-specific retry/reversal support. Preserve the distinction between unsent input, staged proposal, queue entry, journal and domain artifact. Storage must clear on identity changes and avoid leaking one person's draft to another.

**Failure and interruption behavior:** If status is uncertain, show “Check” linked to the source, not “Retry all.” If the journal is off, do not promise cross-device recovery. If local storage is unavailable, capture still works but has no crash-survival claim. Resume across a time-zone/date change requires restatement or renewed date review. A partial write is not silently rolled back with a guessed inverse.

**Acceptance scenarios:**

1. Given one acknowledged and one pending step, reopening the chat shows the completed source artifact and executes only the remaining step after fresh checks.
2. Given transport loss after a write, reopening cannot issue the write again solely because no response reached the client.
3. Given New chat or a different owner, an older proposal cannot execute or expose the prior owner's draft.
4. Given an expired form handoff, the user can inspect the source/draft and restart with visible fields; it never creates a second transaction automatically.
5. Given only an unsent sentence and a process restart, restoration occurs only if the chosen storage supports it; submitting it once yields one source intent and a visible receipt or uncertain state.

**UNKNOWN / validation before implementation:** Which kind of interruption actually hurts, which journeys already restore adequately, and whether journal rollout supports this first slice. Stop expanding when a simple owner-scoped draft solves the reported problem.

## C2 — Reset the rest of today

**Problem solved:** A disrupted afternoon creates many small replanning decisions. ERA can help choose what to keep or defer without pretending it knows every calendar or optimizing an invented energy score. Patterns P03/P04, constrained by P07/P10.

**CURRENT IMPLEMENTATION:** [P03/P04](ERA-FIT-ANALYSIS.md#p03--deliberate-daily-triage-and-carryover) identify a triage-first day planner, shared occurrence expansion, flexible placements and narrower assistant rescheduling. Google backup does not provide incoming busy time.

**DOCUMENTED INTENT:** Plan My Day explicitly defers an hourly optimizer and favors a save-gated triage list. The proposal extends that intention.

**Example journey / proposed UX:** At 15:00, the user says “I lost the afternoon; keep dinner and move the errands.” ERA opens a short review for the remaining day: “Keep,” “Move,” “Unscheduled.” Each proposed change names its owner, original occurrence and destination. A compact calendar strip supplies context; details explain a conflict or missing duration. Fixed/shared appointments are protected unless the owner explicitly selects a legal edit. “Apply” is available only for supported, currently validated changes; everything else opens the precision planner.

**Minimum required data:**

| Foundation | Data |
| --- | --- |
| Existing | Selected local date; actual item/occurrence IDs; completion/postponement actions; flexible period/slot identity; event start/end when available; day-plan intent/checklist and visibility. |
| New | User-selected protected commitments; proposed move reason; current source versions; optional duration estimates and their provenance. |
| Optional later | Permissioned incoming busy intervals, only after a separate source/ownership decision. First scope labels that coverage unknown. |

**AI responsibilities:** Interpret intent and propose a small set of choices. Deterministic code determines occurrence eligibility, overlaps, flexible-period membership and permission. AI must not equate a due date with a duration, silently alter recurrence, cancel a partner's commitment, or declare a guaranteed free slot based only on ERA data. Without duration evidence, offer ordering/deferral rather than a capacity claim.

**Alternatives:** Manual push-off/prepone in the current planner remains available. A deterministic “show remaining items” review may be sufficient. Continuous Reclaim-style scheduling is rejected for the first scope because it adds rule maintenance, outside-calendar dependence and surprise changes.

**Dependencies:** Use `getOccurrencesForDay` and source item/flexible actions. The registered reminder move cannot be stretched to recurring occurrences; unsupported cases hand off until a correct source-owned adapter exists. More than six model steps must not be split into automatically approved runs to bypass the current plan bound. A true multi-change commit needs stable operation identity, per-effect receipts and bounded conflict handling.

**Failure and interruption behavior:** Failed schedule read means unavailable, not an empty afternoon. Concurrent changes invalidate the affected preview. If two of three operations are acknowledged, show exactly those two and the pending/uncertain third. Undo revalidates current source state and must not overwrite a partner's later edit. Offline allows stale triage notes, not automatic replay of an old schedule optimization.

**Acceptance scenarios:**

1. Given a fixed appointment and flexible errands, default proposals move only eligible errands and explain which known commitment constrained them.
2. Given a recurring item, the preview states its occurrence/scope and uses the existing engine or precision handoff; it never edits the whole series accidentally.
3. Given an unseen external calendar, the screen does not claim the person is free; it marks calendar coverage as limited.
4. Given an item moved by the partner after preview, Apply refreshes/reviews the changed item instead of overwriting it.
5. Given no duration estimates, the journey still supports keep/defer/order and does not fabricate a workload total.
6. Given a completed reset, reopening shows the resulting source schedule and remaining choices, without sending a second change alert to the initiating person.

**UNKNOWN / validation before implementation:** Whether the household wants a day-reset prompt at all, duration willingness, private/shared edit rights and incoming calendar needs. Success means the actual disrupted-day journey needs fewer deliberate decisions, not that it produces a fully packed calendar.

## C3 — Review a budget tradeoff

**Problem solved:** A warning or proposed monthly total does not answer “what can give way?” The user needs understandable allocation alternatives while money and budget semantics remain deterministic. Pattern P05.

**CURRENT IMPLEMENTATION:** [P05](ERA-FIT-ANALYSIS.md#p05--explain-a-budget-tradeoff) identifies existing suggestions, fallback and provenance metadata, plus period/currency inconsistencies to investigate. No existing assistant budget-reallocation capability was established.

**DOCUMENTED INTENT:** Manual values prevail; correctness and trust outrank foresight. ERA's custom billing cycle and USD/LBP conventions must remain intact.

**Example journey / proposed UX:** The user opens a category that is 30 USD over its allocation. ERA shows “30 short” and at most two alternatives: reduce an explicitly adjustable category, or leave the allocation and show the projected shortfall. Each option displays before/after allocations and the remaining room in the donor category. “Why” shows the actual period, included records, excluded outliers and estimate assumptions. The first version is read-only with a link to Allocate. “Reallocate” is a later capability, not an assumed existing button.

**Minimum required data:**

| Foundation | Data |
| --- | --- |
| Existing | Category/allocation identity and ownership; transactions and authoritative spend rules; explicit period range; recurring commitments; AI/estimate metadata and excluded-outlier count. |
| New | User-selected protected/flexible categories; an explicit spendable-resource definition; source versions; currency/unit normalization contract and rate provenance when conversion is requested. |
| Not required | Bank aggregation, credit-score data, automatic account transfers, or prediction of every future purchase. |

The 30 USD example stays within one currency and one owner's adjustable allocations. An allocation move does not move cash between accounts. No “safe to spend” promise should be made from an incompletely reconciled balance.

**AI responsibilities:** Explain deterministic alternatives and uncertainty in short language. It may rank options using explicit household priorities, not infer which partner's spending is expendable. AI cannot choose arithmetic, FX rates, income assumptions or protected-category rules. Statistical output is labeled as an estimate; fallback must remain usable when AI is absent.

**Alternatives:** Existing manual allocation editing is the safe baseline. A deterministic shortfall breakdown may deliver most of the value without model generation. A general autonomous financial adviser or automatic transaction correction would increase risk and maintenance without proving a household need.

**Dependencies:** Reconcile custom-month dates across budget reads and assistant context. Define transfer/draft/refund/category treatment from authoritative money rules before calculating; this research does not certify those paths. Audit currency normalization rather than summing unlike units. Any later write is one source-owned, validated batch with stable identity and complete receipts; do not implement it as independent allocation calls with hidden partial success.

**Failure and interruption behavior:** Missing spend data blocks a confident shortfall figure. A stale preview is recalculated before applying. If the donor has insufficient adjustable room, keep a visible unresolved shortfall; do not silently choose another source. Offline can display the last estimate with age, while committing waits for source validation. If a future write is uncertain, inspect its receipt/status instead of replaying both legs. Undo restores only the acknowledged allocation change after conflict checks.

**Acceptance scenarios:**

1. Given 100 allocated and 130 qualifying spend in the selected period, show a 30 shortfall; a 30 reallocation preserves total allocations and changes no account balance.
2. Given a custom billing start day, included transactions and the displayed period agree with the authoritative budget view.
3. Given USD and LBP accounts without a validated conversion contract, do not produce one combined spendable total.
4. Given protected rent and flexible leisure, rent is not offered as a donor by default.
5. Given unavailable AI, the deterministic alternatives and numerical explanation remain available.
6. Given a changed donor allocation or an interrupted commit, no unreviewed overwrite or duplicated reallocation occurs.

**UNKNOWN / validation before implementation:** Desired protected categories, resource ownership, currency/rate conventions, and whether explicit reallocation is wanted. Until those are settled, keep this a sourced read-only decision aid.

## C4 — Fill meal gaps and review the shopping delta

**Problem solved:** The household already has recipes, leftovers and a shopping list, but assembling the next few meals still risks duplicate groceries and redundant meal assignments. Pattern P06 with P07/P09/P10 constraints.

**CURRENT IMPLEMENTATION:** [P06](ERA-FIT-ANALYSIS.md#p06--plan-to-shopping-reuse-with-pantry-hints-and-consolidation) identifies coverage semantics, real recipe ingredient outputs, selected-ingredient transfer and explicit assistant limits on stock subtraction/deduplication.

**DOCUMENTED INTENT:** Weekly shopping generation is an ambition in the Meal Planning overview. It does not justify automatic purchases or a perfect-pantry assumption.

**Example journey / proposed UX:** The user asks “Cover dinners through Thursday.” The review first shows coverage for each person, including existing leftovers. ERA proposes saved recipes only for uncovered dinner slots; unknown preparation time stays unknown. After meal choices, “Shopping” shows additions, already-on-list rows and user-selected “Have it” rows. Each total can expand to show originating recipes. “Save” has separate visible meal/list outcomes if it cannot be one atomic operation. Start with two or three days rather than a new weekly wizard.

**Minimum required data:**

| Foundation | Data |
| --- | --- |
| Existing | Planned dates, meal type/status, person assignment and leftover end date; recipe IDs, ingredients, servings and available preparation times; visible shopping thread/items; inventory records if readable. |
| New | Stable ingredient identity or exact-match rule; compatible quantity/unit contract; per-recipe contribution provenance; target list selection; optional stock confirmation time and proposal/source versions. |
| Not required | Retail prices, live supermarket stock, nutrition databases, automatic pantry depletion, or scraped recipe feeds. |

Slot-specific coverage must call the shared contract with the meal type. Today's whole-day gap response cannot be treated as a complete dinner-gap read.

**AI responsibilities:** Suggest saved recipes using known time/preferences and explain a choice with one short reason. It cannot invent ingredients for a selected saved recipe, silently overwrite an occupied slot, or call an uncertain pantry item sufficient. Incompatible units and unknown quantities stay separate. A model may suggest likely ingredient matches for review; only validated exact/approved mappings participate in arithmetic.

**Alternatives:** Keep the existing per-meal checklist. A deterministic “repeat a familiar meal” suggestion may be enough before personalization. Manual “Have it” choices are preferable to mandatory pantry administration. Reusable menus can be revisited after evidence of repeated household weeks; they are not a prerequisite.

**Dependencies:** Recipe/meal/shopping/inventory source boundaries and current access checks. Safe batch transfer with operation identity and contribution receipts is a prerequisite to repeated-add protection; the present sequential meal-shopping route does not prove it. A weekly workflow must fit source-owned batch semantics rather than exceeding the six-step model bound through automatic chained plans. Stock quality is optional; source provenance is essential for explainability and safe removal.

**Failure and interruption behavior:** A failed meal read shows unavailable coverage. An unreadable list is not empty. Conflicting household meal changes trigger renewed review. A committed meal with uncertain grocery creation stays visible as such; the user never retries the full plan blindly. Undo removes only this operation's acknowledged contributions, preserving unrelated manual rows and later partner edits. No nutrition/allergen safety promise is made from incomplete tags.

**Acceptance scenarios:**

1. Given leftovers for both people through Tuesday, the review does not add duplicate Tuesday dinner merely because the recipe was cooked earlier.
2. Given a meal assigned only to one person, the other person's dinner remains uncovered.
3. Given two selected recipes needing 2 and 3 eggs and a validated compatible-unit match, the proposal shows 5 eggs with both origins. A manual existing row is shown for review, not silently consumed.
4. Given pantry presence without trustworthy quantity/freshness, the row is a hint; the user can include it in shopping.
5. Given grams and “one bunch” for the same ingredient, totals remain separate unless an explicit conversion exists.
6. Given a partial response, reopening exposes acknowledged meal/list effects and pending work; retry/Undo cannot double-add or erase the partner's contribution.
7. Given multiple shopping threads, the destination is visible and changeable; the first thread is not a hidden permanent default.

**UNKNOWN / validation before implementation:** Pantry maintenance reliability, ingredient structure, dinner/other-slot priorities and how often occupied slots should be replaced. Drop automatic stock arithmetic if it creates more work than the grocery review saves.

## C5 — Answer with the source and its age

**Problem solved:** “ERA remembers” is insufficient when a practical answer may be old, ambiguous, private or merely something someone once said. Pattern P08.

**CURRENT IMPLEMENTATION:** [P08](ERA-FIT-ANALYSIS.md#p08--scoped-retrieval-with-evidence-and-age) identifies simple household label recall and a separate owner-scoped adaptive-evidence layer. The simple result currently omits source identity/age, although the API returns record data.

**DOCUMENTED INTENT:** Captured facts should return value without becoming hidden defaults or leaking household/private context.

**Example journey / proposed UX:** The user asks for the car-maintenance contact. ERA returns the saved value with a compact source/age chip and “Open.” Two plausible records produce a short choice, not a confidently selected first match. A scope control distinguishes saved household facts from the user's own conversation evidence. The first slice exposes existing memory ID and update time; later source-backed context can add a bounded evidence summary. No new knowledge portal is needed.

**Minimum required data:**

| Foundation | Data |
| --- | --- |
| Existing | Household memory ID, label/value, creator and timestamps; owner-bound conversational message/source IDs, explicit/observed distinction and coverage receipt. |
| New | A typed answer-evidence projection: source kind/ID, safe destination, current access, evidence timestamp, retrieval scope, and unavailable/ambiguous state; correction provenance only if an update workflow is added. |
| Not required | External connectors, embeddings for every module, unlimited transcript retention, or an automatically inferred household profile. |

A source timestamp is age, not proof the fact remains valid. Shared saved facts and private statements must retain their distinct authorization rules.

**AI responsibilities:** Synthesize only from returned evidence, attach claim-to-source support, and say when evidence conflicts or coverage is limited. Deterministic retrieval/permission checks precede model context assembly. An observation never becomes an explicit preference without review. Answering does not save a new memory or overwrite an existing one.

**Alternatives:** Exact label results with source chips may solve the immediate need without AI. Existing Brain grid remains the fallback. A broad Notion-like external search estate is rejected until local retrieval demonstrates a recurring gap; connector auth, deletion propagation and indexing would create ongoing maintenance.

**Dependencies:** Preserve record identity through `resolveMemoryRecall`; replace “first row means closest” with explicit ambiguity behavior. Reuse adaptive context's source/coverage contract rather than copying its content to a new fact store. Opening evidence must recheck current permissions. A later correction operation requires a real update/source-history boundary; the existing duplicate-label warning is not that boundary.

**Failure and interruption behavior:** No match differs from source unavailable and no household. If permission changes, return unavailable without revealing a private title/snippet. Cached evidence is revalidated on open. Partial evidence can produce a labeled partial answer, not a definitive household fact. Returning to the conversation preserves the answer's evidence links where still allowed; no background rescan or notification is required.

**Acceptance scenarios:**

1. Given one allowed saved fact, the answer links its actual record and timestamp rather than a generic Brain page without identity.
2. Given two plausible labels or conflicting source values, the user sees a choice or conflict with dates; ordering by recency is not represented as semantic certainty.
3. Given an old explicit fact and a recent conversational remark, ERA identifies their evidence types and does not silently replace the fact.
4. Given private partner evidence or revoked access, neither answer nor source chip leaks it.
5. Given an unavailable source, the answer says coverage is unavailable; it does not report that nothing was ever saved.
6. Given an unlinked user, the first slice explains the household-memory boundary and still offers manual input; it does not invent a personal memory store.
7. Given model unavailability, deterministic matches/source links still work.

**UNKNOWN / validation before implementation:** Which retrieval questions recur, the desired shared/private boundary, and whether external documents are actually needed. Begin with source fidelity before semantic breadth.

## Rejected or deferred directions

| Direction | Decision and reason | Ongoing maintenance avoided / reconsideration trigger |
| --- | --- | --- |
| Continuous autonomous household scheduler | Reject for initial scope: surprise moves, unclear duration/permission rules and outside-calendar gaps. | Rule tuning and conflict support; revisit only after C2 shows repeated manual patterns and reliable busy-time inputs. |
| Broad bidirectional calendar integration | Defer: current Google path is deliberately outbound backup. | OAuth/provider changes, sync loops, conflict ownership and duplicate alerts; revisit if incoming busy time is a demonstrated blocker. |
| Automatic budget/account rebalancing | Reject: allocation decisions and cash transfers are different; correctness/consent cost is high. | Financial edge cases and silent effects; reconsider only a bounded, explicitly reviewed source operation. |
| Perfect pantry with automatic consumption and substitutions | Reject as a prerequisite: it imposes daily inventory work and unreliable conversions. | Stock drift, ingredient taxonomy and conversion upkeep; reconsider narrow mappings supported by actual use. |
| Grocery purchasing and live price optimization | Out of scope and low initial fit. | Retail integrations, changing prices, availability and purchase recovery. C4 needs none of them. |
| Nutrition/allergen inference from recipe prose | Defer: incomplete tags and ingredient ambiguity cannot support dependable safety claims. | Nutrition data quality and medical implications; requires a distinct validated data contract and user need. |
| Large third-party knowledge connector bundle | Defer: existing memory/source identity should be trustworthy first. | Permissions, reindexing, deletion propagation, provider changes and quota support. |
| Auto-promote chat observations into permanent defaults | Reject: recent behavior is evidence, not instruction. | Hidden profile drift and correction burden; explicit teaching can use existing lexicon/proposal patterns. |
| A new unified reminder feed plus daily AI summaries | Reject as the default: duplicates alerts and can make the application noisier. | Another scheduler, notification state and recurring inference expense; reuse existing taxonomy/settings when a specific nudge earns its place. |
| Mandatory daily/weekly planning ceremony or gamified compliance | Reject as a dependency: capture should not become an administrative habit. | Ritual upkeep and irrelevant prompts; retain optional manual review. |
| A new PM campaign, competitor monitor or research automation | Reject for this standalone task. | Recurring source checking and a competing backlog; this package is a dated snapshot. |

## Bounded validation proposal

Before implementing any concept, review one real household example and one interruption/failure case. Use synthetic or replay fixtures for development; no paid/live API pass is implied. A concept earns expansion only if its first journey works through ERA's existing source boundaries without extra maintenance obligations.

The acceptance scenarios above are proposed observable outcomes, **not test results**. This task creates documentation only.

