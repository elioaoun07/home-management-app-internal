---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Delivery — Migration Strategy

## 1. Decision: a V2 core, delivered by incremental replacement

Build a new contract/effect/evidence kernel and move selected work into it. Use deep refactoring as the migration technique, not as a requirement to preserve V1's conceptual model. Retain the current PM application where useful, import the corpus, preserve history and qualify selected utilities/providers.

The decisive evidence is the recurring boundary failure across D01–D18 in [Diagnosis](<PM Delivery — Current System Diagnosis.md>). Fixing stale rows, malformed review and cost deltas individually is feasible. Achieving dependable autonomy also requires immutable decision subjects, per-attempt effects, isolated candidates, semantic evidence, durable context and consistent projections. Retaining phase-sized mutable persistence while layering those guarantees around it would preserve the central complexity.

This does not justify discarding the scanner, transcript assets, controls, UI and fake-driver tests. Those are the strongest argument against a wholesale rewrite.

## 2. Compare the alternatives

Assessment is architectural judgment, not measured implementation cost. No percentage of retained code or completion date is invented.

| Dimension | A — Repair V1 | B — Deep refactor preserving core interfaces/model | C — V2 core with selective migration |
|---|---|---|---|
| Conceptual complexity | Retains phase/gate/awaiting/returnTo and file coordination | Reduces module size; risks carrying old state semantics through adapters | New bounded contract model; temporary dual-engine complexity during migration |
| Initial effort | Lowest for specific defects | Moderate/high; many behavior-sensitive seams | Highest foundational cost; first useful path must stay narrow |
| Total future effort | Repeated compatibility patches for each new autonomous behavior | Good if authority/effect model can truly change; otherwise hidden V2 work | Up-front kernel investment, fewer repeated integrations afterward |
| Migration risk | Lowest immediate change risk; unresolved trust risks remain | Live runner surgery and legacy-session migration can be delicate | Parallel candidate-only pilot lowers blast radius; adapters/import need care |
| Existing code retained | Most | Most surface/utilities, substantial runner rewrite | Strong utilities/UI/history retained; central runner/state/acceptance replaced |
| Reliability ceiling | Material improvement, but many unbound effects/claims remain | High only if transactional identity and isolation replace old boundaries | High for supported effect/observer classes; no universal correctness claim |
| Autonomy ceiling | Supervised use; less friction possible | Similar to C if deep enough, at cost of compatibility constraints | Verified handoff and low-risk local policy completion after evidence |
| Desktop/mobile quality | Existing solid surfaces, continued semantic duplication | Shared projections can improve both without new UX model | Work/decision/result model with separate device layouts and common truth |
| Context architecture | Patch rotation, retain phase artifacts | Can add durable dossier but legacy phase triggers remain | Dossier and delivered input manifest independent of provider/phase |
| Maintainability | Familiar, large regression surface | Improved modules; adapters can become permanent | Small trusted kernel; qualification cost explicit; retire adapters deliberately |
| Testability | Existing extensive suite, some weak assertions | Reuse fixtures while changing seams | Property/fault/observer contracts plus reused fixtures; new burden visible |
| Provider portability | Nominal interface masks unequal controls | Can qualify adapters, but current runner assumes capabilities | Admission by actual controls/telemetry; one provider first |
| Owner attention | Removes specific pain; routine gates persist | Can improve attention if allowed to alter semantics | Goal is exceptions and results, with no phase-operation requirement |
| Stronger future models | Better reasoning inside old loop | Potentially strong, constrained by residual model | Models propose more capable work while kernel protects fixed boundaries |

**Why not A:** too many required changes concern what the system considers identity, authority and proof. A succeeds as temporary hazard reduction, not as the long-term autonomy architecture.

**Why not a constrained B:** if B replaces state meaning, storage authority, effect execution, context and acceptance, it is substantively the V2 core proposed here. Keeping public APIs briefly is useful; preserving their incorrect semantic assumptions indefinitely is not.

**Why not a full greenfield product:** scanner, components, raw artifacts, read-only controls and test seams already solve valuable problems. Rebuilding them delays the first product outcome and repeats the corpus's documented meta-work bias.

