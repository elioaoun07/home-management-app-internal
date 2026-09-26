---
created: 2026-09-10
updated: 2026-09-26
type: checklist
status: active
owner: Elio
---

# Healthcare — Checklist

[Master Book](<Healthcare — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

One checkbox per outcome. Follow the ID link for acceptance, dependencies, holds and its **Reading guide** (where to start in the code). Lane order is priority, not authorization; owner evidence and policy gates still apply.

## Now

- [ ] **HLTH-25** Apply the medications migration and accept doses + reminders on phone — [criteria](<Healthcare — Master Book.md#hlth-25>) _(blocker - S)_
- [ ] **HLTH-7** Verify core deployment, household privacy and mobile use — [criteria](<Healthcare — Master Book.md#hlth-7>) _(blocker - S)_
- [ ] **HLTH-19** Establish medication safety and privacy contracts — [criteria](<Healthcare — Master Book.md#hlth-19>) _(friction - M)_

## Next

- [ ] **HLTH-21** Distinguish unavailable allergy evidence from a completed check — [criteria](<Healthcare — Master Book.md#hlth-21>) _(friction - M)_
- [ ] **HLTH-9** Verify medication calendar sync with status bookkeeping — [criteria](<Healthcare — Master Book.md#hlth-9>) _(blocker - M)_
- [ ] **HLTH-10** Reconcile medication calendar status — [criteria](<Healthcare — Master Book.md#hlth-10>) _(blocker - S)_
- [ ] **HLTH-11** Show medication calendar status and Connect Google — [criteria](<Healthcare — Master Book.md#hlth-11>) _(friction - S)_
- [ ] **HLTH-12** Verify dose, edit, replay and physical alarm behavior — [criteria](<Healthcare — Master Book.md#hlth-12>) _(blocker - M)_
- [ ] **HLTH-22** Cover core healthcare route contracts — [criteria](<Healthcare — Master Book.md#hlth-22>) _(friction - M)_

## Later

- [ ] **HLTH-13** Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs — [criteria](<Healthcare — Master Book.md#hlth-13>) _(friction - M)_
- [ ] **HLTH-14** Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`) — [criteria](<Healthcare — Master Book.md#hlth-14>) _(friction - M)_
- [ ] **HLTH-15** Doctor pickers on health record forms + Care Contacts card on the health page — [criteria](<Healthcare — Master Book.md#hlth-15>) _(annoyance - S)_
- [ ] **HLTH-16** Vaccine `next_due_on` booster reminders via the same materialization choke point — [criteria](<Healthcare — Master Book.md#hlth-16>) _(friction - S)_
- [ ] **HLTH-17** Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle` — [criteria](<Healthcare — Master Book.md#hlth-17>) _(friction - M)_
- [ ] **HLTH-18** Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload) — [criteria](<Healthcare — Master Book.md#hlth-18>) _(annoyance - M)_
- [ ] **HLTH-20** Med stock + refill reminders — [criteria](<Healthcare — Master Book.md#hlth-20>) _(parked - M)_
- [ ] **HLTH-23** Select private medical reference records — [criteria](<Healthcare — Master Book.md#hlth-23>) _(friction - M)_
