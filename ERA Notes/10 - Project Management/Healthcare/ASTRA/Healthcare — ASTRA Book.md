---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Healthcare — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../Healthcare — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Book delta

Master Book read end to end. `git log --since=2026-07-30 --format="%h %ad %s" --date=short -- src/features/healthcare src/app/api/healthcare src/app/healthcare src/lib/health src/hooks/useHouseholdAllergens.ts src/components/web/RecipeAllergenWarning.tsx` returns no commits. Source has10 API routes and the allergen matcher test; medication tables/routes remain planned.

The “core migration has not run, UI over missing tables” statement is not current evidence. The **historical Aug4** embedded catalog snapshot lists all four health tables plus get_health_bundle/get_household_allergens. That contradicts a blanket claim of absent objects at that timestamp, but does not prove the full migration, grants or present privacy behavior. **UNVERIFIED:** current application state; owner fresh catalog and HLTH-7 two-account outputs settle it. E-00/HLTH-7 must verify actual state before rerunning any SQL.

The identity paragraph calls Google sync verified; the same book calls it a future bridge and HLTH-12 explicitly requires a real-phone alarm. Source `gcal/sync.ts:204` stores event ID after API creation, not proof a phone alarm fired. Preserve that distinction.

## Re-scored maturity

Same six dimensions; provisional source study, no clinical assessment or production verification.

| Dimension | Book | ASTRA | Evidence |
|---|---:|---:|---|
| Data correctness | 7 | 5 | Historical objects present; current privacy/trigger contract unknown |
| Test protection | 3 | 3 | Matcher tests, no healthcare route tests found |
| Cross-module bridges | 4 | 4 | Recipe warning exists with failure-state loss |
| Code health | 8 | 7 | Shared feed/typed matcher useful; query state is discarded |
| AI leverage | 2 | 2 | No medication feature to expose safely |
| Handoff | 5 | 5 | Explicit asymmetric privacy; false migration/sync claims need revision |
| **Mean** | **4.8** | **4.3** | Availability matters as much as keyword matching |

## Ranked findings

### F1 — Feed failure is rendered identically to no allergen matches

`useHouseholdAllergens.ts:19–24` throws on offline/HTTP failure but defaults a missing payload field to[]. `RecipeAllergenWarning.tsx:26–30` discards query status and defaults missing data to[]; banner51 returns null for zero hits. On first load with failed retrieval, the warning aid silently disappears. This is **not** an allegation that the app explicitly labels food safe; the problem is indistinguishable absence.

Retain cached hits during offline/refetch failures, while exposing whether the feed was checked, cached or unavailable. Persisted data helps after a successful fetch; it cannot supply first-load knowledge. Do not introduce “safe to eat” conclusions, block cooking or broaden the keyword model.

### F2 — The existing narrow feed is the correct cross-module boundary

Allergen endpoint `allergens/route.ts:20–26` calls a separate household feed with no-store; shared hook lives outside the healthcare feature directory. That is the architectural leverage: Recipes needs minimal allergens, not access to conditions or full health profiles. Kitchen ASTRA-KIT-3 owns ingredient producer validation; Healthcare owns consumer availability/privacy. The two protections are complementary.

Current private-profile/public-allergen behavior remains owner-verified under HLTH-7; source comments and migrations do not prove it. Do not send private conditions into generic E-04 context under the label “household.”

### F3 — Medication confidence must be based on dose identity and observed alarms

The planned `UNIQUE(medication_id, occurrence_date, dose_time)` (Master Book §Phase2) is a useful start, but schedule changes archive/recreate items. The durable adherence identity must remain tied to the medication and intended dose, not the new item ID. Keep the existing occurrence engine; current Schedule day projection has known omissions and Google maps base recurrence without exceptions/pauses (Schedule ASTRA F1/F4).

**CONFLICTS → medication “verified gcal” inference:** event ID plus API success cannot stand in for native alarm evidence. Retain the owner's warn-but-allow disconnected decision; do not silently impose a new save gate. HLTH-12's real-phone alarm and replay test remain mandatory before claiming backup works. Move HLTH-19's domain-skill prerequisite ahead of HLTH-8/9, as the Book already recommends; no new parallel medication roadmap.

### F4 — List warnings need a bounded projection, not every recipe ingredient everywhere

The list payload intentionally omits ingredients (Feature Map §Gotchas); a RecipeCardAllergenDot component exists at `RecipeAllergenWarning.tsx:104` but existence is not wiring. HLTH-18 can later use a bounded warning projection keyed by recipe/version plus allergen-feed revision, invalidated by either change. **NEW frontier, held:** justify only with measured detail-opening work saved and acceptable payload/cache behavior; no new cache table or AI classifier now.

## Ranked enhancement catalog

| Rank | Proposal | Size / severity | Mapping |
|---|---|---|---|
| 1 | ASTRA-HLTH-1: preserve allergen feed availability | M / friction | NEW; HLTH-7 verifies deployment/privacy, not failed-query rendering |
| Existing prerequisite | Current core/privacy witness | Existing S | DOCKS → E-00; EXTENDS → HLTH-7 |
| Sequencing | Domain skill before medication schema/routes | Existing M | EXTENDS → HLTH-19; prerequisite to HLTH-8/9 |
| Held | Medication scheduling/log/Google proof | Existing queue, split L before dispatch | DOCKS → M-07; EXTENDS → HLTH-8–12 |
| Held frontier | Versioned list warning projection | No implementation sheet | EXTENDS → HLTH-18; NEW projection approach |

## What ERA needs

Only owner-authorized facts with profile scope and feed completeness. Allergens stay the deliberately household-visible exception; conditions/vaccines obey profile sharing. Medication/dose signals wait for actual medication data and verified timing semantics. No inferred diagnoses, dosage selection or adherence verdicts from a missing completion row.

## Do not do

Do not use /api/health, broaden health-data sharing, treat empty feed as checked, equate Google event creation with delivery, build another recurrence/alert engine or silently change warn-but-allow. Do not add medication implementation merely to populate an ASTRA folder.

## Coverage note

Owns health profiles/allergies/conditions/vaccines and planned medications/catalogue contacts. Kitchen owns recipe storage; Schedule owns recurrence; Notifications/Native own delivery evidence. [Coverage appendix](<../../ASTRA — Coverage & Orphans.md>).

## ASTRA 10× Findings

- **Leverage:** Preserve feed availability alongside matches; the warning system becomes inspectable without changing medical rules (F1).
- **Leverage:** Reuse the deliberately minimal allergen feed instead of exposing full profiles to recipe/ERA consumers (F2).
- **Simplification:** Keep dose logs independent of regenerated reminder-item identities; one source of adherence history (F3).
- **Frontier — EXTENDS → HLTH-18:** A versioned warning projection could extend the existing aid to browsing without shipping full ingredient payloads.
- **Uncomfortable:** The plan calls Google “verified” before the very evidence that would establish it exists (F3).

