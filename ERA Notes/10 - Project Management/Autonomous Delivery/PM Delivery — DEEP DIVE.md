---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Delivery — DEEP DIVE

## 1. A durable engineering engagement

DEEP DIVE resolves uncertainty and implements a defensible change. It uses the same contract, effect and evidence kernel as FAST. Its additional machinery is a durable investigation record, deliberate probes, architectural alternatives and selective independent challenge. It is not FAST with a larger token cap or more mandatory phases.

An investigation may be authorized before implementation scope is known. Its grant is read/probe-only against approved inputs, with a resource allowance and a concrete research question. Implementation authority follows a sufficiently understood contract. Useful investigation can close as a research result without pretending software shipped.

## 2. Investigation protocol

1. Record observed symptom, source/owner evidence, current environment and unknowns. Separate observation from hypothesis.
2. Build a small hypothesis set. Name the cheapest discriminating probe and the outcome that would weaken each hypothesis.
3. Run safe probes and retain observations, including failed or negative results. Stop repeating an identical probe against identical inputs.
4. Follow newly discovered dependencies when they can change the decision; record why expanded context matters.
5. Compare plausible designs using correctness, recovery, owner effort, implementation cost and deletion opportunities. Reuse a strong primitive when it solves the problem.
6. Draft the bounded implementation contract and evidence plan. Obtain owner decisions only for unresolved product meaning, consequential authority or resources beyond the grant.

Stop investigation when the selected change has an adequate causal explanation, known affected boundaries, an executable proof plan and no unresolved high-consequence assumption. If these remain missing after the allowance, return a partial result with the next discriminating action. Document length is not the exit condition.

The [Context & Agent Model](<PM Delivery — Context & Agent Model.md>) supplies records for source facts, rejected hypotheses, decisions and resumption. Native conversation continuity is valuable but never the only copy of these facts.

## 3. Complete journey: duplicate or lost offline capture

Illustrative product case, not an executed task: the owner reports, “Sometimes retrying an offline capture duplicates it; after restarting, another one disappeared.” It crosses local persistence, replay, API identity and displayed outcome. Domain documentation and production-data restrictions still govern.

| Stage | Owner action | Engineer/system action | Evidence and uncertainty |
|---|---|---|---|
| Intake | Describes incidents and intended behavior | Authorize bounded investigation; record unknown reproduction conditions | Owner recollection is attributed, not converted to an execution trace |
| Orient | None | Map local capture → durable store → replay → server result → UI; read relevant domain rules | Source manifest and dependency map; no production probing |
| Probe | None | Use synthetic fixtures for reload-before-commit, response loss and duplicate replay | Distinct hypotheses: nondurable local write versus repeated external effect |
| Decision | Clarifies whether an ambiguous past capture should wait or ask, if contract lacks this | Present consequences with current evidence | Decision linked to a contract revision, not buried in chat |
| Design | Approves bounded implementation authority if needed | Compare minimal existing-queue repair against a new identity boundary | Exact once-only claim is scoped to the effect and tested failure windows |
| Implement | Can leave | One writer builds candidate; focused read-only investigator may check the server contract independently | No parallel edits; all attempts and costs recorded |
| Verify | Supplies external/device observation only where required | Run clean reproduction, regression, replay and failure-injection checks; fresh reviewer challenges proof sufficiency | Synthetic tests cannot prove current production RLS or installed-device behavior |
| Result | Reviews remaining observation or accepts candidate | Present established facts, candidate identity, limits and integration action | A pending owner-applied DB migration prevents a claim of completed deployed behavior |

If the correct fix requires a production database change, produce the exact manual migration/runbook under repository rules, then conclude or wait on that explicit owner dependency. The agent never applies it. The absence of live DB evidence must not trigger speculative route edits.

## 4. Surviving a multi-session engagement

**Long reasoning:** checkpoint when a probe changes the hypothesis, a decision changes the contract, or a candidate/check generation changes. Use a short decision ledger and linked evidence, not periodic prose summaries that gradually lose exceptions.

**Context rotation:** seal the attempt and usage; compile a new context package from valid facts, rejected hypotheses, next obligations and selected source spans. The new model must resolve the open issue, not repeat the initial discovery. Record what context was omitted and why; critical constraints are never evicted by relevance ranking.

**Owner interruption:** record steering as a decision/proposed amendment. Pause at a safe tool boundary, revoke further effects if requested, preserve the candidate. A request to stop is not an assertion that no request remains in flight. The UI shows acknowledgment separately.

**Agent/model replacement:** the successor receives contract, authorization, candidate, latest observations, failed hypotheses and next probe, all revisioned. It performs a resumption check for stale dependencies. It need not trust the predecessor's reasoning, and it cannot reinterpret an owner decision as optional.

**Failure and resume days later:** reconcile unknown effects and usage first; verify source/environment and artifact hashes. Reuse unchanged evidence; mark dependent proof stale after drift. If the owner edited related files, derive a successor candidate from the new base and recheck, rather than silently replaying the old patch.

**Validation failure:** retain failing logs and candidate. A bounded repair returns to editing, then produces a new immutable generation. Earlier passes remain historical and cannot certify the repaired generation automatically.

## 5. Independent challenge where it changes the outcome

A fresh read-only reviewer receives the contract, base/candidate diff, source access and evidence plan before the implementer's conclusion. It asks whether the tests prove the right behavior, whether an unexamined dependency changes the design, and whether recovery leaves partial effects. It produces findings with a witness or falsifiable question.

Do not settle disagreement by voting. A concrete counterexample defeats a broad success claim until resolved. An unsupported objection becomes a bounded probe, not an endless debate. For domain uncertainty no model can settle, ask the owner for the missing fact or observation. The writer cannot approve its own criterion waiver.

Additional investigators are justified only for independent bounded questions with distinct evidence, such as client persistence and API effect identity. They share immutable evidence; they do not maintain competing plans. Stop spawning once coordination costs more than the remaining independent work.

## 6. What success feels like

The owner can leave for hours and return to either a defensible candidate or one precise decision with useful work already completed. Restarting tomorrow does not mean explaining the problem again. A stronger model can replace a weaker one without reconstructing the engagement from transcripts. The final package includes the causal finding, selected design, rejected alternatives that matter, actual checks, unresolved observations and recovery instructions.

Measure information gained per probe, repeated discovery after resumption, owner decisions containing genuinely new information, escaped defects and useful partial outcomes. Do not reward raw tokens, number of agents or length of the architecture memo.
