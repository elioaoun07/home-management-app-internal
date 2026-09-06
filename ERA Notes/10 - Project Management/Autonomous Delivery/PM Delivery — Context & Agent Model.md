---
created: 2026-09-06
updated: 2026-09-06
type: delivery-plan
status: active
owner: Elio
plan_revision: "2.1"
---

# PM Delivery — Context & Agent Model

> **Accepted target design; not implemented or provider-qualified.** The [V2 Architecture](<PM Delivery — V2 Architecture.md>) owns work, contract, grant, run, job and result semantics. This document owns the executor interface, qualification requirements and portable checkpoint. FAST and DEEP DIVE use the same boundary. Build only the stages in the [Execution Portfolio](<PM Delivery — Execution Portfolio.md>).

## 1. Delegate a complete engineering job

The native coding environment owns investigation, file search, planning, editing, ordinary test/fix iterations, its conversation, compaction and permitted internal subagents. ERA supplies the authorized outcome and confined workspace, records the job, handles consequential exceptions and independently verifies the returned candidate. The native engineer cannot publish output or certify the authoritative result.

Keep one useful native conversation across jobs when safe. A **Job** is one authorized native start, paid resume, repair or separate review dispatch; it is not one model request or tool call. A paid resume receives a new `job_id` even when its `executionRef` continues the same native session. Read-only inspection/reconnection does not create a new paid job. Native continuation never resets the run's allowance or revives a revoked grant.

| Responsibility | Owner | Consequence |
|---|---|---|
| Search, edit, plan, ordinary tests and repair | Native engineer | No ERA phase machine or per-tool effect journal inside disposable scratch scope |
| Conversation, compaction, context selection and subagents | Native environment | No ERA context rotation threshold, second prompt compiler or universal subagent scheduler |
| Contract, grant, job admission, native pointer and decisions | ERA supervisor | Native messages and repository text cannot enlarge authority |
| Candidate identity, protected observations and acceptance | Supervisor and protected verifier | Agent claims and its own test output are inputs, not certification |
| Applying changes or publishing a release | Separate authorized mechanism | A native job has no release credentials or host-workspace write authority |

Internal native agents are allowed only if their tools, effects and aggregate consumption fit the qualified job boundary. ERA does not model them as a fleet. A separate review job is useful only when independent challenge can change acceptance.

The [diagnosis D08/D09/D17](<PM Delivery — Current System Diagnosis.md>) records why V1's context rotation, unpopulated memory fields and unaccounted preflights cannot be copied as guarantees. Preserve raw history and useful continuation, not those mechanisms.

## 2. One executor first; qualification before promises

Start by qualifying **Codex exec/SDK on the actual Windows execution environment**, because the accepted reassessment found documented native Windows containment and automation interfaces. This is a candidate selection, not a proven security profile or coder-quality ranking. Prefer a qualified managed executor instead if it meets the same contract with lower total owner effort. Do not build both adapters to start.

