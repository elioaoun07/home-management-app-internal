# Graph Report - scripts/pm/app  (2026-09-15)

## Corpus Check
- Corpus is ~22,338 words - fits in a single context window. You may not need a graph.

## Summary
- 129 nodes · 147 edges · 8 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_agentRows  ago|agentRows / ago]]
- [[_COMMUNITY_activityBadges  backPath|activityBadges / backPath]]
- [[_COMMUNITY_api.ts  post|api.ts / post]]
- [[_COMMUNITY_act  applySuggestion|act / applySuggestion]]
- [[_COMMUNITY_canMove  move|canMove / move]]
- [[_COMMUNITY_checklistId  Empty|checklistId / Empty]]
- [[_COMMUNITY_Back  message|Back / message]]
- [[_COMMUNITY_compact  dayLabel|compact / dayLabel]]

## God Nodes (most connected - your core abstractions)
1. `transport()` - 8 edges
2. `useV2Session()` - 4 edges
3. `send()` - 4 edges
4. `readerPath()` - 4 edges
5. `checklistPath()` - 4 edges
6. `useWorld()` - 4 edges
7. `go()` - 4 edges
8. `setFilters()` - 3 edges
9. `set()` - 3 edges
10. `useV2Runs()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `runHref()` --calls--> `transport()`  [INFERRED]
  Dashboard.tsx → transport.ts
- `read()` --calls--> `transport()`  [INFERRED]
  api.ts → transport.ts
- `post()` --calls--> `transport()`  [INFERRED]
  api.ts → transport.ts
- `snapshot()` --calls--> `transport()`  [INFERRED]
  api.ts → transport.ts
- `v2Session()` --calls--> `transport()`  [INFERRED]
  api.ts → transport.ts

## Communities

### Community 0 - "agentRows / ago"
Cohesion: 0.11
Nodes (7): ago(), clock(), connectionChips(), executorLabel(), paths(), reasonLabel(), settingsLine()

### Community 1 - "activityBadges / backPath"
Cohesion: 0.13
Nodes (11): activityBadges(), briefPath(), checklistPath(), chipAnchor(), historyPath(), laneGroups(), laneOf(), liveRuns() (+3 more)

### Community 2 - "api.ts / post"
Cohesion: 0.18
Nodes (9): post(), read(), snapshot(), v2Pair(), v2Post(), v2Session(), PendingCommand, PmError (+1 more)

### Community 3 - "act / applySuggestion"
Cohesion: 0.24
Nodes (8): act(), control(), deliver(), send(), useV2Queue(), useV2Runs(), useV2Session(), useWorld()

### Community 4 - "canMove / move"
Cohesion: 0.22
Nodes (5): move(), setFilters(), change(), boardQueryString(), go()

### Community 5 - "checklistId / Empty"
Cohesion: 0.25
Nodes (2): identity(), SpaceIcon()

### Community 6 - "Back / message"
Cohesion: 0.22
Nodes (4): Back(), useCommand(), useRoute(), UndoNotice()

### Community 7 - "compact / dayLabel"
Cohesion: 0.25
Nodes (3): runHref(), set(), dashboardQueryString()

## Knowledge Gaps
- **Thin community `checklistId / Empty`** (9 nodes): `checklistId()`, `Empty()`, `ErrorNotice()`, `headingId()`, `identity()`, `PageTitle()`, `Sheet()`, `SpaceIcon()`, `components.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `go()` connect `canMove / move` to `Back / message`, `compact / dayLabel`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `set()` connect `compact / dayLabel` to `canMove / move`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Why does `transport()` connect `api.ts / post` to `compact / dayLabel`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `transport()` (e.g. with `read()` and `post()`) actually correct?**
  _`transport()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `agentRows / ago` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `activityBadges / backPath` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
Code-only structural extraction before the refactor; inferred calls require source verification. No provider calls.
