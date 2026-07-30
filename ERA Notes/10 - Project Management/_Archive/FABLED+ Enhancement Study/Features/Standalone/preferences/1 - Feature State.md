---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Preferences
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Preferences · Feature State

> [FABLED+ root](<../../../_index.md>) · **Preferences** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A central configuration module for currency, custom month, theme, section order, onboarding, notifications, and integrations, but settings lack scope, provenance, impact preview, and temporary override semantics.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/preferences.md`
- `ERA Notes/02 - Standalone Modules/Preferences/Overview.md`
- `src/features/preferences`
- `src/components/settings/SettingsDialog.tsx`
- `src/app/api/user-preferences/route.ts`
- `src/contexts/ThemeContext.tsx`
- `src/components/settings/GoogleCalendarSettings.tsx`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Explicit user configuration is captured. |
| **Interpret** | Contexts/hooks apply preferences across surfaces. |
| **Propose** | Defaults and impact are weakly explained. |
| **Commit** | Mutations persist settings and invalidate data. |
| **Verify** | Cross-surface application and cache effects are not previewed. |
| **Learn** | Repeated reversals/corrections do not suggest better defaults. |

## Existing leverage

- LBP-in-thousands and custom billing month encode real household physics.
- Theme and section order personalize high-frequency surfaces.
- Settings already coordinate notifications and Google Calendar connections.

## Feedback, friction, and risk

- Mine, partner's, household, device, route, and temporary preferences are not one explicit scope model.
- A setting can have wide downstream effects without a before/after preview or consumer list.
- Configuration origin—default, user choice, migration, inferred—is not visible.

## Study conclusion

**Inference:** Make preferences an explainable policy layer: scoped owner, source, affected surfaces, temporary override, preview, and exact rollback.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/preferences" "src/components/settings/SettingsDialog.tsx" "src/app/api/user-preferences/route.ts" "src/contexts/ThemeContext.tsx"

Run focused tests and inspect consumers before implementation.

