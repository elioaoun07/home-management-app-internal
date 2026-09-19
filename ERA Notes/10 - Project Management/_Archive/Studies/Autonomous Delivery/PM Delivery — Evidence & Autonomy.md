---
created: 2026-09-06
updated: 2026-09-06
type: delivery-plan
status: baseline-frozen
owner: Elio
plan_revision: "2.1"
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# PM Delivery — Evidence & Autonomy

> Canonical evidence and completion contract for [Architecture revision 2.1](<PM Delivery — V2 Architecture.md>). This plan integrates the accepted reassessment. All fixtures below are future implementation requirements; the preserved historical test receipt is in [Diagnosis](<PM Delivery — Current System Diagnosis.md>).

## 1. What trustworthy means

A result is trustworthy when the owner can identify the requested outcome, authorized work, actual candidate, observations supporting each claim, remaining uncertainty and actual disposition. It is bounded engineering evidence, not a mathematical guarantee of defect-free software.

Keep four facts distinct: a model's **claim**, an attributed **observation**, a policy-qualified **verification**, and an **owner decision**. An owner may accept a limitation; a waiver remains a limitation. Native job success, a reviewer's confidence and a PM checkbox cannot independently establish delivery.

Verification is the custom boundary worth building. Use existing compiler/test/browser tools and concrete task-class checks. Do not build a general observer marketplace or complex dependency cache first.

## 2. Criterion contract before implementation

Every required criterion has:

| Field | Meaning |
|---|---|
| `criterion_id`, `revision` | Stable proposition within the immutable Contract revision. |
| `proposition` | Observable requested behavior or source/research outcome. |
| `scope` | Candidate/environment/scenario covered, including fixture or device limits. |
| `observer` | Eligible method and expected result; named existing checks where known. |
| `oracle_ref` | Origin/version of expected behavior, independent of the writer when consequence warrants it. |
| `freshness_inputs` | Candidate, observer/config, fixture and relevant environment identity. |
| `required_for` | Candidate verification, requested disposition, or both. |
| `forbidden_substitutes` | Weaker facts that cannot satisfy this claim. |

The supervisor can populate a small contract from the selected item and an established task template. The agent may propose missing criteria. Semantic ambiguity needs an appropriate independent review or owner choice before implementation changes the intended outcome. Do not ask the owner to approve every obvious criterion.

Illustrative behavior criterion:

```json
{
  "criterion_id": "AC-amount",
  "revision": 1,
  "proposition": "The mobile quick-amount control displays and selects 20",
  "scope": "identified local candidate, mobile form",
  "observer": "mounted interaction or browser action with selected-value assertion",
  "oracle_ref": "selected item revision",
  "freshness_inputs": ["candidate", "test-config", "fixture", "toolchain"],
  "required_for": "candidate",
  "forbidden_substitutes": ["replacement text exists", "zero tests selected"]
}
```

This does not add a claim about production transaction persistence unless the requested change implicates it. An explicitly source-only edit can have a structural criterion. An ordinary control change should not be silently weakened to source-only acceptance.

## 3. Eligible observations

| Claim | Eligible evidence | Insufficient alone |
|---|---|---|
| Exact source transformation | Complete base-to-candidate diff; exact intended change and absence of surplus changes | Intended text appears somewhere in the diff |
| Compile/type correctness | Actual compiler execution on identified source/config/toolchain | Changed TypeScript file |
| Unit behavior | Named executed assertions with suitable fixtures | Test path; exit zero after selecting no tests |
| Integration behavior | Controlled integration scenario with relevant effects asserted | Mock returning a desired status |
| UI interaction | Mounted/browser actions and observable values/state | Screenshot or handler source alone |
| Appearance | Screenshot with viewport/theme/scenario/build identity | Backend correctness inferred from appearance |
| Offline/reload/replay | Browser/storage/network sequence with persistence/dedup assertions | Queue function unit test alone |
| Physical-device behavior | Attributed observation of named scenario/device/build | Desktop emulation, push request ID |
| Research finding | Source-backed report, verified citations, explicit uncertainty and challenge appropriate to consequence | Unsupported model conclusion or invented citation |
| Migration preparation | Exact SQL reviewed plus isolated compatible-schema testing where available | Migration filename |
| Applied change | Exact destination/candidate correspondence and necessary destination checks | Patch exported, owner clicked Accept |
| Verified deployment | Identified deployed build plus required environment/behavior observations | Merge, successful build, deployment request sent |
| Owner acceptance | Decision bound to the reviewed result/candidate/revision | Positive chat text with an ambiguous subject |

