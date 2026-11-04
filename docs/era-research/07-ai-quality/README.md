---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit 91c4285 (application source identical to 22152c2)"
---

# ERA AI Quality & Usage (07)

Which ERA tasks need a model and which should be deterministic, which tier and effort each should use and how it escalates or falls back, the minimal trace that explains context, actions, failures and cost without copying personal content, a fifteen-case synthetic evaluation pack with blind answer keys, and budget controls with cost estimates on stated workloads. No model was called, no evaluation was run and no result is reported.

## Files

| File | Use it to |
|---|---|
| [AI-TASK-MATRIX.md](AI-TASK-MATRIX.md) | See every model call site (AT-01–AT-14), what is metered and limited, which tasks need a model, proposed tier/effort per task, escalation and fallback rules E-1–E-7 and decisions QD-1–QD-8. |
| [TRACE-SPEC.md](TRACE-SPEC.md) | Implement the turn, attempt and failure records (IDs, enums, counts, hashes only), the content-minimization rules TR-1–TR-7, how each of the four questions is answered, storage and retention, with a fictional example. |
| [EVALUATION-PACK.md](EVALUATION-PACK.md) | Run fifteen synthetic cases (Q-01–Q-15) across Budget, Budget Allocation, Schedule, Kitchen, Healthcare, Recipes, Brain context, Trips, Focus and household privacy, each with expected behaviour, a 10-point rubric and critical failures. |
| [EVALUATION-ANSWER-KEYS.md](EVALUATION-ANSWER-KEYS.md) | Grade the pack: reference outputs, accepted variants, rejections, machine checks and grader notes. **Never shown to the system under test.** |
| [USAGE-CONTROLS.md](USAGE-CONTROLS.md) | Read today's controls, the verified Claude prices (and the unverified Gemini/Azure gap), assumed workloads, computed costs, the quality-versus-cost method, budget controls B-1–B-9, incomplete-task behaviour IT-1–IT-9 and decisions. |

**Reading order.** Matrix → Usage Controls → Trace Spec → Evaluation Pack (keys last, by graders only).

## Labels

CURRENT IMPLEMENTATION (read in code), PROPOSED DESIGN (this folder), ASSUMPTION (workloads and token splits), UNKNOWN (deployment, provider console, owner). Models are named by Model Registry tier alias (`CLAUDE_LOW`/`MID`/`HIGH`); `GEMINI_PRIMARY`/`GEMINI_FALLBACK` are proposed aliases.

## Related

- `ERA Notes/Model-Registry.md` (aliases), `ERA Notes/01 - Architecture/Live API Testing Protocol.md` (how any live pass must run), `tests/era-gym/` (existing replay corpus and receipts).
- PM: HUB-44 (usage attribution, degradation), HUB-105 (representative model evidence), HUB-107 (provider migration), D3, D9, D13; decision DEC-14 (Delivery costs, out of scope).
- [04-memory-context](../04-memory-context/README.md) (context packet, content copies, OD-7), [06-action-execution](../06-action-execution/README.md) (action envelope linked from the trace).

## Limits

- Claude prices were read from the official pricing page on 2026-11-04. Gemini and Azure prices could not be verified: `ai.google.dev` is outside this session's allowed network domains and the Google Cloud pricing page returned no body; only third-party pages were found. No Gemini or Azure cost is computed.
- Token figures come from one existing synthetic receipt set (12 calls, 2026-10-11) plus stated assumptions; real household calls with full context may be larger.
- No evaluation result exists for this pack; quality comparisons are a method, not findings.
