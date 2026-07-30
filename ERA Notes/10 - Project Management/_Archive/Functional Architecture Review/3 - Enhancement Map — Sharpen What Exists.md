---
created: 2026-06-12
type: review
status: living
owner: Elio
tags:
  - pm/far
  - scope/cross-cutting
---

# FAR 3 · Enhancement Map — Sharpen What Exists

> **FAR:** [_index](<_index.md>) · [1 · North Star](<1 - North Star — The Goal Revisited.md>) · [2 · Strengths](<2 - Where the App Stands Strong.md>) · **3 · Enhancements** · [4 · Junctions](<4 - Junction Leverage — Compound Advantages.md>) · [5 · Missed](<5 - Missed & Forgotten — The Blind Spots.md>) · [6 · Market & Challenges](<6 - Market Lens & Challenge Letter.md>) · [7 · Synthesis](<7 - Synthesis — The 90-Day Path.md>)
>
> **Deliberately additive:** the Track A bridges and Track B intelligence items in [3 · Future Vision](<../3 - Future Vision & Roadmap.md>) are good — they are *referenced, not repeated*. Below are enhancement angles the existing docs don't have. IDs `R1–R9`.

---

## R1 — The Capture-Cost Audit ⭐ (the silent killer)

**The single biggest threat to this app is not a bug — it's abandonment of data entry.** Every household tracker dies the week one partner stops logging. The defense is a hard product budget: **every routine fact must cost < 5 seconds to record.** Audit the paths:

| Fact | Best path today | Est. cost | Target path |
|---|---|---|---|
| Cash spend | Hub quick-log / voice | ~10–20s | Voice or share-target draft ([M2](<5 - Missed & Forgotten — The Blind Spots.md>)) → < 5s |
| Card spend | Manual entry (statement import later) | ~20s+ | Bank-SMS share → auto-draft → 1 tap confirm |
| "We're out of X" | Shopping list add | ~8s | Voice "add X" ✅ / NFC pantry tag tap |
| New reminder | Quick form w/ NLP | ~10s | Already good — extend NLP (backlog 1d) |
| Meal eaten / cooked | Cooking mode | rarely logged | Cook-mode finish = inventory deduct (2b) — *zero extra cost* |
| Restock after shopping | Inventory restock dialog | ~30s+ | Receipt/share-target parse → batch restock proposal |

**Action:** make Time-to-Capture a tracked KPI ([FAR 1 §5](<1 - North Star — The Goal Revisited.md>)). Every new feature PR answers: "does this lower or raise capture cost?"

## R2 — One Insights Spine (merge the three brains)

Today there are **three disconnected stores of "what the AI thinks"**: `focus_insights` (weekly, items-only), `ai_budget_suggestions` (weekly, money-only), and the ERA conversation pair (`era_*` vs `ai_*` — the split-brain FABLED [G8](<../Hub & ERA/FABLED/2 - FABLED — Gaps & Missing.md>) already flags). Each has its own cache rules, its own rate limits, its own shape.

**Action:** one `insights` table (source, scope, severity, payload, period, feedback) that Focus, ERA faces, the future briefing composer, and the weekly digest all read and write. Decide the era/ai-chat store question in the same stroke. This is schema work measured in days that removes a permanent tax.

## R3 — The Action Inbox (generalize Drafts) ⭐

Drafts already prove the pattern for voice transactions: *automation proposes → human confirms → mutation commits.* Every upcoming automation needs exactly this: inventory low-stock → shopping proposal (2a), statement import suggestions, future-purchase match (2f), debt-due reminder creation (2e), ERA multi-step actions (FABLED [E2](<../Hub & ERA/FABLED/4 - FABLED — Future Enhancements.md>)).

**Action:** promote Drafts into a typed `proposals` system with one inbox surface (badge in Hub), accept/edit/reject/undo, and provenance ("why am I seeing this?"). **This is the trust keystone for L5** — without it every automation invents its own half-trusted UX. Design it once; everything inherits it.

## R4 — Deliver, don't display (wake the dormant intelligence)

[FAR 2 §5](<2 - Where the App Stands Strong.md>) lists the buried treasure. The enhancement is mechanical:

