---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Delivery — Evidence & Autonomy

## 1. Four things the system must not confuse

**Claim:** an assertion about what changed or works. **Evidence:** an attributed observation with inputs, method and result. **Proof:** evidence accepted for a specific proposition under a declared verification rule. **Owner decision:** a recorded choice, authorization, waiver or observation, with its exact subject.

“Proof” here is operational and bounded, not mathematical certainty or a promise that no undiscovered defect exists. An owner can accept a result with a limitation; the system must not rename that limitation verified. A model's confidence score is not a substitute for any of these records.

## 2. Establish the proposition before implementation

Each criterion has stable ID and revision, proposition, scope/environment, required observer type, expected result, forbidden weaker substitutes, fixture/oracle origin and freshness dependencies. Risk and known failure modes determine the strength of the observer. The plan is reviewed for semantic adequacy when ambiguous; schemas alone cannot prove the test tests the right thing.

Illustrative structured contract:

```json
{
  "criterionId": "AC-2",
  "revision": 1,
  "proposition": "Replaying one synthetic capture twice creates one effect",
  "scope": "isolated integration fixture",
  "observer": "integration-test",
  "requiredCases": ["duplicate replay", "response lost after commit"],
  "rejectSubstitutes": ["file exists", "unit test of UUID creation"],
  "freshness": ["candidate", "fixture", "test selection", "toolchain"]
}
```

This does not certify production behavior. A separate deployment/device criterion would require a separate observer. Keep criteria small enough to distinguish source change, local behavior and external outcome.

## 3. Proposition-to-observer matrix

| Claim class | Eligible evidence | Insufficient alone |
|---|---|---|
| Exact source transformation | Base/candidate hashes; exact full diff; no surplus change witness | Declaration appears somewhere in diff |
| Compile/type correctness | Executed compiler receipt on identified candidate/config/toolchain | Changed TS file; model says typecheck passed |
| Unit behavior | Named executed tests/assertions and relevant fixtures | Exit zero with zero tests; test filename |
| Integration behavior | Isolated integration trace with effect/storage assertions and fault cases | Mock only returning expected status |
| UI interaction | Mounted component/browser actions and observable state at identified build | Screenshot alone; source event handler exists |
| Visual state | Screenshot with viewport, build, theme and scenario | Backend correctness or persistence inferred from appearance |
| Browser/offline behavior | Browser storage/network/reload sequence and result | Unit-only queue test |
| Physical-device behavior | Owner/tester observation from named device/build/scenario | Desktop emulation or emitted push ID |
| Migration correctness | Reviewed exact SQL; isolated compatible schema test; owner-applied verification if live outcome required | SQL file exists; repo schema claims installed state |
| External-system effect | Authorized observer's result/receipt for exact external object/version | Local request sent; timeout or optimistic UI |
| Owner acceptance | Decision linked to reviewed candidate/evidence | Automatic PM checkbox or positive review text |

The checker records command argv, execution directory, environment/config identity, start/end, exit/signal, selected/executed/skipped counts, output hashes and scope. Trusted adapters create these receipts. Models may suggest checks but cannot mint receipts. A deliberately test-free exact edit can use a valid structural observer; it is not forced to run a meaningless test just to reach a nonzero count.

## 4. Satisfaction and freshness

Per-criterion state is `missing`, `satisfied`, `failed`, `inconclusive`, `stale`, or `waived`. A zero-test behavioral observer is missing, not satisfied. A malformed review is inconclusive. Missing artifacts or source drift invalidate dependent proof. A waiver names actor, criterion revision, reason and candidate; it never becomes satisfied and is excluded from automatic verified-completion policy.

Evidence binds contract revision, frozen candidate manifest, observer/config/fixture version, environment and raw result. Start conservatively: any relevant input change marks affected checks stale. Do not permit the writer to choose an unrealistically narrow dependency set merely to keep tests green.

Tests authored during implementation are useful but correlated. A trusted proof plan, held regression witness, independent semantic review or additional observer addresses that correlation when consequence warrants it. More model votes do not establish an external observation.

## 5. Safe autonomy is a capability, not a single rating

Use four operational profiles. These describe proposed admission, not current deployed labels.

| Profile | Qualifying work / write scope | Mechanical guarantees and evidence | Owner role / acceptable uncertainty |
|---|---|---|---|
| **Assist** | Investigation and proposed patch; no automatic host integration | Attributed source/probe evidence; no completion certification | Owner directs consequential steps and verifies result; unresolved hypotheses allowed |
| **Bounded execution** | Contract-scoped isolated candidate | Identity, qualified containment, attempt/usage records, bounded recovery; basic proof plan | Owner authorizes scope, reviews evidence and resolves missing observations |
| **Verified handoff** | Supported FAST or DEEP candidate within grant | All required machine criteria satisfied, independent challenge when required, replay/crash fixtures passed | Owner receives candidate/UAT package; external/device obligations remain explicit |
| **Policy completion** | Repeated low-risk class with complete eligible proof, no waiver, qualified integration if requested | Same guarantees plus proven freshness/integration recovery and preauthorized disposition | No routine intermediate decision; notification on completion; no unobserved required criterion |

