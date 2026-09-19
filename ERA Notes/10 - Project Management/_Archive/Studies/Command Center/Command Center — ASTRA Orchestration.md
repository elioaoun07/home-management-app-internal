---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# Command Center — ASTRA Orchestration

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Source evidence cutoff: `3106164` (2026-09-02); local session artifacts inspected read-only on 2026-09-06. Deltas [Delivery — Master Book](<../../../Delivery/Delivery — Master Book.md>) at `updated: 2026-08-01` and [PM Tooling — Master Book](<../../../PM Tooling/PM Tooling — Master Book.md>) at `updated: 2026-08-03`. Those frontmatter dates do not date every paragraph: Delivery includes later August records.
>
> Phase 3 study only. Read with [Architecture](<Command Center — ASTRA Architecture.md>), [Experience](<Command Center — ASTRA Experience.md>), [Command Center packets](<Command Center — ASTRA Packets.md>), and [Delivery packets](<../ASTRA/Delivery/Delivery — ASTRA Packets.md>). `ASTRA-DLV-*` references identify study packets; they do not register a new campaign prefix. No provider calls, delivery launches, database calls, or implementation changes were made to obtain this evidence.

## 1 · The orchestration decision

**EXTENDS → DLV-87 / DLV-88 / DLV-69:** repair the meaning and durability of the existing receipts before adding orchestration. A streaming SDK result's cumulative dollar reading is being accumulated as a new turn cost; processed token throughput is being used as resident context; a completed phase's total becomes a per-traversal forecast prior. These are different units. They affect the budget gate, context rotation and launch forecast through existing code paths [O1–O4].

The concrete product beneficiary is **HUB-47 / E-11**: a bounded nonvisual subset that propagates a failed capability outcome without rewarding its template. It can become a DLV-92 pilot only after discovery confirms that its exact scope meets DLV-92's 3–8-file, nonpayment, non-auth, nonsecurity and nonmigration constraints. The whole HUB-47 bundle includes a database concern and is not that pilot. **HUB-37 / E-01** benefits from truthful CI and validation receipts; source changes and owner-applied migrations remain outside this study.

The August 6 architecture freeze still applies. It permits a defect demonstrated by a real product run to justify work; it does not authorize a new agent platform. The August 22 HUB-1 artifacts establish a product run, but two completed product experiments are not evidenced. Preserve DLV-92/93's capacity limit: one reliability fix, one workflow simplification and one validation fix after the first experiment, then another product run before further architecture expansion (Delivery checklist §Now). The packets are reviewable refinements, not a declaration that all should precede the next product edit.

## 2 · Evidence: six receipts with different meanings

| ID | Quantity | Current implementation and evidence | Required meaning / product consequence |
|---|---|---|---|
| O1 | Provider dollar reading | `scripts/delivery/drivers/claude.mjs:575,592` copies `total_cost_usd`; `:1319` returns it on each streamed turn. `run-session.mjs:1833` selects it; `:1060` accumulates it. Aug 6 reused turns carry cumulative readings [§3]. | A reported cumulative reading is provenance. Only its newly incurred, validated delta belongs in a per-attempt ledger. Otherwise HUB-47 can hit a cap because earlier work was counted again. |
| O2 | Processed tokens | `scripts/delivery/usage.mjs:137` sums result-level input, cache read and cache creation under `computeOccupancy`; `run-session.mjs:1752,629` records it and feeds rotation. | Throughput measures work billed across internal requests. It cannot say how much context one request holds. False rotation discards resident exploration and undermines DLV-85 reuse. |
| O3 | Resident context | `context-policy.mjs:65–76` uses the above value at phase boundaries and at the mid-phase hard ceiling. Aug 22 reports 108.9% and 175.4% of a configured 1M window and rotates during BUILDING [§4]. | Use latest request context for the next-turn decision, with peak request context as a separate diagnostic. If request telemetry is absent, occupancy is unknown; do not divide throughput by turn count. |
| O4 | Forecast sample | `recommendation.mjs:115–128` learns from whole `usage.perPhase[phase]`; `:190–194` multiplies that by expected traversals. `server-routes.mjs:415–428` supplies histories keyed only by tier. | A phase total is not a traversal sample. Calibration must preserve sample units, model/effort, segment regime and accounting quality before it can help choose HUB-47's envelope. |
| O5 | Executed attempt | `run-session.mjs:2012` obtains an ID from `state.turnCounter + 1`; handlers advance the counter after the driver returns. Aug 22 has 17 sealed rows but 11 unique turn IDs [§6]. | Reserve identity before paid work. A retry, replayed result and distinct paid attempt must remain distinguishable so accounting and validation evidence can be reconstructed. |
| O6 | Finished outcome | Aug 22 `state.json` says ACCEPTED; its finish manifest says BLOCKED / runner-crash and acceptance says 0/6 met [§6]. | A state label, successful provider response and current evidence package are separate facts. A governed product run needs their agreement; the completion-coherence work is CC-3 in the Command Center packets. |

