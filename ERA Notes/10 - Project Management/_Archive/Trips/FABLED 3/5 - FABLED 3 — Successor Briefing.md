---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/trips
---

# Trips · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to touch Trips. **This is the most dangerous module in the app relative to its size.** Its cascade machinery (auto account creation, schedule pauses, side-effect reversal) has never been verified end-to-end, and half its DB logic exists only in the live database, not in the repo. Read this whole file before editing anything.

## First 10 minutes in this cluster

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/trips src/app/api/trips src/app/trips src/components/trips src/lib/tripAccess.ts
grep -rn "activate_trip\|complete_trip" migrations/    # if still 0 hits, O1 is still open — the danger stands
find src tests -path "*trip*" -name "*.test.*"          # if still empty, Test protection is still 0
```

Then read: [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) (the X-ray — still normative) → `src/lib/tripAccess.ts` (the sharing guard) → `src/app/api/trips/[id]/activate/route.ts` (the cascade caller).

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| UI polish (cards, badges, packing list layout) | **any-model** | `ui-guardrails`; no lifecycle interaction |
| Places/packing CRUD field changes | **any-model** | copy existing route pattern; keep `getAccessibleTrip` as the ONLY access decision |
| Testing `tripAccess.ts` (O4) | **any-model** | pure function, mockable — see file 3 |
| Anything reading trip state for display elsewhere | **mid-tier+** | respect `scope`; never re-implement the access rule |
| Activate / complete / clone logic; `trip_side_effects`; pause writing | **human-first** | RPC bodies are not in the repo — you cannot verify what you'd be changing. Propose; let Elio run O1 first |
| Trip-account creation path | **human-first** | mirrors June-drifted accounts semantics (`money-rules` domain) |

**Out-of-depth tells — stop if:** you're about to call `supabase.rpc("activate_trip", …)` with changed arguments (you can't see the function body); you're adding a second place that decides trip visibility; you're writing schedule pauses from trip code without reading `recurrence-safety`.

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| RPC bodies live only in Supabase | grep finds callers but no definition; changes look "complete" but aren't verifiable | O1 (recover bodies) before ANY lifecycle change |
| Sharing is asymmetric | partner can edit packing but activate returns owner-only errors | by design — `tripAccess.ts` doc comment is the spec |
| Solo vs household scope | partner sees nothing for `scope: "solo"` | not a bug; check `scope` before debugging "missing" trips |
| Mirrored account logic ×2 | accounts semantics change silently breaks trip-account creation AND tripAccess assumptions | when touching `src/lib/accountAccess.ts` or `is_public`, grep for `tripAccess` + trip account creation |
| Empty delta ledger ≠ healthy | three generations of unchanged scores | read the `_index` verdict before assuming "stable" means "good" |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| RPC bodies still missing (O1 open) | `grep -rn "activate_trip" migrations/ \| wc -l` | 0 (if >0, O1 landed — update `_index` scoreboard) |
| 9 API routes | `find src/app/api/trips -name route.ts \| wc -l` | 9 |
| Zero tests (Test protection 0) | `find src tests -path "*trip*" -name "*.test.*" \| wc -l` | 0 (if >0, rescore) |
| Access rule is single-sourced | `grep -rln "scope === \"household\"" src \| wc -l` | 1 (`tripAccess.ts` only) |

## What FABLED 2 got wrong here

Nothing factual — its uncomfortable verdict was correct and remains correct. Its one miss was tonal: it predicted stakes would rise "when the world moves"; the world then moved (sharing shipped) directly onto the unverified core, and no alarm fired. Gen 3 adds the explicit G8 trigger: **unmoved at generation 4 = freeze the module in writing.**
