---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Debts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Debts · Feature State

> [FABLED+ root](<../../../_index.md>) · **Debts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A functional owed-to/owed-by ledger with settlement actions, but the most important part of debt—human agreement about terms, partial progress, and respectful follow-up—lives outside the system.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/debts.md`
- `ERA Notes/02 - Standalone Modules/Debts/Overview.md`
- `src/features/debts/hooks.ts`
- `src/components/web/WebDebts.tsx`
- `src/app/api/debts/route.ts`
- `src/app/api/debts/[id]/route.ts`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; current source wins over documentation.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Debt parties, direction, amounts, dates, and settlements are recorded. |
| **Interpret** | The UI separates owed-to and owed-by positions. |
| **Propose** | Little assistance exists around fair timing or partial settlement. |
| **Commit** | Create, update, delete, and settle are available. |
| **Verify** | A settlement can be recorded, but mutual acknowledgement/evidence is weak. |
| **Learn** | The system does not learn preferred reminder tone, cadence, or realistic settlement plans. |

## Existing leverage

- Direction, counterparty, amount, settlement, and standalone debt APIs provide a clear base.
- Settlement is explicit rather than inferred from reads.
- The feature is small enough to evolve without another megafile.

## Feedback, friction, and risk

- A debt row is financially precise but socially thin: terms, promises, evidence, and acknowledged changes are missing.
- Partial settlements and disputed amounts need a clear history rather than overwriting a current total.
- Reminder ownership and tone matter; a technically correct notification can damage trust.

## Study conclusion

**Inference:** Make debts a respectful social contract with an auditable money trail, not merely an amount attached to a name.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/debts/hooks.ts" "src/components/web/WebDebts.tsx" "src/app/api/debts/route.ts" "src/app/api/debts/[id]/route.ts"

Re-read every mutating route and run focused tests before implementation.