## 3. Migration without freezing ERA work

V1 remains available for existing sessions and ordinary direct development remains available. V2 begins as an optional local path producing isolated candidates. No existing live session is converted in place. A selected work item has one execution owner at a time; assignment is explicit and visible.

1. **Read-only import/projection:** parse existing work, preserve aliases/origins, identify conflicts, expose historical results as unverified legacy records. Do not alter V1 runtime files or mark old criteria verified.
2. **First FAST candidate:** one qualified provider, one bounded supported task template, one isolated candidate and a truthful result. Test a forced crash. No phone grants or automatic repository integration required.
3. **Broader proof and resumption:** extend observer coverage and durable investigation after the first real product outcome establishes value.
4. **Shared clients:** existing desktop components consume typed V2 projections; mobile adopts command identity, provenance and cache contracts before receiving grant authority.
5. **Controlled integration and retirement:** enable only demonstrated capabilities; retire V1 launch paths for migrated classes, then legacy presentation/runner code after active sessions finish.

There is no deadline-driven bulk migration. If the first path does not reduce owner work or produces false proof, stop expanding it and fix the causal boundary. Do not repair every V1 backlog item before the pilot. A V1 defect requiring continued use may receive one targeted temporary fix; port its regression witness to V2 so the work is not duplicated invisibly.

The old two-completion freeze is evidence of a sound product-first instinct, not a requirement to repair V1 into two completions before researching its successor. This research authorizes no implementation. When the owner authorizes V2 work, use the new explicit pilot/cutover criteria rather than silently editing old policy or treating every old parked ticket as newly admitted.

## 4. Compatibility boundaries

| Boundary | Rule | Exit condition |
|---|---|---|
| V1 historical sessions | Read originals; import immutable references with unknown/inconsistent status | Permanent history reader or exported archive; never fabricate clean history |
| Existing Markdown work | V1 authority until explicitly adopted | Adoption writes identity mapping and makes legacy execution status a pointer/projection |
| Current PM components | Consume adapter-shaped view models initially | Replace semantic duplication with typed kernel projections |
| Existing Delivery API | Read-only compatibility for old sessions; explicit engine discriminator | No new V1 sessions in cutover class |
| Provider driver | Preserve normalization/stream handling only after conformance | Versioned adapter contract, no old assumptions leaking into kernel |
| Relay | Distinct installation/engine namespace; one command ID and kernel-verifiable provenance | Qualified V2 command and snapshot protocol on both clients |
| PM completion export | Runtime owns adopted status; Markdown reflects a committed result | Idempotent export receipt and conflict handling proven |

Historical import never guesses identity from a reused human ID alone. Preserve original path, text, timestamp, session and digest; mark uncertain mappings. A failed import leaves the original usable. Export must include contract, decisions, evidence manifest and raw-reference inventory so another tool can inspect the result without the running service.

Adoption exclusion must be enforced in both V1's server mutation paths and Delivery launch paths; a Markdown pointer or disabled button cannot stop an old cached client. Route all engine assignments through a shared ownership registry or equivalent atomic admission boundary. When the registry is unavailable, refuse execution for an ambiguously owned item. Shared checklist files still contain V1-owned rows: V2 export updates only its identified block under a guarded read/modify/write protocol and never restores a whole-file preimage over unrelated rows. Until shared-file writer exclusion is demonstrated, export to a separate V2 projection rather than modifying the mixed checklist. Adoption/import and a fresh V1 launch racing must resolve to one execution owner.

## 5. What survives, and in what form

| Asset | Disposition |
|---|---|
| Markdown scanner, text parsing, source containment, URL filter helpers | Reuse unchanged where their input contract remains identical; keep parity tests |
| Windows atomic file helper | Keep for exports/artifact writes; do not treat it as runtime transaction authority |
| Fake drivers, failure fixtures, diff/path-decoding utilities | Reuse invariants and injection seams; strengthen tests that currently accept weak evidence |
| Raw transcript shards, prompts, decisions, postmortems | Preserve unchanged as historical evidence; mark provenance and known gaps |
| Native session reuse | Keep as economic optimization after usage normalization and safety qualification |
| Read-only mode, postimage Undo, server-side capability refusal, explicit skipped/truncated evidence | Preserve safety properties; implementation may move into kernel/adapters |
| Existing board/search/components/styles and static export | Keep useful parts; no compulsory framework unification |
| Pure V1 state machine | Keep only in V1 compatibility path; reuse pure reducer testing style in V2 |

