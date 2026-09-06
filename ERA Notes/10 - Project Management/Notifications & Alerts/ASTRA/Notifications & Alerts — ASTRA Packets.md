---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Notifications & Alerts — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../Notifications & Alerts — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-NOTIF-1 | NEW; owner tradeoff required | Unallocated; Notifications owns | HELD for owner acceptance of extra tap/shortcut removal; no new ID |

## Plan reconciliation

| Proposal | Mapping | Boundary |
|---|---|---|
| ASTRA-NOTIF-1 | NEW | Held removal candidate for an unsafe secondary completion path |
| Future shared occurrence action | EXTENDS → NOTIF-3.2/3.3; DOCKS → E-11 | Schedule's authorized transition + immutable notification origin first |
| Delivery outcomes/policy | DOCKS → E-05/E-19; EXTENDS → NOTIF-19 | Accepted Top Layer identity/claim machinery; no duplicate packet |
| Cron console cleanup | CONFLICTS → locked decision5 versus current Hard Rule22 | Retire blanket cleanup in Phase5, keep structured server errors |
| Quiet-hours conflict | CONFLICTS → D5 / E-05 hour | Already recorded Top Layer C01; do not decide twice |

## Execution contract

These sheets are specifications, **NOT RUN**. Copy this block with an individually dispatched sheet. S ≤ half a session; M ≤ one 2–4h session. Study IDs allocate no campaign integers; Phase 5 landing above records the canonical queue. A partial child never closes an incomplete parent.

**Common gates:** named regressions execute nonzero cases and pass; `pnpm typecheck`, `pnpm lint`, `pnpm pm:lint` exit 0, with output and tested revision attached. The existing PM lint error for the missing DLV-77 migration path is a separately owned Phase-5 prerequisite, not permission to invent SQL. Tests use isolated fixtures and mocked clients; agents make no live DB calls. Owner-run DB/device evidence is separate from mocked tests.

**Forbidden in every sheet:** `src/components/ui/**`; `src/components/hub/HubPage.tsx` (no rider in these campaign sheets); `migrations/schema.sql` without the explicitly paired migration; every path outside the exact allowlist; git writes, production data access, new dependencies, new modules, a second queue/recurrence engine, and changes to existing `/era` layout. New paths are marked **[NEW]**. Relevant PM trace paths named in each sheet are future implementation permissions, not study edits.

| STOP | Condition — stop and leave a five-line evidence/handoff note |
|---|---|
| S1 | A file outside the allowlist needs editing. |
| S2 | A DB write is needed; hand the owner the manual runbook and await APPLIED evidence. |
| S3 | Test count decreases, a required check is red, or a targeted regression executes zero cases. |
| S4 | HubPage grows or a new import of its internals is required. |
| S5 | A new dependency is required. |
| S6 | Work cannot finish in one session; split before proceeding. |
| S7 | A visibility/permission symptom appears; obtain fresh owner DB-state evidence or Hard Rule 27's untruncated queries before route diagnosis. |
| S8 | Money/schedule semantics are ambiguous; ask one focused question rather than guessing. |
| S9 | An AI proposal would write without the required confirmation. |
| S10 | A second engine, queue, parser, regex family, toast system or aggregate for an existing concept is introduced. |
| S11 | Work enters D2's entirely excluded scope. |
| S12 | An existing `/era` element is moved or restyled. |

**NOT done, in every sheet:** migration written ≠ APPLIED; test file ≠ test in CI include; local success ≠ evidence pasted; transport acceptance ≠ observed household outcome; child implementation ≠ parent completion.


## ASTRA-NOTIF-1 · Delegate notification completion to the item tool · S · E · schedule correctness containment

**Outcome:** An item notification opens its resolving tool without silently completing a recurring series or dismissing a failed action.

**Prereqs:** E-01 CI; verify existing getActionRoute item deep links and both in-app consumers. No migration required APPLIED. Owner accepts the explicit tradeoff: one extra tap until occurrence-safe shared completion lands.

**Skills:** `start-task → fix-bug → recurrence-safety → api-route → ui-guardrails → finish-task`.

**Files:** `src/lib/notifications/registry.tsx`; `src/app/api/notifications/actions/route.ts`; `public/sw.js`; `tests/notification-completion-delegation.test.ts` **[NEW]**; `ERA Notes/03 - Junction Modules/Notifications/Overview.md`; `ERA Notes/10 - Project Management/Notifications & Alerts/4 - Checklist.md`; `ERA Notes/10 - Project Management/Notifications & Alerts/Notifications & Alerts — Master Book.md`.

**Boundary:** Registry item-type quick action becomes existing Open navigation with closesNotification false; opening can mark read, never domain-complete/dismiss as a completed task. Reject stale complete_task API requests before any notification/item mutation, using409 and the established item route. Change service-worker complete-item handler to open the same item tool, preserving item ID; remove today's-date/is_recurring fallback mutation. No new copy beyond Open, no new endpoint or UI layout. Preserve confirm-for-budget and ordinary dismiss/read actions.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** Yes: daily series with Sep6 alert → Open changes no occurrence and no parent status; stale complete_task request →409 and zero writes. Nonrecurring item likewise remains unchanged until the owner completes it in the tool.

**Gate:** `pnpm exec vitest run tests/notification-completion-delegation.test.ts --reporter=verbose` → nonzero registry/route cases prove no completion or dismissal writes for stale calls, valid item route, unauthorized refusal and unchanged ordinary actions. Common gates. Owner390×844 captures from drawer, takeover and Android push action each open the exact item with its status unchanged; do not send a production push from an agent.

**PM:** **HELD / UNALLOCATED** — HELD for owner acceptance of extra tap/shortcut removal; no new ID. Before any future dispatch, the owner admits this sheet and the owning campaign allocates a never-used ID after rechecking its entire history. Then use `- ✅ YYYY-MM-DD — **<new campaign ID>** (ASTRA-NOTIF-1) <Outcome above>; <all gate evidence>.` No parent is ticked for this held proposal.

**NOT done:** Containment ≠ safe one-tap completion, domain atomicity, stored occurrence provenance or full notification Undo. Common distinctions apply.

**STOP:** S1–S12 above; if existing action rendering requires another file, stop and re-scope instead of adding broad UI permissions.

## ASTRA 10× Findings

- **Simplification:** Remove a separate completion dialect before adding more notification actions.
- **Uncomfortable:** One additional tap is preferable to a shortcut whose successful acknowledgment can outlive a failed or incorrect domain mutation.
