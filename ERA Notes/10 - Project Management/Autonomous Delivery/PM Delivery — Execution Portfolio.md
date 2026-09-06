---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Delivery — Execution Portfolio

> Written after the target architecture and second-pass challenge. **Proposed stages only. No implementation is authorized or marked shipped by this study.** These are six bounded milestones, not six claims of one-session effort. Each contains a small number of independently reviewable implementation slices; split a slice only when its proof cannot fit one focused session.

## 1. Admission and implementation rules

Read [V2 Architecture](<PM Delivery — V2 Architecture.md>), [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>) and the relevant source evidence before coding. Recheck source because paths/line citations describe `d6e0260`. The owner may authorize a stage later; this portfolio does not insert hundreds of tasks into existing queues or silently supersede their operational policy.

Use proposed namespace `scripts/delivery-v2/` and a small shared contract package, with final paths chosen in Stage 0. These paths do not exist yet. Keep V1 imports one-way through adapters; V2 kernel cannot depend on `run-session.mjs` or write `.delivery/sessions/`. Leave production Supabase untouched. Any later relay schema change requires a manual migration/runbook and owner application under Hard Rules 24/26.

For every slice: specify input/output schema, invariant, effect authority, fixture, rollback and one observable user outcome. A weaker model should implement that contract, not redesign the architecture or infer missing safety behavior. Test fixture side effects in temporary isolated directories. Do not launch real providers/bridges simply to make a test realistic.

No-git-write/no-worktree policies continue. One product writer. Source/preimage hashes and process isolation must be real before unattended execution. Missing platform capability yields a read-only/supervised fallback, not a permission bypass.

## 2. Stage 0 — Import and show one truthful work record

**Outcome:** select existing product work in a read-only V2 view without changing its identity or falsely certifying historical sessions.

**Slices:** (a) shared typed Work/Contract/Run/Decision/Evidence/Command schemas and invariants; (b) scanner-based import plus origin/alias mapping; (c) minimal CLI/local view showing one work record, legacy history and contradictions.

**Reuse/read:** `scripts/pm/shared/md-scan.mjs`, `shared/tasks.mjs`, `scripts/delivery/packet.mjs`, current parser fixtures; D01/D11/D14. Select SQLite binding/runtime version based on local compatibility, with transactions, backup and durability support tested. Pin and document the choice; do not add an ORM or event framework without a concrete need.

**Input/output contract:** immutable source snapshot → imported work IDs and conflict records. Reimport same snapshot is idempotent; reordered source preserves mapped identity; unresolved duplicates remain conflicts. Legacy accepted state plus stale finish appears inconsistent, never verified. Capture draft obtains identity before triage.

**Proof:** reordered/renamed/duplicate-alias fixtures; interrupted import transaction; complete export and restore of one record; read-only source hash comparison. Actual V1 files unchanged.

**Stop/rollback:** if mapping is ambiguous, leave the item unadopted and continue other imports. Remove only the new projection/config to roll back; originals remain authoritative. No source edits to V1 for this stage.

**Exit artifact:** working local record viewer plus schema contract and conflict report. This stage alone does not qualify execution.

## 3. Stage 1 — One isolated FAST candidate with crash recovery

**Outcome:** one clear non-tooling task becomes a checked candidate with conserved attempt identity and usage; forced interruption can resume safely.

**Slices:** (a) qualify one provider/process boundary on Windows using fake tools and negative containment fixtures; (b) kernel transactions for grants, attempts, effects, usage/reservations and projection outbox; (c) candidate manifest plus one FAST observer and minimal result view; (d) explicit owner-authorized real product pilot after fixtures pass.

**Reuse/read:** driver stream/normalization seams and fake drivers; `scripts/delivery/fsx.mjs` for artifact output; diff/locator helpers; D03/D04/D06/D10/D16/D17. Do not port weak acceptance semantics or the 14-state graph. Default to patch/candidate output with no host integration.

**Input/output contract:** exact contract + grant + base manifest → unique reserved attempts → isolated candidate + typed observer receipt → result manifest. Every paid call, including retry/preflight, uses the same reservation protocol. Native model output cannot update the runtime database or mint evidence.

**Proof:** outside-path write, `.git` access, secrets/environment access, network escape, symlink/reparse traversal, descendant process after revoke, late publication; crash at dispatch/effect/receipt boundaries; duplicate cumulative usage; failed retry followed by success. These must operate on disposable fixtures, never real secrets or production endpoints. One exact-edit observer must reject surplus change; working-control template verifies value binding. Unknown costs stay reserved.

**Stop/rollback:** if isolation or revocation cannot be demonstrated, expose read-only/patch assistance only. If effect identity or usage is uncertain, block further dispatch and keep artifacts. Disable V2 launch without touching V1 history.

**Exit artifact:** a non-tooling candidate the owner can review and apply manually, with one reproduced forced-crash recovery and inclusive usage basis. Do not build a new dashboard before this outcome.

