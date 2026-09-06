---
created: 2026-09-06
updated: 2026-09-06
type: delivery-plan
status: active
owner: Elio
plan_revision: "2.1"
---

# PM Delivery — Red Team

> Challenge of the integrated revision 2.1 target. [Diagnosis](<PM Delivery — Current System Diagnosis.md>) retains the source/historical D01–D18 evidence; [Architecture](<PM Delivery — V2 Architecture.md>) defines V2-I01–I10; [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>) defines the canonical F-* fixtures. This file adds no second runtime or fixture vocabulary.

## 1. The principal risk has changed

The smaller target removes some failure-sensitive orchestration, but delegation alone does not establish trust. The model can still misunderstand the item, the sandbox can expose host resources, a lost launch can cost money, checks can prove too little, and a candidate can be mistaken for a release.

The design is sound only if the native job is confined and the supervisor keeps authority, evidence and disposition outside the writer's control. These boundaries carry the guarantees. Internal tool histories stay native unless a particular unsupported guarantee requires finer control.

## 2. Challenge the chosen boundary

| Challenge | Required design response | Witness / stage |
|---|---|---|
| The selected row moved, or the alias identifies two records | Resolve exact WorkRef/source fingerprint; refuse ambiguity. No full backlog migration is necessary to avoid launching another item. | D01; F-ID in S0/S1 |
| The agent decides that a simpler result counts as success | Preserve immutable requested outcome/disposition; material amendments require an exact decision and successor Contract. | D03; F-AUTH/F-RESULT in S1 |
| The “isolated” directory can read host secrets or call installed connectors | Qualify read/write/environment/network/connector/descendant boundaries using synthetic canaries. Exclude undeclared access, not only host writes. | D16/D17; F-ISOLATION in S1 |
| A job has a per-request cap but can issue unlimited requests | Require enforceable whole-job coverage plus in-flight margin for a strict profile, or decline it. Use finer dispatch only where a demonstrated capability gap warrants it. | D06/D07; F-COST in S1 |
| Start succeeded but its acknowledgment was lost | Persist dispatch-key correlation and marker; inspect the existing job where supported. Otherwise hold unknown/reservation rather than launch twice. | D10/D12; F-JOB in S1/S2 |
| Stop returned but a child or remote request continues | Revoke publication/future dispatch immediately. Keep stop uncertainty and charges visible; verify stopping or independent containment before overlapping work. | D16; F-JOB/F-ISOLATION in S1/S2 |
| The worker returns malformed optional prose after completing the task | Derive Result from frozen candidate and trusted receipts. Do not reproduce the historical wrapper crashes as a new mandatory repair gate. Required missing information alone creates an obligation. | D05/D11; F-RESULT in S1/S2 |
| A test run selects nothing, or a filename is treated as behavior | Use criterion-specific observers; missing evidence remains missing. A structural edit may use structural proof only when that matches intent. | D04/D05; F-EVIDENCE in S1 |
| The writer weakens tests, test selection or the verifier | Protect trusted observer/configuration; inspect changed oracles independently. Safeguard changes are authorized under the prior trusted version. | D04; F-EVIDENCE/F-AUTH in S1; expanded S2 |
| The candidate changes while checks run | Quiesce and snapshot through trusted import; check an immutable generation. Relevant changes stale its evidence. | D04/D16; F-EVIDENCE in S1/S2 |
| Native continuation forgets decisions or revives expired permissions | Revalidate current grant/source/allowance, preserve concise Checkpoint and evidence. Native memory is an optimization, not authority. | D08/D09; F-RESUME in S2 |
| A checked patch is reported as a fixed deployed feature | Keep requested and observed disposition separate. Owner application/release/device obligations remain open. | D11/D18; F-RESULT/F-PUBLISH from S1 |
| A stale phone grants new authority or a cached record looks current | Authenticate full command/installation/target; same-ID reconciliation; source generation and owner-scoped authoritative replacement. Remote grants stay disabled until qualified. | D12/D13; F-COMMAND local S1, remote S3 |
| The store says done but its artifact or projection is missing | Commit references only after verified artifact publication; fail dependent evidence on missing blobs. Projection failure is separate, retryable and cannot rerun engineering. | D10/D11/D18; F-RESULT in S1/S2 |
| A stale V1 client starts a writer after V2 is enabled | Drain V1 and use one installation/service dispatch choice, enforced server-side for every write-capable entry point. Preserve read-only legacy history. | D10; F-AUTH/F-JOB in S1 |
| The new platform costs more owner effort than ordinary native delivery | Include setup, recovery, review, release and maintenance in the comparison. Stop expanding the supervisor if benefit is absent. | Historical mixed cohort; comparative S0/S2 evidence |

