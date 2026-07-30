---
created: 2026-07-18
type: index
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
first_generation: 3
tags:
  - pm/fabled3
  - module/healthcare
---

# Healthcare · FABLED 3 — Index

> **FABLED 3** is the generational audit layer's third generation, created 2026-07-18 as part of a **model-generation handoff** (Claude Fable 5 → successor models), not because the >40%/6-month supersession rule was met. Healthcare joins the layer **at generation 3** — no v1/v2 predecessors exist; the delta ledger starts here. When FABLED and the code disagree, the code wins — and FABLED gets the correction.

| File | Read it when… |
|---|---|
| [3.1 Current Implementation](<1 - FABLED 3 — Current Implementation.md>) | you need what actually exists and how it works |
| [3.2 Gaps & Missing](<2 - FABLED 3 — Gaps & Missing.md>) | you want what's absent, fragile, or risky |
| [3.3 Optimization Plan](<3 - FABLED 3 — Optimization Plan.md>) | you want the ranked next actions |
| [3.4 Future Enhancements](<4 - FABLED 3 — Future Enhancements.md>) | you want the bigger ideas with kill criteria |
| [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>) | **you are a successor model about to work here — read this first** |

## Maturity scoreboard (2026-07-18)

Rubric: 0–2 absent · 3–4 fragile · 5–6 works-but-exposed · 7–8 solid · 9–10 hardened.

| Dimension | Score | Why (evidence) |
|---|---|---|
| Data correctness | 7 | Trigger-synced `managing_user_id`, soft delete, owner-only RLS + SECURITY DEFINER visibility RPCs (`migrations/2026-07-17_healthcare-core.sql`) — but the migration is **not yet run in prod** (HLTH-7 open) |
| Test protection | 3 | Only `src/lib/health/allergenMatch.test.ts`; zero route tests |
| Cross-module bridges | 4 | Recipes allergen warning live (`RecipeAllergenWarning.tsx`, `useHouseholdAllergens.ts`); Items/gcal medication junction (Phase 2) unbuilt |
| Code health | 8 | 2,239 LOC total, house-pattern compliant (bundle RPC HR21, Zod, 23505→409, safeFetch); the one blob is `HealthcareClient.tsx` at 1,013 lines |
| AI leverage | 2 | No Hub Chat intent, no briefing signal (HLTH-17 queued) |
| **Overall** | **4.8** | Young, clean, unprotected |
| **Handoff readiness** | **5** | Any-model for scoped CRUD (patterns are exemplary); medications Phase 2 is mid-tier+ (recurrence-safety + timezone domains); no domain skill yet (HLTH-19) |

## Delta ledger (FABLED 3 era, append-only)

- **2026-07-18** (generation created): Healthcare first audited 1 day after Phase 1 shipped (`9a037d8`, 2026-07-17). Evidence cutoff `f0a8e19`.

## The next 3 moves

1. **HLTH-7** — run the core migration in Supabase SQL Editor + verify allergen warning on both accounts. Until then the module is UI over a missing schema.
2. Route tests for the 10 API routes before Phase 2 lands on top of them.
3. **HLTH-19** early, not late — author the `healthcare` domain skill *before* medications (Phase 2), so the safety-critical work is skill-guarded from day one.

Siblings: [Budget](<../../Budget/FABLED 3/_index.md>) · [Schedule](<../../Schedule/FABLED 3/_index.md>) · [Kitchen](<../../Kitchen/FABLED 3/_index.md>) · [Trips](<../../Trips/FABLED 3/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 3/_index.md>) · [Notifications](<../../Notifications & Alerts/FABLED 3/_index.md>)
