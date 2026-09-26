---
created: 2026-09-26
updated: 2026-09-26
type: template
status: template
owner: Elio
---

# Item Execution Plan

Append inside the existing Master Book `### <ID>` section. Follow [Conventions §9](<../_Conventions.md#9-item-execution-plans>). Keep acceptance outside the plan intact. Fill the placeholders; remove them before use. This draft shape does not opt work into prepared delivery.

**Execution plan — YYYY-MM-DD**

**Readiness:** Implementation draft / investigation first / split first / decision held / owner evidence. Name the exact blocker.

**Verify:** Existing command or explicitly proposed test; normal case, distinguishing failure/retry case, expected result. Name owner-only evidence separately. Commands here are future checks, not claims they ran.

```delivery-plan-v1
{
  "outcome": "One observable result.",
  "acceptance": ["The distinguishing success and failure conditions; the existing full acceptance remains binding."],
  "scope": ["Verified intended write path; clearly identify any proposed new path in steps."],
  "steps": [
    "Read the specific entry point and confirm the current contract.",
    "Make the smallest complete change using the existing seam.",
    "Verify the named cases and record local implementation separately from owner acceptance."
  ],
  "invariants": ["The essential behavior that must survive this change."],
  "exclusions": ["Adjacent work this item does not authorize."],
  "checks": [],
  "risks": ["A concrete failure this plan must avoid."],
  "unknowns": ["An actual unresolved input; use an empty array if none."],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "Date, source revision and what was inspected; distinguish docs, source, fixture and runtime evidence."
}
```

`checks: []` deliberately means no prepared protected criterion is claimed. Put real criterion IDs here only after preparing and verifying their pinned inputs. Do not put test commands here. Low-risk owner-reviewed promotion is governed by the existing Delivery parser and approval flow; it is not a documentation shortcut around them.
