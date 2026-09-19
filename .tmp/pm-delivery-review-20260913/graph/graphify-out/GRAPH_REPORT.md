# Graph Report - scripts/delivery-v2 + scripts/pm/app (code only)  (2026-09-13)

## Corpus Check
- 50 files · ~113,100 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 526 nodes · 1223 edges · 16 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 314 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Contracts and Work References|Contracts and Work References]]
- [[_COMMUNITY_Provider Adapter Controls|Provider Adapter Controls]]
- [[_COMMUNITY_Queue and Job Coordination|Queue and Job Coordination]]
- [[_COMMUNITY_Journey and Execution Policy|Journey and Execution Policy]]
- [[_COMMUNITY_Candidate Application and Rollback|Candidate Application and Rollback]]
- [[_COMMUNITY_PM Board and Navigation|PM Board and Navigation]]
- [[_COMMUNITY_Delivery Routing and Pairing|Delivery Routing and Pairing]]
- [[_COMMUNITY_Qualification and Boundary Probes|Qualification and Boundary Probes]]
- [[_COMMUNITY_Criteria and Check Execution|Criteria and Check Execution]]
- [[_COMMUNITY_Delivery UI Session State|Delivery UI Session State]]
- [[_COMMUNITY_Delivery Display Model|Delivery Display Model]]
- [[_COMMUNITY_Owner Plan Interaction|Owner Plan Interaction]]
- [[_COMMUNITY_Qualification Receipt Integrity|Qualification Receipt Integrity]]
- [[_COMMUNITY_Worker Isolation Configuration|Worker Isolation Configuration]]
- [[_COMMUNITY_API Transport|API Transport]]
- [[_COMMUNITY_Worker Process Runtime|Worker Process Runtime]]