No module earns unchanged reuse solely because it is tested: `acceptance.test.ts` currently tests semantics V2 intentionally rejects. Qualify the contract, not the green checkmark.

## 6. Deletion ledger

| Delete from target | Why | Required retirement evidence |
|---|---|---|
| Four public lanes and phase-operation UI | Two modes plus automatic strategy reduce repeated owner choices | FAST and DEEP journeys pass with equivalent or stronger authority/evidence |
| Separate spec/plan/UAT formatting model calls | Often no independent information gained | Deterministic result/contract generation covers those cases |
| Role catalog entries that merely name activities | No justified independence | Fresh challenger and investigator paths cover actual needs |
| Ordinal as runtime identity | Selection can move to another item | Import/reorder/archive/resume identity fixtures pass |
| Mutable finish files as authoritative status | Crash/resume creates contradictory truth | All clients and export read one revisioned result projection |
| Throughput occupancy, duplicate cost calculations | Wrong units and drift | Normalized usage/telemetry conformance and client contract fixtures |
| Unpopulated memory fields and repeated summary layers | Promise memory without carrying discoveries | Replacement-model resumption proves durable dossier usefulness |
| Legacy `scripts/pm/client.js`, `styles.css`, `body.html` and old UI escape hatches | A second desktop implementation consumes attention and misleads source search | Existing desktop/mobile/static/fake-driver parity checks complete |
| Superseded V1 launch/runner paths for migrated classes | Permanent two-engine support defeats simplification | No active V1 sessions; supported-class cutover and history access verified |

Do not delete raw history, manuals needed to run old sessions, useful static export or safety tests merely to reach a code-reduction target. The brief's 70% thought experiment is a prioritization lens, not a deletion quota: preserve raw evidence, domain rules, scanner and tested mechanics; discard the orchestration/presentation layers that can be regenerated from the new kernel.

## 7. Cutover and rollback gates

Before a work class leaves V1: identity/revision tests, qualified process isolation, effect/usage recovery, correct observer coverage and real non-tooling result evidence must pass. Three initial FAST results are a proposed operational sample, not statistical proof. A multi-session DEEP result and fresh-model resumption qualify that mode separately. No expansion follows merely from a green unit suite.

Before phone grant controls: duplicate/early/lost receipt, signed-command replay/expiry/revocation, stale same-kind decision, wrong-owner cache and gap/full-snapshot fixtures pass. Owner supplies necessary live relay/device evidence under existing DB policy.

Before automatic host integration: demonstrate exclusion from all external writers plus crash/recovery under that exclusion. A cooperative quiet workspace supports supervised application only. If exclusion is unavailable, keep candidate handoff permanently; this is still a useful product, not a migration failure.

Rollback disables V2 launches for the affected class, freezes its active writers, preserves their receipts/candidates and returns new work to V1 or direct engineering. Do not import a half-executed V2 run into V1. Continue it under its original kernel or produce a handoff after reconciling effects. Restore/export validation protects against storage failure; deleting the V2 database is never rollback.

## 8. Mandatory second-pass challenge

