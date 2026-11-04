---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit beb8584 (application source identical to 22152c2)"
---

# ERA Action Execution (06)

One consistent lifecycle for everything ERA changes: how a sentence becomes an action, what is checked, shown and approved, how it runs, how its outcome is proven, and how repeats, retries, unknown outcomes, partial success, interruptions, stale approvals and changed inputs are handled. Read from source, `migrations/schema.sql` and vault/PM docs. No action, route, migration, test, PM file or instruction was run or changed.

## Files

| File | Use it to |
|---|---|
| [ACTION-INVENTORY.md](ACTION-INVENTORY.md) | See the four paths ERA writes through, every ERA action and the important module mutation paths with their idempotency, receipts and reversal, the lifecycle mechanisms that already exist, reusable Delivery-engine patterns and gaps A-1–A-10. |
| [ACTION-LIFECYCLE.md](ACTION-LIFECYCLE.md) | Read the action envelope, states, rules LC-1–LC-32 for each stage and hard case, the Undo-versus-compensation definitions, three worked cross-module examples (meal → shopping, transfer + recurring, trip + chores + dentist + calendar) and owner decisions XD-1–XD-9. |
| [APPROVAL-AND-RECOVERY-MATRIX.md](APPROVAL-AND-RECOVERY-MATRIX.md) | Look up, per action, tier, escalators, what an approval binds to, expiry, idempotency, unknown-outcome handling, partial success and reversal; the recovery playbook; what "Check" reads. |
| [ACCEPTANCE-SCENARIOS.md](ACCEPTANCE-SCENARIOS.md) | Test a converged lifecycle offline: AC-01–AC-42 with fake sources, pure transitions and replayed model fixtures. |

**Reading order.** Inventory → Lifecycle → Matrix → Acceptance.

## Labels

CURRENT IMPLEMENTATION (read in code), DOCUMENTED INTENT (vault/PM), PROPOSED DESIGN (this folder), UNKNOWN (live DB, deployment flags, devices, owner). ⛁ = needs a migration newer than the 2026-08-04 RLS snapshot. Scenario data is fictional.

## Related

- PM owners: Hub & ERA HUB-46 (durable, idempotent capture), HUB-102 (inverses), HUB-104 (journal), HUB-108/HUB-109 (hardening, effective consent), HUB-116 (bulk, idempotent multi-writes); Schedule SCH-24/SCH-25; Major Bug Sweep M2 (recurring double post); decisions DEC-04, DEC-24.
- [19-business-rules](../19-business-rules/README.md) (M2, BR-17/BR-18), [04-memory-context](../04-memory-context/README.md) (copies, forget), [05-proactive-assistance](../05-proactive-assistance/README.md) (standing rules, Prepare vs Execute).

## Limits

- Whether the durable journal (`NEXT_PUBLIC_ERA_DURABLE_EXECUTION`) is enabled, and whether `era_runs`, `era_actions` and the catalogue revision migration are applied, is UNKNOWN.
- Source routes were read, not exercised; idempotency claims come from code paths and comments, not from replay tests run in this session.
- No external research was needed for this part.
