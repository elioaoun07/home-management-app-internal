---
created: 2026-03-23
type: overview
module: household
module-type: junction
tags:
  - type/overview
  - module/household
---

# Household Sharing

> **Source:** `src/features/hub/`
> **DB Tables:** `household_links`, `profiles`
> **Type:** Junction — connects ALL modules

## Docs in This Module

- [[Household Sharing Setup]]

## Key Concepts

- RLS policies for read-only partner access
- Private transactions filtering
- Active partner check via `household_links`
- API routes must check `household_links` for partner data inclusion

## See Also

- [[Common Patterns]]
