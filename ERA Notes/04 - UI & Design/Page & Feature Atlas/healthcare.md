---
slug: healthcare
title: Healthcare
category: standalone-page
route: /healthcare
type: page
parent: null
children: []
status: active
tags: []
---

# Healthcare

> Per-profile health records: medications with a daily dose checklist and Schedule reminders, allergies (recipe warnings), medical history and vaccines.

## Files

- **Page**: `src/app/healthcare/page.tsx`
- **Main component**: `src/app/healthcare/HealthcareClient.tsx`
- **Sub-components**: `src/app/healthcare/MedicationsSection.tsx` (Doses checklist card, Medications card, medication form) · `src/app/healthcare/healthUi.tsx` (shared bottom-sheet `Modal`, input/chip styles)

## Hooks

- `src/features/healthcare/hooks` — `useHealthBundle`, profile/allergy/condition/vaccine CRUD, `useCreate/Update/DeleteHealthMedication`, `useSetMedicationDose`

## API routes

- `GET /api/healthcare` (bundle RPC `get_health_bundle`)
- `/api/healthcare/{profiles,allergies,conditions,vaccines}` (+ `[id]`)
- `POST /api/healthcare/medications`, `PATCH|DELETE /api/healthcare/medications/[id]` (`?restore=true` = Undo), `POST /api/healthcare/medications/[id]/doses`
- `GET /api/healthcare/allergens` (household allergen feed)

## DB tables

- `health_profiles`, `health_allergies`, `health_conditions`, `health_vaccines`, `health_medications`, `health_medication_logs`
- Writes reminder rows in `items` (+ `reminder_details`, `item_recurrence_rules`, `item_alerts`, `item_occurrence_actions`) linked by `items.source_medication_id`

## How to get here

- Apps grid / navigation → Healthcare
- Direct URL: `/healthcare`

## What it links to

- Medication reminders appear in Schedule (`/reminders`) as urgent recurring reminders; completing one there ticks the dose here.

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Healthcare/Overview.md`

## Screenshots

- `healthcare-mobile.png`
- `healthcare-desktop.png`

## Notes

- Section order: profile chips → profile summary → Doses (only while a medication is active) → Medications → Allergies → Medical history → Vaccines.
- Doses card has a ‹ day › switcher to tick past days.
