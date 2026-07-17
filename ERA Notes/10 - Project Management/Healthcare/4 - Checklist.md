---
created: 2026-07-17
updated: 2026-07-17
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/healthcare
---

# Healthcare · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable queue for the Healthcare build. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). Phases are PR-sized vertical slices from the approved 2026-07-17 plan — stamp [1 · Feature State](<1 - Feature State.md>) when a phase ships.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.

---

## Now

**Phase 1 — Core module + allergies** — profiles, allergies, conditions, vaccines; recipe allergen warnings. HLTH-1…6 shipped 2026-07-17 → swept to [1 · Feature State](<1 - Feature State.md>).

- [ ] **HLTH-7** (Phase 1) Run core migration in Supabase SQL Editor, then verify mobile viewport + both-accounts allergen warning + privacy (partner cannot see unshared condition) _(blocker - S)_

## Next

**Phase 2 — Medications + Items junction + verified Google sync** — the safety-critical core (recurrence-safety + timezone-handling mandatory).

- [ ] **HLTH-8** (Phase 2) Medications migration — `health_medications` + `health_medication_logs` (idempotent unique key), `items.source_medication_id` FK + partial index, occurrence-action mirror trigger, materialization RPCs _(blocker - M)_
- [ ] **HLTH-9** (Phase 2) Medications routes — transactional item materialization (one `urgent` reminder item per dose-time), **awaited verified** gcal sync with `gcal_status` bookkeeping, warn-but-allow when Google disconnected → `src/lib/gcal/sync.ts` _(blocker - L)_
- [ ] **HLTH-10** (Phase 2) Extend reconcile cron — med items first, heal `gcal_status` both ways → `src/app/api/cron/gcal-reconcile/route.ts` _(blocker - S)_
- [ ] **HLTH-11** (Phase 2) Medications UI — meds card (status, next dose, gcal badge), adherence history, "Connect Google" CTA _(blocker - M)_
- [ ] **HLTH-12** (Phase 2) Verification battery — 2-dose med = exactly 2 items/events; native alarm with app closed; edit → zero duplicates; offline dose log replay = one row _(blocker - M)_

## Later

**Phase 3 — Catalogue junction** — doctors, insurance, hospitals.

- [ ] **HLTH-13** (Phase 3) Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs → `src/types/catalogue.ts` _(friction - M)_
- [ ] **HLTH-14** (Phase 3) Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`) _(friction - M)_
- [ ] **HLTH-15** (Phase 3) Doctor pickers on health record forms + Care Contacts card on the health page _(annoyance - S)_

**Phase 4 — Seams, polish, domain skill**

- [ ] **HLTH-16** (Phase 4) Vaccine `next_due_on` booster reminders via the same materialization choke point _(friction - S)_
- [ ] **HLTH-17** (Phase 4) Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle` _(friction - M)_
- [ ] **HLTH-18** (Phase 4) Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload) _(annoyance - M)_
- [ ] **HLTH-19** (Phase 4) Author `healthcare` domain skill via skill-factory (PHI boundaries, dose math, asymmetric visibility) → `.claude/skills/skill-factory/SKILL.md` _(friction - M)_
- [ ] **HLTH-20** Med stock + refill reminders _(parked - M)_