A zero-test structural edit can be verified structurally when that satisfies the real request. It must never masquerade as tested behavior. A required production DB change remains an owner-run obligation under repository rules.

## 4. Protected check execution

The checker executes after trusted snapshotting freezes a candidate the writer cannot mutate. It uses an approved observer/configuration outside the writer's authority and a restricted execution environment. A candidate-authored package script cannot become the trusted evaluator simply by emitting a familiar success line.

Minimum receipt:

- `evidence_id`, candidate ID, criterion/revision and observer/config/oracle refs;
- relevant source/environment/fixture/toolchain fingerprints;
- actual argv or interaction procedure, working directory and safe environment description;
- started/finished times, exit/signal or interaction outcome;
- selected/executed/skipped counts where meaningful;
- raw output/artifact hashes and any redaction/truncation;
- asserted scope, result and diagnostic reason.

The supervisor/check adapter writes the receipt. The native engineer can suggest checks and supply logs, but supplied logs remain attributed inputs until verified. Test execution alone cannot settle an inadequate semantic oracle.

Protect established regression witnesses. New tests remain part of the candidate; independently scrutinize changes that remove assertions, alter test selection, weaken policy or redefine expected behavior. When needed, a fresh reviewer receives Contract, diff, source and evidence before the implementer's narrative. Findings resolve through a reproducible witness or bounded probe, not model voting.

Changes to delivery grants, the supervisor, receipt writer or evaluator require independent authorization under the previously trusted version. A candidate cannot certify its own new authority. Such work is excluded from the first autonomous product class.

## 5. Evidence state and freshness

Per-criterion state is `missing | satisfied | failed | inconclusive | stale | waived`.

| Input | State consequence |
|---|---|
| No eligible observation, no selected behavioral tests, missing required artifact | missing |
| Eligible fresh observation establishes expected proposition | satisfied |
| Eligible observation demonstrates violation | failed |
| Interrupted check, malformed review, ambiguous observation | inconclusive |
| Relevant candidate/observer/environment input changed | stale |
| Explicit owner accepts a named limitation | waived, never satisfied |

Freeze generation C1, check C1, return evidence for C1. A repair creates C2. C1's evidence stays historical and cannot certify C2 automatically. Initially rerun affected checks conservatively, using the complete relevant source/config/lockfile/fixture/toolchain identity. A fine-grained evidence reuse engine is deferred.

Owner edits to the source or application destination create a freshness issue. Hash checking does not establish exclusion from concurrent host editors. Initial handoff is owner controlled; later application qualification must establish its own source-to-destination validity.

## 6. One result and an honest completion predicate

Result schema is shared by desktop, phone, export and continuation. Minimum fields:

```text
result_id, result_version
work_id, contract_id, contract_revision, run_id
candidate_ref, closed_outcome, job_receipt_refs
criterion_states[], evidence_refs[]
requestedDisposition, observedDisposition, disposition_receipt_refs[]
remaining_obligations[], unknown_jobs_or_effects[]
resource_summary { basis, settled, reserved, unknown, enforcement_profile }
owner_decision_refs[], checkpoint_ref, next_safe_action
candidateVerified, workComplete, projection_status
```

`candidate_ref` and `checkpoint_ref` are null when none exists; `closed_outcome` is null while the Run remains open. Missing optional engineer prose does not invalidate an otherwise independently established candidate. Raw observations and authoritative records, not the availability of a model-written summary, determine the Result.

`candidateVerified` requires every required candidate criterion satisfied by eligible fresh evidence, valid artifact identity and publication scope, plus no unresolved authority/integrity violation. A candidate can be technically verified while native cost reconciliation remains outstanding; that accounting stays visible and reserved. It cannot be treated as free allowance or complete a strict-budget obligation. Any further job must fit the remaining allowance with all unresolved reservations retained.