## 3. What complexity can be removed safely?

**Inner edit recovery:** ordinary changes inside authorized disposable scratch can be inspected or discarded. ERA does not need to journal every edit. This is valid only while the job lacks consequential external authority. Granting such authority would change the recovery requirement.

**Context machinery:** native sessions handle their own context and compaction. The supervisor retains binding decisions and a portable Checkpoint at meaningful boundaries. It need not track every negative search or manufacture a resident-context estimate from token throughput.

**Mandatory reviewer phases:** protected deterministic checks settle many bounded claims. Independent semantic challenge is selected for ambiguity/consequence; a model reviewer cannot replace an absent device observation or a malformed evidence record.

**Full PM adoption:** a selected item's stable mapping and immutable snapshot can coexist with Markdown intent. A separate database is justified for asynchronous job facts, not as an excuse to move all PM lifecycle authority.

**Mobile infrastructure:** current result viewing can be retained while remote grants remain unavailable. Authentication, receipt reconciliation and owner-bound state are required when that capability is implemented; a new mobile application/key system is not a prerequisite for local delivery.

**Host integration:** initially prepare the exact candidate and its remaining owner action. Later evaluate an established publication path under amended policy. Building a concurrent multi-file host writer is a separate investment, not hidden inside “apply patch.”

## 4. Where simplification would go too far

Do not reduce the supervisor to an agent launcher that trusts final prose, a cost gauge or a green exit code. It still needs durable job identity, actual confinement, resource admission, protected evidence and truthful disposition.

Do not declare strict budgets from an estimate. Do not treat a job timeout as proof it did not execute. Do not call a process stopped because publication was revoked. Do not regard a signed receipt as semantically adequate evidence. Do not count a failed or inconclusive required criterion as a waiver the model can grant itself.

The no-production-DB rule is not solved by a more capable agent. Required live observations still come from permitted owner procedures. No speculative code rewrite can replace missing RLS/device evidence.

## 5. Avoid owner gates created by the implementation

Software should reconcile command receipts, inspect known native jobs, verify source/artifact identity, rerun authorized safe checks and regenerate projections. Routine native test/fix work remains inside the job allowance.

Owner attention is justified for new intent, authority/resources, required unavailable observations, or a genuinely irreconcilable consequential effect. A parse error in optional prose or a change of activity label is not a new owner decision. Default Deliver uses established policy; no forced model, lane, agent-team or autonomy-level selection.

Store the exact decision and evidence seen once. After reconnection or resume, show that decision's current status; do not ask the same question again because the native conversation changed.

## 6. Qualification and rollout consequences

S1 must establish F-ID, F-AUTH, F-ISOLATION, F-JOB, F-COST, basic F-EVIDENCE/F-RESULT and local F-COMMAND before a real pilot uses the corresponding authority. A minimal restart/lost-dispatch witness is part of the first useful path. S2 broadens crash/restore/resume and real behavioral evidence before unattended cutover. S3 qualifies optional remote access and publication; unsupported extensions remain absent.

A first native backend is chosen by demonstrated contract fit, not brand preference. If a managed platform supplies the necessary native durability/limits with less effort, use it. If an executor cannot meet a mandatory bound, decline that profile or make the concrete environment/control change necessary; never silently weaken it.

A false completion, unauthorized effect or containment escape disables the affected automatic capability until causal repair and regression evidence exist. Store failure history. A small successful pilot supports operational learning; it cannot establish a universal safety rate.

## 7. Residual limits

Finite tests cannot decide every product intention, prove every device behavior or guarantee provider availability. A local runner may be asleep. A private candidate may require an owner application step under current policy. A native request may remain billable after cancellation. An unsupported exact monetary cap may prevent launch.

Those limits must appear as explicit eligibility or result obligations. The target is a system the owner can leave alone within known boundaries, with trustworthy evidence and useful recovery when a boundary is reached.