All source paths above are repository-relative. Artifact observations describe the inspected local copy, not a provider invoice, deployed service or live database state.

## 3 · Streaming reuse changed the accounting contract

DLV-85 has a real implementation: `segmentKey()` in `scripts/delivery/drivers/claude.mjs:913` includes mode, model, effort, maximum turns and output schema. `:1162–1219` reuses a live input stream only while those options match. `:1231–1274` drains it without closing its generator after each result. The existing fake-SDK coverage lives in `tests/delivery/drivers-claude-segments.test.ts`. This study did not run or alter those tests.

The change made a result's dollar field cumulative across consecutive turns inside that live segment. The normalizers still treat the field as a fresh turn cost. The Aug 6 local session `s-20260806-224840-o8xj` provides a reproducible example:

| Turn | Segment turn index | Reported dollar reading | Difference from prior reading in this segment | Estimate from this turn's tokens and the existing local configuration |
|---|---:|---:|---:|---:|
| 0002 | 1 | 0.5935551 | 0.5935551 | 0.5935551 |
| 0003 | 2 | 1.2815424 | 0.6879873 | 0.6879873 |
| 0004 | 3 | 1.5841152 | 0.3025728 | 0.3025728 |
| 0005 | 4 | 1.7604186 | 0.1763034 | 0.1763034 |

The exact differences agree with independently calculated token estimates. August 22 repeats the pattern: a segment's 0.8139085 reading becomes 1.2197295 while that turn's configured token estimate is 0.405821; another changes from 1.20707 to 2.667091 while the turn estimate is 1.460021. These are local accounting observations, not claims about current provider pricing.

Read-only reproduction from the repository root; prints numerical metadata only and creates no file:

```powershell
@'
import fs from 'node:fs';
import { estimateCostUsd } from './scripts/delivery/usage.mjs';
const session = '.delivery/sessions/s-20260806-224840-o8xj';
const config = JSON.parse(fs.readFileSync('.delivery/config.json', 'utf8'));
const turns = fs.readFileSync(`${session}/transcript/turns.ndjson`, 'utf8')
  .trim().split(/\r?\n/).map(JSON.parse);
let previous = 0;
for (const turn of turns.filter(t => t.segment?.id === 'seg-002')) {
  const model = config.providers[turn.provider].models.find(m => m.id === turn.model);
  const delta = turn.costUsd - previous;
  const estimate = estimateCostUsd(turn.usage, model?.pricing);
  console.log(JSON.stringify({
    turnId: turn.turnId, index: turn.segment.turnIndex,
    reported: turn.costUsd, delta, estimate,
    equalWithinTolerance: Math.abs(delta - estimate) < 1e-9,
  }));
  previous = turn.costUsd;
}
'@ | node --input-type=module
```

Observed: four rows, all `equalWithinTolerance: true`. The command intentionally selects one known uninterrupted segment from one session. It is not a general reconciliation algorithm: segment numbers restart when the driver process restarts, and historic attempt IDs can collide.

**EXTENDS → DLV-87 / DLV-88 — ASTRA-DLV-1:** normalize cumulative provider cost to a per-attempt delta at the existing driver boundary. Persist the original reading, its query/process identity, pricing version and whether the value is reported or estimated. A decreasing cumulative reading is an identity/reset issue requiring explicit handling, not a negative refund. A missing reading is unknown, not zero. The gate is a fake-SDK stream with multiple successful and failed turns; total normalized deltas equal the last cumulative reading within each actual segment. This directly unblocks the HUB-47 pilot's budget protection.

**EXTENDS → DLV-87 — ASTRA-DLV-2:** conserve each paid attempt across retry and persistence boundaries. `run-session.mjs:1767–1798` banks failed-attempt usage, while the successful branch at `:1833–1863` returns only the successful attempt's usage; a failed-then-successful retry needs an explicit conservation test. DLV-95 moved REVIEWING/UAT accounting before parsing, but did not turn every paid boundary into a durable receipt. Cost normalization and durable accounting belong in separate bounded packets. They unblock the same HUB-47 pilot; do not add another general ledger service.

