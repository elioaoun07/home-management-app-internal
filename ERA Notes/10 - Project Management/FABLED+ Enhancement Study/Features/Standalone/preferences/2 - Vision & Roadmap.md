---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Preferences
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Preferences · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Preferences** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make preferences an explainable policy layer: scoped owner, source, affected surfaces, temporary override, preview, and exact rollback.

## Business and household value

Settings that remain understandable reduce support, regression risk, and partner confusion. Scope-aware policy also enables safe reuse beyond one household.

Measure attention returned, risk reduced, or outcomes improved—not engagement.

## Roadmap

1. Now — inventory every preference, owner, default, consumer, and invalidation.
2. Next — add scope and impact preview to one high-impact setting.
3. Later — propose defaults from repeated choices only as reviewable changes.

## New opportunity set

### V1 — Preference provenance

- **Mechanism:** Show whether a value came from default, user, household agreement, migration, or temporary override.
- **Smallest proof:** Apply to theme, month start, and LBP rate.
- **Success measure:** A user can explain why each value is active.
- **Kill criterion:** Use a compact source badge only for high-impact settings.
- **Invariant:** Provenance never changes the value.

### V2 — Impact preview

- **Mechanism:** List affected screens, queries, calculations, and partner/device scope before saving.
- **Smallest proof:** Preview custom month start and theme changes.
- **Success measure:** No unexpected downstream change in the trial.
- **Kill criterion:** Keep previews only for settings with broad effects.
- **Invariant:** Preview derives from real consumer registry.

### V3 — Temporary policy override

- **Mechanism:** Apply an expiring setting for trip, guest, device, or exceptional period, then restore explicitly.
- **Smallest proof:** Use a local-only temporary notification or section-order override.
- **Success measure:** The override expires correctly with a clear receipt.
- **Kill criterion:** Use manual reset if temporary policies are rare.
- **Invariant:** Expiry cannot silently overwrite a later explicit choice.

## Existing-roadmap boundary

Theme implementation, Google sync setup, and general onboarding already exist; this pack adds policy scope and explainability.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notifications, and automation.

