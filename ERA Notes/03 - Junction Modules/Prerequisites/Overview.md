---
type: feature-doc
module: prerequisites
tags:
  - type/feature-doc
  - module/prerequisites
  - status/active
---

# Prerequisites Engine — Overview

> **Type:** Junction Module (bridges NFC Tags ↔ Items)
> **Source paths:** `src/lib/prerequisites/`, `src/app/api/items/[id]/prerequisites/`
> **Connects:** NFC Tags, Items/Reminders/Tasks
> **Related:** [[NFC Tags Overview]], [[Items & Reminders Overview]]

---

## Purpose

A pluggable trigger engine that evaluates conditions and activates dormant items. Items with prerequisites start in `dormant` status (hidden from normal lists). When a trigger event fires (NFC tap, item completion, etc.), the engine evaluates all prerequisites and transitions matching dormant items to `pending`.

### Atomic source setup — 2026-10-11 (SCH-24)

New items include prerequisites in their original `/api/items` request; `create_item_complete` commits those rows and dormant status together. Existing-item POST/DELETE use `add_item_prerequisite_complete` / `remove_item_prerequisite_complete`: lock the owned live item, validate the trigger, write/remove it and change dormant/pending status in one transaction. The last active prerequisite's removal activates a dormant item in the same commit. Failed state updates roll back the trigger operation; a missing/incomplete acknowledgement remains unknown. Receipts carry resulting item ID/status and must be complete before the route returns success.

Functions use SECURITY INVOKER plus explicit ownership, active household/tag/state and visible prerequisite-item checks; they do not widen RLS. [Owner SQL](<../../../migrations/2026-10-11_atomic-item-create.sql>) and current `db-state.json` evidence are pending. Local injected SQL/API failures prove the transaction boundary, not production visibility or trigger delivery. SCH-10 still owns policy readiness; existing engine/evaluation/condition support is unchanged.

---

## Concepts

### Item Status: `dormant`

A new item status for prerequisite-backed items. Dormant items:

- Are hidden from normal item lists (filtered out)
- Transition to `pending` when their prerequisites are met
- Auto-reset back to `dormant` after completion (re-triggerable)

### Condition Types

| Type               | Status         | Config Example                                          |
| ------------------ | -------------- | ------------------------------------------------------- |
| `nfc_state_change` | ✅ Implemented | `{ "tag_id": "uuid", "target_state": "leaving" }`       |
| `item_completed`   | ✅ Implemented | `{ "prerequisite_item_id": "uuid" }`                    |
| `weather`          | 🔲 Stub        | `{ "condition": "rain", "location": "auto" }`           |
| `time_window`      | 🔲 Stub        | `{ "start": "06:00", "end": "09:00", "days": ["mon"] }` |
| `schedule`         | 🔲 Stub        | `{ "cron": "0 8 * * 1-5" }`                             |
| `custom_formula`   | 🔲 Stub        | `{ "expression": "nfc.oven.state == 'on'" }`            |

### Logic Groups (AND/OR)

Prerequisites are grouped by `logic_group` (integer):

- **Same group** → AND (all must be met)
- **Different groups** → OR (any group passing is sufficient)

Example: `(NFC=leaving AND time=morning) OR (item=pack-bag completed)`

- Group 0: nfc_state_change + time_window
- Group 1: item_completed

---

## Database Table

### `item_prerequisites`

| Column                 | Type                    | Notes                       |
| ---------------------- | ----------------------- | --------------------------- |
| id                     | uuid PK                 |                             |
| item_id                | uuid FK → items CASCADE | The dormant item            |
| condition_type         | text CHECK              | Enum of condition types     |
| condition_config       | jsonb                   | Type-specific configuration |
| logic_group            | integer                 | AND/OR grouping             |
| is_active              | boolean                 | Enable/disable              |
| last_evaluated_at      | timestamptz             | Debug/monitoring            |
| last_result            | boolean                 | Last evaluation result      |
| created_at, updated_at | timestamptz             |                             |

---

## Engine API (`src/lib/prerequisites/engine.ts`)

### `evaluateItemPrerequisites(itemId, supabase, userId)`

Evaluate all prerequisites for a specific item. Returns `{ met: boolean, results: ConditionResult[] }`.

### `findAndActivateTriggeredItems(event, supabase, userId)`

Given a trigger event, find all dormant items whose prerequisites are now met, activate them (`dormant` → `pending`), and return them with subtasks.

### `resetCompletedPrerequisiteItem(itemId, supabase)`

After a prerequisite-backed item is completed, reset it to `dormant` and clear subtask completions so the checklist is fresh for the next trigger.

---

## Evaluator Plugin System (`src/lib/prerequisites/evaluators/`)

Each condition type has a dedicated evaluator file:

- `nfc-state.ts` — Checks NFC tag's `current_state`
- `item-completed.ts` — Checks if a prerequisite item has `status = 'completed'`
- `weather.ts` — Stub (returns `{ met: false }`)
- `time-window.ts` — Stub
- `schedule.ts` — Stub
- `custom-formula.ts` — Stub
- `index.ts` — Registry mapping `condition_type` → evaluator function

### Adding a New Condition Type

1. Add value to `PrerequisiteConditionType` in `src/types/prerequisites.ts`
2. Add CHECK constraint value in `migrations/schema.sql`
3. Create evaluator in `src/lib/prerequisites/evaluators/{name}.ts`
4. Register in `src/lib/prerequisites/evaluators/index.ts`

---

## Integration Points

| Trigger Source                               | Event                  | What Happens                                     |
| -------------------------------------------- | ---------------------- | ------------------------------------------------ |
| NFC tap (`/api/nfc/[slug]/tap`)              | `nfc_state_change`     | Find dormant items matching tag+state → activate |
| Item completion (`/api/items/[id]/complete`) | After completion       | Reset prerequisite-backed items to dormant       |
| Item creation (`/api/items`)                 | With `prerequisites[]` | Set initial status to `dormant`                  |

---

## API Routes

| Route                                            | Method | Purpose                        |
| ------------------------------------------------ | ------ | ------------------------------ |
| `/api/items/[id]/prerequisites`                  | GET    | List prerequisites for an item |
| `/api/items/[id]/prerequisites`                  | POST   | Add a prerequisite             |
| `/api/items/[id]/prerequisites?prerequisiteId=X` | DELETE | Remove a prerequisite          |

---

## Gotchas

- Items with prerequisites MUST start as `dormant` — the POST items route handles this automatically
- When all prerequisites are removed from an item, it auto-transitions from `dormant` → `pending`
- Completed prerequisite-backed items auto-reset to `dormant` (checklist is cleared for next trigger)
- The engine queries are scoped to the current user — no cross-household prerequisite evaluation
- Stub evaluators always return `{ met: false }` — they won't accidentally trigger items
