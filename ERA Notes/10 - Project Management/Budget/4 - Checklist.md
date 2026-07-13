---
created: 2026-06-20
updated: 2026-07-13
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/budget
---

# Budget - 4 - Checklist

> **Command Center:** [\_index](_index.md) - [1 - Feature State](<1 - Feature State.md>) - [2 - Vision & Roadmap](<2 - Vision & Roadmap.md>) - [3 - Action Plan](<3 - Action Plan.md>) - [4 - Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Budget - every open actionable item as one checkbox, grouped Now / Next / Later. Completed items are cleared once done — see git history or [1 - Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S/M/H.

---

## Next - First Enhancement

- [ ] **X2a** Merchant-match -> Voice Draft Transactions - when the spoken message contains a known merchant, run it through `matchMerchantMapping()` so the resulting draft pre-selects Category/Subcategory from the merchant map (in addition to the existing NLP category matching). Entry points: `smartTextParser`/voice draft flow in `src/lib/nlp/` + drafts review UI. _(annoyance - S-M)_
- [ ] **X2b** Merchant-match -> Hub Budget Chat "Add as Transaction" - when converting a chat message to a transaction (Message Actions), run the message text through the merchant map to pre-select Category/Subcategory in the action sheet. Junction work — coordinate with [Hub & ERA - 4 - Checklist](<../Hub & ERA/4 - Checklist.md>) (L6). _(annoyance - S-M)_

## Later - Connect Outward

- [ ] **L1** Recurring -> Schedule due-date unify - coordinate with [Schedule - 4 - Checklist](<../Schedule/4 - Checklist.md>). _(friction - H)_
- [ ] **L2** Cashflow forecast -> ERA briefing - project balances forward; scope after core tests exist. _(friction - H)_
- [ ] **L3** 50/30/20 budgeting templates + Dashboard V2 widgets. _(annoyance - M)_
- [ ] **L4** Allocation auto-suggest from recurring commitments. Fold into X1 if it becomes part of the allocation workflow redesign. _(annoyance - M)_
- [ ] **L5** Future Purchase -> Transaction auto-complete on linked purchase. _(annoyance - S-M)_
- [ ] **L6** Debt -> Schedule auto-reminder on collection date. _(annoyance - S-M)_
- [ ] **L7** Split the expense + recurring mega-forms into testable units (only when next touched). _(parked - M)_
- [ ] **L8** Statement Import -> Inventory/Catalogue price pre-fill. _(parked - M)_