**UNVERIFIED: billing basis.** Local SDK readings and configured token estimates do not establish whether the owner's authentication is metered API billing or subscription usage. The owner can settle it with the provider account/settings view showing the active billing mode and the matching account's usage or invoice record, with identifiers and secrets redacted. Until then retain the distinction between provider-reported dollars, configured API-equivalent estimates and subscription usage; never relabel one as another. No credentials were read for this study.

## 4 · A throughput counter is forcing context rotation

The Aug 6 existing raw-SDK pointer resolves to a local file. Reading only its usage metadata and deduplicating by assistant `message.id` gives:

| Aggregate | Observed value |
|---|---:|
| Raw records | 202 |
| Assistant records carrying usage | 85 |
| Distinct assistant message IDs | 37 |
| Sum of distinct request input + cache read + cache creation | 2,020,276 |
| Maximum individual-request input + cache read + cache creation | 131,439 |
| Latest individual-request input + cache read + cache creation | 131,439 |

The 2,020,276 sum equals the session's sealed-turn aggregate input throughput. The 131,439 value is an individual request footprint. Counting repeated SDK assistant rows without `message.id` deduplication would invalidate the measurement, as the Delivery book's DLV-47 forensics already established.

Read-only reproduction using the already-recorded pointer; outputs aggregate numbers only:

```powershell
@'
import fs from 'node:fs';
const state = JSON.parse(fs.readFileSync(
  '.delivery/sessions/s-20260806-224840-o8xj/state.json', 'utf8'));
const pointer = state.driver?.rawTranscript;
if (!pointer?.path || !fs.existsSync(pointer.path)) {
  throw new Error('Required local SDK evidence unavailable');
}
const rows = fs.readFileSync(pointer.path, 'utf8').split(/\r?\n/)
  .filter(Boolean).map(JSON.parse);
const usageRows = rows.filter(r => r.type === 'assistant' && r.message?.usage);
if (usageRows.some(r => !r.message.id)) throw new Error('Missing request identity');
const requests = [...new Map(usageRows.map(r => [r.message.id, r])).values()];
const input = r => ['input_tokens', 'cache_read_input_tokens',
  'cache_creation_input_tokens'].reduce((n, k) => n + (r.message.usage[k] || 0), 0);
console.log(JSON.stringify({
  rawRecords: rows.length, usageRows: usageRows.length, requests: requests.length,
  throughput: requests.reduce((n, r) => n + input(r), 0),
  maximumRequest: Math.max(...requests.map(input)),
  latestRequest: requests.length ? input(requests.at(-1)) : null,
}));
'@ | node --input-type=module
```

Aug 22 makes the consequence visible without exposing transcript content. In `.delivery/sessions/s-20260822-093143-t7tm/transcript/turns.ndjson`, BUILDING turns `0004` and `0006` record occupancy 1,089,113 and 1,753,787 against a configured 1,000,000 window. `events.ndjson` records `context.strategy` decisions rotating at the 85% mid-phase threshold from these values. The function's phase-boundary name and its comment promising no mid-build rotation are not the complete behavior: `context-policy.mjs:71` expressly implements a mid-phase ceiling.

**EXTENDS → DLV-69 — ASTRA-DLV-3:** separate request context from throughput; use a latest-request receipt to drive the existing rotation policy. Preserve peak footprint and processed tokens as diagnostics. Missing request evidence remains unknown and cannot trigger a fabricated percentage. Regression: ten 30K internal requests mean 300K throughput and a 30K request footprint, not a 300K context. The change prevents a HUB-47 build from needlessly discarding the context it just paid to establish.

DLV-85 does not eliminate all cache creation on reused turns. Aug 6 reused turns `0003–0005` report 27,765, 16,269 and 9,270 creation tokens. Aug 22 reused turns `0002`, `0006`, `0008` report 10,866, 32,683 and 25,330. Thus `run-session.mjs:1818`'s claim that a reused segment paid none, and the Master Book's DLV-85 blanket no-rewrite claim, need narrowing. Reuse is observable; a zero cache-write charge is not its definition.

## 5 · Calibration must wait for coherent sample units

