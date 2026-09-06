---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# PM Delivery — Context & Agent Model

## 1. Continuity is valuable; conversation is not authority

Keep one engineer's native conversation while it remains useful and safely configured. Replace it without losing the work. Provider sessions and prompt caches are optimizations over a durable dossier; they are not the only record of technical understanding.

Current source has ledger fields for rejected approaches, file index and test results, but no producers beyond defaults (`scripts/delivery/memory.mjs:32`). The Aug22 local ledger has zero entries in those categories. Normal rotation writes a context package without injecting its rendered body into the fresh turn (`run-session.mjs:499`, `:687`); the digest is phase/turn/usage metadata (`context-assembly.mjs:146`). Preserving the spec and owner answers is useful, but insufficient for days-long investigation.

## 2. Seven-part durable dossier

| Part | Required content | Freshness / authority |
|---|---|---|
| Contract | Outcome, exclusions, criteria, grants, risk, source intent | Immutable authorized revision; newer text cannot silently replace it |
| Workspace | Base/candidate manifests, dependency/config/fixture/toolchain identity | Verify before resume or evidence reuse |
| Investigation | Hypotheses, supporting/opposing observations, rejected approaches and reason | Source-bound; changed premises reopen the hypothesis |
| Decisions | Owner decisions separate from engineer choices, rationale, supersession | Owner authority remains explicit; source documents cannot impersonate it |
| Obligations | Missing proof, open question, failed check, unknown effect/resource | Each has next safe action or named external dependency |
| Execution pointers | Attempt, probe, effect, usage and evidence IDs with immutable hashes | Receipts written by trusted kernel, not copied into model prose |
| Continuation cursor | Last coherent checkpoint; next discriminating action; unprocessed observations | Reconcile pending effects before more execution |

An investigation record is a small structured assertion: statement, kind, status, supporting/opposing refs, source manifest, scope, reason and reconsideration trigger. A negative search also stores query, searched universe and cutoff. “No handler exists” after searching one directory cannot become global absence.

Model-authored facts remain assertions until supported by observations. Derived interpretation remains distinguishable from a direct observation even when well supported. Store concise hypotheses and rationale; there is no requirement to capture hidden chain-of-thought.

## 3. Context assembly and retrieval

The repository universe is an index, not a mandatory prompt. Start with Feature Map/vault policy and the work's actual dependencies; extend retrieval when a probe can change the decision. Preserve mandatory domain constraints and authorization before optional history.

Compile each fresh input in this order: current contract/grant, applicable policy, unresolved obligations and current hypothesis, relevant evidence and source spans, then short continuation history. Old answered questions and superseded decisions remain retrievable without occupying every prompt. A manifest records actual delivered content hashes, source ranges, omissions and estimated footprint.

Distinguish four receipts: a path requested for reading, content actually retrieved, content compiled into the model input, and provider-reported request telemetry. A “loaded” reading-list entry proves none of the later three. Tool outputs also consume context and need budget accounting.

Checkpoint when an observation changes the investigation, before model replacement/pause, after a candidate publication, and when an obligation resolves. Do not pay for a separate summarizer after every turn. A crash can leave raw observations without synthesis; the successor processes that bounded tail. Promise bounded reconstruction, not zero repeated thought after every possible crash.

Retrieval can begin with ordinary path search, indexed metadata and full-text lookup. A vector database or graph service is unnecessary until a measured retrieval failure warrants one. The existing Graphify map can aid exploration but never overrides source revision or policy authority.

## 4. Context and resource units

| Quantity | Meaning | Never substitute |
|---|---|---|
| Source universe | Searchable repository material | Required prompt load |
| Prompt estimate | Locally estimated compiled input | Provider-observed resident footprint |
| Latest/peak request footprint | Context in a particular provider request, when reported | Sum of all prior input traffic |
| Processed throughput | Distinct request input/output/cache traffic summed over attempts | Occupancy percentage |
| Cache traffic | Provider cache reads/writes with reported scope | Guaranteed free continuity |
| Output reserve | Headroom for response and tool continuation | Available spending budget |

Ten requests with 30K input each can represent 300K processed input with roughly a 30K input footprint per request. It is not evidence of 300K resident input. Current `usage.mjs:139` and rotation at `run-session.mjs:625` conflate these units.

Rotate based on reliable request/context telemetry and headroom. If unavailable, use a conservative explicitly estimated bound, not a falsely precise gauge. A 175% “occupancy” is a unit failure or incompatible telemetry, not permission to invent a context window. Cache expiry may increase cost; it cannot stale an owner decision or validate an artifact.

