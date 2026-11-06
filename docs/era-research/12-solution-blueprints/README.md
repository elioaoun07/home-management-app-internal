# ERA solution blueprints

Status: **proposals for owner review; none approved or implemented**. Analysis date: 2026-11-06. Analyzed repository: `main`, commit `9cd4166691edd9367ea1bd9a604e0bec13ffe870`.

This pack compares five opportunities and develops three: finish an interrupted request, reset a disrupted day, and take a dinner choice through shopping to recorded cooking. Selection is architectural judgment, not evidence of usage frequency or owner demand. These are standalone planning inputs, not a delivery campaign, ticket list, policy change, or authorization to implement.

## Read this pack

| File | Purpose |
|---|---|
| [Candidate comparison](CANDIDATE-COMPARISON.md) | Five candidates, selection rationale, conditions that could change the ranking |
| [Blueprint 01](BLUEPRINT-01.md) | Finish an interrupted everyday request without replaying completed writes |
| [Blueprint 02](BLUEPRINT-02.md) | Reset the remaining day with a small, explicit schedule review |
| [Blueprint 03](BLUEPRINT-03.md) | Choose dinner, prepare the shopping list, and record cooking |

Each blueprint separates current implementation, documented intent, proposals, and unknowns. Its minimum useful release is a complete narrow outcome, not a promise to ship the whole concept. Requirement and acceptance identifiers are local to the blueprint (`B1`, `B2`, `B3`).

## Available input packs

The local filesystem contained **11 numbered packs and 57 Markdown files** before this pack was created. All pack indexes were inspected; the reading scope below identifies deeper inputs. No other branch was fetched or assumed accessible. Missing numbers are not evidence of nonexistent work elsewhere. `docs/era-research/RemainingTASKS.MD` was present outside the packs; it was inventoried, not treated as implementation evidence.

| Available pack | Markdown files | Pack's stated source cutoff | Local provenance and reading scope |
|---|---:|---|---|
| [01-atlas](../01-atlas/README.md) | 5 | `53443c0` | Tracked; index and selected capability-map sections |
| [03-life-journeys](../03-life-journeys/README.md) | 8 | `9cd4166` | **Untracked input**; index, cross-module opportunities, shared dependencies |
| [04-memory-context](../04-memory-context/README.md) | 5 | `22152c2` | Tracked; index, selected current-context and memory-design sections |
| [05-proactive-assistance](../05-proactive-assistance/README.md) | 5 | `0b0588f` | Tracked; index and attention rules |
| [06-action-execution](../06-action-execution/README.md) | 5 | `beb8584` | Tracked; index and approval/recovery matrix |
| [07-ai-quality](../07-ai-quality/README.md) | 6 | `91c4285` | Tracked; index only; no evaluation answers used as test evidence |
| [08-shared-data](../08-shared-data/README.md) | 5 | `77141d1` | Tracked; index only; detailed contract input comes from journeys and current source |
| [10-interaction-design](../10-interaction-design/README.md) | 5 | `9cd4166` | **Untracked input**; index plus interaction review from the preceding documentation task in this session |
| [16-product-research](../16-product-research/README.md) | 5 | `9cd4166` | **Untracked input**; index and solution concepts |
| [18-ai-handoff](../18-ai-handoff/README.md) | 4 | `1c586d0` | Tracked; index only |
| [19-business-rules](../19-business-rules/README.md) | 4 | `cacf59d` | Tracked; index only |

Cutoffs above are pack declarations, not proof that every assertion still holds. Current-code claims below cite files inspected at the analyzed commit. The three untracked packs are accessible local documents, not part of that commit. Their snapshot SHA-256 values bind this analysis to the actual inputs:

| Pack | SHA-256 |
|---|---|
| 03-life-journeys | `1155418b2b2802ad8244ff0cdc90d70849571039da310c3b1de51c1911761cd0` |
| 10-interaction-design | `acd26c4c94bcc818611157b36d9492f4e67adf9341abef7bcdfb73b2bcca6f03` |
| 16-product-research | `74fba9acff36d4260f6ab4f310f1b06b086e0ed748a97d25c114aac8b857e59c` |