`workComplete` requires candidate/research evidence appropriate to the request, every requested-disposition criterion satisfied, observed disposition establishing the requested destination, and no unresolved consequential job/effect or resource obligation. A waiver allows explicitly limited owner acceptance, not automatic verified work completion. A different acceptable outcome requires a deliberate Contract revision; do not rewrite the original request invisibly.

`requestedDisposition` and Run closed outcomes use Architecture's exact enums. Research may produce a `kind=research` Candidate. A source run closed as `verified_candidate` may still leave an `applied_change` or `verified_deployment` item incomplete. Later observed disposition appends a Result version without rerunning or rewriting the closed engineering history.

If the current Result or referenced artifacts are missing/inconsistent, show that failure. Do not prefer whichever legacy file appears greenest. A failed PM writeback affects `projection_status`; it does not erase verified engineering. The pending projection can retry the same receipt without running another model or marking the item complete prematurely.

Human acceptance, exact application and verified release are distinct receipts even when one informed owner action authorizes more than one. `RecordDisposition` may record an attributed owner observation, but cannot promote a generic click into proof of a deployed scenario.

## 7. Autonomy is eligibility, not another owner-facing ladder

Automatic execution requires all of: current Grant, supported executor, qualified confinement, enforceable resource profile, recoverable dispatch and an adequate initial evidence plan. Automatic completion additionally requires the full completion predicate and an authorized disposition path.

FAST/DEEP labels confer neither permissions nor proof. Deep read-only research can run with little owner involvement; a tiny high-consequence write can require strong review.

The initial FAST preset permits one supervisor-initiated repair after protected checks fail, if the Grant and remaining resource allowance permit it. This counts outer repair dispatches, not native internal test/fix iterations. Those remain covered by the native job's complete bound. Different repair limits or DEEP escalation must be explicit policy values rather than accidental retries.

| Operating capability | What is permitted | Exit evidence |
|---|---|---|
| Prepared assistance | Produce a proposal/contract or owner-run instructions within available authority | Attributed findings and explicit gaps |
| Confined native execution | Engineer within a qualified private environment | Recoverable Job/Candidate and truthful resources |
| Verified candidate delivery | Complete eligible machine/research checks | Candidate verified; outstanding application/release/device obligations explicit |
| Automatic work completion | Only a qualified task class with authorized disposition and no unmet required obligation | Work-completion predicate true |

These are system capabilities, not four UI modes or new mandatory phases. Qualification attaches to an exact executor/OS/version/profile and supported task class. Unsupported capabilities remain unavailable.

V1's current evidence supports supervised assistance with independent owner verification, not a demonstrated unattended completion guarantee. V2 implementation must earn eligibility through the fixtures and product trials below. A documented native sandbox or SDK option is not qualification.

## 8. Failure and continuation table

| Boundary failure | Required response |
|---|---|
| Crash before dispatch is known to start | Retain reserved identity; permit dispatch only if proven undispatched and grant still valid. |
| Launch response lost | Inspect/reconcile existing native reference or correlation ID. If unresolved, hold `unknown` and reserve; no second paid launch. |
| Native session pauses for decision | Persist Decision bound to subject revision; admitted answer/resume preserves native session when useful. |
| Native process crashes with partial edits | Retain/quarantine private scratch, reconcile usage, snapshot useful output safely; successor only after authority/resource checks. |
| Stop acknowledgment lost or child remains | Revoke publication immediately; keep Stop requested/unknown until stop or independent containment is established. |
| Writer reports success with malformed result | Preserve raw output/usage and reconstruct from the actual candidate and trusted receipts. Missing optional prose needs no paid retry. Only information required to establish identity, evidence or disposition creates an obligation; obtain it safely or return an honest partial. |
| Check fails or crashes | Preserve receipt; repair within grant or retain precise obligation. New candidate gets new checks. |
| Controller/store restarts | Recover records, verify referenced artifacts, inspect native jobs; do not recreate history by replaying model calls. |
| Context or provider replacement | Load valid Checkpoint/decisions/candidate/native references; reconcile outstanding jobs and stale inputs before resume. |
| Application/release is unavailable | Preserve requested disposition as an open obligation; return prepared candidate and concrete owner action. |
| PM projection or phone response lost | Retry/query the same receipt. Never redispatch engineering to rebuild a result view. |

