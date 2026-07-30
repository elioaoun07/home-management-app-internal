---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/budget
---

# Budget · FABLED 2 — Gaps & Missing

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Ranked: what's absent, half-built, or stale in the finance cluster. Verified 2026-06-10. New gaps discovered during work go **here** (and into [file 1's](<../1 - Feature State — Current Reality.md>) weak-link list if severe), per Hard Rule #25.

---

## 🔴 G1 — No test coverage above the unit layer

The unit baseline exists and is green (28 tests — balance direction, next-due, custom month, split-bill). But **zero coverage** for:

- **API routes** — no contract tests; a zod schema change or a broken household-link expansion in `accounts/route.ts` ships silently. This is the highest-stakes uncovered surface in the app.
- **Confirm→transaction end-to-end** — recurring confirm posts money; only the *next-due math* is tested, not the posting flow.
- **Transfers** — double-entry direction logic untested at the route level.
- **Statement parsing** — CSV/PDF parse has no fixture corpus; a parser regression looks like "import silently mis-categorizes."

**Why it stays #1:** wrong money is the worst bug class in the app, and the remaining uncovered paths are exactly the ones that *write* money.

## 🔴 G2 — `analytics/debug` route still shipped (verified today)

`src/app/api/analytics/debug/route.ts` exists on `main` 2026-06-10. Listed as a quick hygiene fix since the May 29 audit; still open. Remove or auth-guard it.

## 🟠 G3 — The learned merchant map is import-only

`merchant-mappings` exist and statement import learns from them, but **manual entry never reads the map**. The user teaches the app a merchant's category and then re-teaches it by hand on every manual transaction. (Gap 1b — smallest high-value win in the cluster.)

## 🟠 G4 — Money facts are recorded twice (no Schedule bridges)

Three facts live in Budget that are *also* time facts, with no link:

| Fact | Should connect to | Today |
|---|---|---|
| Recurring payment due-date | Schedule reminder | Two separate records; confirming one doesn't close the other |
| Debt collection date | Schedule reminder | Manual; nothing fires on the date |
| Future purchase target date | Schedule deadline + actual transaction | Wishlist item never auto-completes when the purchase happens |

## 🟠 G5 — Analytics is purely historical

Net worth, mini-charts, spend map — all backward-looking. There is **no forward projection** despite the inputs existing (recurring schedule + allocations + balances). The "you'll dip below X on the 24th" warning is impossible today. (Track-A/B headline in [file 2](<../2 - Future Vision & Roadmap.md>).)

## 🟡 G6 — Trip account creation bypasses the accounts API

Trips creates its account via **direct Supabase inserts that mirror the accounts route logic** (per Trips memory + vault doc). Any change to account-creation invariants (defaults, balance seeding, household linking) must be made twice or trips drift. No mechanical link exists.

## 🟡 G7 — `console.*` hotspot

`src/app/api/` is the worst Hard-Rule-22 offender (~109 files per the May audit), and the finance routes are the bulk of it. Not lint-enforced yet.

## 🟡 G8 — Allocation is disconnected from reality

Budget Allocation envelopes are hand-set; recurring commitments (a known floor for several categories) don't pre-fill or even validate against them (gap 2d).

## ⚪ G9 — Receipts module scope unclear

`api/receipts` + `receipts/` route exist but the global Feature State still marks the scope "unclear from docs" — no vault doc, no Atlas confirmation. Decide what it is or fold it into Statement Import.

## ⚪ G10 — Stale PM claims (corrected 2026-06-10)

Files [1](<../1 - Feature State — Current Reality.md>)/[3](<../3 - Current — Action Plan.md>) said `balance-utils` and recurring next-due were **untested** — they're covered and green since the P0 pass. PM updated this session; recorded here so the next audit doesn't re-flag it.
