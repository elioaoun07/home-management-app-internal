---
created: 2026-09-06
updated: 2026-09-06
type: delivery-plan
status: baseline-frozen
owner: Elio
plan_revision: "2.1"
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# PM Delivery — DEEP DIVE

> **V2.1 target plan, revised 2026-09-06.** DEEP DIVE shares [V2 Architecture](<PM Delivery — V2 Architecture.md>) with FAST. [Context & Agent Model](<PM Delivery — Context & Agent Model.md>) owns the Checkpoint contract; [Evidence & Autonomy](<PM Delivery — Evidence & Autonomy.md>) owns verification and authorization. The original V2 mandatory investigation dossier/context-rotation machinery is replaced by native continuity plus meaningful portable records.

## 1. A durable engineering engagement

DEEP DIVE is the effort policy for uncertain causality, product meaning or architecture. It uses the same WorkRef, Contract, Grant, confined native jobs, protected verification and disposition rules as FAST. It adds deliberate investigation, a larger authorized effort allowance and selective independent challenge. It does not add another runtime, grant broader access or require more approval phases.

An unclear item may start permitted investigation before implementation scope is known. The Contract retains the intended outcome and requested disposition; the Grant can initially allow only safe reads/probes. If the owner requested a fix, an investigation result does not silently become completion of that request. A research-only request can be completed when its own required evidence and disposition are met; its report and source/evidence manifest form the research candidate defined in Architecture.

The owner normally selects the item and chooses **Deliver**. The system selects or escalates effort within authority. The owner resolves values and consequential exceptions, not hypothesis bookkeeping or context-window management.

## 2. Native investigation with explicit exit conditions

The engineer should:

1. Separate the observed symptom, attributed owner reports, source facts and unknowns.
2. Identify plausible causes and choose a cheap probe that distinguishes them.
3. Use approved synthetic or isolated inputs; retain relevant positive and negative observations.
4. Follow dependencies when they can change the decision, applying the existing module/domain rules.
5. Compare plausible repairs by correctness, recovery, total owner effort, implementation cost and opportunities to reuse or delete machinery.
6. Produce a bounded candidate and evidence plan, or the precise unresolved choice that prevents it.

These are engineering expectations, not six persisted phases or a required row for every search/hypothesis. Native planning, tools, context management and read-only subagents may supply them. ERA retains only findings and decisions necessary to preserve the commitment and resume safely.

Implementation can proceed when the causal explanation is adequate, affected boundaries are understood, an executable verification path exists and no unresolved high-consequence assumption blocks the proposed scope. Continue without an owner gate if the Grant already covers it. Otherwise present the prepared contract/authority change and its consequences.

When allowance ends first, preserve useful work and the next discriminating action. More tokens, longer prose or a stronger model do not resolve unavailable external evidence. Repeating the same probe against unchanged inputs requires a new reason.

## 3. Complete journey: duplicate or lost offline capture

Illustrative case, not an executed task: “Sometimes retrying an offline capture duplicates it; after restarting, another one disappeared.” The request crosses local persistence, replay, API identity and displayed outcome. The existing domain rules govern investigation and implementation.

| Moment | Owner action | Native engineer / supervisor | Required evidence and limits |
|---|---|---|---|
| Select | Chooses the reported item and Deliver | Resolves current intent and admits a bounded investigation | Owner recollection remains attributed; it is not fabricated into a trace |
| Orient | None | Reads routed docs and follows capture → durable store → replay → server result → UI | No production probing; distinguish source facts from hypotheses |
| Probe | None | Exercises reload-before-commit, response loss and duplicate replay using isolated fixtures | Separate nondurable local write from repeated external effect; retain discriminating results |
| Decide | Answers only an unresolved product choice | Presents ambiguity about an uncertain past capture with evidence and consequences | Bind the answer to the applicable Contract revision |
| Design | No action if existing authority covers it | Compares a repair using the existing queue with any necessary identity change | Explain the once-only guarantee at the actual effect boundary and its failure windows |
| Implement | Can leave | One candidate writer makes the repair; native read-only investigators may answer independent questions | Native work stays within the admitted job/resources; no parallel writers or new authority |
| Verify | Supplies a device/external observation only when required | Protected checks reproduce the defect, exercise regression and inject relevant failures; optional fresh reviewer challenges the proof | Synthetic tests cannot prove current production RLS, installed-device state or deployed behavior |
| Result | Receives established findings, candidate and remaining action | Records actual disposition with evidence and a Checkpoint for continuation | A required owner-applied migration or release keeps the original fix item open |

