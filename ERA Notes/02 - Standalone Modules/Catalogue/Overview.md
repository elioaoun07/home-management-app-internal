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
> **DB Tables:** `catalogue_items`
> **Type:** Standalone

## Docs in This Module

- [[Catalogue Tasks Calendar]]
- [[Multi Link Product Comparison]]
- [Catalogue architectural assessment and red-team](<../../../docs/Catalogue — ASTRA Deep Dive.md>) — commissioned 2026-09-07. **Current recommendation is §9, refined by owner clarification in §9.10:** Catalogue is ERA's **Global Reference / Definition Library**, with reusable task definitions owned here and execution owned by Schedule. Retain existing IDs/storage, explicit instantiate/reference/snapshot contracts and authorized retrieval; Brain remains conceptually distinct. Domain-owned masters such as Kitchen recipes keep their existing owner. The red-team rejects a universal Object Memory destination and mandatory Tasks/Documents V2. **Contract proposal only:** no implementation, migration or navigation change; the current standalone classification remains recorded above.

## Key Concepts

> **Final build specification — 2026-09-07:** [ASTRA §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>) implements the accepted §9/§9.10 direction as ownership contracts, additive migration/compatibility rules, UX and prioritized packets C00–C19. Documentation only; no packet is implemented. Earlier Object Memory/Tasks V2 proposals remain historical.

- Task templates as "UI Database"
- Multi-store product links with AI price scraping
- Convert catalogue items to calendar events
- Documents are catalogue items with document-only fields stored in `metadata_json`.
  The Add/Edit Document dialog supports Arabic document name equivalents with
  local English/Arabizi suggestions (for example `Proof of Residency` /
  `ifade sakan` -> `إفادة سكن`), usual cost, prerequisite documents,
  copy/scanned-version acceptance, and issuing location name/maps link.
  *(IMPLEMENTED 2026-06-29)*

## See Also

- [[Common Patterns]]