## 4. Stage 2 — Prove behavior and make results trustworthy

**Outcome:** bounded product behavior gets criterion-specific proof and one identical result on local view/export/continuation.

**Slices:** (a) trusted test selection/execution receipt with nonzero/skipped/inconclusive semantics; (b) criterion/evidence eligibility and freshness, including test-oracle changes; (c) result exporter/recovery projection and three comparable FAST product pilots in total.

**Reuse/read:** `tests/delivery/acceptance.test.ts`, `instant.test.ts`, `finish-package.test.ts`, `validation-baseline.test.ts`, raw transcript fixtures; D04/D05/D11/D18. Reuse test infrastructure; intentionally replace assertions that accept arbitrary filenames.

**Input/output contract:** frozen candidate + criterion proof requirements + observer versions → eligible evidence set and per-criterion statuses. Export, UI and successor selection consume that same evaluator. Waived/missing/stale evidence never becomes satisfied. Failed PM export has its own retryable receipt, not an opaque done marker.

**Proof:** arbitrary existing-file evidence rejected; no-test exit-zero rejected for behavior; altered oracle/config invalidates prior proof; malformed review remains inconclusive; candidate mutation after test stales evidence; missing blob blocks completion; contradictory legacy finish is exposed without rewriting history.

**Stop/rollback:** false completion disables the affected profile immediately. Keep safe candidate inspection and unrelated supported classes available. No observer may certify a live environment it did not inspect.

**Exit artifact:** coherent verified candidate packages with measured owner actions, active minutes if supplied, inclusive resources, limitations and failures. Three pilots are an initial operating gate, not statistical proof of safety.

## 5. Stage 3 — A DEEP DIVE survives replacement and delay

**Outcome:** a fresh model continues a real investigation/implementation after interruption without re-asking recorded decisions or trusting stale facts.

**Slices:** (a) seven-part dossier with hypothesis/probe/decision/obligation producers; (b) prompt compiler and delivered-input manifests; (c) qualified fresh challenger and one multi-session product engagement.

**Reuse/read:** `scripts/delivery/memory.mjs`, `context-assembly.mjs`, `context-policy.mjs`, transcript pointer formats and owner Q&A; D08/D09. Preserve useful native continuity; do not add a vector store, autonomous summarizer or multi-writer coordinator.

**Input/output contract:** current contract + source-bound dossier + pending effect cursor → compiled context with manifest → successor observations. Requested paths are not marked retrieved; compiled content is not reported as measured provider footprint. Unknown telemetry stays unknown.

**Proof:** rotate with failed hypotheses and unanswered obligations; verify actual input consumed by new driver; source drift reopens dependent facts; repeated identical negative probe is detected; owner answer survives model change; crash leaves bounded raw tail; challenge receives independent inputs and cannot modify code/acceptance.

**Stop/rollback:** if replacement repeatedly rediscovers the same established facts, improve the dossier/assembly boundary before adding context capacity or more agents. Inconclusive review becomes an obligation, not a vote.

**Exit artifact:** one linked multi-session engagement with replacement-model resumption, recorded investigation value, selected design, actual implementation checks and remaining owner observations.

## 6. Stage 4 — Dependable desktop and phone control

**Outcome:** both devices show the same work/decision/result revision; a timed-out command never causes an accidental second effect; captures remain visible before triage.

**Slices:** (a) common projection and versioned command schemas used by existing desktop components; (b) local authenticated/signed command acceptance and replay/expiry/key-revocation receipts; (c) relay client with owner-bound cache, cursor/full-refresh and command status query; (d) compact Work/Running/Decisions/Results information architecture and owner device acceptance.

**Reuse/read:** current board/search/filter components, `scripts/pm/bridge.mjs`, `src/features/pm-live/*`, session views, containment and explicit truncation; D12–D15. One typed contract package, not copied field/type definitions. Preserve static read-only export.

**Input/output contract:** verified device command bound to installation/owner/target revision → durable receipt queryable by same ID. Snapshot contains source generation/cursor and independent liveness/progress metadata. Complete snapshot replaces prior scope; failed refresh retains identified stale data. Captured work is returned by ID immediately.

**Proof:** response before insert acknowledgment, lost realtime result, duplicate tap/reload, same ID with changed actor/payload, bridge crash after effect, stale same-kind decision, signature/payload mismatch, expired/revoked key, wrong installation, owner switch, missed deletion, relay restart, schema mismatch and truncation. Revocation must work across ordinary progress on the named run/grant while refusing a successor target. Desktop and 390px viewport plus physical-phone grant/UAT checks. Existing production relay behavior is owner-verified only.

**Stop/rollback:** keep mobile read-only when provenance or live relay constraints are unverified; disable grant controls while retaining result/capture/status where safe. No guessed production migration. Do not describe cached commands as executed.

**Exit artifact:** one owner journey from phone capture to visible work, one decision reconciled after acknowledgment loss, and one result identical to desktop at the same revision.

