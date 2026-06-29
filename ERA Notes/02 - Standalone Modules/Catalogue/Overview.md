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

## Key Concepts

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