The brief and Delivery checklist name `PHASE_BASELINE_TOKENS` and cite `{cacheCreation: 10_000, cachedRead: 350_000}`. No such named constant exists in `recommendation.mjs`. `STATIC_USAGE_BY_TIER` at `:54` is the old per-session diagnostic retained at `:629`; the headline at `:637–639` comes from `forecastByPhase`. Its active static economy priors begin at `:78`.

The next error is in how measurement would replace those priors. `server-routes.mjs:401–428` admits ACCEPTED/SHIPPED sessions and supplies their phase totals. `estPhaseUsage:115` uses those totals as a per-traversal shape once three same-tier samples exist. `forecastByPhase:190` then multiplies them by the requested traversal count.

Read-only demonstration of the unit mismatch:

```powershell
@'
import { forecastByPhase } from './scripts/delivery/recommendation.mjs';
const history = Array.from({ length: 3 }, () => ({
  tier: 'economy', perPhase: {
    building: { input: 300, cachedRead: 0, cacheCreation: 0, output: 0 },
  },
}));
const forecast = forecastByPhase({ tier: 'economy', itemEffort: 'M', history });
console.log(JSON.stringify(forecast.phases.find(p => p.phase === 'building')));
'@ | node --input-type=module
```

Observed: `traversals: 3`, `usage.input: 900`, `priorSource: "measured-median"`. If 300 is each completed three-step phase total, the forecast has multiplied the phase length twice. This defect is latent in the measured-history path; it does not explain today's static headline by itself.

The inspected fleet has 16 session directories. Only DLV-28 is SHIPPED and HUB-1 is ACCEPTED; their recorded recommendation tiers are economy and premium respectively. No tier has three eligible histories. Consequently the active priors for this local fleet are still static. A source-only statement that measured medians exist is not evidence that they are in use.

| Post-DLV-85 local observation | Cache creation | Cache reads | Reads / writes | Eligibility and data-quality limit |
|---|---:|---:|---:|---|
| Aug 6 DLV-86 | 131,438 | 1,888,771 | 14.37 | CANCELLED; the production forecaster excludes it. Reused result costs are cumulative. |
| Aug 22 HUB-1 | 554,582 | 6,894,944 | 12.43 | ACCEPTED; 17 sealed rows include colliding turn IDs, and final artifacts disagree. These totals describe all sealed-row throughput, not a reconciled invoice or approved new prior. |

**EXTENDS → DLV-86 — ASTRA-DLV-8:** calibrate only after ASTRA-DLV-1/2 establish usable cost receipts. ASTRA-DLV-3 is not a prerequisite: request-context correction remains subject to its own freeze gate, avoiding a dependency from DLV-86 through the product experiment it must precede. Keep provider/model, reasoning effort, accounting version, traversal count and segment created/reused status with the sample. Preserve failures in the cost/reliability account without presenting a cancelled session's partial phase as a completed session. Missing comparable data keeps an explicit static prior; it does not justify pooling incompatible histories. Start with corrected units and a small offline comparison against existing artifacts, not confidence-band machinery or a new forecast service. Product unlocked: an interpretable estimate for the bounded HUB-47 pilot.

## 6 · Context recovery and artifact integrity

Rotation already creates a rendered package. `run-session.mjs:499–563` writes a mechanical digest, constructs `buildContextPackage()`, saves the rendered snapshot and clears the provider reference. The normal fresh turn is not given that rendered package. The handoff path at `:681–687` does inject it, so there is a proven reuse seam. `context-assembly.mjs:143–154`'s default digest contains turn metadata, not a summary of source facts discovered during exploration.

**EXTENDS → DLV-69 — ASTRA-DLV-7:** deliver the existing approved ledger, constraints, questions, pins and artifact references to the first fresh turn exactly once. Test the actual received prompt, not merely snapshot existence. Request-context correctness is a prerequisite; seeding false rotations would make the wrong behavior more expensive. Do not add an LLM compaction call or another memory store. This enables HUB-47 to survive an authorized rotation without repeating owner decisions.

The context manifest is also a declaration of what the agent was told to read, not proof of what it read. `run-session.mjs:2502–2523` budgets a reading list; `:2532–2544` writes retained sources with zero token estimates even though earlier selection used estimates. It cannot substantiate actual provider context size. **EXTENDS → DLV-69:** correct that interpretation within ASTRA-DLV-3/7 documentation; a separate inspector redesign does not unblock a product outcome and is not proposed.

The August 22 artifact disagreement requires conservation of identity as well as content:

| Local artifact | Observed metadata |
|---|---|
| `packet.json` / `state.json` | Product item HUB-1; state ACCEPTED. |
| `decisions/` | Spec, plan and UAT decision files exist; no SHIPPED state is recorded. |
| `transcript/turns.ndjson` | 17 rows; 11 distinct turn IDs; `0010` occurs six times and `0011` twice, at distinct start times. |
| `artifacts/finish/manifest.json` | `finalState: BLOCKED`, `reason: runner-crash`, timestamp `2026-08-22T12:43:32.564Z`. |
| `artifacts/finish/acceptance.json` | 0 of 6 criteria met. |
| Workspace-delta records | Seven source paths, including ERA's CommandBar, intent resolvers, types, reply formatter and router test; this was product code work. |

This corrects the checklist's historical “no product code has ever shipped through the pipeline” premise only as far as evidence permits: a product run and ACCEPTED state now exist. It does not establish owner-SHIPPED delivery, independently verified completion, or two completed product experiments. Finish-package coherence is **CC-3** in the [Command Center packets](<Command Center — ASTRA Packets.md>), tied to the same HUB-47 pilot.

**EXTENDS → DLV-68 / DLV-91, held under their existing freeze conditions:** reserve turn/attempt identity before provider execution, retain an open stub, and reconcile closed or abandoned attempts at recovery. This work is not covered by ASTRA-DLV-2, which checkpoints already-returned paid results, or CC-3, which establishes finish-package coherence. Existing IDs are not safe deduplication keys for this historical session. A process epoch must disambiguate restarted `seg-001` values. Do not rewrite historical evidence to hide collisions.

A heartbeat already exists: `run-session.mjs:4720–4754` records heartbeat and probes the PID; `:4857–4870` keeps the heartbeat alive while a turn runs. The missing observation is progress. A healthy timer cannot establish that a provider call or tool is advancing. **EXTENDS → DLV-68 / DLV-91:** use the same active attempt and existing heartbeat for recovery evidence; distinguish a waiting owner gate, an executing tool, missing progress and a dead process. Any watchdog implementation remains conditional on a demonstrated product-run failure and DLV-93's limit. Never expire a live writer merely because it is slow.

## 7 · Lanes and agents: preserve shape, repair proof

| Lane | Current default envelope | Pipeline distinction | Required confidence |
|---|---|---|---|
| INSTANT | 0.25 dollars / 250K tokens / 8 internal turns | Two model turns; merged discovery/plan and deterministic review/UAT when the declared edit matches. | Actual session diff, real validation coverage and three recorded gate decisions. One owner action can record the spec/plan pair only under the existing narrow amendment. |
| FAST | 0.50 / 500K / 12 | Four–five model turns; merges discovery/plan when the existing predicate permits. | Model review remains required; a skipped or unmatched test is not a passing test. |
| STANDARD | 2 / 2M / 20 | Separate normal phases. | Full configured validation plus strict review and acceptance evidence. |
| DEEP | **4** / 5M / 40 | Same phase shape with a different policy and reasoning allocation. | The larger token allowance does not relax gates or convert missing verdicts into success. |

Sources: `scripts/delivery/config.mjs:218–229`, `recommendation.mjs:173–190`, Delivery Master Book §INSTANT amendments. The brief's DEEP dollar default of 5 is stale; the current default is 4. These dollar figures are configured envelopes, not current provider-price claims. Packet snapshots and authorized raises determine an actual session's cap.

Confidence refinements are already owned by [Delivery packets](<../ASTRA/Delivery/Delivery — ASTRA Packets.md>): **ASTRA-DLV-4** (`EXTENDS → DLV-90`) distinguishes NOT_TESTED from passed tests; **ASTRA-DLV-5** constrains diff/AC evidence; **ASTRA-DLV-6** requires a valid review outcome. These unblock trustworthy validation of HUB-37/E-01 and HUB-47/E-11. This document adds no parallel packet copies.

`scripts/delivery/agent-registry.mjs` remains the Agent Catalog's single source of truth. Lines `10–32` distinguish execution modes and required fields; `:145–240` register independent readonly reviewers as planned. Inline roles share the primary conversation; a catalog card does not imply a separate running agent. The driver records parent tool IDs while its current policy bans Task (`drivers/claude.mjs:710`), preserving a provenance field without asserting parallel execution exists.