Snapshot method: sort each pack's direct `*.md` files by filename; hash filename UTF-8, NUL, raw file bytes, NUL, sequentially. Existing tracked files were unchanged at baseline. The input packs and `RemainingTASKS.MD` were already untracked and are outside this task's output.

## Evidence and limits

**Implemented** means a reachable source path or contract exists in the repository; it does not mean a feature is enabled, deployed, used, or verified against production. **Documented intent** means repository prose states a direction. **Proposed** means this pack recommends future behavior. **Unknown** means evidence is insufficient.

Architecture routing used the [Feature Map](../../../ERA%20Notes/01%20-%20Architecture/Feature%20Map/_index.md), module overviews, and [Design Doctrine](../../../ERA%20Notes/01%20-%20Architecture/Design%20Doctrine.md). This is work across junctions: ERA execution connects source modules; day planning connects Items and flexible placement; dinner connects Recipes, Meal Planning, and Hub Shopping. Source modules retain ownership.

The [product concepts](../16-product-research/SOLUTION-CONCEPTS.md) and [cross-module opportunities](../03-life-journeys/CROSS-MODULE-OPPORTUNITIES.md) informed candidate selection. Their descriptions of other products are prior research, not independently reverified product facts here. There are no invented usage analytics, measured effort savings, deployment assertions, or inferred feature approvals in this pack.

No pages were rendered and no screenshots were visually reviewed for this solution architecture task. Screen proposals require mobile, keyboard, assistive-technology, and user validation. Production RLS, feature flags, scheduler operation, actual source-data completeness, external-provider state, and performance were not verified. Schema presence is not evidence of live access policy. No production data, paid API, or external account was accessed.

## Shared proposed contracts

These are release requirements, **not claims that existing routes already satisfy them**. Each blueprint must inventory its participating adapters before implementation; unsupported adapters remain read-only or link to their existing precision tool.

1. **Source records are authoritative.** A run is an execution journal; a conversation is context; a projection helps navigation. None substitutes for an Item, meal plan, shopping message, or actual payment. A successful write is distinct from completion in real life.
2. **Evidence has a state.** Reads distinguish available, genuinely empty, unavailable, restricted, and stale. Carry source IDs, source version or comparable precondition, fetch time, scope, and relevant local date/time zone. Freshness budgets must be agreed per source; no universal cache age implies safety.
3. **Consent binds to the change.** The reviewed proposal contains exact targets, before/after values, audience, source versions, and a stable proposal fingerprint. Recheck permission and source preconditions at the write boundary. A change to those facts requires another review. AI text, historical consent, and household assignment are not authorization.
4. **Retry requires identity.** A logical operation ID remains stable across transport attempts. An attempt ID alone is insufficient. Where safe retry is offered, a source-local operation receipt and mutation must commit atomically, or the adapter must provide an equivalent proven idempotency contract. The ERA journal subsequently records the receipt. A source write can succeed while that journal update fails.
5. **Unknown is not failed.** A timeout after dispatch is uncertain. Only an authoritative receipt establishes success; safe retry requires proof that the same operation cannot duplicate its effect. Similar titles, amounts, dates, or nearby timestamps are review clues, not conclusive proof. Never silently enqueue uncertain AI writes or replay an entire partially completed plan.
6. **Stop and Undo differ.** Stop prevents future steps; it does not roll back completed ones. Undo is a separate, permission-checked inverse with source preconditions and its own receipt. If later edits make an inverse unsafe, offer the current source and a correction. Mutation toasts retain the repository's Undo convention; durable receipts also expose recovery after the toast disappears.
7. **Attention is optional and finite.** These releases are user-invoked and need no new push notifications, daily cleanup, streaks, planning scores, or mandatory inbox processing. Dismissal hides a suggestion; it never completes the underlying work. Existing explicitly configured reminders remain source-owned.
8. **AI is optional in the critical path.** It may interpret or explain; deterministic code resolves targets, validates dates and permissions, checks conflicts, calculates supported quantities, and writes after confirmation. Source text is untrusted data, not instructions. Use existing provider paths and quotas; no new model, connector, or subscription is required.

The [execution matrix](../06-action-execution/APPROVAL-AND-RECOVERY-MATRIX.md) discusses recovery checks, including record matching. This pack deliberately treats heuristic matches as inspection aids only. The [journey contracts](../03-life-journeys/SHARED-DEPENDENCIES.md) provide the stronger operation-identity and stale-consent boundary used here. The [attention rules](../05-proactive-assistance/ATTENTION-RULES.md) inform suppression, but their proposed thresholds are not adopted as approved policy.

