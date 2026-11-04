---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit cacf59d (2026-11-04)"
---

# ERA Business Rules (19)

The business rules with the largest effect on what the household sees, pays and is reminded of, twelve scenarios that test them at their boundaries, and the decisions only the owner can make. Read from code, migrations and vault docs at commit `cacf59d`. No test, fix, schema or data change was made, and no scenario was executed.

## Files

| File | Use it to |
|---|---|
| [BUSINESS-RULES.md](BUSINESS-RULES.md) | Look up 32 rules (money, dates, schedule, kitchen/health/fitness, household, lifecycle, ERA): trigger, inputs, conditions, result, exceptions, code references, tests, documented intent, plus ten contradictions and the acceptance gaps. |
| [SCENARIO-CATALOGUE.md](SCENARIO-CATALOGUE.md) | Walk through twelve fictional situations (billing boundaries, midnight entries, duplicates, over-settled debts, private accounts, split restores, LBP change, trips and chores, DST and travel, scheduler outages, offline weekends, conflicting edits) with today's outcome and the acceptance check. |
| [OPEN-DECISIONS.md](OPEN-DECISIONS.md) | Decide 17 business questions; each lists today's behaviour, options with their effect, and what acceptance would look like. |

## Conventions

Current behaviour is described, not treated as correct. Defect IDs (`M2`, `T1`, `H1`…) are from `ERA Notes/10 - Project Management/Research/Major Bug Sweep.md`; "Audit #n" from `ERA Notes/01 - Architecture/Mutation Integrity Audit.md`; "01-atlas F-…" and "08-shared-data" link to the earlier research folders. Tests were found by name and call site, not run.
