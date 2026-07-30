---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/1 - FABLED 2 — Current Implementation.md
tags:
  - pm/fabled3
  - module/kitchen
---

# Kitchen · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) is **fully normative** — recipes (+AI surface), meal planning, inventory-in-catalogue, shopping-list junction, chores. `git log c561635..HEAD` over every kitchen path returned zero commits. Nothing to delta except:

## The one change (inbound, from Healthcare)

Recipe detail views now render **allergen warnings** — `src/components/web/RecipeAllergenWarning.tsx` + `RecipeDetailView.tsx` consume `useHouseholdAllergens` (Healthcare's always-visible allergy feed, keyword-matched against ingredients via `src/lib/health/allergenMatch.ts`). Kitchen's ingredient data is now safety-relevant input to another module: **changing ingredient shape or parsing now has a health-warning blast radius.** See [Healthcare FABLED 3.1](<../../Healthcare/FABLED 3/1 - FABLED 3 — Current Implementation.md>).
