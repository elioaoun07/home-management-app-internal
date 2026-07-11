---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: whole-app
evidence_cutoff: 2026-07-11
---

# Global · Feature State

> [FABLED+ root](<../_index.md>) · [Global index](<_index.md>) · **1 · Feature State** · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Executive assessment

This is a large, real system: 40 mapped feature domains, deep household data, 186 APIs, 87 schema tables, offline behavior, AI fallbacks, Google Calendar, push, voice, NFC, watch, guest, and a documentation/agent operating system. The main constraint is no longer missing breadth. It is **assurance density**: how much of that breadth is provably current, safe across both people, replayable offline, explainable before action, and measured after action.

The structural/semantic graph reinforces the conclusion. Its most connected code nodes are `supabaseServer()`, `safeFetch()`, `format()`, `supabaseAdmin()`, and `useThemeClasses()`: authentication/data access, mutation transport, temporal semantics, privileged automation, and identity presentation are the real portfolio choke points. Improvements there propagate farther than another standalone screen.

## Current technical snapshot

Snapshot command set was run on 2026-07-11 after commit `0a39c4e`.

| Measure | Current evidence | Interpretation |
|---|---:|---|
| TypeScript/JavaScript source files | **811** | Large solo-maintained estate. |
| Source LOC | **248,590** | Requires mechanical contracts and pruning, not memory. |
| API route files | **186** | The main unprotected contract surface. |
| App pages | **38** | Navigation breadth is lower than feature breadth because many modules share surfaces. |
| Schema tables | **87** | Data breadth is a moat and an operational burden. |
| Test files | **16** | Protection remains concentrated relative to route/junction count. |
| Files ≥1,000 lines | **52** | Behavioral concentration is systemic. |
| Files ≥2,000 lines | **13** | Hub, shopping, recurring, expense, items, guest, dashboards, and planners dominate change risk. |
| `console.log/warn/error` matches | **575** | Structured observability is not yet the default choke point. |
| `as any` matches | **202** | Type escape is material despite strict TypeScript. |
| Feature Map entries | **40** | This study has one pack for every entry. |
| Graph corpus | **877 files / 778K words** | Full source structure plus 70 high-value current strategy docs. |
| Knowledge graph | **3,656 nodes / 4,338 edges** | 105 meaningful communities after clustering. |

## Verification results

- `npm run typecheck` passed at study start.
- `npm run docs:check` passed; it verifies Feature Index ↔ Feature Map consistency, not every literal source reference.
- The final test run was **136 passing / 1 failing** across 16 test files. The failure is the existing flexible-occurrence cross-view guard for `WebTodayView`; this is precisely the kind of semantic drift TypeScript cannot catch.
- Full `npm run lint` did not finish inside a 120-second audit window. It is **unmeasured**, not green.
- The merchant-mapping delta added `merchantMatch.test.ts`, shared household mappings, and a query-key addition; those tests passed in the final run.

## What is already exceptional

1. **Capture physics:** Hub, forms, voice, watch, NFC, import, templates, drafts, and offline paths make reality cheap to record.
2. **Money discipline:** account-type signs, balance choke points, recurring commitment helpers, deterministic fallbacks, and new route-contract tests show mature correctness instincts.
3. **Two-person identity:** household links, own/public semantics, and person-absolute colors make partnership architectural rather than cosmetic.
4. **Proposal safety:** AI-proposes → human-reviews → trusted mutation → Undo is the correct system grammar.
5. **Lebanese reality:** LBP-in-thousands, custom month, poor-connectivity assumptions, and local household details form a defensible product wedge.
6. **Development OS:** Feature Map, vault, playbooks, hooks, Atlas, PM dashboard, and FABLED preserve reasoning unusually well.

## Portfolio outcome loop

| Stage | Portfolio state | Assessment |
|---|---|---|
| **Observe** | Many capture modalities and 87 tables | Strong |
| **Interpret** | Utilities, parsers, analytics, Gemini, registries | Capable but inconsistent evidence envelopes |
| **Propose** | Drafts, review sheets, planners, notifications | Strong pattern, uneven contract |
| **Commit** | 186 APIs and optimistic mutations | Broad, insufficiently contract-tested |
| **Verify** | Some history, receipts, coverage, logs | Weakly standardized |
| **Learn** | A few mappings/feedback seams | Weakest stage |

## Updated feedback: technical drift worth acting on

### 1 · Authoritative constants disagree

The repository instructions say `safeFetch` defaults to **3 seconds**. `src/lib/safeFetch.ts` currently sets `DEFAULT_TIMEOUT_MS = 8_000`; its own prose says **5 seconds**. The behavior may be correct, but the three truths are not. Because `safeFetch()` is the graph's second-most-connected abstraction, this is high-leverage documentation debt.

### 2 · A mapped module is partly a ghost

The Focus Feature Map names a page, layout, components, and feature files absent from the tree. Only `src/app/api/focus-insights/route.ts` and schedule-adjacent behavior remain. The [Focus pack](<../Features/Standalone/focus/_index.md>) recommends an ownership decision before revival.

### 3 · Contract coverage is inverted

The strongest pure money utilities have tests; the highest-risk bridges and 186 route files largely do not. A coarse scan found 156 mutation-route files and 103 without an obvious Zod parse signal. That is an **audit queue, not a confirmed violation count**—some routes validate manually or have no body—but it proves validation posture is not mechanically legible.

### 4 · Semantic duplication survives centralization

`src/lib/queryConfig.ts` exports one `queryKeys` object while `src/lib/queryKeys.ts` exports `qk`. The current merchant work correctly extended `qk`, yet two factories still make cache ownership harder to prove. Similar semantic duplication appears in dashboard generations, conversation stores, and route-level validation styles.

### 5 · Megafiles are behavior maps, not just style debt

`HubPage.tsx` is about 5,978 lines; `ShoppingListView.tsx` about 3,229; recurring page about 3,083; expense form about 2,999; `useItems.ts` about 2,665. Splitting by size alone is risky. Extract only when a shipped feature establishes a stable behavioral seam and reduces the parent.

### 6 · The schema is broader than its repository proof

`migrations/schema.sql` contains 87 tables but only one explicit index statement and one bundled function body in the snapshot. The repo itself warns that live RLS/functions are not fully captured. Business-critical restore, performance, and access confidence therefore require live verification or exported contracts, not schema-file inference.

### 7 · Analysis artifacts need an ownership decision

The graph run produced valuable `graphify-out/graph.html`, `graph.json`, and `GRAPH_REPORT.md`, plus large extraction/cache files. Keep the three user-facing outputs if desired; move or remove working caches from source control only through an explicit repository-hygiene decision. They are evidence tooling, not application source.

## Bottom line

The app is technically ambitious enough. The next quality level comes from making uncertainty and causality visible, testing the seams that cross modules, rehearsing automation before delivery, and measuring whether actions improved household outcomes.
