---
created: 2026-03-23
type: overview
module: catalogue
module-type: standalone
tags:
  - type/overview
  - module/catalogue
---

# Catalogue

> **Source:** `src/features/catalogue/`, `src/app/catalogue/`
> **API:** `src/app/api/catalogue/`
> **DB Tables:** `catalogue_modules`, `catalogue_categories`, `catalogue_items`, `catalogue_sub_items`, `catalogue_item_calendar_history`
> **Type:** Standalone

## Docs in This Module

- [[Catalogue Tasks Calendar]]
- [[Multi Link Product Comparison]]
- [Catalogue architectural assessment and red-team](<../../../docs/Catalogue — ASTRA Deep Dive.md>) — commissioned 2026-09-07. **Current recommendation is §9, refined by owner clarification in §9.10:** Catalogue is ERA's **Global Reference / Definition Library**, with reusable task definitions owned here and execution owned by Schedule. Retain existing IDs/storage, explicit instantiate/reference/snapshot contracts and authorized retrieval; Brain remains conceptually distinct. Domain-owned masters such as Kitchen recipes keep their existing owner. The red-team rejects a universal Object Memory destination and mandatory Tasks/Documents V2. **Contract proposal only:** no implementation, migration or navigation change; the current standalone classification remains recorded above.

## Key Concepts

> **Final build specification — 2026-09-07:** [ASTRA §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>) implements the accepted §9/§9.10 direction as ownership contracts, additive migration/compatibility rules, UX and prioritized packets C00–C19. Packets are implemented one at a time; see the Kitchen book (KIT-18…24) and Hub & ERA (HUB-69) for status. **C02 (KIT-20) is implemented in code 2026-10-04.** Earlier Object Memory/Tasks V2 proposals remain historical.

- Task templates as "UI Database"
- **Chores section** (top-level card, deep link `/catalogue?section=chores`): a saved view of every visible, non-archived item with `is_chore = true`, across modules and categories. Rows keep their IDs, module and category; detail/edit use the row's own module (`itemModule` in `WebCatalogue`). **Add** opens the task-template editor in the Tasks module with the chore flag preselected. The count is flagged definitions, not this week's occurrences. Changing `is_chore` still fans out to linked items server-side; the client now also invalidates `qk.scheduleItems()`. *(IMPLEMENTED 2026-10-03)*
- **Places** (ERA-owned custom module, HUB-94): created by ERA the first time you save a place ("Add Kobeize as a location", or [Save] after an event's "Where?"). It is a `custom` module marked `settings_json.era_role = "places"` with the `map-pin` icon. Each place is a normal item, and its **tags are aliases** ERA matches ("parents" → Parents' house). **Pinned** places come first in ERA's chips. Renaming the module is safe because ERA finds it by the marker. *(IMPLEMENTED 2026-10-04)*
- Multi-store product links with AI price scraping
- Convert catalogue items to calendar events
- Documents are catalogue items with document-only fields stored in `metadata_json`.
  The Add/Edit Document dialog supports Arabic document name equivalents with
  local English/Arabizi suggestions (for example `Proof of Residency` /
  `ifade sakan` -> `إفادة سكن`), usual cost, prerequisite documents,
  copy/scanned-version acceptance, and issuing location name/maps link.
  *(IMPLEMENTED 2026-06-29)*
- **Places form** (HUB-94 follow-up): a Places item edits Name, Google Maps Link (`maps_url`), Address, Phone, Notes and Tags. Status/priority/frequency/progress are hidden. Detection is `isPlacesModule()` in `src/lib/catalogue/moduleRoles.ts`, shared with ERA. *(IMPLEMENTED 2026-10-04)*
- **Editing contract — KIT-20 / C02** (`src/lib/catalogue/itemPatch.ts`, one Zod schema for route + client type):
  - `metadata_json` is **patched by key**: `metadata_set` / `metadata_unset`. Keys a form doesn't manage survive the save. A legacy `metadata_json` body merges; it never replaces. Forms send only the keys they manage (`diffMetadata`), so a cleared field clears and hidden fields keep their values.
  - `catalogue_items.revision` is the stale-write token. A BEFORE UPDATE trigger bumps it on any authored change, but not on pin/favorite/position or the `linked_item_id` / `is_active_on_calendar` hints. Every writer participates without code changes. A PATCH with an old `expected_revision`, or a metadata merge that raced, returns **409** with the current row. The editor stays open with its input.
  - PATCH returns `inverse`, so the toast's **Undo is real** (it used to only refetch). Delete-Undo restores the **same row** through `/api/recycle-bin/restore`; it used to re-create a copy with a new ID.
  - The app runs with or without the migration: the revision check is skipped while the column is absent.
  - *(IMPLEMENTED 2026-10-04 — migration `2026-10-04_catalogue-revision.sql` applied by owner 2026-10-04)*
- **ERA module roles:** `settings_json.era_role` is unique per user (`catalogue_modules_era_role_uidx`). A duplicate module create returns **409**. ERA's Places bootstrap re-reads on 409 instead of failing.

## Open points (2026-10-04)

| ID | What's left |
| --- | --- |
| KIT-25 | Two-phone stale-save witness (migration applied) |
| KIT-26 | Step 5 `pg_policies` output → one policy set, sub-item visibility, partner rows in shared modules |
| KIT-27 | Refuse revision-less content edits (428) once both phones are updated |
| KIT-21 | Disable atomicity, purge guard, `completed_at` on update-Undo |
| KIT-22 | Typed metadata schemas per kind (interfaces drift from the dialog) |
| HUB-69 | Authorized catalogue search for ERA (after KIT-22) |
| HUB-93 / HUB-95 | ERA contact: open the form; no duplicates; partner path |
| HUB-96 | Event at a saved place gets its Maps link |

## Gotchas

- **RLS is not what the repo docs say until re-checked.** The 2026-08-04 snapshot shows two overlapping policy sets on `catalogue_items` (one through `household_members`, one through `household_links`) and owner-only SELECT on `catalogue_sub_items`. A partner sees a shared item but not its sub-items. The read-only `pg_policies` query is in step 5 of `migrations/2026-10-04_catalogue-revision.sql`. Do not change policies before its output is in hand (Hard Rule #27).
- **Item visibility:** items default to private (`is_public = false`). Modules and categories default to shared. A partner adding an item inside the owner's shared module creates a row only the partner sees.
- **Module counts** (`item_count`) exclude binned and archived items as of 2026-10-04. They used to count rows in the Recycle Bin.
- **`GET /api/catalogue/modules` initializes default modules** for a user with none. Never use it as a background read path (ASTRA §10.6).
- The typed metadata interfaces (`RecipeItemMetadata`, `TaskItemMetadata`, …) drift from the keys the dialog actually writes (`prep_time` vs `prep_time_mins`). The dialog config is the de-facto contract until KIT-22.

## See Also

- [[Common Patterns]]