- `anomalyDetection.ts` → run server-side on new transactions → emit signal (L4 seed)
- Forecast widgets' math → `getBriefingSignals()` for Budget → morning brief line ("on pace to overspend Groceries by ~$40")
- `MonthlyReviewScorecardWidget` → the Sunday digest's spine
- `ai_budget_suggestions` → surface as proposals in the Action Inbox (R3)
- `briefingToSpeech` → the morning brief, spoken, on first app-open of the day

**Action:** for each asset: extract pure function → register as signal → choose channel. No new intelligence required.

## R5 — Close the learning loops

The assistant currently *never improves from contact with you* ([FAR 1 §2](<1 - North Star — The Goal Revisited.md>), Learn = 🔴). Three cheap loops, in order:

1. **Merchant memory everywhere** — `merchant_mappings` learns from manual-entry corrections too, and pre-fills category + account + typical amount (existing backlog 1b, widened).
2. **Notification engagement** — start *reading* `push_event_logs` + record act/dismiss per notification; after 4 weeks you have the data to auto-tune timing and prune notification types (feeds Delivery Policy, [J5](<4 - Junction Leverage — Compound Advantages.md>)).
3. **Briefing feedback** — 👍/👎 on every briefing/insight card into the `insights` spine (R2). One integer column; the entire difference between guessing and knowing.

## R6 — The Hub Coverage Matrix (make "primary interface" true)

CLAUDE.md declares Hub Chat the primary interface; in reality an unknown subset of high-frequency actions is chat-doable. **Action:** build the matrix once — rows = the ~25 most frequent household actions, columns = *doable in Hub? / parses NL? / confirmable inline?* — then close gaps top-down. (Multi-transaction parse 1d and "budget status" 8c are existing backlog items that slot here; expense-split E2 too.) The matrix turns "primary interface" from a slogan into a checklist, and doubles as the regression suite spec for intent routing (FABLED [G1](<../Hub & ERA/FABLED/2 - FABLED — Gaps & Missing.md>)).

## R7 — Dual-currency truth (Lebanon's unsolved problem)

A LBP amount from January is *meaningless* without January's rate; any multi-month LBP analytics silently lie. You already store the user LBP rate (Preferences) but not its **history**.

**Action:** `exchange_rates(date, rate)` table, captured on each rate change; analytics value mixed-currency periods at *historical* rates with a USD-equivalent toggle; net worth shows both. Small schema, disproportionate honesty payoff — and a feature literally no global competitor ships correctly for Lebanese reality.

## R8 — Automation transparency ("why did this happen?")

Trips already plans a side-effect transparency panel ([Trips Bet 2](<../Trips/2 - Vision & Roadmap.md>)). Generalize the principle *before* automations multiply: every machine-made change (proposal auto-accepted, cascade fired, prerequisite unlocked, briefing sent) carries provenance you can open — *what fired, what rule, what it read, how to undo, how to mute*. The undo-toast culture (Hard Rule 1) at automation scale.

**Action:** make provenance a required field of the proposals/signals schema (R2/R3) from day one — retrofitting it is miserable.

## R9 — Foundation debts (referenced, gated, not re-argued)

[Audit file 1](<../1 - Codebase & AI Setup Audit.md>) already owns these: money-math tests, intent-routing fixtures, `HubPage.tsx` 5,506 LOC, `MobileExpenseForm` 2,890 LOC, 649 `console.*`, missing module docs. This review adds only one thing: **a gate** — no L3+ proactive feature ships before the P0 money tests and intent fixtures exist ([FAR 6 · C8](<6 - Market Lens & Challenge Letter.md>)). A proactive assistant that pushes *wrong* numbers is worse than no assistant.

---

## Priority within this file

```
  IMPACT
   ▲
H  │  R3 Action Inbox ⭐          R4 Deliver-don't-display
   │  R1 Capture-cost audit ⭐    R5 Learning loops
   ├──────────────────────────────────────────────
M  │  R7 Dual-currency truth     R2 Insights spine
   │  R6 Hub coverage matrix     R8 Provenance
   ├──────────────────────────────────────────────
   │  (R9 is a gate, not a row)
   └──────────────────────────────────────────────►
        LOW EFFORT                MED EFFORT
```

→ Sequenced against everything else in [FAR 7](<7 - Synthesis — The 90-Day Path.md>).
