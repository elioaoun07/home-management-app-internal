---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/3 - FABLED 2 — Optimization Plan.md
tags:
  - pm/fabled3
  - module/budget
---

# Budget · FABLED 3.3 — Optimization Plan

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2 file 3 stands where not superseded below. Ordered delta queue:

1. **O1 — Route tests for `transactions` + `accounts` (M).** Copy the `recurring-payments/[id]/route.test.ts` pattern verbatim (it mocks `supabaseServer`). Priority: household-linking reads (Hard Rule 13), `ownOnly=true`, 23505→409, soft-delete visibility. These two families guard every dollar display in the app.
2. **O2 — Split `recurring/page.tsx` (M).** Extract the tab panels into `src/components/recurring/` while the code is 2 weeks old. The commitments engine already draws the seam — the page should only compose.
3. **O3 — Document the matching constants (S, docs).** One table in the vault doc (`02 - Standalone Modules/Recurring Payments/`): date window, amount tolerance, account rule for `matched`, with one worked example per state. Prevents Gap #4's silent-mismatch class from being re-derived wrongly by a future editor.
4. **O4 — Close the merchant loop (S–M).** Manual entry (expense form category picker) consults `merchant-mappings` for a suggested category on description match. The API is live; this is UI wiring plus one hook.
5. **O5 — console.* sweep in finance routes (S).** Hard Rule 22; the hotspot list is in the evidence snapshot (recurring `[id]` route: 7).
