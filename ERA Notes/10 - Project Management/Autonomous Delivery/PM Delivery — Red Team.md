---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Delivery — Red Team

## 1. Five root causes explain most failures

The evidence register in [Diagnosis](<PM Delivery — Current System Diagnosis.md>) uses D01–D18 below. The proposal is judged against failure behavior, not clean diagrams.

1. **Identity is weaker than intent.** An ordinal, phase label, filename or latest artifact is asked to identify a changing proposition. Fix with stable work identity and immutable contract/candidate/decision revisions.
2. **Effects outrun durable knowledge.** A provider call, file write or remote command can happen before state/usage/receipt persistence. Fix with pre-dispatch attempt/effect records and explicit reconciliation, not blind replay.
3. **Evidence establishes a weaker fact.** Exit zero, changed source and model approval become user-visible completion. Fix with criterion-specific observers and fresh evidence, while admitting semantic limits.
4. **Authority and execution share mutable space.** A capable model or script can alter more than its task and can outlive a lease. Fix with isolation, trusted receipt storage and fenced publication.
5. **Projections hide uncertainty.** Cached UI, latest summary, heartbeat and accepted label flatten different facts into success. Fix with one projection contract preserving freshness, missing observations and unknown outcomes.

These primitives eliminate classes of defects. No primitive eliminates uncertainty about physical devices, external systems or whether a human-written criterion captures the intended product.

## 2. Lifecycle attack and response

“Automatic” below means inside an existing grant with sufficient evidence. Every unresolved effect retains its identity and observation trail. “Owner” names an actual missing decision, not a default approval for routine work.

| Failure family | Prevent / detect | Safe recovery | Owner involvement | Reconstruction and UI obligation |
|---|---|---|---|---|
| Wrong/stale work item; renamed/reordered Markdown | Stable work ID; expected revision; ambiguous import refusal (D01) | Refresh mapping, preserve selected identity | Resolve ambiguous historical aliases only | Original capture, source, mapping and rejected command visible |
| Stale requirements or misunderstood intent | Immutable contract; separate assumptions; material intent check | New linked revision; invalidate dependent grants/proofs | Choose behavior only when materially ambiguous | Show amended outcome, not silent scope drift |
| Wrong repository / dirty tree / wrong files | Source manifest including relevant untracked/config inputs; bounded candidate scope | Rebase candidate by new derived snapshot; recheck | Resolve conflicting owner edits | Base/candidate/destination provenance, drift detail |
| Too little discovery; hallucinated assumption | Required dependency/unknown ledger; falsifiable probes | Target missing evidence; escalate reasoning | Supply unavailable fact | Unsupported assertions remain claims |
| Excess discovery / wrong context / polluted retrieval | Budgeted retrieval and next-probe value; record negative probes | Stop duplicate probes, narrow context, return useful partial | Additional allowance only if warranted | Show last useful finding, not tokens as progress |
| Rotation/model replacement loses understanding | Delivered context manifest + source-bound dossier (D08/D09) | Recompile; replay only unprocessed observation tail | No repeated answered questions | List stale facts and next action |
| Malformed output / partial structured answer | Strict schemas plus semantic invariants; unknown verdict blocks (D05) | One bounded correction or return inconclusive | Usually none | Preserve raw answer and parse diagnostics |
| Partial/unrelated/unauthorized edits | OS isolation; broker scope; frozen generation; whole-diff checks (D04/D16) | Quarantine candidate; keep useful authorized changes separately | Scope enlargement needs grant | No publication of rejected generation |
| Incorrect/no tests; tests prove wrong behavior | Trusted check receipt; nonzero selection; proof-plan review (D04/D05) | Correct observer/fixture; new evidence generation | Missing product oracle may need owner | Distinguish not-run, missing, fail and pass |
| Review fails or cannot conclude | Explicit verdict schema; independent input for selected risk | Probe concrete objection; no vote/loop | Resolve residual product ambiguity | Inconclusive cannot turn into pass |
| Provider interruption / duplicate attempts / retry side effects | Durable attempt ID, provider request IDs, private candidate, reservations (D06/D17) | Reconcile request/effect; retry only known-safe unit | Unknown nonreconcilable external effect | Unknown remains unknown; no fake zero spend |
| Cost or context accounting failure | Typed units/provenance; every paid call recorded (D06–D08/D17) | Stop further dispatch; reconcile raw receipts | Approve new allowance only on known basis | Cost estimate, observed usage and outstanding reserve separate |
| Runaway loops / no progress | Repair/probe/time bounds; repeated-input detection | Pause with last useful state and next discriminating action | Continue/re-scope only if justified | Heartbeat stays separate from progress |
| Crashed runner / stale lock / racing actors | Transactional ownership, fencing epoch, exclusive publication (D10) | Revoke old publication; reconcile before new writer | Manual release only with evidence | Expiry alone never means old process stopped |
| Stale/contradictory/missing artifacts | Immutable hashes + committed manifest references (D11/D18) | Rebuild projection from records; missing evidence blocks completion | Usually none | Display history and current result distinctly |
| Mobile early receipt / ambiguous timeout / duplicate tap | Client command ID before submission; same-ID status query (D12) | Reconcile existing command; never create new grant automatically | None unless original intent changes | Pending/unknown status survives reload |
| Missed deletion / wrong-owner cache / cached old UI | Owner/schema envelope; full-snapshot replacement; cursor gaps (D13) | Clear wrong-owner state, refresh coherent projection | Reauthenticate if necessary | Original age remains visible |
| Capture succeeds but disappears | Stable capture ID; untriaged Work visibility (D14) | Query same capture, preserve pending-triage state | Triage when useful, not to rediscover capture | Receipt opens retrievable item |
| Owner interruption / resume weeks later | Durable revocation, context and checkpoints | Validate source/grant/evidence, reconcile pending effects | Renew expired authority or change intent | Explain exact resume dependency |
| Provider/model unavailable | Capability registry and qualified alternatives | Approved equivalent fallback or pause; keep dossier | New provider/authority/billing basis only | No silent weaker safety contract |
| Malicious repository content / tool misuse | Untrusted context labels; scrubbed environment; egress and filesystem containment | Quarantine attempt, revoke effects, retain audit | Security exception is not auto-approved | Tool-denial and affected scope reported |
| Disk full/corruption / missing backup | Transaction errors fail closed; referenced-blob verification | Restore consistent backup into separate store; validate before activation | Choose recovery point if data is irrecoverable | Missing history is explicit, never invented |