| Challenge from the brief | Answer after evidence and adversarial review |
|---|---|
| Preserving V1 because it is familiar? | No: replace its phase/authority/proof core despite tested sunk cost. Preserve assets with independently useful contracts. |
| Rewriting because it is attractive? | A dashboard rewrite, graph database and distributed orchestration were rejected. First investment must deliver a real candidate. |
| Which V1 primitive is stronger? | Forensic artifact preservation and proven read-only/import utilities beat an opaque new service; keep portable exports and originals. |
| Genuine versus accidental complexity? | Auth, offline transport, unknown effects and owner observations are genuine. Phase names as dispatch, duplicated summaries and three records masquerading as independent decisions are historical choices. |
| What if no code existed? | Build a small local contract/effect/evidence service with one engineer and two task experiences. |
| What survives a 70% deletion? | Domain policy, source/intent corpus, raw history, scanner/containment, diff/fixture utilities and minimal controls. No precise line-count deletion is claimed. |
| Can FAST be fast? | One useful engineering conversation plus necessary checks; environment overhead measured. No paid preflight or mandatory phase cascade. |
| Can DEEP survive hours/days? | Dossier includes rejected hypotheses and consumed context manifests; test a replacement model and stale-source resume. |
| Can the owner stop watching? | Only for qualified local scopes with complete proof and bounded effects; V1 does not yet justify that claim. |
| Can another agent recover? | Attempt/effect/usage/decision/candidate receipts precede dispatch; unknown effects are reconciled before new work. |
| Is multi-agent helping? | Only independent bounded investigation or semantic challenge; one writer and deterministic checking remain default. |
| What should software enforce? | Identity, grants, budgets, observer execution, freshness, receipts, projection and publication fences. |
| What remains ceremony? | Any model call producing only a pre-existing status/format, or approval without changed authority/intent/evidence. Remove it. |
| What premise did evidence invalidate? | An agent registry is not independent review; reading-list/summary persistence is not delivered durable understanding; callback checks are not proven universal containment. |

The independent challenge also corrected this proposal: hash-check-then-write is not OS exclusion; epochs belong to ownership, not every command; every internal paid attempt needs admission; FAST must prove intended control binding, not just edited text; remote owner fields need verifiable provenance; separate receipts may share one owner action; late integration does not reopen closed engineering; adopted work needs V1 server-side exclusion; command dedupe binds actor/payload; and revoke commands survive ordinary progress without targeting successor authority. These corrections are incorporated in the target contracts.

# ASTRA Recommendation

**Build V2 at the execution core, migrate incrementally, and reuse V1 assets selectively.** Repairing isolated defects is worthwhile for continued supervised V1 use. It is not the best long-term architecture for the requested autonomy.

| Required decision | Recommendation |
|---|---|
| What should survive? | Domain rules and Markdown intent; raw history; scanner/search/UI assets; fake-driver and fault fixtures; useful diff, containment, controls and transcript mechanics; outbound relay pattern. |
| What should disappear? | Phase-driven runtime authority, ordinal identity, filename-based acceptance, duplicate state/cost interpretations, activity-as-agent catalog, unnecessary paid formatting phases and legacy desktop implementation. |
| Single most important primitive? | A durable **delivery contract binding intent, authorization, attempted effects, candidate identity and criterion-specific evidence**. |
| Biggest obstacle today? | The system can record approved ceremony and report completion while losing the connection to the actual proposition/effect. |
| What most reduces supervision? | Mechanically bounded effects and one truthful result/resumption record, so the owner need not infer reality from transcripts or heartbeat. |
| Is multi-agent justified? | Selectively for independent questions and adversarial semantic review. Not as the default pipeline, and never as multiple product writers. |
| Maximum safe autonomy today? | Supervised bounded assistance/execution with independent owner verification; unattended trustworthy completion is not established. |
| Realistic V2 reach? | Verified handoff for complex work and policy completion for qualified low-risk local work. Production DB changes and release remain owner controlled. |
| FAST should feel like? | State the change, start once, return to a checked result or one material exception. |
| DEEP DIVE should feel like? | A durable engineering engagement that investigates, challenges, implements and resumes without making the owner rebuild context. |
| Only three investments? | (1) Transactional identity/effect kernel plus isolated execution; (2) criterion-specific proof and truthful result/recovery; (3) durable context and shared desktop/phone command/result contracts. |

**If building this tool for myself today:** I would build a small local delivery service that runs one capable engineer inside a qualified boundary, remembers the actual investigation, checks explicit claims on immutable candidates, and gives me a concise decision or result from either device. I would spend complexity on effects, proof and recovery, and make the workflow around them as small as possible.
