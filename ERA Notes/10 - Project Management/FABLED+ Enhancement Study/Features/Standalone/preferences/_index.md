---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Preferences
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Preferences · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Preferences** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A central configuration module for currency, custom month, theme, section order, onboarding, notifications, and integrations, but settings lack scope, provenance, impact preview, and temporary override semantics.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 4/5 |
| **Decision** | 2/5 |
| **Action safety** | 3/5 |
| **Learning** | 1/5 |
| **Partnership** | 2/5 |
| **Total** | **15/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/preferences.md`
- `ERA Notes/02 - Standalone Modules/Preferences/Overview.md`
- `src/features/preferences`
- `src/components/settings/SettingsDialog.tsx`
- `src/app/api/user-preferences/route.ts`
- `src/contexts/ThemeContext.tsx`
- `src/components/settings/GoogleCalendarSettings.tsx`

## Non-duplication boundary

Theme implementation, Google sync setup, and general onboarding already exist; this pack adds policy scope and explainability.

