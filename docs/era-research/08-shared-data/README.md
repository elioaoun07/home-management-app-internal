---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit 77141d1 (2026-11-04)"
---

# ERA Shared Data (08)

ERA's current domain model and the few shared contracts that real cross-module use cases need. Written from `migrations/schema.sql`, migrations, source and vault docs at commit `77141d1`. No schema, migration, data or code was changed.

## Files

| File | Use it to |
|---|---|
| [DOMAIN-GLOSSARY.md](DOMAIN-GLOSSARY.md) | Look up what a shared word (person, household, owner, local date, occurrence, completion, deleted…) means in code today and the term proposed for contracts. |
| [ENTITY-MAP.md](ENTITY-MAP.md) | See every module's entities, identifiers, cross-module links, lifecycle states, completion fields, and who each record concerns, belongs to, may be changed by and notifies. |
| [SOURCE-OF-TRUTH-MATRIX.md](SOURCE-OF-TRUTH-MATRIX.md) | Find the authoritative store for a fact, its copies and mirrors, values computed in several places (with a worked billing-period comparison), and tie-break rules. |
| [CROSS-MODULE-CONTRACTS.md](CROSS-MODULE-CONTRACTS.md) | Read the six proposed contracts (dates and zones, recurrence and occurrence identity, participation, lifecycle, corrections, references), what is deliberately not proposed, seven fictional worked examples, the staged transition and the owner decisions. |

## Labels

CURRENT IMPLEMENTATION (read in code), DOCUMENTED INTENT (stated in docs), PROPOSED DESIGN (this work), UNKNOWN (needs the live database, a device or the owner). ⛁ marks tables created by migrations newer than the 2026-08-04 RLS snapshot, whose application is unknown.

## Related

- [01-atlas](../01-atlas/README.md): capability and architecture atlas; findings referenced here as "01-atlas F-…".
- `ERA Notes/10 - Project Management/Research/Major Bug Sweep.md` and `ERA Notes/01 - Architecture/Mutation Integrity Audit.md`: defect IDs (`M2`, `T1`, "Audit #6") cited, not repeated.

## Limits

No production database, live RLS or device was inspected. The billing-period comparison re-ran the repo's logic in a scratch script; it did not run the app. No web research was needed for this part.