If investigation identifies a visibility/permission symptom, Hard Rule 27 applies before reading route code: inspect the committed DB-state snapshot and obtain owner evidence when missing or stale. Correct-looking routes cannot disprove RLS. This plan does not authorize production access.

If the repair needs a DB change, prepare the manual migration and authoritative schema update under the repository rules. The agent never applies it to production. Required application/live verification remains an explicit owner dependency; the absence of that evidence is not permission for a speculative code workaround.

## 4. Continuity without a second context engine

Default to continuing the native conversation. Preserve the native execution reference and raw record pointers. Do not measure context pressure using cumulative processed tokens or implement an ERA rotation/compaction scheduler.

The [Context & Agent Model](<PM Delivery — Context & Agent Model.md>) defines the lean Checkpoint and its exact fields. Write it at candidate handoff, task-level wait or planned pause, and before native replacement where possible. It preserves binding decisions, consequential findings with source references, candidate identity, remaining obligations, native record references and the next safe action. Retain negative findings that would otherwise cause repeated work. Link artifacts; do not duplicate the native transcript or persist a checkpoint after every probe.

| Event | Required continuation behavior |
|---|---|
| Native context compaction | Let the environment manage it; retain ERA's actual launch/resume inputs and useful supplied telemetry |
| Fresh session or model | Supply the Checkpoint and current source/candidate references; revalidate Grant and resources before dispatch |
| Owner steering | Record a decision or proposed amendment; preserve existing work and stop dependent activity if its authority changes |
| Cancellation | Withdraw future publication authority immediately; retain uncertainty until executor stop is confirmed |
| Worker crash or lost acknowledgment | Reconcile the existing job and unknown allowance first; resume only when safe, otherwise isolate successor work from the old writer |
| Resume days later | Recheck source/environment and relevant evidence; changed inputs may need a successor candidate and new checks |
| Failed protected check | Preserve its receipt and candidate; an admitted repair returns a new candidate and reruns necessary verification |

A successor need not trust the predecessor's reasoning. It should verify material findings where needed, but recorded owner decisions remain binding. Portable continuation should reduce reconstruction; it cannot promise that no reasoning will ever repeat.

## 5. Independent challenge where it earns its cost

A reviewer is useful when a proposed cause, architectural tradeoff or evidence plan has a meaningful chance of being wrong. It receives the Contract, candidate/diff, relevant source and evidence before the writer's conclusion where practical. It asks whether the observations prove the requested behavior and whether recovery or an overlooked dependency changes the result.

Use concrete counterexamples and falsifiable questions. A witnessed failure defeats a broad success claim until resolved. An unsupported objection becomes a bounded probe; model disagreement is not settled by voting or endless review. Missing external facts still require an authorized observer.

Native subagents are preferred for bounded independent investigation inside the same qualified environment and resource policy. If ERA starts a separate reviewer job, it repeats job admission and resource accounting. One writer owns a candidate; reviewers are read-only and cannot authorize a waiver or modify the standard they are evaluating. Managed grading may supply useful challenge, but it does not replace protected observations or ERA's acceptance semantics.

## 6. DEEP DIVE build acceptance

The [Execution Portfolio](<PM Delivery — Execution Portfolio.md>) places an interrupted real engagement after the first vertical slice. That engagement must demonstrate:

- The initial authorized investigation discovers something useful without routine owner supervision.
- A material decision, negative finding and current candidate survive an interruption and fresh-session continuation.
- The successor rechecks changed source/grant inputs, preserves binding decisions and avoids repeating already-resolved questions.
- Native and separately dispatched work remain inside current resources, including unresolved usage; DEEP never bypasses cost admission.
- Protected evidence detects a deliberately inadequate or stale result, and the owner receives a useful next action if it cannot be repaired within authority.
- A verified candidate is not reported as an applied or deployed fix; the selected item's requested disposition remains intact.

Compare against the same work performed in a native environment with equivalent rules. Measure owner-active minutes, avoidable decisions, repeated explanation, recovery time, verified outcomes, escaped defects and maintenance. The planned interrupted engagement is an operational qualification sample, not statistical proof of general autonomy.

Success feels simple: the owner can leave, return to either a defensible result or one consequential choice, and resume tomorrow without reconstructing the engagement personally. More agents, more context machinery and longer documents earn no credit unless they improve that experience.
