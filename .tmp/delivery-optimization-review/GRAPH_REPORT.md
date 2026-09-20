# Graph Report - scripts/delivery-v2  (2026-09-20)

## Corpus Check
- 44 files · ~110,299 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 497 nodes · 1305 edges · 14 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 345 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Native adapters and jobs|Native adapters and jobs]]
- [[_COMMUNITY_Baseline and contracts|Baseline and contracts]]
- [[_COMMUNITY_Qualification and task briefs|Qualification and task briefs]]
- [[_COMMUNITY_Candidate Apply and rollback|Candidate Apply and rollback]]
- [[_COMMUNITY_Command entry and selection|Command entry and selection]]
- [[_COMMUNITY_Worker confinement battery|Worker confinement battery]]
- [[_COMMUNITY_Resource allowance windows|Resource allowance windows]]
- [[_COMMUNITY_Protected check evidence|Protected check evidence]]
- [[_COMMUNITY_Concurrent run coordination|Concurrent run coordination]]
- [[_COMMUNITY_Subscription observation|Subscription observation]]
- [[_COMMUNITY_Executor profile registry|Executor profile registry]]
- [[_COMMUNITY_Supervisor service and store|Supervisor service and store]]
- [[_COMMUNITY_Typecheck verification|Typecheck verification]]
- [[_COMMUNITY_TypeScript runner|TypeScript runner]]

