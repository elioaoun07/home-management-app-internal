---
created: 2026-05-30
updated: 2026-06-26
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/budget
---

# Budget - 3 - Action Plan

> **Command Center:** [_index](<_index.md>) - [1 - Feature State](<1 - Feature State.md>) - [2 - Vision & Roadmap](<2 - Vision & Roadmap.md>) - [3 - Action Plan](<3 - Action Plan.md>) - [4 - Checklist](<4 - Checklist.md>)
>
> **What this file is:** the why, and in what order for Budget - the strategic call and the candidate work as narrative. The flat, checkable version of this plan is [4 - Checklist](<4 - Checklist.md>); tick the boxes there.

---

## The Call

**This period: protect the money, then make allocation feel intentional.**

Budget's core is stable, so the danger is not just missing features - it is that
money can feel split across accounts, transfers, and envelopes without a single
clear flow. The foundation work still matters: wrong numbers are worse than any
UI bug. But after the Salary -> Wallet shortcut, the next product pressure is
clearer: funding Wallet and allocating that money should feel like one action
sequence, not two disconnected chores.

This mirrors the global theme ("Stabilize, then Connect") at the cluster level:
harden the financial core, then connect Budget's account movement and allocation
surfaces.

---

## Candidate Work

| Candidate | Track | Impact | Effort | Foundation? |
|---|---|---|---|---|
| `balance-utils` unit tests | A | High | M | yes - done |
| Recurring next-due unit tests | A | High | M | yes - done |
| Salary -> Wallet quick refill | A | Med | S | shipped 2026-06-25 |
| Public/shared accounts | A | High | M | shipped 2026-06-26 |
| Allocation workflow across accounts | A | Med | M | next |
| Recurring -> Schedule due-date unify | B | High | H | - |
| Merchant-map -> manual entry | A | Med | S-M | - |
| Cashflow forecast -> ERA | B | High | H | - |
| 50/30/20 + Dashboard V2 widgets | A | High | M | - |
| Debt -> Schedule auto-reminder | B | Med | S-M | - |
| Remove/guard `analytics/debug` route | A | Low | S | - |

---

## The Sequence

**Now - Foundation.** Lock the highest-stakes logic before anything else:
`balance-utils` and recurring next-due tests (both done), the reconciliation
checkpoint (done), then the quick `analytics/debug` hygiene fix.

**Just shipped - Wallet refill shortcut.** `/expense?transfer=salary-wallet`
opens the mobile expense form with a focused amount prompt and resolves
Salary/Wallet account IDs from the tapping user's own accounts.

**Just shipped - Public/shared accounts.** Accounts are private by default, but
owners can mark visible accounts public so the active household partner can open
them, post transactions, adjust balances, use categories, and transfer to/from
them.

**Next - First enhancement.** Tighten money allocation across accounts: make
Salary -> Wallet funding, available Wallet balance, recurring commitments, and
category envelopes feel like one intentional flow. Merchant-map -> manual entry
remains valuable, but allocation is the sharper pain surfaced by this work.

**Later - Connect outward.** Open the Recurring -> Schedule due-date bridge
(coordinate with [Schedule - 4 - Checklist](<../Schedule/4 - Checklist.md>)),
then the cashflow forecast -> ERA briefing - only after the core tests exist.
Resist building the forecast before the core tests exist: a silent balance bug
would hide there, and a forecast amplifies it.

Every item above as a checkable line (with IDs, severity, effort): [4 - Checklist](<4 - Checklist.md>).

---

## Not Now

- Do not refactor `MobileExpenseForm` (~2,890 LOC) or `recurring/page.tsx`
  (~2,772 LOC) just because - only when next touched for a feature.
- Do not build the cashflow forecast before the balance/recurring tests exist.
- Do not open the Recurring -> Schedule bridge before the recurring tests exist.

---

## Later / Backlog

- Cashflow forecast (project balances forward from recurring + allocations).
- 50/30/20 budgeting templates + Dashboard V2 widgets.
- Allocation workflow across accounts, including recurring minimum suggestions.
- Future Purchase -> Transaction auto-complete on linked purchase.
- Debt -> Schedule auto-reminder on collection date.
- Split the expense + recurring mega-forms into testable units.
- Statement Import -> Inventory/Catalogue price pre-fill.
