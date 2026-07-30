---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/budget
---

# Budget · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements** · v1 baseline: [FABLED/4](<../FABLED/4 - FABLED — Future Enhancements.md>)
>
> Each idea: impact · effort · the seam · **a kill criterion** (when *not* to build it). E1–E5 carry v1 lineage; E6–E10 are new, unlocked by June's work.

---

## E1 — Cashflow forecast engine ⭐ (carried v1-E1 — now half-built without anyone calling it that)

**Impact: High · Effort: M (was H) · Prereq: O1 contract test**

The substrate shipped in June: `budgetForecast.ts` projects per-category spend from outlier-cleaned history (tested), `anomalyDetection.ts` cleans it (tested), recurring next-dues exist (`lib/recurring.ts`, tested). What remains is one pure `src/lib/forecast.ts`: expand recurring N days forward, fold onto `account_balances`, emit a daily projected-balance series. Surfaces: Analytics projected line + ERA briefing sentence ("checking dips to −$40 on the 28th").
**Kill criterion:** none — this is the cluster's 10× and every input is now tested. If it slips again, ask why in the weekly review.

## E2 — Recurring ↔ Schedule due-date unification (carried v1-E2)

**Impact: High · Effort: H · Wait for:** Schedule's engine unification (Stage 2) to land first — one owner (Budget owns the fact), Schedule renders the projection. Rehearse with E4.
**Kill criterion:** if Schedule Stage 2 slips past September, ship the *display-only* version (recurring dues as read-only calendar rows) and defer the two-way completion link.

## E3 — Merchant intelligence, staged (carried v1-E3, upgraded by `normalizeMerchant`)

**Impact: Med→High · Effort: S → M → L**
Stage 1 (S): manual entry reads `merchant-mappings` through `normalizeMerchant` — type "Spinneys" → category pre-filled. Stage 2 (M): merchant autocomplete from history. Stage 3 (L): per-merchant analytics + price drift → Kitchen price feed.
**Kill criterion:** if Stage 1 doesn't measurably reduce manual-entry taps in two weeks of your own use, stop at Stage 1.

## E4 — Debt → Schedule auto-reminder (carried v1-E4; still the right rehearsal)

**Impact: Med · Effort: S–M.** Upsert a linked reminder on debt create/update; settle completes it. Smallest end-to-end rehearsal of E2's bridge pattern. **Kill criterion:** if the item-link plumbing takes >1 day, the bridge design is wrong for E2 too — stop and redesign there, not here.

## E5 — Future Purchase → transaction auto-complete (carried v1-E5)

**Impact: Med · Effort: S–M.** "Link purchase" action + heuristic match (amount ±X%, category, window). **Kill criterion:** skip the heuristic if the manual link action covers 90% of cases in practice.

## E6 — `AnalysisReport` as the app-wide AI contract (new ⭐ — June's exportable invention)

**Impact: High (multiplies every module) · Effort: S per adoption**

The Budget AI proved the recipe: strict JSON schema → precomputed inputs → tolerant Zod → deterministic fallback → markdown + ephemeral dashboard. Generalize the *pattern* (not a framework): a documented contract in `09 - Patterns & Lessons` + one shared `renderReport` surface. First adopters: Schedule week-shape report, Kitchen pantry report, Trips cost recap.
**Kill criterion:** if a second adopter needs >30% new plumbing, the abstraction is premature — copy-paste twice more before extracting.

## E7 — Subscription auditor (new — the outlier engine, inverted)

**Impact: Med–High · Effort: S–M**

The June work built cadence detection + `normalizeMerchant` + recurring-merchant recognition to *suppress* false outliers. Invert it: scan history for **recurring-shaped spend that is NOT in `recurring_payments`** → "These 4 merchants look like subscriptions totaling $63/mo — track them?" One pure function over existing data; proposals via the drafts pattern.
**Kill criterion:** if your own history yields <3 true positives, shelve it — it's a feature for messier data than yours.

## E8 — Money rituals: the Sunday money review (new; rides FAR M6)

**Impact: High (habit-forming) · Effort: M after E1**

A composed weekly surface: scorecard (spend vs envelopes via canonical `sumSpending`), outliers to review, upcoming auto-posts (E1's series), one-tap allocation top-ups. Delivered as digest + Hub card. This is the retention loop that makes all the June analytics *felt* weekly instead of visited occasionally.

## E9 — LBP dual-currency intelligence (new — the differentiator no imported app has)

**Impact: Med–High (unique) · Effort: M**

The app already stores the LBP rate (Preferences, thousands rule). Build on it: per-transaction historical-rate stamping, "rate drift" alerts ("your LBP balances lost $X purchasing power this month"), dual-currency net worth, and statement-import lines auto-tagged by currency. No mainstream budget app handles multi-rate LBP reality; this is moat territory for the actual household using this app.
**Kill criterion:** if daily life has effectively dollarized to the point LBP amounts are noise, park it.

## E10 — Envelope funding flow (new — closes campaign X1 + v1-E7)

**Impact: High (felt monthly) · Effort: M**

One guided flow: salary lands → template transfer to Wallet (exists) → envelopes pre-fill from AI suggestion (exists) → committed floor shown from recurring (one query). The pieces all shipped; this is choreography, not construction. Pairs with E8 as the month-start ritual.

---

## Recommended order

```
E1 (the 10×, now cheap) → E10 (choreography of shipped pieces) → E3 stage 1 (instant daily win)
  → E4 (bridge rehearsal) → E2 (after Schedule Stage 2) → E8 (rides E1)
  → E6 pattern doc anytime · E7 · E9 opportunistic
```