## God Nodes (most connected - your core abstractions)
1. `deepFreeze()` - 141 edges
2. `normalizePath()` - 30 edges
3. `contentId()` - 26 edges
4. `routeDeliveryV2()` - 16 edges
5. `buildDeliver()` - 15 edges
6. `observeAbsence()` - 13 edges
7. `runCheck()` - 11 edges
8. `authenticateLocal()` - 11 edges
9. `makeExecutionRef()` - 11 edges
10. `runQualification()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `rejectWorkerIdentity()` --calls--> `deepFreeze()`  [INFERRED]
  delivery-v2\candidate.mjs → delivery-v2\contracts.mjs
- `verifyReceipt()` --calls--> `deepFreeze()`  [INFERRED]
  delivery-v2\checks.mjs → delivery-v2\contracts.mjs
- `coordinationRules()` --calls--> `deepFreeze()`  [INFERRED]
  delivery-v2\coordination.mjs → delivery-v2\contracts.mjs
- `itemFacts()` --calls--> `deepFreeze()`  [INFERRED]
  delivery-v2\coordination.mjs → delivery-v2\contracts.mjs
- `guardV1Route()` --calls--> `deepFreeze()`  [INFERRED]
  delivery-v2\entry.mjs → delivery-v2\contracts.mjs

## Communities

### Community 0 - "Contracts and Work References"
Cohesion: 0.09
Nodes (48): comparabilityReport(), isNonEmptyString(), normalizeEffort(), planBaselineRecord(), recordBaselineObservation(), totalOwnerMinutes(), authorizeContract(), authorizeGrant() (+40 more)

### Community 1 - "Provider Adapter Controls"
Cohesion: 0.07
Nodes (31): assertAdapterShape(), bindAdapterResult(), finalizeProfile(), isNonEmptyString(), makeControl(), makeExecutionRef(), makeJobRequest(), makeResumeRequest() (+23 more)

### Community 2 - "Queue and Job Coordination"
Cohesion: 0.08
Nodes (40): capacityReasons(), checkResourcesFor(), classify(), clean(), consumedPaths(), coordinate(), coordinationRules(), dedupe() (+32 more)

### Community 3 - "Journey and Execution Policy"
Cohesion: 0.09
Nodes (30): admitProfile(), admitExecutorProfile(), createExecutor(), describeExecutor(), isNonEmptyString(), resolveExecutorChoice(), validateRunSettings(), verifyEffectiveSettings() (+22 more)

### Community 4 - "Candidate Application and Rollback"
Cohesion: 0.13
Nodes (36): afterImage(), beforeImage(), ensureParents(), hashBytes(), hashFile(), inspectDestination(), inspectOperations(), integratedSnapshot() (+28 more)

### Community 5 - "PM Board and Navigation"
Cohesion: 0.07
Nodes (19): move(), setFilters(), runHref(), set(), change(), activityBadges(), boardQueryString(), briefPath() (+11 more)

### Community 6 - "Delivery Routing and Pairing"
Cohesion: 0.15
Nodes (36): listExecutors(), summarizeCriteria(), authenticateCommand(), dispatchModePath(), executorSelectionPath(), guardV1Route(), isLoopbackOrigin(), isNonEmptyString() (+28 more)

### Community 7 - "Qualification and Boundary Probes"
Cohesion: 0.14
Nodes (28): runCanary(), buildCanaryEnvironment(), classifyControls(), collectRuntimeFacts(), permissionProfileToml(), run(), runOneCanary(), runQualification() (+20 more)

### Community 8 - "Criteria and Check Execution"
Cohesion: 0.12
Nodes (28): assertRestrictedEnvironment(), attributeSuppliedLog(), detectOracleDrift(), filePresenceObservation(), isNonEmptyString(), malformedReviewObservation(), parseTestCounts(), pinCheckPlan() (+20 more)

### Community 9 - "Delivery UI Session State"
Cohesion: 0.08
Nodes (14): Back(), identity(), SpaceIcon(), act(), control(), deliver(), send(), useV2Queue() (+6 more)

### Community 10 - "Delivery Display Model"
Cohesion: 0.11
Nodes (7): ago(), clock(), connectionChips(), executorLabel(), paths(), reasonLabel(), settingsLine()

### Community 11 - "Owner Plan Interaction"
Cohesion: 0.16
Nodes (18): answerQuestion(), approvalFor(), clip(), decidePlan(), extractQuestions(), implementationInstruction(), investigationInstruction(), isNonEmptyString() (+10 more)

### Community 12 - "Qualification Receipt Integrity"
Cohesion: 0.17
Nodes (17): canonicalJson(), contentId(), deriveWorkId(), deriveRunId(), deriveJobId(), isNonEmptyString(), loadQualification(), makeQualificationReceipt() (+9 more)

### Community 13 - "Worker Isolation Configuration"
Cohesion: 0.18
Nodes (12): assertNoHostAuthority(), buildWorkerImage(), checkerRunArgs(), containerNameFor(), createContainerRuntime(), hardenedFlags(), isNonEmptyString(), isPlainObject() (+4 more)

### Community 14 - "API Transport"
Cohesion: 0.17
Nodes (10): post(), read(), snapshot(), v2Pair(), v2Post(), v2Session(), PendingCommand, PmError (+2 more)

### Community 15 - "Worker Process Runtime"
Cohesion: 0.7
Nodes (4): credentialEnv(), emit(), main(), packageVersion()

## Knowledge Gaps
- **1 isolated node(s):** `ContractError`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `deepFreeze()` connect `Contracts and Work References` to `Provider Adapter Controls`, `Queue and Job Coordination`, `Journey and Execution Policy`, `Candidate Application and Rollback`, `Delivery Routing and Pairing`, `Qualification and Boundary Probes`, `Criteria and Check Execution`, `Owner Plan Interaction`, `Qualification Receipt Integrity`, `Worker Isolation Configuration`, `API Transport`?**
  _High betweenness centrality (0.420) - this node is a cross-community bridge._
- **Why does `read()` connect `API Transport` to `Queue and Job Coordination`, `Journey and Execution Policy`, `Qualification Receipt Integrity`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `transport()` connect `API Transport` to `PM Board and Navigation`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Are the 129 inferred relationships involving `deepFreeze()` (e.g. with `inspectDestination()` and `planApplication()`) actually correct?**
  _`deepFreeze()` has 129 INFERRED edges - model-reasoned connections that need verification._
- **Are the 28 inferred relationships involving `normalizePath()` (e.g. with `isProtectedPath()` and `ensureParents()`) actually correct?**
  _`normalizePath()` has 28 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `contentId()` (e.g. with `planApplication()` and `planBaselineRecord()`) actually correct?**
  _`contentId()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `routeDeliveryV2()` (e.g. with `sessionView()` and `listExecutors()`) actually correct?**
  _`routeDeliveryV2()` has 10 INFERRED edges - model-reasoned connections that need verification._

## Review scope limitations

Code-only deterministic AST extraction: no semantic extraction, no production/provider calls. The graph captures recognized declarations and relationships; isolated TSX components are an extractor limitation and must not be interpreted as proof of architectural isolation. Shared utility centrality (especially deepFreeze) is not a defect by itself.

Inferred call-name matching also creates false positives across unrelated files. Example: `buildDeliver()` was linked to PM `api.ts` `read()` merely by a generic call name; source review must validate cross-file inferred relationships. The automated Surprising Connections section primarily reflects utility calls and is not a defect list.