## 5. Agent independence must earn its cost

| Role | Why separate? / inputs | Output and resolution | Cost policy |
|---|---|---|---|
| Primary engineer | One conversation preserves discovery and implementation understanding | Candidate and evidence-backed assertions; cannot self-authorize | Default in both modes; cheapest capable model, continuity favored |
| Deterministic checker | Authority must be outside writer; fixed criteria and frozen candidate | Actual execution receipts and proof eligibility | Software, no mandatory model call |
| Fresh challenger | Correlated self-review can miss mistaken assumptions; sees contract/source/diff/receipts before success narrative | Falsifiable findings or explicit inconclusive result; probe disputes | Selected high-risk/ambiguous tasks; record added latency/cost and useful findings |
| Bounded investigator | A separate question can be answered independently, e.g. client versus server causality | Source/probe refs merged into common dossier | DEEP only when useful parallel work exists; individual caps; no product writes |

Current `agent-registry.mjs:105` calls Code Reviewer lite self-review and independent-readonly entries remain planned. Do not preserve a fictitious organization. Investigator, architect, implementer and UAT author are usually activities of the primary engineer. Report formatting, test dispatch, usage arithmetic and completion projection belong in code.

A second model is not proof. Give a challenger different evidence access and no ability to accept or edit the product. Resolve disagreement by a reproducible witness or targeted probe, not a vote. A reviewer unable to conclude leaves a named evidence gap. Stop adding reviewers after their marginal value falls below the coordination cost; the pilot must measure actual additional defects or avoided owner inspection.

## 6. Provider strategy and qualification

Use capability tiers, not model names, in work contracts. Premium reasoning is justified for ambiguous causality, architecture and high-consequence proof. Routine transformations may use cheaper models; identity checks, schemas and bookkeeping remain deterministic. Escalate after evidence of misunderstanding or unexplained repair failure, not merely because a turn took longer.

Allow model/provider changes only within a recorded qualification and owner grant. Preserve continuity when switching would cost more in repeated discovery than it saves. Planned downgrades belong at coherent checkpoints, not every phase. A provider failure may use an explicitly approved equivalent adapter; otherwise pause with a portable dossier. Never silently fall back to weaker permissions or unknown billing.

An adapter qualification records: SDK/runtime version, OS, actual tools, filesystem/network/environment policy, descendant-process isolation, revocation/publication behavior, structured output, usage scope, request-footprint availability and request limits. Unsupported controls make an autonomous mode ineligible; they do not become `true` because the common interface has a field.

Current examples are substantive: Codex adapter ignores `maxTurns` (`drivers/codex.mjs:289`), while Claude uses SDK turn limits; both generate preflight responses without conserving usage (`drivers/claude.mjs:1036`, `drivers/codex.mjs:237`). Both omit explicit subprocess environment allowlists. Exact installed controls must be verified in disposable fixtures. Qualify one provider path first; the second should implement the same contract suite later.

Claude callback tests alone cannot prove universal enforcement: documented auto-approval can precede `canUseTool`. Hooks and sandboxing require their own conformance. Native SDK capability must not be confused with a platform-enforced security boundary. [Claude permission ordering](https://code.claude.com/docs/en/agent-sdk/permissions).

## 7. Inclusive economics

Reserve every paid attempt before dispatch, including unavoidable authentication probes, retries, review and compaction. Prefer non-generative authentication checks. Persist raw observed usage before interpreting structured output. Normalize cumulative readings only within a verified provider/process/segment scope; duplicate readings cannot double-charge the ledger, and a counter reset must not produce a negative refund.

Record separate provider-reported USD with its declared scope/billing provenance, estimated API-equivalent cost with pricing version, subscription usage and unknown outstanding spend. Reconciled billed cost is a separate fact only when independently verified. Do not sum these into a fictitious invoice. Subscription availability and rate windows are different from dollars; absence of a price is not absence of cost.

Admission uses settled usage plus unresolved reservations plus the next attempt allowance. An interrupted attempt cannot release its reserve merely because no receipt arrived. Hard monetary caps require a certified maximum billable unit; otherwise disclose the maximum enforceable bound/possible in-flight overshoot and stop future dispatch. Model context limits, tool/runtime quotas and elapsed time get their own controls.

Optimize verified useful outcomes with low owner active time, under cost and latency bounds. A useful comparison includes retries, review, repeated discovery and owner repair. Forecast only from coherent work classes and usage units; the small heterogeneous V1 cohort does not support automatic fine-grained calibration.