## 3. Highest-consequence attacks on the proposal

### The model edits its own verifier

An engineer can add a test that mirrors a bug, remove assertions or change test selection. A real test receipt then proves only that the modified test passed. Freeze the proof requirements before implementation. Record changes to test sources/config as part of the candidate, run trusted selection/reporting outside model control, and independently inspect a changed oracle. For risky behavior retain a regression witness or adversarial fixture the writer cannot weaken. “Independent” means different evidence access and authority, not another role label.

### A revoked shell keeps running

Broker checks at tool dispatch do not stop an already-started subprocess. Keep it confined to a disposable candidate with no authoritative publication path. Revoke its publication epoch immediately; terminate the descendant process tree. If containment cannot be demonstrated, remain supervised and do not allow host integration. This is a Stage 1 requirement, not later hardening.

### A candidate passes but the actual destination differs

Checking only changed files misses drift in configuration, dependencies and test fixtures. Initially use a conservative complete relevant-input manifest. A candidate's source-only equivalence is not environment equivalence. Destination drift invalidates the affected proof; keep the candidate useful, but recheck before integration/completion claims.

### The database commits but the side effect is unknown

SQLite cannot transact with provider billing, arbitrary scripts, the filesystem and a remote relay. Store intent before dispatch, outcome after observation, and a resolver for the interval. Local idempotent command acceptance is achievable. General exactly-once external execution is not. Unknown non-idempotent effects cannot auto-retry.

### Every uncertainty becomes an owner gate

That would recreate V1 with better vocabulary. The recovery resolver must distinguish software-resolvable uncertainty from missing owner authority or knowledge. Poll an existing command receipt; revalidate hashes; rerun a safe read; regenerate a derived projection. Ask only for a product choice, new scope/resources, authentic observation or an irreducible effect ambiguity.

### The system accumulates a second PM truth

Import/projection must define field ownership. Do not allow generated runtime status in Markdown to compete with the store. Do not hide external prose edits: propose a new contract revision. Keep a direct export/restore path so the database is not an opaque single point of dependence.

## 4. Mandatory adversarial fixtures

These are requirements for future implementation, **not tests run by this study**.

| Fixture | Pass condition |
|---|---|
| Crash before dispatch, after dispatch, after effect, before receipt, after receipt | One reserved identity; actual/unknown effect conserved; no duplicate publication |
| Two controllers issue same command and different commands on same revision | Same-ID returns same receipt; competing revision fails or serializes safely |
| Same command ID reused with another actor/payload; stale phone revokes after ordinary progress | Digest/actor mismatch conflicts; revoke stops only the still-current named authority despite progress, never a successor |
| Old same-kind approval after contract/candidate changes | Rejected as obsolete; no authority granted |
| Expired worker emits a late candidate / still-running child writes | Private output cannot publish; host state unchanged |
| Writer changes verifier or removes selected tests | Proof obligation remains unsatisfied until independent observer validity is established |
| Existing path, arbitrary diff and zero tests attached to behavioral criterion | All rejected as insufficient proof |
| Failed attempt then successful retry; duplicate cumulative SDK reading | Inclusive usage conserved exactly once; unknown reservation not refunded |
| Response lost after successful integration | Destination hashes reconcile prior effect; second write not issued |
| Owner edits a dependency during validation or a postimage during recovery | Stale proof/integration refused; later edit preserved |
| Wrong-owner cache, empty authoritative snapshot, missed DELETE, restarted relay | No cross-owner hydration; absence replaces old rows; durable cursor restores ordering |
| Negative search reused after searched universe changes | Absence claim becomes stale; bounded search may run again |
| Disk full between blob write and metadata commit | No committed false proof; orphan blob harmless; clear resumable failure |

## 5. What remains uncertain even after V2

No tool can mechanically decide every product intent, certify all behaviors from finite tests, prove a physical-phone observation from source, or guarantee future provider availability. The right target is bounded confidence with reconstructable evidence and controlled effects. Large ambiguous work still needs owner decisions. Production database writes remain owner-only under this repository's policy. A cleaner core earns autonomy incrementally; architecture documents do not confer it.
