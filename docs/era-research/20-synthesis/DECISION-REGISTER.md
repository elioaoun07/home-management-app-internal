# Decision register

**Status: review proposals only — nothing approved, scheduled or launched.** Baseline and coverage: [README](README.md). This is a cross-reference to existing decisions, not a replacement campaign queue. IDs below are local to `20-synthesis`; qualify IDs from other packs.

A source mismatch can be corrected in documentation without choosing new product policy. A correctness requirement such as “do not claim an unproved write completed” is not an optional policy preference. Deployment evidence is a third category: an owner decision alone cannot prove a migration ran.

## D01 — Next slice and interruption boundary

**OPEN DECISION · Medium · Related finding: F15.**

- **Existing references:** [17 ROADMAP](../17-roadmap/ROADMAP.md), Q1/F1/C1/R1/N1; [10 flows](../10-interaction-design/CAPTURE-AND-RETRIEVAL-FLOWS.md), F1/F5; [12 Blueprint 01](../12-solution-blueprints/BLUEPRINT-01.md).
- **Choice:** a small confirmation-feedback fix; discovery of persisted requests; full operation recovery; or durable unsent/raw capture. They solve different failures.
- **Reviewer recommendation:** Q1 is the best-supported next implementation brief. Consider persisted-work discovery only after relevant flag/migration evidence and an actual interruption need. Do not make Home redesign, a new raw-note store or a universal journal prerequisites for Q1.
- **Evidence to resolve:** owner identifies which interruption causes reconstruction; inspect actual persisted states and current callers. No usage frequency was measured here.
- **Completion of a future decision:** name exactly which states survive and on which device, whether any source mutation occurs, and which acceptance fixtures apply. See the bounded [Q1 brief](READ-FIRST.md#best-supported-next-implementation-brief).

## D02 — Source outcome proof and safe inverse

**OPEN implementation choice · High · F01–F03.**

- **Existing references:** [06 lifecycle](../06-action-execution/ACTION-LIFECYCLE.md), XD2–XD6; [12 README](../12-solution-blueprints/README.md), shared contracts; [19 Q01](../19-business-rules/OPEN-DECISIONS.md).
- **Required invariant:** uncertainty cannot become permission to retry through a content match, empty read or incomplete transfer row. A stale inverse cannot operate on someone else's later change.
- **Choice:** keep a source inspect-only; add atomic effect/receipt transactions; or provide a source-specific status/recovery protocol with verified boundaries. Extending a generic journal alone cannot supply missing source atomicity.
- **Recommendation:** enable stronger recovery only for the individual source whose authenticated, payload-bound operation identity and inverse preconditions are proven. Transfer replay and recurring cover are not blanket precedents.
- **Evidence to resolve:** source fault matrix, late request/concurrent dispatch fixtures, two money legs, revision conflicts, and deployed schema evidence if a future implementation needs it. Owner-applied migrations remain deliverables, not agent actions.

## D03 — Forget retention and recovery

**OPEN DECISION · High · F06.**

- **Existing references:** [04 CE19–CE21](../04-memory-context/CORRECTION-AND-EXPIRY-RULES.md); [04 context assembly](../04-memory-context/CONTEXT-ASSEMBLY.md), CA16; [07 trace specification](../07-ai-quality/TRACE-SPEC.md).
- **Choice:** which content must be redacted across conversations, kept preferences, model logs and execution journals; which minimal non-content receipts must remain for safe recovery/accounting; treatment of exported reports and inaccessible copies.
- **Recommendation:** separate content retention from operation identity. Document pending versus completed deletion and the precise scope of any Undo/cancel window. Do not promise reversal of already committed redaction.
- **Evidence to resolve:** field-level copy inventory and dependencies, durable pending-request behavior, multi-device invalidation, and a truthful external-copy limitation. The in-app design cannot erase Git history by declaration.

## D04 — Private money and source-specific sharing

**OPEN DECISION · High · F04.**

- **Existing reference:** [19 Q02 / S05](../19-business-rules/OPEN-DECISIONS.md), with [08 source-of-truth matrix](../08-shared-data/SOURCE-OF-TRUTH-MATRIX.md).
- **Choice:** account visibility, transaction visibility, top-level category, amount and aggregate inclusion for each viewer. Picker visibility is not the same as read authorization.
- **Recommendation:** first correct the description of current source behavior. Then fill the existing visibility matrix; do not infer the desired rule from a misleading comment or from a model's privacy disclaimer. Assignment/audience does not create universal edit permission across modules.
- **Evidence to resolve:** fresh RLS snapshot plus API-shaped tests for owner, partner, unlinked and revoked access. Live visibility remains unknown in this review; no production read or write was made.

## D05 — Freshness and memory validity

**OPEN DECISION · Medium · F07–F08.**

- **Existing references:** [04 MEMORY-DESIGN](../04-memory-context/MEMORY-DESIGN.md), open questions and proposed lexicon extension; [04 expiry rules](../04-memory-context/CORRECTION-AND-EXPIRY-RULES.md); [05 attention rules](../05-proactive-assistance/ATTENTION-RULES.md).
- **Choice:** reconciliation-nudge thresholds, circumstance expiry and review cadence. These do not change the factual meanings of `balance_set_at`, `updated_at` or fetch time.
- **Recommendation:** keep source fact age, read age and reconciliation age distinct. Choose one proposed memory schema with zone, open-ended validity, condition identity and review derivation before estimating migration work.
- **Evidence to resolve:** realistic fixtures and a specific benefit from retained preferences. “Hundreds of rows” is not measured storage evidence. A no-memory/direct-settings alternative remains valid.

## D06 — Shared-contract rollout and retirement

**OPEN implementation choice · High · F09.**

- **Existing references:** [08 CROSS-MODULE-CONTRACTS](../08-shared-data/CROSS-MODULE-CONTRACTS.md), stages 0–4 and D1–D7; [19 Q07/Q16](../19-business-rules/OPEN-DECISIONS.md).
- **Choice:** consumer sequence, compatibility interval, missing-date behavior, occurrence identity and coordinated mirrors, signed-URL repair, and eventual table retirement.
- **Recommendation:** keep independent helper extraction small. Do not bundle money-date rejection, planned-occurrence migration, trigger changes and URL repair as code-only consumer moves. Retire data only under a separately reviewable preservation/restore plan.
- **Evidence to resolve:** explicit writer/reader/schema/trigger matrix and per-stage acceptance; owner decisions on the existing questions. A stage's suggested default is not approval.

## D07 — Notification precedence and standing consent

**OPEN DECISION · High.**

- **Exact references:** [05 ATTENTION-RULES](../05-proactive-assistance/ATTENTION-RULES.md), AR7 at lines 80–84 and AR12 at lines 120–122; [05 PROACTIVE-ASSISTANCE](../05-proactive-assistance/PROACTIVE-ASSISTANCE.md), line 158; [19 Q09/Q17](../19-business-rules/OPEN-DECISIONS.md).
- **Evidence:** the proposal exempts explicitly requested alerts from its new quiet-hours treatment, while acknowledging that NOTIF-19 describes broader producer coverage. P08's standing native preference is not permission for model-proposed money/schedule writes. These distinctions are partly recognized already; they are unresolved policy dependencies, not evidence of a deployed contradiction.
- **Impact:** silent suppression of a requested reminder, duplicated channels, or an “Always” setting being generalized beyond its authorized operation.
- **Proposed correction/decision:** define an explicit precedence table for user-set alerts, system nudges, quiet windows, household recipients and optional standing preferences. Keep model proposals under existing human-confirmation constraints.
- **Evidence to resolve:** intended per-person behavior and source-specific consent scope, followed by sender/recipient fixtures and owner-provided scheduler traces. First proactive pilot should be a single in-app situation; do not assume a whole wave is needed.

## D08 — Healthcare follow-through boundary

**OPEN DECISION · High · F12.**

- **Existing references:** [05 P10](../05-proactive-assistance/TRIGGER-CATALOGUE.md); [19 Q15](../19-business-rules/OPEN-DECISIONS.md) for dose-time policy, which is a separate question.
- **Choice:** administrative record review, refill logistics or clinical recommendation. The current course-end fields establish only a recorded end date.
- **Recommendation:** restrict this candidate to neutral review of recorded information. Remove prefilled continuation from the example. Do not bundle a treatment-duration decision with a timezone or notification change.
- **Evidence to resolve:** defined source of treatment instructions, applicable user action and failure behavior. No personal diagnosis or regimen was inferred in this review.

## D09 — AI budget and evaluation acceptance

**OPEN DECISION · Medium · F05, F10–F11.**

- **Existing references:** [19 Q14](../19-business-rules/OPEN-DECISIONS.md); [07 USAGE-CONTROLS](../07-ai-quality/USAGE-CONTROLS.md); [07 evaluation](../07-ai-quality/EVALUATION-PACK.md).
- **Choice:** intended spend ceiling and what quality evidence is enough for a scoped change. The present guard values and proposed synthetic workloads do not establish a household budget preference.
- **Recommendation:** reconcile answer keys before comparison; distinguish routing quality from source correctness and consent. Keep per-route guard descriptions accurate. Revalidate vendor prices when an actual budget/model decision is made.
- **Evidence to resolve:** deterministic, replay-only scoring with reproducible rubric arithmetic; API-shaped source fixtures; owner-selected budget policy. No paid live evaluation was run or authorized by this task.

## D10 — Which larger capability earns its prerequisites?

**OPEN DECISION · Medium · F14–F15.**

- **Existing references:** [12 CANDIDATE-COMPARISON](../12-solution-blueprints/CANDIDATE-COMPARISON.md), [16 SOLUTION-CONCEPTS](../16-product-research/SOLUTION-CONCEPTS.md), [17 PRIORITY-MATRIX](../17-roadmap/PRIORITY-MATRIX.md).
- **Choice:** interruption recovery, day reset, meal/shopping delta, sourced recall, or budget tradeoff. Different pack IDs sometimes name the same family; they are not additive commitments.
- **Recommendation:** preserve the roadmap's conditional alternatives. Day reset needs legal occurrence moves and honest external-calendar coverage; meal/shopping needs source/contribution identity and compatible quantities; budget changes need consistent periods/currencies and atomic effects; recall needs current access, source identity and age. None requires a universal new agent framework.
- **Evidence to resolve:** one observed household problem and a small deterministic/manual comparison. Vendor capabilities show possible interaction patterns, not ERA demand or achieved value.

## Constraints carried forward, not reopened

The repository's existing rules remain authoritative: no agent production DB writes; no unapproved paid live API tests; AI proposes and the human confirms domain writes; source-specific authorization; shared recurrence engines; mobile verification for future UI work; migration/schema pairing for future DB changes. This register does not change these rules, mark PM items done, approve proposals, or ask anyone to execute SQL now.
