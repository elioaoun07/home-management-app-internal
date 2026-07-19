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

# Healthcare · FABLED 3.2 — Gaps & Missing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

**Verified 2026-07-18.** Ranked by risk.

1. **The migration has not been run in production** (HLTH-7 open, blocker). The deployed code calls `get_health_bundle()` / `get_household_allergens()` and queries four tables that may not exist in the live DB. Until HLTH-7 is done, the healthcare page 500s in prod. This is the module's only blocker and it is a 10-minute task.
2. **Zero route tests** on 10 routes. Phase 2 (medications) will build safety-critical logic on top of these; landing it on untested foundations doubles the risk. The routes are small and pure — cheap to test now, expensive to retrofit.
3. **No domain skill** (HLTH-19). Medications = dose math + recurrence + PHI visibility asymmetry — exactly the risk profile `skill-factory` exists for. Currently a successor doing Phase 2 has only the PM checklist as guard.
4. **`HealthcareClient.tsx` is a 1,013-line monolith** one day after birth. Not urgent, but every phase will grow it; card extraction is cheapest now.
5. **PHI in a shared-household app has no explicit privacy doctrine.** `shared_with_household` on profiles is the only switch; conditions/allergies/vaccines inherit profile visibility wholesale. There is no per-record privacy, no audit trail of partner views, and the vault doc (`02 - Standalone Modules/Healthcare/Overview.md`) doesn't state the intended boundary. A wrong assumption here leaks medical data to the partner silently.
6. **Allergen keyword matching is naive substring/keyword-based** (`allergenMatch.ts`) — "nut" vs "nutmeg" class false positives/negatives; no per-language handling. Fine for v1; document the limits before anyone trusts it clinically.