The following are dated documentation findings from the [accepted reassessment](<../../../docs/ASTRA-Ideas.MD#point-2-reassessment>), not conformance results from this plan refactor:

| Environment | Existing capability | Limitation that must remain explicit |
|---|---|---|
| Codex exec/SDK | Headless execution, structured responses, events and resumable sessions. [Automation](https://learn.chatgpt.com/docs/non-interactive-mode), [SDK](https://learn.chatgpt.com/docs/codex-sdk) | These interfaces do not establish a total dollar ceiling or complete secrecy boundary for ERA's configured job. |
| Codex native Windows sandbox | Documented Windows containment support. [Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox) | Installed mode, host reads, environment, connectors, network and descendants still need fixtures. A sandbox setting alone is not qualification. |
| Claude Code / Agent SDK | Coding tools, sessions, hooks and native subagents. [Sessions](https://code.claude.com/docs/en/agent-sdk/sessions), [hooks](https://code.claude.com/docs/en/agent-sdk/hooks) | A session/fork does not isolate files. Its Bash sandbox supports macOS/Linux/WSL2, not native Windows; an appropriate additional execution environment is required here. [Sandboxing](https://code.claude.com/docs/en/sandboxing) |
| Claude Managed Agents | Persistent asynchronous execution and managed environments; beta in the reviewed documentation. [Overview](https://platform.claude.com/docs/en/managed-agents/overview) | Account access, environment fit and operation were not tested. Shared-session budget thresholds can be exceeded by an in-flight request per thread; separate sessions need aggregate admission. [Budgets](https://platform.claude.com/docs/en/managed-agents/budgets) |

A richer bidirectional native protocol is not an initial dependency. Persist a task-level exception, accept the owner's answer against its exact revision, then resume. Do not build a live tool-approval proxy unless an observed owner need requires it. The reviewed Codex app-server warning concerns its direct remote command/WebSocket integration; do not generalize that warning to every SDK using the protocol underneath. Recheck the exact chosen interface/version at qualification. [App-server](https://learn.chatgpt.com/docs/app-server).

No model names, subscription assumptions or provider parity promises belong in a work contract. The grant names a qualified executor profile and permitted resource policy. An equivalent backend may be added later after the required fixtures pass; an unavailable provider does not authorize weaker containment or an unknown billing basis.

## 3. Minimal executor interface

Implement these six operations for one backend. They expose job boundaries, not a common representation of every native event.

| Operation | Input and output | Required behavior |
|---|---|---|
| `describeProfile()` | Pinned runtime/SDK/model configuration, OS/isolation configuration, tools, limits, usage semantics and qualification reference | Report unsupported/unknown controls explicitly; no inferred parity |
| `start(JobRequest)` | Authorized request with persisted `executionRef` → filled native reference, status and raw observations | Persist supervisor dispatch identity before invocation; capture native identity as soon as available |
| `inspect(executionRef)` | Correlation/native reference → observed liveness/status, available usage and artifact pointers | Read-only; reconcile by dispatch key only when the profile supports it; otherwise uncertainty stays explicit |
| `resume(executionRef, JobRequest)` | Existing reference plus newly admitted request → current execution reference/status | New reservation, current authority and source check; no reset of item allowance |
| `stop(executionRef)` | Native reference → stop request/confirmation observations | Distinguish requested, locally stopped and provider-confirmed status; late cost/results remain attributable |
| `exportCandidate(executionRef)` | Native output → candidate material and native-record pointers | Supervisor freezes and hashes actual bytes; a worker-supplied digest is not candidate identity |

`JobRequest` carries `job_id`, `run_id`, exact contract and grant revisions, input manifest, optional checkpoint reference, confined workspace reference, resource reservation, native limits and `executionRef`. The supervisor supplies these fields. The adapter never derives authorization from the model's response.

Canonical `executionRef` is `{ backend_id, dispatch_key: job_id, native_ref? }`. Persist it locally before dispatch; fill `native_ref` when the executor reports its native session/job identity. `describeProfile()` states whether `inspect` can reconcile by `dispatch_key` before that native identity is known. If unsupported, a lost launch response remains unknown. Absence of `native_ref` is never proof that a job was not dispatched. The supervisor commits `dispatch_started_at` immediately before the external call; recovery treats any such marked job as potentially dispatched even if the call may never have left the process.

For `resume`, the first reference identifies the existing session; `JobRequest.executionRef` contains the new job's dispatch key and may retain the same `native_ref`. Keep the prior job's reference immutable. The profile declares how native status and cumulative usage are attributed across these dispatches; a shared session ID cannot silently merge their reservations or replay a resume.

Retain raw status and usage before parsing an optional structured engineering response. Missing or malformed optional prose needs no new paid call when the actual candidate and trusted receipts establish the result. Only necessary missing information creates an obligation; malformed text cannot erase consumption, duplicate a launch, establish acceptance or discard an available candidate. A job may finish natively while its run waits for evidence or the selected item awaits application/release.

`exportCandidate` also serves research jobs: it returns report material and source/evidence references for a trusted `Candidate.kind=research` snapshot. A code diff is not required for research; protected evaluation still checks the requested claims and disposition.

The profile records the exact effective tools, permission mode, filesystem read/write scope, environment allowlist, network destinations, connectors, descendant-process controls, stop semantics, resource unit/limit scope and evidence for each control. Pin the tested runtime/configuration identity. A changed isolation, permission, tool or accounting configuration invalidates the affected qualification until its fixture passes again.

## 4. Bounded qualification fixtures

Use disposable source trees, synthetic canaries and test endpoints. No production credentials, real household data, paid live work or external writes are necessary for the initial fake-adapter contract fixtures. Installed-executor probes and any paid qualification run require the stage's recorded authority and allowance. A fixture result records profile/configuration hash, stimulus, observed result, artifact references and unresolved limitations.

| Fixture family / case | Required observation | If it fails or cannot be observed |
|---|---|---|
| **F-ISOLATION — Filesystem** | Allowed scratch edits work; worker and descendants cannot read/write synthetic host-private files, protected policy/result storage or unapproved paths; traversal, links and Windows reparse points cannot escape | Profile ineligible; choose a real OS/platform boundary or narrower execution mode |
| **F-ISOLATION — Credentials and external access** | Tool processes cannot read harness/provider secrets or inherited host-secret canaries; unapproved network/connector operations are denied, including from package scripts and descendants | Profile ineligible for confidential/unattended work; a shell denylist or later diff rejection is insufficient |
| **F-JOB / F-AUTH — Launch and stop ambiguity** | Lost launch acknowledgment can be reconciled by persisted identity where supported; stop acknowledgment loss retains uncertainty; late results cannot publish after revocation | Hold the job/reservation and expose recovery; never fabricate exactly-once launch or confirmed stop |
| **F-COST — Resource scope** | Enforcement covers the promised whole native job, including inner retries, permitted subagents, compaction and paid tools; in-flight margin and excluded charges are recorded | Reject a strict-cap request unless a justified maximum exists; only an explicitly authorized threshold profile may proceed |
| **F-JOB / F-EVIDENCE — Output integrity** | Malformed structured output preserves raw usage/native records; changed or missing exported bytes cannot retain old candidate identity | Block acceptance on an actual integrity/evidence gap; optional malformed prose alone does not force another paid job or partial result |
| **F-AUTH / F-RESUME — Resume authority** | Expired/revoked grant, exhausted allowance or incompatible contract/source revision prevents paid resume; valid same-session resume gets a fresh job ID/reservation | Block dispatch; native session existence is not authority |
| **F-RESUME — Portable continuation** | After forced interruption, a successor gets the current contract, decisions, valid checkpoint/candidate and unresolved obligation without owner re-explanation | Correct checkpoint/export before extending the pilot; no promise of zero repeated investigation |

The coding harness must authenticate without exposing credentials to arbitrary candidate tools. If the chosen local profile cannot separate those privileges, add a suitable execution environment or reject that profile. Hiding files from the launch bundle does not prove they are inaccessible. The protected verifier also runs candidate code under confinement and keeps authoritative policy/receipts outside candidate write authority.

Qualification concerns the exact promise. Lack of native launch reconciliation does not force a new runtime if honest `WAITING` recovery is acceptable; lack of confidentiality cannot be repaired by a label after private files were exposed. The [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>) admission rules decide which work can use the profile.

## 5. Launch input and one portable checkpoint

The launch bundle contains the immutable contract and current grant, required repository/domain policy, identified source/workspace inputs, binding owner decisions, required evidence and any valid checkpoint. Use the existing Feature Map and vault rather than constructing a second knowledge base. Let the native environment retrieve source detail and manage its context.

ERA hashes and retains **what it actually supplies at launch/resume**. A supplied path list proves paths were supplied, not that native tools read them or the provider retained their contents. Preserve native telemetry when available; ERA does not reconstruct every inner request, retrieved span, cache event or resident context window.

The **Checkpoint** is a compact portable handoff, not a mandatory seven-part dossier or transcript summary. Its canonical logical fields are:

| Field | Meaning / producer |
|---|---|
| `checkpoint_id`, `run_id`, `contract_revision`, `created_at` | Supervisor-bound identity and time |
| `source_manifest_ref`, optional `candidate_ref` | Identified inputs and current frozen candidate, checked by the supervisor |
| `decision_refs[]` | Binding owner decisions from authoritative records, never reconstructed from model prose |
| `findings[]` | Only consequential established findings or rejected approaches; each has `statement`, `source_refs` and optional `reconsider_when` |
| `remaining[]` | Open criterion/question references with `next_action` and `resolver`, including missing external observations |
| `native_record_refs[]` | Native session/job/transcript/artifact pointers available for reconstruction |
| `next_action` | Next useful engineering action, subordinate to current grant and admission |

The engineer may draft findings and the next action. They remain assertions with provenance; the supervisor binds references and authority, not their scientific truth. Include a hypothesis or negative search only when it prevents meaningful repeated work, with its scope and uncertainty. Do not store every hypothesis, search, edit or hidden reasoning trace.

Produce a checkpoint at candidate handoff, a task-level wait or planned pause, and before deliberate native replacement when possible. Reuse unchanged fields and linked artifacts. Do not force a paid summarizer after each turn or probe. A crash may precede the next checkpoint: recover from the last valid checkpoint, native records and inspected candidate; retain any unreconciled tail. The promise is recoverability with bounded repeated work, not preservation of every thought.

## 6. Resume and replacement procedure

1. Load the persisted run/job identity and native reference. Inspect/reconcile the existing job before dispatching another. A missing acknowledgment keeps the reservation outstanding.
2. Revalidate the current contract revision, grant revocation/expiry, qualification, relevant source identity and remaining allowance. Apply the same admission to native resume, a repair, a successor engineer or a separate reviewer.
3. Prefer native continuation when usable. Supply changed binding decisions and unresolved obligations; allow native compaction and context management to operate.
4. If replacement is necessary, isolate its scratch state from any possibly live predecessor and hand it the portable checkpoint plus verified candidate/input references. Reconcile the prior job's resources independently. Never share a mutable candidate directory with an uncertain old writer.
5. Recheck source-bound findings and conservatively invalidate affected evidence when inputs change. The successor may investigate uncertainty; it cannot silently modify the agreed outcome or revive old authorization.
6. Record the candidate, checkpoint and native pointers returned by the new job. Protected verification and requested disposition determine what remains; the engineer's “done” message does not close the product item.

Cancellation removes publication authority immediately at the supervisor. Show execution as stopped only to the extent confirmed by the executor; an exited local process does not prove a remote request incurred no further cost. Reconnection is inspection, not automatic relaunch. A sleeping local runner is unavailable; portable context does not make it always-on.

## 7. Reasoning, review and resource accounting

FAST and DEEP DIVE differ in uncertainty, permitted effort and evidence, not adapters or context architecture. Preserve a useful conversation instead of switching models every activity. Escalate within an existing grant when repeated misunderstanding or a consequential unresolved issue justifies the cost. A new permission/resource profile requires the corresponding decision; more reasoning never grants broader effects.

| Role | When useful | Authority |
|---|---|---|
| Native engineer | Default for both modes; ordinary investigation/edit/test/fix loop | Confined scratch work within job allowance |
| Protected checker | Whenever a requested claim needs observation | Runs approved checks and records receipts; acceptance follows evidence rules |
| Fresh challenger | A specific high-consequence or ambiguous claim merits independent challenge | Separate admitted job, read-only relevant source/candidate/evidence, falsifiable findings; cannot accept or publish |

A second model is not proof. Give a challenger the contract and relevant source/evidence before the engineer's success narrative; resolve disagreement through an observation or named evidence gap. Native bounded investigators may help engineering without becoming ERA-maintained roles. Do not introduce mandatory architect, reviewer, UAT-author or report-writer calls.

Aggregate resources at the item/run boundary across all jobs, repairs, reviews and unresolved attempts. Prefer verified native session readings over reconstructing prices from transcript rows. Record raw reading scope and normalize cumulative counters only within a verified session/segment; a reset is not a refund. Native/provider changes never reset the total allowance.

Keep these quantities separate:

- **Reconciled billed cost**, provider-reported/list cost, estimated API-equivalent cost and subscription consumption have different provenance. Unknown outstanding spend remains explicit; they are not one invoice.
- **Processed input/output/cache traffic** is throughput, not resident context. Ten requests of 30K input do not establish 300K concurrent context occupancy.
- **Native turn/token/time limits** bound their stated units. They are not automatically dollar limits. Context/cache telemetry is descriptive; ERA does not rotate the conversation from it.

A strict item ceiling requires a justified maximum for every admitted whole job plus known in-flight margin and other charges. If the backend cannot bound the complete job, do not reserve one request and call the remaining inner loop free. Choose a qualified alternative, an explicitly authorized softer threshold, a genuinely enforceable finer boundary if its added complexity is justified, or wait. The supervisor cannot manufacture a billing guarantee the executor lacks.

Prefer non-generative authentication checks. Any paid preflight or diagnostic gets a reservation before dispatch. Preserve usage before output interpretation and retain unresolved reservations after crashes. Claude SDK cost reports have client/session semantics rather than independent invoice authority; managed budget thresholds have documented in-flight overshoot. [Claude cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking), [Managed budgets](https://platform.claude.com/docs/en/managed-agents/budgets).

## 8. Implementation boundary

Stage S1 implements one adapter, one launch/resume bundle, the checkpoint shape and protected candidate export. Stage S2 demonstrates interruption, valid native continuation, replacement and honest resource/stop recovery on real bounded work. Use the existing fake-driver testing style for boundary faults; installed-profile fixtures establish actual native controls.

Do not build inner context reconstruction, automatic context rotation, periodic summaries, a graph/vector memory service, a generic investigation schema, a subagent scheduler, multi-provider parity, automatic provider switching or cost forecasting from the mixed V1 history. A later proposal must name an observed delivery failure or owner burden that native execution and the checkpoint cannot address, plus the smaller alternatives tried.

The success measure is less total owner work to reach a verified requested outcome, including setup, repeated explanation, decisions, recovery, review, release and maintaining the supervisor. If native delivery or a managed service meets the same contract with less effort, keep the contract/checkpoint/result boundaries and remove redundant local machinery.
