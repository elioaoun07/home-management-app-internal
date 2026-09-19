---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# ERA — Questions Nobody Asked

These questions emerged from the repository investigation. The title follows the session contract; it is not proof that the owner or another agent has never considered them. They are not implementation tickets. Each identifies a decision that could eliminate work, narrow architecture or change what ERA is allowed to infer.

## 1. What exactly does a confirmed example authorize ERA to learn?

Is “bin the dentist reminder” evidence for a named-target rule, a current-focus rule, or only that this one deletion was correct? The actual learner can turn the first into the second while both actions pass validation. [Finding 1](<ERA — Unknown Unknowns.md>) and X1 distinguish this from prior work on action success and useful interventions.

**Why this deserves judgment:** a household assistant's ability to improve from use depends on the unit of learning. More successful interactions do not help if the stored lesson changes what the user meant. The important decision is which lessons may be generalized automatically, not whether to add one more target-matching heuristic.

**Best next recipient:** focused reasoning over a small owner-relevant teaching corpus. **Decision changed:** retain automatic learning for a proven subset, refuse uncertain lessons, or represent a limited binding rule. No richer language should be built before the corpus needs it.

## 2. Which parts of an intention may be interpreted again later?

“That reminder,” “tomorrow,” “my account” and “our household” have different lifetimes. Which should bind at capture, confirmation, replay, or execution? Existing request IDs and schema validation do not answer this. Findings 1–4 supply concrete witnesses; timezone/day changes outside those witnesses remain hypotheses.

**Why this deserves judgment:** a blanket snapshot is also wrong when the user intends a recurring relative rule or current membership. A blanket re-resolution can silently change a one-time instruction. Choosing the binding moment is product semantics, not a generic preference for more persistence.

**Best next recipient:** one premium session restricted to two or three existing action lifecycles, after X1–X4. **Decision changed:** which inputs a domain must preserve and which changes should trigger refusal or renewed interpretation. This need not produce a universal action envelope.

## 3. What observable result defines “the same action” across ERA's interfaces?

The draft reminder witness differs online versus replay despite identical input and successful writes. Must equivalence include status, alerts, subtasks, provenance, calendar effects and later Undo? Which differences are intentional because the user chose a different workflow?

**Why this deserves judgment:** making every caller use one endpoint can preserve the wrong behavior if the intended result has never been specified. Conversely, keeping multiple implementations may be reasonable when a small equivalence contract can be demonstrated.

**Best next recipient:** deterministic differential experiment X2, followed by an owner decision only for genuine semantic disagreement. **Decision changed:** delegate, constrain or retain existing paths. The target is one agreed outcome, not a new transport architecture.

## 4. Is changing a populated account's currency or type a setting, a correction, or a new economic history?

If an account with old USD transactions is relabeled EUR, what should an old native amount mean? If type changes from expense to income, what should deletion of an old expense reverse? [Finding 3](<ERA — Unknown Unknowns.md>) proves the sign issue in current source arithmetic. A frozen rate is useful but answers a different question.

**Why this deserves judgment:** the alternatives express different owner intentions. A mistaken setup correction may deliberately reinterpret history; a conversion should preserve history and change current holdings; a prospective switch should not retroactively affect old inverses. Engineering cannot safely infer which one “Change currency” means.

**Best next recipient:** owner judgment using X3's single lifecycle. **Decision changed:** prohibit changes after first use, provide a narrow correction, or model a conversion/epoch. A full financial event store is not the default answer.

## 5. What makes a recovered household the same household?

The same two people, the same link ID, the same memories and plans, or all of them? With two links for A and B, actual consumers disagree. If a future recovery recreates a relationship row, user-owned history and link-owned history can have different continuity.

**Why this deserves judgment:** access can be correct while continuity is wrong. A household should not need the owner to remember implementation IDs to recover its knowledge. Yet retaining every old relationship forever is not automatically the right policy either.

**Best next recipient:** X4 followed by owner lifecycle intent if multiplicity/replacement is an allowed state. **Decision changed:** preserve one stable container, define deliberate epochs, or document that replacement cannot occur. This is a two-person continuity question, not multi-tenant product expansion.

## 6. What evidence is independent enough to overturn an architecture belief?

If an architecture note becomes a graph node, and that graph is then cited as implementation corroboration, how many independent observations exist? The committed graph also combines same-named concrete functions and assigns a library call to a UI component. [Finding 5](<ERA — Unknown Unknowns.md>) is direct artifact evidence; a broader documentation/graph feedback loop is a hypothesis.

**Why this deserves judgment:** more polished evidence can increase confidence without increasing information. A model upgrade does not resolve false entity identity upstream. The smallest improvement may be fewer mandated artifacts and clearer source provenance.

**Best next recipient:** artifact analysis X5; no premium agent is needed merely to count collisions. **Decision changed:** retain a verified navigation aid, demote topology claims, or remove the mandatory graph step. Only study the broader feedback loop if observed decisions actually depend on it.

## 7. Is an architectural concept valuable if ERA cannot tell when it has changed meaning?

The registry says which capability exists; the queue says which request is pending; the account row says which account exists; the household link says which relationship exists. The witnesses show that identity and interpretation can diverge. Would a short per-domain statement of stable meaning buy more than another shared abstraction?

**Why this deserves judgment:** this is a chance to simplify. The common lesson does not prove a common implementation is desirable. A template may need refusal; an account may need immutability; a household may need a stable ID; a graph may need deletion of misleading edges.

**Best next recipient:** synthesis after the experiments, not a platform-design session beforehand. **Decision changed:** fix distinct domain rules with existing structures or identify a genuinely repeated primitive. “They all involve context” is insufficient evidence for a common framework.

## 8. Which apparent intelligence improvements should be removed because they generalize more than the evidence supports?

Automatic teaching of under-specified commands and reliance on an unvalidated architecture graph are concrete candidates. This differs from the Proactive study's already-covered question of whether an intervention was helpful. Here the question is whether an inference should exist at all.

**Why this deserves judgment:** restraint can increase capability by making the remaining behavior dependable. Removing one unsafe learning class might outperform improving a model; removing one mandatory exploration step might improve agent orientation.

**Best next recipient:** X1 and X5, then a bounded decision. **Decision changed:** delete, narrow or retain. No action is needed on classes the evidence shows are already safe and useful.

## What not to commission next

Do not commission another broad repository audit to restate these questions. Do not ask a model to guess current DB protections. Do not turn each question into a packet. X1–X5 provide small ways to decide whether more reasoning or implementation is justified. Some outcomes may be “the existing invariant is sufficient,” “this state is impossible,” or “remove the unsupported generalization.” Those are successful results.