**NEW, parked until DLV-93's two-product-completion evidence:** evaluate one independent readonly reviewer from that registry on a subsequent bounded HUB-47 follow-up. Give it the approved spec, exact diff, validation receipts and one explicit question. Record task identity, parent identity, scope, input artifact hashes, model/options, spend, verdict and evidence under the existing session directory. Keep one writer, the existing gate decisions and provider handoff policy. Evaluate added actionable findings against owner review minutes and total cost on that product outcome. The experiment succeeds only if it reduces owner work or catches a verified defect beyond the existing review; an extra transcript is not success. No generic agent platform or simultaneous writers are proposed.

## 8 · Reconciliation and execution order

| Refinement | Existing dock / study owner | Prerequisite and product unblocked |
|---|---|---|
| Per-attempt cost deltas | EXTENDS → DLV-87 / DLV-88; ASTRA-DLV-1 | First accounting correction; protects the bounded HUB-47 pilot. |
| Returned paid-result checkpoints and retry conservation | EXTENDS → DLV-87; ASTRA-DLV-2 | Correct delta units; keeps returned HUB-47 costs auditable. Pre-call reservation and open stubs remain held under DLV-68/91. |
| Request context distinct from throughput | EXTENDS → DLV-69; ASTRA-DLV-3 | Request-level metadata or an explicit unknown; prevents false rotation during HUB-47. |
| Evidence that actually tests and reviews the approved change | EXTENDS → DLV-90 and existing confidence work; ASTRA-DLV-4/5/6 | Protects HUB-37's CI receipts and HUB-47's product behavior. |
| Seed the already-built rotation package | EXTENDS → DLV-69; ASTRA-DLV-7 | Request-context fix; preserves decisions on the HUB-47 pilot. |
| Forecast from compatible traversal samples | EXTENDS → DLV-86; ASTRA-DLV-8 | ASTRA-DLV-1/2 and sample provenance first; ASTRA-DLV-3 is not a prerequisite. Interpretable HUB-47 launch envelope. |
| State/finish/evidence coherence | EXTENDS → DLV-12 / DLV-92; CC-3 | Current finish evidence matches its source state; owner can assess the actual HUB-47 outcome. No attempt-reservation scope. |
| One readonly reviewer experiment | NEW; conditional DLV-93 frontier | Two evidenced product completions first; measurable benefit on a later HUB-47 follow-up. |

This is a dependency explanation, not eight new mandatory sessions before product work. Follow the owning packets' allowlists, binary gates and freeze prerequisites. Do not expand DLV-89 into a general gate relaxation, silently apply current defaults to old packets, tune a cap to hide bad accounting, or classify an ACCEPTED label as the freeze's second product completion.

## ASTRA 10× Findings

- **High-confidence leverage 1 — EXTENDS → DLV-87 / DLV-88 / DLV-69:** separate cumulative provider readings, per-attempt cost and request context at the existing driver boundary. The same receipts then support honest caps, rotation and later forecasting; the Aug 6 arithmetic and Aug 22 rotation events prove the present coupling. Product: HUB-47/E-11.
- **High-confidence leverage 2 — EXTENDS → DLV-87 / DLV-12, with DLV-68/91 held:** checkpoint already-returned paid results in ASTRA-DLV-2 and make finish evidence match its source state in CC-3. Seventeen rows under eleven turn IDs also justify pre-call identity reservation and open stubs, but that separate DLV-68/91 work remains held; neither packet delivers it. Product: auditable returned costs and an assessable HUB-47 outcome, without claiming complete crash reconstruction.
- **High-confidence leverage 3 — EXTENDS → DLV-69:** deliver the context package that rotation already writes. Handoff demonstrates the existing seam; test the received fresh-session prompt instead of another saved snapshot. Product: HUB-47 continuation without repeating owner decisions.
- **Simplification / deletion — EXTENDS → DLV-86 / DLV-87:** derive phase and session totals from normalized attempt receipts instead of maintaining incompatible economic interpretations. Keep historical readings as provenance; remove throughput-based occupancy and phase-total-as-traversal logic. Product: a usable HUB-47 envelope without a new forecast subsystem.
- **Frontier — NEW, parked:** one artifact-backed independent readonly review after two evidenced product completions, using the registry and one writer. Reopening broader parallelism requires reduced owner review time or a verified additional defect caught on a bounded HUB-47 follow-up at an acceptable measured cost. No platform build is justified yet.
- **Uncomfortable finding:** the budget can overcount reused-session cost while losing failed work, then rotate because billed throughput looks like full context. Adding agents before correcting those units scales misleading evidence. The local accepted product session's stale BLOCKED finish package makes that a current trust problem, not a theoretical optimization concern.
