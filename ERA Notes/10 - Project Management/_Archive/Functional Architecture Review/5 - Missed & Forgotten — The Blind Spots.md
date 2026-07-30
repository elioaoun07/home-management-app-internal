---
created: 2026-06-12
type: review
status: living
owner: Elio
tags:
  - pm/far
  - scope/cross-cutting
---

# FAR 5 · Missed & Forgotten — The Blind Spots

> **FAR:** [_index](<_index.md>) · [1 · North Star](<1 - North Star — The Goal Revisited.md>) · [2 · Strengths](<2 - Where the App Stands Strong.md>) · [3 · Enhancements](<3 - Enhancement Map — Sharpen What Exists.md>) · [4 · Junctions](<4 - Junction Leverage — Compound Advantages.md>) · **5 · Missed** · [6 · Market & Challenges](<6 - Market Lens & Challenge Letter.md>) · [7 · Synthesis](<7 - Synthesis — The 90-Day Path.md>)
>
> Two very different lists. **Part A: forgotten** — things you *already built* that fell out of your own planning docs (cheapest wins in the whole review). **Part B: missed** — things genuinely absent that fit the graph and the goal. Items already on your radar (Track C's Documents Vault, Vehicle, Health, Receipts OCR, Global Search) are **not repeated** — they were good calls; only scope notes are added where this review changes them.

---

## Part A — The Forgotten (built, then lost from the map)

| # | Asset | Evidence | Why it matters | Wake-it action |
|---|---|---|---|---|
| A1 | **Anomaly detection** | `src/lib/utils/anomalyDetection.ts` | The L4 brain, already statistical and severity-classed | Emit signals server-side (R4) |
| A2 | **Three forecast widgets** | `dashboard-v2/widgets/*Forecast*` | "Cashflow Forecast" is Track C's #1 — a third of it exists | Reuse the math in `get_briefing_bundle` |
| A3 | **AI budget suggestions** | `ai_budget_suggestions` + `ai-suggest` route | A weekly money advisor nobody talks about | Verify reach; surface as proposals (R3) |
| A4 | **Schedule suggester** | `api/suggest-schedule` | AI scheduling exists, undocumented in PM | Document; wire into item creation flow |
| A5 | **Gamification spine** | `hub_user_stats` streaks; `hub_feed` types `budget_alert`/`milestone`/`streak` | Habit retention machinery, half-emitting | Finish or remove ([C6](<6 - Market Lens & Challenge Letter.md>)) |
| A6 | **Briefing TTS** | `lib/tts/briefingToSpeech.ts` | A *spoken* morning brief is nearly free | Wire to the L3 brief |
| A7 | **Recipe AI import** | `api/recipes/extract-from-url`, `[id]/generate` | Real differentiator, absent from Kitchen PM docs | Add to Kitchen folder; advertise in UI |
| A8 | **Merchant learning** | `merchant_mappings` | Only statement import benefits | Backlog 1b + R5.1 |
| A9 | **Push telemetry** | `push_event_logs` (write-only) | The learning loop's raw data, already collecting | Start reading it (R5.2) |
| A10 | **Memories stub** | `features/memories/` (hooks+types only) | ERA's long-term memory, undecided since May | Decide: it's the E6 substrate — promote *when* E6 starts, else delete |
| A11 | **Guest bot** | `api/guest-portal/bot` | A second conversational surface exists | Leave frozen ([C2](<6 - Market Lens & Challenge Letter.md>)); just document |

> **The meta-lesson:** features fall out of memory because shipping ≠ registering. The Atlas hook solved this for *pages*; nothing solves it for *capabilities*. The PM folders (Hard Rule 25) are the fix — A1–A11 should each get one line in their module's Feature State file so they stop being invisible.

---

## Part B — The Missed (absent, high-fit)

### Tier 1 — Do these (high leverage, rides existing rails)

**M1 — External calendar bridge (ICS first).** The time graph is blind to your *real* calendar — work meetings, family events living in Google/Outlook. A briefing that says "free evening" when you have a 7pm call is wrong in the most trust-eroding way. No `BEGIN:VCALENDAR` anywhere in `src` (verified). *Phase 1 (days):* publish an ICS feed of items/meals/trips others can subscribe to. *Phase 2:* subscribe to external ICS read-only so briefings see busy blocks. Two-way sync: explicitly **not** — that's a tar pit ([C-scope](<6 - Market Lens & Challenge Letter.md>)).

**M2 — PWA Share Target ⭐ (the Lebanon open-banking substitute).** `manifest` has no `share_target` (verified). Registering as one makes ERA a *destination* for anything on the phone: share a **bank SMS** → parsed → transaction draft; share a screenshot/receipt photo → OCR draft (joins Track C6); share a recipe URL → A7 import; share any text → note/reminder parse. In a no-Plaid country, bank SMS + share-target **is** the bank feed. Android-only (iOS share targets don't reach PWAs) — fine: capture on one device beats capture on none, and it feeds the Time-to-Capture KPI directly (R1).

**M3 — Price Book / household inflation index.** You hold per-item price observations across statement lines, restock history, and catalogue prices — nobody connects them. "Labneh: +22% since March; your basket: +14% this quarter; Spinneys vs Carrefour for your top 10." In a hyperinflation economy this is *the* killer money feature, and it's pure derivation — no new capture. Global apps will never build it.

**M4 — People & Dates.** Catalogue has contacts; Items has recurrence; Budget has envelopes. Missing: the layer that joins them — birthdays/anniversaries/name-days auto-reminding *with lead time to buy a gift*, gift ideas captured year-round (catalogue), a gifts envelope (allocation), and "what did we give last year" (transactions). The assistant that remembers your mother-in-law's birthday 10 days early, with a budget and an idea, is the assistant people tell stories about.

**M5 — Affordability simulator ("can we…?").** The question every household actually asks: "Can we afford a $400 weekend next month?" Answer = forecast (A2) + recurring obligations + envelopes, delivered conversationally (one new ERA intent) with an honest yes/no/"yes-if". This is Track C1's Cashflow Forecast *turned into a dialogue* — same math, far more felt value, and a perfect first tool for the J10 hybrid.

**M6 — Weekly Review ritual.** Retention in every serious money app (YNAB et al.) comes from a *ritual*, not alerts. You have the pieces: `MonthlyReviewScorecardWidget`, digest plans (7b), meal planner, This-Week items. A guided 10-minute Sunday flow — money recap → anomalies → next week's shape → meal plan → confirm — that *ends* by generating the week's briefing schedule. The digest becomes the ritual's output instead of another notification.

### Tier 2 — Strong, after Tier 1

**M7 — True savings goals & debt payoff plans.** `future_purchases` covers *purchases*; missing: goal envelopes with funding rules ("$100/month to Emergency Fund until $2k") and debt *payoff plans* (snowball/avalanche over existing `debts`). Both are thin layers over allocations + recurring.

**M8 — Household audit trail.** Two people edit shared money and plans; today changes are silent. A lightweight "who changed what" feed (the `hub_feed` types again — A5) prevents the "did you delete the dentist reminder?" class of friction. Trust between partners is a feature.

**M9 — Year in Review.** December delight: spend story, most-cooked recipe, streaks, trips, chores champion. All derivable; two days of work; the kind of thing that makes the household *love* the app. Schedule it as a December task, not a now task.

**M10 — Utilities & home ops (Lebanon pack).** Generator subscription (amperage, monthly LBP), EDL, water trucks, internet — as recurring *templates* with regional fields, plus optional meter-photo snapshots. Small scope; deeply daily-real; pairs with M3.

### Tier 3 — Horizon (named so they stop nagging, parked deliberately)

**M11 — Email-in ingestion** (forward receipts/bookings to era@…): powerful, heavy, after share-target proves the parse pipeline. **M12 — Household data export/backup** ("one-click household archive"): cheap insurance, do during a quiet week; full Documents Vault remains Track C3. **M13 — Roles beyond the pair** (kids/helpers with scoped views): only if the household actually changes shape ([C3](<6 - Market Lens & Challenge Letter.md>)). **M14 — Wear/Watch glanceables**: already Track D9; keep parked.

---

## Ranking (what this review would build first)

```
  IMPACT
   ▲
H  │  M2 Share-target capture ⭐    M1 ICS bridge (phase 1→2)
   │  A1–A3 wake-ups (via R4)      M5 Affordability dialogue
   │                               M3 Price book
   ├──────────────────────────────────────────────────────
M  │  M4 People & Dates            M6 Weekly Review ritual
   │  M8 Audit trail               M7 Goals & payoff plans
   │  M10 Lebanon pack             
   ├──────────────────────────────────────────────────────
L  │  M9 Year in Review (Dec)      M11–M14 (parked)
   └──────────────────────────────────────────────────────►
        LOW EFFORT            MED EFFORT           HIGH EFFORT
```

→ How these interleave with R/J items: [FAR 7](<7 - Synthesis — The 90-Day Path.md>).
