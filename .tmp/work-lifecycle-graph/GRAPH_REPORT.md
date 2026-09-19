# Graph Report - PM Work and Delivery lifecycle  (2026-09-15)

## Corpus Check
- 16 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 210 nodes · 408 edges · 13 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Delivery  components|Delivery / components]]
- [[_COMMUNITY_Board  model|Board / model]]
- [[_COMMUNITY_Work  model|Work / model]]
- [[_COMMUNITY_components  metrics|components / metrics]]
- [[_COMMUNITY_declarations  portfolio|declarations / portfolio]]
- [[_COMMUNITY_server-routes|server-routes]]
- [[_COMMUNITY_DeliveryV2|DeliveryV2]]
- [[_COMMUNITY_server-routes|server-routes]]
- [[_COMMUNITY_server-routes|server-routes]]
- [[_COMMUNITY_server-routes|server-routes]]
- [[_COMMUNITY_product  server-routes|product / server-routes]]
- [[_COMMUNITY_server-routes|server-routes]]
- [[_COMMUNITY_server-routes|server-routes]]

## God Nodes (most connected - your core abstractions)
1. `fail()` - 25 edges
2. `routeDelivery()` - 24 edges
3. `readSession()` - 19 edges
4. `startSession()` - 19 edges
5. `sessionsDirOf()` - 11 edges
6. `getRecommendation()` - 9 edges
7. `isTerminal()` - 7 edges
8. `deliveryBlockReason()` - 7 edges
9. `listSessionIds()` - 7 edges
10. `getContext()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `outcomeSeries()` --calls--> `Empty()`  [INFERRED]
  scripts\pm\shared\metrics.mjs → scripts\pm\app\components.tsx
- `canDeliver()` --calls--> `deliveryBlockReason()`  [INFERRED]
  scripts\pm\app\model.ts → scripts\pm\shared\work-lifecycle.mjs
- `assertActionableItem()` --calls--> `deliveryBlockReason()`  [INFERRED]
  scripts\delivery\server-routes.mjs → scripts\pm\shared\work-lifecycle.mjs
- `buildWorld()` --calls--> `parseDecisions()`  [INFERRED]
  scripts\pm\app\model.ts → scripts\pm\shared\product.mjs
- `parseOutcomes()` --calls--> `historyRecords()`  [INFERRED]
  scripts\pm\shared\product.mjs → scripts\pm\shared\history.mjs

## Communities

### Community 0 - "Delivery / components"
Cohesion: 0.09
Nodes (14): identity(), SpaceIcon(), buildWorld(), historyRecords(), parseHistory(), sectionLines(), buildPortfolio(), deriveCampaigns() (+6 more)

### Community 1 - "Board / model"
Cohesion: 0.1
Nodes (14): move(), setFilters(), activityBadges(), boardQueryString(), briefPath(), checklistPath(), chipAnchor(), historyPath() (+6 more)

### Community 2 - "Work / model"
Cohesion: 0.13
Nodes (15): canDeliver(), acceptanceRevision(), acceptanceText(), freezeSelectedItem(), makeSelectionWitness(), parseWorkItems(), recheckContractSource(), resolutionFailure() (+7 more)

### Community 3 - "components / metrics"
Cohesion: 0.13
Nodes (13): Empty(), bugs(), count(), dayKey(), dayMs(), finite(), openWork(), outcomeSeries() (+5 more)

### Community 4 - "declarations / portfolio"
Cohesion: 0.15
Nodes (6): declaredTouches(), dependencyIds(), isHeld(), lineValues(), matchesPerspective(), sessionForTask()

### Community 5 - "server-routes"
Cohesion: 0.21
Nodes (12): appendUnderHeading(), buildLaunchContextManifest(), computeFleetMetrics(), contextEntry(), escapeRegExp(), findPreLaunchAcceptanceCriteria(), isBuildLockActive(), listSessionIds() (+4 more)

### Community 6 - "DeliveryV2"
Cohesion: 0.18
Nodes (7): act(), control(), deliver(), send(), useV2Queue(), useV2Runs(), useV2Session()

### Community 7 - "server-routes"
Cohesion: 0.29
Nodes (14): defaultSpawnRunner(), fail(), getArtifact(), getCapabilities(), getContextSnapshot(), getEvents(), getPrompt(), getSalvage() (+6 more)

### Community 8 - "server-routes"
Cohesion: 0.27
Nodes (11): assertActionableItem(), buildLaunchPreview(), buildSkillRefs(), computeScopeHints(), findCampaignFiles(), getRecommendation(), loadRecommendationHistory(), readWorkspacePreflight() (+3 more)

### Community 9 - "server-routes"
Cohesion: 0.2
Nodes (10): computeContextHealth(), computeForecastActual(), getContext(), getContextPreview(), getMemory(), getQuestions(), getSession(), listArtifactsRecursive() (+2 more)

### Community 10 - "product / server-routes"
Cohesion: 0.39
Nodes (9): findActiveSessionForItem(), markSuperseded(), nextSeqInDir(), postControl(), postDecision(), postMessage(), postResume(), readSession() (+1 more)

### Community 11 - "server-routes"
Cohesion: 0.5
Nodes (5): assertWorkspacePreflightCurrent(), captureWorkspacePreflight(), getWorkspacePreflight(), sha1(), workspaceFingerprint()

### Community 13 - "server-routes"
Cohesion: 1.0
Nodes (1): DeliveryRouteError

## Knowledge Gaps
- **Thin community `server-routes`** (2 nodes): `DeliveryRouteError`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isTerminal()` connect `product / server-routes` to `Delivery / components`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Delivery / components` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Board / model` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Work / model` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `components / metrics` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._