Maximum safe current V1 posture: **supervised bounded assistance/execution with independent owner verification**, not certified Verified handoff or Policy completion. The current source demonstrates acceptance, accounting and isolation gaps; therefore even existing unattended settings do not establish those profiles. This is a limit on justified confidence, not an assertion that V1 cannot produce useful code.

Realistic V2 target: Policy completion for a growing set of low-risk **local** changes, and Verified handoff for harder work. Broad autonomous production delivery is neither demonstrated nor necessary. No-git-write, no-worktree and no-production-DB-write rules remain; owner shipping/deployment is distinct. A successful local candidate can complete its contract without claiming release.

Autonomy eligibility is the intersection of work risk, permission grant, observer coverage, adapter qualification, source freshness and recoverability. A cheaper model, FAST label or phone approval never independently increases it.

## 6. Recovery contract

| Interruption point | Durable minimum | Recovery action |
|---|---|---|
| Before provider dispatch | Reserved attempt, input manifest, grant, resources | If provably undispatched, dispatch once; otherwise reconcile |
| Provider response lost | Request/segment identity, partial observations, outstanding reserve | Query/reconcile when supported; retain unknown usage/effect otherwise |
| Partial candidate edits | Private candidate generation and tool/effect trail | Inspect actual bytes; quarantine/rebuild; no shared workspace rollback |
| Check process crashes | Candidate/check identities, partial output, signal/process status | Mark not completed; rerun safe check if grant allows |
| Integration partly writes | Per-file preimage/postimage journal and current fence | Reconcile hashes; finish or guarded restore; preserve later owner edits |
| Runner dies or loses lease | Epoch, attempt/effect records, process identity | Revoke publication; terminate or contain old process before replacement |
| Model replaced | Dossier, input manifest, pending effects and evidence | Compile fresh context; revalidate stale premises; continue next obligation |
| Resume days later | All above plus environment and contract revisions | Verify fresh authority and inputs; linked successor if meaning changed |

Recovery happens before another potentially duplicate effect. Derived projections may be regenerated; paid calls and file effects are never “replayed” merely to recreate history. A remote command timeout reuses the same ID for status queries. An unknown provider cost remains reserved. If no safe reconciliation exists, return a precise unresolved effect instead of a broad retry button.

## 7. Retry policy by effect

Safe reads and deterministic checks against immutable input can retry within allowance. Generation may retry when cost is recorded and outputs are confined/discardable. Candidate edits recover by inspecting the actual private generation, not repeating an entire turn blindly. Integration retries only the identified journaled effect after pre/postimage reconciliation.

Never automatically retry an unknown external non-idempotent action, an unqualified provider's partially completed tool sequence against shared state, a changed contract, expired authority, or a production DB write. Changes to write scope or resources are new grants, not retry options.

## 8. Completion and resumption package

Every result—verified, partial, failed, cancelled—exports the same compact manifest: work/contract identity; grant and decisions; base/candidate/integration identity; attempt and inclusive usage ledger; per-criterion status and evidence; unresolved effects/observations; useful changes; safe next action; recovery references. Raw observations remain linked, with explicit redaction/truncation metadata.

One evaluator supplies desktop, phone, export and continuation eligibility. Read paths expose stale packages without repairing them silently. Acceptance records what the owner saw. The canonical result cannot be greener than its weakest required unresolved obligation.

This answers the eight recovery questions in the brief: attempted work, authority, actual execution, changes, cost basis, evidence, uncertainty and next action. A fresh engineer can continue from facts rather than trusting “done.”

## 9. Pilot thresholds for enabling autonomy

Suggested initial operational gates, not statistical safety proofs: all adversarial fixtures relevant to a profile pass; at least three non-tooling FAST product candidates complete with no false-proof/authority incident; one forced-crash recovery preserves effects and cost; one multi-session DEEP engagement resumes with a replacement model; phone commands survive dropped acknowledgment and stale decision fixtures. Required device/live observations are supplied by the owner.

Any false completion, escaped authorized scope or duplicated consequential effect immediately disables the affected automatic profile until its causal fix and regression witness pass. Continue safe inspection and unrelated supported work. Do not erase failed runs from the comparison denominator.