## God Nodes (most connected - your core abstractions)
1. `deepFreeze()` - 156 edges
2. `normalizePath()` - 32 edges
3. `contentId()` - 28 edges
4. `buildDeliver()` - 19 edges
5. `routeDeliveryV2()` - 16 edges
6. `fingerprint()` - 13 edges
7. `observeAbsence()` - 13 edges
8. `inspectDestination()` - 11 edges
9. `runCheck()` - 11 edges
10. `authenticateLocal()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `candidateReview()` --calls--> `candidateChangedPaths()`  [INFERRED]
  review.mjs → candidate.mjs
- `withinPrefix()` --calls--> `normalizePath()`  [INFERRED]
  candidate.mjs → contracts.mjs
- `rejectWorkerIdentity()` --calls--> `deepFreeze()`  [INFERRED]
  candidate.mjs → contracts.mjs
- `verifyReceipt()` --calls--> `deepFreeze()`  [INFERRED]
  checks.mjs → contracts.mjs
- `deriveJobId()` --calls--> `contentId()`  [INFERRED]
  jobs.mjs → contracts.mjs

## Communities

### Community 0 - "Native adapters and jobs"
Cohesion: 0.05
Nodes (51): assertAdapterShape(), bindAdapterResult(), finalizeProfile(), isNonEmptyString(), makeControl(), makeExecutionRef(), makeJobRequest(), makeResumeRequest() (+43 more)

### Community 1 - "Baseline and contracts"
Cohesion: 0.08
Nodes (55): comparabilityReport(), isNonEmptyString(), normalizeEffort(), planBaselineRecord(), recordBaselineObservation(), totalOwnerMinutes(), authorizeContract(), authorizeGrant() (+47 more)

### Community 2 - "Qualification and task briefs"
Cohesion: 0.07
Nodes (35): canonicalJson(), isNonEmptyString(), loadQualification(), makeQualificationReceipt(), receiptBody(), verifyQualificationReceipt(), writeQualificationReceipt(), setupSubscriptions() (+27 more)

### Community 3 - "Candidate Apply and rollback"
Cohesion: 0.11
Nodes (37): afterImage(), beforeImage(), ensureParents(), hashBytes(), hashFile(), inspectDestination(), inspectOperations(), integratedSnapshot() (+29 more)

### Community 4 - "Command entry and selection"
Cohesion: 0.14
Nodes (37): listExecutors(), summarizeCriteria(), authenticateCommand(), deriveRunId(), dispatchModePath(), executorSelectionPath(), guardV1Route(), isLoopbackOrigin() (+29 more)

### Community 5 - "Worker confinement battery"
Cohesion: 0.13
Nodes (29): isProtectedPath(), normalizePath(), runCanary(), buildCanaryEnvironment(), classifyControls(), permissionProfileToml(), runOneCanary(), runQualification() (+21 more)

### Community 6 - "Resource allowance windows"
Cohesion: 0.1
Nodes (29): applyAllowanceChange(), defaultAllowances(), effectiveGrant(), effectivePolicy(), fleetWindow(), isAmount(), limitOrNull(), normalizeAllowances() (+21 more)

### Community 7 - "Protected check evidence"
Cohesion: 0.12
Nodes (28): assertRestrictedEnvironment(), attributeSuppliedLog(), detectOracleDrift(), filePresenceObservation(), isNonEmptyString(), malformedReviewObservation(), parseTestCounts(), pinCheckPlan() (+20 more)

### Community 8 - "Concurrent run coordination"
Cohesion: 0.11
Nodes (28): capacityReasons(), checkResourcesFor(), classify(), clean(), consumedPaths(), coordinate(), coordinationRules(), dedupe() (+20 more)

### Community 9 - "Subscription observation"
Cohesion: 0.15
Nodes (20): compareObservations(), finite(), round(), subscriptionObservation(), subscriptionRecord(), validIdentity(), window(), emit() (+12 more)

### Community 10 - "Executor profile registry"
Cohesion: 0.16
Nodes (23): admitProfile(), admitExecutorProfile(), createExecutor(), describeExecutor(), isNonEmptyString(), resolveExecutorChoice(), validateRunSettings(), verifyEffectiveSettings() (+15 more)

### Community 11 - "Supervisor service and store"
Cohesion: 0.13
Nodes (12): parseJson(), planView(), openStore(), payloadDigest(), publishArtifact(), readArtifact(), sha256(), verifyRestore() (+4 more)

### Community 12 - "Typecheck verification"
Cohesion: 0.24
Nodes (12): candidateChangedPaths(), candidateOverlay(), checkerConfigurationChanges(), classifyDiagnostics(), clip(), diagnosticKey(), environmentVerdict(), isNonEmptyString() (+4 more)

### Community 13 - "TypeScript runner"
Cohesion: 0.57
Nodes (6): formatDiagnostic(), main(), parseArgs(), posix(), readConfig(), splitList()

## Knowledge Gaps
- **1 isolated node(s):** `ContractError`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `deepFreeze()` connect `Baseline and contracts` to `Native adapters and jobs`, `Qualification and task briefs`, `Candidate Apply and rollback`, `Command entry and selection`, `Worker confinement battery`, `Resource allowance windows`, `Protected check evidence`, `Concurrent run coordination`, `Subscription observation`, `Executor profile registry`, `Supervisor service and store`, `Typecheck verification`?**
  _High betweenness centrality (0.410) - this node is a cross-community bridge._
- **Why does `normalizePath()` connect `Worker confinement battery` to `Baseline and contracts`, `Qualification and task briefs`, `Candidate Apply and rollback`, `Protected check evidence`, `Concurrent run coordination`, `Executor profile registry`, `Supervisor service and store`, `Typecheck verification`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `subscriptionObservation()` connect `Subscription observation` to `Baseline and contracts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 144 inferred relationships involving `deepFreeze()` (e.g. with `inspectDestination()` and `planApplication()`) actually correct?**
  _`deepFreeze()` has 144 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `normalizePath()` (e.g. with `isProtectedPath()` and `ensureParents()`) actually correct?**
  _`normalizePath()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `contentId()` (e.g. with `planApplication()` and `previewRollback()`) actually correct?**
  _`contentId()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `buildDeliver()` (e.g. with `refuse()` and `resolveExecutorChoice()`) actually correct?**
  _`buildDeliver()` has 11 INFERRED edges - model-reasoned connections that need verification._