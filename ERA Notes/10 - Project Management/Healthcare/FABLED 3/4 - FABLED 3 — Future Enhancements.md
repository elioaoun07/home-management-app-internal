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

# Healthcare · FABLED 3.4 — Future Enhancements

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

**Verified 2026-07-18.** Each item: Impact · Effort · the seam · Kill criterion. HLTH-13..20 (checklist) are not repeated here — these are beyond-the-checklist ideas, all `new ⭐` (first generation).

- **E1 — Medication adherence signal into ERA briefing** ⭐ · Impact high · Effort M · Seam: `get_health_bundle()` already aggregates; a `missed_doses_7d` key in the bundle + one briefing sentence. Kill: if Phase 2 (HLTH-8..12) hasn't shipped and stabilized for 2 weeks, do not start — adherence data must exist and be trusted first.
- **E2 — Emergency card (offline-first)** ⭐ · Impact high · Effort S–M · Seam: allergies + conditions + emergency contact rendered as a `/healthcare/emergency` route cached by the PWA service worker; QR on the guest portal pattern (`src/app/g/[tag]/`). Kill: if the household never opens it in 30 days of shipping, remove the nav entry (keep the route).
- **E3 — Appointment ↔ Schedule junction** ⭐ · Impact medium · Effort M · Seam: same materialization choke point HLTH-8 builds for meds (`items.source_medication_id` generalizes to `source_health_event_id`). Kill: do NOT build a second expansion path — if it can't reuse the Phase 2 choke point verbatim, park it (recurrence-safety).
- **E4 — Per-record privacy override** ⭐ · Impact medium (privacy) · Effort M · Seam: nullable `visibility` column on child tables overriding profile default; RPC WHERE clauses already centralize the logic. Kill: if Elio's household never asks for it, don't build it — speculative privacy machinery is complexity without a user.
- **E5 — Allergen matcher v2 (word-boundary + synonyms)** ⭐ · Impact low-medium · Effort S · Seam: `allergenMatch.ts` is pure + tested; extend the test table first. Kill: stop at word-boundary matching; NLP/embedding matching is over-engineering for a household N of 2.
