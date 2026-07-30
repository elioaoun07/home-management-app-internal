---
created: 2026-07-17
updated: 2026-07-17
type: vision
status: active
owner: Elio
tags:
  - pm/vision
  - module/healthcare
---

# Healthcare · 2 — Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Why this module

The household's health facts (allergies, meds, vaccines, doctors, insurance) live in heads and paper. ERA's promise — capture once, get foresight back — applies directly: an allergy captured once warns on every recipe forever; a medication captured once becomes reminders that fire even with the app closed.

## Standing decisions

- **Profiles cover household + dependents** — `health_profiles.user_id NULL` = child/parent without an account. *(IMPLEMENTED 2026-07-17)*
- **Private by default, allergies always shared** — per-profile `shared_with_household` opt-in for conditions/vaccines; allergies are household-visible unconditionally so recipe warnings work for whoever cooks. Health visibility is asymmetric by design (skill-factory's PHI anticipation). *(IMPLEMENTED 2026-07-17)*
- **Allergen matching is a warning aid, never a gate** — keyword match over free-text ingredients with an over-warn bias and user-editable keywords; it never blocks cooking. *(IMPLEMENTED 2026-07-17)*
- **Medication reminders ride the existing engines** — reminder-type items (priority `urgent`), one item per dose-time, existing rrule pipeline + existing Google Calendar sync promoted to a *verified* state (`gcal_status`). Google native alarms are the offline-reliable channel; the cron/push path is secondary. **Warn-but-allow** when Google is disconnected (owner decision 2026-07-17): save succeeds, persistent "not backed up" warning until verified.
- **Schedule edits archive-and-recreate items** — never in-place RRULE mutation (duplicate-occurrence history). Adherence history lives in `health_medication_logs`, not on items.
- **Expiry alerts (insurance, documents) materialize reminder items** via the existing `source_catalogue_item_id` mechanism — no new alert engine, ever.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| P1 | Core module: profiles, allergies, conditions, vaccines + recipe warnings | ✅ code-complete 2026-07-17 (migration run pending) |
| P2 | Medications + Items junction + verified Google sync + adherence log | Planned |
| P3 | Catalogue junction: doctors, insurance expiry → reminder items, hospitals | Planned |
| P4 | Hub Chat "took my pill", briefing signals, meal-plan badges, med stock, `healthcare` domain skill (skill-factory) | Planned |

Full plan of record: approved implementation plan 2026-07-17 (session plan file `run-a-deep-analysis-cosmic-salamander.md`); origin spec [Module Map Tier 1 #1](<../../07 - Backlog & Ideas/ERA - Module Map & New Module Ideas.md>).