## 7. Stage 5 — Controlled application and deliberate retirement

**Outcome:** supported candidates can be applied under proven conditions; obsolete V1 machinery is removed without losing historical evidence or blocking ERA development.

**Slices:** (a) destination-fidelity/exclusion qualification and per-file integration journal; (b) idempotent PM result projection with explicit field ownership; (c) selected-class cutover, rollback drill and legacy retirement.

**Reuse/read:** postimage Undo and path/snapshot helpers, V1 active-session reader, archive/import fixtures. No Git writes or worktrees. If actual OS exclusion cannot cover external editors and path creation/deletion, retain owner-controlled application permanently; local verified candidate completion does not depend on automatic integration.

**Input/output contract:** frozen verified candidate + explicit integration grant + current excluded destination → recorded apply intent → observed postimages and integration receipt. Acceptance and integration may be authorized by one informed owner action, with distinct records. Owner shipping/deployment stays separate.

**Proof:** external editor race before/during application, drift in an unchanged dependency, crash after first of multiple file writes, late old worker publication, partial rollback with a newer owner edit, duplicate apply command, PM projection conflict, adoption racing V1 launch/mutation, mixed-checklist unrelated edit, backup/restore with referenced blobs. V1 server paths enforce adopted-item exclusion; separate projection export is the fallback until shared-file exclusion is proven. Never claim atomic whole-repository application.

**Retirement gate:** all active V1 sessions have completed or been exported; no new session of a cutover class routes into V1; desktop/phone/static/historical-reader checks pass; rollback preserves candidates and records. Then remove old launch routes, legacy desktop assets, duplicate phase/status/cost derivations and unused compatibility code. Do not delete raw session history to simplify the migration.

**Exit artifact:** one supported application path or explicit permanent manual-application boundary, with a deletion diff and restoration receipt. Re-measure owner effort before expanding scope.

## 8. Effort and sequencing discipline

Stage 0 is small; Stage 1 is the largest uncertainty because real Windows/provider containment and effect recovery are the hard work. Stage 2 and Stage 4 are medium-to-large depending on observer and relay scope; Stage 3 is medium with one provider; Stage 5 is conditional and may be omitted as automatic integration. These are relative engineering estimates, not promises of two-hour packets or a calendar date.

The portfolio need not halt household product work. Schedule one foundation slice alongside ordinary ERA delivery, and let each stage produce a usable artifact. Do not allocate a second provider, framework rewrite, remote always-on execution or full domain-autonomy library until the first qualified path saves owner attention.

At each exit record: useful product outcome, missing proof, owner interactions, elapsed/active time where actually observed, all usage basis, recovery result, and what code/concepts can now be deleted. Pause expansion if investment only generates internal tooling artifacts.

## 9. Research contract coverage

| Brief concern | Primary study document |
|---|---|
| Existing system, historical evidence, prior studies | [Diagnosis](<PM Delivery — Current System Diagnosis.md>) |
| Owner mission, desktop/mobile product, confidence | [Target Product](<PM Delivery — Target Product.md>) |
| Failure lifecycle and common root causes | [Red Team](<PM Delivery — Red Team.md>) |
| State, authority, work, storage, effects, tool boundaries | [V2 Architecture](<PM Delivery — V2 Architecture.md>) |
| Complete high-speed journey and escalation | [FAST](<PM Delivery — FAST.md>) |
| Complete reasoning-heavy journey and interruption | [DEEP DIVE](<PM Delivery — DEEP DIVE.md>) |
| Durable memory, agents, providers, resource governance | [Context & Agent Model](<PM Delivery — Context & Agent Model.md>) |
| Claim/evidence/proof/decision, verification, recovery, autonomy | [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>) |
| Repair/refactor/V2, reuse/deletion, cutover, second-pass challenge, final answers | [Migration Strategy](<PM Delivery — Migration Strategy.md>) |
| Bounded future implementation stages and exit evidence | This portfolio |

All ten documents are research deliverables. Source tests and synthetic probes in Diagnosis establish the reported current findings; proposed V2 fixtures are explicitly future work. No V2 feature, migration, deployment or autonomy level is marked implemented.

## 10. Study completion receipt — 2026-09-06

All ten required files are present with UTF-8/LF frontmatter, balanced fenced blocks and resolving relative Markdown links. Independent runtime and product/context reviews challenged the target; their concrete authority, integration, revocation, billing-provenance and proof corrections were incorporated. The Delivery and PM Tooling Master Books link the study and record newly evidenced pain; the Contradiction Register distinguishes the new target-design mandate from unchanged V1 operation.

`node scripts/pm/lint.mjs` passed with **0 errors** and the existing Native App empty-Next warning. `node scripts/check-feature-index.mjs` passed. `git diff --check` passed. The scoped source tests and six pure research probes are documented in Diagnosis; full application typecheck/build/browser/device testing was not run because no implementation changed. No provider, bridge, deployment or production DB action occurred. The owner's pre-existing research-brief edit was preserved.