A closed cancellation/failure may retain an unknown charge or quarantined native job. Such records are not silently settled. Authority cancellation, process stopping, billing settlement and useful artifact preservation are separate facts.

## 9. Canonical fixture families

Each fixture uses disposable synthetic inputs and fake services before any real product trial. Stages reference these IDs; native qualification cases in Context map to the same families.

| Family | Required witness and expected behavior | First required |
|---|---|---|
| **F-ID** | Insert/reorder/rename a selected row; duplicate alias; same-state stale ordinal. Launch the exact WorkRef or refuse ambiguous/stale selection; never another item. | S0/S1 |
| **F-AUTH** | Old same-kind approval, expired/revoked grant, new contract, or resume with exhausted allowance. Refuse dispatch; unchanged valid grant permits routine continuation. | S1 |
| **F-ISOLATION** | Synthetic host file/env secret, outside write/read, network/connector, symlink/reparse and descendant probes. Protected targets remain inaccessible; scratch edits remain confined. | S1 |
| **F-JOB** | Crash before/after dispatch; lost native reference/ack; failed job then retry; cancel and late output. One recorded dispatch identity per attempt; unknown never blind-retries or publishes. | S1; expanded S2 |
| **F-COST** | Repeated cumulative reading, counter reset, failed-then-successful jobs, unknown usage, inner retries/subagents/paid tools and threshold overshoot. No double count/refund; total job bounds proven or strict profile rejected. | S1 |
| **F-EVIDENCE** | Surplus same-file edit; unrelated path proof; zero tests; invalid verdict; changed oracle; mutation during check. Weaker/stale evidence cannot satisfy a behavioral claim. | S1/S2 |
| **F-RESULT** | ACCEPTED-like label plus stale finish; missing blob; partial artifact commit; failed PM projection. One honest result survives; no false item completion or paid replay. | S1/S2 |
| **F-RESUME** | Force interruption; replace native session; changed source/contract/authority; answered question. Preserve decisions/useful findings, reopen stale obligations, do not renew authority implicitly. | S2 |
| **F-COMMAND** | Duplicate/early/lost receipt, actor/payload ID reuse, stale grant, wrong-owner cache, empty full snapshot and cursor gap. Same command reconciles; no unintended grant or stale-row resurrection. | Local S1; remote S3 |
| **F-PUBLISH** | Verified candidate with no application; wrong destination/build; response lost after application; owner edits later. Requested disposition stays unmet until valid observation; no repeated unknown write or rollback of later edits. | Handoff S1; automatic path S3 |

Storage fault variants of F-RESULT include disk full between artifact write and reference commit, interrupted backup and restore with missing blobs. Test local transactional persistence/restart in S1; complete restore drill before unattended S2 cutover. No cleanup erases unresolved native jobs, reservations or candidate provenance.

## 10. Product evidence and stop rules

S0 compares the same delivery contract/evidence with ordinary native work. S1 produces one actual non-tooling candidate after fake fixtures and the required operational authorization. S2 reaches at least three comparable FAST product results in total plus one interrupted DEEP engagement with fresh-session continuation. These small operational samples are not statistical safety proof.

Record owner-active minutes including setup, clarification, recovery, review, application/release and maintenance; avoidable decisions; repeated explanation; actual disposition; evidence gaps; defects; resources with basis; and elapsed time. Include failures. Do not infer savings from mixed historical sessions or model time alone.

Any false completion, containment escape, unauthorized publication or duplicate consequential effect disables the affected automatic capability until its causal fix and fixture pass. Preserve useful results and continue unaffected read-only inspection. If owner benefit fails to appear, reduce the custom surface or choose an external execution workflow; do not use the trial to justify every deferred feature.

No production DB, device, billing reconciliation, Windows isolation or provider behavior was tested by this documentation revision. Those are explicit future qualification/owner observation obligations.