## Sequence and implementation boundaries

Recommended order is **B1, then B2, then B3**, subject to owner priorities. First establish safe recovery for the narrow B1 adapters. B2 and B3 can use that journal and receipt vocabulary, but must prove their own source contracts; a working reminder adapter does not make meal or flexible-schedule writes safe.

Do not begin with a universal workflow engine, new memory store, global Home migration, or generalized recommendation queue. The interaction pack's broader Capture/Find/Continue and Home proposals remain independent options. These blueprints place small entry points in existing ERA, Schedule, and Kitchen surfaces. No standalone module should import another standalone; orchestration belongs in existing junction/shared layers.

Common nonfunctional release gates are authenticated owner-scoped reads, current household permission checks, server-side input validation, bounded reads, cancellation of obsolete reads, source-specific cache invalidation, accessible named controls, and explicit loading/error states. There is no network-dependent claim of zero-latency saving. Skeletons and disabled actions distinguish pending work from success. Test providers with recorded fixtures or mocks; live paid calls require the owner's separate authorization under repository rules.

## Unresolved owner decisions

| ID | Decision before implementation planning | Proposed starting position |
|---|---|---|
| D1 | Which outcome is most valuable in the owner's actual routine? | Validate the three fictional journeys; keep the sequence conditional |
| D2 | Where should unfinished requests appear, and how long should dismissed history remain? | Small ERA Continue entry and existing history; no new dashboard or automatic expiry of unresolved writes |
| D3 | Which schedule items may the day-reset tool move? | Own ordinary one-time reminders and eligible flexible placements; protected/source-managed work stays link-only |
| D4 | What calendar coverage and time-zone behavior should the day-reset review disclose? | ERA-only evidence; explicit date/zone review after travel, no external free-time claim |
| D5 | Is household-required dinner planning acceptable for the first release? | Reuse the current household requirement; solo planning is a separate scope decision |
| D6 | How should dietary constraints and quantities constrain dinner suggestions? | Show actual recipe data and unknowns; no allergy guarantee or inferred pantry truth; preserve original recipe quantities initially |
| D7 | What retention, deletion, and diagnostic fields are acceptable for proposals and receipts? | Reuse existing private records, minimize duplicated content, redact logs; set a deliberate retention policy before release |

Technical discovery is separate from owner preference: verify durable execution enablement, live schema/RLS posture through approved evidence, adapter idempotency, source version support, actual date contracts, and recipe/status side effects before estimates. No blueprint is approved by listing it here.

## Consistency review

Completed one final consistency pass on 2026-11-06:

- Exactly the five requested Markdown files exist in this output directory. Git status shows only this new pack in addition to the pre-existing untracked inputs; no tracked file modifications.
- All local Markdown targets resolve, cited source line numbers are in bounds, linked headings exist, and decision references resolve to D1–D7. The three local-input snapshot hashes still match the recorded values.
- Five candidates map consistently to three selected blueprints: C1/B1, C2/B2, C3/B3. Each blueprint includes all requested planning dimensions, a dependency diagram, a bounded minimum release, and reasons not to build.
- The 35 acceptance scenarios are specifications, not executed tests. Together they cover source freshness, permission changes, duplicate submission, interruption, partial success, provider/source outages, correction, and interaction validation.
- Semantic review retained the same boundaries throughout: journal concurrency is not source idempotency; calendar export is not complete availability; planned coverage is not food safety; groceries checked is not cooked; Stop is not rollback; heuristic record matches are not proof of an operation's outcome.
- No additional dashboard, mandatory pantry maintenance, new AI provider, autonomous write, approved feature, or measured adoption claim is introduced. Optional future increments remain outside minimum-release acceptance.

No broken links or internal mapping conflicts were found. The remaining risks are explicitly recorded as owner decisions and technical discovery gates, rather than resolved by assumption. Runtime/UI testing, PM updates, Atlas changes, migrations, typecheck, and application tests are not applicable because no implementation is changed. Visual usability, actual permissions/deployment, provider operation, and user value remain unverified.
