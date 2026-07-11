---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Error Logs
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Error Logs · Feature State

> [FABLED+ root](<../../../_index.md>) · **Error Logs** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A persistent error viewer exists, but the codebase still contains hundreds of console calls and the mapped logger utility is absent, leaving operational knowledge split between structured records, browser noise, and silent catches.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/error-logs.md`
- `ERA Notes/02 - Standalone Modules/Error Logs/Overview.md`
- `src/app/error-logs/page.tsx`
- `src/app/api/error-logs/route.ts`
- `migrations/schema.sql`
- `src/lib/safeFetch.ts`
- `src/features/voice-conversation/conversationEngine.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Some structured errors and many console messages are produced. |
| **Interpret** | The viewer lists records; causal grouping is limited. |
| **Propose** | Little recovery guidance is generated. |
| **Commit** | Users/agents can inspect or clear records. |
| **Verify** | Errors are not consistently tied to user-visible preservation/retry outcome. |
| **Learn** | Repeated causal fingerprints do not become tested known-cause rules automatically. |

## Existing leverage

- A persisted error_logs table and viewer provide a base for durable diagnosis.
- Error boundaries and API responses exist across many surfaces.
- The July audit already established console hygiene as a known systemic issue.

## Feedback, friction, and risk

- 575 console calls in the current source scan compete with structured logging and violate the declared no-console rule.
- Feature Map points to src/lib/logger.ts, which is absent, so the documented choke point does not exist.
- Silent catches and split client/server context make one incident appear as unrelated symptoms.

## Study conclusion

**Inference:** Make errors into recovery narratives: one causal fingerprint, preserved user intent, attempted recovery, and a reproducible fixture.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/app/error-logs/page.tsx" "src/app/api/error-logs/route.ts" "migrations/schema.sql" "src/lib/safeFetch.ts"

Run focused tests and inspect consumers before implementation.

