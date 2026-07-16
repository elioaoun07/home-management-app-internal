---
created: 2026-06-20
updated: 2026-07-15
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/budget
---

# Budget · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Budget — every open actionable item as one checkbox under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). Completed items are cleared once done — see git history or [1 · Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** X2a→BUD-1, X2b→BUD-2, L1–L8→BUD-3–BUD-10.

---

## Now

- [ ] **BUD-11** [TEST] Verify queryConfig cache timings align with API response patterns _(annoyance - S)_

## Next

- [ ] **BUD-1** Merchant-match → Voice Draft Transactions — when a spoken message contains a known merchant, run it through `matchMerchantMapping()` so the draft pre-selects Category/Subcategory from the merchant map (on top of existing NLP category matching). → `src/lib/nlp/` + drafts review UI _(annoyance - M)_
- [ ] **BUD-2** Merchant-match → Hub Budget Chat "Add as Transaction" — when converting a chat message to a transaction (Message Actions), run the text through the merchant map to pre-select Category/Subcategory in the action sheet. Junction work — coordinate with [Hub & ERA · 4 · Checklist](<../Hub & ERA/4 - Checklist.md>) (HUB-10). _(annoyance - M)_

## Later

- [ ] **BUD-3** Recurring → Schedule due-date unify — coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>). _(friction - L)_
- [ ] **BUD-4** Cashflow forecast → ERA briefing — project balances forward; scope after core tests exist. _(friction - L)_
- [ ] **BUD-5** 50/30/20 budgeting templates + Dashboard V2 widgets. _(annoyance - M)_
- [ ] **BUD-6** Allocation auto-suggest from recurring commitments. Fold into the allocation workflow redesign if it becomes part of that. _(annoyance - M)_
- [ ] **BUD-7** Future Purchase → Transaction auto-complete on linked purchase. _(annoyance - M)_
- [ ] **BUD-8** Debt → Schedule auto-reminder on collection date. _(annoyance - M)_
- [ ] **BUD-9** Split the expense + recurring mega-forms into testable units (only when next touched). _(parked - M)_
- [ ] **BUD-10** Statement Import → Inventory/Catalogue price pre-fill. _(parked - M)_
