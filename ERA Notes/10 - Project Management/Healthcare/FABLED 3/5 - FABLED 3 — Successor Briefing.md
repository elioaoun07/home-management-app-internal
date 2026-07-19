---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
first_generation: 3
tags:
  - pm/fabled3
  - module/healthcare
---

# Healthcare · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to change Healthcare code. This file tells you what is safe for you, what is not, and how to check that this audit is still true. Short sentences on purpose. If anything here contradicts the code, the code wins — fix this file.

## First 10 minutes in this cluster

Run these, in order:

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/healthcare src/app/api/healthcare src/app/healthcare src/lib/health
npx vitest run src/lib/health/allergenMatch.test.ts
find src/app/api/healthcare -name "route.ts"        # expect 10
```

Then read: `../4 - Checklist.md` (the queue) → `src/app/api/healthcare/allergies/route.ts` (the canonical route) → `migrations/2026-07-17_healthcare-core.sql` §4–5 (RLS + RPCs).

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| Add/change a field on profiles/allergies/conditions/vaccines | **any-model** | `add-feature` skill; copy `allergies/route.ts` pattern; migration file first (Hard Rule 24) |
| UI changes on the healthcare page | **any-model** | `ui-guardrails`; extract into `src/components/healthcare/`, don't grow `HealthcareClient.tsx` |
| New CRUD entity following the existing 4-table shape | **any-model** | mirror the trigger + direct-RLS pattern from the core migration exactly |
| Medications / dose scheduling (HLTH-8..12) | **mid-tier+** | `recurrence-safety` + `timezone-handling` + `db-migration` open; one materialization choke point, never a second expansion engine |
| Changing RLS policies or RPC visibility logic | **human-first** | partner-visible medical data; propose SQL, let Elio run and verify with both accounts |
| Anything touching `shared_with_household` semantics | **human-first** | privacy boundary is undocumented (Gap #5); ask before assuming |

**Out-of-depth tells — stop if:** you're about to add an `EXISTS`-subquery RLS policy (Hard Rule 20 violation); you can't say which of the two recurrence systems your medication change belongs to; you're writing a second place that decides profile visibility (it lives ONLY in the RPCs).

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Migration not yet run in prod (HLTH-7) | healthcare page 500s / RPC "function does not exist" | run `migrations/2026-07-17_healthcare-core.sql` first; it's idempotent |
| Slug is `healthcare`, tables are `health_*` | grep misses, wrong route paths | never create routes under `/api/health` (that's the connectivity probe!) |
| `managing_user_id` on children is trigger-set | manually setting it seems to work, then diverges on profile move | let the trigger own it; never bypass with service role |
| Bundle cache invalidation is dual | stale allergen warnings in recipes after a mutation | every healthcare mutation must invalidate BOTH `healthcareKeys.all` and `householdAllergenKeys.all` (hooks.ts:80–81) |
| `/api/health` vs `/api/healthcare` | connectivity manager probes `/api/health` every 30s | breaking that route makes the whole app think it's offline (Hard Rule 7) |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| 10 API routes | `find src/app/api/healthcare -name route.ts \| wc -l` | 10 |
| RLS is direct-column, no EXISTS | `grep -n "EXISTS" migrations/2026-07-17_healthcare-core.sql` | no policy hits (only comments if any) |
| schema.sql paired | `grep -c "health_" migrations/schema.sql` | ≥ 38 |
| Allergen matcher tested | `npx vitest run src/lib/health/allergenMatch.test.ts` | green |
| Dual invalidation intact | `grep -n "householdAllergenKeys" src/features/healthcare/hooks.ts` | hit in mutation onSuccess |

## What FABLED 2 got wrong here

Nothing — Healthcare post-dates FABLED 2 (shipped 2026-07-17; FABLED 2 stamped 2026-07-02). This module has never been audited before. Distrust ANY older doc that claims a "Health" module exists under a different slug.
