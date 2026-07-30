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

# Healthcare · FABLED 3.3 — Optimization Plan

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

**Verified 2026-07-18.** Ordered queue — the PM checklist (`../4 - Checklist.md`) is authoritative for IDs; this file adds sequencing rationale.

1. **HLTH-7 first, nothing before it** (S). Run `migrations/2026-07-17_healthcare-core.sql` in Supabase SQL Editor; verify: page loads on mobile, partner sees shared profile but NOT unshared condition, recipe allergen warning fires on both accounts. Any-model task with the runbook open.
2. **Route-test the CRUD surface** (M, new — not yet in checklist as of 2026-07-18). Pattern: the existing `tests/` vitest setup; assert 401 unauth, 400 bad Zod, 409 on duplicate, ownership rejection. Ten small routes ≈ one session.
3. **HLTH-19 promoted ahead of Phase 2** (M). Author the `healthcare` skill via `skill-factory` BEFORE HLTH-8..12, not after (Phase 4). Rationale: the skill exists to make Phase 2 safe for lower-tier executors; writing it after Phase 2 protects nothing.
4. **Extract cards from `HealthcareClient.tsx`** (S–M) into `src/components/healthcare/` before Phase 2 UI lands. Follow `ui-guardrails`.
5. **Write the PHI visibility doctrine paragraph** into `02 - Standalone Modules/Healthcare/Overview.md` (S): what `shared_with_household` does and does not promise, stated once, cited by future forms.
6. Then Phase 2 (HLTH-8..12) exactly as specified in the checklist, with `recurrence-safety` + `timezone-handling` + the new skill open.
