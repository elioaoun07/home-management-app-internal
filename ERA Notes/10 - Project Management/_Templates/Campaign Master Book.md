---
created: 2026-07-30
updated: 2026-09-10
type: template
status: template
owner: Elio
---

# Campaign Master Book template

Copy the fenced content to `<Campaign>/<Campaign> — Master Book.md`. This plus the checklist is the campaign root. Replace placeholders; retain the parser headings. [Conventions](<../_Conventions.md>) define ownership and lifecycle.

```md
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: master-book
status: active
owner: Elio
evidence_cutoff: <date/commit; no runtime inference>
---

# <Campaign> — Master Book

> [Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>)

## Purpose and boundaries

<Outcome this campaign owns; modules it covers; standalone/junction relationships. Link the existing architecture/vault docs. Name producer/consumer owners.>

## Current State

<Dated facts, evidence and limits. Distinguish implemented, fixture-tested, owner-applied and device-verified.>

## Pain Inventory

- 🟠 **PREFIX-1 — Observable problem.** <Cause if known; dated evidence; no invented diagnosis.>

## Vision & Decisions

<Accepted direction and constraints. Link unresolved cross-campaign choices to ../_Decisions.md. Record IMPLEMENTED dates only with evidence.>

## Acceptance Criteria Index

### PREFIX-1
- **Acceptance:** <Concrete pass/fail outcome including failure/retry cases where material.>
- **Depends on:** <ID or owner evidence, or none.>
- **Evidence/source:** <Original request/study label and link; verified paths.>
- **Scope limit:** <What completing this item does not imply.>

## Campaign acceptance

<Optional plain bullets for broad goals. Every outstanding concrete requirement has a queue ID; no duplicate checkboxes.>

## Shipped Log

## Delivery session log

## Backlog reconciliation

<YYYY-MM-DD — old ID → surviving ID, or cancellation/history pointer; reason and preserved scope. No shipped stamp for a merge.>

## Successor Briefing

<First docs/checks to read; current traps; relevant skills; verification commands; last source evidence date.>

## Pointers

<Current plans, related campaign IDs, historical evidence.>
```
